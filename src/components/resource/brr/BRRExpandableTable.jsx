"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Plug } from "lucide-react";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import { useColumnResize } from "@/hooks/useColumnResize";

// ─── Helpers ────────────────────────────────────────────────────────────────

function TruncatedCell({ value, maxW }) {
  const ref = useRef(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollWidth > el.clientWidth);
  }, [value]);
  const inner = <div ref={ref} className={`${maxW} truncate`}>{value}</div>;
  if (!overflows) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top" variant="text">{value}</TooltipContent>
    </Tooltip>
  );
}

const STATUS_RANK = { draft: 0, ongoing: 2, approved: 3, completed: 4, reback: 5, rejected: 6, reject: 6 };
const getStatusRank = (val) => {
  if (!val) return 999;
  const key = String(val).toLowerCase();
  if (key.startsWith("pending")) return 1;
  return STATUS_RANK[key] ?? 999;
};

const STATUS_STYLES = {
  approved:  "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  ongoing:   "bg-amber-100 text-amber-700",
  draft:     "bg-gray-100 text-gray-600",
  reback:    "bg-amber-100 text-amber-700",
  reject:    "bg-red-100 text-red-600",
  rejected:  "bg-red-100 text-red-600",
};

function StatusBadge({ value }) {
  if (!value) return <span className="text-gray-400">—</span>;
  const key = value.toLowerCase();
  const isPending = key.startsWith("pending");
  const cls = isPending
    ? "bg-blue-100 text-blue-700"
    : (STATUS_STYLES[key] || "bg-gray-100 text-gray-600");
  return (
    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

/**
 * Amount cell: shows BRB amount as primary.
 * If BRR amount differs → show BRR with strikethrough above in gray.
 */
function AmountCell({ brrAmt, brbAmt }) {
  const differs = brrAmt && brbAmt && brrAmt !== brbAmt;
  if (!brbAmt && !brrAmt) return <span className="text-gray-400">—</span>;
  const primary = brbAmt || brrAmt;
  return (
    <div className="flex flex-col items-end leading-tight">
      {differs && (
        <span className="line-through text-gray-400 text-[10px]">{brrAmt}</span>
      )}
      <span className={`font-semibold text-[11px] ${differs ? "text-green-700" : "text-gray-800"}`}>
        {primary}
      </span>
    </div>
  );
}

// ─── Columns ────────────────────────────────────────────────────────────────

const COLS = [
  { key: "brrNo",        label: "BRR No",       align: "left"   },
  { key: "brbNo",        label: "BRB No",        align: "left"   },
  { key: "brrDate",      label: "Date",          align: "left"   },
  { key: "partyName",    label: "Party Name",    align: "left"   },
  { key: "orderCategory",label: "Category",      align: "left"   },
  { key: "orderNo",      label: "Order No",      align: "left"   },
  { key: "partyBillNo",  label: "Party Bill No", align: "left"   },
  { key: "basicAmount",  label: "Basic",         align: "right",  isAmount: true },
  { key: "gstAmount",    label: "GST",           align: "right",  isAmount: true },
  { key: "totalAmount",  label: "Total",         align: "right",  isAmount: true },
  { key: "brrStatus",    label: "BRR Status",    align: "center", isStatus: true },
  { key: "brbStatus",    label: "BRB Status",    align: "center", isStatus: true },
];

// ─── Sort / filter header ────────────────────────────────────────────────────

function SortFilterHeader({ col, sortConfig, onSort, filterConfig, onOpenFilter, isFilterActive }) {
  const filterOn = isFilterActive(col.key);
  const dir = sortConfig.key === col.key ? sortConfig.direction : null;
  return (
    <th
      className={`border border-[#b0b0b0] px-2 py-1.5 font-semibold whitespace-nowrap text-sm
        ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
    >
      <div className="flex items-center gap-1 justify-inherit">
        <span
          className="cursor-pointer select-none flex items-center gap-0.5"
          onClick={() => onSort(col.key)}
        >
          {col.label}
          {dir === "asc"  ? <ArrowUp size={11} />  :
           dir === "desc" ? <ArrowDown size={11} /> :
           <ArrowUpDown size={10} className="opacity-30" />}
        </span>
        <button
          type="button"
          onClick={(e) => onOpenFilter(e, col.key)}
          className={`cursor-pointer rounded px-0.5 hover:bg-black/10 transition-colors ${filterOn ? "text-yellow-300" : "text-white/70"}`}
        >
          {filterOn ? (
            <span className="text-[9px] font-bold leading-none bg-yellow-400 text-black rounded-full px-1">
              {filterConfig[col.key]?.length}
            </span>
          ) : (
            <span className="text-[11px]">▾</span>
          )}
        </button>
      </div>
    </th>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BRRExpandableTable({
  data = [],
  onParentRowClick,
  onBrbClick,
  onCreateBilling,
  search = "",
}) {
  const [sortConfig, setSortConfig]           = useState({ key: null, direction: null });
  const [filterConfig, setFilterConfig]       = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos]         = useState({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch]       = useState("");
  const dropdownRef = useRef(null);
  const { tableRef } = useColumnResize();

  useEffect(() => {
    if (!activeFilterCol) return;
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
        setFilterSearch("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [activeFilterCol]);

  const handleSort = (key) =>
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });

  const openFilter = (e, col) => {
    e.stopPropagation();
    if (activeFilterCol === col) { setActiveFilterCol(null); setFilterSearch(""); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = rect.left + 200 > window.innerWidth ? rect.right - 200 : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(col);
    setFilterSearch("");
  };

  // Flatten rows for filter/sort — derive filter-visible fields
  const flatData = data.map((row) => ({
    ...row,
    brbNo:      row.brb?.brbNo      || "",
    brrStatus:  row.status          || "",
    brbStatus:  row.brb?.workflowStatus || "",
    // amount fields for sort/filter use BRB primary
    basicAmount: row.brb?.basicAmount ?? row.brrBasicAmount ?? "",
    gstAmount:   row.brb?.gstAmount   ?? row.brrGstAmount   ?? "",
    totalAmount: row.brb?.totalAmount  ?? row.brrTotalAmount  ?? "",
  }));

  const getUniqueValues = useCallback((key) => {
    const seen = new Set();
    flatData.forEach((r) => { const v = r[key]; seen.add(v == null ? "-" : String(v)); });
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [flatData]);

  const toggleFilterValue = (col, val) =>
    setFilterConfig((prev) => {
      const cur = prev[col] || [];
      return { ...prev, [col]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] };
    });

  const toggleSelectAll = (col) => {
    const unique = getUniqueValues(col);
    const cur = filterConfig[col] || [];
    setFilterConfig((prev) => ({
      ...prev,
      [col]: (cur.length === 0 || cur.length === unique.length) ? [] : unique,
    }));
  };

  const isFilterActive = (col) => { const s = filterConfig[col]; return s && s.length > 0; };
  const clearFilter    = (col) => setFilterConfig((prev) => ({ ...prev, [col]: [] }));

  const filtered = flatData.filter((row) => {
    const matchesSearch = !search || [
      row.brrNo, row.brbNo, row.orderNo, row.partyBillNo, row.partyName,
      row.orderCategory, row.brrStatus, row.brbStatus,
    ].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));

    const matchesFilter = Object.entries(filterConfig).every(([col, sel]) => {
      if (!sel || sel.length === 0) return true;
      const v = row[col]; return sel.includes(v == null ? "-" : String(v));
    });
    return matchesSearch && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? ""; const vb = b[sortConfig.key] ?? "";

    if (sortConfig.key.toLowerCase().endsWith("status")) {
      const rankA = getStatusRank(va), rankB = getStatusRank(vb);
      if (rankA !== rankB) return sortConfig.direction === "asc" ? rankA - rankB : rankB - rankA;
    }

    const parseDate = (v) => {
      const s = String(v).trim();
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
      if (s.match(/^\d{4}[\/\-]\d/)) return new Date(s);
      if (s.match(/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/)) return new Date(s);
      return null;
    };
    const dateA = parseDate(va), dateB = parseDate(vb);
    if (dateA && dateB && !isNaN(dateA) && !isNaN(dateB))
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;

    const numA = parseFloat(String(va).replace(/,/g, ""));
    const numB = parseFloat(String(vb).replace(/,/g, ""));
    if (!isNaN(numA) && !isNaN(numB))
      return sortConfig.direction === "asc" ? numA - numB : numB - numA;

    const sa = String(va).toLowerCase(); const sb = String(vb).toLowerCase();
    if (sa < sb) return sortConfig.direction === "asc" ? -1 : 1;
    if (sa > sb) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const renderFilterDropdown = () => {
    if (!activeFilterCol || typeof document === "undefined") return null;
    const unique   = getUniqueValues(activeFilterCol);
    const selected = filterConfig[activeFilterCol] || [];
    const visible  = filterSearch.trim()
      ? unique.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
      : unique;
    const allChecked  = selected.length === 0 || selected.length === unique.length;
    const someChecked = selected.length > 0 && selected.length < unique.length;
    return createPortal(
      <div
        ref={dropdownRef}
        style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        className="w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 cursor-pointer hover:bg-blue-50"
          onClick={() => toggleSelectAll(activeFilterCol)}
        >
          <input
            type="checkbox" readOnly checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            className="cursor-pointer accent-blue-500"
          />
          <span className="text-xs font-semibold text-gray-600">Select All</span>
          {isFilterActive(activeFilterCol) && (
            <button
              onClick={(e) => { e.stopPropagation(); clearFilter(activeFilterCol); }}
              className="ml-auto text-[10px] text-blue-500 hover:text-blue-700"
            >Clear</button>
          )}
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {visible.map((val) => (
            <div
              key={val} onClick={() => toggleFilterValue(activeFilterCol, val)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer"
            >
              <input
                type="checkbox" readOnly
                checked={selected.length === 0 ? false : selected.includes(val)}
                className="cursor-pointer accent-blue-500 shrink-0"
              />
              <span className="text-xs text-gray-700 whitespace-normal break-words">{val}</span>
            </div>
          ))}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <TooltipProvider>
      <div className="border border-[#9e9e9e] overflow-x-auto relative">
        <div className="max-h-[65vh] overflow-y-auto">
          <table ref={tableRef} className="w-full min-w-max border-collapse text-xs">
            <thead className="bg-[#144664] sticky top-0 z-10 text-white">
              <tr>
                <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold w-[48px] text-center text-sm">Sl.</th>
                {COLS.map((col) => (
                  <SortFilterHeader
                    key={col.key}
                    col={col}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    filterConfig={filterConfig}
                    onOpenFilter={openFilter}
                    isFilterActive={isFilterActive}
                  />
                ))}
                <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-center w-[48px] text-sm">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 2} className="text-center py-8 text-sm text-gray-400 border border-[#e6e4e4]">
                    No records found
                  </td>
                </tr>
              ) : sorted.map((row, idx) => {
                const brb      = row.brb;
                const isEven   = idx % 2 === 0;
                const hasBrb   = !!brb;
                const brrApproved = (row.status || "").toLowerCase() === "approved";
                const canCreate   = brrApproved && !hasBrb;

                return (
                  <tr
                    key={row.id ?? idx}
                    className={`border-b border-[#e6e4e4] ${isEven ? "bg-[#f2f2f2]" : "bg-white"} hover:bg-[#e6e6e6] transition-colors`}
                  >
                    {/* Sl */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-center text-gray-500">{idx + 1}</td>

                    {/* BRR No — clickable */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      <span
                        className="text-blue-600 font-medium cursor-pointer hover:underline"
                        onClick={() => onParentRowClick && onParentRowClick(row)}
                      >
                        <TruncatedCell value={row.brrNo || "—"} maxW="max-w-[110px]" />
                      </span>
                    </td>

                    {/* BRB No — clickable if exists */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      {hasBrb ? (
                        <span
                          className="text-blue-600 font-medium cursor-pointer hover:underline"
                          onClick={() => onBrbClick && onBrbClick(row)}
                        >
                          <TruncatedCell value={brb.brbNo || "—"} maxW="max-w-[110px]" />
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-[10px]">No BRB</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 whitespace-nowrap text-gray-700">
                      {row.brrDate || "—"}
                    </td>

                    {/* Party Name */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      <TruncatedCell value={row.partyName || "—"} maxW="max-w-[160px]" />
                    </td>

                    {/* Category */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      <TruncatedCell value={row.orderCategory?.replace(/_/g, " ") || "—"} maxW="max-w-[140px]" />
                    </td>

                    {/* Order No */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      <TruncatedCell value={row.orderNo || "—"} maxW="max-w-[120px]" />
                    </td>

                    {/* Party Bill No */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5">
                      <TruncatedCell value={row.partyBillNo || "—"} maxW="max-w-[110px]" />
                    </td>

                    {/* Basic — BRB primary, BRR strikethrough if different */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-right">
                      <AmountCell brrAmt={row.brrBasicAmount} brbAmt={brb?.basicAmount} />
                    </td>

                    {/* GST */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-right">
                      <AmountCell brrAmt={row.brrGstAmount} brbAmt={brb?.gstAmount} />
                    </td>

                    {/* Total */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-right">
                      <AmountCell brrAmt={row.brrTotalAmount} brbAmt={brb?.totalAmount} />
                    </td>

                    {/* BRR Status */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-center">
                      <StatusBadge value={row.status} />
                    </td>

                    {/* BRB Status */}
                    <td className="border border-[#e6e4e4] px-2 py-1.5 text-center">
                      {hasBrb
                        ? <StatusBadge value={brb.workflowStatus} />
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>

                    {/* Action */}
                    <td
                      className="border border-[#e6e4e4] px-2 py-1.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={!canCreate}
                            onClick={() => canCreate && onCreateBilling && onCreateBilling(row)}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors
                              ${canCreate
                                ? "bg-[#7fc3d4] border border-[#4a9fb5] text-black hover:bg-[#6ab8cb] cursor-pointer"
                                : "bg-gray-100 border border-gray-300 text-gray-300 cursor-not-allowed opacity-50"
                              }`}
                          >
                            <Plug size={13} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="left" variant="text">
                          {canCreate
                            ? "Create Billing Record"
                            : hasBrb
                              ? `BRB already exists (${brb.workflowStatus})`
                              : "BRR must be Approved to create BRB"}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderFilterDropdown()}
      </div>
    </TooltipProvider>
  );
}
