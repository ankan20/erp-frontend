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

/* ─── helpers ─────────────────────────────────────────────── */
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
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[160px] min-w-[160px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ml-3`}>[{dateStr}]</span>}
    </div>
  );
}

/* ─── Download helpers ─────────────────────────────────────── */
function printAsPDF() { window.print(); }

function downloadExcel(data) {
  const XLSX = require("xlsx");
  const items = (data.items || []).filter(Boolean);
  const rows = [
    ["GOODS ISSUE NOTE (GIN)"],
    [],
    ["Site Code",     data.project?.projectCode || "-", "", "GIN No",         data.ginNo],
    ["Project Name",  data.project?.projectName || "-", "", "GIN Date",       fmt.date(data.ginDate)],
    ["Customer Name", data.project?.clientName  || "-", "", "Issue Time",     data.issueTime || "-"],
    ["Party Name",    data.vendor?.ledgerName   || "-", "", "Order No",       data.order?.orderNo || "-"],
    ["Issue Slip No", data.issueSlipNo          || "-", "", "Issue Category", data.issueCategory || "-"],
    ["Cost Head",     data.costHead             || "-", "", "Item Category",  data.itemCategory  || "-"],
    ["Cost Factor",   data.costFactor           || "-", "", "Received By",    data.handedOverTo  || "-"],
    [],
    ["Sl No", "Item Code", "Item Name", "Unit", "Qty", "Used Location"],
    ...items.map((item, i) => [i + 1, item.ginl || "-", item.itemName, item.unit, item.issueQty, item.itemUsedLocation || ""]),
    [],
    ["Recommendation By", data.recommendationBy || "-"],
    ["Issued By",         `${data.submittedBy || "-"}  [${fmt.dateTime(data.submittedAt)}]`],
    ["Document Verified By", `${data.approvedBy || "-"}  [${fmt.dateTime(data.finalApprovedAt)}]`],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 4 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "GIN");
  XLSX.writeFile(wb, `GIN_${data.ginNo}.xlsx`);
}

async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try { const c = qrCanvasRef?.current; if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r => r.arrayBuffer()); } } catch (_) {}

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: "Calibri", size: 20, ...opts });
  const nilB = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const blueShading = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };
  const PAGE_W = 10466;

  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const mkCell = (children, w) => new TableCell({ children, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } });

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      mkCell([new Paragraph({ children: logoContent })], hLogoW),
      mkCell([new Paragraph({ text: "" })], hSpacerW),
      new TableCell({
        children: [
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
          ...(qrBuffer ? [new Paragraph({ children: [new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })] })] : []),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  const titleColW = 4000; const titleSideW = Math.floor((PAGE_W - titleColW) / 2);
  const titleTable = new Table({
    columnWidths: [titleSideW, titleColW, PAGE_W - titleSideW - titleColW],
    width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: titleSideW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
      new TableCell({
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run("GOODS ISSUE NOTE", { bold: true, size: 44 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run("[GIN]", { bold: true, size: 32 })] }),
        ],
        width: { size: titleColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 80, bottom: 80, left: 0, right: 0 },
      }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: PAGE_W - titleSideW - titleColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
    ]})],
  });

  const iL = 1780; const iV = 1700; const iG = 2600; const iR = 1780;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) => new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });
  const leftInfo  = [
    ["Site Code",    data.project?.projectCode],
    ["Project Name", data.project?.projectName],
    ["Customer Name",data.project?.clientName],
    ["Party Name",   data.vendor?.ledgerName],
    ["Issue Slip No",data.issueSlipNo],
    ["Cost Head",    data.costHead],
    ["Cost Factor",  data.costFactor],
  ];
  const rightInfo = [
    ["GIN No",         data.ginNo],
    ["GIN Date",       fmt.date(data.ginDate)],
    ["Issue Time",     data.issueTime],
    ["Order No",       data.order?.orderNo],
    ["Issue Category", data.issueCategory],
    ["Item Category",  data.itemCategory],
    ["Received By",    data.handedOverTo],
  ];
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: leftInfo.map((left, i) => {
      const right = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        infoCell([new Paragraph({ children: [run(left[0])] })], iL),
        infoCell([new Paragraph({ children: [run(`: ${left[1] || "-"}`)] })], iV),
        infoCell([new Paragraph({ text: "" })], iG),
        infoCell([new Paragraph({ children: [run(right[0])] })], iR),
        infoCell([new Paragraph({ children: [run(`: ${right[1] || "-"}`)] })], iW),
      ]});
    }),
  });

  const items = (data.items || []).filter(Boolean);
  const cW = [0.06, 0.12, 0.40, 0.10, 0.12, 0.20].map(p => Math.round(PAGE_W * p));
  cW[5] = PAGE_W - cW.slice(0, 5).reduce((a, b) => a + b, 0);
  const iCell = (text, w, bold = false, shading) => new TableCell({
    children: [new Paragraph({ children: [run(String(text ?? "-"), { bold, size: bold ? 20 : 18 })] })],
    width: { size: w, type: WidthType.DXA }, shading: shading || undefined,
    margins: { top: 50, bottom: 50, left: 70, right: 70 },
  });
  const itemsTable = new Table({
    columnWidths: cW, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children: ["Sl No", "Item Code", "Item Name", "Unit", "Qty", "Used Location"].map((h, i) => iCell(h, cW[i], true, headShading)) }),
      ...items.map((item, idx) => new TableRow({ children: [
        iCell(idx + 1, cW[0]),
        iCell(item.ginl || "-", cW[1]),
        iCell(item.itemName, cW[2]),
        iCell(item.unit, cW[3]),
        iCell(item.issueQty, cW[4]),
        iCell(item.itemUsedLocation || "-", cW[5]),
      ]})),
      new TableRow({ children: cW.map(w => iCell("", w, false, blueShading)) }),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: [
      headerTable, titleTable, infoTable,
      new Paragraph({ text: "", spacing: { after: 120 } }),
      itemsTable,
      new Paragraph({ text: "", spacing: { after: 200 } }),
      ...[
        ["Recommendation By",    data.recommendationBy, null],
        ["Issued By",            data.submittedBy,       fmt.dateTime(data.submittedAt)],
        ["Document Verified By", data.approvedBy,        fmt.dateTime(data.finalApprovedAt)],
      ].map(([lbl, name, date]) => new Paragraph({
        children: [
          run(lbl, { color: "374151" }), run(" : ", { color: "374151" }), run(name || "-"),
          ...(date ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : []),
        ],
        spacing: { after: 60 },
      })),
    ]}],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GIN_${data.ginNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function GINPrintPage() {
  const { uuid } = useParams();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_BY_UUID}/${uuid}` })
      .then(res => setData(res.data))
      .catch(err => setError({ status: err.status, message: err.message }))
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

  const items = (data.items || []).filter(Boolean);

  return (
    <>
      <PrintTopBar
        title={`GIN — ${data.ginNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadExcel={() => downloadExcel(data)}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
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
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>GOODS ISSUE NOTE</h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 tracking-widest`}>[GIN]</p>
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
          <div className="grid grid-cols-2 gap-x-8 px-6 py-3" style={{ gridTemplateColumns: "1fr 1.15fr" }}>
            <div>
              <InfoRow label="Site Code"     value={data.project?.projectCode} />
              <InfoRow label="Project Name"  value={data.project?.projectName} />
              <InfoRow label="Customer Name" value={data.project?.clientName} />
              <InfoRow label="Party Name"    value={data.vendor?.ledgerName} />
              <InfoRow label="Issue Slip No" value={data.issueSlipNo} />
              <InfoRow label="Cost Head"     value={data.costHead} />
              <InfoRow label="Cost Factor"   value={data.costFactor} />
            </div>
            <div className="pl-6">
              <InfoRow label="GIN No"         value={data.ginNo} />
              <InfoRow label="GIN Date"        value={fmt.date(data.ginDate)} />
              <InfoRow label="Issue Time"      value={data.issueTime} />
              <InfoRow label="Order No"        value={data.order?.orderNo} />
              <InfoRow label="Issue Category"  value={data.issueCategory} />
              <InfoRow label="Item Category"   value={data.itemCategory} />
              <InfoRow label="Received By"     value={data.handedOverTo} />
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="px-6 py-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "6%" }} /><col style={{ width: "12%" }} /><col style={{ width: "40%" }} />
                  <col style={{ width: "10%" }} /><col style={{ width: "12%" }} /><col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {[
                      { label: "SL\nNo" }, { label: "Item\nCode" }, { label: "Item Name" },
                      { label: "Unit" },   { label: "Qty" },        { label: "Used\nLocation" },
                    ].map(({ label }) => (
                      <th key={label} style={{ whiteSpace: "pre-line" }}
                        className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className={COLOR.tableRowOdd} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell}`}>{item.ginl || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell}`}>{item.itemName}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`}>{item.unit}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`}>{item.issueQty}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell}`}>{item.itemUsedLocation || ""}</td>
                    </tr>
                  ))}
                  <tr className={COLOR.signatureBg}>
                    {Array(6).fill(null).map((_, j) => (
                      <td key={j} className={`border ${COLOR.tableBorder} px-2 py-2`} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SIGNATURES ── */}
          <div className="px-6 pb-6">
            <SigRow label="Recommendation By"    name={data.recommendationBy} />
            <SigRow label="Issued By"            name={data.submittedBy}  dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Document Verified By" name={data.approvedBy}   dateStr={fmt.dateTime(data.finalApprovedAt)} />
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
            content: counter(page, decimal-leading-zero) " of " counter(pages, decimal-leading-zero);
            font-size: 9pt;
            color: #6b7280;
            font-family: Calibri, sans-serif;
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
