"use client";

import { cn } from "@/lib/utils";
import { PM } from "./pmTheme";

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
        PM.sectionBorder, "rounded-sm overflow-hidden", PM.sectionBg,
        className,
      )}
    >
      {title && (
        <div className="px-3 pt-2 pb-0.5">
          <span className={PM.sectionTitle}>
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
