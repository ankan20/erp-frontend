"use client";
import { DOCX_FONT } from "@/config/fonts.config";

import { useEffect, useRef, useState } from "react";
import { useParams }     from "next/navigation";
import Image             from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar       from "@/components/print/PrintTopBar";
import PrintErrorPage    from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt } from "@/components/print/printStyles";
import { amountToWordsIN } from "@/lib/amountToWords";

/* ─── helpers ──────────────────────────────────────────────────────── */
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;

function InfoRow({ label, value }) {
  return (
    <p className={VAL}>
      <span className={LBL}>{label}</span> : {value || "-"}
    </p>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && dateStr !== "-" && (
        <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-500 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

function printAsPDF() { window.print(); }

async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try { const c = qrCanvasRef?.current; if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r => r.arrayBuffer()); } } catch (_) {}

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: DOCX_FONT, size: 20, ...opts });
  const nilB       = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading   = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };
  const grayShading   = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };

  const PAGE_W = 10466;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const qrImage = qrBuffer ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" }) : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logoContent })], width: { size: hLogoW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: hSpacerW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({
        children: [
          new Paragraph({ children: [run(data.mode?.toUpperCase() || "PURCHASE INVOICE", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  const iL = 1800; const iV = 2100; const iG = 1600; const iR = 1800;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) => new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo = [
    ["Bill No",           data.purchaseBillNo],
    ["Processing Date",   fmt.date(data.processingDate)],
    ["Party Name",        data.vendorName],
    ["Vendor Bill No",    data.vendorBillNo || "-"],
    ["Vendor Bill Date",  fmt.date(data.vendorBillDate)],
  ];
  const rightInfo = [
    ["Order No",      data.orderNo],
    ["BVS Number",    data.brrNo],
    ["BVS Date",      fmt.date(data.brrDate)],
    ["Project Code",  data.projectCode],
    ["Remarks",       data.remarks || "-"],
  ];

  const maxRows = Math.max(leftInfo.length, rightInfo.length);
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: Array.from({ length: maxRows }, (_, i) => {
      const left  = leftInfo[i]  || ["", ""];
      const right = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        infoCell([new Paragraph({ children: [run(left[0],  { bold: true })] })], iL),
        infoCell([new Paragraph({ children: [run(`: ${left[1]  || "-"}`)] })], iV),
        infoCell([new Paragraph({ text: "" })], iG),
        infoCell([new Paragraph({ children: [run(right[0], { bold: true })] })], iR),
        infoCell([new Paragraph({ children: [run(`: ${right[1] || "-"}`)] })], iW),
      ]});
    }),
  });

  // Items table — 6 cols (SL 5%, CC 11%, NameL 25%, NameR 25%, HSN 12%, Amt 22%)
  const cW = [0.05, 0.11, 0.50, 0.12].map(p => Math.round(PAGE_W * p));
  cW.push(PAGE_W - cW.reduce((a, b) => a + b, 0));

  const tCell = (text, w, bold = false, shading, align = "left") =>
    new TableCell({
      children: [new Paragraph({ alignment: align, children: [run(String(text ?? ""), { bold, size: bold ? 20 : 18 })] })],
      width: { size: w, type: WidthType.DXA }, shading: shading || undefined, margins: { top: 50, bottom: 50, left: 70, right: 70 },
    });

  const noB   = { style: BorderStyle.NIL, size: 0, color: "auto" };

  const selectedGst = (data.gstLines || []).filter(l => l.isSelected);
  const discount    = Number(data.discount  || 0);
  const roundOff    = Number(data.roundOff  || 0);
  const items       = (data.items || []).filter(Boolean);

  const mkSummaryRow = (label, val) =>
    new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: cW[0] + cW[1] + cW[2] + cW[3], type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: noB } }),
      new TableCell({ children: [new Paragraph({ alignment: "left",  children: [run(label, { size: 18 })] })], width: { size: Math.floor(cW[4] * 0.6), type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 60, right: 0 } }),
      new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(val,   { size: 18 })] })], width: { size: cW[4] - Math.floor(cW[4] * 0.6), type: WidthType.DXA }, borders: { left: noB, right: tblBorder, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 0, right: 60 } }),
    ]});

  const summaryExtRows = [
    ...selectedGst.map(l => mkSummaryRow(`GST @ ${l.percent}% (${l.gstType})`, fmt.number(l.gstAmount))),
    ...(discount > 0 ? [mkSummaryRow("Discount", `- ${fmt.number(discount)}`)] : []),
    mkSummaryRow("Round Off", roundOff === 0 ? "-" : fmt.number(roundOff)),
  ];

  const itemsTable = new Table({
    columnWidths: cW, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children: ["SL", "CC Code", "Name & Description", "HSN/SAC", "Amount (₹)"].map((h, i) => tCell(h, cW[i], true, headShading, "center")) }),
      ...items.map((item, idx) => new TableRow({ children: [
        tCell(idx + 1,                 cW[0], false, undefined, "center"),
        tCell(item.ccCode,             cW[1]),
        tCell(`${item.ccName}${item.description ? `\n${item.description}` : ""}`, cW[2]),
        tCell(item.hsnSac || "-",     cW[3], false, undefined, "center"),
        tCell(fmt.number(item.basicAmount), cW[4], false, undefined, "right"),
      ]})),
      // Total Basic Amount row
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: cW[0] + cW[1] + cW[2] + cW[3], type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: noB } }),
        new TableCell({ children: [new Paragraph({ alignment: "left",  children: [run("Total Basic Amount", { size: 18 })] })], width: { size: Math.floor(cW[4] * 0.6), type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 60, right: 0 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(data.basicAmount), { size: 18 })] })], width: { size: cW[4] - Math.floor(cW[4] * 0.6), type: WidthType.DXA }, borders: { left: noB, right: tblBorder, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 0, right: 60 } }),
      ]}),
      ...summaryExtRows,
      // Total Invoice Amount row
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: cW[0] + cW[1] + cW[2] + cW[3], type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: tblBorder } }),
        new TableCell({ children: [new Paragraph({ alignment: "left", children: [run("Total Invoice Amount (Rs.)", { bold: true, size: 20 })] })], width: { size: Math.floor(cW[4] * 0.6), type: WidthType.DXA }, shading: grayShading, borders: { left: tblBorder, right: noB, top: noB, bottom: tblBorder }, margins: { top: 50, bottom: 50, left: 60, right: 0 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(data.totalInvoiceAmount), { bold: true, size: 20 })] })], width: { size: cW[4] - Math.floor(cW[4] * 0.6), type: WidthType.DXA }, shading: grayShading, borders: { left: noB, right: tblBorder, top: noB, bottom: tblBorder }, margins: { top: 50, bottom: 50, left: 0, right: 60 } }),
      ]}),
      // Amount in words
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ children: [run("Amount in Words: ", { bold: true }), run(amountToWordsIN(Number(data.totalInvoiceAmount || 0)), { italic: true })] })],
          columnSpan: 5,
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: { left: tblBorder, right: tblBorder, top: noB, bottom: tblBorder },
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
        }),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: [
      headerTable,
      new Paragraph({ text: "", spacing: { after: 80 } }),
      infoTable,
      new Paragraph({ text: "", spacing: { after: 80 } }),
      itemsTable,
      new Paragraph({ text: "", spacing: { after: 200 } }),
      ...[
        ["Created By",   data.createdBy,   fmt.dateTime(data.createdAt)],
        ["Submitted By", data.submittedBy, fmt.dateTime(data.submittedAt)],
        ["Approved By",  data.approvedBy,  fmt.dateTime(data.finalApprovedAt)],
      ].map(([lbl, name, date]) => new Paragraph({
        children: [
          run(lbl, { color: "374151" }),
          run(" : ", { color: "374151" }),
          run(name || "-"),
          ...(date && date !== "-" ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : []),
        ],
        spacing: { after: 60 },
      })),
    ]}],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `PurchaseInvoice_${data.purchaseBillNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function PurchaseBillPrintPage() {
  const { uuid }    = useParams();
  const [data,      setData]    = useState(null);
  const [error,     setError]   = useState(null);
  const [loading,   setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.GET_BY_UUID}${uuid}` })
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

  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  const items        = (data.items    || []).filter(Boolean);
  const selectedGst  = (data.gstLines || []).filter((l) => l.isSelected);
  const totalInvoice = Number(data.totalInvoiceAmount || 0);
  const roundOff     = Number(data.roundOff  || 0);
  const discount     = Number(data.discount  || 0);

  return (
    <>
      <PrintTopBar
        title={`${data.mode || "Purchase Invoice"} — ${data.purchaseBillNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Company Logo"
                width={150} height={75}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                {data.mode || "Purchase Invoice"}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-600`}>www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={64} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </div>

          {/* ── INFO SECTION ──────────────────────────────────────────── */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "55% 45%" }}>
            <div className="space-y-0.5">
              <InfoRow label="Bill No"          value={data.purchaseBillNo} />
              <InfoRow label="Processing Date"  value={fmt.date(data.processingDate)} />
              <InfoRow label="Party Name"       value={data.vendorName} />
              <InfoRow label="Vendor Bill No"   value={data.vendorBillNo || "-"} />
              <InfoRow label="Vendor Bill Date" value={fmt.date(data.vendorBillDate)} />
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="Order No"     value={data.orderNo} />
              <InfoRow label="BVS Number"   value={data.brrNo} />
              <InfoRow label="BVS Date"     value={fmt.date(data.brrDate)} />
              <InfoRow label="Project Code" value={data.projectCode} />
              {data.remarks && (
                <p className={VAL}>
                  <span className={LBL}>Remarks</span> :{" "}
                  <span className="whitespace-pre-wrap">{data.remarks}</span>
                </p>
              )}
            </div>
          </div>

          {/* ── ITEMS TABLE + SUMMARY EXTENSION ────────────────────────── */}
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
                <colgroup>
                  <col style={{ width: "5%" }} />   {/* 0: SL */}
                  <col style={{ width: "11%" }} />  {/* 1: CC Code */}
                  <col style={{ width: "25%" }} />  {/* 2: Name Left (merged for items) */}
                  <col style={{ width: "25%" }} />  {/* 3: Name Right / label start */}
                  <col style={{ width: "12%" }} />  {/* 4: HSN/SAC */}
                  <col style={{ width: "22%" }} />  {/* 5: Amount */}
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    <th className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`} style={{ whiteSpace: "nowrap" }}>SL</th>
                    <th className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`} style={{ whiteSpace: "nowrap" }}>CC Code</th>
                    <th colSpan={2} className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>Name & Description</th>
                    <th className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`} style={{ whiteSpace: "nowrap" }}>HSN/SAC</th>
                    <th className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`} style={{ whiteSpace: "nowrap" }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{item.ccCode}</td>
                      <td colSpan={2} className={`border ${COLOR.tableBorder} px-2 py-1.5`}>
                        <p className={`${SIZE.tableCell} ${WEIGHT.medium} text-gray-900`}>{item.ccName}</p>
                        {item.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{item.description}</p>
                        )}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`} style={{ whiteSpace: "nowrap" }}>{item.hsnSac || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}>
                        <FmtNum value={item.basicAmount} />
                      </td>
                    </tr>
                  ))}

                  {/* ── Summary extension rows ── */}
                  {[
                    ["Total Basic Amount", <FmtNum key="basic" value={data.basicAmount} />],
                    ...selectedGst.map((l) => [`GST @ ${l.percent}% (${l.gstType})`, <FmtNum key={l.gstType} value={l.gstAmount} />]),
                    ...(discount > 0 ? [["Discount", <>- <FmtNum value={discount} /></>]] : []),
                    ["Round Off", roundOff === 0
                      ? <span key="ro">-</span>
                      : <span key="ro" className={roundOff > 0 ? "text-green-700" : "text-red-600"}>{roundOff > 0 ? "+" : "-"}<FmtNum value={Math.abs(roundOff)} /></span>
                    ],
                  ].map(([label, val], i) => (
                    <tr key={i}>
                      <td colSpan={3} style={{ borderLeft: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", borderBottom: "none", padding: 0 }} />
                      <td colSpan={2} style={{ borderLeft: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", borderBottom: "none", padding: "2px 6px" }}
                        className={`${SIZE.tableCell} text-left text-gray-700`}>
                        {label}
                      </td>
                      <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderTop: "none", borderBottom: "none", padding: "2px 6px", whiteSpace: "nowrap" }}
                        className={`${SIZE.tableCell} text-right`}>
                        {val}
                      </td>
                    </tr>
                  ))}

                  {/* ── Total Invoice Amount ── */}
                  <tr>
                    <td colSpan={3} style={{ borderLeft: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", borderBottom: "1px solid #b0b0b0", padding: 0 }} />
                    <td colSpan={2} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9" }}
                      className={`${SIZE.tableCell} text-left`}>
                      Total Invoice Amount (Rs.)
                    </td>
                    <td style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9", whiteSpace: "nowrap" }}
                      className={`${SIZE.tableCell} text-right`}>
                      <FmtNum value={totalInvoice} />
                    </td>
                  </tr>

                  {/* ── Amount in Words ── */}
                  <tr>
                    <td colSpan={6}
                      style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "4px 8px" }}
                      className={SIZE.labelText}>
                      <span style={{ fontWeight: 700 }}>Amount in Words: </span>
                      {totalInvoice > 0 ? amountToWordsIN(totalInvoice) : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SIGNATURES ─────────────────────────────────────────────── */}
          <div className="px-6 pb-6 pt-2 border-t border-gray-200 mt-2">
            <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
            <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
          </div>

        </div>
      </div>

      {/* Hidden QR canvas for DOCX download */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 8mm 8mm 12mm 8mm;
          @bottom-center {
            content: counter(page, decimal-leading-zero) " of " counter(pages, decimal-leading-zero);
            font-size: 9pt; color: #6b7280; font-family: ${DOCX_FONT}, sans-serif;
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
