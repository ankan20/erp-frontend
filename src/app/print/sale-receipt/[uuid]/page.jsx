"use client";

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
async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try { const c = qrCanvasRef?.current; if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r => r.arrayBuffer()); } } catch (_) {}

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: "Calibri", size: 20, ...opts });
  const nilB       = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const noB        = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const headShading   = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };
  const blueShading   = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };
  const orangeShading = { type: ShadingType.CLEAR, color: "F2B07E", fill: "F2B07E" };
  const gstShading    = { type: ShadingType.CLEAR, color: "F5E4D7", fill: "F5E4D7" };

  const PAGE_W = 10466;

  // ── Header table ──────────────────────────────────────────────────────────
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const qrImage = qrBuffer ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" }) : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logoContent })], width: { size: hLogoW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: hSpacerW, type: WidthType.DXA }, borders: nilBorders }),
      new TableCell({
        children: [
          new Paragraph({ children: [run("SALE RECEIPT", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  // ── Info 2-col table ──────────────────────────────────────────────────────
  const iL = 1800; const iV = 2200; const iG = 1200; const iR = 1800;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) => new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const accountLabel = data.paymentMode === "Cash" ? "Cash A/c" : "Bank A/c";
  const accountValue = data.paymentMode === "Cash" ? (data.cashAcName || "-") : (data.bankAcName || "-");

  const leftInfo  = [
    ["Receipt No",    data.receiptNo],
    ["Entry Date",    fmt.date(data.entryDate)],
    ["Invoice No",    data.invoiceNo || "-"],
    ["Invoice Date",  fmt.date(data.invoiceDate)],
    ["Payment Mode",  data.paymentMode || "-"],
    ["UTR / Voc. No", data.utrVoucherNo || "-"],
    ...(data.billToAddress ? [["Bill To", data.billToAddress]] : []),
  ];
  const rightInfo = [
    ["Sale Order No",    data.ogSaleOrderNo || "-"],
    ["Sale Order Date",  fmt.date(data.saleOrderDate)],
    ["Certified Bill",   data.certifiedBillNo || "-"],
    ["Bill Abstract No", data.billAbstractNo || "-"],
    ["Abstract Date",    fmt.date(data.billAbstractDate)],
    [accountLabel,       accountValue],
    ...(data.shipToAddress ? [["Ship To", data.shipToAddress]] : []),
  ];

  const maxRows = Math.max(leftInfo.length, rightInfo.length);
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: Array.from({ length: maxRows }, (_, i) => {
      const left  = leftInfo[i]  || ["", ""];
      const right = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        infoCell([new Paragraph({ children: [run(left[0],  { bold: true })] })], iL),
        infoCell([new Paragraph({ children: [run(`: ${left[1] || "-"}`)] })],   iV),
        infoCell([new Paragraph({ text: "" })], iG),
        infoCell([new Paragraph({ children: [run(right[0], { bold: true })] })], iR),
        infoCell([new Paragraph({ children: [run(`: ${right[1] || "-"}`)] })],  iW),
      ]});
    }),
  });

  // ── Items + GST + summary table ──────────────────────────────────────────
  // 7 columns: SL | CC Code | CC Name | Booked | Received | Balance | Current
  const cW = [0.05, 0.10, 0.29, 0.14, 0.14, 0.14, 0.14].map(p => Math.round(PAGE_W * p));
  cW[2] += PAGE_W - cW.reduce((a, b) => a + b, 0); // absorb rounding

  const tCell = (content, w, bold = false, shading, align = "left") => {
    const children = Array.isArray(content)
      ? content
      : [new Paragraph({ alignment: align, children: [run(String(content ?? ""), { bold, size: bold ? 20 : 18 })] })];
    return new TableCell({ children, width: { size: w, type: WidthType.DXA }, shading: shading || undefined, margins: { top: 50, bottom: 50, left: 70, right: 70 } });
  };

  const numCell = (val, w, bold = false, shading) =>
    tCell(fmt.number(val), w, bold, shading, "right");

  const items       = (data.items    || []);
  const selectedGst = (data.gstLines || []).filter(l => l.isSelected);
  const discount    = Number(data.discount  || 0);
  const roundOff    = Number(data.roundOff  || 0);

  // Helper for summary extension (left 3 cols empty, label+value on right 4)
  const mkSummaryRow = (label, val, highlight = false, shading) => {
    const sh = shading || (highlight ? orangeShading : undefined);
    const emptySpan = cW[0] + cW[1] + cW[2] + cW[3];
    const labelW = Math.floor((cW[4] + cW[5]) * 1);
    const valueW = cW[6];
    return new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 4, width: { size: emptySpan, type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: noB } }),
      new TableCell({ children: [new Paragraph({ alignment: "left",  children: [run(label, { bold: highlight, size: 18 })] })], columnSpan: 2, width: { size: labelW, type: WidthType.DXA }, shading: sh, borders: { left: tblBorder, right: noB, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 60, right: 0 } }),
      new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(val,   { bold: highlight, size: 18 })] })], width: { size: valueW, type: WidthType.DXA }, shading: sh, borders: { left: noB, right: tblBorder, top: noB, bottom: noB }, margins: { top: 40, bottom: 40, left: 0, right: 60 } }),
    ]});
  };

  const mainTable = new Table({
    columnWidths: cW, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBorders,
    rows: [
      // Header
      new TableRow({ tableHeader: true, children: ["SL", "CC Code", "CC Name", "Booked (₹)", "Received (₹)", "Balance (₹)", "Current (₹)"].map((h, i) => tCell(h, cW[i], true, headShading, "center")) }),
      // Item rows
      ...items.map((it, idx) => new TableRow({ children: [
        tCell(idx + 1,                cW[0], false, undefined, "center"),
        tCell(it.ccCode,              cW[1]),
        tCell(it.ccName,              cW[2]),
        numCell(it.bookedAmount,   cW[3]),
        numCell(it.receivedAmount, cW[4]),
        numCell(it.balanceAmount,  cW[5]),
        numCell(it.currentAmount,  cW[6], true),
      ]})),
      // Basic total row
      new TableRow({ children: [
        tCell("", cW[0], false, blueShading),
        tCell("", cW[1], false, blueShading),
        tCell("", cW[2], false, blueShading),
        tCell("", cW[3], false, blueShading),
        tCell("", cW[4], false, blueShading),
        tCell("Basic Total", cW[5], true, blueShading, "right"),
        numCell(data.basicAmount, cW[6], true, blueShading),
      ]}),
      // GST header separator (if any selected)
      ...(selectedGst.length > 0 ? [
        new TableRow({ children: [
          new TableCell({ children: [new Paragraph({ children: [run("GST", { bold: true, size: 18 })] })], columnSpan: 7, width: { size: PAGE_W, type: WidthType.DXA }, shading: gstShading, borders: tblBorders, margins: { top: 40, bottom: 40, left: 80, right: 80 } }),
        ]}),
        ...selectedGst.map((l) => new TableRow({ children: [
          tCell("",                            cW[0], false, undefined, "center"),
          tCell(l.ccCode,                      cW[1]),
          tCell(`${l.ccName} (${l.percent}%)`, cW[2]),
          numCell(l.bookedAmount,   cW[3]),
          numCell(l.receivedAmount, cW[4]),
          numCell(l.balanceAmount,  cW[5]),
          numCell(l.currentAmount,  cW[6], true),
        ]})),
        // GST total
        new TableRow({ children: [
          tCell("", cW[0], false, blueShading),
          tCell("", cW[1], false, blueShading),
          tCell("", cW[2], false, blueShading),
          tCell("", cW[3], false, blueShading),
          tCell("", cW[4], false, blueShading),
          tCell("GST Total", cW[5], true, blueShading, "right"),
          numCell(data.gstAmount, cW[6], true, blueShading),
        ]}),
      ] : []),
      // Summary extension: discount, round off
      ...(discount > 0 ? [mkSummaryRow("Discount", `- ${fmt.number(discount)}`)] : []),
      ...(roundOff !== 0 ? [mkSummaryRow("Round Off", (roundOff > 0 ? "+" : "") + fmt.number(roundOff))] : []),
      // Total Invoice Amount
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 4, width: { size: cW[0]+cW[1]+cW[2]+cW[3], type: WidthType.DXA }, borders: { left: tblBorder, right: noB, top: noB, bottom: tblBorder } }),
        new TableCell({ children: [new Paragraph({ alignment: "left",  children: [run("Total Invoice Amount (Rs.)", { bold: true, size: 20 })] })], columnSpan: 2, width: { size: cW[4]+cW[5], type: WidthType.DXA }, shading: orangeShading, borders: { left: tblBorder, right: noB, top: noB, bottom: tblBorder }, margins: { top: 50, bottom: 50, left: 60, right: 0 } }),
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run(fmt.number(data.totalInvoiceAmount), { bold: true, size: 20 })] })], width: { size: cW[6], type: WidthType.DXA }, shading: orangeShading, borders: { left: noB, right: tblBorder, top: noB, bottom: tblBorder }, margins: { top: 50, bottom: 50, left: 0, right: 60 } }),
      ]}),
      // Amount in words
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ children: [run("Amount in Words: ", { bold: true }), run(amountToWordsIN(Number(data.totalInvoiceAmount || 0)), { italic: true })] })],
          columnSpan: 7, width: { size: PAGE_W, type: WidthType.DXA },
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
  a.href = url;
  a.download = `SaleReceipt_${data.receiptNo || uuid}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main Page ─────────────────────────────────────────────────────────────── */
export default function SaleReceiptPrintPage() {
  const { uuid }    = useParams();
  const [data,      setData]    = useState(null);
  const [error,     setError]   = useState(null);
  const [loading,   setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.GET_BY_UUID}${uuid}` })
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
  const selectedGst = (data.gstLines || []).filter((l) => l.isSelected);
  const totalInvoice = Number(data.totalInvoiceAmount || 0);
  const discount    = Number(data.discount  || 0);
  const roundOff    = Number(data.roundOff  || 0);

  const accountLabel = data.paymentMode === "Cash" ? "Cash A/c" : "Bank A/c";
  const accountValue = data.paymentMode === "Cash" ? data.cashAcName : data.bankAcName;

  const sideBorder = "border-l border-r border-[#b0b0b0]";

  return (
    <>
      <PrintTopBar
        title={`Sale Receipt — ${data.receiptNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[960px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[150px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Company Logo"
                width={150} height={75} className="object-contain" priority />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                Sale Receipt
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

          {/* ── INFO ────────────────────────────────────────────────────── */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="space-y-0.5">
              <InfoRow label="Receipt No"    value={data.receiptNo} />
              <InfoRow label="Entry Date"    value={fmt.date(data.entryDate)} />
              <InfoRow label="Invoice No"    value={data.invoiceNo || "-"} />
              <InfoRow label="Invoice Date"  value={fmt.date(data.invoiceDate)} />
              <InfoRow label="Payment Mode"  value={data.paymentMode} />
              <InfoRow label="UTR / Voc. No" value={data.utrVoucherNo || "-"} />
              {data.billToAddress && (
                <p className={VAL}><span className={LBL}>Bill To</span> : <span className="whitespace-pre-wrap">{data.billToAddress}</span></p>
              )}
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="Sale Order No"    value={data.ogSaleOrderNo} />
              <InfoRow label="Sale Order Date"  value={fmt.date(data.saleOrderDate)} />
              <InfoRow label="Certified Bill"   value={data.certifiedBillNo} />
              <InfoRow label="Bill Abstract No" value={data.billAbstractNo} />
              <InfoRow label="Abstract Date"    value={fmt.date(data.billAbstractDate)} />
              <InfoRow label={accountLabel}     value={accountValue || "-"} />
              {data.shipToAddress && (
                <p className={VAL}><span className={LBL}>Ship To</span> : <span className="whitespace-pre-wrap">{data.shipToAddress}</span></p>
              )}
            </div>
          </div>

          {/* ── BASIC TABLE ─────────────────────────────────────────────── */}
          <div className="px-6 pb-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "5%"  }} /> {/* SL */}
                  <col style={{ width: "10%" }} /> {/* CC Code */}
                  <col style={{ width: "29%" }} /> {/* CC Name */}
                  <col style={{ width: "14%" }} /> {/* Booked */}
                  <col style={{ width: "14%" }} /> {/* Received */}
                  <col style={{ width: "14%" }} /> {/* Balance */}
                  <col style={{ width: "14%" }} /> {/* Current */}
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {["SL", "CC Code", "CC Name", "Booked (₹)", "Received (₹)", "Balance (₹)", "Current (₹)"].map((h) => (
                      <th key={h} className={`${B} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? COLOR.tableRowOdd : COLOR.tableRowEven}>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{it.ccCode}</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.medium}`}>{it.ccName}</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.bookedAmount} /></td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.receivedAmount} /></td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.balanceAmount} /></td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right ${WEIGHT.semibold}`} style={{ whiteSpace: "nowrap" }}><FmtNum value={it.currentAmount} /></td>
                    </tr>
                  ))}

                  {/* Basic Total */}
                  <tr className="bg-[#b6dde8]">
                    <td colSpan={5} className={`${B} px-2 py-1.5`} />
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`} style={{ whiteSpace: "nowrap" }}>Basic Total</td>
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={data.basicAmount} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── GST TABLE (selected lines only) ─────────────────────────── */}
          {selectedGst.length > 0 && (
            <div className="px-6 pb-2">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "5%"  }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "29%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: "#F5E4D7" }}>
                      <th colSpan={7} className={`${B} px-3 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-left text-gray-800`}>
                        GST
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGst.map((l, idx) => (
                      <tr key={l.gstType} className={idx % 2 === 0 ? COLOR.tableRowOdd : COLOR.tableRowEven}>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell}`} style={{ whiteSpace: "nowrap" }}>{l.ccCode}</td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.medium}`}>
                          {l.ccName}
                          <span className="ml-1 text-gray-400 font-normal">({l.percent}%)</span>
                        </td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={l.bookedAmount} /></td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={l.receivedAmount} /></td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={l.balanceAmount} /></td>
                        <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right ${WEIGHT.semibold}`} style={{ whiteSpace: "nowrap" }}><FmtNum value={l.currentAmount} /></td>
                      </tr>
                    ))}

                    {/* GST Total */}
                    <tr className="bg-[#b6dde8]">
                      <td colSpan={5} className={`${B} px-2 py-1.5`} />
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`} style={{ whiteSpace: "nowrap" }}>GST Total</td>
                      <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`} style={{ whiteSpace: "nowrap" }}><FmtNum value={data.gstAmount} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SUMMARY EXTENSION ───────────────────────────────────────── */}
          <div className="px-6 pb-3">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "56%" }} /> {/* empty left */}
                <col style={{ width: "30%" }} /> {/* label */}
                <col style={{ width: "14%" }} /> {/* value */}
              </colgroup>
              <tbody>
                {discount > 0 && (
                  <tr>
                    <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", borderBottom: "none", padding: 0 }} />
                    <td style={{ borderLeft: "1px solid #b0b0b0", padding: "2px 6px" }} className={`${SIZE.tableCell} text-left text-gray-700`}>Discount</td>
                    <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", padding: "2px 6px", whiteSpace: "nowrap" }} className={`${SIZE.tableCell} text-right`}>- <FmtNum value={discount} /></td>
                  </tr>
                )}
                {roundOff !== 0 && (
                  <tr>
                    <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", borderBottom: "none", padding: 0 }} />
                    <td style={{ borderLeft: "1px solid #b0b0b0", padding: "2px 6px" }} className={`${SIZE.tableCell} text-left text-gray-700`}>Round Off</td>
                    <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", padding: "2px 6px", whiteSpace: "nowrap" }} className={`${SIZE.tableCell} text-right ${roundOff > 0 ? "text-green-700" : "text-red-600"}`}>
                      {roundOff > 0 ? "+" : "-"}<FmtNum value={Math.abs(roundOff)} />
                    </td>
                  </tr>
                )}

                {/* Total Invoice Amount */}
                <tr>
                  <td style={{ borderLeft: "1px solid #b0b0b0", borderBottom: "1px solid #b0b0b0", borderRight: "none", borderTop: "none", padding: 0 }} />
                  <td style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9" }} className={SIZE.tableCell}>
                    Total Invoice Amount (Rs.)
                  </td>
                  <td style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9", whiteSpace: "nowrap" }} className={`${SIZE.tableCell} text-right`}>
                    <FmtNum value={totalInvoice} />
                  </td>
                </tr>

                {/* Amount in words */}
                <tr>
                  <td colSpan={3}
                    style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "4px 8px" }}
                    className={SIZE.labelText}>
                    <span style={{ fontWeight: 700 }}>Amount in Words: </span>
                    {totalInvoice > 0 ? amountToWordsIN(totalInvoice) : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── PAYMENT REMARKS ─────────────────────────────────────────── */}
          {data.paymentRemarks && (
            <div className="px-6 pb-3">
              <p className={`${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`}>
                Payment Remarks : <span className={`${WEIGHT.normal} text-gray-700`}>{data.paymentRemarks}</span>
              </p>
            </div>
          )}

          {/* ── SIGNATURES ──────────────────────────────────────────────── */}
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
            font-size: 9pt; color: #6b7280; font-family: Calibri, sans-serif;
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
