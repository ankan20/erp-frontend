"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { routeMetaConfig } from "@/config/route-meta.config";
import { TooltipProvider } from "@/components/ui/tooltip";
import SplitViewButton from "@/components/split-view/SplitViewButton";

export default function PageHeader({ actions = [] }) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(
    () => getBreadcrumbs(pathname, routeMetaConfig),
    [pathname],
  );

  return (
    <div className="shrink-0 w-full flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between px-2 pr-3 py-1 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3] gap-1 ">
      {/* LEFT → BREADCRUMB */}
      <div className="text-[13px] font-semibold leading-none sm:whitespace-nowrap min-w-0 break-words">
        <span>Modules : </span>

        {breadcrumbs.map((crumb, index) => (
          <span key={crumb}>
            {index !== 0 && " > "}
            <span
              className={index === breadcrumbs.length - 1 ? "text-red-600" : ""}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* RIGHT → RIBBON */}
      <TooltipProvider delayDuration={400}>
      <div className="flex items-center flex-wrap sm:flex-nowrap">
        {/* SLASH STYLE DIVIDER */}
        {actions.length > 0 && (
          <div className="relative flex items-center mr-2 h-full">
            <div className="w-[3px] h-[28px] sm:h-[32px] bg-[#b8c7da] rotate-[20deg] shadow-[1px_0_2px_rgba(0,0,0,0.25)]" />
          </div>
        )}

        {/* ACTIONS GROUPED */}
        <div className="flex items-center flex-wrap sm:flex-nowrap pl-1">
          {actions.map((action, index) => {
            return (
              <div
                key={index}
                className="flex items-center gap-0 px-[2px] sm:px-[3px]"
              >
                {action}
              </div>
            );
          })}
          {/* split view: open another page next to this one */}
          <SplitViewButton />
        </div>
      </div>
      </TooltipProvider>
    </div>
  );
}

// example use
// const actions = getPageActions({
//     router
//     onHome: () => clearAuthCookies(),
//     onPrint: () => window.print(),
//   });

{
  /* <PageHeader actions={actions} /> */
}
