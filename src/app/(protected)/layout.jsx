
"use client";

import ProtectedLayoutAuth from "@/components/common/ProtectedLayoutAuth";
import AppNavbar from "@/components/layout/AppNavbar";
import AppSidebar from "@/components/layout/AppSidebar";
import { NavigationHistoryProvider } from "@/context/NavigationHistoryContext";
import CommFab from "@/components/communication/CommFab";
import ChatFloat from "@/components/communication/ChatFloat";
// CommProvider + CallPopup live in the root layout (CommRoot) so calls survive navigation
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import SplitWorkspace from "@/components/split-view/SplitWorkspace";
import PaneBridge from "@/components/split-view/PaneBridge";
import DataSyncBoundary from "@/components/split-view/DataSyncBoundary";
import { useIsInsidePane } from "@/components/split-view/splitStore";
import { RecordMetaProvider } from "@/context/RecordMetaContext";
import RecordMeta from "@/components/common/RecordMeta";

export default function ProtectedLayout({ children }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [collapsed, setCollapsed] = useState(true);
  // inside a split window only the page is shown (no navbar / sidebar)
  const inPane = useIsInsidePane();

  return (
    <RecordMetaProvider>
    <NavigationHistoryProvider>
    <ProtectedLayoutAuth>
      <>
        <div className="h-screen flex flex-col bg-[#f5f5f5]">

          {/* NAVBAR (AUTO HEIGHT) */}
          {!inPane && (
            <div className="w-full bg-white z-50">
              <AppNavbar />
            </div>
          )}

          {/* BELOW NAVBAR */}
          <div className="flex flex-1 overflow-hidden">

            {/* SIDEBAR */}
            {!isHome && !inPane && (
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

            {/* MAIN CONTENT (+ split view windows when opened; off inside a window) */}
            <SplitWorkspace disabled={inPane}>
              {/* live update when data changes in another window / tab */}
              <DataSyncBoundary>{children}</DataSyncBoundary>
            </SplitWorkspace>

          </div>
        </div>

        {/* ── Communication overlays (global, always on top) ── */}
        {!inPane && <CommFab />}
        {!inPane && <ChatFloat />}
        {inPane && (
          <Suspense fallback={null}>
            <PaneBridge />
          </Suspense>
        )}
      </>
      {/* audit badge — fixed bottom-right, shows on hover */}
      <RecordMeta />
    </ProtectedLayoutAuth>
    </NavigationHistoryProvider>
    </RecordMetaProvider>
  );
}