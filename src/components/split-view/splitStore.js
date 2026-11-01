"use client";

// Split view state: extra windows (panes) shown with the current page.
// Kept in sessionStorage so a refresh keeps the windows of this browser tab.
// Read with useSyncExternalStore (server snapshot = no panes, so server render
// and hydration are unchanged for every page).

import { useSyncExternalStore } from "react";

export const MAX_PANES = 20; // safety cap so the browser stays usable
export const PANE_NAME_PREFIX = "erp-pane:"; // frame name → page knows it is inside a window
export const MESSAGE_KEY = "__erpSplitView";
export const MAIN = "main"; // id of the current page in `order`
export const LAYOUTS = ["row", "column", "grid", "float"];
const STORAGE_KEY = "erp-split-view";

const EMPTY = Object.freeze({
  panes: [], // [{ id, src, url, float: { x, y, w, h } }]  src = what loads, url = where it is now
  order: [MAIN], // tiled order of windows, the main page included
  layout: "row", // row = side by side, column = stacked, grid, float = free windows
  cols: [1], // grid column weights
  rows: [1], // grid row weights
  zOrder: [], // free mode: last = on top
  maximized: null,
  pickerOpen: false,
  pickerFrom: null,
  nextId: 1,
});

let state = EMPTY;
let loaded = false;
const listeners = new Set();

/** Columns × rows for a layout and number of windows. */
export function gridDims(layout, n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (layout === "column") return { cols: 1, rows: n };
  if (layout === "grid") {
    const cols = Math.ceil(Math.sqrt(n));
    return { cols, rows: Math.ceil(n / cols) };
  }
  return { cols: n, rows: 1 }; // row (and the tiled fallback)
}

const ones = (n) => Array.from({ length: n }, () => 1);
const equalTracks = (layout, n) => {
  const d = gridDims(layout, n);
  return { cols: ones(d.cols), rows: ones(d.rows) };
};

/** Starting place of a new free window (cascade). */
const cascadeRect = (k) => {
  const step = (k % 8) * 0.035;
  return { x: 0.06 + step, y: 0.04 + step, w: 0.46, h: 0.62 };
};

const validRect = (r) =>
  r && [r.x, r.y, r.w, r.h].every((v) => typeof v === "number" && v >= 0 && v <= 1) && r.w > 0.05 && r.h > 0.05;

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
      .map((p, i) => {
        const id = Number(p.id) || i + 1;
        return { id, src: p.url, url: p.url, float: validRect(p.float) ? p.float : cascadeRect(i) };
      });
    const ids = new Set(panes.map((p) => p.id));
    let order = Array.isArray(saved.order) ? saved.order.filter((x) => x === MAIN || ids.has(x)) : [];
    if (!order.includes(MAIN)) order.unshift(MAIN);
    panes.forEach((p) => !order.includes(p.id) && order.push(p.id));
    const layout = LAYOUTS.includes(saved.layout) ? saved.layout : saved.dir === "column" ? "column" : "row";
    const dims = gridDims(layout, order.length);
    const tracksOk = Array.isArray(saved.cols) && saved.cols.length === dims.cols && Array.isArray(saved.rows) && saved.rows.length === dims.rows;
    const tracks = tracksOk ? { cols: saved.cols, rows: saved.rows } : equalTracks(layout, order.length);
    const zOrder = (Array.isArray(saved.zOrder) ? saved.zOrder.filter((x) => ids.has(x)) : []).concat(
      panes.map((p) => p.id).filter((id) => !(saved.zOrder || []).includes(id)),
    );
    state = { ...EMPTY, panes, order, layout, ...tracks, zOrder, nextId: Math.max(0, ...panes.map((p) => p.id)) + 1 };
  } catch {
    /* ignore broken / blocked storage */
  }
}

function persist() {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        panes: state.panes.map((p) => ({ id: p.id, url: p.url, float: p.float })),
        order: state.order,
        layout: state.layout,
        cols: state.cols,
        rows: state.rows,
        zOrder: state.zOrder,
      }),
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

  /** Add a window. Returns false when the safety cap is reached. */
  addPane(url) {
    if (!url || !url.startsWith("/")) return false;
    if (state.panes.length >= MAX_PANES) return false;
    const id = state.nextId;
    const pane = { id, src: url, url, float: cascadeRect(state.panes.length) };
    const order = [...state.order, id];
    set({
      panes: [...state.panes, pane],
      order,
      ...equalTracks(state.layout, order.length),
      zOrder: [...state.zOrder, id],
      nextId: id + 1,
      maximized: null,
      pickerOpen: false,
      pickerFrom: null,
    });
    return true;
  },

  closePane(id) {
    if (!state.panes.some((p) => p.id === id)) return;
    const order = state.order.filter((x) => x !== id);
    set({
      panes: state.panes.filter((p) => p.id !== id),
      order,
      ...equalTracks(state.layout, order.length),
      zOrder: state.zOrder.filter((x) => x !== id),
      maximized: state.maximized === id ? null : state.maximized,
    });
  },

  closeAll() {
    set({ panes: [], order: [MAIN], cols: [1], rows: [1], zOrder: [], maximized: null });
  },

  /** Swap the places of two windows (drag and drop). Nothing reloads. */
  swapPositions(a, b) {
    const ia = state.order.indexOf(a);
    const ib = state.order.indexOf(b);
    if (ia < 0 || ib < 0 || ia === ib) return;
    const order = [...state.order];
    [order[ia], order[ib]] = [order[ib], order[ia]];
    set({ order });
  },

  /** Move a window one place earlier (-1) or later (+1). Nothing reloads. */
  movePane(id, step) {
    const i = state.order.indexOf(id);
    const j = i + step;
    if (i < 0 || j < 0 || j >= state.order.length) return;
    splitActions.swapPositions(id, state.order[j]);
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
    set({
      panes: state.panes.map((p) => (p.id === id ? { ...p, src: p.url + (p.url.includes("?") ? "&" : "?") + "_r=" + Date.now() } : p)),
    });
  },

  toggleMaximize(id) {
    set({ maximized: state.maximized === id ? null : id });
  },

  setLayout(layout) {
    if (!LAYOUTS.includes(layout)) return;
    set({ layout, ...equalTracks(layout, state.order.length), maximized: null });
  },

  equalize() {
    set(equalTracks(state.layout, state.order.length));
  },

  setTracks(cols, rows) {
    set({ cols, rows });
  },

  // ── free (floating) windows ──
  setFloat(id, rect) {
    set({ panes: state.panes.map((p) => (p.id === id ? { ...p, float: rect } : p)) });
  },

  bringToFront(id) {
    if (state.zOrder[state.zOrder.length - 1] === id) return;
    set({ zOrder: [...state.zOrder.filter((x) => x !== id), id] });
  },

  cascade() {
    set({ panes: state.panes.map((p, i) => ({ ...p, float: cascadeRect(i) })), zOrder: state.panes.map((p) => p.id) });
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
