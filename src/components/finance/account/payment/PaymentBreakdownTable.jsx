"use client";

import { ACC }               from "@/components/finance/account/common/accountTheme";
import { formatAmount }      from "@/helper/numberFormatter";
import AmountInput           from "@/components/common/AmountInput";
import { useColumnResize }   from "@/hooks/useColumnResize";
import { Loader2 }           from "lucide-react";
import ExpandableTextCell    from "@/components/project-management/common/ExpandableTextCell";

/**
 * PaymentBreakdownTable
 *
 * Multi-bill / voucher payment entry table.
 * For bill mode: rows grouped by purchaseBillNo/orderNo (rowSpan per group).
 * For voucher mode: rows grouped by voucherNo, no GST rows.
 *
 * Props
 *   paymentType   "bill"|"voucher"
 *   itemFields    []   — from useFieldArray
 *   gstFields     []   — from useFieldArray
 *   watchedItems  []   — live watched items array
 *   watchedGst    []   — live watched gstLines array
 *   register      fn   — RHF register
 *   disabled      bool
 *   loading       bool
 */
export default function PaymentBreakdownTable({
  paymentType  = "bill",
  itemFields   = [],
  gstFields    = [],
  watchedItems = [],
  watchedGst   = [],
  register,
  disabled = false,
  loading  = false,
}) {
  const isVoucher = paymentType === "voucher";
  const { tableRef } = useColumnResize();

  const hasItems = itemFields.length > 0 && watchedItems[0]?.ccCode;

  if (!loading && !hasItems) return null;

  const allRows = [
    ...itemFields.map((f, idx) => ({
      id: f.id, type: "item", fieldIdx: idx,
      data: watchedItems[idx] || {},
    })),
    // No GST rows for voucher payments
    ...(!isVoucher ? gstFields
      .map((f, idx) => ({ id: f.id, type: "gst", fieldIdx: idx, data: watchedGst[idx] || {} }))
      .filter((r) => !!r.data.isSelected) : []),
  ];

  const visibleRows = disabled
    ? allRows.filter((r) => Number(r.data.currentAmount || 0) > 0)
    : allRows.filter((r) => r.type === "item" ? !!r.data.ccCode : true);

  // Group consecutive rows that share the same bill/voucher identifier for rowSpan
  const getGroupKey = (data) => isVoucher
    ? (data.voucherNo || "")
    : `${data.purchaseBillNo || ""}|${data.orderNo || ""}`;

  const annotated = visibleRows.map((row, vi) => {
    const key = getGroupKey(row.data);

    // Find the first row in this group
    let groupStart = vi;
    while (groupStart > 0 && getGroupKey(visibleRows[groupStart - 1].data) === key) {
      groupStart--;
    }
    const isFirstInGroup = groupStart === vi;

    // Calculate span
    let span = 0;
    for (let j = vi; j < visibleRows.length; j++) {
      if (getGroupKey(visibleRows[j].data) === key) {
        span++;
      } else {
        break;
      }
    }

    return { ...row, showBillCell: isFirstInGroup, billRowSpan: span };
  });

  return (
    <div className="mb-4">
      <div className={`px-3 py-1.5 ${ACC.gstHeader}`}>
        <span className={ACC.sectionTitle}>{isVoucher ? "Voucher-wise Payment Entries:" : "Bill-wise Payment Entries:"}</span>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table ref={tableRef} className="w-full border-collapse text-[11px] min-w-[800px]">
          <thead className="sticky top-0 z-10">
            <tr className={ACC.tableHead}>
              {isVoucher ? (
                <>
                  <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[110px]">Voucher No</th>
                  <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[85px]">Date</th>
                </>
              ) : (
                <>
                  <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[90px]">PR No</th>
                  <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[85px]">Order No</th>
                </>
              )}
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">CC Name / Description</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[85px]">Booked</th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[85px]">Paid</th>
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
                <td colSpan={7} className="border border-gray-200 py-5 text-center text-gray-400">
                  <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                </td>
              </tr>
            ) : annotated.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-gray-200 py-6 text-center text-[#bbb] italic text-[11px]">
                  No payment entries to display
                </td>
              </tr>
            ) : (
              annotated.map((row) => {
                const { type, fieldIdx, data, showBillCell, billRowSpan } = row;
                const isItemRow  = type === "item";
                const current    = Number(data.currentAmount || 0);
                const balDisplay = Number(data.balanceAmount || 0) - current;
                const overBalance = !disabled && current > Number(data.balanceAmount || 0);

                const rowBg = isItemRow
                  ? (fieldIdx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]")
                  : "bg-green-50";

                return (
                  <tr key={row.id} className={rowBg}>
                    {showBillCell && (
                      <>
                        {isVoucher ? (
                          <>
                            <td
                              className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e] text-[10px] align-top"
                              rowSpan={billRowSpan}
                            >
                              {data.voucherNo || "—"}
                            </td>
                            <td
                              className="border border-[#d0d0d0] px-2 py-1 text-gray-500 text-[10px] align-top"
                              rowSpan={billRowSpan}
                            >
                              {data.entryDate ? data.entryDate.slice(0, 10) : "—"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td
                              className="border border-[#d0d0d0] px-2 py-1 font-semibold text-[#1c3a5e] text-[10px] align-top"
                              rowSpan={billRowSpan}
                            >
                              {data.purchaseBillNo || "—"}
                            </td>
                            <td
                              className="border border-[#d0d0d0] px-2 py-1 text-gray-700 text-[10px] align-top"
                              rowSpan={billRowSpan}
                            >
                              {data.orderNo || "—"}
                            </td>
                          </>
                        )}
                      </>
                    )}

                    <td className="border border-[#d0d0d0] px-2 py-[3px]">
                      <span className="text-[11px] font-semibold text-gray-700">
                        {data.ccName || data.ccCode || "—"}
                      </span>
                      {!isItemRow && data.percent > 0 && (
                        <span className="ml-1 text-[10px] text-gray-400">({data.percent}%)</span>
                      )}
                      {isItemRow && (
                        <ExpandableTextCell
                          value={data.description || ""}
                          disabled
                          placeholder="—"
                          label="Description"
                          textSize="text-[10px]"
                          className="text-gray-400 mt-0.5"
                        />
                      )}
                    </td>

                    <td className="border border-[#d0d0d0] px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                      {data.bookedAmount > 0 ? formatAmount(data.bookedAmount) : "—"}
                    </td>

                    <td className="border border-[#d0d0d0] px-2 py-[3px] text-right text-gray-600 whitespace-nowrap">
                      {data.paidAmount > 0 ? formatAmount(data.paidAmount) : "—"}
                    </td>

                    <td
                      className={`border border-[#d0d0d0] px-2 py-[3px] text-right font-medium whitespace-nowrap ${
                        balDisplay < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {data.bookedAmount > 0 ? formatAmount(balDisplay) : "—"}
                    </td>

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

      {!loading && hasItems && !isVoucher && (
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          GST rows shown are as selected on the purchase bill. Enter current payment amount for each row.
        </p>
      )}
    </div>
  );
}
