"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Loader2, Plus, X, Trash2, ListPlus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput      from "@/components/common/AmountInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

/**
 * Budget allocation matrix.
 *
 * Every CC code is a COLUMN across the whole table. `items[i].ccCodes` is
 * kept index-aligned with the column list so cell (i, c) is always
 * `items.<i>.ccCodes.<c>.ccValue`.
 *
 * Each cell also supports optional line-item entries (manual breakdown
 * metadata): { slNo, description, amount }[]. Clicking the entries icon
 * opens a modal to view/edit them.
 */

// Pinned column offsets must match the widths below
const STICKY = {
  sl:   "sticky left-0 z-20 w-[44px] min-w-[44px] max-w-[44px]",
  code: "sticky left-[44px] z-20 w-[92px] min-w-[92px] max-w-[92px]",
  name: "sticky left-[136px] z-20 w-[220px] min-w-[220px] max-w-[220px]",
};

export default function BudgetCcMatrix({
  control,
  setValue,
  items          = [],
  ccColumns      = [],
  totals,
  ccOptions      = [],
  disabled       = false,
  itemsLoading   = false,
  onAddColumn,
  onRemoveColumn,
}) {
  const colCount = 7 + ccColumns.length;

  return (
    <TooltipProvider>
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* Header strip */}
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
        <table className="w-full table-fixed border-collapse text-[12px]" style={{ minWidth: 962 + ccColumns.length * 130 }}>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] text-gray-500 truncate cursor-default">{item.itemDescription}</div>
                          </TooltipTrigger>
                          <TooltipContent variant="text" side="top" className="max-w-[320px] whitespace-normal">
                            {item.itemDescription}
                          </TooltipContent>
                        </Tooltip>
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
                        setValue={setValue}
                        itemIndex={idx}
                        colIndex={ci}
                        orderQty={item.orderQty}
                        value={item.ccCodes?.[ci]?.ccValue}
                        entries={item.ccCodes?.[ci]?.entries || []}
                        disabled={disabled}
                        ccCode={c.ccCode}
                        ccName={c.ccName}
                        itemName={item.itemName}
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
    </TooltipProvider>
  );
}

