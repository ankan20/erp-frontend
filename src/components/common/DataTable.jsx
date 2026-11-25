"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useColumnResize } from "@/hooks/useColumnResize";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Search } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { isTypingTarget, topDialog } from "@/lib/shortcuts";
import Pagination, { PAGE_SIZE_OPTIONS } from "@/components/common/Pagination";
import { CREATED_ON_KEY, CREATED_TS_KEY, parseCreatedAt, formatCreatedOn, rowCreatedAt } from "@/lib/createdOn";

function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
function writeSession(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Workflow sort order — statuses not listed here rank 999 and sort alphabetically among themselves
const STATUS_RANK = { draft: 0, ongoing: 2, approved: 3, completed: 4, reback: 5, rejected: 6, reject: 6 };

const getStatusRank = (val) => {
  if (!val) return 999;
  const key = String(val).toLowerCase();
  if (key.startsWith("pending")) return 1; // pending, pending_l1, pending_l2 … all group here
  return STATUS_RANK[key] ?? 999;
};

const STATUS_STYLES = {
  active:     "bg-emerald-100 text-emerald-700",
  inactive:   "bg-red-100 text-red-600",
  approved:   "bg-green-100 text-green-700",
  completed:  "bg-green-100 text-green-700",
  ongoing:    "bg-amber-100 text-amber-700",
  draft:      "bg-gray-100 text-gray-600",
  reback:     "bg-amber-100 text-amber-700",
  reject:     "bg-red-100 text-red-600",
  rejected:   "bg-red-100 text-red-600",
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

// Optional per-column action (opt-in via `column.action`). Columns without it
// render exactly as before.
//   action: {
//     onClick:  (row, event) => void,           // required
//     label:    string | (row) => ReactNode,     // default "Open"
//     title:    string | (row) => string,        // optional tooltip / aria-label
//     hidden:   (row) => boolean,                // show "-" instead of a button
//     disabled: (row) => boolean,
//   }
// The click never reaches the cell / row handlers, so it cannot expand the cell,
// trigger onRowClick (document-number navigation) or sort/filter anything.
function ActionCell({ action, row }) {
  if (action.hidden?.(row)) return <span className="text-gray-400">-</span>;
  const label = typeof action.label === "function" ? action.label(row) : action.label ?? "Open";
  const title = typeof action.title === "function" ? action.title(row) : action.title;
  const disabled = !!action.disabled?.(row);
  return (
    <button
      type="button"
      title={title}
      aria-label={title || (typeof label === "string" ? label : undefined)}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) action.onClick?.(row, e);
      }}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-[#6d9dc5] bg-[#e8f2ff] px-2 py-[1px] text-[11px] font-medium text-[#144664] hover:brightness-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function DataTable({
  columns: columnsProp = [],
  data: dataProp = [],
  // "Created On" (DB entry time) column — added on its own whenever the rows
  // carry `createdTs` (sent by every list API); pass false to hide it on a table where it does not fit.
  showCreatedOn = true,
  onRowClick,
  storageKey,          // optional override; defaults to current pathname
  pendingDeleteIds,    // Set<number> — rows with pending delete requests get an orange dot
  summaryRow,          // { [accessor]: true } — columns to sum in a footer row; omit or {} = no footer
  // ─── PAGINATION (uniform on every list)
  // Client mode (default): all rows are fetched; the table pages them AFTER
  // filter + sort, so column filters / sort / totals still cover every row.
  // Server mode: pass the API's `pagination` block ({ page, limit, total,
  // totalPages }) and onPageChange(page, limit) to fetch that page.
  paginate = true,     // false = render every row (small tables, modals)
  pageSize = 25,       // client-mode default rows per page
  pagination,          // server meta from the API response
  onPageChange,        // (page, limit) => void — server mode
  loading = false,
  // ─── ROW SELECTION (opt-in, e.g. bulk approve). A tick box is drawn in the
  // first (Sl. no) column; the header box ticks every selectable row that
  // passes the current filters, on all pages.
  //   selection: { keys: Set, getKey: (row) => key, isSelectable: (row) => bool,
  //                onChange: (nextSet) => void }
  selection,
}) {
  // ─── CREATED ON (auto column, before trailing action columns)
  const hasCreated = showCreatedOn
    && !columnsProp.some((c) => c.accessor === "createdTs" || c.accessor === CREATED_ON_KEY)
    && dataProp.some((r) => rowCreatedAt(r) != null);
  const data = useMemo(() => (hasCreated
    ? dataProp.map((r) => {
        const ts = parseCreatedAt(rowCreatedAt(r));
        return { ...r, [CREATED_TS_KEY]: ts, [CREATED_ON_KEY]: formatCreatedOn(ts) };
      })
    : dataProp), [dataProp, hasCreated]);
  const columns = useMemo(() => {
    if (!hasCreated) return columnsProp;
    let at = columnsProp.length;
    while (at > 1 && columnsProp[at - 1].action) at--;
    const col = { header: "Created On", accessor: CREATED_ON_KEY, width: "165px" };
    return [...columnsProp.slice(0, at), col, ...columnsProp.slice(at)];
  }, [columnsProp, hasCreated]);

  const pathname = usePathname();
  const tableKey = `table-state:${storageKey ?? pathname}`;

  const saved = readSession(tableKey);

  // ─── SORT
  const [sortConfig, setSortConfig] = useState(saved?.sortConfig ?? { key: null, direction: null });

  // 3-state cycle: asc → desc → reset (null)
  const handleSort = (accessor) => {
    setSortConfig((prev) => {
      const next = prev.key !== accessor
        ? { key: accessor, direction: "asc" }
        : prev.direction === "asc"
          ? { key: accessor, direction: "desc" }
          : { key: null, direction: null };
      writeSession(tableKey, { ...readSession(tableKey), sortConfig: next });
      return next;
    });
  };

  // ─── FILTER
  // filterConfig: { [accessor]: string[] } — selected values per column
  // Empty array or missing key = no filter on that column (show all)
  const [filterConfig, setFilterConfig] = useState(saved?.filterConfig ?? {});

  // Which column's dropdown is open + its screen position
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Search text inside the open filter dropdown
  const [filterSearch, setFilterSearch] = useState("");

  const dropdownRef = useRef(null);
  const { tableRef } = useColumnResize();

  // Close dropdown on outside click
  useEffect(() => {
    if (!activeFilterCol) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveFilterCol(null);
        setFilterSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [activeFilterCol]);

  // Open filter dropdown — position fixed below the clicked icon
  const openFilter = (e, accessor) => {
    e.stopPropagation(); // don't trigger sort
    if (activeFilterCol === accessor) {
      setActiveFilterCol(null);
      setFilterSearch("");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const DROPDOWN_WIDTH = 200;
    // FIXED: if dropdown would overflow right edge, anchor to right side of icon instead
    const left =
      rect.left + DROPDOWN_WIDTH > window.innerWidth
        ? rect.right - DROPDOWN_WIDTH
        : rect.left;
    setDropdownPos({ top: rect.bottom + 2, left });
    setActiveFilterCol(accessor);
    setFilterSearch("");
  };

  // Unique values for active column — derived from original data (like Excel)
  const getUniqueValues = useCallback((accessor) => {
    const seen = new Set();
    data.forEach((row) => {
      const v = row[accessor];
      seen.add(v === null || v === undefined ? "-" : String(v));
    });
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [data]);

  const updateFilterConfig = (updater) => {
    setFilterConfig((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeSession(tableKey, { ...readSession(tableKey), filterConfig: next });
      return next;
    });
  };

  const toggleFilterValue = (accessor, value) => {
    updateFilterConfig((prev) => {
      const current = prev[accessor] || [];
      const exists = current.includes(value);
      const updated = exists
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [accessor]: updated };
    });
  };

  const toggleSelectAll = (accessor) => {
    const unique = getUniqueValues(accessor);
    const current = filterConfig[accessor] || [];
    const allSelected = current.length === 0 || current.length === unique.length;
    updateFilterConfig((prev) => ({
      ...prev,
      [accessor]: allSelected ? [] : unique,
    }));
  };

  const isFilterActive = (accessor) => {
    const selected = filterConfig[accessor];
    return selected && selected.length > 0;
  };

  const clearFilter = (accessor) => {
    updateFilterConfig((prev) => ({ ...prev, [accessor]: [] }));
  };

  // ─── DATA PIPELINE: filter first, then sort 
  const filteredData = data.filter((row) =>
    Object.entries(filterConfig).every(([accessor, selected]) => {
      if (!selected || selected.length === 0) return true;
      const val = row[accessor];
      const strVal = val === null || val === undefined ? "-" : String(val);
      return selected.includes(strVal);
    })
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (sortConfig.key === CREATED_ON_KEY) {
      const ta = a[CREATED_TS_KEY] ?? -Infinity;
      const tb = b[CREATED_TS_KEY] ?? -Infinity;
      if (ta === tb) return 0;
      return sortConfig.direction === "asc" ? (ta < tb ? -1 : 1) : (ta < tb ? 1 : -1);
    }
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";

    // Status columns — workflow order; same-rank values (e.g. pending_l1 vs pending_l2) sort alphabetically
    if (sortConfig.key?.toLowerCase().endsWith("status")) {
      const rankA = getStatusRank(valA);
      const rankB = getStatusRank(valB);
      if (rankA !== rankB) {
        return sortConfig.direction === "asc" ? rankA - rankB : rankB - rankA;
      }
      return sortConfig.direction === "asc"
        ? String(valA).toLowerCase().localeCompare(String(valB).toLowerCase())
        : String(valB).toLowerCase().localeCompare(String(valA).toLowerCase());
    }

    // Date-aware comparison — handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const parseDate = (v) => {
      const s = String(v).trim();
      // DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
      // YYYY-MM-DD or YYYY/MM/DD
      const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (ymd) return new Date(s);
      // DD MMM YYYY (e.g. "28 May 2026")
      const dmmmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
      if (dmmmy) return new Date(s);
      return null;
    };
    const dateA = parseDate(valA);
    const dateB = parseDate(valB);
    if (dateA && dateB && !isNaN(dateA) && !isNaN(dateB)) {
      return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
    }

    // Numeric-aware comparison — strip commas and leading currency symbols (₹, $, etc.)
    const toNum = (v) => parseFloat(String(v).replace(/,/g, "").replace(/^[^\d\-\.]+/, ""));
    const numA = toNum(valA);
    const numB = toNum(valB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return sortConfig.direction === "asc" ? numA - numB : numB - numA;
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return sortConfig.direction === "asc" ? -1 : 1;
    if (strA > strB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // ─── PAGE (client mode slices sortedData; server mode shows rows as given)
  const serverMode = !!pagination && !!onPageChange;
  const [clientLimit, setClientLimit] = useState(() => saved?.pageSize ?? pageSize);
  // back to page 1 whenever the visible set changes (new rows, filter, sort):
  // the page is remembered together with the set it belongs to. Keyed on the
  // row count, not the array — callers often pass data={list.map(...)}.
  const resetKey = `${data.length}|${JSON.stringify(filterConfig)}|${sortConfig.key}|${sortConfig.direction}`;
  const [pageState, setPageState] = useState({ key: resetKey, page: 1 });
  const clientPage = pageState.key === resetKey ? pageState.page : 1;
  const setClientPage = (p) => setPageState({ key: resetKey, page: p });
  const clientTotalPages = Math.max(1, Math.ceil(sortedData.length / clientLimit));
  const currentPage = serverMode ? pagination.page || 1 : Math.min(clientPage, clientTotalPages);


  // ─── SELECTION (opt-in)
  const selectableRows = selection ? sortedData.filter((r) => selection.isSelectable?.(r) ?? true) : [];
  const selectedVisible = selection ? selectableRows.filter((r) => selection.keys.has(selection.getKey(r))).length : 0;
  const allVisibleSelected = selectableRows.length > 0 && selectedVisible === selectableRows.length;
  const toggleRowSelected = (row) => {
    const key = selection.getKey(row);
    const next = new Set(selection.keys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  };
  const toggleAllSelected = () => {
    const next = new Set(selection.keys);
    selectableRows.forEach((r) => (allVisibleSelected ? next.delete(selection.getKey(r)) : next.add(selection.getKey(r))));
    selection.onChange(next);
  };

  const pageRows = serverMode || !paginate
    ? sortedData
    : sortedData.slice((currentPage - 1) * clientLimit, currentPage * clientLimit);

  const pagerProps = serverMode
    ? {
        page: currentPage,
        totalPages: pagination.totalPages || 1,
        total: pagination.total || 0,
        limit: pagination.limit,
        onPage: (p) => onPageChange(p, pagination.limit),
        onLimit: (n) => onPageChange(1, n),
      }
    : {
        page: currentPage,
        totalPages: clientTotalPages,
        total: sortedData.length,
        limit: clientLimit,
        onPage: setClientPage,
        onLimit: (n) => {
          setClientLimit(n);
          setClientPage(1);
          writeSession(tableKey, { ...readSession(tableKey), pageSize: n });
        },
      };

  // ─── EXPANDED CELL (existing) 
  const [expandedCell, setExpandedCell] = useState(null);

  // ─── KEYBOARD: ↑ / ↓ move the highlighted row, Enter opens it
  // (same as clicking the document number in the second column)
  const [activeRow, setActiveRow] = useState(null);
  const containerRef = useRef(null);
  const keyNav = useRef({});
  const activeIndex = activeRow != null && activeRow < pageRows.length ? activeRow : null;

  useEffect(() => {
    keyNav.current = { rows: pageRows, onRowClick, activeIndex, filterOpen: !!activeFilterCol };
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
      const box = containerRef.current;
      const { rows, onRowClick: open, activeIndex: current, filterOpen } = keyNav.current;
      if (!box || !rows.length || filterOpen || topDialog() || isTypingTarget(e.target)) return;
      // only the first table on the screen answers (a hidden tab's table does not)
      const first = Array.from(document.querySelectorAll("[data-key-table]")).find((el) => el.getClientRects().length);
      if (first !== box) return;
      // leave open drop-downs and menus alone
      if (e.target.closest?.('[role="listbox"], [role="menu"], [role="combobox"]')) return;

      if (e.key === "Enter") {
        // only when the table itself has the focus (set by the arrow keys)
        if (current == null || !open || !box.contains(document.activeElement)) return;
        e.preventDefault();
        open(rows[current]);
        return;
      }
      e.preventDefault();
      const next =
        current == null
          ? e.key === "ArrowDown" ? 0 : rows.length - 1
          : Math.min(Math.max(current + (e.key === "ArrowDown" ? 1 : -1), 0), rows.length - 1);
      setActiveRow(next);
      box.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (activeIndex == null) return;
    containerRef.current?.querySelector('tr[data-active-row="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const getAlignClass = (align) => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  // ─── FILTER DROPDOWN CONTENT 
  const renderFilterDropdown = () => {
    if (!activeFilterCol) return null;

    const unique = getUniqueValues(activeFilterCol);
    const selected = filterConfig[activeFilterCol] || [];

    const visibleValues = filterSearch.trim()
      ? unique.filter((v) =>
          v.toLowerCase().includes(filterSearch.trim().toLowerCase())
        )
      : unique;

    // All selected means no explicit filter (show all)
    const allChecked = selected.length === 0 || selected.length === unique.length;
    const someChecked = selected.length > 0 && selected.length < unique.length;

    return (
      <div
        ref={dropdownRef}
        style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        className="
          w-[200px]
          bg-white
          border border-gray-200
          rounded-lg
          shadow-xl
          overflow-hidden
          select-none
        "
        // Prevent table scroll from closing dropdown
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search inside dropdown */}
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

        {/* Select All */}
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

        {/* Value list */}
        <div className="max-h-[200px] overflow-y-auto">
          {visibleValues.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400 text-center">No results</div>
          ) : (
            visibleValues.map((val) => {
              const checked = selected.length === 0 ? true : selected.includes(val);
              return (
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
                  <span className="text-xs text-gray-700 whitespace-normal break-words">{val}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ─── RENDER
  return (
    <TooltipProvider>
    <div
      ref={containerRef}
      data-key-table
      tabIndex={-1}
      className="border border-[#9e9e9e] overflow-x-auto outline-none"
    >
      <div className="max-h-[608px] overflow-y-auto">

        <table ref={tableRef} className="w-full min-w-max table-fixed border-collapse text-sm">

          <thead className="bg-[#144664] sticky top-0 z-10">
            <tr>
              {columns.map((col, index) => {
                const width = col.width || (index === 0 ? "65px" : undefined);

                // index 0 (sl no) — no sort, no filter
                // action columns (opt-in) default to no sort / filter
                const isSortable = index !== 0 && col.sortable !== false && (!col.action || col.sortable === true);
                const isFilterable = index !== 0 && col.filterable !== false && (!col.action || col.filterable === true);
                const filterOn = isFilterActive(col.accessor);

                return (
                  <th
                    key={index}
                    style={width ? { width, minWidth: width, maxWidth: width } : {}}
                    className={`border border-[#2e5a72] px-2 py-1 font-semibold whitespace-nowrap text-white text-left${col.thClass ? ` ${col.thClass}` : ""}`}
                  >
                    <div className="flex items-center justify-between gap-1">

                      {/* Select-all tick box (selection mode, first column) */}
                      {selection && index === 0 && (
                        <input
                          type="checkbox"
                          aria-label="Select all rows"
                          title={selectableRows.length ? "Select all rows you can act on" : "No rows you can act on"}
                          disabled={!selectableRows.length}
                          checked={allVisibleSelected}
                          ref={(el) => { if (el) el.indeterminate = selectedVisible > 0 && !allVisibleSelected; }}
                          onChange={toggleAllSelected}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      )}

                      {/* Column label — click to sort if sortable */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            onClick={isSortable ? () => handleSort(col.accessor) : undefined}
                            className={isSortable ? "cursor-pointer flex-1 truncate min-w-0" : "flex-1 truncate min-w-0"}
                          >
                            {col.header}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" variant="text">{col.header}</TooltipContent>
                      </Tooltip>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* SORT ICON */}
                        {isSortable && (
                          <span
                            onClick={() => handleSort(col.accessor)}
                            className="cursor-pointer text-white/70 hover:text-white"
                          >
                            {sortConfig.key === col.accessor ? (
                              sortConfig.direction === "asc"
                                ? <ArrowUp size={13} />
                                : <ArrowDown size={13} />
                            ) : (
                              <ArrowUpDown size={13} className="opacity-40" />
                            )}
                          </span>
                        )}

                        {/* FILTER ICON — blue when active */}
                        {isFilterable && (
                          <span
                            onClick={(e) => openFilter(e, col.accessor)}
                            className={`
                              cursor-pointer rounded px-0.5
                              hover:bg-black/10
                              transition-colors
                              ${filterOn ? "text-yellow-300" : "text-white/70"}
                            `}
                            title="Filter"
                          >
                            {/* Show count badge if filtered */}
                            {filterOn ? (
                              <span className="relative inline-flex items-center">
                                <ChevronDown size={13} />
                                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                  {filterConfig[col.accessor]?.length}
                                </span>
                              </span>
                            ) : (
                              <ChevronDown size={13} />
                            )}
                          </span>
                        )}
                      </div>

                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ─── SUMMARY / TOTAL ROW ─── */}
          {summaryRow && Object.keys(summaryRow).length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-[#144664] text-white text-[12px] font-semibold">
                {columns.map((col, colIndex) => {
                  const width = col.width || (colIndex === 0 ? "65px" : undefined);
                  const shouldSum = summaryRow[col.accessor];
                  const isFirstSumCol = columns.findIndex((c) => summaryRow[c.accessor]) === colIndex;

                  let content = null;
                  const summaryAlign = summaryRow[col.accessor]?.align;
                  if (shouldSum) {
                    const toNum = (v) => parseFloat(String(v ?? "").replace(/,/g, "").replace(/^[^\d\-\.]+/, "")) || 0;
                    const total = sortedData.reduce((s, row) => s + toNum(row[col.accessor]), 0);
                    content = total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  } else if (isFirstSumCol) {
                    content = "Total";
                  }

                  const sumAlignClass = summaryAlign
                    ? getAlignClass(summaryAlign)
                    : shouldSum
                      ? "text-left"
                      : isFirstSumCol ? "text-right" : "";

                  return (
                    <td
                      key={colIndex}
                      style={width ? { width, minWidth: width, maxWidth: width } : {}}
                      className={`border border-[#2e5a72] px-2 py-1 whitespace-nowrap ${sumAlignClass}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}

          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-6 text-sm text-gray-400 border border-[#e6e4e4]"
                >
                  No records found
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIndex) => {
                // workflow lists key rows by `_id` (BulkWorkflowTable rowId="_id"), others by `id`
                const hasPendingDelete = pendingDeleteIds?.has(Number(row.id ?? row._id));
                return (
                <tr
                  key={rowIndex}
                  data-active-row={rowIndex === activeIndex}
                  className={`
                    ${rowIndex === activeIndex ? "outline outline-2 -outline-offset-2 outline-[#2f6f9f] !bg-[#dbeafe]" : ""}
                    ${hasPendingDelete
                      ? "bg-orange-50 hover:bg-orange-100 border-l-2 border-l-orange-400"
                      : rowIndex % 2 === 0 ? "bg-[#f2f2f2] hover:bg-[#e6e6e6]" : "bg-white hover:bg-[#e6e6e6]"}
                  `}
                >
                  {columns.map((col, colIndex) => {
                    const width = col.width || (colIndex === 0 ? "65px" : undefined);

                    // EXISTING: expandedCell tracks by rowIndex — known limitation
                    const isExpanded =
                      expandedCell?.page === currentPage &&
                      expandedCell?.row === rowIndex &&
                      expandedCell?.col === colIndex;

                    return (
                      <td
                        key={colIndex}
                        style={width ? { width, minWidth: width, maxWidth: width } : {}}
                        onClick={() => {
                          // opt-in action cells handle their own clicks
                          if (col.action) return;
                          setExpandedCell((prev) =>
                            prev?.page === currentPage && prev?.row === rowIndex && prev?.col === colIndex
                              ? null
                              : { row: rowIndex, col: colIndex, page: currentPage }
                          );
                          // EXISTING: colIndex 1 triggers row navigation
                          if (colIndex === 1 && onRowClick) {
                            onRowClick(row);
                          }
                        }}
                        className={`
                          border border-[#e6e4e4] px-2 py-1 ${col.action ? "" : "cursor-pointer"}
                          ${getAlignClass(col.align)}
                          ${colIndex === 1 && !col.action ? "text-blue-600" : ""}
                          ${col.tdClass || ""}
                        `}
                      >
                        {(() => {
                          const isStatus = col.accessor?.toLowerCase().endsWith("status");
                          const rawText  = row[col.accessor] == null || row[col.accessor] === "" ? "-" : String(row[col.accessor]);
                          const content  = col.action
                            ? <ActionCell action={col.action} row={row} />
                            : col.render
                            ? col.render(row)
                            : isStatus
                              ? <StatusBadge value={row[col.accessor]} />
                              : rawText;

                          // Blinking orange dot on sl column for pending delete rows
                          const slDot = (hasPendingDelete && colIndex === 0) ? (
                            <span className="relative flex h-2 w-2 shrink-0 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                            </span>
                          ) : null;

                          const tick = (selection && colIndex === 0) ? (() => {
                            const can = selection.isSelectable?.(row) ?? true;
                            return (
                              <input
                                type="checkbox"
                                aria-label="Select row"
                                disabled={!can}
                                title={can ? undefined : "Not waiting for your action"}
                                checked={can && selection.keys.has(selection.getKey(row))}
                                onChange={() => toggleRowSelected(row)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-3.5 w-3.5 shrink-0 mr-1 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                              />
                            );
                          })() : null;

                          const justifyClass = col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start";
                          const inner = (
                            <div className={`flex items-center gap-0.5 ${justifyClass} ${isExpanded ? "whitespace-normal break-words" : "truncate whitespace-nowrap overflow-hidden"}`}>
                              {tick}
                              {slDot}
                              {content}
                            </div>
                          );
                          if (!col.action && !col.render && !isStatus && !isExpanded) {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>{inner}</TooltipTrigger>
                                <TooltipContent side="top" variant="text">{rawText}</TooltipContent>
                              </Tooltip>
                            );
                          }
                          return inner;
                        })()}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
          </tbody>

        </table>
      </div>

      {/* Filter dropdown — rendered outside table flow via fixed position */}
      {renderFilterDropdown()}
    </div>
    {(paginate || serverMode) && (
      <Pagination
        {...pagerProps}
        loading={loading}
        pageSizeOptions={PAGE_SIZE_OPTIONS.includes(pagerProps.limit) || !pagerProps.limit
          ? PAGE_SIZE_OPTIONS
          : [...PAGE_SIZE_OPTIONS, pagerProps.limit].sort((a, b) => a - b)}
        className="border border-t-0"
      />
    )}
    </TooltipProvider>
  );
}

// example use
// const columns = [
//   { header: "Sl. no", accessor: "sl" },                              // auto 65px, no sort/filter
//   { header: "Asset Code", accessor: "assetCode", width: "150px" },   // sort + filter
//   { header: "Asset Name", accessor: "assetName", width: "250px" },   // sort + filter
//   { header: "Category", accessor: "assetCategoryName" },             // sort + filter
//   { header: "Unit", accessor: "unit", align: "center" },             // sort + filter
//   { header: "HSN", accessor: "hsnSac", align: "right" },             // sort + filter
//   { header: "GST%", accessor: "gstPercentage", align: "right", width: "100px" }, // sort + filter
//   { header: "Action", accessor: "action", sortable: false, filterable: false },  // opt-out both
//   { header: "Open", accessor: "open", width: "90px",                  // opt-in action button
//     action: { label: "Open", onClick: (row) => router.push(row.href), hidden: (row) => !row.href } },
// ];
