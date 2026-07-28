"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * PMInput — flat input for PM module forms.
 *
 * Border behaviour:
 *   • Default  : invisible (border-transparent)
 *   • Typing   : minimal blue-gray border (#93b5cc) — "you're in an input" cue
 *   • Error    : red border + red-50 bg
 *   • Disabled : no border, muted green bg (same as other modules)
 *
 * Overflow in disabled mode:
 *   When the value is longer than the visible width, a Maximize2 icon appears
 *   in the right corner. Clicking it opens a read-only dialog with the full
 *   text. Disable this with `expandable={false}`.
 *
 * Props (beyond standard <input> props):
 *   hasError    bool|object  — red state
 *   disabled    bool
 *   expandable  bool         — overflow icon + modal (default true, text inputs only)
 *   fieldLabel  string       — modal title (falls back to placeholder or "View")
 *   className   string       — applied to the outer wrapper div
 */
const PMInput = forwardRef(function PMInput(
  {
    hasError   = false,
    disabled   = false,
    expandable = true,
    fieldLabel = "",
    className  = "",
    type       = "text",
    ...props
  },
  ref,
) {
  const [overflows,   setOverflows]   = useState(false);
  const [open,        setOpen]        = useState(false);
  const [modalValue,  setModalValue]  = useState("");
  const innerRef = useRef(null);

  // Merge parent ref (react-hook-form) + our inner ref for overflow detection
  const setRefs = useCallback(
    (el) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    // ref is stable from react-hook-form register(); empty deps is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // After a disabled field is painted with its value, check if text is clipped.
  // rAF + setTimeout gives react-hook-form time to write the value to the DOM.
  useEffect(() => {
    if (!disabled || !expandable || type !== "text") {
      setOverflows(false);
      return;
    }
    const id = requestAnimationFrame(() =>
      setTimeout(() => {
        const el = innerRef.current;
        if (el) setOverflows(el.scrollWidth > el.clientWidth + 1);
      }, 0),
    );
    return () => cancelAnimationFrame(id);
  }, [disabled, expandable, type]);

  const handleOpen = () => {
    setModalValue(innerRef.current?.value ?? "");
    setOpen(true);
  };

  const isErr    = !!hasError;
  const showIcon = disabled && expandable && overflows && type === "text";

  return (
    <div className={cn("relative", className)}>
      <input
        ref={setRefs}
        type={type}
        disabled={disabled}
        className={cn(
          "w-full h-[30px] pl-2 text-[13px] rounded-sm outline-none border transition-colors",
          "placeholder:text-gray-400 placeholder:text-[13px]",
          "disabled:opacity-100 disabled:cursor-default",
          // right padding — make room for icon when present
          showIcon ? "pr-7" : "pr-2",
          // colour variants
          isErr
            ? "border-red-400 bg-red-50 text-red-900 placeholder:text-red-300"
            : disabled
            ? "border-transparent bg-[#edf8ed] text-gray-500"
            : "border-transparent bg-transparent focus:border-[#93b5cc]",
        )}
        {...props}
      />

      {/* Overflow expand icon — disabled mode only */}
      {showIcon && (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpen}
          title="View full text"
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200/70 transition"
        >
          <Maximize2 size={12} />
        </button>
      )}

      {/* Read-only dialog for truncated disabled values */}
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-[480px] p-0 gap-0 overflow-hidden"
          >
            <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-[#f5f9ff]">
              <DialogTitle className="text-[14px] font-semibold text-gray-800">
                {fieldLabel || props.placeholder || "View"}
                <span className="ml-2 text-[11px] font-normal text-gray-400">
                  (read only)
                </span>
              </DialogTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 transition"
              >
                <X size={16} />
              </button>
            </DialogHeader>
            <div className="px-4 py-4">
              <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                {modalValue}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});

export default PMInput;
