"use client";

// Split view state: extra windows (panes) shown next to the current page.
// Kept in sessionStorage so a refresh keeps the windows of this browser tab.
// Read with useSyncExternalStore (server snapshot = no panes, so SSR/hydration
// is unchanged for every page).

import { useSyncExternalStore } from "react";

export const MAX_PANES = 3; // + the main page = 4 windows
export const PANE_NAME_PREFIX = "erp-pane:"; // iframe name → page knows it is inside a pane
export const MESSAGE_KEY = "__erpSplitView";
const STORAGE_KEY = "erp-split-view";

const EMPTY = Object.freeze({
  panes: [], // [{ id, src, url, pos }]  src = what the frame loads, url = where it is now
  sizes: [1], // flex weights: [main, ...panes by position]
  dir: "row", // "row" = side by side, "column" = stacked
  maximized: null, // pane id shown alone
  pickerOpen: false,
  pickerFrom: null, // pane id that asked for a new window
  nextId: 1,
});

let state = EMPTY;
let loaded = false;
const listeners = new Set();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved?.panes)) return;
    const panes = saved.panes
      .filter((p) => p && typeof p.url === "string" && p.url.startsWith("/"))
      .slice(0, MAX_PANES)
      .map((p, i) => ({ id: Number(p.id) || i + 1, src: p.url, url: p.url, pos: i }));
    state = {
      ...EMPTY,
      panes,
      dir: saved.dir === "column" ? "column" : "row",
      sizes: Array.isArray(saved.sizes) && saved.sizes.length === panes.length + 1 ? saved.sizes : equalSizes(panes.length),
      nextId: Math.max(0, ...panes.map((p) => p.id)) + 1,
    };
  } catch {
    /* ignore broken / blocked storage */
  }
}

function persist() {
  try {
    const ordered = [...state.panes].sort((a, b) => a.pos - b.pos);
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ panes: ordered.map((p) => ({ id: p.id, url: p.url })), dir: state.dir, sizes: state.sizes }),
    );
  } catch {
    /* storage blocked: still works for this page view */
  }
}

function set(patch) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

const equalSizes = (n) => Array.from({ length: n + 1 }, () => 1);

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => {
  load();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useSplitState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── actions ──────────────────────────────────────────────────

export const splitActions = {
  openPicker(fromPaneId = null) {
    set({ pickerOpen: true, pickerFrom: fromPaneId });
  },
  closePicker() {
    set({ pickerOpen: false, pickerFrom: null });
  },

  /** Add a window. Returns false when the limit is reached. */
  addPane(url) {
    if (!url || !url.startsWith("/")) return false;
    if (state.panes.length >= MAX_PANES) return false;
    const pane = { id: state.nextId, src: url, url, pos: state.panes.length };
    const panes = [...state.panes, pane];
    set({ panes, nextId: state.nextId + 1, sizes: equalSizes(panes.length), maximized: null, pickerOpen: false, pickerFrom: null });
    return true;
  },

  closePane(id) {
    const gone = state.panes.find((p) => p.id === id);
    if (!gone) return;
    const panes = state.panes
      .filter((p) => p.id !== id)
      .map((p) => (p.pos > gone.pos ? { ...p, pos: p.pos - 1 } : p));
    set({ panes, sizes: equalSizes(panes.length), maximized: state.maximized === id ? null : state.maximized });
  },

  closeAll() {
    set({ panes: [], sizes: [1], maximized: null });
  },

  /** Move a window one place left (-1) or right (+1). Frames are not reloaded. */
  movePane(id, step) {
    const pane = state.panes.find((p) => p.id === id);
    if (!pane) return;
    const target = pane.pos + step;
    const other = state.panes.find((p) => p.pos === target);
    if (!other) return;
    const panes = state.panes.map((p) => (p.id === id ? { ...p, pos: target } : p.id === other.id ? { ...p, pos: pane.pos } : p));
    const sizes = [...state.sizes];
    [sizes[pane.pos + 1], sizes[target + 1]] = [sizes[target + 1], sizes[pane.pos + 1]];
    set({ panes, sizes });
  },

  /** The frame reported a new location (navigation inside the window). */
  paneNavigated(id, url) {
    if (!url?.startsWith("/")) return;
    if (!state.panes.some((p) => p.id === id && p.url !== url)) return;
    set({ panes: state.panes.map((p) => (p.id === id ? { ...p, url } : p)) });
  },

  /** Load a different page in a window (reloads that frame). */
  setPaneUrl(id, url) {
    set({ panes: state.panes.map((p) => (p.id === id ? { ...p, src: url, url } : p)) });
  },

  reloadPane(id) {
    // new src string forces the frame to load again
    set({
      panes: state.panes.map((p) => (p.id === id ? { ...p, src: p.url + (p.url.includes("?") ? "&" : "?") + "_r=" + Date.now() } : p)),
    });
  },

  toggleMaximize(id) {
    set({ maximized: state.maximized === id ? null : id });
  },

  setDir(dir) {
    set({ dir: dir === "column" ? "column" : "row" });
  },

  equalize() {
    set({ sizes: equalSizes(state.panes.length) });
  },

  setSizes(sizes) {
    set({ sizes });
  },
};

// ── helpers ──────────────────────────────────────────────────

/** True when this page is running inside a split window (frame). */
export function isInsidePane() {
  try {
    return typeof window !== "undefined" && window.self !== window.top && window.name.startsWith(PANE_NAME_PREFIX);
  } catch {
    return false;
  }
}

export function paneIdFromWindow() {
  try {
    return Number(window.name.slice(PANE_NAME_PREFIX.length)) || null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};
/** React hook: inside a split window? (false during server render / hydration) */
export function useIsInsidePane() {
  return useSyncExternalStore(noopSubscribe, isInsidePane, () => false);
}

/** Send a message from a window (frame) to the main page. Same origin only. */
export function postToParent(type, data = {}) {
  try {
    window.parent.postMessage({ [MESSAGE_KEY]: true, type, paneId: paneIdFromWindow(), ...data }, window.location.origin);
  } catch {
    /* ignore */
  }
}

export const currentUrl = () =>
  typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
