"use client";

// Mounted in the ROOT layout so an active call survives every page change —
// including pages outside (protected) such as "/" (project select) and
// "/no-access". The chat button/panel stay in the protected layout.
// Print tabs (/print/*) get no calls, polling or ringing.
import { usePathname } from "next/navigation";
import { CommProvider } from "@/context/CommContext";
import CallPopup from "@/components/communication/CallPopup";

export default function CommRoot({ children }) {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/print")) return children;

  return (
    <CommProvider>
      {children}
      <div className="print:hidden">
        <CallPopup />
      </div>
    </CommProvider>
  );
}
