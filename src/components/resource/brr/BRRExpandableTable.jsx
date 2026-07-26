"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight, Search, Plug,
} from "lucide-react";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";

function TruncatedCell({ value, maxW }) {
  const ref = useRef(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollWidth > el.clientWidth);
  }, [value]);

  const inner = (
    <div ref={ref} className={`${maxW} truncate`}>{value}</div>
  );

  if (!overflows) return inner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top" variant="text">{value}</TooltipContent>
    </Tooltip>
  );
}

const fmt = (v) =>
  Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  if (!value) return <span className="text-gray-400">-</span>;
  const key = value.toLowerCase();
  const isPending = key.startsWith("pending");
  const cls = isPending
    ? "bg-blue-100 text-blue-700"
    : (STATUS_STYLES[key] || "bg-gray-100 text-gray-600");
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

// Material order categories → GRN (teal); everything else → SRN (purple)
const MATERIAL_CATEGORIES = ["Purchases_Order", "Site_Transfer_Order", "Customer_Supply_Order"];

const CHILD_THEME = {
  material: {
    border:     "border-l-4 border-[#7fc3d4]",
    header:     "bg-[#c5dde8]",
    rowEven:    "bg-[#f0f7fa]",
    rowOdd:     "bg-white",
    rowHover:   "hover:bg-[#dff0f7]",
    cellBorder: "border-[#d4e8ef]",
    tag:        "bg-[#d4eef7] text-[#1a6f8a] border border-[#7fc3d4]",
    tagLabel:   "Material Order",
  },
  service: {
    border:     "border-l-4 border-[#a07fd4]",
    header:     "bg-[#d9cff0]",
    rowEven:    "bg-[#f7f3fd]",
    rowOdd:     "bg-white",
    rowHover:   "hover:bg-[#ede5fb]",
    cellBorder: "border-[#ddd0f5]",
    tag:        "bg-[#ede5fb] text-[#5b3fa0] border border-[#a07fd4]",
    tagLabel:   "Service Order",
  },
};

const CHILD_COLS = [
  { key: "billingNo",      label: "Billing No",  cls: "text-left",   cellCls: "text-blue-600 font-medium cursor-pointer", maxW: "max-w-[120px]" },
  { key: "billingDate",    label: "Date",         cls: "text-left",   cellCls: "whitespace-nowrap" },
  { key: "basicAmount",    label: "Basic",        cls: "text-right",  cellCls: "text-right font-medium whitespace-nowrap" },
  { key: "gstAmount",      label: "GST",          cls: "text-right",  cellCls: "text-right whitespace-nowrap" },
  { key: "totalAmount",    label: "Total",        cls: "text-right",  cellCls: "text-right font-semibold whitespace-nowrap" },
  { key: "itemCount",      label: "Items",        cls: "text-center", cellCls: "text-center text-gray-600" },
  { key: "workflowStatus", label: "Status",       cls: "text-center", cellCls: "text-center", isStatus: true },
];

