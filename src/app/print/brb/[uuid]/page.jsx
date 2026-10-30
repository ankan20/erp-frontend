"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt, FmtNum } from "@/components/print/printStyles";
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
  const items = d.items || [];
  const rows = [
    [`E-RECONCILE BILL (BRB) — ${d.billingType}`],
    [],
    ["BRB No",         d.brbNo,          "", "BRB Date",       fmt.date(d.brbDate)],
    ["BRR No",         d.brrNo,          "", "BRR Date",       fmt.date(d.brrDate)],
    ["Project Code",   d.projectCode,    "", "Order No",       d.orderNo || "-"],
    ["Order Category", d.orderCategory || "-", "", "Order Date", fmt.date(d.orderDate)],
    [],
    ["Party Name",     d.partyName,      "", "Party GSTIN",    d.partyGstn || "-"],
    ["Party Bill No",  d.partyBillNo,    "", "Party Bill Date", fmt.date(d.partyDate)],
    [],
    [d.billingType === "GRN" ? "GRN No" : "SRN No",
     "Item Code", "Item Name", "Unit", "Billing Qty", "Rate", "Amount", "GST %", "GST Amt"],
    ...items.map((it) => [
      it.receiptNo, it.itemCode, it.itemName, it.itemUnit,
      it.billingQty, it.rate, it.amount, it.gstPercent, it.gstAmount,
    ]),
    [],
    ["Basic Amount", d.basicAmount],
    ["GST Amount",   d.gstAmount],
    ["Total Amount", d.totalAmount],
    [],
    ["Workflow Status", d.workflowStatus],
    ["Created By",   d.createdBy  || "-", "", "Created At",  d.createdAt  || "-"],
    ["Approved By",  d.approvedBy || "-", "", "Approved At", d.finalApprovedAt || "-"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 4 }, { wch: 18 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "BRB");
  XLSX.writeFile(wb, `BRB_${d.brbNo || "print"}.xlsx`);
}

/* ─── Main page ────────────────────────────────────────────── */
export default function BRBPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.BRB.GET_BY_UUID}/${uuid}` })
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
  const receiptLabel = data.billingType === "GRN" ? "GRN No" : "SRN No";
  const receiptDateLabel = data.billingType === "GRN" ? "GRN Date" : "SRN Date";

  return (
    <>
      <PrintTopBar
        title={`BRB — ${data.brbNo}`}
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
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>E-RECONCILE BILL</h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 tracking-widest`}>
                [BY {data.billingType === "GRN" ? "GRN" : "SRN"}]
              </p>
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
              <InfoRow label="Ship To"         value={data.shippingAddress} />
              <InfoRow label="Bill To"         value={data.billingAddress} />
            </div>
            <div>
              <InfoRow label="BRB No"         value={data.brbNo} />
              <InfoRow label="BRB Date"       value={fmt.date(data.brbDate)} />
              <InfoRow label="BRR No"         value={data.brrNo} />
              <InfoRow label="BRR Date"       value={fmt.date(data.brrDate)} />
              <InfoRow label="Project Code"   value={data.projectCode} />
              <InfoRow label="Order Category" value={data.orderCategory} />
              <InfoRow label="Order No"       value={data.orderNo} />
              <InfoRow label="Order Date"     value={fmt.date(data.orderDate)} />
              <InfoRow label="Status"         value={data.workflowStatus} />
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="px-6 py-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
                <colgroup>
                  <col style={{ width: "4%" }} /><col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} /><col style={{ width: "25%" }} />
                  <col style={{ width: "6%" }} /><col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} /><col style={{ width: "10%" }} />
                  <col style={{ width: "6%" }} /><col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {["Sl\nNo", receiptLabel, receiptDateLabel, "Item Name", "Unit",
                      "Billing\nQty", "Rate", "Amount", "GST\n%", "GST Amt"].map((h) => (
                      <th key={h} style={{ whiteSpace: "pre-line" }}
                        className={`border ${COLOR.tableBorder} px-1 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className={COLOR.tableRowOdd} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{it.receiptNo || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{fmt.date(it.receiptDate) || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell}`}>{it.itemName || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{it.itemUnit || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.billingQty} /></td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.rate} /></td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.amount} /></td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{it.gstPercent != null ? `${it.gstPercent}%` : "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.gstAmount} /></td>
                    </tr>
                  ))}
                  {/* totals row */}
                  <tr className={COLOR.signatureBg}>
                    <td colSpan={5} className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>TOTAL</td>
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5`} />
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5`} />
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={data.basicAmount} /></td>
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5`} />
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={data.gstAmount} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── GRAND TOTAL ── */}
          <div className="px-6 pb-2 flex justify-end">
            <div className="text-right">
              <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700`}>Grand Total : </span>
              <span className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900`}>₹ {fmtAmt(data.totalAmount)}</span>
            </div>
          </div>

          {/* ── AUDIT TRAIL + PHYSICAL SIGNATURES ── */}
          <div className="px-6 pt-3 pb-5" style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gridTemplateRows: "auto auto auto", columnGap: "32px", rowGap: 0 }}>

            {/* col 1 spans rows 1-2: audit trail */}
            <div style={{ gridColumn: 1, gridRow: "1 / 3" }}>
              <SigRow label="BRB Created By" name={data.createdBy}  dateStr={data.createdAt} />
              <SigRow label="Approved By"    name={data.approvedBy} dateStr={data.finalApprovedAt} />
            </div>

            {/* row 1 col 2-3: empty space above line */}
            <div style={{ gridColumn: 2, gridRow: 1 }} />
            <div style={{ gridColumn: 3, gridRow: 1 }} />

            {/* row 2 col 2-3: the line, aligned with bottom of Approved By */}
            <div style={{ gridColumn: 2, gridRow: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "1px solid #1f2937" }} />
            </div>
            <div style={{ gridColumn: 3, gridRow: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "1px solid #1f2937" }} />
            </div>

            {/* row 3 col 2-3: labels below the line */}
            {["Verified By", "Prepared By"].map((lbl, i) => (
              <p key={lbl} style={{ gridColumn: i + 2, gridRow: 3 }}
                className={`mt-0.5 text-center ${SIZE.labelText} ${WEIGHT.bold} text-gray-800 uppercase tracking-wider`}
              >{lbl}</p>
            ))}

          </div>
        </div>
      </div>

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
