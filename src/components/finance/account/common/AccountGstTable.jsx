"use client";

/**
 * AccountGstTable
 * Reusable GST section table for Finance → Account bill forms.
 *
 * IGST is mutually exclusive with CGST + SGST (same logic as order/BRR billing pages).
 * Checking IGST clears CGST+SGST; checking either CGST or SGST clears IGST and
 * always keeps CGST and SGST in sync (they move together).
 *
 * Props
 *   watch        — RHF watch
 *   setValue     — RHF setValue
 *   control      — RHF control
 *   disabled     — bool
 *   basicTotal   — number  (computed from items; drives GST amount calculation)
 *   fieldName    — string  (RHF field array name, default "gstLines")
 */

import { Controller } from "react-hook-form";
import { ACC }        from "./accountTheme";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";

export const DEFAULT_GST_LINES = [
  { gstType: "IGST", ccCode: "IGST", ccName: "Output-IGST", description: "", percent: 18, gstAmount: 0, isSelected: true  },
  { gstType: "CGST", ccCode: "CGST", ccName: "Output-CGST", description: "", percent: 9,  gstAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Output-SGST", description: "", percent: 9,  gstAmount: 0, isSelected: false },
];

const fmt = (val) => {
  const n = Number(val);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AccountGstTable({
  watch,
  setValue,
  control,
  disabled   = false,
  basicTotal = 0,
  fieldName  = "gstLines",
}) {
  const gstLines = watch(fieldName) || DEFAULT_GST_LINES;

  // ── Derived checked state ─────────────────────────────────────────────────
  const isIGST     = !!gstLines[0]?.isSelected;
  const isCGSTSGST = !!gstLines[1]?.isSelected;

  // ── Mutual exclusion handlers ─────────────────────────────────────────────
  const handleIGST = (checked) => {
    setValue(`${fieldName}.0.isSelected`, checked, { shouldDirty: true });
    if (checked) {
      setValue(`${fieldName}.1.isSelected`, false, { shouldDirty: true });
      setValue(`${fieldName}.2.isSelected`, false, { shouldDirty: true });
    }
  };

  const handleCGSTSGST = (checked) => {
    setValue(`${fieldName}.1.isSelected`, checked, { shouldDirty: true });
    setValue(`${fieldName}.2.isSelected`, checked, { shouldDirty: true });
    if (checked) {
      setValue(`${fieldName}.0.isSelected`, false, { shouldDirty: true });
    }
  };

  // ── Computed amounts ──────────────────────────────────────────────────────
  const igstAmt = isIGST     ? basicTotal * (gstLines[0]?.percent || 18) / 100 : 0;
  const cgstAmt = isCGSTSGST ? basicTotal * (gstLines[1]?.percent || 9)  / 100 : 0;
  const sgstAmt = isCGSTSGST ? basicTotal * (gstLines[2]?.percent || 9)  / 100 : 0;
  const gstTotal = igstAmt + cgstAmt + sgstAmt;

  const rows = [
    { checked: isIGST,     onToggle: handleIGST,     line: gstLines[0] || DEFAULT_GST_LINES[0], amount: igstAmt, idx: 0 },
    { checked: isCGSTSGST, onToggle: handleCGSTSGST, line: gstLines[1] || DEFAULT_GST_LINES[1], amount: cgstAmt, idx: 1 },
    { checked: isCGSTSGST, onToggle: handleCGSTSGST, line: gstLines[2] || DEFAULT_GST_LINES[2], amount: sgstAmt, idx: 2 },
  ];

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* Header */}
      <div className={`${ACC.gstHeader} px-3 py-[5px]`}>
        <span className={ACC.sectionTitle}>GST</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-[12px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[72px]">Select</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[76px]">CC Code</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[132px]">CC Name</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[52px]">%</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[115px]">GST Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ checked, onToggle, line, amount, idx }) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdf8f6]"}>
                <td className="border border-gray-200 px-2 py-[3px] text-center">
                  <input
                    type="checkbox"
                    checked={!!checked}
                    onChange={(e) => !disabled && onToggle(e.target.checked)}
                    disabled={disabled}
                    className="w-[15px] h-[15px] accent-[#3b6ea5] cursor-pointer disabled:cursor-not-allowed"
                  />
                </td>
                <td className="border border-gray-200 px-2 py-[3px]">{line.ccCode}</td>
                <td className="border border-gray-200 px-2 py-[3px]">{line.ccName}</td>
                <td className="border border-gray-200 p-0 min-w-[100px]">
                  <Controller
                    name={`${fieldName}.${idx}.description`}
                    control={control}
                    render={({ field: f }) => (
                      <ExpandableTextCell
                        value={f.value || ""}
                        onChange={disabled ? undefined : f.onChange}
                        disabled={disabled}
                        placeholder="Description"
                        label="GST Description"
                      />
                    )}
                  />
                </td>
                <td className="border border-gray-200 px-2 py-[3px] text-center">{line.percent}%</td>
                <td className="border border-gray-200 px-2 py-[3px] text-right font-medium">{fmt(amount)}</td>
              </tr>
            ))}
            {/* Total row */}
            <tr className={`${ACC.tableHead} font-semibold`}>
              <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(gstTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
