import AppNavbar from "@/components/layout/AppNavbar";
import AppSidebar from "@/components/layout/AppSidebar";

export default function ProtectedLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      
      <div className="shrink-0">
        <AppNavbar />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        <AppSidebar />

        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>

      </div>
    </div>
  );
}