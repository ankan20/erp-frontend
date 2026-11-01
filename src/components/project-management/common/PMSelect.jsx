"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PM } from "./pmTheme";
import FocusCorners from "./FocusCorners";

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
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const isErr       = !!hasError;
  const showCorners = isFocused && !isErr && !disabled;

  return (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        disabled={disabled}
        onFocus={(e) => { setIsFocused(true);  onFocus?.(e); }}
        onBlur={(e)  => { setIsFocused(false); onBlur?.(e);  }}
        className={cn(
          "w-full px-2 outline-none transition-colors",
          PM.inputHeight, PM.inputText,
          "disabled:opacity-100 disabled:cursor-default",
          isErr
            ? "border border-red-400 bg-red-50 text-red-900"
            : disabled
            ? cn("text-gray-500", PM.disabledBg)
            : cn(PM.inputBorder, PM.inputBg),
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
      {showCorners && <FocusCorners />}
    </div>
  );
});

export default PMSelect;
