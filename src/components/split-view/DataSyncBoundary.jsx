"use client";

/**
 * Live update: when data is created / changed / deleted in another window
 * (split view window or browser tab), this window reloads its page data.
 *
 * - Nothing typed and no form pop-up open → reloads automatically (page is
 *   re-mounted, so it fetches fresh data; URL and scroll position are kept).
 * - Unsaved typing or an open form pop-up → shows a small "Refresh" bar
 *   instead, so no work is lost.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { onDataChanged } from "@/lib/dataSync";

const DEBOUNCE_MS = 600; // one save often sends several requests
const ROOT = "[data-sync-root]";
const FORM_FIELD = "input, textarea, select, [contenteditable='true']";
const OPEN_FORM = '[role="dialog"]:not([data-sync-ignore]), [role="alertdialog"]:not([data-sync-ignore])';

// ── keep scroll positions across the reload ─────────────────────
function pathOf(el, root) {
  const path = [];
  while (el && el !== root) {
    const parent = el.parentElement;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.children, el));
    el = parent;
  }
  return el === root ? path : null;
}
function byPath(root, path) {
  let el = root;
  for (const i of path) {
    el = el?.children?.[i];
    if (!el) return null;
  }
  return el;
}
function saveScroll() {
  const root = document.querySelector(ROOT);
  if (!root) return [];
  const list = [root, ...root.querySelectorAll("*")]
    .filter((el) => el.scrollTop > 0 || el.scrollLeft > 0)
    .map((el) => ({ path: pathOf(el, root), top: el.scrollTop, left: el.scrollLeft }))
    .filter((s) => s.path);
  return list;
}
function restoreScroll(saved) {
  if (!saved.length) return;
  const until = Date.now() + 3000; // data arrives a moment after the reload
  const tick = () => {
    const root = document.querySelector(ROOT);
    let pending = 0;
    for (const s of saved) {
      if (s.done) continue;
      const el = root && byPath(root, s.path);
      if (el && el.scrollHeight - el.clientHeight >= s.top - 1) {
        el.scrollTop = s.top;
        el.scrollLeft = s.left;
        s.done = true;
      } else pending++;
    }
    if (pending && Date.now() < until) setTimeout(tick, 120);
  };
  setTimeout(tick, 50);
}

export default function DataSyncBoundary({ children }) {
  const pathname = usePathname();
  const [version, setVersion] = useState(0);
  const [stale, setStale] = useState(false); // changed elsewhere, waiting for user
  const typed = useRef(false);
  const timer = useRef(null);

  // a new page starts clean
  useEffect(() => {
    typed.current = false;
  }, [pathname, version]);

  // remember unsaved typing (page fields and its form pop-ups)
  useEffect(() => {
    const mark = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.matches(FORM_FIELD)) return;
      if (t.closest("[data-sync-ignore]")) return;
      if (t.closest(ROOT) || t.closest('[role="dialog"], [role="alertdialog"]')) typed.current = true;
    };
    document.addEventListener("input", mark, true);
    document.addEventListener("change", mark, true);
    return () => {
      document.removeEventListener("input", mark, true);
      document.removeEventListener("change", mark, true);
    };
  }, []);

  const reload = useCallback(() => {
    const saved = saveScroll();
    setStale(false);
    typed.current = false;
    setVersion((v) => v + 1);
    restoreScroll(saved);
  }, []);

  const handleChange = useCallback(() => {
    const busy = typed.current || !!document.querySelector(OPEN_FORM);
    if (busy) setStale(true);
    else reload();
  }, [reload]);

  // changes from other windows (debounced; hidden tabs update when shown)
  useEffect(() => {
    let waitingForVisible = false;
    const run = () => {
      if (document.hidden) {
        waitingForVisible = true;
        return;
      }
      handleChange();
    };
    const off = onDataChanged(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(run, DEBOUNCE_MS);
    });
    const onVisible = () => {
      if (!document.hidden && waitingForVisible) {
        waitingForVisible = false;
        handleChange();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handleChange]);

  return (
    <>
      <Fragment key={version}>{children}</Fragment>
      {stale && (
        <div
          role="status"
          data-sync-ignore
          className="fixed right-3 top-3 z-[75] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 shadow-lg"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>Data was changed in another window.</span>
          <button
            type="button"
            onClick={reload}
            className="rounded bg-amber-500 px-2 py-0.5 font-medium text-white hover:brightness-105"
            title="Reload this page's data (unsaved typing here will be lost)"
          >
            Refresh
          </button>
          <button type="button" onClick={() => setStale(false)} className="rounded p-0.5 hover:bg-amber-100" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
