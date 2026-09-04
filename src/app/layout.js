import { APP_FONT, APP_FONT_MONO, HEADING_FONT } from "@/config/fonts.config";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata = {
  title: "Prax Construction ERP",
  description: "ERP System",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${APP_FONT.variable} ${APP_FONT_MONO.variable} ${HEADING_FONT.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
      {children}
      <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
