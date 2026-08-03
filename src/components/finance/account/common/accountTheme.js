/**
 * Finance → Account module theme tokens.
 * Matches the palette used in the order/BRR billing summary pages so that
 * every account-side bill (Sale, Purchase, Receipt, etc.) looks consistent.
 */
export const ACC = {
  // ── Section header strips ──────────────────────────────────────────────────
  basicHeader:      "bg-[#DCE8D2]",      // green tint  — BASIC
  gstHeader:        "bg-[#F5E4D7]",      // peach tint  — GST
  tableHead:        "bg-[#D3D3D3]",      // neutral gray — <thead>

  // ── Summary rows ───────────────────────────────────────────────────────────
  summaryLabelBg:   "bg-[#DCE8D2]",      // label cell (Basic, GST, Total)
  summaryValueBg:   "bg-[#D5DBE6]",      // value cell (Basic, GST)
  totalValueBg:     "bg-[#F2B07E]",      // value cell for Grand Total

  // ── Amount in words ────────────────────────────────────────────────────────
  wordsLabelBg:     "bg-[#DCE8D2]",
  wordsValueBg:     "bg-[#F8EFC8]",

  // ── Input cells (discount / round-off) ────────────────────────────────────
  inputBorder:      "border-[#8f8f8f]",
  inputDisabled:    "border-[#7fa37f] bg-[#edf8ed] text-gray-500",
  inputError:       "border-red-500 bg-red-50 text-red-700",

  // ── Text ──────────────────────────────────────────────────────────────────
  sectionTitle:     "text-[15px] font-semibold",
  cellText:         "text-[12px]",
};
