"use client";

import React from "react";
import { Input } from "@/components/ui/input";

function formatGst(val) {
  if (val === "" || val === null || val === undefined) return "";
  const n = Number(val);
  if (isNaN(n)) return "";
  return `${n.toFixed(2)}%`;
}

/**
 * GstInput — use this for ANY GST percentage field across the project.
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   disabled / view mode  → shows value with % suffix, always 2 decimal
 *                           e.g.  18  →  "18.00%"
 *   edit mode             → plain number input with a % overlay on the right,
 *                           restricts to max 2 decimal places, no spinner arrows
 *                           form state always holds the raw number (no % symbol)
 *
 * ─── FIELD TYPES TO USE THIS FOR ─────────────────────────────────────────────
 *   ✅  GST % (any form with a gstPercent column)
 *   ❌  Rate / Amount → use AmountInput (2 decimal, Indian comma format)
 *   ❌  Qty           → use QtyInput   (3 decimal)
 *
 * ─── CURRENT USAGE IN THIS PROJECT ──────────────────────────────────────────
 *
 *   OGSaleOrderForm.jsx         — GST % column (register + watch pattern)
 *   SaleClaimBillForm.jsx       — GST % column (register + watch pattern)
 *   SaleCertifiedBillForm.jsx   — GST % column (register + watch pattern)
 *
 * ─── HOW TO USE IN A NEW PAGE ────────────────────────────────────────────────
 *   For any new form with an editable GST % field, follow one of these:
 *
 *   PATTERN 1 — register() + watch()  (field arrays, most common):
 *
 *     <GstInput
 *       {...register(`rows.${i}.gstPercent`)}
 *       value={watchedRows[i]?.gstPercent ?? ""}   ← use watchedRows[i], not watch() per field
 *       disabled={disabled}
 *       className={getInputClass(false, disabled)}
 *     />
 *
 *   PATTERN 2 — Controller  (if you need a side-effect on change):
 *
 *     <Controller control={control} name={`rows.${i}.gstPercent`}
 *       render={({ field }) => (
 *         <GstInput
 *           {...field}
 *           onChange={(e) => { field.onChange(e.target.value); recalc(); }}
 *           className={getInputClass(errors?.rows?.[i]?.gstPercent, false)}
 *         />
 *       )}
 *     />
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 *   ❌  Never pass the "18.00%" string back into form state or an API payload.
 *       Always keep raw numbers in state; the % is a display-only overlay.
 *   ⚠️  For register() pattern, value={watchedRows[i]?.gstPercent} is mandatory —
 *       omitting it breaks the % suffix display in disabled/view mode.
 */
const GstInput = React.forwardRef(function GstInput(
  { value, onChange, onBlur, name, disabled, className = "", placeholder, ...rest },
  ref,
) {
  if (disabled) {
    return (
      <Input
        value={formatGst(value)}
        disabled
        className={className}
      />
    );
  }

  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        name={name}
        value={value ?? ""}
        onChange={(e) => {
          if (/^\d*(\.\d{0,2})?$/.test(e.target.value)) onChange(e);
        }}
        onBlur={onBlur}
        inputMode="decimal"
        placeholder={placeholder}
        className={className}
        {...rest}
        style={{ paddingRight: "22px" }}
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 pointer-events-none select-none">%</span>
    </div>
  );
});

export default GstInput;
