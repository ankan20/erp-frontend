"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatQtyDisplay } from "@/helper/numberFormatter";

/**
 * QtyInput — use this for ANY quantity field across the project.
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   disabled / view mode  → shows value with always 3 decimal places
 *                           e.g.  25  →  "25.000"
 *   edit mode             → plain number input, restricts to max 3 decimal places
 *                           form state always holds the raw number
 *
 * ─── PATTERN 1: with register() — forms using useForm / useFormWithToast ────
 *
 *   import QtyInput from "@/components/common/QtyInput";
 *   import { getInputClass } from "@/lib/formStyles";
 *
 *   const { register, watch, formState: { errors } } = useForm(...);
 *   const fieldDisabled = !isEditing || isSubmitting;
 *
 *   <QtyInput
 *     {...register("qty")}
 *     value={watch("qty")}                               ← always pass watch() value
 *     disabled={fieldDisabled}
 *     className={getInputClass(errors.qty, fieldDisabled)}
 *   />
 *
 *   ⚠️  value={watch("fieldName")} is required — register() alone does not
 *       pass value as a prop, so the formatted display won't work without it.
 *
 * ─── PATTERN 2: with Controller — field arrays / custom wrappers ──────────
 *
 *   import { Controller } from "react-hook-form";
 *
 *   <Controller
 *     control={control}
 *     name={`items.${index}.qty`}
 *     render={({ field }) => (
 *       <QtyInput
 *         {...field}
 *         onChange={(e) => {
 *           field.onChange(e.target.value);  ← update form state
 *           recalc(...);                     ← any side effect after valid input
 *         }}
 *         className={getInputClass(errors?.items?.[index]?.qty, false)}
 *       />
 *     )}
 *   />
 *
 *   Controller's field already includes value, so no separate watch() needed.
 *   If you need a side effect on change (recalc, etc.) pass a custom onChange
 *   AFTER {...field} — it will override field.onChange.
 *
 * ─── PATTERN 3: always-readonly table cell ────────────────────────────────
 *
 *   For fetched/computed cells that are never editable, skip the component
 *   entirely — render plain text in the <td>:
 *
 *   import { formatQtyDisplay } from "@/helper/numberFormatter";
 *
 *   <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-center">
 *     {formatQtyDisplay(item.qty)}
 *   </td>
 *
 *   Total rows follow the same pattern:
 *   <td ...>{formatQtyDisplay(totalQty)}</td>
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   ❌  Rate / Amount / GST Amount / GST % → use AmountInput (2 decimal)
 *       Rate is a price (₹ per unit) — it follows amount rules, not qty rules.
 *   ❌  Never pass formatQtyDisplay() output back into form state or an API payload
 *       → always keep raw numbers in state; format only at the display layer
 */
const QtyInput = React.forwardRef(function QtyInput(
  { value, onChange, onBlur, name, disabled, className = "", placeholder, ...rest },
  ref,
) {
  if (disabled) {
    return (
      <Input
        value={formatQtyDisplay(value) || ""}
        disabled
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
        if (/^\d*(\.\d{0,3})?$/.test(e.target.value)) onChange(e);
      }}
      onBlur={onBlur}
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
});

export default QtyInput;
