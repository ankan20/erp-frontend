"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * AmountInput — use this for ANY rupee / rate / amount field across the project.
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   disabled / view mode  → shows value in Indian comma format, always 2 decimal
 *                           e.g.  2500000  →  "25,00,000.00"
 *   edit mode             → plain number input, restricts to max 2 decimal places,
 *                           no browser spinner arrows
 *                           form state always holds the raw number (no commas)
 *
 * ─── FIELD TYPES TO USE THIS FOR ─────────────────────────────────────────────
 *   ✅  Rate (₹ per unit)
 *   ✅  Basic Amount, GST Amount, Total Amount  — editable versions only
 *       (computed / always-readonly cells → use formatAmount() directly in <td>)
 *   ❌  Qty / unit-count   → use QtyInput (3 decimal)
 *   ❌  GST %              → use GstInput (2 decimal + % suffix)
 *   ❌  Crore-scale fields → use plain <Input> (no decimal restriction)
 *
 * ─── CURRENT USAGE IN THIS PROJECT ──────────────────────────────────────────
 *
 *   OGSaleOrderForm.jsx          — Rate column (register + watch pattern)
 *   SaleCertifiedBillForm.jsx    — Rate column (register + watch pattern, editable)
 *
 * ─── HOW TO USE IN A NEW PAGE ────────────────────────────────────────────────
 *   For any new form with a Rate or editable Amount field, follow one of these:
 *
 *   PATTERN 1 — register() + watch()  (plain forms, not field arrays):
 *
 *     <AmountInput
 *       {...register("rate")}
 *       value={watch("rate")}            ← required: register() doesn't pass value
 *       disabled={fieldDisabled}
 *       className={getInputClass(errors.rate, fieldDisabled)}
 *     />
 *
 *   PATTERN 2 — Controller  (field arrays / need side-effect on change):
 *
 *     <Controller control={control} name={`rows.${i}.rate`}
 *       render={({ field }) => (
 *         <AmountInput
 *           {...field}
 *           onChange={(e) => { field.onChange(e.target.value); recalc(); }}
 *           className={getInputClass(errors?.rows?.[i]?.rate, false)}
 *         />
 *       )}
 *     />
 *
 *   PATTERN 3 — always-readonly cell  (never add this component):
 *
 *     import { formatAmount } from "@/helper/numberFormatter";
 *     <td className="... bg-[#edf8ed] text-right">{formatAmount(item.amount)}</td>
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 *   ❌  Never pass formatAmount() output back into form state or an API payload.
 *       Always keep raw numbers in state; format only at the display layer.
 *   ⚠️  For register() pattern, value={watch("field")} is mandatory — omitting
 *       it breaks the formatted-display on disable/view mode.
 */
const AmountInput = React.forwardRef(function AmountInput(
  { value, onChange, onBlur, name, disabled, className = "", placeholder, ...rest },
  ref,
) {
  if (disabled) {
    return (
      <input
        value={formatAmount(value) || ""}
        disabled
        readOnly
        className={className}
      />
    );
  }

  return (
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
    />
  );
});

export default AmountInput;
