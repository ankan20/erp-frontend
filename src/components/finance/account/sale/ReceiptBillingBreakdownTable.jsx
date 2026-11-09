"use client";

import { ACC }          from "@/components/finance/account/common/accountTheme";
import { formatAmount } from "@/helper/numberFormatter";
import AmountInput      from "@/components/common/AmountInput";
import { useColumnResize } from "@/hooks/useColumnResize";
import { Loader2 }      from "lucide-react";

/**
 * ReceiptBillingBreakdownTable
 *
 * Per-invoice receipt entry table showing Booked / Received / Balance / Current columns.
 * Item rows are always present. GST rows shown only when is_selected = true (from invoice).
 * No toggle — GST selection is determined by the sale invoice itself.
 *
 * Props
 *   invoiceNo, saleOrderNo, certBillNo  string  — header identifiers (rowSpan across all rows)
 *   itemFields    []  — from useFieldArray (for key)
 *   gstFields     []  — from useFieldArray (for key)
 *   watchedItems  []  — live watched items array from parent form
 *   watchedGst    []  — live watched gstLines array from parent form
 *   register      fn  — RHF register (for currentAmount inputs)
 *   disabled      bool
 *   loading       bool
 */
export default function ReceiptBillingBreakdownTable({
  invoiceNo   = "",
  saleOrderNo = "",
  certBillNo  = "",
  itemFields  = [],
  gstFields   = [],
  watchedItems = [],
  watchedGst   = [],
  register,
  disabled = false,
  loading  = false,
}) {
  const { tableRef } = useColumnResize();

  const hasItems = itemFields.length > 0 && watchedItems[0]?.ccCode;

  if (!loading && !hasItems) return null;

  // Build a flat list: all item rows + only selected GST rows
  const allRows = [
    ...itemFields.map((f, idx) => ({
      id: f.id, type: "item", fieldIdx: idx,
      data: watchedItems[idx] || {},
    })),
    ...gstFields
      .map((f, idx) => ({ id: f.id, type: "gst", fieldIdx: idx, data: watchedGst[idx] || {} }))
      .filter((r) => !!r.data.isSelected),
  ];

  // In view/disabled mode hide items with no current amount
  const visibleRows = disabled
    ? allRows.filter((r) => r.type === "item" ? Number(r.data.currentAmount || 0) > 0 : true)
    : allRows.filter((r) => r.type === "item" ? !!r.data.ccCode : true);

  const totalSpan = visibleRows.length || 1;

  return (
    <div className="mb-4">
      <div className={`px-3 py-1.5 ${ACC.gstHeader}`}>
        <span className={ACC.sectionTitle}>Bill-wise Receipt Entries:</span>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table ref={tableRef} className="w-full border-collapse text-[11px] min-w-[760px]">
          <thead className="sticky top-0 z-10">
            <tr className={ACC.tableHead}>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">Invoice No</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">Sale Order</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[80px]">Cert Bill</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">CC Name</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[85px]">Booked</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[85px]">Received</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[85px]">Balance</th>
              <th
                className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[95px]"
                data-col-resize-last="true"
              >
                Current
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="border border-gray-200 py-5 text-center text-gray-400">
                  <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-gray-200 py-6 text-center text-[#bbb] italic text-[11px]">
                  No receipt entries to display
                </td>
              </tr>
            ) : (
              visibleRows.map((row, vi) => {
                const { type, fieldIdx, data } = row;
                const isFirstRow = vi === 0;
                const isItemRow  = type === "item";
                const current    = Number(data.currentAmount || 0);
                const balDisplay = Number(data.balanceAmount || 0) - current;
                const overBalance = !disabled && current > Number(data.balanceAmount || 0);

                const rowBg = isItemRow
                  ? (fieldIdx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]")
                  : "bg-green-50";

                return (
                  <tr key={row.id} className={rowBg}>

                    {/* Identifier cells — rowSpan across all visible rows, first row only */}
                    {isFirstRow && (
                      <>
                        <td
                          className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e] text-[10px] align-top"
                          rowSpan={totalSpan}
                        >
                          {invoiceNo || "—"}
                        </td>
                        <td
                          className="border border-[#d0d0d0] px-2 py-1 text-gray-700 text-[10px] align-top"
                          rowSpan={totalSpan}
                        >
                          {saleOrderNo || "—"}
                        </td>
                        <td
                          className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e] text-[10px] align-top"
                          rowSpan={totalSpan}
                        >
                          {certBillNo || "—"}
                        </td>
                      </>
                    )}

                    {/* CC Name + percent for GST rows */}
                    <td className="border border-[#d0d0d0] px-2 py-[3px]">
                      <span className="text-[11px] font-semibold text-gray-700">
                        {data.ccName || data.ccCode || "—"}
                      </span>
                      {!isItemRow && data.percent > 0 && (
                        <span className="ml-1 text-[10px] text-gray-400">({data.percent}%)</span>
                      )}
                      {isItemRow && data.description && (
                        <div className="text-[10px] text-gray-400 mt-0.5">{data.description}</div>
                      )}
                    </td>

                    {/* Booked */}
                    <td className="border border-[#d0d0d0] px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                      {data.bookedAmount > 0 ? formatAmount(data.bookedAmount) : "—"}
                    </td>

                    {/* Received (previously) */}
                    <td className="border border-[#d0d0d0] px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                      {data.receivedAmount > 0 ? formatAmount(data.receivedAmount) : "—"}
                    </td>

                    {/* Balance = balanceAmount − currentAmount (remaining after this entry) */}
                    <td
                      className={`border border-[#d0d0d0] px-2 py-[3px] text-right font-medium whitespace-nowrap ${
                        balDisplay < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {data.bookedAmount > 0 ? formatAmount(balDisplay) : "—"}
                    </td>

                    {/* Current amount — editable */}
                    <td className="border border-[#d0d0d0] p-0.5">
                      <AmountInput
                        {...register(
                          isItemRow
                            ? `items.${fieldIdx}.currentAmount`
                            : `gstLines.${fieldIdx}.currentAmount`,
                        )}
                        value={data.currentAmount ?? ""}
                        disabled={disabled}
                        placeholder="0.00"
                        className={`w-full h-[26px] text-[11px] text-right rounded-sm border-0 outline-none ${
                          disabled
                            ? "bg-[#edf8ed] text-gray-400"
                            : overBalance
                            ? "bg-red-50 text-red-600 border border-red-400"
                            : "bg-[#fffbe6] focus:bg-white"
                        }`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && hasItems && (
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          GST rows shown are as selected on the sale invoice. Enter current amount for each row.
        </p>
      )}
    </div>
  );
}
