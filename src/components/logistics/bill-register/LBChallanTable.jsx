"use client";

import { Input } from "@/components/ui/input";
import { X, PackageX, PlusCircle } from "lucide-react";

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

export default function LBChallanTable({
  selectedDCs,
  availableDCs,
  onAdd,
  onRemove,
  onRemarkChange,
  disabled,
}) {
  const unselected = (availableDCs || []).filter(
    (dc) => !(selectedDCs || []).some((s) => String(s.dcId) === String(dc.id)),
  );

  return (
    <section className="border border-[#CBD5DD] bg-white overflow-hidden">
      {/* Header strip */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#CBD5DD] bg-white">
        <div className="flex items-center gap-2.5">
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
        </div>
      </header>

      {/* DC picker */}
      {!disabled && unselected.length > 0 && (
        <div className="px-3 py-2 bg-[#F5E9D9]/40 border-b border-[#CBD5DD] flex items-center gap-2">
          <PlusCircle className="w-3.5 h-3.5 text-[#C97B2E] shrink-0" />
          <select
            className="flex-1 h-[30px] px-2 text-[12.5px] bg-white border border-[#CBD5DD] rounded-none focus:outline-none focus:ring-1 focus:ring-[#C97B2E]"
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) onAdd(val);
            }}
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
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr>
                <Th w="48px"  align="center">#</Th>
                <Th w="130px">DC No</Th>
                <Th w="110px">Date</Th>
                <Th w="auto">To Project</Th>
                <Th w="80px"  align="right">Items</Th>
                <Th w="110px">Status</Th>
                <Th w="220px">Billing Remarks</Th>
                {!disabled && <Th w="44px" align="center">—</Th>}
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
                  <Td align="center" className="text-[#4B5A66] font-mono tabular-nums">{idx + 1}</Td>
                  <Td className="font-mono text-[#0F2A3C] font-medium">{dc.dcNo || "—"}</Td>
                  <Td className="text-[#4B5A66]">{dc.challanDate || "—"}</Td>
                  <Td>{dc.toProjectName || "—"}</Td>
                  <Td align="right"><span className="font-mono tabular-nums text-[12px] text-[#0F2A3C]">{dc.noOfItems ?? 0}</span></Td>
                  <Td>
                    <span className="inline-block text-[10.5px] font-medium px-1.5 py-0.5 bg-[#F5E9D9] text-[#0F2A3C]">
                      {dc.workflowStatus || "—"}
                    </span>
                  </Td>
                  <Td className="p-0">
                    {disabled ? (
                      <div className="px-2 py-1.5 text-[#4B5A66]">{dc.billingRemarks || "—"}</div>
                    ) : (
                      <Input
                        value={dc.billingRemarks ?? ""}
                        onChange={(e) => onRemarkChange?.(idx, e.target.value)}
                        className="w-full h-[32px] px-2 text-[12.5px] border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-[#C97B2E] focus-visible:ring-inset focus-visible:outline-none shadow-none"
                      />
                    )}
                  </Td>
                  {!disabled && (
                    <Td align="center" className="p-0">
                      <button
                        type="button"
                        onClick={() => onRemove(idx)}
                        className="w-full h-full py-1 text-[#4B5A66] hover:text-rose-600 hover:bg-rose-50"
                        title="Remove from bill"
                      >
                        <X className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
