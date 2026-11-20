"use client";

// Animated Edox brand loader — a clean vector redraw of the logo (teal hexagon,
// italic "E", "dox" wordmark, RECORD | MANAGE | RECONCILE).
//
//   <EdoxMark size={40} />        mark only, loops — use in place of a spinner
//   <EdoxSplash message="…" />    full-screen intro: hexagon draws, the E builds
//                                 bar by bar, "dox" rises, tagline lights up
//
// Animations live in globals.css (".edox-*"). With "reduce motion" switched on
// in the OS everything shows still.

import { useId } from "react";

const HEX =
  "M39,6 H81 Q88,6 91.64,11.98 L112.36,46.02 Q116,52 112.36,57.98 L91.64,92.02 Q88,98 81,98 H39 " +
  "Q32,98 28.36,92.02 L7.64,57.98 Q4,52 7.64,46.02 L28.36,11.98 Q32,6 39,6 Z";

export function EdoxMark({ size = 40, mode = "loop", className = "", title = "Loading" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 120 104"
      width={size}
      height={(size * 104) / 120}
      role="img"
      aria-label={title}
      className={`edox-mark edox-${mode} ${className}`}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1fd3dc" />
          <stop offset="0.5" stopColor="#0b9ba5" />
          <stop offset="1" stopColor="#055b64" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <path d={HEX} />
        </clipPath>
      </defs>

      {/* hexagon: outline draws, then the gradient fills in */}
      <path d={HEX} className="edox-hex-fill" fill={`url(#g${id})`} />
      <path d={HEX} className="edox-hex-line" pathLength="1" fill="none" stroke="#0a8c96" strokeWidth="3" strokeLinejoin="round" />

      {/* italic E — spine, then the three bars (record · manage · reconcile) */}
      <g transform="translate(13 0) skewX(-14)" fill="#fff">
        <rect className="edox-e edox-e-spine" x="34" y="24" width="15" height="56" rx="6" />
        <rect className="edox-e edox-e-1" x="34" y="24" width="54" height="14" rx="6" />
        <rect className="edox-e edox-e-2" x="44" y="45" width="36" height="13" rx="5" />
        <rect className="edox-e edox-e-3" x="34" y="66" width="52" height="14" rx="6" />
      </g>

      {/* light sweep across the mark */}
      <g clipPath={`url(#c${id})`}>
        <rect className="edox-shine" x="-60" y="-10" width="40" height="124" fill={`url(#s${id})`} transform="skewX(-20)" />
      </g>
    </svg>
  );
}

export function EdoxSplash({ message = "Loading your workspace…", leaving = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`edox-splash fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#f4f7f8] ${leaving ? "edox-leave" : ""}`}
    >
      <div className="flex items-end gap-1.5 select-none">
        <EdoxMark size={112} mode="intro" title="Edox" />
        <span className="flex text-[86px] leading-[0.82] font-black tracking-tight text-[#111] pb-1" aria-hidden>
          <span className="edox-letter" style={{ animationDelay: "1.05s" }}>d</span>
          <span className="edox-letter" style={{ animationDelay: "1.15s" }}>o</span>
          <span className="edox-letter" style={{ animationDelay: "1.25s" }}>x</span>
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3 text-[13px] font-bold tracking-[0.32em] text-[#0a8c96]" aria-hidden>
        <span className="edox-word" style={{ "--d": "1.35s", "--h": "2.1s" }}>RECORD</span>
        <span className="edox-word edox-sep" style={{ "--d": "1.45s" }}>|</span>
        <span className="edox-word" style={{ "--d": "1.55s", "--h": "2.9s" }}>MANAGE</span>
        <span className="edox-word edox-sep" style={{ "--d": "1.65s" }}>|</span>
        <span className="edox-word" style={{ "--d": "1.75s", "--h": "3.7s" }}>RECONCILE</span>
      </div>

      <div className="mt-10 h-[3px] w-48 overflow-hidden rounded-full bg-[#d6e6e8]">
        <div className="edox-bar h-full w-1/3 rounded-full bg-gradient-to-r from-[#19c3cc] to-[#065f68]" />
      </div>
      <p className="edox-msg mt-3 text-xs text-gray-500">{message}</p>
    </div>
  );
}

export default EdoxSplash;
