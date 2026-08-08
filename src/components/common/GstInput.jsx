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
 *   edit mode             → plain number input, restricts to max 2 decimal places,
 *                           no browser spinner arrows
 *                           form state always holds the raw number (no % symbol)
 *
 * ─── PATTERN 1: with register() ──────────────────────────────────────────────
 *
 *   import GstInput from "@/components/common/GstInput";
 *
 *   <GstInput
 *     {...register("gstPercent")}
 *     value={watch("gstPercent")}          ← always pass watch() value
 *     disabled={fieldDisabled}
 *     className={getInputClass(errors.gstPercent, fieldDisabled)}
 *   />
 *
 * ─── PATTERN 2: with Controller ──────────────────────────────────────────────
 *
 *   <Controller control={control} name={`rows.${i}.gstPercent`}
 *     render={({ field }) => (
 *       <GstInput
 *         {...field}
 *         onChange={(e) => { field.onChange(e.target.value); recalc(...); }}
 *         className={getInputClass(errors?.rows?.[i]?.gstPercent, false)}
 *       />
 *     )}
 *   />
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   ❌  Qty / unit-count fields → use QtyInput (3 decimal)
 *   ❌  Rate / Amount fields → use AmountInput (2 decimal, Indian format)
 *   ❌  Never pass formatGst() output back into form state or API payload
 *       → always keep raw numbers in state; format only at the display layer
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
