"use client";

import { forwardRef, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import PMInput from "./PMInput";
import { PM } from "./pmTheme";

/**
 * PMDateInput — PM module date picker with a "Today" quick-fill button.
 *
 * Wraps PMInput (type="date") and exposes a compact "Today" button that sets
 * the current date without opening the browser's calendar picker.
 *
 * Compatible with both react-hook-form register() spread and Controller.
 *
 * Props:
 *   disabled   bool
 *   hasError   bool|object
 *   className  string  — applied to the outer wrapper (controls width, e.g. max-w-[280px])
 *   ...rest    — forwarded to the underlying <input type="date"> via PMInput
 */
const PMDateInput = forwardRef(function PMDateInput(
  { disabled = false, hasError = false, className = "", ...props },
  ref,
) {
  const innerRef = useRef(null);

  // Merge the react-hook-form ref with our internal ref so both
  // point to the actual <input> DOM node inside PMInput.
  const setRefs = useCallback(
    (el) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleToday = () => {
    const el = innerRef.current;
    if (!el) return;

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Use the native setter so React's synthetic event system picks up the
    // change correctly (same technique as @testing-library/user-event).
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, today);
    } else {
      el.value = today;
    }

    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <PMInput
        ref={setRefs}
        type="date"
        disabled={disabled}
        hasError={hasError}
        expandable={false}
        className="flex-1"
        {...props}
      />
      {!disabled && (
        <button
          type="button"
          onClick={handleToday}
          className={PM.quickFillBtn}
        >
          Today
        </button>
      )}
    </div>
  );
});

export default PMDateInput;
