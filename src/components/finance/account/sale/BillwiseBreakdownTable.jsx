"use client";

/**
 * BillwiseBreakdownTable
 *
 * Per-certified-bill accounting entry selection table.
 * This is the SOURCE OF TRUTH for which accounting entries are included in the invoice.
 *
 * For each selected certified bill it generates four potential rows:
 *   SRCW  — basic amount (Construction of Civil Work)
 *   IGST  — full GST amount
 *   CGST  — half GST amount
 *   SGST  — half GST amount
 *
 * IGST is mutually exclusive with CGST+SGST across ALL bills.
 *
 * Props
 *   sources             []    — selected certified bills from CertifiedBillPickerModal
 *   gstPercent          number  — GST % to apply (e.g. 18)
 *   selections          {}    — controlled: { [key]: { checked, description } }
 *   onSelectionsChange  (newSel) => void
 *   disabled            bool
 */

// TODO: Connect SRCW CC code/name to CC master lookup (currently hardcoded)
const SRCW_CC_CODE = "SRCW";
const SRCW_CC_NAME = "Construction of Civil Work";

const GST_TYPES = [
  { key: "IGST", ccCode: "IGST", ccName: "Output-IGST",  fraction: 1   },
  { key: "CGST", ccCode: "CGST", ccName: "Output-CGST",  fraction: 0.5 },
  { key: "SGST", ccCode: "SGST", ccName: "Output-SGST",  fraction: 0.5 },
];

import { ACC } from "@/components/finance/account/common/accountTheme";
import { formatAmount } from "@/helper/numberFormatter";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";
import { useColumnResize } from "@/hooks/useColumnResize";

