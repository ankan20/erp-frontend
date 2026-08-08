"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatQtyDisplay } from "@/helper/numberFormatter";

/**
 * Drop-in replacement for <Input> on quantity fields (3 decimal places).
 *
 * View / disabled mode  → displays value with always 3 decimal places
 *                          e.g.  1000  →  "1000.000"
 * Edit mode             → restricts typing to max 3 decimal places;
 *                          stores raw number in form state
 *
 * Usage with react-hook-form:
 *   <QtyInput
 *     {...register("fieldName")}
 *     value={watch("fieldName")}          ← required for formatted display
 *     disabled={fieldDisabled}
 *     className={`flex-1 ${getInputClass(errors.fieldName, fieldDisabled)}`}
 *   />
 *
 * The caller keeps full control of className / styling — nothing is changed here.
 * Do NOT pass the formatted string back into the form state or payload.
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
