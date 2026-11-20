"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileSearch } from "lucide-react";
import { formatAmount } from "@/helper/numberFormatter";

function flattenTree(groups, onReconcile) {
  const rows = [];
  const groupIds = [];

  function addSubGroup(sg, depth, ancestors) {
    const id = `sg_${sg.subGroupId}`;
    groupIds.push(id);
    rows.push({
      id,
      type: "subGroup",
      depth,
      ancestors,
      label: sg.subGroupName,
      code: sg.subGroupCode,
      total: sg.total,
    });

    const childAncestors = [...ancestors, id];

    if (sg.children) {
      sg.children.forEach((child) => addSubGroup(child, depth + 1, childAncestors));
    }

    if (sg.accounts) {
      sg.accounts.forEach((acc) => {
        const isBankCash = !!acc._bankCashId;
        const reconType = isBankCash ? "BankCash" : "CC";
        const reconId = isBankCash ? acc._bankCashId : acc.ccId;
        rows.push({
          id: `acc_${acc.ccId}`,
          type: "account",
          depth: depth + 1,
          ancestors: childAncestors,
          label: acc.ccName,
          code: acc.ccCode,
          ccId: acc.ccId,
          debit: acc.debit,
          credit: acc.credit,
          net: acc.displayBalance != null ? acc.displayBalance : acc.net,
          plLinked: acc.plLinked,
          _informational: acc._informational,
          onReconcile: (onReconcile && !acc._informational) ? () => onReconcile(reconType, reconId, `${acc.ccCode} - ${acc.ccName}`) : null,
        });
      });
    }
  }

  groups.forEach((grp) => {
    const grpId = `grp_${grp.groupId}`;
    groupIds.push(grpId);
    rows.push({
      id: grpId,
      type: "group",
      depth: 0,
      ancestors: [],
      label: grp.groupName,
      total: grp.total,
      groupId: grp.groupId,
    });

    const grpAncestors = [grpId];

    if (grp.subGroups) {
      grp.subGroups.forEach((sg) => addSubGroup(sg, 1, grpAncestors));
    }

    if (grp.accounts) {
      grp.accounts.forEach((acc) => {
        const isBankCash = !!acc._bankCashId;
        const reconType = isBankCash ? "BankCash" : "CC";
        const reconId = isBankCash ? acc._bankCashId : acc.ccId;
        rows.push({
          id: `acc_${acc.ccId}`,
          type: "account",
          depth: 1,
          ancestors: grpAncestors,
          label: acc.ccName,
          code: acc.ccCode,
          ccId: acc.ccId,
          debit: acc.debit,
          credit: acc.credit,
          net: acc.displayBalance != null ? acc.displayBalance : acc.net,
          plLinked: acc.plLinked,
          _informational: acc._informational,
          onReconcile: (onReconcile && !acc._informational) ? () => onReconcile(reconType, reconId, `${acc.ccCode} - ${acc.ccName}`) : null,
        });
      });
    }
  });

  return { rows, groupIds };
}

function AmountCell({ value, zeroDisplay = "dash", className = "" }) {
  if (value == null) {
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  }
  if (value === 0) {
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  }
  return (
    <span className={`tabular-nums ${className}`}>
      {formatAmount(Math.abs(value))}
    </span>
  );
}

function DrCrCell({ value, side, zeroDisplay = "dash" }) {
  if (value == null) {
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  }
  if (value === 0) {
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  }
  // For asset side: positive net = Dr, negative = Cr
  // For liability side: positive net = Cr, negative = Dr
  let label;
  if (side === "asset") {
    label = value > 0 ? "Dr" : "Cr";
  } else {
    label = value > 0 ? "Cr" : "Dr";
  }
  return (
    <span className="tabular-nums">
      {formatAmount(Math.abs(value))}{" "}
      <span className="text-[10px] text-[#6b7280]">{label}</span>
    </span>
  );
}

function PercentCell({ value, grandTotal }) {
  if (grandTotal == null || grandTotal === 0 || value == null || value === 0) {
    return <span className="text-[#9ca3af]">{"—"}</span>;
  }
  const pct = (Math.abs(value) / Math.abs(grandTotal)) * 100;
  return (
    <span className="tabular-nums text-[#6b7280]">
      {pct.toFixed(2)}%
    </span>
  );
}

