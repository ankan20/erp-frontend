// Helpers for the keyboard-shortcut engine.
//
// How a shortcut reaches a button:
//   shared buttons carry a `data-shortcut="<name>"` attribute (SaveButton,
//   SaveDraftButton, EditButton, …). A shortcut looks for that button on the
//   screen and clicks it. So a shortcut can never do more than the user could
//   do with the mouse: disabled buttons stay disabled, confirmation pop-ups
//   still open, permissions stay the same.

import { getAllowedPages } from "@/components/split-view/allowedPages";
import { findRouteInfo } from "@/lib/routeAccess";
import { PAGE_CODES, getCodeForPath, parseTcode } from "@/config/tcode.config";
import { ROLE } from "@/config/role.config";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "@/lib/localStorage";

// ── keys ─────────────────────────────────────────────────────────────────────

/** "Ctrl+Shift+S" → { ctrl, alt, shift, code | key | char } */
export function parseCombo(combo) {
  const parts = combo.split("+");
  const main = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());
  const out = {
    ctrl: mods.includes("ctrl"),
    alt: mods.includes("alt"),
    shift: mods.includes("shift"),
  };
  // letters and digits are matched by the physical key, so Alt+letter also
  // works where Alt changes the typed character
  if (/^[A-Za-z]$/.test(main)) out.code = `Key${main.toUpperCase()}`;
  else if (/^[0-9]$/.test(main)) out.code = `Digit${main}`;
  else if (main === "/" || main === "?") out.char = main; // punctuation: by the typed character
  else out.key = main; // Enter, Delete, F2, ArrowLeft, Escape…
  return out;
}

/** Does this keyboard event match the parsed combination? (Cmd counts as Ctrl) */
export function matchesCombo(e, c) {
  if ((e.ctrlKey || e.metaKey) !== c.ctrl) return false;
  if (e.altKey !== c.alt) return false;
  if (c.char === "?") return e.key === "?" || (e.shiftKey && (e.key === "/" || e.code === "Slash"));
  if (c.char === "/") return !e.shiftKey && (e.key === "/" || e.code === "Slash");
  if (e.shiftKey !== c.shift) return false;
  return c.code ? e.code === c.code : e.key === c.key;
}

/** Is the cursor in a place where the user is typing text? */
export function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color"].includes(type);
  }
  return false;
}

// ── finding buttons ──────────────────────────────────────────────────────────

/** The pop-up on top (Radix dialog / alert dialog / sheet), or null. */
export function topDialog() {
  const open = document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
  return open.length ? open[open.length - 1] : null;
}

const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true";

// Is the element really reachable — on screen and not covered by another layer
// (a pop-up that is not a Radix dialog, an overlay…)?
function isReachable(el) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
  const hit = document.elementFromPoint(x, y);
  return !!hit && (hit === el || el.contains(hit));
}

/**
 * Find the button for one of the given shortcut names.
 * Looks only inside the top pop-up when one is open, else the whole page.
 * `nearest` narrows it to the section the cursor is in (Add Row of this table).
 * Returns { el, disabled } or null when there is no such button.
 */
export function findShortcutTarget(names, { nearest = false } = {}) {
  const dialog = topDialog();
  let scope = dialog || document;
  if (nearest) {
    // smallest section around the cursor that has such a button
    const selector = names.map((n) => `[data-shortcut="${n}"]`).join(",");
    let node = document.activeElement?.parentElement;
    while (node && node !== document.body && (!dialog || dialog.contains(node))) {
      if (node.querySelector(selector)) {
        scope = node;
        break;
      }
      node = node.parentElement;
    }
  }
  let firstDisabled = null;
  for (const name of names) {
    const all = Array.from(scope.querySelectorAll(`[data-shortcut="${name}"]`));
    // the last one in the page is the most recently opened / innermost
    for (const el of all.reverse()) {
      if (isDisabled(el)) {
        firstDisabled = firstDisabled || el;
        continue;
      }
      // bring a button at the bottom of a long form into view before the check
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (isReachable(el)) return { el, disabled: false };
    }
  }
  return firstDisabled ? { el: firstDisabled, disabled: true } : null;
}

/** Wait (up to `ms`) for an element to appear, e.g. a pop-up that is opening. */
export function waitForElement(selector, ms = 1500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const scope = topDialog() || document;
      const el = scope.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > ms) return resolve(null);
      setTimeout(tick, 40);
    };
    tick();
  });
}

// ── pages ────────────────────────────────────────────────────────────────────

// May the current user create a record on this page?
function mayCreate(path, role, permissions) {
  const info = findRouteInfo(path);
  if (!info) return true;
  if (info.section === "Settings") return role === ROLE.SUPER_ADMIN;
  if (info.section === "Master") return role === ROLE.ADMIN; // same rule as isMasterEditable()
  if (!info.permissionKey) return true;
  return !!permissions[`${info.permissionKey}.EDIT`];
}

/**
 * Pages the current user may open, with their page code.
 * [{ code, title, trail, path, newPath | null }]
 * Same permission rules as the sidebar; every page still checks again itself.
 */
export function getShortcutPages() {
  const role = getCookie("role");
  const permissions = getLocalStorage("permissions") || {};
  const pages = getAllowedPages().map((p) => {
    const code = getCodeForPath(p.path) || "";
    const hasNewScreen = PAGE_CODES.find((c) => c.path === p.path)?.create;
    return {
      code,
      title: (p.title || "").trim(),
      trail: p.trail,
      path: p.path,
      newPath: hasNewScreen && mayCreate(p.path, role, permissions) ? `${p.path}/new` : null,
    };
  });
  // Dashboard is not in the sidebar; general users reach it from the top bar
  if (role === ROLE.USER) {
    pages.unshift({ code: "DB", title: "Dashboard", trail: "", path: "/dashboard", newPath: null });
  }
  return pages;
}

/**
 * T-code typed by the user → where to go.
 * { path, title, isNew } when allowed, { error } when not.
 */
export function resolveTcodeForUser(input, pages = getShortcutPages()) {
  const parsed = parseTcode(input);
  if (!parsed) return { error: "No page with this code" };
  const page = pages.find((p) => p.path === parsed.listPath);
  if (!page) return { error: "You do not have access to this page" };
  if (parsed.isNew && !page.newPath) return { error: `You cannot create a new ${page.title}` };
  return { path: parsed.isNew ? page.newPath : page.path, title: page.title, isNew: parsed.isNew };
}
