"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export default function DataTable({
  columns = [],
  data = [],
  onRowClick,
}) {
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: null,
  });

  const [expandedCell, setExpandedCell] = useState(null);

  const handleSort = (accessor) => {
    let direction = "asc";
    if (sortConfig.key === accessor && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: accessor, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const valA = a[sortConfig.key];
    const valB = b[sortConfig.key];

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;

    return 0;
  });

  const getAlignClass = (align) => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
  };

  return (
    <div className="border border-[#9e9e9e] overflow-x-auto">
      <div className="max-h-80 overflow-y-auto">

        {/* IMPORTANT */}
        <table className="w-full min-w-max table-fixed border-collapse text-sm">

          <thead className="bg-[#b7cfa5] sticky top-0 z-10">
            <tr>
              {columns.map((col, index) => {
                const width =
                  col.width ||
                  (index === 0 ? "65px" : undefined);

                return (
                  <th
                    key={index}
                    onClick={() => handleSort(col.accessor)}
                    style={
                      width
                        ? {
                            width,
                            minWidth: width,
                            maxWidth: width, // 🔥 LOCK WIDTH
                          }
                        : {}
                    }
                    className="border border-[#9e9e9e] px-2 py-1 font-semibold whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between">
                      <span>{col.header}</span>

                      <span className="ml-2">
                        {sortConfig.key === col.accessor ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )
                        ) : (
                          <ArrowUpDown size={14} className="opacity-50" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`
                  ${rowIndex % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}
                  hover:bg-[#e6e6e6]
                `}
              >
                {columns.map((col, colIndex) => {
                  const width =
                    col.width ||
                    (colIndex === 0 ? "65px" : undefined);

                  const isExpanded =
                    expandedCell?.row === rowIndex &&
                    expandedCell?.col === colIndex;

                  return (
                    <td
                      key={colIndex}
                      style={
                        width
                          ? {
                              width,
                              minWidth: width,
                              maxWidth: width, // 🔥 LOCK WIDTH
                            }
                          : {}
                      }
                      onClick={() => {
                        setExpandedCell((prev) =>
                          prev?.row === rowIndex && prev?.col === colIndex
                            ? null
                            : { row: rowIndex, col: colIndex }
                        );

                        if (colIndex === 1 && onRowClick) {
                          onRowClick(row);
                        }
                      }}
                      className={`
                        border border-[#e6e4e4] px-2 py-1 cursor-pointer
                        ${getAlignClass(col.align)}
                        ${colIndex === 1 ? "text-blue-600 " : ""}
                      `}
                    >
                      <div
                        className={`
                          ${
                            isExpanded
                              ? "whitespace-normal break-words"
                              : "truncate whitespace-nowrap overflow-hidden"
                          }
                        `}
                      >
                        {row[col.accessor] ?? "-"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}

// example use 
// const columns = [
//   { header: "Sl. no", accessor: "sl" }, // auto 65px

//   { header: "Asset Code", accessor: "assetCode", width: "150px" },

//   { header: "Asset Name", accessor: "assetName", width: "250px" },

//   { header: "Category", accessor: "assetCategoryName" },

//   { header: "Unit", accessor: "unit", align: "center" },

//   { header: "HSN", accessor: "hsnSac", align: "right" },

//   { header: "GST%", accessor: "gstPercentage", align: "right", width: "100px" },
// ];