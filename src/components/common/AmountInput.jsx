"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * Drop-in replacement for <Input> on amount fields (2 decimal places).
 *
 * View / disabled mode  → displays value formatted with Indian comma style
 *                          e.g.  100000  →  "1,00,000.00"
 * Edit mode             → restricts typing to max 2 decimal places;
 *                          stores raw number in form state (no commas)
 *
 * Usage with react-hook-form:
 *   <AmountInput
 *     {...register("fieldName")}
 *     value={watch("fieldName")}          ← required for formatted display
 *     disabled={fieldDisabled}
 *     className={`flex-1 ${getInputClass(errors.fieldName, fieldDisabled)}`}
 *   />
 *
 * The caller keeps full control of className / styling — nothing is changed here.
 * Do NOT pass the formatted string back into the form state or payload.
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
      onChange={onChange}
      onBlur={onBlur}
      inputMode="decimal"
      placeholder={placeholder}
      onInput={(e) => {
        if (!/^\d*(\.\d{0,2})?$/.test(e.target.value))
          e.target.value = e.target.value.slice(0, -1);
      }}
      className={className}
      {...rest}
    />
  );
});

export default AmountInput;
