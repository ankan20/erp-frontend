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
          net: acc.net,
          plLinked: acc.plLinked,
          onReconcile: onReconcile ? () => onReconcile("CC", acc.ccId, `${acc.ccCode} - ${acc.ccName}`) : null,
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
          net: acc.net,
          plLinked: acc.plLinked,
          onReconcile: onReconcile ? () => onReconcile("CC", acc.ccId, `${acc.ccCode} - ${acc.ccName}`) : null,
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
      {formatAmount(value)}
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
                      <AmountCell value={row.total} zeroDisplay={zeroDisplay} />
                    </span>
                  ) : (
                    <AmountCell value={row.net} zeroDisplay={zeroDisplay} />
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
            <tr key={`extra_${i}`} className={`border-b border-[#e5e7eb] ${er.bgCls || "bg-[#f5f7f9]"}`} style={{ height: 28 }}>
              <td className="px-2 py-[3px] text-[10.5px] text-[#6b7280] font-mono">{er.code || ""}</td>
              <td className="px-2 py-[3px]" style={{ paddingLeft: `${8 + (er.indent || 0)}px` }}>
                {er.expandable ? (
                  <ExtraExpandableRow {...er} onReconcile={onReconcile} />
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
                <AmountCell value={er.balance || er.net} zeroDisplay={zeroDisplay} />
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
                {formatAmount(grandTotal)}
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

function ExtraExpandableRow({ label, details, detailColumns, onReconcile: parentReconcile }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 font-medium text-[#374151]"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
        {details?.length > 0 && (
          <span className="text-[10px] text-[#9ca3af] font-normal">({details.length})</span>
        )}
      </button>
      {open && details?.length > 0 && (
        <div className="mt-0.5 ml-3 border-l border-[#d1d5db] pl-2">
          {details.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-[2px] text-[#4b5563]">
              <span className="font-mono text-[#9ca3af] w-[60px] text-[10px]">{d.code}</span>
              <span className="flex-1 truncate">{d.name}</span>
              <span className="tabular-nums font-medium w-[85px] text-right">{formatAmount(d.balance)}</span>
              {parentReconcile && d.id && (
                <button
                  onClick={() => parentReconcile(d.accountType || "Vendor", d.id, `${d.code} - ${d.name}`)}
                  title="View transactions"
                  className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a] transition-colors"
                >
                  <FileSearch size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
