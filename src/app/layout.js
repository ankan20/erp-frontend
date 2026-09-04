import { APP_FONT, APP_FONT_MONO } from "@/config/fonts.config";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = APP_FONT;
const geistMono = APP_FONT_MONO;

export const metadata = {
  title: "Prax Construction ERP",
  description: "ERP System",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
      {children}
      <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
