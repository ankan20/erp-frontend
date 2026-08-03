"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt, ITEM_NAME, ITEM_SUB } from "@/components/print/printStyles";

/* ─── helpers ─────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[130px] min-w-[130px]`}>
        {label}
      </span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-900 flex-1`}>
        {value || "-"}
      </span>
    </div>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[130px] min-w-[130px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && (
        <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

/* ─── Download helpers ─────────────────────────────────────── */
function printAsPDF() {
  window.print();
}

function downloadExcel(data) {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  const items = (data.items || []).filter(Boolean);

  const rows = [
    ["INDENT"],
    [],
    ["Site Code",    data.project?.projectCode || "-",  "", "Indent No",        `${data.indentNo}${data.siteRegSerialNo ? ` | RSL : ${data.siteRegSerialNo}` : ""}`],
    ["Project Name", data.project?.projectName || "-",  "", "Indent Date",      fmt.date(data.indentDate)],
    ["Customer Name",data.project?.clientName  || "-",  "", "Required Date",    fmt.date(data.requiredWithin)],
    ["Sale Order No",data.saleOrderNo          || "-",  "", "Indent Category",  data.category?.categoryName || "-"],
    [],
    ["Sl No", "Item Code", "Item Name", "Unit", "Qty", "Location", "Note"],
    ...items.map((item, i) => [
      i + 1,
      item.itemCode,
      item.itemName,
      item.unit,
      item.totalQty,
      item.location || "",
      item.note || "",
    ]),
    [],
    ["Indent Placed By", data.indentPlacedBy || "-"],
    ["Created By",  `${data.createdBy  || "-"}  [${fmt.dateTime(data.createdAt)}]`],
    ["Verified By", `${data.submittedBy|| "-"}  [${fmt.dateTime(data.submittedAt)}]`],
    ["Approved By", `${data.approvedBy || "-"}  [${fmt.dateTime(data.finalApprovedAt)}]`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 32 }, { wch: 4 }, { wch: 20 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws, "Indent");
  XLSX.writeFile(wb, `Indent_${data.indentNo}.xlsx`);
}

async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle,
  } = await import("docx");

  // Fetch logo
  let logoBuffer = null;
  try {
    const resp = await fetch("/assets/pdf-images/erp_company_img_pdf.png");
    logoBuffer = await resp.arrayBuffer();
  } catch (_) {}

  // Grab QR from hidden canvas
  let qrBuffer = null;
  try {
    const canvas = qrCanvasRef?.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      qrBuffer = await fetch(dataUrl).then((r) => r.arrayBuffer());
    }
  } catch (_) {}

  const run = (text, opts = {}) =>
    new TextRun({ text: String(text ?? "-"), font: "Calibri", size: 20, ...opts });

  // NIL borders = truly invisible
  const nilB   = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };

  // A4 usable width: 11906 − 2×720 = 10466 DXA
  const PAGE_W = 10466;

  /* ── Header: 3-col table [logo | spacer | qr+website] ── */
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];

  const hLogoW   = 2600;
  const hQrW     = 2400;
  const hSpacerW = PAGE_W - hLogoW - hQrW;

  const mkCell = (children, w) =>
    new TableCell({
      children,
      width: { size: w, type: WidthType.DXA },
      borders: nilBorders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

  const qrImage = qrBuffer
    ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })
    : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [
      new TableRow({
        children: [
          mkCell([new Paragraph({ children: logoContent })], hLogoW),
          mkCell([new Paragraph({ text: "" })], hSpacerW),
          new TableCell({
            children: [
              new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
              ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
            ],
            width: { size: hQrW, type: WidthType.DXA },
            borders: nilBorders,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
          }),
        ],
      }),
    ],
  });

  // INDENT — 3-col table: spacer | title | spacer to physically center the text
  const indentColW = 3000; // width of the INDENT text cell
  const indentSideW = Math.floor((PAGE_W - indentColW) / 2);
  const indentTitle = new Table({
    columnWidths: [indentSideW, indentColW, PAGE_W - indentSideW - indentColW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "" })], width: { size: indentSideW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
          new TableCell({
            children: [new Paragraph({ children: [run("INDENT", { bold: true, size: 44 })] })],
            width: { size: indentColW, type: WidthType.DXA },
            borders: nilBorders,
            margins: { top: 80, bottom: 80, left: 0, right: 0 },
          }),
          new TableCell({ children: [new Paragraph({ text: "" })], width: { size: PAGE_W - indentSideW - indentColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        ],
      }),
    ],
  });

  /* ── Info 2-col table ── */
  // col widths: lbl | val | gap | lbl | val  (sum = PAGE_W)
  const iL = 1780; const iV = 1700; const iG = 2600; const iR = 1780;
  const iW = PAGE_W - iL - iV - iG - iR;

  const infoCell = (paras, w) =>
    new TableCell({
      children: paras,
      width: { size: w, type: WidthType.DXA },
      borders: nilBorders,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
    });

  const leftInfo  = [
    ["Site Code",    data.project?.projectCode],
    ["Project Name", data.project?.projectName],
    ["Customer Name",data.project?.clientName],
    ["Sale Order No",data.saleOrderNo],
  ];
  const rightInfo = [
    ["Indent No",       `${data.indentNo}${data.siteRegSerialNo ? ` | RSL : ${data.siteRegSerialNo}` : ""}`],
    ["Indent Date",     fmt.date(data.indentDate)],
    ["Required Date",   fmt.date(data.requiredWithin)],
    ["Indent Category", data.category?.categoryName],
  ];

  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: leftInfo.map((left, i) => {
      const right = rightInfo[i] || ["", ""];
      return new TableRow({
        children: [
          infoCell([new Paragraph({ children: [run(left[0])] })], iL),
          infoCell([new Paragraph({ children: [run(`: ${left[1] || "-"}`)] })], iV),
          infoCell([new Paragraph({ text: "" })], iG),
          infoCell([new Paragraph({ children: [run(right[0])] })], iR),
          infoCell([new Paragraph({ children: [run(`: ${right[1] || "-"}`)] })], iW),
        ],
      });
    }),
  });

  /* ── Items table ── */
  // 6%, 12%, 44%, 10%, 10%, 18% of PAGE_W
  const cW = [0.06, 0.12, 0.44, 0.10, 0.10, 0.16].map((p) => Math.round(PAGE_W * p));
  cW[5] = PAGE_W - cW.slice(0, 5).reduce((a, b) => a + b, 0);

  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const blueShading = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };

  const itemCell = (text, w, isHeader = false, shading, note = null) =>
    new TableCell({
      children: [
        new Paragraph({ children: [run(text, { bold: isHeader, size: isHeader ? 20 : 18 })] }),
        ...(note ? [new Paragraph({ children: [run(note, { size: 16, color: "9CA3AF" })] })] : []),
      ],
      width: { size: w, type: WidthType.DXA },
      shading: shading || undefined,
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
    });

  const items = (data.items || []).filter(Boolean);

  const itemsTable = new Table({
    columnWidths: cW,
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: tblBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Sl No","Item Code","Item Name","Unit","Qty","Location"].map((h, i) =>
          itemCell(h, cW[i], true, headShading)
        ),
      }),
      ...items.map((item, idx) =>
        new TableRow({
          children: [
            itemCell(idx + 1, cW[0]),
            itemCell(item.itemCode, cW[1]),
            itemCell(item.itemName, cW[2], false, undefined, item.note || null),
            itemCell(item.unit, cW[3]),
            itemCell(item.totalQty, cW[4]),
            itemCell(item.location || "-", cW[5]),
          ],
        })
      ),
      new TableRow({ children: cW.map((w) => itemCell("", w, false, blueShading)) }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        headerTable,
        indentTitle,
        infoTable,
        new Paragraph({ text: "", spacing: { after: 120 } }),
        itemsTable,
        new Paragraph({ text: "", spacing: { after: 200 } }),
        ...[
          ["Indent Placed By", data.indentPlacedBy,  null],
          ["Created By",       data.createdBy,        fmt.dateTime(data.createdAt)],
          ["Verified By",      data.submittedBy,      fmt.dateTime(data.submittedAt)],
          ["Approved By",      data.approvedBy,       fmt.dateTime(data.finalApprovedAt)],
        ].map(([lbl, name, date]) =>
          new Paragraph({
            children: [
              run(lbl, { color: "374151" }),
              run(" : ", { color: "374151" }),
              run(name || "-"),
              ...(date ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : []),
            ],
            spacing: { after: 60 },
          })
        ),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Indent_${data.indentNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function IndentPrintPage() {
  const { uuid } = useParams();
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef(null);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_BY_UUID}/${uuid}` })
      .then((res) => setData(res.data))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <p className="text-[13px] text-gray-500">Loading document…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <PrintErrorPage status={error?.status} message={error?.message} />;
  }

  const items = (data.items || []).filter(Boolean);

  return (
    <>
      <PrintTopBar
        title={`Indent — ${data.indentNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadExcel={() => downloadExcel(data)}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      {/* Print content */}
      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          ref={contentRef}
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >
          {/* ── HEADER ─────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[160px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Company Logo"
                width={160}
                height={80}
                className="object-contain"
                priority
              />
            </div>

            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                INDENT
              </h1>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-700`}>
                www.dishaanhitech.com
              </span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG
                  value={pageUrl}
                  size={68}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
            </div>
          </div>

          {/* ── INFO SECTION ───────────────────────────────── */}
          <div className="grid grid-cols-2 px-6 py-3" style={{ gridTemplateColumns: "62% 38%" }}>
            <div>
              <InfoRow label="Site Code"      value={data.project?.projectCode} />
              <InfoRow label="Project Name"   value={data.project?.projectName} />
              <InfoRow label="Customer Name"  value={data.project?.clientName} />
              <InfoRow label="Sale Order No"  value={data.saleOrderNo} />
            </div>
            <div className="pl-6">
              <InfoRow label="Indent No"       value={`${data.indentNo}${data.siteRegSerialNo ? ` | RSL : ${data.siteRegSerialNo}` : ""}`} />
              <InfoRow label="Indent Date"     value={fmt.date(data.indentDate)} />
              <InfoRow label="Required Date"   value={fmt.date(data.requiredWithin)} />
              <InfoRow label="Indent Category" value={data.category?.categoryName} />
            </div>
          </div>

          {/* ── ITEMS TABLE ────────────────────────────────── */}
          <div className="px-6 py-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {[
                      { label: "SL\nNo",    cls: "w-[6%]" },
                      { label: "Item\nCode", cls: "w-[12%]" },
                      { label: "Item Name",  cls: "w-[44%]" },
                      { label: "Unit",       cls: "w-[10%]" },
                      { label: "Qty",        cls: "w-[10%]" },
                      { label: "Location",   cls: "w-[14%]" },
                    ].map(({ label, cls }) => (
                      <th
                        key={label}
                        className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 ${cls}`}
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className={COLOR.tableRowOdd} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{item.itemCode}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2`}>
                        <p className={ITEM_NAME}>{item.itemName}</p>
                        {item.note && <p className={ITEM_SUB}>{item.note}</p>}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{item.unit}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{item.totalQty}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-2 ${SIZE.tableCell}`}>{item.location || ""}</td>
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
            <SigRow label="Indent Placed By" name={data.indentPlacedBy} />
            <SigRow label="Created By"       name={data.createdBy}      dateStr={fmt.dateTime(data.createdAt)} />
            <SigRow label="Verified By"      name={data.submittedBy}    dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Approved By"      name={data.approvedBy}     dateStr={fmt.dateTime(data.finalApprovedAt)} />
          </div>
        </div>
      </div>

      {/* Hidden QR canvas used by DOCX download */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      {/* Print-only styles */}
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
