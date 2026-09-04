/**
 * Central font configuration — change fonts here, nothing else needs to be touched.
 *
 * APP_FONT        → website/app body font      (font-sans)
 * APP_FONT_MONO   → monospace: codes, numbers  (font-mono)
 * HEADING_FONT    → headings: dialogs, cards   (font-heading)
 *PRINT_FONT      → HTML print / browser PDF
 * DOCX_FONT       → font name embedded in .docx exports
 *
 * DOCX_FONT must be installed on the end-user's machine (Calibri, Arial, etc.)
 */

import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";

export const APP_FONT = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Changed from Roboto_Mono → Geist_Mono: matches Pujo project pairing, designed alongside Geist
export const APP_FONT_MONO = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const HEADING_FONT = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const PRINT_FONT = Geist({
  subsets: ["latin"],
  variable: "--font-print",
  display: "swap",
});

export const DOCX_FONT = "Calibri";
