"use client";

import { forwardRef, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import PMInput from "./PMInput";
import { PM } from "./pmTheme";

/**
 * PMTimeInput — PM module time picker with a "Now" quick-fill button.
 *
 * Wraps PMInput (type="time") and exposes a compact "Now" button that sets
 * the current HH:MM without opening the browser's time picker.
 *
 * Compatible with both react-hook-form register() spread and Controller.
 *
 * Props:
 *   disabled   bool
 *   hasError   bool|object
 *   className  string  — applied to the outer wrapper (controls width, e.g. max-w-[220px])
 *   ...rest    — forwarded to the underlying <input type="time"> via PMInput
 */
const PMTimeInput = forwardRef(function PMTimeInput(
  { disabled = false, hasError = false, className = "", ...props },
  ref,
) {
  const innerRef = useRef(null);

  const setRefs = useCallback(
    (el) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleNow = () => {
    const el = innerRef.current;
    if (!el) return;

    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, "0");
    const mm  = String(now.getMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, timeStr);
    } else {
      el.value = timeStr;
    }

    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <PMInput
        ref={setRefs}
        type="time"
        disabled={disabled}
        hasError={hasError}
        expandable={false}
        className="flex-1"
        {...props}
      />
      {!disabled && (
        <button
          type="button"
          onClick={handleNow}
          className={PM.quickFillBtn}
        >
          Now
        </button>
      )}
    </div>
  );
});

export default PMTimeInput;
