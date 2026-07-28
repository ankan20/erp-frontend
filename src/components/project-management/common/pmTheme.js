/**
 * PM Module Theme
 *
 * Single source of truth for every visual token used across the
 * project-management common components (PMSection, PMFormRow, PMInput,
 * PMSelect, PMTextarea, PMDateInput, PMTimeInput).
 *
 * Change a value here → it updates everywhere in this module automatically.
 * All values must be complete Tailwind class strings (no dynamic concatenation)
 * so that Tailwind JIT can include them in the build.
 */

export const PM = {
  // ── Section header ("BBS Details:", "Pouring Details:", …) ──────────────
  sectionTitle:       "text-[15px] font-semibold text-[#1c3a5e]",

  // ── Form row label ("Received Date", "BBS Title", …) ────────────────────
  label:              "text-[13px] text-[#444444]",

  // ── Section container ────────────────────────────────────────────────────
  sectionBg:          "bg-[#e8e8e8]",
  sectionBorder:      "border border-[#b0c5d5]",

  // ── Input / select / textarea ────────────────────────────────────────────
  inputHeight:        "h-[30px]",
  inputText:          "text-[13px]",
  inputPlaceholder:   "placeholder:text-gray-400 placeholder:text-[13px]",

  // ── Input state colours ──────────────────────────────────────────────────
  disabledBg:         "bg-[#edf8ed]",
  focusBorder:        "focus:border-[#93b5cc]",

  // ── Quick-fill buttons (Today / Now) ─────────────────────────────────────
  quickFillBtn:       "h-[30px] px-2.5 text-[11px] font-medium rounded-sm border border-[#93b5cc] bg-[#dce9f3] text-[#1c3a5e] hover:bg-[#c6daea] transition-colors whitespace-nowrap shrink-0",
};
