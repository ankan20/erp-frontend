"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { fmt, FmtNum } from "@/components/print/printStyles";

const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

function Row({ label, value, mono }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className="text-[10.5px] uppercase tracking-wide text-[#4B5A66] w-[110px] min-w-[110px] shrink-0">{label}</span>
      <span className="text-[10.5px] text-[#4B5A66] mr-1">:</span>
      <span className={`text-[11.5px] text-[#0F2A3C] font-medium flex-1 break-words ${mono ? "font-mono tabular-nums" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function Heading({ children, seq }) {
  return (
    <div className="flex items-center justify-between mb-1.5 pb-0.5 border-b border-[#0F2A3C]">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-[2px]" aria-hidden="true">
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
        </span>
        <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0F2A3C]">{children}</h2>
      </div>
      {seq && (
        <span className="font-mono text-[10px] text-[#C97B2E] font-bold tabular-nums">
          {String(seq).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}

function SignatureBlock({ data }) {
  const slots = [
    { role: "Requested By", name: data.createdBy,   at: fmt.dateTime(data.createdAt) },
    { role: "Submitted By", name: data.submittedBy, at: fmt.dateTime(data.submittedAt) },
    { role: "Approved By",  name: data.approvedBy,  at: fmt.dateTime(data.finalApprovedAt) },
    { role: "Dispatched By",name: null,             at: null },
  ];
  return (
    <div className="grid grid-cols-4 gap-6 pt-6">
      {slots.map((s) => (
        <div key={s.role} className="flex flex-col">
          <div className="h-[46px] border-b border-dashed border-[#0F2A3C]/60" />
          <p className="mt-1 text-[10.5px] uppercase tracking-[0.12em] font-bold text-[#0F2A3C]">{s.role}</p>
          {s.name && <p className="text-[10.5px] text-[#4B5A66] mt-0.5 font-medium truncate">{s.name}</p>}
          {s.at && <p className="text-[9.5px] text-[#4B5A66]/80 font-mono tabular-nums">{s.at}</p>}
        </div>
      ))}
    </div>
  );
}

export default function TRPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${TR.PRINT}/${uuid}` })
      .then((res) => setData(res?.data ?? null))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <p className="text-[13px] text-gray-500">Loading document…</p>
      </div>
    </div>
  );

  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  const items = data.items || [];
  const totalReq  = items.reduce((s, it) => s + (Number(it.requestedQty)  || 0), 0);
  const totalDisp = items.reduce((s, it) => s + (Number(it.dispatchedQty) || 0), 0);

  return (
    <>
      <PrintTopBar title={`Transit Request — ${data.trNo}`} onDownloadPDF={() => window.print()} />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={150} height={75} className="object-contain" priority />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-[9.5px] font-bold tracking-[0.25em] uppercase text-[#C97B2E] mb-0.5">Logistics</div>
              <h1 className="text-[22px] font-bold tracking-[0.1em] text-[#0F2A3C] uppercase leading-none">
                Transit Request
              </h1>
              <div className="mt-1 font-mono text-[13px] font-bold text-[#0F2A3C] tabular-nums">{data.trNo}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[9.5px] text-[#4B5A66]">www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#0F2A3C]" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#0F2A3C]" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#0F2A3C]" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#0F2A3C]" />
                <QRCodeSVG value={pageUrl} size={64} bgColor="#ffffff" fgColor="#0F2A3C" level="M" />
              </div>
            </div>
          </div>

          <div className="h-[3px] bg-[#C97B2E] mx-6" />

          {/* DOC + ROUTE */}
          <div className="grid grid-cols-2 gap-6 px-6 py-4">
            <div>
              <Heading seq={1}>Request</Heading>
              <Row label="TR No"         value={data.trNo} mono />
              <Row label="Request Date"  value={fmt.date(data.requestDate)} mono />
              <Row label="Project"       value={data.projectCode} mono />
              <Row label="Transfer Type" value={(data.transferType || "").replace(/_/g, " ")} />
              <Row label="Order Type"    value={(data.orderType || "").replace(/_/g, " ")} />
              <Row label="Order No"      value={data.orderNo} mono />
              <Row label="Priority"      value={data.priority} />
              <Row label="Status"        value={(data.workflowStatus || "").replace(/_/g, " ")} />
            </div>
            <div>
              <Heading seq={2}>Route & Transport</Heading>
              <Row label="Source"      value={data.sourceLocation} />
              <Row label="Destination" value={data.destinationLocation} />
              <Row label="Required By" value={fmt.date(data.requiredDeliveryDate)} mono />
              <Row label="Mode"        value={data.modeOfTransport} />
              <Row label="Carrier"     value={data.preferredCarrierName} />
              <Row label="Est. Freight" value={data.estimatedFreight != null ? `₹ ${Number(data.estimatedFreight).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : null} mono />
              <Row label="Fulfillment" value={(data.fulfillmentStatus || "").replace(/_/g, " ")} />
            </div>
          </div>

          {/* ITEMS */}
          <div className="px-6 pb-3">
            <Heading seq={3}>Manifest Items</Heading>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#0F2A3C] text-white">
                  {["#", "Item Code", "Item Name", "Unit", "Order", "Dispatched", "Requested", "Remarks"].map((h, i) => (
                    <th
                      key={h}
                      className={[
                        "border border-[#1E4968] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                        i === 0 ? "text-center w-[40px]" : "",
                        i === 1 ? "text-left w-[100px]" : "",
                        i === 3 ? "text-center w-[50px]" : "",
                        [4, 5, 6].includes(i) ? "text-right w-[80px]" : "",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]"} style={{ breakInside: "avoid" }}>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-center text-[11px] font-mono tabular-nums text-[#4B5A66]">{idx + 1}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] font-mono text-[#0F2A3C] font-medium">{it.itemCode || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11.5px] text-[#0F2A3C]">{it.itemName || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-center text-[11px] uppercase text-[#4B5A66]">{it.itemUnit || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[11px] font-mono tabular-nums text-[#4B5A66]"><FmtNum value={it.orderQty} /></td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[11px] font-mono tabular-nums text-[#4B5A66]"><FmtNum value={it.dispatchedQty} /></td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[11.5px] font-mono tabular-nums text-[#0F2A3C] font-medium"><FmtNum value={it.requestedQty} /></td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] text-[#4B5A66]">{it.remarks || "—"}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5E9D9] border-t-2 border-[#0F2A3C]">
                  <td colSpan={5} className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C]">Totals</td>
                  <td className="border border-[#E5ECF0] px-2 py-1.5 text-right font-mono tabular-nums text-[12px] font-semibold text-[#0F2A3C]">{totalDisp.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</td>
                  <td className="border border-[#E5ECF0] px-2 py-1.5 text-right font-mono tabular-nums text-[12.5px] font-bold text-[#0F2A3C]">{totalReq.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</td>
                  <td className="border border-[#E5ECF0] px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* PURPOSE / REMARKS */}
          {(data.purpose || data.remarks) && (
            <div className="px-6 pb-3 grid grid-cols-2 gap-6">
              {data.purpose && (
                <div>
                  <Heading seq={4}>Purpose</Heading>
                  <p className="text-[11px] text-[#0F2A3C] whitespace-pre-wrap">{data.purpose}</p>
                </div>
              )}
              {data.remarks && (
                <div>
                  <Heading seq={5}>Remarks</Heading>
                  <p className="text-[11px] text-[#0F2A3C] whitespace-pre-wrap">{data.remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* SIGNATURES */}
          <div className="px-6 pb-6">
            <SignatureBlock data={data} />
          </div>

          {/* FOOTER */}
          <div className="h-[6px] bg-[#0F2A3C] mt-2 flex">
            <div className="w-1/3 bg-[#C97B2E]" />
          </div>
        </div>
      </div>

      <style>{`
        @page { size: A4; margin: 8mm 8mm 12mm 8mm; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, body > * { background: white !important; margin: 0 !important; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:max-w-none { max-width: none !important; }
        }
      `}</style>
    </>
  );
}
