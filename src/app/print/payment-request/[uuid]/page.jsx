"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt } from "@/components/print/printStyles";
import { DOCX_FONT } from "@/config/fonts.config";

/* ─── helpers (same as BRR print) ──────────────────────────── */
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
  const s = d.brrSummary || {};
  const rows = [
    ["PAYMENT REQUEST"],
    [],
    ["PR No",            d.prNo,               "", "PR Date",          fmt.date(d.prDate)],
    ["Project Code",     d.projectCode,        "", "BRR No",           d.brrNo || "-"],
    ["Party Name",       d.partyName || "-",   "", "Party GSTIN",      d.partyGstn || "-"],
    ["Party Bill No",    d.partyBillNo || "-", "", "Party Bill Date",  fmt.date(d.partyDate)],
    ["Payment Mode",     d.paymentMode || "-", "", "Required By",      fmt.date(d.requiredByDate)],
    [],
    ["Bill Amount",          d.billAmount],
    ["Previously Requested", d.previouslyRequested],
    ["Requested Amount",     d.requestedAmount],
    ["Deduction Amount",     d.deductionAmount, "", "Deduction Remarks", d.deductionRemarks || "-"],
    ["Net Payable",          d.netPayable],
    ["BRR Balance (now)",    s.balanceAmount ?? "-"],
    [],
    ["Remarks",          d.remarks || "-"],
    ["Workflow Status",  d.workflowStatus],
    ["Created By",       d.createdBy || "-",  "", "Created At",  d.createdAt || "-"],
    ["Approved By",      d.approvedBy || "-", "", "Approved At", d.finalApprovedAt || "-"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 4 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Payment Request");
  XLSX.writeFile(wb, `PaymentRequest_${d.prNo || "print"}.xlsx`);
}

/* ─── Main page ────────────────────────────────────────────── */
export default function PaymentRequestPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.PAYMENT_REQUEST.GET_BY_UUID}/${uuid}` })
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

  const amountRows = [
    ["Bill Amount",          data.billAmount],
    ["Previously Requested", data.previouslyRequested],
    ["Requested Amount",     data.requestedAmount],
    [`Less: Deduction${data.deductionRemarks ? ` (${data.deductionRemarks})` : ""}`, data.deductionAmount],
  ];

  return (
    <>
      <PrintTopBar
        title={`Payment Request — ${data.prNo}`}
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
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>PAYMENT REQUEST</h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 tracking-widest`}>[PR]</p>
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
              <InfoRow label="Payment Mode"    value={data.paymentMode} />
              <InfoRow label="Required By"     value={fmt.date(data.requiredByDate)} />
            </div>
            <div>
              <InfoRow label="PR No"        value={data.prNo} />
              <InfoRow label="PR Date"      value={fmt.date(data.prDate)} />
              <InfoRow label="Project Code" value={data.projectCode} />
              <InfoRow label="BRR No"       value={data.brrNo} />
              <InfoRow label="BRR Date"     value={fmt.date(data.brrSummary?.brrDate)} />
              <InfoRow label="Order No"     value={data.brrSummary?.orderNo} />
              <InfoRow label="Status"       value={data.workflowStatus} />
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
                {amountRows.map(([label, val]) => (
                  <tr key={label}>
                    <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell}`}>{label}</td>
                    <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}>{fmtAmt(val)}</td>
                  </tr>
                ))}
                <tr className={COLOR.signatureBg}>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold}`}>Net Payable</td>
                  <td className={`border ${COLOR.tableBorder} px-3 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right tabular-nums`}>{fmtAmt(data.netPayable)}</td>
                </tr>
              </tbody>
            </table>
            {data.remarks && (
              <div className="mt-2">
                <InfoRow label="Remarks" value={data.remarks} />
              </div>
            )}
          </div>

          {/* ── AUDIT TRAIL + PHYSICAL SIGNATURES ── */}
          <div className="px-6 pt-3 pb-5" style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gridTemplateRows: "auto auto auto", columnGap: "32px", rowGap: 0 }}>
            <div style={{ gridColumn: 1, gridRow: "1 / 3" }}>
              <SigRow label="Requested By" name={data.createdBy}  dateStr={data.createdAt} />
              <SigRow label="Approved By"  name={data.approvedBy} dateStr={data.finalApprovedAt} />
            </div>
            <div style={{ gridColumn: 2, gridRow: 1 }} />
            <div style={{ gridColumn: 3, gridRow: 1 }} />
            <div style={{ gridColumn: 2, gridRow: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "1px solid #1f2937" }} />
            </div>
            <div style={{ gridColumn: 3, gridRow: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "1px solid #1f2937" }} />
            </div>
            {["Verified By", "Prepared By"].map((lbl, i) => (
              <p key={lbl} style={{ gridColumn: i + 2, gridRow: 3 }}
                className={`mt-0.5 text-center ${SIZE.labelText} ${WEIGHT.bold} text-gray-800 uppercase tracking-wider`}
              >{lbl}</p>
            ))}
          </div>
        </div>
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
