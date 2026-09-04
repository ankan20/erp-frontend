"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";


const STATUS_RANK = { draft: 0, ongoing: 2, approved: 3, completed: 4, reback: 5, rejected: 6, reject: 6 };

const getStatusRank = (val) => {
  if (!val) return 999;
  const key = String(val).toLowerCase();
  if (key.startsWith("pending")) return 1;
  return STATUS_RANK[key] ?? 999;
};

const CHILD_COLS = [
  { key: "itemCode",    label: "Item Code",    cls: "text-left",   cellCls: "text-blue-600 font-medium", numeric: false },
  { key: "itemName",    label: "Item Name",    cls: "text-left",   cellCls: "truncate",                  numeric: false },
  { key: "unit",        label: "Unit",         cls: "text-center", cellCls: "text-center text-gray-600", numeric: false },
  { key: "receivedQty", label: "Received Qty", cls: "text-right",  cellCls: "text-right",                numeric: true  },
  { key: "issuedQty",   label: "Issued Qty",   cls: "text-right",  cellCls: "text-right",                numeric: true  },
  { key: "stockQty",    label: "Stock Qty",    cls: "text-right",  cellCls: "text-right font-medium",    numeric: true  },
  { key: "stockAmount", label: "Stock Amount", cls: "text-right",  cellCls: "text-right font-medium",    numeric: true  },
];

const NON_NUMERIC_CHILD_KEYS = CHILD_COLS.filter((c) => !c.numeric).map((c) => c.key);

