/**
 * Central font configuration — change fonts here, nothing else needs to be touched.
 *
 * APP_FONT        → website/app font (used in src/app/layout.js)
 * APP_FONT_MONO   → monospace variant for code/numbers in the app
 * PRINT_FONT      → HTML print / browser PDF font (used in src/app/print/layout.jsx)
 * DOCX_FONT       → font name embedded in all .docx exports
 *
 * To swap any font:
 *   1. Change the import name (e.g. Geist → Inter) and update the call below.
 *   2. For Google Fonts, pick from: https://fonts.google.com
 *   3. DOCX_FONT must be a font installed on the end-user's machine (Calibri, Arial, etc.)
 *      OR a font you embed separately. Standard safe choices: Calibri, Arial, Times New Roman.
 */

import { Exo_2, Roboto_Mono } from "next/font/google";

export const APP_FONT = Exo_2({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Changed from Geist_Mono → Roboto_Mono: pairs better with Exo_2 (neutral, clean, built for data/tables)
export const APP_FONT_MONO = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const PRINT_FONT = Exo_2({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-print",
  display: "swap",
});

export const DOCX_FONT = "Calibri";
