"use client"
import AppNavbar from "@/components/layout/AppNavbar";
import AppSidebar from "@/components/layout/AppSidebar";
import { usePathname } from "next/navigation";

export default function ProtectedLayout({ children }) {
  const pathname = usePathname();

  const isHome = pathname === "/";
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      
      <div className="shrink-0">
        <AppNavbar />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {!isHome && <AppSidebar />}

        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>

      </div>
    </div>
  );
}