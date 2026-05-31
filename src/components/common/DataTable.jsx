"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, Search } from "lucide-react";

export default function DataTable({
  columns = [],
  data = [],
  onRowClick,
}) {

  // ─── SORT 
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  // 3-state cycle: asc → desc → reset (null)
  const handleSort = (accessor) => {
    setSortConfig((prev) => {
      if (prev.key !== accessor) return { key: accessor, direction: "asc" };
      if (prev.direction === "asc") return { key: accessor, direction: "desc" };
      return { key: null, direction: null }; // FIXED: reset on third click
    });
  };

  // ─── FILTER 
  // filterConfig: { [accessor]: string[] } — selected values per column
  // Empty array or missing key = no filter on that column (show all)
  const [filterConfig, setFilterConfig] = useState({});

  // Which column's dropdown is open + its screen position
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Search text inside the open filter dropdown
  const [filterSearch, setFilterSearch] = useState("");

  const dropdownRef = useRef(null);

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

  const toggleFilterValue = (accessor, value) => {
    setFilterConfig((prev) => {
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
    // If all selected (or none selected = showing all), deselect all → show nothing
    // If some/none explicitly selected, select all → clear filter
    const allSelected = current.length === 0 || current.length === unique.length;
    setFilterConfig((prev) => ({
      ...prev,
      [accessor]: allSelected ? [] : unique,
    }));
  };

  const isFilterActive = (accessor) => {
    const selected = filterConfig[accessor];
    return selected && selected.length > 0;
  };

  const clearFilter = (accessor) => {
    setFilterConfig((prev) => ({ ...prev, [accessor]: [] }));
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
    // FIXED: null/undefined treated as empty string for safe comparison
    const valA = a[sortConfig.key] ?? "";
    const valB = b[sortConfig.key] ?? "";
    // Numeric-aware comparison
    if (!isNaN(valA) && !isNaN(valB)) {
      return sortConfig.direction === "asc"
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    }
    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();
    if (strA < strB) return sortConfig.direction === "asc" ? -1 : 1;
    if (strA > strB) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // ─── EXPANDED CELL (existing) 
  const [expandedCell, setExpandedCell] = useState(null);

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
                  <span className="text-xs text-gray-700 truncate">{val}</span>
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
    <div className="border border-[#9e9e9e] overflow-x-auto">
      <div className="max-h-80 overflow-y-auto">

        <table className="w-full min-w-max table-fixed border-collapse text-sm">

          <thead className="bg-[#b7cfa5] sticky top-0 z-10">
            <tr>
              {columns.map((col, index) => {
                const width = col.width || (index === 0 ? "65px" : undefined);

                // index 0 (sl no) — no sort, no filter
                const isSortable = index !== 0 && col.sortable !== false;
                const isFilterable = index !== 0 && col.filterable !== false;
                const filterOn = isFilterActive(col.accessor);

                return (
                  <th
                    key={index}
                    style={width ? { width, minWidth: width, maxWidth: width } : {}}
                    className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1">

                      {/* Column label — click to sort if sortable */}
                      <span
                        onClick={isSortable ? () => handleSort(col.accessor) : undefined}
                        className={isSortable ? "cursor-pointer flex-1 truncate" : "flex-1 truncate"}
                      >
                        {col.header}
                      </span>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* SORT ICON */}
                        {isSortable && (
                          <span
                            onClick={() => handleSort(col.accessor)}
                            className="cursor-pointer text-gray-600 hover:text-gray-900"
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
                              ${filterOn ? "text-blue-600" : "text-gray-500"}
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

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-6 text-sm text-gray-400 border border-[#e6e4e4]"
                >
                  No records found
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`
                    ${rowIndex % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}
                    hover:bg-[#e6e6e6]
                  `}
                >
                  {columns.map((col, colIndex) => {
                    const width = col.width || (colIndex === 0 ? "65px" : undefined);

                    // EXISTING: expandedCell tracks by rowIndex — known limitation
                    const isExpanded =
                      expandedCell?.row === rowIndex &&
                      expandedCell?.col === colIndex;

                    return (
                      <td
                        key={colIndex}
                        style={width ? { width, minWidth: width, maxWidth: width } : {}}
                        onClick={() => {
                          setExpandedCell((prev) =>
                            prev?.row === rowIndex && prev?.col === colIndex
                              ? null
                              : { row: rowIndex, col: colIndex }
                          );
                          // EXISTING: colIndex 1 triggers row navigation
                          if (colIndex === 1 && onRowClick) {
                            onRowClick(row);
                          }
                        }}
                        className={`
                          border border-[#e6e4e4] px-2 py-1 cursor-pointer
                          ${getAlignClass(col.align)}
                          ${colIndex === 1 ? "text-blue-600" : ""}
                        `}
                      >
                        <div
                          className={
                            isExpanded
                              ? "whitespace-normal break-words"
                              : "truncate whitespace-nowrap overflow-hidden"
                          }
                        >
                          {row[col.accessor] ?? "-"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>

        </table>
      </div>

      {/* Filter dropdown — rendered outside table flow via fixed position */}
      {renderFilterDropdown()}
    </div>
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
// ];
