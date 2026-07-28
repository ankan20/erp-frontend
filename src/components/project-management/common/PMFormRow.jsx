"use client";

import { cn } from "@/lib/utils";

/**
 * PMFormRow — label + input slot row for PM module forms.
 *
 * On desktop (≥ sm): horizontal — fixed-width label, colon, then input.
 * On mobile (< sm):  vertical   — label + colon on one line, input below.
 *
 * Props:
 *   label      string    — field label text
 *   required   bool      — shows a red asterisk (default false)
 *   labelWidth string    — tailwind width class for label col (default "sm:w-[220px]")
 *   children   ReactNode — the input element(s)
 *   className  string
 */
export default function PMFormRow({
  label,
  required = false,
  labelWidth = "sm:w-[220px] sm:min-w-[220px]",
  children,
  className = "",
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center", className)}>
      {/* Label + colon */}
      <div
        className={cn(
          "flex items-center shrink-0",
          labelWidth,
        )}
      >
        <span className="flex-1 text-[13px] text-[#444444] leading-none">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        <span className="text-[13px] text-[#444444] mx-1.5 shrink-0">:</span>
      </div>

      {/* Input slot */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
