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

    //SORT HANDLER
    const handleSort = (accessor) => {
        let direction = "asc";

        if (
            sortConfig.key === accessor &&
            sortConfig.direction === "asc"
        ) {
            direction = "desc";
        }

        setSortConfig({ key: accessor, direction });
    };

    //SORTED DATA
    const sortedData = [...data].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;

        return 0;
    });

    return (
        <div className="border border-[#9e9e9e] overflow-hidden">

            <div className="max-h-80 overflow-y-auto">

                <table className="w-full border-collapse text-sm">

                    {/* HEADER */}
                    <thead className="bg-[#b7cfa5] sticky top-0 z-10">
                        <tr>
                            {columns.map((col, index) => (
                                <th
                                    key={index}
                                    onClick={() => handleSort(col.accessor)}
                                    className="border border-[#9e9e9e] px-2 py-1 font-semibold cursor-pointer select-none"
                                >
                                    <div className="flex items-center justify-between">

                                        {/* LEFT TEXT */}
                                        <span>{col.header}</span>

                                        {/* RIGHT ICON */}
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
                            ))}
                        </tr>
                    </thead>

                    {/* BODY */}
                    <tbody>
                        {sortedData.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={`
                  ${rowIndex % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}
                  hover:bg-[#e6e6e6]
                `}
                            >
                                {columns.map((col, colIndex) => (
                                    <td
                                        key={colIndex}
                                        onClick={() => {
                                            if (colIndex === 1 && onRowClick) {
                                                onRowClick(row);
                                            }
                                        }}
                                        className={`
                      border border-[#9e9e9e] px-2 py-1
                      ${colIndex === 1 ? "cursor-pointer text-blue-600 underline" : ""}
                    `}
                                    >
                                        {row[col.accessor] ?? "-"}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>

                </table>
            </div>
        </div>
    );
}