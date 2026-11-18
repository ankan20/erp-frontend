"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { fmt } from "@/components/print/printStyles";

const LB = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.BILL_REGISTER;

const fmtAmt = (v) =>
  v != null ? Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

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

function ChargeRow({ label, amount, dim }) {
  return (
    <div className="flex items-baseline justify-between py-[2px]">
      <span className={`text-[11px] ${dim ? "text-[#4B5A66]" : "text-[#0F2A3C]"}`}>{label}</span>
      <span className="font-mono tabular-nums text-[11.5px] text-[#0F2A3C]">
        ₹ {fmtAmt(amount)}
      </span>
    </div>
  );
}

function SignatureBlock({ data }) {
  const slots = [
    { role: "Prepared By", name: data.createdBy,   at: fmt.dateTime(data.createdAt) },
    { role: "Verified By", name: data.submittedBy, at: fmt.dateTime(data.submittedAt) },
    { role: "Approved By", name: data.approvedBy,  at: fmt.dateTime(data.finalApprovedAt) },
    { role: "Accounts",    name: null,             at: null },
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

export default function LBPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${LB.PRINT}/${uuid}` })
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

  const challans = data.challans || [];
  const gstTotal = (Number(data.igstAmount) || 0) + (Number(data.cgstAmount) || 0) + (Number(data.sgstAmount) || 0);

  return (
    <>
      <PrintTopBar title={`Logistics Bill — ${data.lbNo}`} onDownloadPDF={() => window.print()} />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
             style={{ fontFamily: "var(--font-print), sans-serif" }}>

          {/* HEADER */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={150} height={75} className="object-contain" priority />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-[9.5px] font-bold tracking-[0.25em] uppercase text-[#C97B2E] mb-0.5">Logistics</div>
              <h1 className="text-[22px] font-bold tracking-[0.1em] text-[#0F2A3C] uppercase leading-none">Logistics Bill</h1>
              <div className="mt-1 font-mono text-[13px] font-bold text-[#0F2A3C] tabular-nums">{data.lbNo}</div>
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

          {/* VENDOR + BILL */}
          <div className="grid grid-cols-2 gap-6 px-6 py-4">
            <div>
              <Heading seq={1}>Transporter</Heading>
              <Row label="Code"    value={data.vendor?.ledgerCode}  mono />
              <Row label="Name"    value={data.vendor?.ledgerName} />
              <Row label="GSTIN"   value={data.vendor?.gstin}       mono />
              <Row label="Address" value={data.vendor?.address} />
              <Row label="State"   value={data.vendor?.stateName} />
            </div>
            <div>
              <Heading seq={2}>Bill Details</Heading>
              <Row label="LB No"          value={data.lbNo}                  mono />
              <Row label="Bill Date"      value={fmt.date(data.billDate)}    mono />
              <Row label="Invoice No"     value={data.vendorInvoiceNo}       mono />
              <Row label="Invoice Date"   value={fmt.date(data.vendorInvoiceDate)} mono />
              <Row label="Freight Basis"  value={(data.freightBasis || "").replace(/_/g, " ")} />
              <Row label="GST Type"       value={(data.gstType || "").replace(/_/g, " ")} />
              <Row label="Payment"        value={data.paymentStatus} />
              {data.voucherId && <Row label="AP Voucher" value="Posted to Finance" />}
            </div>
          </div>

          {/* LINKED DCS */}
          <div className="px-6 pb-3">
            <Heading seq={3}>Delivery Challans</Heading>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#0F2A3C] text-white">
                  {["#", "DC No", "Date", "From", "To Project", "Items", "Billing Remarks"].map((h, i) => (
                    <th key={h} className={[
                      "border border-[#1E4968] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                      i === 0 ? "text-center w-[36px]" : "",
                      i === 1 ? "text-left w-[100px]" : "",
                      i === 2 ? "text-left w-[80px]" : "",
                      i === 5 ? "text-right w-[60px]" : "",
                    ].join(" ")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challans.map((c, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#FBFAF6]"} style={{ breakInside: "avoid" }}>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-center text-[11px] font-mono tabular-nums text-[#4B5A66]">{idx + 1}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] font-mono text-[#0F2A3C] font-medium">{c.dcNo || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] font-mono tabular-nums text-[#4B5A66]">{c.challanDate || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] text-[#4B5A66]">{c.fromName || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] text-[#0F2A3C]">{c.toProjectCode || "—"}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-right text-[11px] font-mono tabular-nums text-[#0F2A3C]">{c.noOfItems ?? 0}</td>
                    <td className="border border-[#E5ECF0] px-2 py-1.5 text-[11px] text-[#4B5A66]">{c.billingRemarks || "—"}</td>
                  </tr>
                ))}
                {challans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="border border-[#E5ECF0] px-2 py-3 text-center text-[11px] italic text-[#4B5A66]">
                      No delivery challans linked
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CHARGES + TOTALS */}
          <div className="px-6 pb-3 grid grid-cols-2 gap-6">
            <div>
              <Heading seq={4}>Charge Breakup</Heading>
              <ChargeRow label="Basic Freight"       amount={data.basicFreight} />
              <ChargeRow label="Loading Charges"     amount={data.loadingCharges}     dim />
              <ChargeRow label="Unloading Charges"   amount={data.unloadingCharges}   dim />
              <ChargeRow label="Detention / Waiting" amount={data.waitingCharges}     dim />
              <ChargeRow label="Toll / FASTag"       amount={data.tollCharges}        dim />
              <ChargeRow label={data.otherChargesDescription || "Other Charges"} amount={data.otherCharges} dim />
              <div className="mt-2 pt-1.5 border-t border-[#0F2A3C] flex items-baseline justify-between">
                <span className="text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C]">Taxable</span>
                <span className="font-mono tabular-nums text-[12.5px] font-bold text-[#0F2A3C]">₹ {fmtAmt(data.taxableAmount)}</span>
              </div>
            </div>

            <div>
              <Heading seq={5}>Tax & Net</Heading>
              {data.gstType === "IGST" ? (
                <ChargeRow label={`IGST @ ${data.igstPercent || 0}%`} amount={data.igstAmount} />
              ) : (
                <>
                  <ChargeRow label={`CGST @ ${data.cgstPercent || 0}%`} amount={data.cgstAmount} />
                  <ChargeRow label={`SGST @ ${data.sgstPercent || 0}%`} amount={data.sgstAmount} />
                </>
              )}
              <div className="flex items-baseline justify-between py-[2px] border-t border-dashed border-[#CBD5DD] mt-1">
                <span className="text-[11px] text-[#0F2A3C] font-medium">Total GST</span>
                <span className="font-mono tabular-nums text-[11.5px] text-[#0F2A3C] font-semibold">₹ {fmtAmt(gstTotal)}</span>
              </div>
              <ChargeRow label="Grand Total" amount={data.totalAmount} />
              <div className="flex items-baseline justify-between py-[2px] text-rose-700">
                <span className="text-[11px]">TDS @ {data.tdsPercent || 0}%</span>
                <span className="font-mono tabular-nums text-[11.5px]">− ₹ {fmtAmt(data.tdsAmount)}</span>
              </div>
              <div className="mt-2 pt-2 border-t-2 border-[#0F2A3C] flex items-baseline justify-between">
                <span className="text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C]">Net Payable</span>
                <span className="font-mono tabular-nums text-[16px] font-bold text-[#0F2A3C]">₹ {fmtAmt(data.netPayable)}</span>
              </div>
            </div>
          </div>

          {/* REMARKS */}
          {data.remarks && (
            <div className="px-6 pb-3">
              <Heading seq={6}>Remarks</Heading>
              <p className="text-[11px] text-[#0F2A3C] whitespace-pre-wrap">{data.remarks}</p>
            </div>
          )}

          {/* DECLARATION */}
          <div className="px-6 py-2">
            <p className="text-[9.5px] italic text-[#4B5A66] leading-snug">
              Amount computed as per transporter&apos;s invoice. TDS deducted under section 194C.
              Subject to jurisdiction only.
            </p>
          </div>

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
