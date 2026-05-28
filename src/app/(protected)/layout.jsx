
"use client";

import ProtectedLayoutAuth from "@/components/common/ProtectedLayoutAuth";
import AppNavbar from "@/components/layout/AppNavbar";
import AppSidebar from "@/components/layout/AppSidebar";
import { NavigationHistoryProvider } from "@/context/NavigationHistoryContext";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function ProtectedLayout({ children }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [collapsed, setCollapsed] = useState(true);

  return (
    <NavigationHistoryProvider>
    <ProtectedLayoutAuth>
      <div className="h-screen flex flex-col bg-[#f5f5f5]">

        {/* NAVBAR (AUTO HEIGHT) */}
        <div className="w-full bg-white z-50">
          <AppNavbar />
        </div>

        {/* BELOW NAVBAR */}
        <div className="flex flex-1 overflow-hidden">

          {/* SIDEBAR */}
          {!isHome && (
            <div
              className={`
                ${collapsed ? "w-[50px]" : "w-[240px]"}
                transition-all duration-300
                h-full
              `}
            >
              <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            </div>
          )}

          {/* MAIN CONTENT */}
          <div className="flex-1 overflow-auto ">
            {children}
          </div>

        </div>
      </div>
    </ProtectedLayoutAuth>
    </NavigationHistoryProvider>
  );
}