export default function BillwiseBreakdownTable({
  sources             = [],
  gstPercent          = 18,
  selections          = {},
  onSelectionsChange,
  disabled            = false,
}) {
  const { tableRef } = useColumnResize();
  if (sources.length === 0) return null;

  // Determine global GST mode from current selections
  const anyIgstChecked = sources.some((s) => selections[`${s.certifiedBillId}_IGST`]?.checked);
  const anyCgstChecked = sources.some((s) => selections[`${s.certifiedBillId}_CGST`]?.checked);
  const anySgstChecked = sources.some((s) => selections[`${s.certifiedBillId}_SGST`]?.checked);

  const handleCheck = (key, checked) => {
    if (disabled) return;
    const [billIdStr, type] = key.split("_");

    let next = { ...selections };

    // Enforce IGST ↔ CGST/SGST mutual exclusion GLOBALLY across all bills
    // CGST and SGST always move together
    if (type === "IGST") {
      if (checked) {
        // Clear CGST/SGST for every bill
        sources.forEach((s) => {
          next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: false };
          next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: false };
        });
      }
      next[key] = { ...(next[key] || {}), checked };
    } else if (type === "CGST" || type === "SGST") {
      if (checked) {
        // Clear IGST for every bill; pair CGST+SGST for every bill
        sources.forEach((s) => {
          next[`${s.certifiedBillId}_IGST`] = { ...(next[`${s.certifiedBillId}_IGST`] || {}), checked: false };
          next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: true };
          next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: true };
        });
      } else {
        // Unchecking one clears both for every bill
        sources.forEach((s) => {
          next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: false };
          next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: false };
        });
      }
    } else {
      next[key] = { ...(next[key] || {}), checked };
    }
    onSelectionsChange?.(next);
  };

  const handleDescription = (key, description) => {
    if (disabled) return;
    onSelectionsChange?.({ ...selections, [key]: { ...(selections[key] || {}), description } });
  };

  return (
    <div className="mb-4">
      {/* Header */}
      <div className={`px-3 py-1.5 ${ACC.gstHeader}`}>
        <span className={ACC.sectionTitle}>Bill-wise Accounting Entries:</span>
      </div>

      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse text-[11px] min-w-[760px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">
                ERP No
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">
                Sale Order
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[80px]">
                Bill No
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">
                CC Name &amp; Description
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[110px]">
                Amount
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-center font-semibold w-[55px]" data-col-resize-last="true">
                Select
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, si) => {
              const billBasic = Number(source.basicAmount) || 0;
              const totalGst  = (billBasic * gstPercent) / 100;
              const halfGst   = totalGst / 2;

              const rows = [
                {
                  key:    `${source.certifiedBillId}_SRCW`,
                  ccCode: SRCW_CC_CODE,
                  ccName: SRCW_CC_NAME,
                  amount: billBasic,
                  gstRelated: false,
                  disabled:   false,
                },
                {
                  key:    `${source.certifiedBillId}_IGST`,
                  ccCode: "IGST",
                  ccName: "Output-IGST",
                  amount: totalGst,
                  gstRelated: true,
                  disabled:   anyCgstChecked || anySgstChecked,
                },
                {
                  key:    `${source.certifiedBillId}_CGST`,
                  ccCode: "CGST",
                  ccName: "Output-CGST",
                  amount: halfGst,
                  gstRelated: true,
                  disabled:   anyIgstChecked,
                },
                {
                  key:    `${source.certifiedBillId}_SGST`,
                  ccCode: "SGST",
                  ccName: "Output-SGST",
                  amount: halfGst,
                  gstRelated: true,
                  disabled:   anyIgstChecked,
                },
              ];

              return rows.map((row, ri) => {
                const sel         = selections[row.key] || {};
                const isChecked   = sel.checked ?? false;
                const description = sel.description ?? "";
                // row.disabled dims the row (mutex exclusion) but checkbox stays clickable
                // so users can click CGST/SGST to automatically switch from IGST and vice-versa
                const isRowMuted       = disabled || row.disabled;
                const isCheckboxDisabled = disabled;
                // Description is only editable for non-GST rows (SRCW only) when checked
                const isDescEditable = !row.gstRelated && isChecked && !disabled;

                return (
                  <tr
                    key={row.key}
                    className={`${isChecked ? "bg-green-50" : ri % 2 === 0 ? "bg-white" : "bg-gray-50"} ${isRowMuted ? "opacity-50" : ""}`}
                  >
                    {/* ERP No — only on first row of each bill */}
                    {ri === 0 ? (
                      <td
                        className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e] text-[10px]"
                        rowSpan={rows.length}
                      >
                        {source.saleOrderErpNo || "—"}
                      </td>
                    ) : null}

                    {/* Sale Order (Customer Order No) — only on first row */}
                    {ri === 0 ? (
                      <td
                        className="border border-[#d0d0d0] px-2 py-1 text-gray-700 text-[10px]"
                        rowSpan={rows.length}
                      >
                        {source.saleOrderNo || "—"}
                      </td>
                    ) : null}

                    {/* Bill No — only on first row */}
                    {ri === 0 ? (
                      <td
                        className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e]"
                        rowSpan={rows.length}
                      >
                        {source.certifiedBillNo || "—"}
                      </td>
                    ) : null}

                    {/* CC Name + Description combined */}
                    <td className="border border-[#d0d0d0] px-1 py-0.5 min-w-[160px]">
                      <div className="text-[11px] font-semibold text-gray-700 px-1 pb-0.5">
                        {row.ccName}
                      </div>
                      {!row.gstRelated && (
                        <ExpandableTextCell
                          value={description}
                          onChange={(val) => isDescEditable && handleDescription(row.key, val)}
                          disabled={!isDescEditable}
                          placeholder="Add description..."
                          label="Description"
                          textSize="text-[10px]"
                        />
                      )}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1 text-right font-semibold">
                      {formatAmount(row.amount)}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheck(row.key, e.target.checked)}
                        disabled={isCheckboxDisabled}
                        className="h-3.5 w-3.5 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* GST mode note */}
      {sources.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          IGST and CGST/SGST are mutually exclusive across all bills. CGST and SGST are always selected together.
          {gstPercent > 0 ? ` GST rate applied: ${gstPercent}%.` : ""}
        </p>
      )}
    </div>
  );
}