// ─── CcCell ───────────────────────────────────────────────────────────────────
// One allocation cell: ccValue (per unit) input + entries icon/badge.
function CcCell({ control, setValue, itemIndex, colIndex, orderQty, value, entries, disabled, ccCode, ccName, itemName }) {
  const [modalOpen, setModalOpen] = useState(false);

  const ccTotal    = Number(orderQty || 0) * Number(value || 0);
  const hasVal     = value !== "" && value !== null && value !== undefined && Number(value) > 0;
  const entryCount = entries.length;

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

      {/* Bottom row: entries icon + cc total */}
      <div className="flex items-center justify-between pr-1 pt-[1px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className={`flex items-center gap-0.5 rounded px-0.5 py-[1px] text-[10px] transition-colors ${
                entryCount > 0
                  ? "text-blue-600 hover:text-blue-800"
                  : disabled
                  ? "invisible"
                  : "text-gray-300 hover:text-gray-500"
              }`}
            >
              <ListPlus size={11} />
              {entryCount > 0 && (
                <span className="tabular-nums font-semibold">{entryCount}</span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" variant="text">
            {entryCount > 0
              ? `${entryCount} entr${entryCount === 1 ? "y" : "ies"} — click to ${disabled ? "view" : "edit"}`
              : "Add breakdown entries"}
          </TooltipContent>
        </Tooltip>
        <div className={`text-[10px] text-right tabular-nums ${hasVal ? "text-gray-500" : "text-transparent"}`}>
          {formatAmount(ccTotal)}
        </div>
      </div>

      {modalOpen && (
        <CcEntriesModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          entries={entries}
          disabled={disabled}
          ccCode={ccCode}
          ccName={ccName}
          itemName={itemName}
          onApply={(updated) => {
            setValue(`items.${itemIndex}.ccCodes.${colIndex}.entries`, updated, { shouldDirty: true });
            setModalOpen(false);
          }}
        />
      )}
    </td>
  );
}

// ─── CcEntriesModal ───────────────────────────────────────────────────────────
// Modal for viewing / editing the line-item entries of a CC allocation cell.
function CcEntriesModal({ open, onClose, entries, disabled, ccCode, ccName, itemName, onApply }) {
  const [rows, setRows] = useState(() => entries.map((e) => ({ ...e })));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { slNo: prev.length + 1, description: "", amount: "" },
    ]);

  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const updateRow = (i, key, val) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const handleApply = () => {
    const cleaned = rows
      .filter((r) => (r.description || "").trim())
      .map((r, i) => ({
        slNo:        i + 1,
        description: (r.description || "").trim(),
        amount:      Number(r.amount || 0),
      }));
    onApply(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-[640px] sm:max-w-[720px] md:max-w-[860px] lg:max-w-[1000px] xl:max-w-[1120px] p-0 gap-0" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="px-5 py-3 border-b bg-[#f0f7fa]">
          <DialogTitle className="text-[14px] font-semibold text-[#144664]">
            {ccCode || "CC"}{ccName ? ` — ${ccName}` : ""}&nbsp;·&nbsp;Entries
          </DialogTitle>
          {itemName && (
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{itemName}</p>
          )}
        </DialogHeader>

        <div className="overflow-auto max-h-[50vh] px-4 pt-3 pb-2">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#d6e6f2]">
                <th className="border border-[#b5c9d6] px-2 py-1.5 text-center font-semibold w-[46px]">Sl.</th>
                <th className="border border-[#b5c9d6] px-2 py-1.5 text-left font-semibold">Description</th>
                <th className="border border-[#b5c9d6] px-2 py-1.5 text-right font-semibold w-[130px]">Amount</th>
                {!disabled && (
                  <th className="border border-[#b5c9d6] px-2 py-1.5 w-[38px]" />
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={disabled ? 3 : 4}
                    className="border border-gray-100 py-8 text-center text-gray-400 italic text-[12px]"
                  >
                    {disabled ? "No entries recorded" : "No entries yet — click Add Row below"}
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f9fbfd]"}>
                  <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-500">
                    {i + 1}
                  </td>

                  <td className="border border-gray-200 px-1 py-[3px]">
                    {disabled ? (
                      <span className="block px-1.5 py-[3px] text-gray-700">{row.description}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.description || ""}
                        onChange={(e) => updateRow(i, "description", e.target.value)}
                        placeholder="Enter description…"
                        className="w-full h-[26px] px-1.5 text-[12px] border border-gray-200 rounded-sm outline-none focus:border-[#4d8ea3] bg-white"
                      />
                    )}
                  </td>

                  <td className="border border-gray-200 px-1 py-[3px]">
                    {disabled ? (
                      <span className="block text-right pr-1.5 py-[3px] tabular-nums text-gray-700">
                        {formatAmount(row.amount)}
                      </span>
                    ) : (
                      <AmountInput
                        value={row.amount ?? ""}
                        onChange={(e) => updateRow(i, "amount", e.target.value)}
                        placeholder="0.00"
                        className="w-full h-[26px] text-[12px] text-right px-1.5 border border-gray-200 rounded-sm outline-none focus:border-[#4d8ea3] bg-white focus-visible:ring-0"
                      />
                    )}
                  </td>

                  {!disabled && (
                    <td className="border border-gray-200 px-1 py-[3px] text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-red-400 hover:text-red-600 transition"
                        title="Remove row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-[#e8f4ea] font-semibold">
                  <td
                    colSpan={2}
                    className="border border-gray-300 px-2 py-1.5 text-right text-[12px]"
                  >
                    Total
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">
                    {formatAmount(total)}
                  </td>
                  {!disabled && <td className="border border-gray-300" />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 bg-slate-50">
          {!disabled ? (
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm font-medium hover:brightness-95 transition"
            >
              <Plus size={13} />
              Add Row
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-100 transition"
            >
              {disabled ? "Close" : "Cancel"}
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-1.5 text-[12px] bg-[#144664] text-white rounded-sm hover:bg-[#0f3347] transition font-medium"
              >
                Apply
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
