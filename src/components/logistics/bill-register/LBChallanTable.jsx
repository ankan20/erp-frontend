"use client";

import { X, PackageX, PlusCircle, Pencil } from "lucide-react";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import { useResizableTable } from "@/hooks/useResizableTable";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Column definitions (remove button is a fixed last column, not reorderable) ─
const COLS = [
  { id: "sl",      label: "#",               w: "48px",  align: "center" },
  { id: "dcNo",    label: "DC No",            w: "130px"                  },
  { id: "date",    label: "Date",             w: "110px"                  },
  { id: "project", label: "To Project",       w: "auto"                   },
  { id: "items",   label: "Items",            w: "80px",  align: "right"  },
  { id: "status",  label: "Status",           w: "110px"                  },
  { id: "remarks", label: "Billing Remarks",  w: "220px", pencil: true    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const thCls = (col) => [
  "sticky top-0 z-10 relative bg-[#0F2A3C] text-white",
  "px-2 py-2 border-r border-[#1E4968]",
  "text-[10.5px] font-bold uppercase tracking-[0.1em] whitespace-nowrap",
  col.align === "right"  ? "text-right"  : "",
  col.align === "center" ? "text-center" : "",
].filter(Boolean).join(" ");

const tdCls = (col, extra = "") => [
  "px-2 py-1.5 border-r border-[#E5ECF0] align-middle text-[12.5px]",
  col.align === "right"  ? "text-right tabular-nums" : "",
  col.align === "center" ? "text-center" : "",
  extra,
].filter(Boolean).join(" ");

function TruncCell({ text }) {
  if (!text) return <span className="text-[#4B5A66]">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate cursor-default text-[#0F2A3C]">{text}</span>
      </TooltipTrigger>
      <TooltipContent variant="text" side="top">{text}</TooltipContent>
    </Tooltip>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LBChallanTable({
  selectedDCs,
  availableDCs,
  onAdd,
  onRemove,
  onRemarkChange,
  disabled,
}) {
  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns:    COLS,
    storageKey: "lb-challans",
  });

  const unselected = (availableDCs || []).filter(
    (dc) => !(selectedDCs || []).some((s) => String(s.dcId) === String(dc.id)),
  );

  const renderHeader = (col) => (
    <span className={`flex items-center gap-1 ${
      col.align === "right"  ? "justify-end"   :
      col.align === "center" ? "justify-center" : ""
    }`}>
      {col.label}
      {col.pencil && !disabled && <Pencil size={9} className="text-[#C97B2E]" />}
    </span>
  );

  const renderCell = (colId, dc, idx) => {
    switch (colId) {
      case "sl":
        return <span className="text-[#4B5A66] font-mono tabular-nums">{idx + 1}</span>;
      case "dcNo":
        return <span className="font-mono text-[#0F2A3C] font-medium">{dc.dcNo || "—"}</span>;
      case "date":
        return <span className="text-[#4B5A66]">{dc.challanDate || "—"}</span>;
      case "project":
        return <TruncCell text={dc.toProjectName} />;
      case "items":
        return <span className="font-mono tabular-nums text-[12px] text-[#0F2A3C]">{dc.noOfItems ?? 0}</span>;
      case "status":
        return (
          <span className="inline-block text-[10.5px] font-medium px-1.5 py-0.5 bg-[#F5E9D9] text-[#0F2A3C]">
            {dc.workflowStatus || "—"}
          </span>
        );
      case "remarks":
        return disabled ? (
          <TruncCell text={dc.billingRemarks} />
        ) : (
          <ExpandableTextArea
            value={dc.billingRemarks ?? ""}
            onChange={(v) => onRemarkChange?.(idx, v)}
            placeholder="Notes…"
            title="Billing Remarks"
            rows={1}
            maxInlineRows={3}
            modalRows={8}
          />
        );
      default: return null;
    }
  };

  const getCellCls = (colId) => {
    const col = COLS.find((c) => c.id === colId);
    if (!col) return "px-2 py-1.5 border-r border-[#E5ECF0] align-middle text-[12.5px]";
    return tdCls(col, colId === "remarks" ? "p-0" : "");
  };

  return (
    <TooltipProvider>
      <section className="border border-[#CBD5DD] bg-white overflow-hidden">
        {/* Header strip */}
        <header className="flex items-center px-3 py-2 border-b border-[#CBD5DD] bg-white gap-2.5">
          <span className="flex items-center gap-[2px]" aria-hidden="true">
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          </span>
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#0F2A3C]">
            Delivery Challans
          </h3>
          <span className="text-[10.5px] text-[#4B5A66] font-mono tabular-nums">
            · {(selectedDCs || []).length} linked
          </span>
        </header>

        {/* DC picker */}
        {!disabled && unselected.length > 0 && (
          <div className="px-3 py-2 bg-[#F5E9D9]/40 border-b border-[#CBD5DD] flex items-center gap-2">
            <PlusCircle className="w-3.5 h-3.5 text-[#C97B2E] shrink-0" />
            <select
              className="flex-1 h-[30px] px-2 text-[12.5px] bg-white border border-[#CBD5DD] rounded-none focus:outline-none focus:ring-1 focus:ring-[#C97B2E]"
              value=""
              onChange={(e) => { const v = e.target.value; if (v) onAdd(v); }}
            >
              <option value="">— Add a Delivery Challan —</option>
              {unselected.map((dc) => (
                <option key={dc.id} value={dc.id}>
                  {dc.dcNo} · {dc.challanDate || "no date"} · {dc.toProjectName || "—"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Empty state */}
        {(selectedDCs || []).length === 0 ? (
          <div className="p-10 flex flex-col items-center gap-3 text-center bg-[#FBFAF6]">
            <div className="w-12 h-12 rounded-full bg-[#F5E9D9] flex items-center justify-center">
              <PackageX className="w-5 h-5 text-[#C97B2E]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#0F2A3C]">No Delivery Challans linked</p>
              <p className="text-[12px] text-[#4B5A66] mt-0.5">
                {disabled
                  ? "This bill has no DCs attached."
                  : "Pick approved, delivered DCs from the dropdown above."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table ref={tableRef} className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr>
                  {columnOrder.map((colId) => {
                    const col = COLS.find((c) => c.id === colId);
                    if (!col) return null;
                    return (
                      <th
                        key={colId}
                        style={{ minWidth: col.w, width: col.w }}
                        {...getThProps(colId, thCls(col))}
                      >
                        {renderHeader(col)}
                      </th>
                    );
                  })}
                  {/* fixed remove column — always last, not draggable */}
                  {!disabled && (
                    <th
                      style={{ minWidth: "44px", width: "44px" }}
                      className="sticky top-0 z-10 bg-[#0F2A3C] text-white px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.1em] border-r border-[#1E4968]"
                    >
                      —
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {selectedDCs.map((dc, idx) => (
                  <tr
                    key={dc.dcId}
                    className={[
                      idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]",
                      "hover:bg-[#FFFCF5] border-b border-[#E5ECF0]",
                    ].join(" ")}
                  >
                    {columnOrder.map((colId) => (
                      <td key={colId} className={getCellCls(colId)}>
                        {renderCell(colId, dc, idx)}
                      </td>
                    ))}
                    {!disabled && (
                      <td className="px-0 py-0 border-r border-[#E5ECF0] align-middle text-center">
                        <button
                          type="button"
                          onClick={() => onRemove(idx)}
                          className="w-full h-full py-1.5 px-2 text-[#4B5A66] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Remove from bill"
                        >
                          <X className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </TooltipProvider>
  );
}