function ChildTable({ items: rawItems = [], onItemClick }) {
  const items = useMemo(() =>
    rawItems.map((item) => {
      const cleaned = { ...item };
      NON_NUMERIC_CHILD_KEYS.forEach((k) => {
        const v = cleaned[k];
        if (v == null || String(v).trim() === "") cleaned[k] = "-";
      });
      return cleaned;
    }),
    [rawItems]
  );

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [filterConfig, setFilterConfig] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch] = useState("");
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
    const DROPDOWN_WIDTH = 200;
    const left = rect.left + DROPDOWN_WIDTH > window.innerWidth ? rect.right - DROPDOWN_WIDTH : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(col);
    setFilterSearch("");
  };

  const getUniqueValues = useCallback((key) => {
    const seen = new Set();
    items.forEach((r) => {
      const v = r[key];
      const s = (v == null || String(v).trim() === "") ? "-" : String(v).trim();
      seen.add(s);
    });
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [items]);

  const toggleFilterValue = (col, val) => {
    setFilterConfig((prev) => {
      const cur = prev[col] || [];
      return { ...prev, [col]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] };
    });
  };

  const toggleSelectAll = (col) => {
    const unique = getUniqueValues(col);
    const cur = filterConfig[col] || [];
    setFilterConfig((prev) => ({ ...prev, [col]: (cur.length === 0 || cur.length === unique.length) ? [] : unique }));
  };

  const isFilterActive = (col) => { const s = filterConfig[col]; return s && s.length > 0; };
  const clearFilter = (col) => setFilterConfig((prev) => ({ ...prev, [col]: [] }));

  const filtered = items.filter((row) =>
    Object.entries(filterConfig).every(([col, sel]) => {
      if (!sel || sel.length === 0) return true;
      const v = row[col];
      const s = (v == null || String(v).trim() === "") ? "-" : String(v).trim();
      return sel.includes(s);
    })
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? "";
    const vb = b[sortConfig.key] ?? "";

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

    const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
    if (sa < sb) return sortConfig.direction === "asc" ? -1 : 1;
    if (sa > sb) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const fmtNum = (n) => n === null || n === undefined ? "-" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderFilterDropdown = () => {
    if (!activeFilterCol || typeof document === "undefined") return null;
    const unique = getUniqueValues(activeFilterCol);
    const selected = filterConfig[activeFilterCol] || [];
    const visible = filterSearch.trim() ? unique.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase())) : unique;
    const allChecked = selected.length === 0 || selected.length === unique.length;
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
            <input autoFocus value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400" />
          </div>
        </div>
        <div onClick={() => toggleSelectAll(activeFilterCol)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
          <input type="checkbox" readOnly checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked; }} className="cursor-pointer accent-blue-500" />
          <span className="text-xs font-semibold text-gray-600">Select All</span>
          {isFilterActive(activeFilterCol) && (
            <button onClick={(e) => { e.stopPropagation(); clearFilter(activeFilterCol); }} className="ml-auto text-[10px] text-blue-500 hover:text-blue-700 font-medium">Clear</button>
          )}
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">No results</div>
          ) : visible.map((val) => (
            <div key={val} onClick={() => toggleFilterValue(activeFilterCol, val)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
              <input type="checkbox" readOnly checked={selected.length === 0 ? false : selected.includes(val)} className="cursor-pointer accent-blue-500 shrink-0" />
              <span className="text-xs text-gray-700 truncate">{val}</span>
            </div>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  const ColHeader = ({ col }) => {
    const filterOn = isFilterActive(col.key);
    return (
      <div className={`px-2 py-1.5 border-r border-[#9e9e9e] last:border-r-0 font-semibold ${col.cls}`}>
        <div className="flex items-center justify-between gap-1">
          <span onClick={() => handleSort(col.key)} className="cursor-pointer flex-1 truncate">{col.label}</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <span onClick={() => handleSort(col.key)} className="cursor-pointer text-white/70 hover:text-white">
              {sortConfig.key === col.key
                ? sortConfig.direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                : <ArrowUpDown size={11} className="opacity-40" />}
            </span>
            <span onClick={(e) => openFilter(e, col.key)}
              className={`cursor-pointer rounded px-0.5 hover:bg-black/10 transition-colors ${filterOn ? "text-yellow-300" : "text-white/70"}`}>
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
      </div>
    );
  };

  return (
    <div className="ml-6 border-l-4 border-[#7fc3d4] bg-[#f0f7fa]">
      {/* child header */}
      <div className="grid grid-cols-[60px_120px_1fr_110px_110px_100px_100px_110px] bg-[#c5dde8] border-b border-[#9e9e9e] text-xs">
        <div className="px-2 py-1.5 border-r border-[#9e9e9e] text-center font-semibold">Sl. no</div>
        {CHILD_COLS.map((col) => <ColHeader key={col.key} col={col} />)}
      </div>

      {/* child rows */}
      {sorted.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400">No items</div>
      ) : sorted.map((item, ci) => (
        <div
          key={ci}
          onClick={(e) => { e.stopPropagation(); onItemClick && onItemClick(item); }}
          className={`grid grid-cols-[60px_120px_1fr_110px_110px_100px_100px_110px] border-b border-[#d4e8ef] cursor-pointer text-xs
            ${ci % 2 === 0 ? "bg-[#f0f7fa]" : "bg-white"} hover:bg-[#dff0f7] transition-colors`}
        >
          <div className="px-2 py-1.5 border-r border-[#d4e8ef] text-center text-gray-500">{item.slNo}</div>
          {CHILD_COLS.map((col) => (
            <div key={col.key} className={`px-2 py-1.5 border-r border-[#d4e8ef] last:border-r-0 ${col.cellCls}`}
              title={col.key === "itemName" ? item[col.key] : undefined}>
              {col.numeric ? fmtNum(item[col.key]) : (item[col.key] ?? "-")}
            </div>
          ))}
        </div>
      ))}

      {renderFilterDropdown()}
    </div>
  );
}

function SortFilterHeader({ colKey, label, sortConfig, onSort, filterConfig, onOpenFilter, isFilterActive }) {
  const filterOn = isFilterActive(colKey);
  return (
    <th className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap">
      <div className="flex items-center justify-between gap-1">
        <span onClick={() => onSort(colKey)} className="cursor-pointer flex-1 truncate">
          {label}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <span onClick={() => onSort(colKey)} className="cursor-pointer text-white/70 hover:text-white">
            {sortConfig.key === colKey
              ? sortConfig.direction === "asc"
                ? <ArrowUp size={13} />
                : <ArrowDown size={13} />
              : <ArrowUpDown size={13} className="opacity-40" />}
          </span>
          <span
            onClick={(e) => onOpenFilter(e, colKey)}
            className={`cursor-pointer rounded px-0.5 hover:bg-black/10 transition-colors ${filterOn ? "text-yellow-300" : "text-white/70"}`}
          >
            {filterOn ? (
              <span className="relative inline-flex items-center">
                <ChevronDown size={13} />
                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {filterConfig[colKey]?.length}
                </span>
              </span>
            ) : (
              <ChevronDown size={13} />
            )}
          </span>
        </div>
      </div>
    </th>
  );
}

export default function StockTable({ data = [], onItemClick, pagination, onPageChange, tableLoading }) {
  // ─── SORT (on parent rows only)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: null, direction: null };
    });
  };

  // ─── FILTER
  const [filterConfig, setFilterConfig] = useState({});
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch] = useState("");
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

  const openFilter = (e, col) => {
    e.stopPropagation();
    if (activeFilterCol === col) {
      setActiveFilterCol(null);
      setFilterSearch("");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const DROPDOWN_WIDTH = 200;
    const left =
      rect.left + DROPDOWN_WIDTH > window.innerWidth
        ? rect.right - DROPDOWN_WIDTH
        : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(col);
    setFilterSearch("");
  };

  const getUniqueValues = useCallback(
    (key) => {
      const seen = new Set();
      data.forEach((row) => {
        const v = row[key];
        const s = (v == null || String(v).trim() === "") ? "-" : String(v).trim();
        seen.add(s);
      });
      return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    },
    [data]
  );

  const toggleFilterValue = (col, val) => {
    setFilterConfig((prev) => {
      const cur = prev[col] || [];
      const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
      return { ...prev, [col]: next };
    });
  };

  const toggleSelectAll = (col) => {
    const unique = getUniqueValues(col);
    const cur = filterConfig[col] || [];
    const allSelected = cur.length === 0 || cur.length === unique.length;
    setFilterConfig((prev) => ({ ...prev, [col]: allSelected ? [] : unique }));
  };

  const isFilterActive = (col) => {
    const s = filterConfig[col];
    return s && s.length > 0;
  };

  const clearFilter = (col) => {
    setFilterConfig((prev) => ({ ...prev, [col]: [] }));
  };

  // ─── PIPELINE
  const filtered = (Array.isArray(data) ? data : []).filter((row) =>
    Object.entries(filterConfig).every(([col, sel]) => {
      if (!sel || sel.length === 0) return true;
      const v = row[col];
      const s = (v == null || String(v).trim() === "") ? "-" : String(v).trim();
      return sel.includes(s);
    })
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? "";
    const vb = b[sortConfig.key] ?? "";

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
    const dateA = parseDate(va);
    const dateB = parseDate(vb);
    if (dateA && dateB && !isNaN(dateA) && !isNaN(dateB)) {
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }

    const numA = parseFloat(String(va).replace(/,/g, ""));
    const numB = parseFloat(String(vb).replace(/,/g, ""));
    if (!isNaN(numA) && !isNaN(numB)) {
      return sortConfig.direction === "asc" ? numA - numB : numB - numA;
    }

    const sa = String(va).toLowerCase();
    const sb = String(vb).toLowerCase();
    if (sa < sb) return sortConfig.direction === "asc" ? -1 : 1;
    if (sa > sb) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // ─── PAGINATION — server-driven
  const currentPage = pagination?.currentPage ?? 1;
  const totalPages  = pagination?.totalPages  ?? 1;
  const totalGroups = pagination?.totalGroups ?? sorted.length;
  const limit       = pagination?.limit       ?? sorted.length;
  const paginated   = sorted; // already one page from server

  // ─── EXPANDED ROWS
  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRow = (idx) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const fmtNum = (n) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtQty = (n) =>
    n === null || n === undefined
      ? "-"
      : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // columns for filter/sort (exclude sl_no and expand chevron)
  const COLS = [
    { key: "ccCode", label: "Code" },
    { key: "ccName", label: "CC Name" },
    { key: "totalStockAmount", label: "Stock Amount" },
  ];

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
        <div className="px-2 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div
          onClick={() => toggleSelectAll(activeFilterCol)}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
        >
          <input
            type="checkbox"
            readOnly
            checked={allChecked}
            ref={(el) => { if (el) el.indeterminate = someChecked; }}
            className="cursor-pointer accent-blue-500"
          />
          <span className="text-xs font-semibold text-gray-600">Select All</span>
          {isFilterActive(activeFilterCol) && (
            <button
              onClick={(e) => { e.stopPropagation(); clearFilter(activeFilterCol); }}
              className="ml-auto text-[10px] text-blue-500 hover:text-blue-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">No results</div>
          ) : (
            visible.map((val) => (
              <div
                key={val}
                onClick={() => toggleFilterValue(activeFilterCol, val)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.length === 0 ? false : selected.includes(val)}
                  className="cursor-pointer accent-blue-500 shrink-0"
                />
                <span className="text-xs text-gray-700 truncate">{val}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const totalStockValue = sorted.reduce((sum, r) => sum + Number(r.totalStockAmount || 0), 0);

  return (
    <div className="xl:max-w-5xl xl:mx-auto border border-[#9e9e9e] overflow-x-auto relative">
      {/* PAGINATION LOADER OVERLAY */}
      {tableLoading && (
        <div className="absolute inset-0 z-20 bg-white/60 flex items-center justify-center">
          <Loader2 className="animate-spin w-6 h-6 text-[#4d8ea3]" />
        </div>
      )}
      <div className="max-h-[608px] overflow-y-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="bg-[#144664] sticky top-0 z-10 text-white">
            <tr>
              {/* expand + sl_no */}
              <th className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap w-[65px]">
                Sl. no
              </th>
              <SortFilterHeader colKey="ccCode" label="Code" sortConfig={sortConfig} onSort={handleSort} filterConfig={filterConfig} onOpenFilter={openFilter} isFilterActive={isFilterActive} />
              <SortFilterHeader colKey="ccName" label="CC Name" sortConfig={sortConfig} onSort={handleSort} filterConfig={filterConfig} onOpenFilter={openFilter} isFilterActive={isFilterActive} />
              <SortFilterHeader colKey="totalStockAmount" label="Stock Amount" sortConfig={sortConfig} onSort={handleSort} filterConfig={filterConfig} onOpenFilter={openFilter} isFilterActive={isFilterActive} />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-6 text-sm text-gray-400 border border-[#e6e4e4]">
                  No records found
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => {
                const globalIdx = (currentPage - 1) * limit + idx;
                const isExpanded = expandedRows.has(globalIdx);
                const isEven = idx % 2 === 0;

                return (
                  <React.Fragment key={`group-${globalIdx}`}>
                    {/* PARENT ROW */}
                    <tr
                      key={`parent-${globalIdx}`}
                      onClick={() => toggleRow(globalIdx)}
                      className={`cursor-pointer ${isEven ? "bg-[#f2f2f2]" : "bg-white"} hover:bg-[#e6e6e6]`}
                    >
                      <td className="border border-[#e6e4e4] px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                            : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
                          <span className="font-semibold">{row.slNo}</span>
                        </div>
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1 font-semibold">
                        {row.ccCode}
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1 font-semibold">
                        {row.ccName}
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1 text-right font-semibold">
                        {fmtNum(row.totalStockAmount)}
                      </td>
                    </tr>

                    {/* EXPANDED CHILD ROWS */}
                    {isExpanded && (
                      <tr key={`expanded-${globalIdx}`}>
                        <td colSpan={4} className="p-0 border border-[#e6e4e4]">
                          <ChildTable items={row.items || []} onItemClick={onItemClick} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}

            {/* TOTAL ROW */}
            <tr className="bg-[#cfe0f5] font-semibold sticky bottom-0">
              <td className="border border-[#9e9e9e] px-2 py-1" colSpan={3}>
                TOTAL STOCK VALUE
              </td>
              <td className="border border-[#9e9e9e] px-2 py-1 text-right">
                {fmtNum(totalStockValue)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#9e9e9e] bg-[#f9f9f9] text-xs text-gray-600">
          <span>
            Page {currentPage} of {totalPages} &nbsp;·&nbsp; {totalGroups} groups
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1 || tableLoading}
              onClick={() => onPageChange?.(currentPage - 1)}
              className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition"
            >
              ‹ Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    disabled={tableLoading}
                    onClick={() => onPageChange?.(p)}
                    className={`px-2 py-0.5 border rounded transition ${
                      p === currentPage
                        ? "bg-[#7fc3d4] border-[#4d8ea3] text-black font-semibold"
                        : "border-[#9e9e9e] hover:bg-[#e6e6e6]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              disabled={currentPage === totalPages || tableLoading}
              onClick={() => onPageChange?.(currentPage + 1)}
              className="px-2 py-0.5 border border-[#9e9e9e] rounded disabled:opacity-40 hover:bg-[#e6e6e6] transition"
            >
              Next ›
            </button>
          </div>
        </div>
      )}

      {renderFilterDropdown()}
    </div>
  );
}
