"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { MESSAGE_KEY, PANE_NAME_PREFIX, splitActions } from "./splitStore";

const titleFor = (url) => {
  const crumbs = getBreadcrumbs(url || "");
  return crumbs.length ? crumbs.slice(-2).join(" › ") : url;
};

function IconBtn({ label, onClick, disabled, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-6 w-6 items-center justify-center rounded text-white/90 hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? "hover:bg-red-500/80" : ""
      }`}
    >
      {children}
    </button>
  );
}

/** One extra window: a toolbar + the real page loaded in a frame. */
export default function PaneFrame({ pane, count, dir, maximized, hidden, style, onSwap }) {
  const [loaded, setLoaded] = useState(false);
  const localRef = useRef(null);
  const first = pane.pos === 0;
  const last = pane.pos === count - 1;
  const PrevIcon = dir === "column" ? ChevronUp : ArrowLeft;
  const NextIcon = dir === "column" ? ChevronDown : ArrowRight;

  // a new src means a new load
  const [loadedSrc, setLoadedSrc] = useState(pane.src);
  if (loadedSrc !== pane.src) {
    setLoadedSrc(pane.src);
    setLoaded(false);
  }

  // the page inside says "ready" once it has switched to window mode
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !e.data?.[MESSAGE_KEY]) return;
      if (e.source !== localRef.current?.contentWindow) return;
      if (e.data.type === "ready") setLoaded(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // fallback: if the page never says "ready" (e.g. login page), stop the spinner
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 8000);
    return () => clearTimeout(t);
  }, [loaded, pane.src]);

  const showSpinner = !loaded;

  return (
    <section
      aria-label={`Split window: ${titleFor(pane.url)}`}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-[#6d9dc5] bg-white"
      style={{ ...style, display: hidden ? "none" : "flex" }}
    >
      <header className="flex h-7 shrink-0 items-center gap-0.5 bg-[#144664] px-1.5 text-white">
        <span className="min-w-0 flex-1 truncate px-1 text-[12px] font-medium" title={pane.url}>
          {titleFor(pane.url)}
        </span>
        <IconBtn label="Back" onClick={() => { try { localRef.current?.contentWindow?.history.back(); } catch { /* ignore */ } }}>
          <Undo2 className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Reload" onClick={() => splitActions.reloadPane(pane.id)}>
          <RotateCw className="h-3.5 w-3.5" />
        </IconBtn>
        {count > 1 && !maximized && (
          <>
            <IconBtn label={dir === "column" ? "Move up" : "Move left"} disabled={first} onClick={() => splitActions.movePane(pane.id, -1)}>
              <PrevIcon className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label={dir === "column" ? "Move down" : "Move right"} disabled={last} onClick={() => splitActions.movePane(pane.id, 1)}>
              <NextIcon className="h-3.5 w-3.5" />
            </IconBtn>
          </>
        )}
        <IconBtn label="Swap with main page" onClick={() => onSwap(pane)}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label={maximized ? "Restore" : "Maximise"} onClick={() => splitActions.toggleMaximize(pane.id)}>
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn label="Open in new browser tab" onClick={() => window.open(pane.url, "_blank", "noopener")}>
          <ExternalLink className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn label="Close window" danger onClick={() => splitActions.closePane(pane.id)}>
          <X className="h-4 w-4" />
        </IconBtn>
      </header>

      <div className="relative min-h-0 flex-1">
        <iframe
          ref={localRef}
          name={`${PANE_NAME_PREFIX}${pane.id}`}
          src={pane.src}
          title={titleFor(pane.url)}
          onLoad={() => setTimeout(() => setLoaded(true), 1500)}
          className="absolute inset-0 h-full w-full border-0 bg-[#f5f5f5]"
        />
        {showSpinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#f5f5f5]">
            <Loader2 className="h-6 w-6 animate-spin text-[#2f6f9f]" />
          </div>
        )}
      </div>
    </section>
  );
}
