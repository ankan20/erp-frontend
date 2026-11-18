"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { publicRequest }   from "@/lib/publicRequest";
import { API_ENDPOINTS }   from "@/config/api.config";
import PrintTopBar         from "@/components/print/PrintTopBar";
import PrintErrorPage      from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, fmt, FmtNum } from "@/components/print/printStyles";

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;

// ─── field row ────────────────────────────────────────────────────────────────
function Row({ label, value, mono }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className="text-[10.5px] uppercase tracking-wide text-[#4B5A66] w-[110px] min-w-[110px] shrink-0">
        {label}
      </span>
      <span className="text-[10.5px] text-[#4B5A66] mr-1">:</span>
      <span
        className={[
          "text-[11.5px] text-[#0F2A3C] font-medium flex-1 break-words",
          mono ? "font-mono tabular-nums" : "",
        ].join(" ")}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ─── block heading ────────────────────────────────────────────────────────────
function Heading({ children, seq }) {
  return (
    <div className="flex items-center justify-between mb-1.5 pb-0.5 border-b border-[#0F2A3C]">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-[2px]" aria-hidden="true">
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
        </span>
        <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0F2A3C]">
          {children}
        </h2>
      </div>
      {seq && (
        <span className="font-mono text-[10px] text-[#C97B2E] font-bold tabular-nums">
          {String(seq).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}

// ─── signature block (4 columns, physical signatures) ────────────────────────
function SignatureBlock({ data }) {
  const slots = [
    { role: "Prepared By", name: data.createdBy,   at: fmt.dateTime(data.createdAt) },
    { role: "Verified By", name: data.submittedBy, at: fmt.dateTime(data.submittedAt) },
    { role: "Approved By", name: data.approvedBy,  at: fmt.dateTime(data.finalApprovedAt) },
    { role: "Received By", name: null,             at: null },
  ];
  return (
    <div className="grid grid-cols-4 gap-6 pt-6">
      {slots.map((s) => (
        <div key={s.role} className="flex flex-col">
          <div className="h-[46px] border-b border-dashed border-[#0F2A3C]/60" />
          <p className="mt-1 text-[10.5px] uppercase tracking-[0.12em] font-bold text-[#0F2A3C]">
            {s.role}
          </p>
          {s.name && (
            <p className="text-[10.5px] text-[#4B5A66] mt-0.5 font-medium truncate">
              {s.name}
            </p>
          )}
          {s.at && (
            <p className="text-[9.5px] text-[#4B5A66]/80 font-mono tabular-nums">
              {s.at}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DCPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${DC.PRINT}/${uuid}` })
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

  const items   = data.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.issueQty) || 0), 0);

  return (
    <>
      <PrintTopBar
        title={`Delivery Challan — ${data.dcNo}`}
        onDownloadPDF={() => window.print()}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER: logo + title + QR ─────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Logo" width={150} height={75}
                className="object-contain" priority
              />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-[9.5px] font-bold tracking-[0.25em] uppercase text-[#C97B2E] mb-0.5">
                Logistics
              </div>
              <h1 className="text-[22px] font-bold tracking-[0.1em] text-[#0F2A3C] uppercase leading-none">
                Delivery Challan
              </h1>
              <div className="mt-1 font-mono text-[13px] font-bold text-[#0F2A3C] tabular-nums">
                {data.dcNo}
              </div>
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

          {/* ── amber accent rule ── */}
          <div className="h-[3px] bg-[#C97B2E] mx-6" />

          {/* ── CONSIGNOR / CONSIGNEE ── */}
          <div className="grid grid-cols-2 gap-6 px-6 py-4">
            <div>
              <Heading seq={1}>Consignor (Ship From)</Heading>
              <Row label="Code"    value={data.fromDisplayCode} mono />
              <Row label="Name"    value={data.fromDisplayName || data.fromProjectName || data.fromVendorName} />
              <Row label="Address" value={data.shippingFromAddress} />
              <Row label="GSTIN"   value={data.fromGstn} mono />
            </div>
            <div>
              <Heading seq={2}>Consignee (Ship To)</Heading>
              <Row label="Code"    value={data.toProjectCode} mono />
              <Row label="Name"    value={data.consigneeName || data.toProjectName} />
              <Row label="Address" value={data.consigneeAddress || data.shippingToAddress} />
              <Row label="GSTIN"   value={data.consigneeGstin || data.toGstn} mono />
            </div>
          </div>

          {/* ── CHALLAN META + VEHICLE ── */}
          <div className="grid grid-cols-2 gap-6 px-6 pb-4">
            <div>
              <Heading seq={3}>Document</Heading>
              <Row label="DC No"           value={data.dcNo} mono />
              <Row label="Challan Date"    value={fmt.date(data.challanDate)} mono />
              <Row label="Dispatch Type"   value={(data.dispatchType || "").replace(/_/g, " ")} />
              <Row label="Order Type"      value={(data.orderType || "").replace(/_/g, " ")} />
              <Row label="Order No"        value={data.orderNo} mono />
              <Row label="Transit Req."    value={data.transitRequestNo} mono />
              <Row label="Purpose"         value={data.purposeForDelivery} />
            </div>
            <div>
              <Heading seq={4}>Transport</Heading>
              <Row label="Transporter"     value={data.transporterName} />
              <Row label="Mode"            value={data.deliveryMode} />
              <Row label="LR / CN No"      value={data.lrNo} mono />
              <Row label="Vehicle No"      value={data.vehicleNumber} mono />
              <Row label="Driver"          value={data.driverName} />
              <Row label="Driver Phone"    value={data.driverContactNumber} mono />
              <Row label="E-Way Bill"      value={data.ewayBillNumber} mono />
              <Row label="E-Way Date"      value={fmt.date(data.ewayBillDate)} mono />
            </div>
          </div>

          {/* ── ITEMS ── */}
          <div className="px-6 pb-3">
            <Heading seq={5}>Items Dispatched</Heading>
            <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
              <thead>
                <tr className="bg-[#0F2A3C] text-white">
                  {["#", "Item Code", "Item Name", "Unit", "Issue Qty", "Stock Location"].map((h, i) => (
                    <th
                      key={h}
                      className={[
                        "border border-[#1E4968] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                        i === 0 ? "text-center w-[40px]" : "",
                        i === 1 ? "text-left w-[110px]" : "",
                        i === 3 ? "text-center w-[60px]" : "",
                        i === 4 ? "text-right w-[100px]" : "",
                        i === 5 ? "text-left w-[170px]" : "",
                      ].join(" ")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]"}
                    style={{ breakInside: "avoid" }}
                  >
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-center text-[11px] font-mono tabular-nums text-[#4B5A66]">{idx + 1}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] font-mono text-[#0F2A3C] font-medium">{it.itemCode || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11.5px] text-[#0F2A3C]">{it.itemName || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-center text-[11px] uppercase text-[#4B5A66]">{it.itemUnit || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[11.5px] font-mono tabular-nums text-[#0F2A3C] font-medium"><FmtNum value={it.issueQty} /></td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] text-[#4B5A66]">{it.stockLocation || "—"}</td>
                  </tr>
                ))}
                <tr className="bg-[#F5E9D9] border-t-2 border-[#0F2A3C]">
                  <td colSpan={4} className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C]">
                    Total Issued
                  </td>
                  <td className="border border-[#E5ECF0] px-2 py-1.5 text-right font-mono tabular-nums text-[12.5px] font-bold text-[#0F2A3C]">
                    {totalQty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                  </td>
                  <td className="border border-[#E5ECF0] px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── REMARKS ── */}
          {data.remarks && (
            <div className="px-6 pb-3">
              <Heading seq={6}>Remarks</Heading>
              <p className="text-[11px] text-[#0F2A3C] whitespace-pre-wrap">{data.remarks}</p>
            </div>
          )}

          {/* ── DECLARATION ── */}
          <div className="px-6 py-2">
            <p className="text-[9.5px] italic text-[#4B5A66] leading-snug">
              Received the above items in good order & condition. Subject to jurisdiction only.
              This is not an invoice.
            </p>
          </div>

          {/* ── SIGNATURES ── */}
          <div className="px-6 pb-6">
            <SignatureBlock data={data} />
          </div>

          {/* ── FOOTER RULE ── */}
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
