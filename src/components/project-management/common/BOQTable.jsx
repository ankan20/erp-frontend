"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { getInputClass } from "@/lib/formStyles";

/**
 * Common BOQ (Bill of Quantity) table for project-management modules.
 *
 * Supports columns where a single cell renders two stacked values — e.g.
 * Item Code shows displayCode (label) with itemCode (value) below.
 *
 * columns prop shape:
 * [
 *   { key: "slNo",           header: "SL no",                     type: "index",   width: "50px"  },
 *   { key: "itemDisplayCode",header: "Item Code",                  type: "dual",    width: "120px",
 *     secondKey: "itemCode", secondLabel: true },        // shows itemDisplayCode top, itemCode small
 *   { key: "itemNameDesc",   header: "Item Name & Description",    type: "expand",  width: "260px" },
 *   { key: "unit",           header: "Unit",                       type: "text",    width: "80px",  align: "center" },
 *   { key: "orderQty",       header: "Order Qty",                  type: "number",  width: "100px", align: "right"  },
 *   { key: "rate",           header: "Rate",                       type: "number",  width: "100px", align: "right"  },
 *   { key: "amount",         header: "Amount",                     type: "computed",width: "110px", align: "right"  },
 * ]
 */

const fmt = (val) => {
  const n = Number(val);
  if (!val || isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function BOQTable({
  title = "Bill of Quantity [BOQ]",
  columns = [],
  fields = [],
  register,
  setValue,
  watch,
  append,
  remove,
  errors,
  disabled = false,
  defaultRow = {},
  footerTotals = {},
}) {
  const scrollRef = useRef(null);

  const handleAddRow = () => {
    append(defaultRow);
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  };

  const getAlign = (align) => {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right pr-2";
    return "text-left";
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="border border-[#b5b5b5]">
        {/* TABLE TITLE */}
        <div className="bg-[#d6e4f5] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[15px] text-[#1c3a5e]">
          {title}
        </div>

        {/* SCROLLABLE TABLE */}
        <div ref={scrollRef} className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full border-collapse text-sm table-fixed" style={{ minWidth: columns.reduce((s, c) => s + parseInt(c.width || "100"), 0) + (disabled ? 0 : 50) }}>

            {/* HEADER */}
            <thead className="sticky top-0 z-20 bg-[#3b6ea5] text-white">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className={`border border-[#2a5080] px-2 py-1.5 font-semibold text-[12px] ${getAlign(col.align)}`}
                  >
                    {col.header}
                  </th>
                ))}
                {!disabled && (
                  <th className="border border-[#2a5080] w-[44px] text-center text-[12px]">Del</th>
                )}
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f8fc]"}>
                  {columns.map((col) => {
                    const cellKey = `items.${index}.${col.key}`;
                    const val = watch?.(cellKey);

                    if (col.type === "index") {
                      return (
                        <td key={col.key} className="border border-[#ccc] text-center bg-[#edf4fb] text-[13px] font-medium">
                          {index + 1}
                        </td>
                      );
                    }

                    if (col.type === "dual") {
                      const displayVal = watch?.(`items.${index}.${col.key}`) || "";
                      const storedVal = col.secondKey ? watch?.(`items.${index}.${col.secondKey}`) || "" : "";
                      return (
                        <td key={col.key} className={`border border-[#ccc] p-0 ${getAlign(col.align)}`}>
                          <div className="px-1 py-0.5">
                            <Input
                              {...(register ? register(`items.${index}.${col.key}`) : {})}
                              disabled={disabled}
                              placeholder="Code"
                              className={`
                                ${getInputClass(errors?.items?.[index]?.[col.key], disabled)}
                                border-0 rounded-none h-[26px] text-[12px] px-1
                              `}
                            />
                            {col.secondKey && (
                              <Input
                                {...(register ? register(`items.${index}.${col.secondKey}`) : {})}
                                disabled={disabled}
                                placeholder="Value"
                                className={`
                                  ${getInputClass(false, disabled)}
                                  border-0 rounded-none h-[22px] text-[10px] px-1 text-gray-500 mt-0.5
                                `}
                              />
                            )}
                          </div>
                        </td>
                      );
                    }

                    if (col.type === "expand") {
                      const expandVal = watch?.(`items.${index}.${col.key}`) || "";
                      return (
                        <td key={col.key} className="border border-[#ccc] p-0">
                          <ExpandableTextField
                            value={expandVal}
                            onChange={(v) => setValue?.(`items.${index}.${col.key}`, v, { shouldDirty: true })}
                            disabled={disabled}
                            title={col.header}
                            placeholder={col.placeholder || "Enter text..."}
                            minHeight="min-h-[36px]"
                            modalHeight="min-h-[220px]"
                          />
                        </td>
                      );
                    }

                    if (col.type === "computed") {
                      return (
                        <td key={col.key} className={`border border-[#ccc] bg-[#edf8ed] px-2 text-[13px] font-medium ${getAlign(col.align)}`}>
                          {fmt(val)}
                        </td>
                      );
                    }

                    if (col.type === "number") {
                      return (
                        <td key={col.key} className="border border-[#ccc] p-0">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            {...(register ? register(`items.${index}.${col.key}`, {
                              min: 0,
                              onChange: (e) => {
                                if (Number(e.target.value) < 0) e.target.value = 0;
                              },
                            }) : {})}
                            disabled={disabled}
                            className={`
                              ${getInputClass(errors?.items?.[index]?.[col.key], disabled)}
                              border-0 rounded-none h-[36px] text-[13px] ${getAlign(col.align)}
                            `}
                          />
                        </td>
                      );
                    }

                    // default: text
                    return (
                      <td key={col.key} className="border border-[#ccc] p-0">
                        <Input
                          {...(register ? register(`items.${index}.${col.key}`) : {})}
                          disabled={disabled}
                          className={`
                            ${getInputClass(errors?.items?.[index]?.[col.key], disabled)}
                            border-0 rounded-none h-[36px] text-[13px] ${getAlign(col.align)}
                          `}
                        />
                      </td>
                    );
                  })}

                  {/* DELETE */}
                  {!disabled && (
                    <td className="border border-[#ccc] text-center">
                      <button
                        type="button"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        className="inline-flex items-center justify-center disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>

            {/* FOOTER */}
            <tfoot className="sticky bottom-0 z-10 bg-[#b7d5f0]">
              <tr className="font-bold">
                {columns.map((col, i) => {
                  const total = footerTotals[col.key];
                  const isLabelCol = i === columns.length - 2;
                  return (
                    <td
                      key={col.key}
                      className={`border border-[#9ec5e0] px-2 py-1 text-[13px] ${getAlign(col.align)}`}
                    >
                      {i === 0 ? "" :
                       isLabelCol ? "TOTAL=" :
                       total !== undefined ? fmt(total) : ""}
                    </td>
                  );
                })}
                {!disabled && <td className="border border-[#9ec5e0]" />}
              </tr>
            </tfoot>

          </table>
        </div>
      </div>

      {/* ADD ROW */}
      {!disabled && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-4 py-1 bg-[#9fc5e8] border border-[#6d9dc5] rounded-sm text-sm font-medium hover:brightness-95 cursor-pointer"
          >
            + Add Row
          </button>
        </div>
      )}
    </div>
  );
}
