"use client";

import { Pencil, PackageX, AlertTriangle } from "lucide-react";
import QtyInput           from "@/components/common/QtyInput";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import { useResizableTable } from "@/hooks/useResizableTable";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Column definitions ──────────────────────────────────────────────────────
const COLS = [
  { id: "sl",       label: "# ",           w: "48px",  align: "center" },
  { id: "itemCode", label: "Item Code",     w: "110px"                  },
  { id: "itemName", label: "Item Name",     w: "auto"                   },
  { id: "unit",     label: "Unit",          w: "60px",  align: "center" },
  { id: "balance",  label: "Balance",       w: "90px",  align: "right"  },
  { id: "issue",    label: "Issue",         w: "120px", align: "right",  pencil: true },
  { id: "location", label: "Stock Location",w: "180px"                  },
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

function TruncName({ text }) {
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

const ReadNum = ({ value }) => (
  <span className="font-mono tabular-nums text-[12px] text-[#0F2A3C]">
    {value != null && value !== ""
      ? Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })
      : "—"}
  </span>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function DCItemsTable({ items, onItemChange, disabled }) {
  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns:    COLS,
    storageKey: "dc-items",
  });

  if (!items?.length) {
    return (
      <div className="border border-[#CBD5DD] bg-[#FBFAF6] p-10 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-[#F5E9D9] flex items-center justify-center">
          <PackageX className="w-5 h-5 text-[#C97B2E]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#0F2A3C]">No items loaded</p>
          <p className="text-[12px] text-[#4B5A66] mt-0.5">
            Pick an Order No in the left panel to pull its items into this delivery challan.
          </p>
        </div>
      </div>
    );
  }

  const totalIssue = items.reduce((s, it) => s + (Number(it.issueQty) || 0), 0);

  const renderHeader = (col) => (
    <span className={`flex items-center gap-1 ${
      col.align === "right"  ? "justify-end"   :
      col.align === "center" ? "justify-center" : ""
    }`}>
      {col.label}
      {col.pencil && !disabled && <Pencil size={9} className="text-[#C97B2E]" />}
    </span>
  );

  const renderCell = (colId, item, idx) => {
    const balanceQty = Number(item.balanceQty ?? 0);
    const issueQty   = item.issueQty;
    const issueNum   = issueQty === "" || issueQty == null ? 0 : Number(issueQty);
    const qtyError   = issueNum > balanceQty && issueNum > 0;

    switch (colId) {
      case "sl":
        return <span className="text-[#4B5A66] font-mono tabular-nums">{idx + 1}</span>;
      case "itemCode":
        return <span className="font-mono text-[#0F2A3C] font-medium">{item.itemCode || "—"}</span>;
      case "itemName":
        return <TruncName text={item.itemName} />;
      case "unit":
        return <span className="text-[#4B5A66] uppercase text-[11px]">{item.itemUnit || "—"}</span>;
      case "balance":
        return <ReadNum value={balanceQty} />;
      case "issue":
        return disabled ? (
          <ReadNum value={issueQty} />
        ) : (
          <div className="flex items-center gap-1 px-2">
            <QtyInput
              value={issueQty ?? ""}
              disabled={disabled}
              onChange={(e) => onItemChange(idx, "issueQty", e.target.value)}
              title={qtyError ? `Max allowed: ${balanceQty}` : undefined}
              className={[
                "w-full h-[32px] px-0 text-right tabular-nums text-[12.5px]",
                "border-0 bg-transparent shadow-none",
                "focus-visible:ring-1 focus-visible:ring-inset focus-visible:outline-none",
                qtyError
                  ? "text-rose-700 focus-visible:ring-rose-400"
                  : "focus-visible:ring-[#C97B2E]",
              ].join(" ")}
            />
            {qtyError && (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            )}
          </div>
        );
      case "location":
        return <TruncName text={item.stockLocation} />;
      default: return null;
    }
  };

  const getCellCls = (colId) => {
    const col = COLS.find((c) => c.id === colId);
    if (!col) return "px-2 py-1.5 border-r border-[#E5ECF0] align-middle text-[12.5px]";
    return tdCls(col, colId === "issue" ? "p-0" : "");
  };

  const getRowCls = (item, idx) => {
    const issueNum = Number(item.issueQty || 0);
    const qtyError = issueNum > Number(item.balanceQty ?? 0) && issueNum > 0;
    return [
      qtyError ? "bg-rose-50/60" : idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]",
      "hover:bg-[#FFFCF5] border-b border-[#E5ECF0]",
    ].join(" ");
  };

  return (
    <TooltipProvider>
      <section className="border border-[#CBD5DD] bg-white overflow-hidden">
        <header className="flex items-center px-3 py-2 border-b border-[#CBD5DD] bg-white gap-2.5">
          <span className="flex items-center gap-[2px]" aria-hidden="true">
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          </span>
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#0F2A3C]">
            Dispatched Items
          </h3>
          <span className="text-[10.5px] text-[#4B5A66] font-mono tabular-nums">
            · {items.length} line{items.length === 1 ? "" : "s"}
          </span>
        </header>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table ref={tableRef} className="w-full border-collapse min-w-[760px]">
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
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.orderItemId ?? idx} className={getRowCls(item, idx)}>
                  {columnOrder.map((colId) => (
                    <td key={colId} className={getCellCls(colId)}>
                      {renderCell(colId, item, idx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F5E9D9] border-t-2 border-[#0F2A3C]">
                {columnOrder.map((colId) => (
                  <td
                    key={colId}
                    className={colId === "issue" ? "px-2 py-1.5 text-right" : "px-2 py-1.5"}
                  >
                    {colId === "issue" && (
                      <>
                        <div className="text-[9px] uppercase tracking-[0.12em] text-[#4B5A66] font-semibold">Total Issued</div>
                        <div className="font-mono tabular-nums text-[13px] font-bold text-[#0F2A3C]">
                          {totalIssue.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                        </div>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </TooltipProvider>
  );
}
