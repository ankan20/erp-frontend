"use client";

/**
 * SaleBillRightPanel
 *
 * Composition layer that wires up the three reusable account sub-components:
 *   AccountBasicTable  → BASIC items section
 *   AccountGstTable    → GST section with IGST ↔ CGST+SGST mutual exclusion
 *   AccountSummary     → Summary + Amount in words section
 *
 * Each sub-component is independently importable for other account modules.
 *
 * Props
 *   control       — RHF control
 *   watch         — RHF watch
 *   setValue      — RHF setValue
 *   register      — RHF register
 *   disabled      — bool
 *   itemsLoading  — bool
 *   itemFields    — array from useFieldArray({ name: "items" })
 *   actualGstTotal — number|null. Real GST for the loaded document (IGST-equivalent,
 *                    i.e. the full rate, with CGST/SGST each taking half). When given,
 *                    it replaces the legacy `basicTotal × stored percent` maths here
 *                    AND in AccountGstTable, so the table and the summary always agree.
 *                    Leave null to keep the legacy behaviour unchanged.
 */

import { useEffect }                  from "react";
import AccountBasicTable              from "./AccountBasicTable";
import AccountGstTable, {
  DEFAULT_GST_LINES,
  mapApiGstLines,
  igstEquivalent,
}                                     from "./AccountGstTable";
import AccountSummary                 from "./AccountSummary";

// Re-export so the bill forms can import these from this file
export { DEFAULT_GST_LINES, mapApiGstLines, igstEquivalent };

export default function SaleBillRightPanel({
  control,
  watch,
  setValue,
  register,
  disabled       = false,
  itemsLoading   = false,
  itemFields     = [],
  actualGstTotal = null,
}) {
  // ── Totals (shared between GST table and Summary) ──────────────────────────
  const items    = watch("items")    || [];
  const gstLines = watch("gstLines") || DEFAULT_GST_LINES;
  const discount = Number(watch("discount") || 0);
  const roundOff = Number(watch("roundOff") || 0);

  const basicTotal = items.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);

  const isIGST     = !!gstLines[0]?.isSelected;
  const isCGSTSGST = !!gstLines[1]?.isSelected;

  // Mirrors AccountGstTable's maths exactly so the GST table and the summary
  // below it can never disagree. hasActual === false → legacy path, unchanged.
  const hasActual  = actualGstTotal !== null && actualGstTotal !== undefined;
  const igstAmt    = isIGST     ? (hasActual ? actualGstTotal     : basicTotal * (gstLines[0]?.percent || 18) / 100) : 0;
  const cgstAmt    = isCGSTSGST ? (hasActual ? actualGstTotal / 2 : basicTotal * (gstLines[1]?.percent || 9)  / 100) : 0;
  const sgstAmt    = isCGSTSGST ? (hasActual ? actualGstTotal / 2 : basicTotal * (gstLines[2]?.percent || 9)  / 100) : 0;
  const gstTotal   = igstAmt + cgstAmt + sgstAmt;
  const totalInvoice = basicTotal + gstTotal - discount + roundOff;

  // ── Auto-calculate round-off (always, not user-editable) ──────────────────
  // Math.round: decimal >= 0.50 → round up (positive), < 0.50 → round down (negative)
  useEffect(() => {
    const subtotal = basicTotal + gstTotal - discount;
    const auto = parseFloat((Math.round(subtotal) - subtotal).toFixed(2));
    setValue("roundOff", auto, { shouldDirty: false });
  }, [basicTotal, gstTotal, discount]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <AccountBasicTable
        itemFields={itemFields}
        watch={watch}
        register={register}
        control={control}
        disabled={disabled}
        itemsLoading={itemsLoading}
      />

      <AccountGstTable
        watch={watch}
        setValue={setValue}
        control={control}
        disabled={disabled}
        basicTotal={basicTotal}
        actualGstTotal={actualGstTotal}
      />

      <AccountSummary
        basicTotal={basicTotal}
        gstTotal={gstTotal}
        totalInvoice={totalInvoice}
        register={register}
        watch={watch}
        disabled={disabled}
      />
    </div>
  );
}
