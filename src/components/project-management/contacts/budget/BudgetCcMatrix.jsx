"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Loader2, ChevronRight, ChevronLeft, ListPlus, Plus, Trash2, Settings2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import AmountInput from "@/components/common/AmountInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";
import { useColumnResize } from "@/hooks/useColumnResize";

// ─── Colour tokens ────────────────────────────────────────────────────────────
// Header bg
const HDR       = "bg-[#144664] text-white";
// DRCW column — teal/dark
const DRCW_HDR  = "bg-[#0f5132] text-white";
const DRCW_CELL = "bg-[#d1fae5]";
// Sibling DE columns — amber
const DE_HDR    = "bg-[#92400e] text-white";
const DE_CELL   = "bg-[#fffbeb]";
// Overhead columns — indigo
const OH_HDR    = "bg-[#312e81] text-white";
const OH_CELL   = "bg-[#eef2ff]";
// TEC — slate
const TEC_HDR   = "bg-[#1e293b] text-white";
const TEC_CELL  = "bg-[#f1f5f9]";
// Profit — green/red
const PRF_HDR   = "bg-[#14532d] text-white";
// Sticky column offsets
const STICKY = {
  sl:   "sticky left-0 z-20 w-[44px] min-w-[44px] max-w-[44px]",
  code: "sticky left-[44px] z-20 w-[90px] min-w-[90px] max-w-[90px]",
  name: "sticky left-[134px] z-20 w-[200px] min-w-[200px] max-w-[200px]",
};

