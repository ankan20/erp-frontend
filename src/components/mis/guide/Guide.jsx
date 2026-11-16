"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { HelpCircle, Lightbulb, Info, RotateCcw, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GUIDE, TOUR_VERSION } from "@/config/guideContent";

/**
 * Smart Guide L1 (web): "?" help panel, first-visit tour card and inline hints.
 * The words come from src/config/guideContent.js.
 */

const TOUR_RESET = "mis-guide-tour-reset";
const tourKey = (screen) => `mis-guide-tour-${screen}-v${TOUR_VERSION}`;
const seen = (screen) => { try { return localStorage.getItem(tourKey(screen)) === "1"; } catch { return true; } };
const markSeen = (screen) => { try { localStorage.setItem(tourKey(screen), "1"); } catch {} };
const unmarkSeen = (screen) => { try { localStorage.removeItem(tourKey(screen)); } catch {} };
const notifyTour = (screen) => window.dispatchEvent(new CustomEvent(TOUR_RESET, { detail: screen }));
const subscribeTour = (cb) => {
  window.addEventListener(TOUR_RESET, cb);
  window.addEventListener("storage", cb); // another tab finished the tour
  return () => { window.removeEventListener(TOUR_RESET, cb); window.removeEventListener("storage", cb); };
};

/** "?" button that opens the help panel for one screen. */
export function GuideHelpButton({ screen, className = "" }) {
  const [open, setOpen] = useState(false);
  const topic = GUIDE[screen];
  if (!topic) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="How this page works" aria-label={`Help: ${topic.title}`}
        className={`p-2 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 ${className}`}>
        <HelpCircle size={15} />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Lightbulb size={17} className="text-blue-600" /> {topic.title}</SheetTitle>
            <SheetDescription>{topic.purpose}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-4">
            {topic.help.map((s) => (
              <section key={s.title}>
                <h3 className="text-sm font-semibold text-gray-800">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600 whitespace-pre-line leading-relaxed">{s.body}</p>
              </section>
            ))}
            <button type="button"
              onClick={() => { unmarkSeen(screen); notifyTour(screen); setOpen(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
              <RotateCcw size={14} /> Show the tour again
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** First-visit tour: a small step-by-step card. Shown once per screen per browser; never blocks the page. */
export function GuideTour({ screen }) {
  const steps = GUIDE[screen]?.tour || [];
  // storage is an outside store: read it with useSyncExternalStore (hidden on the server, no mismatch)
  const show = useSyncExternalStore(subscribeTour, () => !seen(screen), () => false);
  const [i, setI] = useState(0);

  const finish = useCallback(() => { markSeen(screen); setI(0); notifyTour(screen); }, [screen]);
  if (!show || !steps.length) return null;
  const s = steps[i];
  const last = i === steps.length - 1;

  return (
    <div role="region" aria-label="Page tour" className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
      <div className="flex items-start gap-2">
        <Lightbulb size={16} className="mt-0.5 text-blue-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">{s.title}</p>
          <p className="mt-0.5 text-sm text-gray-600">{s.body}</p>
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{i + 1}/{steps.length}</span>
        <button type="button" onClick={finish} aria-label="Close tour" className="p-0.5 rounded text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="px-2.5 py-1 text-xs text-gray-600 hover:underline">Back</button>}
        {!last && <button type="button" onClick={finish} className="px-2.5 py-1 text-xs text-gray-600 hover:underline">Skip</button>}
        <button type="button" onClick={last ? finish : () => setI(i + 1)}
          className="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700">
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </div>
  );
}

/** Small muted hint line. */
export function GuideHint({ children, className = "" }) {
  return (
    <p className={`flex items-start gap-1 text-[11px] text-gray-500 ${className}`}>
      <Info size={12} className="mt-px shrink-0" /> <span>{children}</span>
    </p>
  );
}
