"use client";

/**
 * AccountingJournalTable
 * Generic DR/CR accounting journal display — reusable across Sale Invoice,
 * Purchase Invoice, Purchase Voucher and other Finance modules.
 *
 * Props
 *   debtorName    string    — label for the DR row (debtor / party name)
 *   entries       Array<{ ccCode, ccName, amount }>  — CR entries
 *   totalDr       number    — total debit amount
 *   totalCr       number    — total credit amount (should equal totalDr)
 *   disabled      bool      — disables interactive elements
 *
 * Bulk-select props (optional — only used in Sale Invoice context)
 *   sources       Array<{ certifiedBillId }>  — certified bills in the invoice
 *   selections    {}  — { [certifiedBillId_ccCode]: { checked } }
 *   onBulkToggle  (ccCode, checked) => void
 */

import { ACC } from "./accountTheme";
import { formatAmount } from "@/helper/numberFormatter";
import { useColumnResize } from "@/hooks/useColumnResize";

export default function AccountingJournalTable({
  debtorName   = "—",
  entries      = [],
  totalDr      = 0,
  totalCr      = 0,
  disabled     = false,
  sources      = [],
  selections   = {},
  onBulkToggle,
  // creditorMode: CR row (vendor/creditor) first; entries are DR rows
  creditorMode = false,
  // onToggle(toggleKey, checked): optional — adds a Select column to creditorMode DR rows
  onToggle,
  emptyText    = "Select certified bills to generate accounting entries",
}) {
  const { tableRef } = useColumnResize();
  const isBalanced    = Math.abs(totalDr - totalCr) < 0.01;
  const hasData       = totalDr > 0 || totalCr > 0 || entries.length > 0;
  const hasBulkToggle = !!onBulkToggle && sources.length > 0;
  const hasToggle     = creditorMode && !!onToggle && hasData;

  const isBulkChecked = (ccCode) =>
    sources.length > 0 &&
    sources.every((s) => selections[`${s.certifiedBillId}_${ccCode}`]?.checked);

  const colSpan = hasBulkToggle ? 5 : hasToggle ? 5 : 4;

  return (
    <div className="mb-4">
      {/* Header */}
      <div className={`px-3 py-1.5 flex items-center justify-between ${ACC.basicHeader}`}>
        <span className={ACC.sectionTitle}>Accounting Journal:</span>
        {hasData && !isBalanced && (
          <span className="text-[11px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">
            ⚠ Unbalanced — DR ≠ CR
          </span>
        )}
        {hasData && isBalanced && (
          <span className="text-[11px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">
            ✓ Balanced
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full border-collapse text-[12px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold w-[70px]">
                DR / CR
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-left font-semibold">
                CC Name / Party
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[130px]">
                Dr Amount
              </th>
              <th className="border border-[#b0b0b0] px-2 py-1.5 text-right font-semibold w-[130px]"
                {...(!hasBulkToggle && !hasToggle ? { "data-col-resize-last": "true" } : {})}>
                Cr Amount
              </th>
              {hasBulkToggle && (
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-center font-semibold w-[70px]" data-col-resize-last="true">
                  Select All
                </th>
              )}
              {hasToggle && (
                <th className="border border-[#b0b0b0] px-2 py-1.5 text-center font-semibold w-[60px]" data-col-resize-last="true">
                  Select
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {creditorMode ? (
              <>
                {/* CR row — creditor/vendor (first, fixed) */}
                {totalCr > 0 && (
                  <tr className="bg-[#f0fbf0]">
                    <td className="border border-[#d0d0d0] px-2 py-1.5 font-semibold text-[#3a6a2a]">
                      CR
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-[#3a6a2a] font-medium">
                      {debtorName || "—"}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-gray-400">
                      —
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-semibold text-[#3a6a2a]">
                      {formatAmount(totalCr)}
                    </td>
                    {hasBulkToggle && <td className="border border-[#d0d0d0] px-2 py-1.5" />}
                    {hasToggle     && <td className="border border-[#d0d0d0] px-2 py-1.5" />}
                  </tr>
                )}

                {/* DR rows — one per entry (CC codes + GST) */}
                {entries.map((entry, idx) => {
                  const isSelected = entry.isSelected !== false;
                  if (disabled && !isSelected) return null;
                  const rowBg = isSelected
                    ? (idx % 2 === 0 ? "bg-[#eef4fb]" : "bg-[#e6f0f8]")
                    : "bg-gray-50 opacity-50";
                  return (
                    <tr key={`${entry.ccCode}_${idx}`} className={rowBg}>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 font-semibold text-[#1c3a5e]">
                        DR
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5">
                        <span className="text-gray-500 mr-1">[{entry.ccCode}]</span>
                        {entry.ccName}
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-semibold text-[#1c3a5e]">
                        {isSelected && entry.amount > 0 ? formatAmount(entry.amount) : "—"}
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-gray-400">
                        —
                      </td>
                      {hasBulkToggle && <td className="border border-[#d0d0d0] px-2 py-1.5" />}
                      {hasToggle && (
                        <td className="border border-[#d0d0d0] px-2 py-1.5 text-center">
                          {entry.toggleable ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => onToggle(entry.toggleKey ?? entry.ccCode, e.target.checked)}
                              className="h-3.5 w-3.5 accent-blue-600 cursor-pointer"
                            />
                          ) : (
                            <span className="text-gray-300 text-[10px]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </>
            ) : (
              <>
                {/* DR row — debtor */}
                {totalDr > 0 && (
                  <tr className="bg-[#eef4fb]">
                    <td className="border border-[#d0d0d0] px-2 py-1.5 font-semibold text-[#1c3a5e]">
                      DR
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-[#1c3a5e] font-medium">
                      {debtorName || "—"}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-semibold text-[#1c3a5e]">
                      {formatAmount(totalDr)}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-gray-400">
                      —
                    </td>
                    {hasBulkToggle && <td className="border border-[#d0d0d0] px-2 py-1.5" />}
                  </tr>
                )}

                {/* CR rows — one per entry */}
                {entries.map((entry, idx) => {
                  const bulkChecked = hasBulkToggle ? isBulkChecked(entry.ccCode) : false;
                  const isSelected  = entry.isSelected !== false;
                  if (disabled && !isSelected) return null;
                  const rowBg = isSelected
                    ? (idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]")
                    : "bg-gray-50 opacity-50";
                  return (
                    <tr key={`${entry.ccCode}_${idx}`} className={rowBg}>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 font-semibold text-[#5a7a3a]">
                        CR
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5">
                        <span className="text-gray-500 mr-1">[{entry.ccCode}]</span>
                        {entry.ccName}
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-gray-400">
                        —
                      </td>
                      <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-semibold text-[#3a5a2a]">
                        {isSelected && entry.amount > 0 ? formatAmount(entry.amount) : "—"}
                      </td>
                      {hasBulkToggle && (
                        <td className="border border-[#d0d0d0] px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={bulkChecked}
                            onChange={(e) => !disabled && onBulkToggle(entry.ccCode, e.target.checked)}
                            disabled={disabled}
                            title={`Select all ${entry.ccCode} entries in breakdown`}
                            className="h-3.5 w-3.5 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </>
            )}

            {/* Empty state */}
            {!hasData && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="border border-[#d0d0d0] px-3 py-4 text-center text-gray-400 italic text-[12px]"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>

          {/* Totals footer */}
          {hasData && (
            <tfoot>
              <tr className={ACC.tableHead}>
                <td className="border border-[#b0b0b0] px-2 py-1.5 font-bold" colSpan={2}>
                  TOTAL
                </td>
                <td className={`border border-[#b0b0b0] px-2 py-1.5 text-right font-bold ${isBalanced ? "text-[#1c3a5e]" : "text-red-600"}`}>
                  {formatAmount(totalDr)}
                </td>
                <td className={`border border-[#b0b0b0] px-2 py-1.5 text-right font-bold ${isBalanced ? "text-[#3a5a2a]" : "text-red-600"}`}>
                  {formatAmount(totalCr)}
                </td>
                {hasBulkToggle && <td className="border border-[#b0b0b0] px-2 py-1.5" />}
                {hasToggle && <td className="border border-[#b0b0b0] px-2 py-1.5" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {hasBulkToggle && entries.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1 px-1">
          Checking "Select All" on a CR row selects that entry for every bill in the breakdown below.
        </p>
      )}
    </div>
  );
}
