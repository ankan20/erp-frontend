"use client";

import { Check } from "lucide-react";

// Compact horizontal stepper. Used for:
//   - DC transit flow  (Pending_Dispatch → Dispatched → In_Transit → Delivered)
//   - LB payment flow  (Unpaid → Partial → Paid)
//   - Any sequential workflow with a current index.
//
// Props:
//   steps      : [{ key, label, icon? }]
//   current    : the active step key
//   onStepClick: (key) => void   (optional — if set, steps become clickable)
//   canStep    : (fromKey, toKey) => bool  (optional — gate transitions)
//   compact    : boolean — tighter spacing
//
// Styling: thin, one-line, informational. Not a splashy card.

export default function StatusStepper({
  steps = [],
  current,
  onStepClick,
  canStep,
  compact = false,
}) {
  const currentIdx = Math.max(0, steps.findIndex((s) => s.key === current));

  const h = compact ? "h-7 w-7" : "h-8 w-8";
  const dotIcon = compact ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <div className="flex items-center w-full">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isDone   = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isLast   = idx === steps.length - 1;

        const allowed = onStepClick && (!canStep || canStep(current, step.key));
        const clickable = allowed && !isActive;

        const circle = [
          "relative z-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
          h,
          isDone   ? "bg-emerald-500 text-white border-2 border-emerald-500" : "",
          isActive ? "bg-white text-[#144664] border-2 border-[#144664] ring-4 ring-[#144664]/10" : "",
          isFuture ? "bg-white text-gray-400 border-2 border-gray-300" : "",
          clickable ? "cursor-pointer hover:border-[#144664] hover:text-[#144664]" : "",
        ].filter(Boolean).join(" ");

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => onStepClick(step.key) : undefined}
                className={circle}
                title={clickable ? `Mark as ${step.label}` : step.label}
              >
                {isDone ? <Check className={dotIcon} /> : Icon ? <Icon className={dotIcon} /> : (
                  <span className="text-[11px] font-semibold">{idx + 1}</span>
                )}
              </button>
              <span className={`text-[10.5px] leading-tight font-medium whitespace-nowrap ${
                isActive ? "text-[#144664]" : isDone ? "text-emerald-700" : "text-gray-400"
              }`}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-[2px] mx-1 ${idx < currentIdx ? "bg-emerald-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
