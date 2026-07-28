"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * PMSelect — flat <select> for PM module forms.
 *
 * Same no-border-by-default contract as PMInput.
 * Error state: red border + red-50 bg.
 *
 * Props:
 *   hasError   bool|object
 *   disabled   bool
 *   placeholder string       — first disabled option text (optional)
 *   options    Array<{ value, label }> | Array<string>
 *   className  string
 *   children   ReactNode     — use either options prop OR children, not both
 */
const PMSelect = forwardRef(function PMSelect(
  {
    hasError = false,
    disabled = false,
    placeholder,
    options,
    className = "",
    children,
    ...props
  },
  ref,
) {
  const isErr = !!hasError;

  return (
    <select
      ref={ref}
      disabled={disabled}
      className={cn(
        "w-full h-[30px] px-2 text-[13px] rounded-sm",
        "outline-none border transition-colors",
        "disabled:opacity-100 disabled:cursor-default",
        isErr
          ? "border-red-400 bg-red-50 text-red-900"
          : disabled
          ? "border-transparent bg-[#edf8ed] text-gray-500"
          : "border-transparent bg-transparent focus:border-[#93b5cc]",
        className,
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options
        ? options.map((opt) =>
            typeof opt === "string" ? (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ) : (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ),
          )
        : children}
    </select>
  );
});

export default PMSelect;
