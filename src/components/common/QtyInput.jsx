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
 *   edit mode             → plain number input, restricts to max 3 decimal places,
 *                           no browser spinner arrows
 *                           form state always holds the raw number
 *
 * ─── FIELD TYPES TO USE THIS FOR ─────────────────────────────────────────────
 *   ✅  Order Qty, Claim Qty, Certified Qty, Received Qty, Indent Qty
 *       — any unit-count value
 *   ❌  Rate / Amount / GST Amount  → use AmountInput (2 decimal, Indian format)
 *   ❌  GST %                       → use GstInput (2 decimal + % suffix)
 *
 * ─── CURRENT USAGE IN THIS PROJECT ──────────────────────────────────────────
 *
 *   ServiceOrderItemSelectionModal.jsx   — Order Qty  (modal local state, direct onChange)
 *   OrderItemSelectionModal.jsx          — Order Qty  (modal local state, direct onChange)
 *   PWOrderItemSelectionModal.jsx        — Order Qty  (modal local state, direct onChange)
 *   OGSaleOrderForm.jsx                  — Order Qty  (register + watch pattern)
 *   SaleClaimBillForm.jsx                — Claim Qty  (Controller + cap at orderQty)
 *   SaleCertifiedBillForm.jsx            — Certified Qty (Controller + cap at orderQty)
 *
 * ─── HOW TO USE IN A NEW PAGE ────────────────────────────────────────────────
 *   For any new form with an editable qty field, follow one of these:
 *
 *   PATTERN 1 — register() + watch()  (plain forms, not field arrays):
 *
 *     <QtyInput
 *       {...register("qty")}
 *       value={watch("qty")}             ← required: register() doesn't pass value
 *       disabled={fieldDisabled}
 *       className={getInputClass(errors.qty, fieldDisabled)}
 *     />
 *
 *   PATTERN 2 — Controller  (field arrays / need cap logic or side-effect):
 *
 *     <Controller control={control} name={`items.${i}.claimQty`}
 *       render={({ field: f }) => (
 *         <QtyInput
 *           {...f}
 *           onChange={(e) => {
 *             const v = Number(e.target.value || 0);
 *             f.onChange(max > 0 && v > max ? String(max) : e.target.value);
 *           }}
 *           disabled={disabled}
 *           className={getInputClass(errors?.items?.[i]?.claimQty, disabled)}
 *         />
 *       )}
 *     />
 *
 *   PATTERN 3 — modal local state  (not RHF, no register/Controller needed):
 *
 *     <QtyInput
 *       value={item.orderQty}
 *       disabled={!item.selected}
 *       onChange={(e) => handleQtyChange(item.itemCode, e.target.value)}
 *       className={getInputClass(qtyError, !item.selected)}
 *     />
 *
 *   PATTERN 4 — always-readonly cell  (never add this component):
 *
 *     import { formatQtyDisplay } from "@/helper/numberFormatter";
 *     <td className="... text-right">{formatQtyDisplay(item.orderQty)}</td>
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 *   ❌  Never pass formatQtyDisplay() output back into form state or an API payload.
 *       Always keep raw numbers in state; format only at the display layer.
 *   ⚠️  For register() pattern, value={watch("field")} is mandatory — omitting
 *       it breaks the formatted-display on disable/view mode.
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