export default function BudgetCcMatrix({
  control,
  setValue,
  items            = [],
  deCcColumns      = [],     // Direct Expenses CC columns (all; DRCW = sum of others)
  totals,
  poPercent        = 0,
  eoPercent        = 0,
  projectOverhead  = [],
  employeeOverhead = [],
  projectOverheadCcs  = [],
  employeeOverheadCcs = [],
  orderValueExclGst   = 0,
  disabled         = false,
  itemsLoading     = false,
}) {
  const { tableRef } = useColumnResize();
  const [deExpanded, setDeExpanded] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [eoModalOpen, setEoModalOpen] = useState(false);

  // Identify DRCW column index
  const drcwIdx    = deCcColumns.findIndex((c) => c.ccCode === "DRCW");
  // Sibling DE columns (everything except DRCW)
  const siblingDe  = deCcColumns.filter((_, i) => i !== drcwIdx);
  const siblingIdxs = deCcColumns.map((_, i) => i).filter((i) => i !== drcwIdx);

  // Fixed column count before DE section
  const fixedCols = 7; // SL, Code, Name, Unit, Qty, Rate, Amount
  // Visible DE cols: always DRCW; siblings only when expanded
  const visibleDeCols  = deExpanded ? deCcColumns.length : (drcwIdx >= 0 ? 1 : deCcColumns.length);
  const overheadCols   = 2; // PO + EO
  const summaryCols    = 3; // TEC, Profit, Profit%
  const totalColCount  = fixedCols + visibleDeCols + overheadCols + summaryCols;

  return (
    <TooltipProvider>
      <div className="border border-gray-300 rounded-sm overflow-hidden">
        {/* Header strip */}
        <div className="bg-[#d6e6f2] px-3 py-[6px] border-b border-gray-300 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-semibold text-[#144664]">
            Budget Items &amp; Cost Allocation
          </span>
          <span className="ml-auto text-[12px] font-semibold text-[#144664] tabular-nums">
            Grand Total: {formatAmount(totals.totalAmount)}
          </span>
        </div>

        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "60vh" }}>
          <table
            ref={tableRef}
            className="w-full table-fixed border-collapse text-[12px]"
            style={{ minWidth: 700 + visibleDeCols * 120 + 400 }}
          >
            <thead className="sticky top-0 z-30">
              {/* ── Group header row ── */}
              <tr>
                {/* Fixed columns */}
                <th colSpan={fixedCols} className={`${HDR} border border-[#2e5a72] px-2 py-1 text-center text-[11px] font-semibold`}>
                  Sale Order Items
                </th>

                {/* DRCW group header — always visible */}
                {drcwIdx >= 0 && (
                  <th
                    colSpan={deExpanded ? deCcColumns.length : 1}
                    className={`${DRCW_HDR} border border-[#064e3b] px-2 py-1 text-center text-[11px] font-semibold`}
                  >
                    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
                      <span className="whitespace-nowrap">Direct Expenses</span>
                      <button
                        type="button"
                        onClick={() => setDeExpanded((v) => !v)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-white/20 hover:bg-white/30 transition font-medium whitespace-nowrap"
                        title={deExpanded ? "Collapse DE breakdown" : "Expand DE breakdown"}
                      >
                        {deExpanded ? <><ChevronLeft size={11} /> Collapse</> : <><ChevronRight size={11} /> Expand</>}
                      </button>
                    </div>
                  </th>
                )}

                {/* Overhead group header */}
                <th colSpan={overheadCols} className={`${OH_HDR} border border-[#312e81] px-2 py-1 text-center text-[11px] font-semibold`}>
                  Overhead
                </th>

                {/* Summary group header */}
                <th colSpan={summaryCols} className={`${TEC_HDR} border border-[#1e293b] px-2 py-1 text-center text-[11px] font-semibold`}>
                  Summary
                </th>
              </tr>

              {/* ── Column header row ── */}
              <tr>
                {/* Fixed */}
                <th className={`${STICKY.sl} ${HDR} border border-[#2e5a72] px-1 py-1.5 text-center text-[11px]`}>SL</th>
                <th className={`${STICKY.code} ${HDR} border border-[#2e5a72] px-2 py-1.5 text-left text-[11px]`}>Code</th>
                <th className={`${STICKY.name} ${HDR} border border-[#2e5a72] px-2 py-1.5 text-left text-[11px]`}>Item Name</th>
                <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-center text-[11px] w-[58px] min-w-[58px]`}>Unit</th>
                <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-right text-[11px] w-[80px] min-w-[80px]`}>Qty</th>
                <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-right text-[11px] w-[90px] min-w-[90px]`}>Rate</th>
                <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-right text-[11px] w-[100px] min-w-[100px]`}>Amount</th>

                {/* DE columns */}
                {deCcColumns.map((c, ci) => {
                  const isDrcw    = ci === drcwIdx;
                  const isVisible = isDrcw || deExpanded;
                  if (!isVisible) return null;
                  return (
                    <th
                      key={`de-h-${c.ccCodeId}`}
                      className={`${isDrcw ? DRCW_HDR : DE_HDR} border border-[#064e3b] px-2 py-1 text-left text-[11px] w-[110px] min-w-[110px] align-top`}
                      title={c.ccName}
                    >
                      <div className="text-[11px] font-semibold truncate">{c.ccCode}</div>
                      <div className="text-[9px] font-normal opacity-80 truncate leading-tight">{c.ccName}</div>
                      {isDrcw && (
                        <div className="text-[9px] font-normal opacity-70 mt-0.5">(auto sum)</div>
                      )}
                    </th>
                  );
                })}

                {/* Project Overhead */}
                <th
                  className={`${OH_HDR} border border-[#312e81] px-1.5 py-1 text-center text-[11px] w-[110px] min-w-[110px] align-top`}
                >
                  <div className="flex items-start justify-between gap-0.5">
                    <div className="min-w-0 text-left">
                      <div className="font-semibold leading-tight break-words">Project Overhead</div>
                      <div className="text-[9px] font-bold text-yellow-300 mt-0.5">{poPercent.toFixed(2)}%</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPoModalOpen(true)}
                      className="shrink-0 mt-0.5 p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition"
                      title={disabled ? "View Project Overhead" : "Configure Project Overhead"}
                    >
                      <Settings2 size={12} />
                    </button>
                  </div>
                </th>

                {/* Employee Overhead */}
                <th
                  className={`${OH_HDR} border border-[#312e81] px-1.5 py-1 text-center text-[11px] w-[110px] min-w-[110px] align-top`}
                >
                  <div className="flex items-start justify-between gap-0.5">
                    <div className="min-w-0 text-left">
                      <div className="font-semibold leading-tight break-words">Employee Overhead</div>
                      <div className="text-[9px] font-bold text-yellow-300 mt-0.5">{eoPercent.toFixed(2)}%</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEoModalOpen(true)}
                      className="shrink-0 mt-0.5 p-0.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition"
                      title={disabled ? "View Employee Overhead" : "Configure Employee Overhead"}
                    >
                      <Settings2 size={12} />
                    </button>
                  </div>
                </th>

                {/* Summary */}
                <th className={`${TEC_HDR} border border-[#1e293b] px-2 py-1.5 text-right text-[11px] w-[120px] min-w-[120px]`}>Total Execution Cost</th>
                <th className={`${PRF_HDR} border border-[#14532d] px-2 py-1.5 text-right text-[11px] w-[100px] min-w-[100px]`}>Profit</th>
                <th className={`${PRF_HDR} border border-[#14532d] px-2 py-1.5 text-right text-[11px] w-[80px] min-w-[80px]`}>Profit %</th>
              </tr>
            </thead>

            <tbody>
              {itemsLoading ? (
                <tr>
                  <td colSpan={totalColCount} className="border border-gray-200 py-6 text-center text-gray-400">
                    <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={totalColCount} className="border border-gray-200 py-8 text-center text-[#bbb] italic">
                    Select a Sale Order to load its items
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const calc  = totals.perItem[idx] || { amount: 0, drcwAmount: 0, poAmount: 0, eoAmount: 0, tec: 0, profit: 0, profitPct: 0 };
                  const zebra = idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]";
                  return (
                    <tr key={idx} className={zebra}>
                      <td className={`${STICKY.sl} ${zebra} border border-gray-200 px-1 py-[3px] text-center text-gray-500`}>
                        {item.slNo || idx + 1}
                      </td>
                      <td className={`${STICKY.code} ${zebra} border border-gray-200 px-1.5 py-[3px] font-medium text-[#144664] text-[11px]`}>
                        {item.itemCode || "—"}
                      </td>
                      <td className={`${STICKY.name} ${zebra} border border-gray-200 px-1.5 py-[3px]`}>
                        <div className="text-gray-800 truncate text-[11px]" title={item.itemName}>{item.itemName || "—"}</div>
                        {item.itemDescription && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-[9px] text-gray-400 truncate cursor-default">{item.itemDescription}</div>
                            </TooltipTrigger>
                            <TooltipContent variant="text" side="top" className="max-w-[320px] whitespace-normal">
                              {item.itemDescription}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                      <td className="border border-gray-200 px-1.5 py-[3px] text-center text-[11px] text-gray-600">{item.unitItem || "—"}</td>
                      <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                        {formatQtyDisplay(item.orderQty)}
                      </td>
                      <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                        {formatAmount(item.rate)}
                      </td>
                      <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums bg-[#f3f8f3] text-[11px] font-medium">
                        {formatAmount(calc.amount)}
                      </td>

                      {/* DE CC columns */}
                      {deCcColumns.map((c, ci) => {
                        const isDrcw    = ci === drcwIdx;
                        const isVisible = isDrcw || deExpanded;
                        if (!isVisible) return null;

                        if (isDrcw) {
                          return (
                            <td key={`de-${ci}-${idx}`} className={`border border-[#6ee7b7] ${DRCW_CELL} px-1.5 py-[3px] text-right tabular-nums text-[11px] font-semibold text-[#064e3b]`}>
                              {formatAmount(calc.drcwAmount)}
                            </td>
                          );
                        }

                        return (
                          <DeCcCell
                            key={`de-${ci}-${idx}`}
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
                        );
                      })}

                      {/* Project Overhead */}
                      <td className={`border border-[#a5b4fc] ${OH_CELL} px-1.5 py-[3px] text-right tabular-nums text-[11px] text-[#312e81]`}>
                        {formatAmount(calc.poAmount)}
                      </td>

                      {/* Employee Overhead */}
                      <td className={`border border-[#a5b4fc] ${OH_CELL} px-1.5 py-[3px] text-right tabular-nums text-[11px] text-[#312e81]`}>
                        {formatAmount(calc.eoAmount)}
                      </td>

                      {/* TEC */}
                      <td className={`border border-[#94a3b8] ${TEC_CELL} px-1.5 py-[3px] text-right tabular-nums text-[11px] font-semibold text-[#1e293b]`}>
                        {formatAmount(calc.tec)}
                      </td>

                      {/* Profit */}
                      <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] font-semibold ${calc.profit >= 0 ? "text-[#166534] bg-[#f0fdf4]" : "text-[#991b1b] bg-[#fef2f2]"}`}>
                        {formatAmount(calc.profit)}
                      </td>

                      {/* Profit % */}
                      <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] font-semibold ${calc.profitPct >= 0 ? "text-[#166534] bg-[#f0fdf4]" : "text-[#991b1b] bg-[#fef2f2]"}`}>
                        {calc.profitPct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}

            </tbody>

            {/* Sticky totals footer */}
            {items.length > 0 && (
              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-[#d6e6f2] font-semibold text-[11px]">
                  <td className={`${STICKY.sl} bg-[#d6e6f2] border border-gray-300`} />
                  <td className={`${STICKY.code} bg-[#d6e6f2] border border-gray-300`} />
                  <td className={`${STICKY.name} bg-[#d6e6f2] border border-gray-300 px-2 py-1.5 text-right`}>TOTAL</td>
                  <td className="border border-gray-300" colSpan={3} />
                  <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums">{formatAmount(totals.totalAmount)}</td>

                  {deCcColumns.map((c, ci) => {
                    const isDrcw    = ci === drcwIdx;
                    const isVisible = isDrcw || deExpanded;
                    if (!isVisible) return null;
                    return (
                      <td key={`tot-de-${ci}`} className={`border border-gray-300 px-2 py-1.5 text-right tabular-nums ${isDrcw ? "bg-[#a7f3d0]" : "bg-[#fef3c7]"}`}>
                        {isDrcw ? formatAmount(totals.totalDrcw) : formatAmount(totals.perColumn[ci] || 0)}
                      </td>
                    );
                  })}

                  <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums bg-[#e0e7ff]">{formatAmount(totals.totalPo)}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums bg-[#e0e7ff]">{formatAmount(totals.totalEo)}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right tabular-nums bg-[#e2e8f0]">{formatAmount(totals.totalTec)}</td>
                  <td className={`border border-gray-300 px-2 py-1.5 text-right tabular-nums ${totals.totalProfit >= 0 ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                    {formatAmount(totals.totalProfit)}
                  </td>
                  <td className={`border border-gray-300 px-2 py-1.5 text-right tabular-nums ${totals.totalProfitPct >= 0 ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                    {totals.totalProfitPct.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Project Overhead Modal ──────────────────────────────────────────── */}
      {poModalOpen && (
        <OverheadModal
          key={`po-${poModalOpen}`}
          open={poModalOpen}
          onClose={() => setPoModalOpen(false)}
          title="Project Overhead"
          ccRows={projectOverhead}
          orderValueExclGst={orderValueExclGst}
          disabled={disabled}
          onApply={(rows) => {
            setValue("projectOverhead", rows, { shouldDirty: true });
            setPoModalOpen(false);
          }}
        />
      )}

      {/* ── Employee Overhead Modal ─────────────────────────────────────────── */}
      {eoModalOpen && (
        <OverheadModal
          key={`eo-${eoModalOpen}`}
          open={eoModalOpen}
          onClose={() => setEoModalOpen(false)}
          title="Employee Overhead"
          ccRows={employeeOverhead}
          orderValueExclGst={orderValueExclGst}
          disabled={disabled}
          onApply={(rows) => {
            setValue("employeeOverhead", rows, { shouldDirty: true });
            setEoModalOpen(false);
          }}
        />
      )}
    </TooltipProvider>
  );
}

// ─── DeCcCell ─────────────────────────────────────────────────────────────────
// Editable Direct Expense CC allocation cell (sibling of DRCW)
function DeCcCell({ control, setValue, itemIndex, colIndex, orderQty, value, entries, disabled, ccCode, ccName, itemName }) {
  const [modalOpen, setModalOpen] = useState(false);
  const ccTotal    = Number(orderQty || 0) * Number(value || 0);
  const entryCount = entries.length;

  return (
    <td className={`border border-[#d97706] ${DE_CELL} p-0.5 align-top`}>
      <Controller
        control={control}
        name={`items.${itemIndex}.ccCodes.${colIndex}.ccValue`}
        render={({ field }) => (
          <AmountInput
            {...field}
            value={field.value ?? ""}
            disabled={disabled}
            placeholder="0.00"
            className={`w-full h-[24px] text-[11px] text-right px-1.5 rounded-sm border-0 outline-none focus-visible:ring-0 ${
              disabled ? "bg-[#fef3c7]/60 text-gray-500" : "bg-[#fffde7] focus:bg-white"
            }`}
          />
        )}
      />
      <div className="flex items-center justify-between pr-1 pt-[1px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className={`flex items-center gap-0.5 rounded px-0.5 py-[1px] text-[10px] transition-colors ${
                entryCount > 0 ? "text-amber-700 hover:text-amber-900" : disabled ? "invisible" : "text-gray-300 hover:text-gray-500"
              }`}
            >
              <ListPlus size={11} />
              {entryCount > 0 && <span className="tabular-nums font-semibold">{entryCount}</span>}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" variant="text">
            {entryCount > 0 ? `${entryCount} entr${entryCount === 1 ? "y" : "ies"} — click to ${disabled ? "view" : "edit"}` : "Add breakdown entries"}
          </TooltipContent>
        </Tooltip>
        <div className={`text-[10px] tabular-nums text-right ${Number(value || 0) > 0 ? "text-amber-700" : "text-transparent"}`}>
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
function CcEntriesModal({ open, onClose, entries, disabled, ccCode, ccName, itemName, onApply }) {
  const { tableRef } = useColumnResize();
  const [rows, setRows] = useState(() => entries.map((e) => ({ ...e })));

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const handleApply = () => {
    const cleaned = rows
      .filter((r) => (r.description || "").trim())
      .map((r, i) => ({ slNo: i + 1, description: (r.description || "").trim(), amount: Number(r.amount || 0) }));
    onApply(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-[640px] sm:max-w-[800px] p-0 gap-0" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="px-5 py-3 border-b bg-[#fffbeb]">
          <DialogTitle className="text-[14px] font-semibold text-[#78350f]">
            {ccCode}{ccName ? ` — ${ccName}` : ""} · Entries
          </DialogTitle>
          {itemName && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{itemName}</p>}
        </DialogHeader>

        <div className="overflow-auto max-h-[50vh] px-4 pt-3 pb-2">
          <table ref={tableRef} className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#fef3c7]">
                <th className="border border-[#d97706] px-2 py-1.5 text-center font-semibold w-[46px]">Sl.</th>
                <th className="border border-[#d97706] px-2 py-1.5 text-left font-semibold">Description</th>
                <th className="border border-[#d97706] px-2 py-1.5 text-right font-semibold w-[130px] min-w-[120px]">Amount</th>
                {!disabled && <th className="border border-[#d97706] px-2 py-1.5 w-[38px]" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={disabled ? 3 : 4} className="border border-gray-100 py-8 text-center text-gray-400 italic">
                    {disabled ? "No entries recorded" : "No entries yet — click Add Row below"}
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#fffde7]"}>
                  <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-500">{i + 1}</td>
                  <td className="border border-gray-200 px-1 py-[3px]">
                    {disabled ? (
                      <span className="block px-1.5 py-[3px] text-gray-700">{row.description}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.description || ""}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
                        placeholder="Enter description…"
                        className="w-full h-[26px] px-1.5 text-[12px] border border-gray-200 rounded-sm outline-none focus:border-[#d97706] bg-white"
                      />
                    )}
                  </td>
                  <td className="border border-gray-200 px-1 py-[3px]">
                    {disabled ? (
                      <span className="block text-right pr-1.5 py-[3px] tabular-nums text-gray-700">{formatAmount(row.amount)}</span>
                    ) : (
                      <AmountInput
                        value={row.amount ?? ""}
                        onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))}
                        placeholder="0.00"
                        className="w-full h-[26px] text-[12px] text-right px-1.5 border border-gray-200 rounded-sm outline-none focus:border-[#d97706] bg-white focus-visible:ring-0"
                      />
                    )}
                  </td>
                  {!disabled && (
                    <td className="border border-gray-200 px-1 py-[3px] text-center">
                      <button type="button" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 transition" title="Remove row">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-[#fef3c7] font-semibold">
                  <td colSpan={2} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">Total</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">{formatAmount(total)}</td>
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
              onClick={() => setRows((prev) => [...prev, { slNo: prev.length + 1, description: "", amount: "" }])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[#fef3c7] border border-[#d97706] rounded-sm font-medium hover:brightness-95 transition"
            >
              <Plus size={13} /> Add Row
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-100 transition">
              {disabled ? "Close" : "Cancel"}
            </button>
            {!disabled && (
              <button type="button" onClick={handleApply} className="px-4 py-1.5 text-[12px] bg-[#92400e] text-white rounded-sm hover:bg-[#78350f] transition font-medium">
                Apply
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── OverheadModal ────────────────────────────────────────────────────────────
// Modal for Project Overhead or Employee Overhead CC breakdown
function OverheadModal({ open, onClose, title, ccRows, orderValueExclGst, disabled, onApply }) {
  const { tableRef } = useColumnResize();
  const [rows, setRows] = useState(() => ccRows.map((r) => ({ ...r })));
  const ov = Number(orderValueExclGst || 0);
  const totalEstimated = rows.reduce((s, r) => s + Number(r.estimatedCost || 0), 0);
  const totalPercent   = ov > 0 ? totalEstimated / ov * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-[98vw] sm:max-w-[680px] md:max-w-[820px] lg:max-w-[1000px] xl:max-w-[1200px] p-0 gap-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="px-5 py-3 border-b bg-[#eef2ff]">
          <DialogTitle className="text-[14px] font-semibold text-[#312e81]">
            {title} — CC Code Breakdown
          </DialogTitle>
          <p className="text-[11px] text-[#4338ca] mt-0.5">
            Order Value (excl. GST): <span className="font-semibold">{formatAmount(ov)}</span>
            &nbsp;·&nbsp;Total %: <span className="font-bold text-[#312e81]">{totalPercent.toFixed(2)}%</span>
          </p>
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh] px-4 pt-3 pb-2">
          <table ref={tableRef} className="w-full border-collapse text-[12px]" style={{ minWidth: 520 }}>
            <thead>
              <tr className="bg-[#e0e7ff]">
                <th className="border border-[#818cf8] px-2 py-1.5 text-center font-semibold w-[44px] min-w-[44px]">Sl.</th>
                <th className="border border-[#818cf8] px-2 py-1.5 text-left font-semibold w-[90px] min-w-[80px]">CC Code</th>
                <th className="border border-[#818cf8] px-2 py-1.5 text-left font-semibold min-w-[140px]">CC Name</th>
                <th className="border border-[#818cf8] px-2 py-1.5 text-right font-semibold w-[160px] min-w-[130px] bg-[#fef9c3]">
                  Estimated Cost
                </th>
                <th className="border border-[#818cf8] px-2 py-1.5 text-right font-semibold w-[150px] min-w-[120px]">
                  Order Value
                </th>
                <th className="border border-[#818cf8] px-2 py-1.5 text-right font-semibold w-[90px] min-w-[80px]">
                  <div>%</div>
                  <div className="text-[10px] font-bold text-[#312e81]">{totalPercent.toFixed(2)}%</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-gray-100 py-8 text-center text-gray-400 italic">
                    No CC codes configured for this overhead group
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const est = Number(row.estimatedCost || 0);
                const pct = ov > 0 ? est / ov * 100 : 0;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f5f7ff]"}>
                    <td className="border border-gray-200 px-2 py-[4px] text-center text-gray-500">{i + 1}</td>
                    <td className="border border-gray-200 px-2 py-[4px] font-medium text-[#312e81]">{row.ccCode}</td>
                    <td className="border border-gray-200 px-2 py-[4px] text-gray-700">{row.ccName}</td>
                    <td className="border border-gray-200 px-1 py-[4px] bg-[#fef9c3]">
                      {disabled ? (
                        <span className="block text-right pr-1.5 py-[2px] tabular-nums font-medium">{formatAmount(est)}</span>
                      ) : (
                        <AmountInput
                          value={row.estimatedCost ?? ""}
                          onChange={(e) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, estimatedCost: e.target.value } : r))}
                          placeholder="0.00"
                          className="w-full h-[28px] text-[12px] text-right px-1.5 border border-[#ca8a04] rounded-sm outline-none focus:border-[#312e81] bg-[#fef9c3] focus-visible:ring-0"
                        />
                      )}
                    </td>
                    <td className="border border-gray-200 px-2 py-[4px] text-right tabular-nums text-gray-500">
                      {formatAmount(ov)}
                    </td>
                    <td className="border border-gray-200 px-2 py-[4px] text-right tabular-nums font-semibold text-[#312e81]">
                      {pct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-[#e0e7ff] font-semibold">
                  <td colSpan={3} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">Total</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums bg-[#fef9c3]">{formatAmount(totalEstimated)}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">{formatAmount(ov)}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] font-bold text-[#312e81]">{totalPercent.toFixed(2)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3 bg-slate-50">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-[12px] border border-gray-300 rounded-sm hover:bg-gray-100 transition">
            {disabled ? "Close" : "Cancel"}
          </button>
          {!disabled && (
            <button type="button" onClick={() => onApply(rows)} className="px-4 py-1.5 text-[12px] bg-[#312e81] text-white rounded-sm hover:bg-[#1e1b4b] transition font-medium">
              Apply
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
