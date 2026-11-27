"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileSearch } from "lucide-react";
import { formatAmount } from "@/helper/numberFormatter";

// ─── helpers ────────────────────────────────────────────────────────────────

function toAlpha(n) {
  let s = "", i = n + 1;
  while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
  return s;
}

function AmountCell({ value, zeroDisplay = "zero" }) {
  if (value == null || value === 0)
    return <span className="text-[#9ca3af]">{zeroDisplay === "zero" ? "0.00" : "—"}</span>;
  const isNeg = value < 0;
  return (
    <span className={`tabular-nums${isNeg ? " text-[#dc2626]" : ""}`}>
      {isNeg ? "(" : ""}{formatAmount(Math.abs(value))}{isNeg ? ")" : ""}
    </span>
  );
}

function PercentCell({ value, grandTotal }) {
  if (!grandTotal || !value) return <span className="text-[#9ca3af]">—</span>;
  return (
    <span className="tabular-nums text-[#6b7280]">
      {((Math.abs(value) / Math.abs(grandTotal)) * 100).toFixed(2)}%
    </span>
  );
}

function flattenSection(groups, prefix, onReconcile) {
  const rows = [];
  const groupIds = [];

  function addAccount(acc, depth, ancestors, labelParts, ai) {
    const isBankCash = !!acc._bankCashId;
    rows.push({
      id: `${prefix}_acc_${acc.ccId}_${ancestors[ancestors.length - 1] || "g"}`,
      type: "account", depth, ancestors,
      label: acc.ccName, code: acc.ccCode,
      orderLabel: [...labelParts, ai + 1].join("."),
      net: acc.displayBalance != null ? acc.displayBalance : acc.net,
      plLinked: acc.plLinked,
      onReconcile: onReconcile && !acc._informational
        ? () => onReconcile(isBankCash ? "BankCash" : "CC", isBankCash ? acc._bankCashId : acc.ccId, `${acc.ccCode} - ${acc.ccName}`)
        : null,
    });
  }

  function addSubGroup(sg, depth, ancestors, labelParts) {
    const id = `${prefix}_sg_${sg.subGroupId}`;
    groupIds.push(id);
    rows.push({
      id, type: "subGroup", depth, ancestors,
      label: sg.subGroupName, code: sg.subGroupCode,
      orderLabel: labelParts.join("."),
      total: sg.total,
    });
    const kids = [...ancestors, id];
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
const ASSET = {
  header: "#1e3a5f",
  groupRow: "#f0f4f8",
  subGroupRow: "#f7f9fb",
  totalBg: "#1b2f3a",
};
const LIABILITY = {
  header: "#6b2121",
  groupRow: "#fff1f2",
  subGroupRow: "#fff7f7",
  totalBg: "#7f1d1d",
};

// ─── extra-row (vendor / bank / P&L) renderer ────────────────────────────────
function ExtraRow({ row, colCount, showPercent, grandTotal, onReconcile }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`border-b border-[#e5e7eb] ${row.bgCls || "bg-[#f8fafc]"}`} style={{ height: 28 }}>
        <td className="px-2 py-[3px] text-[10.5px] text-[#6b7280] font-mono">{row.code || ""}</td>
        <td className="px-2 py-[3px] pl-4">
          {row.expandable ? (
            <button onClick={() => setOpen(p => !p)} className="flex items-center gap-1 font-medium text-[#374151] text-[12px]">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {row.label}
              {row.details?.length > 0 && <span className="text-[10px] text-[#9ca3af]">({row.details.length})</span>}
            </button>
          ) : (
            <span className="font-medium text-[#374151] text-[12px]">{row.label}</span>
          )}
        </td>
        <td className="px-2 py-[3px] text-right font-semibold tabular-nums">
          <AmountCell value={row.balance ?? row.net} />
        </td>
        {showPercent && (
          <td className="px-2 py-[3px] text-right text-[11px]">
            <PercentCell value={row.balance ?? row.net} grandTotal={grandTotal} />
          </td>
        )}
        {onReconcile && (
          <td className="px-2 py-[3px] text-center">
            {row.onReconcile && (
              <button onClick={row.onReconcile} className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a]">
                <FileSearch size={13} />
              </button>
            )}
          </td>
        )}
      </tr>
      {open && row.details?.map((d, i) => (
        <tr key={i} className="border-b border-[#f0f0f0] bg-[#fafbfc]" style={{ height: 26 }}>
          <td className="px-2 py-[2px] text-[10px] text-[#9ca3af] font-mono pl-4">{d.code}</td>
          <td className="px-2 py-[2px] text-[11px] text-[#4b5563] pl-7">{d.name}</td>
          <td className="px-2 py-[2px] text-right tabular-nums text-[11px] font-medium">
            {formatAmount(Math.abs(d.balance))}
          </td>
          {showPercent && <td />}
          {onReconcile && (
            <td className="px-2 py-[2px] text-center">
              {d.id && (
                <button onClick={() => onReconcile(d.accountType || "Vendor", d.id, `${d.code} - ${d.name}`)} className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a]">
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

// ─── main component ───────────────────────────────────────────────────────────

export default function BalanceSheetCombinedTable({
  assetGroups = [],
  assetExtras = [],
  totalAssets = 0,
  liabilityGroups = [],
  liabilityExtras = [],
  totalLiabilities = 0,
  difference,
  onReconcile,
  showPercent = true,
}) {
  const { rows: assetRows, groupIds: assetIds } = useMemo(
    () => flattenSection(assetGroups, "ast", onReconcile),
    [assetGroups, onReconcile]
  );
  const { rows: liabilityRows, groupIds: liabilityIds } = useMemo(
    () => flattenSection(liabilityGroups, "lib", onReconcile),
    [liabilityGroups, onReconcile]
  );

  const [assetCollapsed, setAssetCollapsed] = useState(() => new Set());
  const [liabilityCollapsed, setLiabilityCollapsed] = useState(() => new Set());

  const toggle = useCallback((id, section) => {
    const setter = section === "asset" ? setAssetCollapsed : setLiabilityCollapsed;
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const assetAllCollapsed = assetIds.length > 0 && assetIds.every(id => assetCollapsed.has(id));
  const liabilityAllCollapsed = liabilityIds.length > 0 && liabilityIds.every(id => liabilityCollapsed.has(id));

  const expandAsset    = () => setAssetCollapsed(new Set());
  const collapseAsset  = () => setAssetCollapsed(new Set(assetIds));
  const expandLiab     = () => setLiabilityCollapsed(new Set());
  const collapseLiab   = () => setLiabilityCollapsed(new Set(liabilityIds));

  const visibleAsset = useMemo(
    () => assetRows.filter(r => !r.ancestors.some(a => assetCollapsed.has(a))),
    [assetRows, assetCollapsed]
  );
  const visibleLiability = useMemo(
    () => liabilityRows.filter(r => !r.ancestors.some(a => liabilityCollapsed.has(a))),
    [liabilityRows, liabilityCollapsed]
  );

  const colCount = 2 + 1 + (showPercent ? 1 : 0) + (onReconcile ? 1 : 0);

  function renderRows(rows, section, collapsed) {
    const C = section === "asset" ? ASSET : LIABILITY;
    return rows.map((row, idx) => {
      const isGroup = row.type === "group";
      const isSubGroup = row.type === "subGroup";
      const isGroupish = isGroup || isSubGroup;
      const indent = row.depth * 14;
      const isCollapsed = collapsed.has(row.id);

      const bg = isGroup ? C.groupRow : isSubGroup ? C.subGroupRow : idx % 2 === 0 ? "#ffffff" : "#fafbfc";

      return (
        <tr
          key={row.id}
          className="border-b border-[#e5e7eb]"
          style={{ background: bg, height: isGroupish ? 30 : 27, cursor: isGroupish ? "pointer" : "default" }}
          onClick={isGroupish ? () => toggle(row.id, section) : undefined}
        >
          {/* Code / order-label */}
          <td className="px-2 py-[3px] text-[10.5px] font-mono" onClick={isGroupish ? e => e.stopPropagation() : undefined}>
            {isGroupish ? (
              <span className={[
                "px-1 py-0.5 rounded text-[10px] font-bold",
                isGroup ? "bg-[#1c3a5e] text-white"
                  : row.depth === 1 ? "bg-[#d6e6f2] text-[#1c3a5e]"
                  : "bg-gray-100 text-gray-500",
              ].join(" ")}>
                {row.orderLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {row.orderLabel && <span className="text-[9px] text-[#9ca3af] shrink-0">{row.orderLabel}</span>}
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
              <span className="font-semibold text-[#1f2937]"><AmountCell value={row.total} /></span>
            ) : (
              <AmountCell value={row.net} />
            )}
          </td>

          {showPercent && (
            <td className="px-2 py-[3px] text-right text-[11px]">
              <PercentCell value={isGroupish ? row.total : row.net} grandTotal={totalAssets} />
            </td>
          )}

          {onReconcile && (
            <td className="px-2 py-[3px] text-center" onClick={e => e.stopPropagation()}>
              {row.onReconcile && (
                <button onClick={row.onReconcile} className="p-0.5 text-[#9ca3af] hover:text-[#1b2f3a]">
                  <FileSearch size={13} />
                </button>
              )}
            </td>
          )}
        </tr>
      );
    });
  }

  function SectionToggle({ allCollapsed, onExpand, onCollapse }) {
    return (
      <button
        onClick={e => { e.stopPropagation(); allCollapsed ? onExpand() : onCollapse(); }}
        className="flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] text-white bg-white/10 hover:bg-white/20 transition-colors rounded-sm"
      >
        {allCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
        {allCollapsed ? "Expand All" : "Collapse All"}
      </button>
    );
  }

  const hasDiff = difference != null && Math.abs(difference) > 0.01;

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
          {/* ══ ASSETS ══ */}
          <tr style={{ background: ASSET.header, height: 32 }}>
            <td colSpan={colCount} className="px-3 py-[6px]">
              <div className="flex items-center justify-between">
                <span className="text-white text-[12.5px] font-semibold tracking-[0.01em]">Assets</span>
                {assetIds.length > 0 && (
                  <SectionToggle allCollapsed={assetAllCollapsed} onExpand={expandAsset} onCollapse={collapseAsset} />
                )}
              </div>
            </td>
          </tr>

          {renderRows(visibleAsset, "asset", assetCollapsed)}

          {assetExtras.map((row, i) => (
            <ExtraRow key={`ae_${i}`} row={row} colCount={colCount} showPercent={showPercent} grandTotal={totalAssets} onReconcile={onReconcile} />
          ))}

          {/* Total Assets */}
          <tr
            style={{ background: ASSET.totalBg, height: 32, cursor: "pointer" }}
            onClick={assetAllCollapsed ? expandAsset : collapseAsset}
          >
            <td className="px-2 py-[5px]">
              <span className="text-white/60">{assetAllCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}</span>
            </td>
            <td className="px-2 py-[5px] text-white text-[12.5px] font-semibold">Total Assets</td>
            <td className="px-2 py-[5px] text-right text-white tabular-nums text-[13px] font-bold">
              {formatAmount(Math.abs(totalAssets))}
            </td>
            {showPercent && <td className="px-2 py-[5px] text-right text-white text-[11px]">100.00%</td>}
            {onReconcile && <td />}
          </tr>

          {/* spacer */}
          <tr style={{ height: 6, background: "#f8f9fa" }}><td colSpan={colCount} /></tr>

          {/* ══ EQUITY & LIABILITIES ══ */}
          <tr style={{ background: LIABILITY.header, height: 32 }}>
            <td colSpan={colCount} className="px-3 py-[6px]">
              <div className="flex items-center justify-between">
                <span className="text-white text-[12.5px] font-semibold tracking-[0.01em]">Equity &amp; Liabilities</span>
                {liabilityIds.length > 0 && (
                  <SectionToggle allCollapsed={liabilityAllCollapsed} onExpand={expandLiab} onCollapse={collapseLiab} />
                )}
              </div>
            </td>
          </tr>

          {renderRows(visibleLiability, "liability", liabilityCollapsed)}

          {liabilityExtras.map((row, i) => (
            <ExtraRow key={`le_${i}`} row={row} colCount={colCount} showPercent={showPercent} grandTotal={totalAssets} onReconcile={onReconcile} />
          ))}

          {/* Total Equity & Liabilities */}
          <tr
            style={{ background: LIABILITY.totalBg, height: 32, cursor: "pointer" }}
            onClick={liabilityAllCollapsed ? expandLiab : collapseLiab}
          >
            <td className="px-2 py-[5px]">
              <span className="text-white/60">{liabilityAllCollapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}</span>
            </td>
            <td className="px-2 py-[5px] text-white text-[12.5px] font-semibold">Total Equity &amp; Liabilities</td>
            <td className="px-2 py-[5px] text-right text-white tabular-nums text-[13px] font-bold">
              {formatAmount(Math.abs(totalLiabilities))}
            </td>
            {showPercent && (
              <td className="px-2 py-[5px] text-right text-white text-[11px]">
                {totalAssets ? `${((Math.abs(totalLiabilities) / Math.abs(totalAssets)) * 100).toFixed(2)}%` : "—"}
              </td>
            )}
            {onReconcile && <td />}
          </tr>

          {/* spacer */}
          <tr style={{ height: 6, background: "#f8f9fa" }}><td colSpan={colCount} /></tr>

          {/* ══ BALANCE / DIFFERENCE ══ */}
          <tr style={{
            background: hasDiff ? "#fffbeb" : "#f0fdf4",
            height: 36,
            borderTop: `2px solid ${hasDiff ? "#f59e0b" : "#16a34a"}`,
          }}>
            <td className="px-2 py-[5px]"></td>
            <td className="px-2 py-[5px]">
              <span className="text-[13px] font-bold" style={{ color: hasDiff ? "#92400e" : "#15803d" }}>
                {hasDiff ? "Balance Difference" : "Balanced ✓"}
              </span>
            </td>
            <td className="px-2 py-[5px] text-right tabular-nums text-[14px] font-bold"
              style={{ color: hasDiff ? "#92400e" : "#15803d" }}>
              {hasDiff ? formatAmount(Math.abs(difference)) : "—"}
            </td>
            {showPercent && <td />}
            {onReconcile && <td />}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
