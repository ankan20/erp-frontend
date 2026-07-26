/**
 * Shared print styles — change here to affect ALL PDF/print modules.
 * Font is set at layout level via CSS variable --font-print (Exo 2).
 */

export const PRINT_FONT   = "var(--font-print), sans-serif";

// Text sizes (px as inline style numbers, or Tailwind classes)
// export const SIZE = {
//   pageTitle:    "text-[22px]",
//   sectionTitle: "text-[13px]",
//   labelText:    "text-[11px]",
//   valueText:    "text-[11px]",
//   tableHead:    "text-[11px]",
//   tableCell:    "text-[11px]",
//   subText:      "text-[9.5px]",
//   footerText:   "text-[10px]",
// };
export const SIZE = {
  pageTitle:    "text-[22px]",
  sectionTitle: "text-[15px]",
  labelText:    "text-[13px]",
  valueText:    "text-[13px]",
  tableHead:    "text-[13px]",
  tableCell:    "text-[13px]",
  subText:      "text-[11.5px]",
  footerText:   "text-[12px]",
};

// Weights
export const WEIGHT = {
  light:      "font-light",    // 300
  normal:     "font-normal",   // 400
  medium:     "font-medium",   // 500
  semibold:   "font-semibold", // 600
  bold:       "font-bold",     // 700
};

// Shared item sub-line style (note/customNote/itemCode below item name)
export const ITEM_SUB = "text-[11px] text-gray-500";

// Shared item name style
export const ITEM_NAME = "text-[11px] font-medium text-gray-900";

// Colors (matched to Indent.docx reference)
export const COLOR = {
  tableHeadBg:    "bg-[#d9d9d9]",   // #D9D9D9 — doc reference gray header
  tableRowEven:   "bg-[#f2f2f2]",
  tableRowOdd:    "bg-white",
  tableBorder:    "border-[#b0b0b0]",
  signatureBg:    "bg-[#b6dde8]",   // #B6DDE8 — doc reference signature row
  subText:        "text-gray-500",
  labelColor:     "text-gray-700",
  valueColor:     "text-gray-900",
  sectionBg:      "bg-[#f0f4eb]",
};

/**
 * Renders a formatted currency number with the decimal part visually de-emphasised.
 * Integer part: normal weight/size. Decimal part: 1px smaller, lighter color.
 * Usage: <FmtNum value={item.lineTotal} />
 */
export function FmtNum({ value, decimals = 2 }) {
  const formatted = Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const dot = formatted.lastIndexOf(".");
  if (dot === -1) return formatted;
  const integer = formatted.slice(0, dot);
  const frac    = formatted.slice(dot); // includes the "."
  return (
    <>
      {integer}
      <span style={{ fontSize: "0.90em" }}>{frac}</span>
    </>
  );
}

export const fmt = {
  date: (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  },
  dateTime: (d) => {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  },
  number: (n, decimals = 2) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
};
