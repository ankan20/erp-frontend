"use client";

import QtyInput              from "@/components/common/QtyInput";
import ExpandableTextField   from "@/components/common/ExpandableTextField";
import { PackageX, AlertTriangle } from "lucide-react";

const Th = ({ children, w = "auto", align = "left" }) => (
  <th
    style={{ minWidth: w, width: w }}
    className={[
      "sticky top-0 z-10 bg-[#0F2A3C] text-white",
      "px-2 py-2 border-r border-[#1E4968]",
      "text-[10.5px] font-bold uppercase tracking-[0.1em] whitespace-nowrap",
      align === "right"  ? "text-right"  : "",
      align === "center" ? "text-center" : "",
    ].join(" ")}
  >
    {children}
  </th>
);

const Td = ({ children, align = "left", className = "" }) => (
  <td
    className={[
      "px-2 py-1.5 border-r border-[#E5ECF0] align-middle text-[12.5px]",
      align === "right"  ? "text-right tabular-nums" : "",
      align === "center" ? "text-center" : "",
      className,
    ].join(" ")}
  >
    {children}
  </td>
);

const ReadNum = ({ value, suffix }) => (
  <span className="font-mono tabular-nums text-[12px] text-[#0F2A3C]">
    {value != null && value !== "" ? (
      <>{Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })}{suffix ? <span className="text-[#4B5A66] ml-0.5">{suffix}</span> : null}</>
    ) : "—"}
  </span>
);

export default function DCItemsTable({ items, onItemChange, disabled }) {
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

  return (
    <section className="border border-[#CBD5DD] bg-white overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#CBD5DD] bg-white">
        <div className="flex items-center gap-2.5">
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
        </div>
      </header>

      <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
        <table className="w-full border-collapse min-w-[860px]">
          <thead>
            <tr>
              <Th w="48px"  align="center">#</Th>
              <Th w="120px">Item Code</Th>
              <Th w="auto">Item Name</Th>
              <Th w="60px"  align="center">Unit</Th>
              <Th w="110px" align="right">Balance</Th>
              <Th w="130px" align="right">Issue</Th>
              <Th w="180px">Stock Location</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const balanceQty = Number(item.balanceQty ?? 0);
              const issueQty   = item.issueQty;
              const issueNum   = issueQty === "" || issueQty == null ? 0 : Number(issueQty);
              const qtyError   = issueNum > balanceQty && issueNum > 0;

              return (
                <tr
                  key={item.orderItemId ?? idx}
                  className={[
                    qtyError ? "bg-rose-50/60" : idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]",
                    "hover:bg-[#FFFCF5] border-b border-[#E5ECF0]",
                  ].join(" ")}
                >
                  <Td align="center" className="text-[#4B5A66] font-mono tabular-nums">{idx + 1}</Td>
                  <Td className="font-mono text-[#0F2A3C] font-medium">{item.itemCode || "—"}</Td>
                  <Td>
                    <ExpandableTextField
                      value={item.itemName || ""}
                      onChange={() => {}}
                      disabled
                      title="Item Name"
                      minHeight="min-h-[28px]"
                      modalHeight="min-h-[180px]"
                    />
                  </Td>
                  <Td align="center" className="text-[#4B5A66] uppercase text-[11px]">{item.itemUnit || "—"}</Td>
                  <Td align="right"><ReadNum value={balanceQty} /></Td>
                  <Td align="right" className="p-0">
                    {disabled ? (
                      <div className="px-2 py-1.5 text-right"><ReadNum value={issueQty} /></div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <QtyInput
                          value={issueQty ?? ""}
                          disabled={disabled}
                          onChange={(e) => onItemChange(idx, "issueQty", e.target.value)}
                          title={qtyError ? `Max allowed: ${balanceQty}` : undefined}
                          className={[
                            "w-full h-[32px] px-2 text-right tabular-nums text-[12.5px]",
                            "border-0 bg-transparent shadow-none",
                            "focus-visible:ring-1 focus-visible:ring-inset focus-visible:outline-none",
                            qtyError ? "text-rose-700 focus-visible:ring-rose-400" : "focus-visible:ring-[#C97B2E]",
                          ].join(" ")}
                        />
                        {qtyError && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mr-1" />
                        )}
                      </div>
                    )}
                  </Td>
                  <Td className="text-[#4B5A66]">{item.stockLocation || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#F5E9D9] border-t-2 border-[#0F2A3C]">
              <td colSpan={5} className="px-3 py-1.5 text-right text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C]">
                Total Issued
              </td>
              <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[13px] font-bold text-[#0F2A3C]">
                {totalIssue.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