export default function AccountingTreeTable({
  groups = [],
  title,
  headerBg = "#1b2f3a",
  columns = ["net"],
  columnLabels = { net: "Amount", debit: "Debit", credit: "Credit" },
  grandTotal,
  grandTotalLabel = "Total",
  onReconcile,
  extraRows,
  showPercent = false,
  percentBase,
  zeroDisplay = "dash",
  side,
}) {
  const { rows, groupIds } = useMemo(() => flattenTree(groups, onReconcile), [groups, onReconcile]);

  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allCollapsed = groupIds.length > 0 && collapsed.size === groupIds.length;
  const collapseAll = () => setCollapsed(new Set(groupIds));
  const expandAll = () => setCollapsed(new Set());

  const visible = useMemo(
    () => rows.filter((r) => !r.ancestors.some((a) => collapsed.has(a))),
    [rows, collapsed],
  );

  const showDebitCredit = columns.includes("debit") || columns.includes("credit");
  const pctBase = percentBase ?? grandTotal;

  return (
    <div className="border border-[#d1d5db] overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-[7px] text-white text-[12.5px] font-semibold tracking-[0.01em] flex items-center justify-between"
        style={{ background: headerBg }}
      >
        <span>{title}</span>
        {groupIds.length > 0 && (
          <button
            onClick={allCollapsed ? expandAll : collapseAll}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] bg-white/10 hover:bg-white/20 transition-colors"
          >
            {allCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
            {allCollapsed ? "Expand" : "Collapse"}
          </button>
        )}
      </div>

      {/* Column sub-header */}
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-[#f3f4f6] text-[10.5px] text-[#6b7280] border-b border-[#d1d5db]">
            <th className="px-2 py-[5px] text-left font-medium w-[70px]">Code</th>
            <th className="px-2 py-[5px] text-left font-medium">Particulars</th>
            {showDebitCredit && (
              <>
                <th className="px-2 py-[5px] text-right font-medium w-[100px]">Debit</th>
                <th className="px-2 py-[5px] text-right font-medium w-[100px]">Credit</th>
              </>
            )}
            <th className="px-2 py-[5px] text-right font-medium w-[110px]">
              {columns.includes("net") ? (columnLabels.net || "Amount") : "Amount"}
            </th>
            {showPercent && (
              <th className="px-2 py-[5px] text-right font-medium w-[60px]">%</th>
            )}
            {onReconcile && <th className="px-2 py-[5px] w-[28px]"></th>}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => {
            const isGroupish = row.type === "group" || row.type === "subGroup";
            const isTopGroup = row.type === "group";
            const indent = row.depth * 14;

            const rowBg = isTopGroup
              ? "bg-[#eef1f4]"
              : isGroupish
                ? "bg-[#f5f7f9]"
                : idx % 2 === 0 ? "bg-white" : "bg-[#fafbfc]";

            return (
              <tr
                key={row.id}
                className={`border-b border-[#e5e7eb] ${rowBg} ${!isGroupish ? "hover:bg-[#f0f4f8]" : ""}`}
                style={{ height: isGroupish ? 30 : 27 }}
              >
                {/* Code */}
                <td className="px-2 py-[3px] text-[10.5px] text-[#6b7280] font-mono">
                  {row.code || ""}
                </td>

                {/* Particulars */}
                <td className="px-2 py-[3px]" style={{ paddingLeft: `${8 + indent}px` }}>
                  <span className="flex items-center gap-1">
                    {isGroupish && (
                      <button
                        onClick={() => toggle(row.id)}
                        className="shrink-0 p-0.5 hover:bg-black/5 transition-colors"
                      >
                        {collapsed.has(row.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                    <span className={isGroupish ? "font-semibold text-[#1f2937]" : "text-[#374151]"}>
                      {row.label}
                      {row.plLinked && (
                        <span className="ml-1 text-[9px] px-1 py-0 bg-[#ede9fe] text-[#6d28d9] rounded-sm font-medium">PL</span>
                      )}
                    </span>
                  </span>
                </td>

                {/* Debit / Credit */}
                {showDebitCredit && (
                  <>
                    <td className="px-2 py-[3px] text-right">
                      {isGroupish ? "" : <AmountCell value={row.debit} zeroDisplay={zeroDisplay} className="text-[#166534]" />}
                    </td>
                    <td className="px-2 py-[3px] text-right">
                      {isGroupish ? "" : <AmountCell value={row.credit} zeroDisplay={zeroDisplay} className="text-[#991b1b]" />}
                    </td>
                  </>
                )}

                {/* Net / Total */}
                <td className="px-2 py-[3px] text-right font-medium tabular-nums">
                  {isGroupish ? (
                    <span className="font-semibold text-[#1f2937]">
                      {side ? <DrCrCell value={row.total} side={side} zeroDisplay={zeroDisplay} /> : <AmountCell value={row.total} zeroDisplay={zeroDisplay} />}
                    </span>
                  ) : (
                    side ? <DrCrCell value={row.net} side={side} zeroDisplay={zeroDisplay} /> : <AmountCell value={row.net} zeroDisplay={zeroDisplay} />
                  )}
                </td>

                {/* Percent */}
                {showPercent && (
                  <td className="px-2 py-[3px] text-right text-[11px]">
                    <PercentCell
                      value={isGroupish ? row.total : row.net}
                      grandTotal={pctBase}
                    />
                  </td>
                )}

                {/* Reconcile */}
                {onReconcile && (
                  <td className="px-2 py-[3px] text-center">
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
          })}

          {/* Extra rows (vendors, banks, PL result, etc.) */}
          {extraRows?.map((er, i) => (
            <ExtraRowGroup
              key={`extra_${i}`}
              er={er}
              showDebitCredit={showDebitCredit}
              showPercent={showPercent}
              zeroDisplay={zeroDisplay}
              pctBase={pctBase}
              onReconcile={onReconcile}
              side={side}
            />
          ))}

          {/* Grand total — accounting double-line convention */}
          {grandTotal != null && (
            <tr className="bg-[#1b2f3a] text-white font-semibold" style={{ height: 32 }}>
              <td className="px-2 py-[5px]"></td>
              <td className="px-2 py-[5px] text-[12.5px]">{grandTotalLabel}</td>
              {showDebitCredit && (
                <>
                  <td className="px-2 py-[5px]"></td>
                  <td className="px-2 py-[5px]"></td>
                </>
              )}
              <td className="px-2 py-[5px] text-right tabular-nums text-[13px] font-bold">
                {formatAmount(Math.abs(grandTotal))}
                {side && grandTotal !== 0 && (
                  <span className="text-[10px] ml-1 opacity-80">
                    {side === "asset" ? (grandTotal > 0 ? "Dr" : "Cr") : (grandTotal > 0 ? "Cr" : "Dr")}
                  </span>
                )}
              </td>
              {showPercent && (
                <td className="px-2 py-[5px] text-right text-[11px]">100.00%</td>
              )}
              {onReconcile && <td className="px-2 py-[5px]"></td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExtraRowGroup({ er, showDebitCredit, showPercent, zeroDisplay, pctBase, onReconcile, side }) {
  const [open, setOpen] = useState(false);
  const colCount = 2 + (showDebitCredit ? 2 : 0) + 1 + (showPercent ? 1 : 0) + (onReconcile ? 1 : 0);

  return (
    <>
      {/* Parent row */}
      <tr className={`border-b border-[#e5e7eb] ${er.bgCls || "bg-[#f5f7f9]"}`} style={{ height: 28 }}>
        <td className="px-2 py-[3px] text-[10.5px] text-[#6b7280] font-mono">{er.code || ""}</td>
        <td className="px-2 py-[3px]" style={{ paddingLeft: `${8 + (er.indent || 0)}px` }}>
          {er.expandable ? (
            <button
              onClick={() => setOpen((p) => !p)}
              className="flex items-center gap-1 font-medium text-[#374151]"
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {er.label}
              {er.details?.length > 0 && (
                <span className="text-[10px] text-[#9ca3af] font-normal">({er.details.length})</span>
              )}
            </button>
          ) : (
            <span className="font-medium text-[#374151]">{er.label}</span>
          )}
        </td>
        {showDebitCredit && (
          <>
            <td className="px-2 py-[3px]"></td>
            <td className="px-2 py-[3px]"></td>
          </>
        )}
        <td className="px-2 py-[3px] text-right font-semibold tabular-nums">
          {side ? <DrCrCell value={er.balance || er.net} side={side} zeroDisplay={zeroDisplay} /> : <AmountCell value={er.balance || er.net} zeroDisplay={zeroDisplay} />}
        </td>
        {showPercent && (
          <td className="px-2 py-[3px] text-right text-[11px]">
            <PercentCell value={er.balance || er.net} grandTotal={pctBase} />
          </td>
        )}
        {onReconcile && (
          <td className="px-2 py-[3px] text-center">
            {er.onReconcile && (
              <button
                onClick={er.onReconcile}
                title="View transactions"
                className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a] transition-colors"
              >
                <FileSearch size={13} />
              </button>
            )}
          </td>
        )}
      </tr>

      {/* Expanded detail rows */}
      {open && er.details?.map((d, i) => (
        <tr key={`detail_${i}`} className="border-b border-[#f0f0f0] bg-[#fafbfc] hover:bg-[#f0f4f8]" style={{ height: 26 }}>
          <td className="px-2 py-[2px] text-[10px] text-[#9ca3af] font-mono pl-4">{d.code}</td>
          <td className="px-2 py-[2px] text-[11px] text-[#4b5563]" style={{ paddingLeft: 28 }}>{d.name}</td>
          {showDebitCredit && (
            <>
              <td className="px-2 py-[2px]"></td>
              <td className="px-2 py-[2px]"></td>
            </>
          )}
          <td className="px-2 py-[2px] text-right tabular-nums text-[11px] font-medium text-[#374151]">
            {formatAmount(Math.abs(d.balance))}
            {side && d.balance !== 0 && (
              <span className="text-[10px] text-[#6b7280] ml-0.5">
                {side === "asset" ? (d.balance > 0 ? "Dr" : "Cr") : (d.balance > 0 ? "Cr" : "Dr")}
              </span>
            )}
          </td>
          {showPercent && <td className="px-2 py-[2px]"></td>}
          {onReconcile && (
            <td className="px-2 py-[2px] text-center">
              {d.id && (
                <button
                  onClick={() => onReconcile(d.accountType || "Vendor", d.id, `${d.code} - ${d.name}`)}
                  title="View transactions"
                  className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a] transition-colors"
                >
                  <FileSearch size={11} />
                </button>
              )}
            </td>
          )}
        </tr>
      ))}
    </>
  );
}
