"use client";

/**
 * SmartGuide — reusable in-page help.
 *
 * 1. Hover tips: any element with data-guide="key" shows a small card
 *    (what it is, how to use it, what happens next) on hover / keyboard focus.
 * 2. "What to do next" panel: reads the page state (via `nextStep(context)`)
 *    and tells the user the next action, with a "Show me" button.
 * 3. Guided tour: spotlight walk-through of the page.
 *
 * Usage:
 *   <SmartGuide id="my-page" hints={HINTS} tour={TOUR}
 *               nextStep={getNextStep} context={state} actions={actions} />
 *   <button data-guide="save">Save</button>
 *
 * hints:    { key: { title, what, how: [..], next } | (context) => same }
 * tour:     [{ target: "key", title, body }]
 * nextStep: (context, actions) => { stage, stages, title, body, target, tone,
 *                                   tips: [{ text, tone, action: { label, run } }] }
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Lightbulb, X, ChevronDown, ChevronUp, MapPin, PlayCircle, MousePointerClick, ArrowRight, ArrowLeft } from "lucide-react";

const TIP_WIDTH = 300;
const HOVER_DELAY = 450;

// ---------- small helpers ----------

const readPref = (key, fallback) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: keep working without it */
  }
};

// fallback may be a function, run in the browser (e.g. based on screen width)
function usePref(key, fallback) {
  const [value, setValue] = useState(typeof fallback === "function" ? false : fallback);
  useEffect(() => {
    setValue(readPref(key, typeof fallback === "function" ? fallback() : fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (v) => {
      setValue((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        writePref(key, next);
        return next;
      });
    },
    [key],
  );
  return [value, set];
}

const findTarget = (key) => (key ? document.querySelector(`[data-guide="${key}"]`) : null);
const isVisible = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** Place a card of `width` x `height` next to rect: below if room, else above. */
function placeCard(rect, width, height) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 10;
  const below = rect.bottom + gap + height <= vh || rect.top < height + gap;
  const top = below ? Math.min(rect.bottom + gap, vh - height - 8) : Math.max(8, rect.top - gap - height);
  const left = Math.min(Math.max(8, rect.left), vw - width - 8);
  return { top: Math.max(8, top), left: Math.max(8, left), below };
}

const resolve = (entry, context) => (typeof entry === "function" ? entry(context) : entry);

// ---------- hint card body (shared by hover tip and tour) ----------

function HintBody({ hint }) {
  if (!hint) return null;
  return (
    <>
      {hint.what && <p className="text-[12px] leading-snug text-gray-700">{hint.what}</p>}
      {hint.how?.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[12px] leading-snug text-gray-700">
          {hint.how.map((h, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f6f9f]" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
      {hint.next && (
        <div className="mt-2 flex gap-1.5 rounded-md bg-[#e8f2ff] px-2 py-1.5 text-[11.5px] leading-snug text-[#144664]">
          <ArrowRight className="mt-[2px] h-3 w-3 shrink-0" />
          <span>
            <b>Next:</b> {hint.next}
          </span>
        </div>
      )}
    </>
  );
}

// ---------- 1. hover tips ----------

function HoverTips({ hints, context, enabled }) {
  const [tip, setTip] = useState(null); // { key, rect }
  const timer = useRef(null);
  const current = useRef(null);
  const cardRef = useRef(null);
  const [size, setSize] = useState({ h: 140 });

  useEffect(() => {
    if (!enabled) return;
    const show = (el) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (current.current === el && isVisible(el)) setTip({ key: el.dataset.guide, rect: el.getBoundingClientRect() });
      }, HOVER_DELAY);
    };
    const onOver = (e) => {
      const el = e.target.closest?.("[data-guide]");
      if (!el || el === current.current) return;
      if (!hints[el.dataset.guide]) return;
      current.current = el;
      setTip(null);
      show(el);
    };
    const onOut = (e) => {
      const el = current.current;
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      // moving into a child guide element is handled by onOver
      current.current = null;
      clearTimeout(timer.current);
      setTip(null);
    };
    const hide = () => {
      current.current = null;
      clearTimeout(timer.current);
      setTip(null);
    };
    const onKey = (e) => e.key === "Escape" && hide();
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onOver);
    document.addEventListener("focusout", onOut);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onOver);
      document.removeEventListener("focusout", onOut);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [enabled, hints]);

  useEffect(() => {
    if (tip && cardRef.current) {
      const h = cardRef.current.offsetHeight;
      if (Math.abs(h - size.h) > 2) setSize({ h });
    }
  }, [tip, size.h]);

  if (!tip || !enabled) return null;
  const hint = resolve(hints[tip.key], context);
  if (!hint) return null;
  const pos = placeCard(tip.rect, TIP_WIDTH, size.h);

  return createPortal(
    <div
      ref={cardRef}
      role="tooltip"
      className="pointer-events-none fixed z-[1000] rounded-lg border border-[#b5c7d8] bg-white p-3 shadow-xl"
      style={{ top: pos.top, left: pos.left, width: TIP_WIDTH }}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#144664]">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        {hint.title}
      </div>
      <HintBody hint={hint} />
    </div>,
    document.body,
  );
}

// ---------- "Show me" pulse ----------

function useFlash() {
  const [rect, setRect] = useState(null);
  const raf = useRef(null);
  const stopAt = useRef(0);

  const flash = useCallback((key) => {
    const el = findTarget(key);
    if (!el || !isVisible(el)) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    stopAt.current = Date.now() + 2600;
    cancelAnimationFrame(raf.current);
    const tick = () => {
      if (Date.now() > stopAt.current) {
        setRect(null);
        return;
      }
      setRect(el.getBoundingClientRect());
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    if (el.matches("input, select, textarea")) setTimeout(() => el.focus({ preventScroll: true }), 400);
    return true;
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const ring = rect
    ? createPortal(
        <div
          className="pointer-events-none fixed z-[1000] animate-pulse rounded-md ring-4 ring-amber-400 ring-offset-2"
          style={{ top: rect.top - 3, left: rect.left - 3, width: rect.width + 6, height: rect.height + 6 }}
        />,
        document.body,
      )
    : null;
  return { flash, ring };
}

// ---------- 3. tour ----------

function Tour({ steps, hints, context, onClose }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const [cardH, setCardH] = useState(180);

  // only steps whose element is on screen right now
  const live = useMemo(() => steps.filter((s) => isVisible(findTarget(s.target))), [steps]);
  const step = live[index];

  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    let raf;
    const track = () => {
      if (el) setRect(el.getBoundingClientRect());
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [index, rect?.width]);

  const next = useCallback(() => (index < live.length - 1 ? setIndex(index + 1) : onClose(true)), [index, live.length, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose(false);
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  if (!step || !rect) return null;
  const hint = resolve(hints[step.target], context);
  const width = Math.min(340, window.innerWidth - 16);
  const pos = placeCard(rect, width, cardH);
  const pad = 6;

  return createPortal(
    <div className="fixed inset-0 z-[1001]" role="dialog" aria-modal="true" aria-label="Page tour" data-sync-ignore>
      {/* blocks clicks on the page while touring */}
      <div className="absolute inset-0" onClick={() => onClose(false)} />
      {/* spotlight */}
      <div
        className="pointer-events-none fixed rounded-lg transition-all duration-200"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(15, 30, 45, 0.55)",
          outline: "2px solid #fbbf24",
        }}
      />
      <div
        ref={cardRef}
        className="fixed rounded-lg border border-[#b5c7d8] bg-white p-3 shadow-2xl"
        style={{ top: pos.top, left: pos.left, width }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-[13px] font-semibold text-[#144664]">{step.title || hint?.title}</div>
          <button type="button" onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-700" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1">
          {step.body ? <p className="text-[12px] leading-snug text-gray-700">{step.body}</p> : <HintBody hint={hint} />}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {index + 1} of {live.length}
          </span>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={back} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px] hover:bg-gray-50">
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded bg-[#144664] px-3 py-1 text-[12px] font-medium text-white hover:brightness-110"
            >
              {index < live.length - 1 ? (
                <>
                  Next <ArrowRight className="h-3 w-3" />
                </>
              ) : (
                "Finish"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------- 2. next-step panel + wiring ----------

const noopSubscribe = () => () => {};

const TONE = {
  info: "border-[#b5c7d8] bg-[#f3f7ff] text-[#144664]",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

export default function SmartGuide({ id, hints = {}, tour = [], nextStep, context, actions = {} }) {
  const ns = `smart-guide:${id}`;
  const [tipsOn, setTipsOn] = usePref(`${ns}:tips`, true);
  // start minimised on phones so the page stays usable
  const [collapsed, setCollapsed] = usePref(`${ns}:collapsed`, () => window.innerWidth < 640);
  const [seenTour, setSeenTour] = usePref(`${ns}:tour-seen`, false);
  const [touring, setTouring] = useState(false);
  // true only in the browser (portals need document.body)
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { flash, ring } = useFlash();

  const step = nextStep ? nextStep(context, actions) : null;

  const closeTour = useCallback(
    () => {
      setTouring(false);
      setSeenTour(true);
    },
    [setSeenTour],
  );

  if (!mounted) return null;

  const stages = step?.stages || [];
  const stageIndex = step?.stage ?? -1;

  const panel = collapsed ? (
    <button
      type="button"
      onClick={() => setCollapsed(false)}
      className="fixed bottom-4 right-4 z-[70] inline-flex max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full border border-[#6d9dc5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#144664] shadow-lg hover:bg-[#f0f6ff]"
      aria-label="Open guide"
    >
      <Lightbulb className="h-4 w-4 text-amber-500" />
      <span className="truncate">Guide{step?.title ? `: ${step.title}` : ""}</span>
      <ChevronUp className="h-3.5 w-3.5" />
    </button>
  ) : (
    <section
      aria-label="Smart guide"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[70] w-[min(340px,calc(100vw-2rem))] rounded-xl border border-[#b5c7d8] bg-white shadow-2xl"
    >
      <header className="flex items-center justify-between rounded-t-xl bg-[#144664] px-3 py-1.5 text-white">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-300" /> Smart Guide
        </span>
        <button type="button" onClick={() => setCollapsed(true)} className="rounded p-0.5 hover:bg-white/15" aria-label="Minimise guide">
          <ChevronDown className="h-4 w-4" />
        </button>
      </header>

      <div className="max-h-[50vh] overflow-y-auto p-3">
        {!seenTour && tour.length > 0 && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
            <span>New here? Take a 1-minute tour.</span>
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setTouring(true)} className="rounded bg-amber-500 px-2 py-0.5 font-medium text-white">
                Start
              </button>
              <button type="button" onClick={() => setSeenTour(true)} className="rounded px-1.5 py-0.5 hover:bg-amber-100">
                Later
              </button>
            </span>
          </div>
        )}

        {stages.length > 0 && (
          <ol className="mb-2 flex items-center gap-1 text-[10.5px]">
            {stages.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                    i < stageIndex ? "bg-emerald-500 text-white" : i === stageIndex ? "bg-[#144664] text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {i < stageIndex ? "✓" : i + 1}
                </span>
                <span className={i === stageIndex ? "font-semibold text-[#144664]" : "text-gray-500"}>{s}</span>
                {i < stages.length - 1 && <span className="mx-0.5 text-gray-300">—</span>}
              </li>
            ))}
          </ol>
        )}

        {step ? (
          <div key={step.title} className={`rounded-md border px-2.5 py-2 animate-in fade-in zoom-in-95 duration-300 ${TONE[step.tone || "info"]}`}>
            <div className="text-[13px] font-semibold">{step.title}</div>
            {step.body && <p className="mt-0.5 text-[12px] leading-snug">{step.body}</p>}
            {(step.target || step.action) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {step.target && (
                  <button
                    type="button"
                    onClick={() => flash(step.target)}
                    className="inline-flex items-center gap-1 rounded border border-current/30 bg-white px-2 py-0.5 text-[11.5px] font-medium hover:brightness-95"
                  >
                    <MapPin className="h-3 w-3" /> Show me
                  </button>
                )}
                {step.action && (
                  <button
                    type="button"
                    onClick={step.action.run}
                    className="inline-flex items-center gap-1 rounded bg-[#144664] px-2 py-0.5 text-[11.5px] font-medium text-white hover:brightness-110"
                  >
                    <MousePointerClick className="h-3 w-3" /> {step.action.label}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {step?.tips?.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {step.tips.map((t, i) => (
              <li key={i} className={`flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-[11.5px] leading-snug ${TONE[t.tone || "info"]}`}>
                <span>{t.text}</span>
                {t.action && (
                  <button type="button" onClick={t.action.run} className="shrink-0 rounded border border-current/30 bg-white px-1.5 py-0.5 font-medium hover:brightness-95">
                    {t.action.label}
                  </button>
                )}
                {!t.action && t.target && (
                  <button type="button" onClick={() => flash(t.target)} className="shrink-0 rounded border border-current/30 bg-white px-1.5 py-0.5 font-medium hover:brightness-95">
                    Show
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-[11.5px] text-gray-600">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={!!tipsOn} onChange={(e) => setTipsOn(e.target.checked)} />
          Hover tips
        </label>
        {tour.length > 0 && (
          <button type="button" onClick={() => setTouring(true)} className="inline-flex items-center gap-1 font-medium text-[#144664] hover:underline">
            <PlayCircle className="h-3.5 w-3.5" /> Take the tour
          </button>
        )}
      </footer>
    </section>
  );

  return (
    <>
      {createPortal(panel, document.body)}
      <HoverTips hints={hints} context={context} enabled={!!tipsOn && !touring} />
      {ring}
      {touring && <Tour steps={tour} hints={hints} context={context} onClose={closeTour} />}
    </>
  );
}
