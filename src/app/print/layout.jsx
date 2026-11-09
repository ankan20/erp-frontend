import { PRINT_FONT } from "@/config/fonts.config";
import PrintFitViewport from "@/components/print/PrintFitViewport";

const exo2 = PRINT_FONT;

export const metadata = {
  title: "Document View",
};

// Phones: PrintFitViewport shrinks the A4-wide page to fit the screen; pinch to zoom in.
export const viewport = { maximumScale: 5, userScalable: true };

export default function PrintLayout({ children }) {
  return (
    <div className={`${exo2.variable} bg-gray-100 min-h-screen`} style={{ fontFamily: "var(--font-geist-print), sans-serif" }}>
      <PrintFitViewport />
      {children}
    </div>
  );
}
