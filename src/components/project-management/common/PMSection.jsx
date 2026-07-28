"use client";

import { cn } from "@/lib/utils";

/**
 * PMSection — bordered section container for PM module forms.
 *
 * Props:
 *   title      string   — section header text (e.g. "BBS Details:")
 *   children   ReactNode
 *   className  string   — extra classes on the outer border box; use to override bg, e.g. className="bg-white"
 *   innerClass string   — extra classes on the inner content wrapper
 */
export default function PMSection({
  title,
  children,
  className = "",
  innerClass = "",
}) {
  return (
    <div
      className={cn(
        "border border-[#b0c5d5] rounded-sm bg-[#e8e8e8] overflow-hidden",
        className,
      )}
    >
      {title && (
        <div className="px-3 pt-2 pb-0.5">
          <span className="text-[13px] font-semibold text-[#1c3a5e]">
            {title}
          </span>
        </div>
      )}
      <div className={cn("px-3 pb-3 pt-1 space-y-[2px]", innerClass)}>
        {children}
      </div>
    </div>
  );
}
