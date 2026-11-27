"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileSearch } from "lucide-react";
import { formatAmount } from "@/helper/numberFormatter";

// ─── helpers ────────────────────────────────────────────────────────────────

function toAlpha(n) {
  let s = "";
  let i = n + 1;
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

function AmountCell({ value, zeroDisplay = "dash" }) {
  if (value == null || value === 0)
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  return <span className="tabular-nums">{formatAmount(Math.abs(value))}</span>;
}

function PercentCell({ value, grandTotal }) {
  if (!grandTotal || !value)
    return <span className="text-[#9ca3af]">—</span>;
  return (
    <span className="tabular-nums text-[#6b7280]">
      {((Math.abs(value) / Math.abs(grandTotal)) * 100).toFixed(2)}%
    </span>
  );
}

// flattenSection builds rows and collects groupIds with hierarchical order labels
function flattenSection(groups, prefix, onReconcile) {
  const rows = [];
  const groupIds = [];

  function addAccount(acc, depth, ancestors, labelParts, accIdx) {
    const isBankCash = !!acc._bankCashId;
    rows.push({
      id: `${prefix}_acc_${acc.ccId}_${ancestors[ancestors.length - 1] || "grp"}`,
      type: "account", depth, ancestors,
      label: acc.ccName, code: acc.ccCode,
      orderLabel: [...labelParts, accIdx + 1].join("."),
      net: acc.displayBalance != null ? acc.displayBalance : acc.net,
      plLinked: acc.plLinked,
      onReconcile: onReconcile && !acc._informational
        ? () => onReconcile(isBankCash ? "BankCash" : "CC", isBankCash ? acc._bankCashId : acc.ccId, `${acc.ccCode} - ${acc.ccName}`)
        : null,
    });
  }

  function addSubGroup(sg, depth, ancestors, labelParts) {
    const id = `${prefix}_sg_${sg.subGroupId}`;
    const orderLabel = labelParts.join(".");
    groupIds.push(id);
    rows.push({
      id, type: "subGroup", depth, ancestors,
      label: sg.subGroupName, code: sg.subGroupCode,
      orderLabel,
      total: sg.total,
    });
    const kids = [...ancestors, id];
    // child sub-groups continue numbering after accounts
    const accCount = (sg.accounts || []).length;
    (sg.children || []).forEach((c, ci) => addSubGroup(c, depth + 1, kids, [...labelParts, ci + 1]));
    (sg.accounts || []).forEach((acc, ai) => addAccount(acc, depth + 1, kids, labelParts, ai));
  }

  groups.forEach((grp, gi) => {
    const id = `${prefix}_grp_${grp.groupId}`;
    const groupLabel = toAlpha(gi);
    groupIds.push(id);
    rows.push({ id, type: "group", depth: 0, ancestors: [], label: grp.groupName, orderLabel: groupLabel, total: grp.total });
    const kids = [id];
    (grp.subGroups || []).forEach((sg, si) => addSubGroup(sg, 1, kids, [groupLabel, si + 1]));
    (grp.accounts || []).forEach((acc, ai) => addAccount(acc, 1, kids, [groupLabel], ai));
  });

  return { rows, groupIds };
}

// ─── section colour tokens ────────────────────────────────────────────────────
const INCOME = {
  header: "#14532d",
  groupRow: "#f0fdf4",
  subGroupRow: "#f7fef9",
  totalBg: "#166534",
};
const EXPENSE = {
  header: "#7f1d1d",
  groupRow: "#fff1f2",
  subGroupRow: "#fff7f7",
  totalBg: "#991b1b",
};

// ─── main component ───────────────────────────────────────────────────────────

export default function ProfitLossCombinedTable({
  incomeGroups = [],
  expenseGroups = [],
  totalIncome = 0,
  totalExpense = 0,
  onReconcile,
  showPercent = true,
  zeroDisplay = "dash",
}) {
  const { rows: incomeRows, groupIds: incomeIds } = useMemo(
    () => flattenSection(incomeGroups, "inc", onReconcile),
    [incomeGroups, onReconcile]
  );
  const { rows: expenseRows, groupIds: expenseIds } = useMemo(
    () => flattenSection(expenseGroups, "exp", onReconcile),
    [expenseGroups, onReconcile]
  );

  // Separate collapsed sets per section
  const [incomeCollapsed, setIncomeCollapsed] = useState(() => new Set());
  const [expenseCollapsed, setExpenseCollapsed] = useState(() => new Set());

  const toggle = useCallback((id, section) => {
    const setter = section === "income" ? setIncomeCollapsed : setExpenseCollapsed;
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const incomeAllCollapsed = incomeIds.length > 0 && incomeIds.every((id) => incomeCollapsed.has(id));
  const expenseAllCollapsed = expenseIds.length > 0 && expenseIds.every((id) => expenseCollapsed.has(id));

  const expandIncome   = () => setIncomeCollapsed(new Set());
  const collapseIncome = () => setIncomeCollapsed(new Set(incomeIds));
  const expandExpense   = () => setExpenseCollapsed(new Set());
  const collapseExpense = () => setExpenseCollapsed(new Set(expenseIds));

  const visibleIncome = useMemo(
    () => incomeRows.filter((r) => !r.ancestors.some((a) => incomeCollapsed.has(a))),
    [incomeRows, incomeCollapsed]
  );
  const visibleExpense = useMemo(
    () => expenseRows.filter((r) => !r.ancestors.some((a) => expenseCollapsed.has(a))),
    [expenseRows, expenseCollapsed]
  );

  const net = totalIncome - totalExpense;
  const isProfit = net >= 0;

  const colCount = 2 + 1 + (showPercent ? 1 : 0) + (onReconcile ? 1 : 0);

  function renderRows(rows, section, collapsed) {
    const C = section === "income" ? INCOME : EXPENSE;
    return rows.map((row, idx) => {
      const isGroup = row.type === "group";
      const isSubGroup = row.type === "subGroup";
      const isGroupish = isGroup || isSubGroup;
      const indent = row.depth * 14;
      const isCollapsed = collapsed.has(row.id);

      const bg = isGroup
        ? C.groupRow
        : isSubGroup
        ? C.subGroupRow
        : idx % 2 === 0 ? "#ffffff" : "#fafbfc";

      return (
        <tr
          key={row.id}
          className="border-b border-[#e5e7eb]"
          style={{
            background: bg,
            height: isGroupish ? 30 : 27,
            cursor: isGroupish ? "pointer" : "default",
          }}
          onClick={isGroupish ? () => toggle(row.id, section) : undefined}
        >
          {/* Code / order-label column */}
          <td className="px-2 py-[3px] text-[10.5px] font-mono" onClick={isGroupish ? (e) => e.stopPropagation() : undefined}>
            {isGroupish ? (
              <span className={[
                "px-1 py-0.5 rounded text-[10px] font-bold",
                isGroup
                  ? "bg-[#1c3a5e] text-white"
                  : row.depth === 1
                  ? "bg-[#d6e6f2] text-[#1c3a5e]"
                  : "bg-gray-100 text-gray-500",
              ].join(" ")}>
                {row.orderLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {row.orderLabel && (
                  <span className="text-[9px] text-[#9ca3af] font-mono shrink-0">{row.orderLabel}</span>
                )}
                <span className="text-[#6b7280]">{row.code || ""}</span>
              </span>
            )}
          </td>

          {/* Particulars */}
          <td className="px-2 py-[3px]" style={{ paddingLeft: `${8 + indent}px` }}>
            <span className="flex items-center gap-1">
              {isGroupish && (
                <span className="shrink-0 text-gray-400">
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
              )}
              <span className={isGroupish ? "font-semibold text-[#1f2937]" : "text-[#374151]"}>
                {row.label}
                {row.plLinked && (
                  <span className="ml-1 text-[9px] px-1 py-0 bg-[#ede9fe] text-[#6d28d9] rounded-sm font-medium">PL</span>
                )}
              </span>
            </span>
          </td>

          {/* Amount */}
          <td className="px-2 py-[3px] text-right font-medium tabular-nums">
            {isGroupish ? (
              <span className="font-semibold text-[#1f2937]">
                <AmountCell value={row.total} zeroDisplay={zeroDisplay} />
              </span>
            ) : (
              <AmountCell value={row.net} zeroDisplay={zeroDisplay} />
            )}
          </td>

          {showPercent && (
            <td className="px-2 py-[3px] text-right text-[11px]">
              <PercentCell value={isGroupish ? row.total : row.net} grandTotal={totalIncome} />
            </td>
          )}

          {onReconcile && (
            <td className="px-2 py-[3px] text-center" onClick={(e) => e.stopPropagation()}>
              {row.onReconcile && (
                <button
                  onClick={row.onReconcile}
                  title="View transactions"
                  className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a] transition-colors"
                >
                  <FileSearch size={13} />
                </button>
              )}
            </td>
          )}
        </tr>
      );
    });
  }

  function SectionToggleBtn({ allCollapsed, onExpand, onCollapse }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); allCollapsed ? onExpand() : onCollapse(); }}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] text-white bg-white/10 hover:bg-white/20 transition-colors rounded-sm"
      >
        {allCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
        {allCollapsed ? "Expand All" : "Collapse All"}
      </button>
    );
  }

  return (
    <div className="border border-[#d1d5db] overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-[#f3f4f6] text-[10.5px] text-[#6b7280] border-b border-[#d1d5db]">
            <th className="px-2 py-[5px] text-left font-medium w-[70px]">Code</th>
            <th className="px-2 py-[5px] text-left font-medium">Particulars</th>
            <th className="px-2 py-[5px] text-right font-medium w-[120px]">Amount</th>
            {showPercent && <th className="px-2 py-[5px] text-right font-medium w-[62px]">%</th>}
            {onReconcile && <th className="px-2 py-[5px] w-[28px]"></th>}
          </tr>
        </thead>

        <tbody>
          {/* ══ INCOME SECTION HEADER ══ */}
          <tr style={{ background: INCOME.header, height: 32 }}>
            <td colSpan={colCount} className="px-3 py-[6px]">
              <div className="flex items-center justify-between">
                <span className="text-white text-[12.5px] font-semibold tracking-[0.01em]">
                  Income / Revenue
                </span>
                {incomeIds.length > 0 && (
                  <SectionToggleBtn
                    allCollapsed={incomeAllCollapsed}
                    onExpand={expandIncome}
                    onCollapse={collapseIncome}
                  />
                )}
              </div>
            </td>
          </tr>

          {renderRows(visibleIncome, "income", incomeCollapsed)}

          {/* Total Income */}
          <tr
            style={{ background: INCOME.totalBg, height: 32, cursor: "pointer" }}
            onClick={incomeAllCollapsed ? expandIncome : collapseIncome}
            title={incomeAllCollapsed ? "Expand income" : "Collapse income"}
          >
            <td className="px-2 py-[5px]">
              <span className="text-white/60 text-[10px]">
                {incomeAllCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
              </span>
            </td>
            <td className="px-2 py-[5px] text-white text-[12.5px] font-semibold">Total Income</td>
            <td className="px-2 py-[5px] text-right text-white tabular-nums text-[13px] font-bold">
              {formatAmount(Math.abs(totalIncome))}
            </td>
            {showPercent && (
              <td className="px-2 py-[5px] text-right text-white text-[11px]">100.00%</td>
            )}
            {onReconcile && <td></td>}
          </tr>

          {/* spacer */}
          <tr style={{ height: 6, background: "#f8f9fa" }}>
            <td colSpan={colCount} />
          </tr>

          {/* ══ EXPENSES SECTION HEADER ══ */}
          <tr style={{ background: EXPENSE.header, height: 32 }}>
            <td colSpan={colCount} className="px-3 py-[6px]">
              <div className="flex items-center justify-between">
                <span className="text-white text-[12.5px] font-semibold tracking-[0.01em]">
                  Expenses
                </span>
                {expenseIds.length > 0 && (
                  <SectionToggleBtn
                    allCollapsed={expenseAllCollapsed}
                    onExpand={expandExpense}
                    onCollapse={collapseExpense}
                  />
                )}
              </div>
            </td>
          </tr>

          {renderRows(visibleExpense, "expense", expenseCollapsed)}

          {/* Total Expenses */}
          <tr
            style={{ background: EXPENSE.totalBg, height: 32, cursor: "pointer" }}
            onClick={expenseAllCollapsed ? expandExpense : collapseExpense}
            title={expenseAllCollapsed ? "Expand expenses" : "Collapse expenses"}
          >
            <td className="px-2 py-[5px]">
              <span className="text-white/60 text-[10px]">
                {expenseAllCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
              </span>
            </td>
            <td className="px-2 py-[5px] text-white text-[12.5px] font-semibold">Total Expenses</td>
            <td className="px-2 py-[5px] text-right text-white tabular-nums text-[13px] font-bold">
              {formatAmount(Math.abs(totalExpense))}
            </td>
            {showPercent && (
              <td className="px-2 py-[5px] text-right text-white text-[11px]">
                {totalIncome
                  ? `${((Math.abs(totalExpense) / Math.abs(totalIncome)) * 100).toFixed(2)}%`
                  : "—"}
              </td>
            )}
            {onReconcile && <td></td>}
          </tr>

          {/* spacer */}
          <tr style={{ height: 6, background: "#f8f9fa" }}>
            <td colSpan={colCount} />
          </tr>

          {/* ══ NET PROFIT / LOSS ══ */}
          <tr
            style={{
              background: isProfit ? "#dcfce7" : "#fee2e2",
              height: 36,
              borderTop: `2px solid ${isProfit ? "#16a34a" : "#dc2626"}`,
            }}
          >
            <td className="px-2 py-[5px]"></td>
            <td className="px-2 py-[5px]">
              <span className="text-[13px] font-bold" style={{ color: isProfit ? "#15803d" : "#b91c1c" }}>
                {isProfit ? "Net Profit" : "Net Loss"}
              </span>
            </td>
            <td className="px-2 py-[5px] text-right tabular-nums text-[14px] font-bold"
              style={{ color: isProfit ? "#15803d" : "#b91c1c" }}
            >
              {formatAmount(Math.abs(net))}
            </td>
            {showPercent && (
              <td className="px-2 py-[5px] text-right text-[11px] text-[#6b7280]">
                {totalIncome
                  ? `${((Math.abs(net) / Math.abs(totalIncome)) * 100).toFixed(2)}%`
                  : "—"}
              </td>
            )}
            {onReconcile && <td></td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
