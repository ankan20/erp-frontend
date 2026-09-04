import { PRINT_FONT } from "@/config/fonts.config";

const exo2 = PRINT_FONT;

export const metadata = {
  title: "Document View",
};

export default function PrintLayout({ children }) {
  return (
    <div className={`${exo2.variable} bg-gray-100 min-h-screen`} style={{ fontFamily: "var(--font-geist-print), sans-serif" }}>
      {children}
    </div>
  );
}
