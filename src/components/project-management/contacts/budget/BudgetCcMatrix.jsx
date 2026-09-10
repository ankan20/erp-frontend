"use client";

import { Controller } from "react-hook-form";
import { Loader2, Plus, X } from "lucide-react";

import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput      from "@/components/common/AmountInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

/**
 * Budget allocation matrix.
 *
 * Every CC code is a COLUMN across the whole table, not a block of rows under
 * each item — so one item is one line and the allocations read across it, the
 * way a budget sheet is normally laid out. Add a CC code once and it applies to
 * every item; each cell holds that item's CC value per unit.
 *
 * `items[i].ccCodes` is kept index-aligned with the column list, so cell (i, c)
 * is always `items.<i>.ccCodes.<c>.ccValue`.
 *
 * Sl / Item Code / Item Name stay pinned while the CC columns scroll sideways.
 */

// Pinned column offsets must match the widths below
const STICKY = {
  sl:   "sticky left-0 z-20 w-[44px] min-w-[44px]",
  code: "sticky left-[44px] z-20 w-[92px] min-w-[92px]",
  name: "sticky left-[136px] z-20 w-[220px] min-w-[220px]",
};

export default function BudgetCcMatrix({
  control,
  items          = [],
  ccColumns      = [],
  totals,
  ccOptions      = [],
  disabled       = false,
  itemsLoading   = false,
  onAddColumn,
  onRemoveColumn,
}) {
  const colCount = 7 + ccColumns.length;   // pinned 3 + unit/qty/rate/initial + CC cols + 2 trailing

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* Header strip — CC code picker lives here, it applies to every item */}
      <div className="bg-[#d6e6f2] px-3 py-[6px] border-b border-gray-300 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] font-semibold text-[#144664]">
          Budget Items &amp; CC Code Allocation
        </span>

        {!disabled && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#3b6ea5]">Add CC column:</span>
            <div className="w-[240px]">
              <SearchableSelect
                options={ccOptions}
                value=""
                disabled={items.length === 0}
                onChange={(val, opt) => val && onAddColumn(val, opt)}
                placeholder={items.length === 0 ? "Load items first" : "Select CC code…"}
                labelKey="displayLabel"
                valueKey="id"
                searchKeys={["displayLabel", "ccCode", "ccName"]}
              />
            </div>
          </div>
        )}

        <span className="ml-auto text-[12px] font-semibold text-[#144664] tabular-nums">
          Grand Total: {formatAmount(totals.grandTotal)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 900 + ccColumns.length * 130 }}>
          <thead className="sticky top-0 z-30">
            <tr className="bg-[#144664] text-white">
              <th className={`${STICKY.sl} bg-[#144664] border border-[#2e5a72] px-2 py-1.5 text-center font-semibold`}>SL</th>
              <th className={`${STICKY.code} bg-[#144664] border border-[#2e5a72] px-2 py-1.5 text-left font-semibold`}>Item Code</th>
              <th className={`${STICKY.name} bg-[#144664] border border-[#2e5a72] px-2 py-1.5 text-left font-semibold`}>Item Name</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-left font-semibold w-[70px] min-w-[70px]">Unit</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[92px] min-w-[92px]">Order Qty</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[96px] min-w-[96px]">Rate</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[112px] min-w-[112px]">Initial Amt</th>

              {ccColumns.map((c, ci) => (
                <th
                  key={`${c.ccCodeId}-${ci}`}
                  className="border border-[#2e5a72] px-2 py-1 text-right font-semibold w-[130px] min-w-[130px] align-top"
                  title={c.ccName}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 text-left">
                      <div className="truncate">{c.ccCode || "—"}</div>
                      <div className="text-[10px] font-normal text-[#b8d4e6] truncate">{c.ccName}</div>
                    </div>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveColumn(ci)}
                        title={`Remove ${c.ccCode} from all items`}
                        className="shrink-0 p-0.5 rounded text-[#b8d4e6] hover:text-white hover:bg-white/20 transition"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </th>
              ))}

              <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[112px] min-w-[112px]">CC Cost</th>
              <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[124px] min-w-[124px]">Total Cost</th>
            </tr>
          </thead>

          <tbody>
            {itemsLoading ? (
              <tr>
                <td colSpan={colCount + 2} className="border border-gray-200 py-6 text-center text-gray-400">
                  <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading sale order items…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colCount + 2} className="border border-gray-200 py-8 text-center text-[#bbb] italic">
                  Select a Sale Order to load its items
                </td>
              </tr>
            ) : (
              items.map((item, idx) => {
                const calc  = totals.perItem[idx] || { initialAmount: 0, itemCcCost: 0, totalCost: 0 };
                const zebra = idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]";
                return (
                  <tr key={idx} className={zebra}>
                    <td className={`${STICKY.sl} ${zebra} border border-gray-200 px-2 py-[3px] text-center text-gray-500`}>
                      {item.slNo || idx + 1}
                    </td>
                    <td className={`${STICKY.code} ${zebra} border border-gray-200 px-2 py-[3px] font-medium text-[#144664]`}>
                      {item.itemCode || "—"}
                    </td>
                    <td className={`${STICKY.name} ${zebra} border border-gray-200 px-2 py-[3px]`}>
                      <div className="text-gray-800 truncate" title={item.itemName}>{item.itemName || "—"}</div>
                      {item.itemDescription && (
                        <div className="text-[10px] text-gray-500 truncate" title={item.itemDescription}>
                          {item.itemDescription}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-200 px-2 py-[3px] text-gray-600">{item.unitItem || "—"}</td>
                    <td className="border border-gray-200 px-2 py-[3px] text-right tabular-nums">
                      {formatQtyDisplay(item.orderQty)}
                    </td>
                    <td className="border border-gray-200 px-2 py-[3px] text-right tabular-nums">
                      {formatAmount(item.rate)}
                    </td>
                    <td className="border border-gray-200 px-2 py-[3px] text-right tabular-nums bg-[#f3f8f3]">
                      {formatAmount(calc.initialAmount)}
                    </td>

                    {ccColumns.map((c, ci) => (
                      <CcCell
                        key={`${c.ccCodeId}-${ci}`}
                        control={control}
                        itemIndex={idx}
                        colIndex={ci}
                        orderQty={item.orderQty}
                        value={item.ccCodes?.[ci]?.ccValue}
                        disabled={disabled}
                      />
                    ))}

                    <td className="border border-gray-200 px-2 py-[3px] text-right tabular-nums">
                      {formatAmount(calc.itemCcCost)}
                    </td>
                    <td className="border border-gray-200 px-2 py-[3px] text-right tabular-nums font-semibold">
                      {formatAmount(calc.totalCost)}
                    </td>
                  </tr>
                );
              })
            )}

            {items.length > 0 && (
              <tr className="bg-[#d6e6f2] font-semibold">
                <td className={`${STICKY.sl} bg-[#d6e6f2] border border-gray-300 px-2 py-1.5`} />
                <td className={`${STICKY.code} bg-[#d6e6f2] border border-gray-300 px-2 py-1.5`} />
                <td className={`${STICKY.name} bg-[#d6e6f2] border border-gray-300 px-2 py-1.5 text-right text-[12px]`}>
                  TOTAL
                </td>
                <td className="border border-gray-300" colSpan={3} />
                <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">
                  {formatAmount(totals.totalInitialCost)}
                </td>
                {ccColumns.map((c, ci) => (
                  <td
                    key={`${c.ccCodeId}-${ci}`}
                    className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums"
                  >
                    {formatAmount(totals.perColumn[ci] || 0)}
                  </td>
                ))}
                <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">
                  {formatAmount(totals.totalCcCost)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums font-bold">
                  {formatAmount(totals.grandTotal)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && ccColumns.length === 0 && !disabled && (
        <div className="px-3 py-2 bg-[#fffbe6] border-t border-[#e6d9a8] text-[11px] text-[#7a6a1f] flex items-center gap-1.5">
          <Plus size={12} />
          No CC code allocated yet — add one above and it becomes a column for every item.
        </div>
      )}
    </div>
  );
}

/**
 * One allocation cell: the CC value per unit for this item.
 * CC Total (order_qty × cc_value) shows underneath so the effect is visible
 * without needing a second column per CC code.
 */
function CcCell({ control, itemIndex, colIndex, orderQty, value, disabled }) {
  const ccTotal = Number(orderQty || 0) * Number(value || 0);
  const hasVal  = value !== "" && value !== null && value !== undefined && Number(value) > 0;

  return (
    <td className="border border-gray-200 p-0.5 align-top">
      <Controller
        control={control}
        name={`items.${itemIndex}.ccCodes.${colIndex}.ccValue`}
        render={({ field }) => (
          <AmountInput
            {...field}
            value={field.value ?? ""}
            disabled={disabled}
            placeholder="0.00"
            className={`w-full h-[24px] text-[11px] text-right px-1.5 rounded-sm border-0 outline-none md:text-[11px] focus-visible:ring-0 ${
              disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fffbe6] focus:bg-white"
            }`}
          />
        )}
      />
      <div className={`text-[10px] text-right pr-1 pt-[1px] tabular-nums ${hasVal ? "text-gray-500" : "text-transparent"}`}>
        {formatAmount(ccTotal)}
      </div>
    </td>
  );
}
