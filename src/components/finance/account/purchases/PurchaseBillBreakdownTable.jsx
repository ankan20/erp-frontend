"use client";

/**
 * PurchaseBillBreakdownTable
 *
 * BRR items + GST selection — identical layout to BillwiseBreakdownTable
 * in the sale bill.
 *
 * Columns: Order No | BRR No | BRR Date | CC Name & Description | HSN/SAC | Amount | Select
 *
 * Order No, BRR No, BRR Date use rowSpan to span the entire item+GST group,
 * exactly as ERP No / Sale Order / Bill No do in BillwiseBreakdownTable.
 */

import { Controller }      from "react-hook-form";
import { Loader2 }         from "lucide-react";
import { ACC }             from "@/components/finance/account/common/accountTheme";
import ExpandableTextCell  from "@/components/project-management/common/ExpandableTextCell";
import { formatAmount }       from "@/helper/numberFormatter";
import { useColumnResize }    from "@/hooks/useColumnResize";
import { getfmtDisplaydate }  from "@/helper/getfmtDisplayDate";

const GST_META = [
  { gstType: "IGST", ccCode: "IGST", ccName: "Input-IGST"  },
  { gstType: "CGST", ccCode: "CGST", ccName: "Input-CGST"  },
  { gstType: "SGST", ccCode: "SGST", ccName: "Input-SGST"  },
];

export default function PurchaseBillBreakdownTable({
  orderNo      = "",
  brrNo        = "",
  brrDate      = "",
  items        = [],
  gstLines     = [],
  register,
  control,
  onGstToggle,
  disabled     = false,
  itemsLoading = false,
}) {
  const { tableRef } = useColumnResize();

  if (!itemsLoading && items.length === 0) return null;

  const isIGSTChecked = !!gstLines[0]?.isSelected;
  const isCGSTChecked = !!gstLines[1]?.isSelected;

  // Build flattened row list — same pattern as BillwiseBreakdownTable
  const itemRows = items.map((item, idx) => ({ kind: "item", item, idx }));
  const gstRows  = gstLines
    .map((g, i) => {
      const isChecked = !!g.isSelected;
      if (disabled && !isChecked) return null;
      return { kind: "gst", g, i, meta: GST_META[i], isChecked };
    })
    .filter(Boolean);

  const allRows = [...itemRows, ...gstRows];
  const rowSpan = allRows.length || 1;

  return (
    <div className="mb-4">
      <div className={`px-3 py-1.5 ${ACC.gstHeader}`}>
        <span className={ACC.sectionTitle}>BRR Items &amp; GST Entries:</span>
      </div>

      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse text-[11px] min-w-[760px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">Order No</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[100px]">BRR No</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[85px]">BRR Date</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">CC Name &amp; Description</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">HSN/SAC</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[110px]">Amount</th>
              {!disabled && (
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-center font-semibold w-[55px]" data-col-resize-last="true">
                  Select
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {/* Loading */}
            {itemsLoading && (
              <tr>
                <td colSpan={disabled ? 6 : 7} className="border border-[#d0d0d0] py-5 text-center text-gray-400">
                  <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading BRR items…
                </td>
              </tr>
            )}

            {!itemsLoading && allRows.map((row, ri) => {
              const isFirst = ri === 0;

              /* ── Item row ── */
              if (row.kind === "item") {
                const { item, idx } = row;
                return (
                  <tr key={`item_${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>

                    {/* Order No — rowSpan across the whole group, first row only */}
                    {isFirst && (
                      <td rowSpan={rowSpan} className="border border-[#d0d0d0] px-2 py-1 text-[#1c3a5e] text-[10px] font-semibold align-top">
                        {orderNo || "—"}
                      </td>
                    )}
                    {/* BRR No */}
                    {isFirst && (
                      <td rowSpan={rowSpan} className="border border-[#d0d0d0] px-2 py-1 text-gray-700 text-[10px] align-top">
                        {brrNo || "—"}
                      </td>
                    )}
                    {/* BRR Date */}
                    {isFirst && (
                      <td rowSpan={rowSpan} className="border border-[#d0d0d0] px-2 py-1 text-gray-700 text-[10px] align-top">
                        {brrDate ? getfmtDisplaydate(brrDate) : "—"}
                      </td>
                    )}

                    {/* CC Name + editable Description */}
                    <td className="border border-[#d0d0d0] p-0 min-w-[160px]">
                      <div className="px-2 pt-[5px] pb-[2px] text-[11px] font-semibold text-gray-800">
                        {item.ccName}
                      </div>
                      <Controller
                        name={`items.${idx}.description`}
                        control={control}
                        render={({ field: f }) => (
                          <ExpandableTextCell
                            value={f.value || ""}
                            onChange={disabled ? undefined : f.onChange}
                            disabled={disabled}
                            placeholder="Add description…"
                            label="Description"
                            textSize="text-[10px]"
                            className="text-gray-500"
                          />
                        )}
                      />
                    </td>

                    {/* HSN/SAC */}
                    <td className="border border-[#d0d0d0] p-0.5 align-top">
                      <input
                        type="text"
                        {...register(`items.${idx}.hsnSac`)}
                        disabled={disabled}
                        placeholder="HSN/SAC"
                        className={`w-full h-[26px] text-[11px] px-1.5 outline-none rounded-sm border-0 ${
                          disabled
                            ? "bg-[#edf8ed] text-gray-500"
                            : "bg-transparent focus:bg-white focus:border focus:border-[#93b5cc]"
                        }`}
                      />
                    </td>

                    <td className="border border-[#d0d0d0] px-2 py-1 text-right font-semibold align-top pt-[6px]">
                      {formatAmount(Number(item.basicAmount || 0))}
                    </td>

                    {/* Item rows always included — show checked-disabled checkbox like SRCW in sale bill */}
                    {!disabled && (
                      <td className="border border-[#d0d0d0] px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          readOnly
                          className="h-3.5 w-3.5 accent-blue-600 cursor-not-allowed"
                        />
                      </td>
                    )}
                  </tr>
                );
              }

              /* ── GST row ── */
              const { g, i, meta, isChecked } = row;
              const amount     = Number(g.gstAmount || 0);
              const isRowMuted = i === 0 ? isCGSTChecked : isIGSTChecked;

              return (
                <tr
                  key={meta.gstType}
                  className={`${isChecked ? "bg-green-50" : i % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"} ${
                    isRowMuted ? "opacity-50" : ""
                  }`}
                >
                  {/* Order/BRR columns already handled by rowSpan */}

                  <td className="border border-[#d0d0d0] px-2 py-1 text-[11px] font-semibold text-gray-700" colSpan={2}>
                    {meta.ccName}
                    <span className="ml-1.5 text-[10px] font-normal text-gray-400">
                      ({g.percent ?? "—"}%)
                    </span>
                  </td>

                  <td className="border border-[#d0d0d0] px-2 py-1 text-right font-semibold">
                    {isChecked && amount > 0 ? formatAmount(amount) : "—"}
                  </td>

                  {!disabled && (
                    <td className="border border-[#d0d0d0] px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => onGstToggle?.(meta.gstType, e.target.checked)}
                        className={`h-3.5 w-3.5 accent-blue-600 ${isRowMuted ? "cursor-not-allowed" : "cursor-pointer"}`}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          IGST and CGST/SGST are mutually exclusive across all entries. CGST and SGST always move together.
          {gstLines[0]?.percent ? ` GST rate applied: ${gstLines[0].percent}%.` : ""}
        </p>
      )}
    </div>
  );
}