// ─── Child billing table ────────────────────────────────────────────────────
function ChildTable({ billings, onChildRowClick, search, orderCategory }) {
  const [sortConfig, setSortConfig]         = useState({ key: null, direction: null });
  const [filterConfig, setFilterConfig]     = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos]       = useState({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch]     = useState("");
  const dropdownRef = useRef(null);

  const isMaterial = MATERIAL_CATEGORIES.includes(orderCategory);
  const theme = isMaterial ? CHILD_THEME.material : CHILD_THEME.service;

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

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  const openFilter = (e, col) => {
    e.stopPropagation();
    if (activeFilterCol === col) { setActiveFilterCol(null); setFilterSearch(""); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = rect.left + 200 > window.innerWidth ? rect.right - 200 : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(col);
    setFilterSearch("");
  };

  const getUniqueValues = useCallback((key) => {
    const seen = new Set();
    billings.forEach((r) => { const v = r[key]; seen.add(v == null ? "-" : String(v)); });
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [billings]);

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
  const clearFilter = (col) => setFilterConfig((prev) => ({ ...prev, [col]: [] }));

  const filtered = billings.filter((row) => {
    const matchesSearch = !search || Object.values(row).some((v) =>
      String(v || "").toLowerCase().includes(search.toLowerCase())
    );
    const matchesFilter = Object.entries(filterConfig).every(([col, sel]) => {
      if (!sel || sel.length === 0) return true;
      const v = row[col]; return sel.includes(v == null ? "-" : String(v));
    });
    return matchesSearch && matchesFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? ""; const vb = b[sortConfig.key] ?? "";

    if (sortConfig.key?.toLowerCase().endsWith("status")) {
      const rankA = getStatusRank(va), rankB = getStatusRank(vb);
      if (rankA !== rankB) return sortConfig.direction === "asc" ? rankA - rankB : rankB - rankA;
      return sortConfig.direction === "asc"
        ? String(va).toLowerCase().localeCompare(String(vb).toLowerCase())
        : String(vb).toLowerCase().localeCompare(String(va).toLowerCase());
    }

    const parseDate = (v) => {
      const s = String(v).trim();
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
      if (s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)) return new Date(s);
      if (s.match(/^(\d{1,2})\s+[A-Za-z]+\s+(\d{4})$/)) return new Date(s);
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
    if (!activeFilterCol) return null;
    const unique = getUniqueValues(activeFilterCol);
    const selected = filterConfig[activeFilterCol] || [];
    const visible = filterSearch.trim()
      ? unique.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
      : unique;
    const allChecked = selected.length === 0 || selected.length === unique.length;
    const someChecked = selected.length > 0 && selected.length < unique.length;
    return (
      <div
        ref={dropdownRef}
        style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        className="w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div
          onClick={() => toggleSelectAll(activeFilterCol)}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b"
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
      </div>
    );
  };

  const ColHeader = ({ col }) => {
    const filterOn = isFilterActive(col.key);
    return (
      <th className={`border border-[#9e9e9e] px-2 py-1.5 font-semibold text-xs whitespace-nowrap ${col.cls}`}>
        <div className="flex items-center justify-between gap-1">
          <span onClick={() => handleSort(col.key)} className="cursor-pointer flex-1 truncate">{col.label}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <span onClick={() => handleSort(col.key)} className="cursor-pointer text-gray-600 hover:text-gray-900">
              {sortConfig.key === col.key
                ? sortConfig.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                : <ArrowUpDown size={11} className="opacity-40" />}
            </span>
            <span
              onClick={(e) => openFilter(e, col.key)}
              className={`cursor-pointer rounded px-0.5 hover:bg-black/10 transition-colors ${filterOn ? "text-blue-600" : "text-gray-500"}`}
            >
              {filterOn ? (
                <span className="relative inline-flex items-center">
                  <ChevronDown size={11} />
                  <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] rounded-full w-3 h-3 flex items-center justify-center font-bold">
                    {filterConfig[col.key]?.length}
                  </span>
                </span>
              ) : <ChevronDown size={11} />}
            </span>
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className={`ml-6 ${theme.border}`}>
      {/* type tag */}
      <div className={`px-3 py-1 flex items-center gap-2 ${theme.header} border-b border-[#9e9e9e]`}>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${theme.tag}`}>
          {theme.tagLabel}
        </span>
        <span className="text-[11px] text-gray-500">{billings.length} billing record{billings.length !== 1 ? "s" : ""}</span>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className={theme.header}>
            <th className="border border-[#9e9e9e] px-2 py-1.5 font-semibold text-center w-[42px]">Sl.</th>
            {CHILD_COLS.map((col) => <ColHeader key={col.key} col={col} />)}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={CHILD_COLS.length + 1} className="px-4 py-3 text-xs text-gray-400">
                No billing records
              </td>
            </tr>
          ) : sorted.map((row, ci) => (
            <tr
              key={ci}
              onClick={(e) => { e.stopPropagation(); onChildRowClick && onChildRowClick(row); }}
              className={`cursor-pointer border-b ${theme.cellBorder} ${ci % 2 === 0 ? theme.rowEven : theme.rowOdd} ${theme.rowHover} transition-colors`}
            >
              <td className={`border ${theme.cellBorder} px-2 py-1.5 text-center text-gray-500`}>{ci + 1}</td>
              {CHILD_COLS.map((col) => (
                <td key={col.key} className={`border ${theme.cellBorder} px-2 py-1.5 ${col.cellCls}`}>
                  {col.isStatus
                    ? <StatusBadge value={row[col.key]} />
                    : col.maxW
                      ? <TruncatedCell value={String(row[col.key] ?? "-")} maxW={col.maxW} />
                      : (row[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {renderFilterDropdown()}
    </div>
  );
}

// ─── Sort/filter header for parent table ───────────────────────────────────
function SortFilterHeader({ colKey, label, sortConfig, onSort, filterConfig, onOpenFilter, isFilterActive, align = "left" }) {
  const filterOn = isFilterActive(colKey);
  return (
    <th className={`border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap text-sm text-${align}`}>
      <div className="flex items-center justify-between gap-1">
        <span onClick={() => onSort(colKey)} className="cursor-pointer flex-1 truncate">{label}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <span onClick={() => onSort(colKey)} className="cursor-pointer text-gray-600 hover:text-gray-900">
            {sortConfig.key === colKey
              ? sortConfig.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
              : <ArrowUpDown size={13} className="opacity-40" />}
          </span>
          <span
            onClick={(e) => onOpenFilter(e, colKey)}
            className={`cursor-pointer rounded px-0.5 hover:bg-black/10 transition-colors ${filterOn ? "text-blue-600" : "text-gray-500"}`}
          >
            {filterOn ? (
              <span className="relative inline-flex items-center">
                <ChevronDown size={13} />
                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {filterConfig[colKey]?.length}
                </span>
              </span>
            ) : <ChevronDown size={13} />}
          </span>
        </div>
      </div>
    </th>
  );
}

// ─── Main BRR Expandable Table ─────────────────────────────────────────────
const PARENT_COLS = [
  { key: "brrNo",         label: "BRR No",        align: "left"  },
  { key: "brrDate",       label: "Date",           align: "left"  },
  { key: "partyName",     label: "Party Name",     align: "left"  },
  { key: "orderCategory", label: "Category",       align: "left",   format: (v) => v?.replace(/_/g, " ") || "-" },
  { key: "orderNo",       label: "Order No",       align: "left"  },
  { key: "partyBillNo",   label: "Party Bill No",  align: "left"  },
  { key: "basicAmount",   label: "Basic",          align: "right" },
  { key: "totalAmount",   label: "Total",          align: "right" },
  { key: "bookedAmount",  label: "Booked",         align: "right" },
  { key: "status",        label: "Status",         align: "center"},
];

export default function BRRExpandableTable({
  data = [],
  onParentRowClick,
  onChildRowClick,
  onCreateBilling,
  search = "",
}) {
  const [sortConfig, setSortConfig]           = useState({ key: null, direction: null });
  const [filterConfig, setFilterConfig]       = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos]         = useState({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch]       = useState("");
  const [expandedRows, setExpandedRows]       = useState(new Set());
  const dropdownRef = useRef(null);

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

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  const openFilter = (e, col) => {
    e.stopPropagation();
    if (activeFilterCol === col) { setActiveFilterCol(null); setFilterSearch(""); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = rect.left + 200 > window.innerWidth ? rect.right - 200 : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(col);
    setFilterSearch("");
  };

  const getUniqueValues = useCallback((key) => {
    const col = PARENT_COLS.find((c) => c.key === key);
    const seen = new Set();
    data.forEach((row) => {
      const v = row[key];
      seen.add(col?.format ? col.format(v) : (v == null ? "-" : String(v)));
    });
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data]);

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
  const clearFilter = (col) => setFilterConfig((prev) => ({ ...prev, [col]: [] }));

  // Auto-expand rows with child matches when searching
  useEffect(() => {
    if (!search) return;
    const shouldExpand = new Set();
    data.forEach((row, idx) => {
      const billings = [...(row.grnBillings || []), ...(row.srnBillings || [])];
      const hasChildMatch = billings.some((b) =>
        Object.values(b).some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()))
      );
      if (hasChildMatch) shouldExpand.add(idx);
    });
    if (shouldExpand.size > 0) setExpandedRows((prev) => new Set([...prev, ...shouldExpand]));
  }, [search, data]);

  const filtered = data.filter((row) => {
    const parentMatch = !search || [row.brrNo, row.partyName, row.orderNo, row.partyBillNo, row.status, row.orderCategory]
      .some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));
    const childMatch = !search || [...(row.grnBillings || []), ...(row.srnBillings || [])].some((b) =>
      Object.values(b).some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()))
    );
    const colMatch = Object.entries(filterConfig).every(([col, sel]) => {
      if (!sel || sel.length === 0) return true;
      const colDef = PARENT_COLS.find((c) => c.key === col);
      const v = row[col];
      const formatted = colDef?.format ? colDef.format(v) : (v == null ? "-" : String(v));
      return sel.includes(formatted);
    });
    return (parentMatch || childMatch) && colMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? ""; const vb = b[sortConfig.key] ?? "";

    if (sortConfig.key?.toLowerCase().endsWith("status")) {
      const rankA = getStatusRank(va), rankB = getStatusRank(vb);
      if (rankA !== rankB) return sortConfig.direction === "asc" ? rankA - rankB : rankB - rankA;
      return sortConfig.direction === "asc"
        ? String(va).toLowerCase().localeCompare(String(vb).toLowerCase())
        : String(vb).toLowerCase().localeCompare(String(va).toLowerCase());
    }

    const parseDate = (v) => {
      const s = String(v).trim();
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
      if (s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)) return new Date(s);
      if (s.match(/^(\d{1,2})\s+[A-Za-z]+\s+(\d{4})$/)) return new Date(s);
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

  const toggleRow = (idx) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const renderFilterDropdown = () => {
    if (!activeFilterCol) return null;
    const unique = getUniqueValues(activeFilterCol);
    const selected = filterConfig[activeFilterCol] || [];
    const visible = filterSearch.trim()
      ? unique.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
      : unique;
    const allChecked = selected.length === 0 || selected.length === unique.length;
    const someChecked = selected.length > 0 && selected.length < unique.length;
    return (
      <div
        ref={dropdownRef}
        style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        className="w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div
          onClick={() => toggleSelectAll(activeFilterCol)}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b"
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
      </div>
    );
  };

  return (
    <TooltipProvider>
    <div className="border border-[#9e9e9e] overflow-x-auto relative">
      <div className="max-h-[608px] overflow-y-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="bg-[#b7cfa5] sticky top-0 z-10">
            <tr>
              <th className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap w-[65px] text-sm">Sl. no</th>
              {PARENT_COLS.map((col) => (
                <SortFilterHeader
                  key={col.key}
                  colKey={col.key}
                  label={col.label}
                  align={col.align}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  filterConfig={filterConfig}
                  onOpenFilter={openFilter}
                  isFilterActive={isFilterActive}
                />
              ))}
              <th className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap text-sm text-center w-[52px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={PARENT_COLS.length + 2} className="text-center py-6 text-sm text-gray-400 border border-[#e6e4e4]">
                  No records found
                </td>
              </tr>
            ) : sorted.map((row, idx) => {
              const isExpanded = expandedRows.has(row._origIdx ?? idx);
              const rowKey     = row._origIdx ?? idx;
              const billings   = [...(row.grnBillings || []), ...(row.srnBillings || [])];
              const hasBillings = billings.length > 0;
              const isEven     = idx % 2 === 0;

              return (
                <React.Fragment key={`brr-${rowKey}`}>
                  <tr
                    onClick={() => hasBillings && toggleRow(rowKey)}
                    className={`cursor-pointer ${isEven ? "bg-[#f2f2f2]" : "bg-white"} hover:bg-[#e6e6e6]`}
                  >
                    <td className="border border-[#e6e4e4] px-2 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasBillings
                          ? isExpanded
                            ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                            : <ChevronRight size={14} className="text-gray-500 shrink-0" />
                          : <span className="w-[14px]" />}
                        <span className="font-semibold">{idx + 1}</span>
                      </div>
                    </td>
                    <td
                      className="border border-[#e6e4e4] px-2 py-1 text-blue-600 font-medium cursor-pointer hover:underline"
                      onClick={(e) => { e.stopPropagation(); onParentRowClick && onParentRowClick(row); }}
                    >
                      <TruncatedCell value={row.brrNo || "-"} maxW="max-w-[110px]" />
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1 whitespace-nowrap">{row.brrDate || "-"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1">
                      <TruncatedCell value={row.partyName || "-"} maxW="max-w-[160px]" />
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1">
                      <TruncatedCell value={row.orderCategory?.replace(/_/g, " ") || "-"} maxW="max-w-[140px]" />
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1">
                      <TruncatedCell value={row.orderNo || "-"} maxW="max-w-[120px]" />
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1">
                      <TruncatedCell value={row.partyBillNo || "-"} maxW="max-w-[120px]" />
                    </td>
                    <td className="border border-[#e6e4e4] px-2 py-1 text-right whitespace-nowrap">{row.basicAmount}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1 text-right whitespace-nowrap">{row.totalAmount}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1 text-right whitespace-nowrap">{row.bookedAmount ?? "-"}</td>
                    <td className="border border-[#e6e4e4] px-2 py-1 text-center"><StatusBadge value={row.status} /></td>
                    <td
                      className="border border-[#e6e4e4] px-2 py-1 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const isApproved = (row.status || "").toLowerCase() === "approved";
                        return (
                          <button
                            type="button"
                            title={isApproved
                              ? `Create ${row.billingType === "grn" ? "GRN" : "SRN"} Billing`
                              : "BRR must be Approved"}
                            disabled={!isApproved}
                            onClick={() => onCreateBilling && onCreateBilling(row)}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors
                              ${isApproved
                                ? "bg-[#7fc3d4] border border-[#4a9fb5] text-black hover:bg-[#6ab8cb] cursor-pointer"
                                : "bg-gray-100 border border-gray-300 text-gray-300 cursor-not-allowed opacity-50"
                              }`}
                          >
                            <Plug size={13} />
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                  {isExpanded && hasBillings && (
                    <tr key={`brr-expanded-${rowKey}`}>
                      <td colSpan={PARENT_COLS.length + 2} className="p-0 border border-[#e6e4e4]">
                        <ChildTable
                          billings={billings}
                          orderCategory={row.orderCategory}
                          onChildRowClick={(childRow) => onChildRowClick && onChildRowClick(childRow, row)}
                          search={search}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
