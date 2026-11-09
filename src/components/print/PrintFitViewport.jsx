"use client";

import { useEffect } from "react";

const PAGE_WIDTH = 920; // print pages are A4-wide (~900px + margins)

/**
 * On phones (and inside the ERP mobile app) show the whole print page width:
 * the page is laid out at A4 width and shrunk to fit the screen with CSS zoom.
 * Pinch with two fingers to zoom in. Wide screens are left alone; printing and
 * "Save as PDF" are not affected (the zoom is removed for print).
 */
export default function PrintFitViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const fit = () => {
      const w = window.innerWidth;
      const zoomed = w && w < PAGE_WIDTH;
      root.style.zoom = zoomed ? String(w / PAGE_WIDTH) : "";
      // The page background is min-h-screen, which shrinks with the zoom.
      root.style.backgroundColor = zoomed ? "#f3f4f6" : "";
    };
    fit();
    const clear = () => {
      root.style.zoom = "";
      root.style.backgroundColor = "";
    };
    window.addEventListener("orientationchange", fit);
    window.addEventListener("beforeprint", clear);
    window.addEventListener("afterprint", fit);
    return () => {
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("beforeprint", clear);
      window.removeEventListener("afterprint", fit);
      clear();
    };
  }, []);
  return null;
}
