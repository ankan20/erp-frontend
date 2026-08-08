"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * AmountInput — use this for ANY rupee/money field across the project.
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   disabled / view mode  → shows value in Indian comma format, always 2 decimal
 *                           e.g.  2500000  →  "25,00,000.00"
 *   edit mode             → plain number input, restricts to max 2 decimal places
 *                           form state always holds the raw number (no commas)
 *
 * ─── PATTERN 1: with register() — forms using useForm / useFormWithToast ────
 *
 *   import AmountInput from "@/components/common/AmountInput";
 *   import { getInputClass } from "@/lib/formStyles";
 *
 *   const { register, watch, formState: { errors } } = useForm(...);
 *   const fieldDisabled = !isEditing || isSubmitting;
 *
 *   <AmountInput
 *     {...register("rate")}
 *     value={watch("rate")}                              ← always pass watch() value
 *     disabled={fieldDisabled}
 *     className={getInputClass(errors.rate, fieldDisabled)}
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
 *     name={`items.${index}.gstPercent`}
 *     render={({ field }) => (
 *       <AmountInput
 *         {...field}
 *         onChange={(e) => {
 *           field.onChange(e.target.value);  ← update form state
 *           recalc(...);                     ← any side effect after valid input
 *         }}
 *         className={getInputClass(errors?.items?.[index]?.gstPercent, false)}
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
 *   For computed/fetched cells that are never editable, skip the component
 *   entirely — render plain text in the <td>:
 *
 *   import { formatAmount } from "@/helper/numberFormatter";
 *
 *   <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
 *     {formatAmount(item.amount)}
 *   </td>
 *
 *   Total rows follow the same pattern:
 *   <td ...>{formatAmount(totalAmount)}</td>
 *
 * ─── ALSO USE FOR: Rate fields ───────────────────────────────────────────────
 *   Rate (price per unit) is a money field — use AmountInput, not QtyInput:
 *
 *   <AmountInput
 *     {...field}
 *     onChange={(e) => { field.onChange(e.target.value); recalc(...); }}
 *     className={getInputClass(errors?.items?.[index]?.rate, false)}
 *   />
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   ❌  Qty / unit-count fields → use QtyInput (3 decimal)
 *   ❌  Fields stored in Crores (Cr) where the user needs full decimal freedom
 *       → use a plain <Input> with your own onInput handler
 *   ❌  Never pass formatAmount() output back into form state or an API payload
 *       → always keep raw numbers in state; format only at the display layer
 */
const AmountInput = React.forwardRef(function AmountInput(
  { value, onChange, onBlur, name, disabled, className = "", placeholder, ...rest },
  ref,
) {
  if (disabled) {
    return (
      <Input
        value={formatAmount(value) || ""}
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
