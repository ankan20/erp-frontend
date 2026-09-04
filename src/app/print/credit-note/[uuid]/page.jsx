"use client";
import { DOCX_FONT } from "@/config/fonts.config";

import { useEffect, useRef, useState } from "react";
import { useParams }      from "next/navigation";
import Image              from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest }  from "@/lib/publicRequest";
import { API_ENDPOINTS }  from "@/config/api.config";
import PrintTopBar        from "@/components/print/PrintTopBar";
import PrintErrorPage     from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt } from "@/components/print/printStyles";
import { amountToWordsIN } from "@/lib/amountToWords";

/* ── helpers ───────────────────────────────────────────────────────────────── */
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;
const B   = "border border-[#b0b0b0]";

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

/* ── DOCX export ───────────────────────────────────────────────────────────── */
async function downloadDocx(data, uuid, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try { const c = qrCanvasRef?.current; if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r => r.arrayBuffer()); } } catch (_) {}

  const run      = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: DOCX_FONT, size: 20, ...opts });
  const nilB     = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBords = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblB     = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBords = { top: tblB, bottom: tblB, left: tblB, right: tblB, insideH: tblB, insideV: tblB };
  const headShd  = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };
  const totalShd = { type: ShadingType.CLEAR, color: "F2B07E", fill: "F2B07E" };
  const PAGE_W   = 10466;

  const hLogoW = 2600; const hQrW = 2400; const hSpW = PAGE_W - hLogoW - hQrW;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const qrImage = qrBuffer ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" }) : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpW, hQrW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBords,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logoContent })], width: { size: hLogoW, type: WidthType.DXA }, borders: nilBords, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: hSpW, type: WidthType.DXA }, borders: nilBords }),
      new TableCell({
        children: [
          new Paragraph({ children: [run("CREDIT NOTE", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBords, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  const iL = 1600; const iV = 2400; const iG = 1000; const iR = 1600;
  const iW = PAGE_W - iL - iV - iG - iR;
  const ic = (paras, w) => new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBords, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo  = [
    ["CN No.",        data.creditNoteNo  || "-"],
    ["Entry Date",    fmt.date(data.entryDate)],
    ["Bill Number",   data.billNumber    || "-"],
    ["Bill Date",     fmt.date(data.billDate)],
    ["Project Code",  data.projectCode   || "-"],
  ];
  const rightInfo = [
    ["Order Number",    data.orderNumber    || "-"],
    ["Order Date",      fmt.date(data.orderDate)],
    ["Vendor Name",     data.vendorName     || "-"],
    ["Vendor GSTN",     data.vendorGstn     || "-"],
    ["Debit Note No",   data.debitNoteNo    || "-"],
    ["Debit Note Date", fmt.date(data.debitNoteDate)],
  ];
  const maxRows = Math.max(leftInfo.length, rightInfo.length);
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBords,
    rows: Array.from({ length: maxRows }, (_, i) => {
      const l = leftInfo[i]  || ["", ""];
      const r = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        ic([new Paragraph({ children: [run(l[0], { bold: true })] })], iL),
        ic([new Paragraph({ children: [run(`: ${l[1] || "-"}`)] })],   iV),
        ic([new Paragraph({ text: "" })], iG),
        ic([new Paragraph({ children: [run(r[0], { bold: true })] })], iR),
        ic([new Paragraph({ children: [run(`: ${r[1] || "-"}`)] })],  iW),
      ]});
    }),
  });

  const cW = [0.05, 0.10, 0.35, 0.16, 0.12, 0.22].map(p => Math.round(PAGE_W * p));
  cW[2] += PAGE_W - cW.reduce((a, b) => a + b, 0);

  const tc = (content, w, bold = false, shading, align = "left") => {
    const children = Array.isArray(content)
      ? content
      : [new Paragraph({ alignment: align, children: [run(String(content ?? ""), { bold, size: bold ? 20 : 18 })] })];
    return new TableCell({ children, width: { size: w, type: WidthType.DXA }, shading: shading || undefined, margins: { top: 50, bottom: 50, left: 70, right: 70 } });
  };
  const nc = (val, w, bold = false, shading) => tc(fmt.number(val), w, bold, shading, "right");

  const items       = data.items    || [];
  const gstLines    = data.gstLines || [];
  const selectedGst = gstLines.filter((l) => l.isSelected);
  const basicTotal  = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
  const gstTotal    = selectedGst.reduce((s, l) => s + Number(l.gstAmount || 0), 0);
  const totalAmt    = basicTotal + gstTotal;

  const mainTable = new Table({
    columnWidths: cW, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBords,
    rows: [
      new TableRow({ tableHeader: true, children: ["SL", "CC Code", "CC Name & Description", "Basic (₹)", "GST %", "Total (₹)"].map((h, i) => tc(h, cW[i], true, headShd, "center")) }),
      ...items.map((it, idx) => {
        const rowTotal = Number(it.basicAmount || 0) * (1 + Number(it.gstPercent || 0) / 100);
        return new TableRow({ children: [
          tc(idx + 1,           cW[0], false, undefined, "center"),
          tc(it.ccCode,         cW[1]),
          tc(`${it.ccName}${it.description ? `\n${it.description}` : ""}`, cW[2]),
          nc(it.basicAmount,    cW[3]),
          tc(`${it.gstPercent || 0}%`, cW[4], false, undefined, "center"),
          nc(rowTotal,          cW[5], true),
        ]});
      }),
      ...selectedGst.map((l) => new TableRow({ children: [
        tc("",     cW[0]),
        tc(l.ccCode, cW[1]),
        tc(`${l.ccName} (${l.percent}%)`, cW[2]),
        nc(basicTotal, cW[3]),
        tc(`${l.percent}%`, cW[4], false, undefined, "center"),
        nc(l.gstAmount, cW[5], true),
      ]})),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run("Basic Total", { bold: true })] })], columnSpan: 3, width: { size: cW[0]+cW[1]+cW[2], type: WidthType.DXA }, borders: tblBords, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(basicTotal), { bold: true })] })], columnSpan: 3, width: { size: cW[3]+cW[4]+cW[5], type: WidthType.DXA }, borders: tblBords, shading: headShd, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run("GST Total", { bold: true })] })], columnSpan: 3, width: { size: cW[0]+cW[1]+cW[2], type: WidthType.DXA }, borders: tblBords, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(gstTotal), { bold: true })] })], columnSpan: 3, width: { size: cW[3]+cW[4]+cW[5], type: WidthType.DXA }, borders: tblBords, shading: headShd, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run("TOTAL AMOUNT (Rs.)", { bold: true, size: 20 })] })], columnSpan: 3, width: { size: cW[0]+cW[1]+cW[2], type: WidthType.DXA }, borders: tblBords, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(totalAmt), { bold: true, size: 20 })] })], columnSpan: 3, width: { size: cW[3]+cW[4]+cW[5], type: WidthType.DXA }, borders: tblBords, shading: totalShd, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ children: [run("Amount in Words: ", { bold: true }), run(amountToWordsIN(totalAmt), { italic: true })] })],
          columnSpan: 6, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBords,
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
        }),
      ]}),
      ...(data.remarks ? [new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ children: [run("Remarks: ", { bold: true }), run(data.remarks)] })],
          columnSpan: 6, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBords,
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
        }),
      ]})] : []),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: [
      headerTable,
      new Paragraph({ text: "", spacing: { after: 80 } }),
      infoTable,
      new Paragraph({ text: "", spacing: { after: 80 } }),
      mainTable,
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
  a.href     = url;
  a.download = `CreditNote_${data.creditNoteNo || uuid}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function CreditNotePrintPage() {
  const { uuid }  = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.CREDIT_NOTE.GET_BY_UUID}${uuid}` })
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

  const items       = data.items    || [];
  const gstLines    = data.gstLines || [];
  const selectedGst = gstLines.filter((l) => l.isSelected);
  const basicTotal  = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
  const gstTotal    = selectedGst.reduce((s, l) => s + Number(l.gstAmount || 0), 0);
  const totalAmt    = basicTotal + gstTotal;

  return (
    <>
      <PrintTopBar
        title={`Credit Note — ${data.creditNoteNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, uuid, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[960px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* HEADER */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Company Logo"
                width={150} height={75} className="object-contain" priority />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                Credit Note
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

          {/* INFO */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="space-y-0.5">
              <InfoRow label="CN No."       value={data.creditNoteNo} />
              <InfoRow label="Entry Date"   value={fmt.date(data.entryDate)} />
              <InfoRow label="Bill Number"  value={data.billNumber} />
              <InfoRow label="Bill Date"    value={fmt.date(data.billDate)} />
              {data.projectCode && <InfoRow label="Project Code" value={data.projectCode} />}
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="Order Number"    value={data.orderNumber} />
              <InfoRow label="Order Date"      value={fmt.date(data.orderDate)} />
              <InfoRow label="Vendor Name"     value={data.vendorName} />
              <InfoRow label="Vendor GSTN"     value={data.vendorGstn} />
              <InfoRow label="Debit Note No"   value={data.debitNoteNo} />
              <InfoRow label="Debit Note Date" value={fmt.date(data.debitNoteDate)} />
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "5%"  }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "22%" }} />
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {["SL", "CC Code", "CC Name & Description", "Basic (₹)", "GST %", "Total (₹)"].map((h) => (
                      <th key={h} className={`${B} px-2 py-1.5 text-center ${SIZE.tableHead} font-semibold text-gray-900`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const rowTotal = Number(it.basicAmount || 0) * (1 + Number(it.gstPercent || 0) / 100);
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? COLOR.tableRowOdd : COLOR.tableRowEven}>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`}>{it.ccCode}</td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`} style={{ wordBreak: "break-word" }}>
                          <span className="font-medium">{it.ccName}</span>
                          {it.description && <span className="block text-[11px] text-gray-500">{it.description}</span>}
                        </td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={it.basicAmount} /></td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{it.gstPercent || 0}%</td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right font-semibold`}><FmtNum value={rowTotal} /></td>
                      </tr>
                    );
                  })}

                  {/* Selected GST lines */}
                  {selectedGst.map((l, idx) => (
                    <tr key={`gst-${idx}`} className={(items.length + idx) % 2 === 0 ? COLOR.tableRowOdd : COLOR.tableRowEven}>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}></td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`}>{l.ccCode}</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`}>
                        {l.ccName}
                        <span className="ml-1 text-gray-400">({l.percent}%)</span>
                      </td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={basicTotal} /></td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{l.percent}%</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right font-semibold`}><FmtNum value={l.gstAmount} /></td>
                    </tr>
                  ))}

                  {/* Basic Total */}
                  <tr>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 600 }} className={`${SIZE.tableCell} text-right`}>Basic Total</td>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 600, backgroundColor: "#D3D3D3" }} className={`${SIZE.tableCell} text-right`}><FmtNum value={basicTotal} /></td>
                  </tr>

                  {/* GST Total */}
                  <tr>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 600 }} className={`${SIZE.tableCell} text-right`}>GST Total</td>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 600, backgroundColor: "#D3D3D3" }} className={`${SIZE.tableCell} text-right`}><FmtNum value={gstTotal} /></td>
                  </tr>

                  {/* Grand Total */}
                  <tr>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700 }} className={SIZE.tableCell + " text-right"}>TOTAL AMOUNT (Rs.)</td>
                    <td colSpan={3} style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#F2B07E" }} className={SIZE.tableCell + " text-right"}><FmtNum value={totalAmt} /></td>
                  </tr>

                  {/* Amount in Words */}
                  <tr>
                    <td colSpan={6} style={{ border: "1px solid #b0b0b0", borderTop: "none", padding: "4px 8px" }} className={SIZE.labelText}>
                      <span style={{ fontWeight: 700 }}>Amount in Words: </span>
                      {totalAmt > 0 ? amountToWordsIN(totalAmt) : "-"}
                    </td>
                  </tr>

                  {/* Remarks */}
                  {data.remarks && (
                    <tr>
                      <td colSpan={6} style={{ border: "1px solid #b0b0b0", borderTop: "none", padding: "4px 8px" }} className={SIZE.labelText}>
                        <span style={{ fontWeight: 700 }}>Remarks: </span>
                        {data.remarks}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="px-6 pb-6 pt-2 border-t border-gray-200 mt-2">
            <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
            <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
          </div>

        </div>
      </div>

      {/* Hidden QR canvas for DOCX */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page {
          size: A4 landscape;
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
