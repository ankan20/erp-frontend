"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { routeMetaConfig } from "@/config/route-meta.config";

export default function PageHeader({ actions = [] }) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(
    () => getBreadcrumbs(pathname, routeMetaConfig),
    [pathname]
  );

  return (
    <div className="shrink-0 w-full flex flex-col sm:flex-row sm:items-center justify-between px-2 pr-3 py-1 border-b border-[#c4d1df] bg-gradient-to-b from-[#f4f4f4] to-[#e3e3e3] gap-1 ">

      {/* LEFT → BREADCRUMB */}
      <div className="text-[13px] font-semibold leading-none whitespace-nowrap">
        <span>Modules : </span>

        {breadcrumbs.map((crumb, index) => (
          <span key={crumb}>
            {index !== 0 && " > "}
            <span className={index === breadcrumbs.length - 1 ? "text-red-600" : ""}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* RIGHT → RIBBON */}
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
            const isGroupEnd = (index + 1) % 2 === 0;
            const isLast = index === actions.length - 1;

            return (
              <div key={index} className="flex items-center gap-1 px-1 sm:px-2">

                {/* ICON */}
                {action}

                {/* GROUP SEPARATOR */}
                {isGroupEnd && !isLast && (
                  <div className=" h-[25px] w-[1px] bg-black opacity-100" />
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}


// example use
// const actions = getPageActions({
//     onHome: () => clearAuthCookies(),
//     onPrint: () => window.print(),
//   });

{/* <PageHeader actions={actions} /> */ }