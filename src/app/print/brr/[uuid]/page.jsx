"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt } from "@/components/print/printStyles";
import { DOCX_FONT } from "@/config/fonts.config";

/* ─── helpers ──────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[130px] min-w-[130px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-900 flex-1`}>{value || "-"}</span>
    </div>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[180px] min-w-[180px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ml-3`}>[{dateStr}]</span>}
    </div>
  );
}

function fmtAmt(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Excel download ───────────────────────────────────────── */
function downloadExcel(d) {
  const XLSX = require("xlsx");
  const rows = [
    ["BILL RECEIVE REGISTER (BRR)"],
    [],
    ["BRR No",            d.brrNo,          "", "BRR Date",       fmt.date(d.brrDate)],
    ["Project Code",      d.projectCode,    "", "Order No",       d.orderNo || "-"],
    ["Order Category",    d.orderCategory || "-", "", "Order Date", fmt.date(d.orderDate)],
    [],
    ["Party Name",        d.partyName,      "", "Party GSTIN",    d.partyGstn || "-"],
    ["Party Bill No",     d.partyBillNo,    "", "Party Bill Date", fmt.date(d.partyDate)],
    [],
    ["Received Category", d.receivedCategory || "-"],
    ["Submitted By",      d.submittedByName  || "-", "", "Submission Date", fmt.date(d.submissionDate)],
    ["Received Through",  d.receivedThrough  || "-"],
    ["Received Reference",d.receivedReference|| "-"],
    [],
    ["Basic Amount",      d.basicAmount],
    ["GST Amount",        d.gstAmount],
    ["Total Amount",      d.totalAmount],
    [],
    ["Workflow Status",   d.workflowStatus],
    ["Created By",        d.createdBy || "-",  "", "Created At",  d.createdAt || "-"],
    ["Approved By",       d.approvedBy || "-", "", "Approved At", d.finalApprovedAt || "-"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 4 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "BRR");
  XLSX.writeFile(wb, `BRR_${d.brrNo || "print"}.xlsx`);
}

/* ─── Main page ────────────────────────────────────────────── */
export default function BRRPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.GET_BY_UUID}/${uuid}` })
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

  return (
    <>
      <PrintTopBar
        title={`BRR — ${data.brrNo}`}
        onDownloadPDF={() => window.print()}
        onDownloadExcel={() => downloadExcel(data)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}>

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[160px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={160} height={80} className="object-contain" priority />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>BILL RECEIVE REGISTER</h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 tracking-widest`}>[BRR]</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-700`}>www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={68} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </div>

          {/* ── INFO SECTION ── */}
          <div className="grid grid-cols-2 px-6 py-3" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Party Name"      value={data.partyName} />
              <InfoRow label="Party Address"   value={data.partyAddress} />
              <InfoRow label="Party GSTIN"     value={data.partyGstn} />
              <InfoRow label="Party Bill No"   value={data.partyBillNo} />
              <InfoRow label="Party Bill Date" value={fmt.date(data.partyDate)} />
              <InfoRow label="Rcvd Category"   value={data.receivedCategory} />
              <InfoRow label="Submitted By"    value={data.submittedByName} />
              <InfoRow label="Submission Date" value={fmt.date(data.submissionDate)} />
              <InfoRow label="Rcvd Through"    value={data.receivedThrough} />
              <InfoRow label="Rcvd Reference"  value={data.receivedReference} />
            </div>
            <div>
              <InfoRow label="BRR No"         value={data.brrNo} />
              <InfoRow label="BRR Date"       value={fmt.date(data.brrDate)} />
              <InfoRow label="Project Code"   value={data.projectCode} />
              <InfoRow label="Order Category" value={data.orderCategory} />
              <InfoRow label="Order No"       value={data.orderNo} />
              <InfoRow label="Order Date"     value={fmt.date(data.orderDate)} />
              <InfoRow label="Status"         value={data.workflowStatus} />
            </div>
          </div>

          {/* ── FINANCIAL SUMMARY ── */}
          <div className="px-6 py-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className={COLOR.tableHeadBg}>
                  {["Particulars", "Amount (₹)"].map((h) => (
                    <th key={h} className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 text-center`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell}`}>Basic Amount</td>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}>{fmtAmt(data.basicAmount)}</td>
                </tr>
                <tr>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell}`}>GST Amount</td>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}>{fmtAmt(data.gstAmount)}</td>
                </tr>
                <tr className={COLOR.signatureBg}>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold}`}>Total Amount</td>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right tabular-nums`}>{fmtAmt(data.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── AUDIT TRAIL ── */}
          <div className="px-6 pb-6">
            <SigRow label="BRR Created By"  name={data.createdBy}  dateStr={data.createdAt} />
            <SigRow label="Approved By"     name={data.approvedBy} dateStr={data.finalApprovedAt} />
          </div>
        </div>
      </div>

      {/* hidden canvas for docx QR */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 8mm 8mm 12mm 8mm;
          @bottom-center {
            content: counter(page) " / " counter(pages);
            font-size: 9pt;
            color: #6b7280;
            font-family: ${DOCX_FONT}, sans-serif;
          }
        }
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
