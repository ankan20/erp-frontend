"use client";

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
function InfoRow({ label, value, labelWidth = "w-[150px] min-w-[150px]" }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ${labelWidth}`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.medium} text-gray-900 flex-1`}>{value || "-"}</span>
    </div>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && (
        <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-500 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

function SummaryRow({ label, value, highlight = false, bold = false }) {
  return (
    <div className={`flex items-center border-b border-gray-200 ${highlight ? "bg-[#F2B07E]" : "bg-white"}`}>
      <div className={`flex-1 px-3 py-[5px] ${SIZE.labelText} ${bold ? WEIGHT.bold : WEIGHT.normal} text-gray-800`}>
        {label}
      </div>
      <div className={`w-[160px] shrink-0 px-3 py-[5px] text-right ${SIZE.valueText} ${bold ? WEIGHT.bold : WEIGHT.normal} text-gray-900`}>
        {value}
      </div>
    </div>
  );
}

function printAsPDF() {
  window.print();
}

async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try {
    const resp = await fetch("/assets/pdf-images/erp_company_img_pdf.png");
    logoBuffer = await resp.arrayBuffer();
  } catch (_) {}

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

  const nilB       = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };

  const PAGE_W = 10466;

  const mkCell = (children, w) =>
    new TableCell({
      children,
      width: { size: w, type: WidthType.DXA },
      borders: nilBorders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

  // Header
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const qrImage = qrBuffer
    ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })
    : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({
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
    })],
  });

  // Title
  const titleColW  = 4000;
  const titleSideW = Math.floor((PAGE_W - titleColW) / 2);
  const titleTable = new Table({
    columnWidths: [titleSideW, titleColW, PAGE_W - titleSideW - titleColW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: titleSideW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        new TableCell({
          children: [new Paragraph({ children: [run(data.mode?.toUpperCase() || "SALE INVOICE", { bold: true, size: 40 })] })],
          width: { size: titleColW, type: WidthType.DXA },
          borders: nilBorders,
          margins: { top: 80, bottom: 80, left: 0, right: 0 },
        }),
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: PAGE_W - titleSideW - titleColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
      ],
    })],
  });

  // Info 2-col
  const iL = 1800; const iV = 2000; const iG = 2000; const iR = 1800;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo  = [
    ["Invoice No",        data.saleBillNo],
    ["Invoice Date",      fmt.date(data.invoiceDate)],
    ["Reference No",      data.referenceNo || "-"],
    ["Reference Date",    fmt.date(data.referenceDate)],
  ];
  const rightInfo = [
    ["Sale Order No",     data.saleOrderNo],
    ["Bill Abstract No",  data.billAbstractNo],
    ["Bill Abstract Date",fmt.date(data.billAbstractDate)],
    ["Payment Terms",     data.paymentTerms || "-"],
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

  // Address row
  const addrHalf = Math.floor(PAGE_W / 2);
  const addrTable = new Table({
    columnWidths: [addrHalf, PAGE_W - addrHalf],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: tblBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ children: [run("Bill To", { bold: true })] }),
              new Paragraph({ children: [run(data.billToAddress || "-", { size: 18 })] }),
            ],
            width: { size: addrHalf, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [run("Ship To", { bold: true })] }),
              new Paragraph({ children: [run(data.shipToAddress || "-", { size: 18 })] }),
            ],
            width: { size: PAGE_W - addrHalf, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          }),
        ],
      }),
    ],
  });

  // Items table — 5 columns: SL | CC Code | Name & Desc | HSN/SAC | Amount
  const cW = [0.05, 0.11, 0.50, 0.12].map((p) => Math.round(PAGE_W * p));
  cW.push(PAGE_W - cW.reduce((a, b) => a + b, 0)); // Amount takes remainder

  const itemCell = (text, w, isHeader = false, shading) =>
    new TableCell({
      children: [new Paragraph({ children: [run(String(text ?? ""), { bold: isHeader, size: isHeader ? 20 : 18 })] })],
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
        children: ["SL", "CC Code", "Name & Description", "HSN/SAC", "Amount (₹)"].map((h, i) =>
          itemCell(h, cW[i], true, headShading)
        ),
      }),
      ...items.map((item, idx) =>
        new TableRow({
          children: [
            itemCell(idx + 1,                cW[0]),
            itemCell(item.ccCode,            cW[1]),
            itemCell(`${item.ccName}${item.description ? `\n${item.description}` : ""}`, cW[2]),
            itemCell(item.hsnSac || "-",     cW[3]),
            itemCell(fmt.number(item.basicAmount), cW[4]),
          ],
        })
      ),
      new TableRow({
        children: [
          itemCell("", cW[0], false, headShading),
          itemCell("", cW[1], false, headShading),
          itemCell("TOTAL", cW[2], true, headShading),
          itemCell("", cW[3], false, headShading),
          itemCell(fmt.number(data.basicAmount), cW[4], true, headShading),
        ],
      }),
    ],
  });

  // Summary
  const selectedGst = (data.gstLines || []).filter((l) => l.isSelected);
  const summaryRows = [
    ["Basic Amount", fmt.number(data.basicAmount)],
    ...selectedGst.map((l) => [`GST @ ${l.percent}% (${l.gstType})`, fmt.number(l.gstAmount)]),
    ...(Number(data.discount) ? [["Discount", `- ${fmt.number(data.discount)}`]] : []),
    ...(Number(data.roundOff) ? [["Round Off", fmt.number(data.roundOff)]] : []),
    ["Total Invoice Amount", fmt.number(data.totalInvoiceAmount)],
  ];

  const sL = Math.floor(PAGE_W * 0.7);
  const sV = PAGE_W - sL;
  const summaryTable = new Table({
    columnWidths: [sL, sV],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: tblBorders,
    rows: summaryRows.map(([lbl, val], i) => {
      const isTotal = i === summaryRows.length - 1;
      const sh = isTotal ? { type: ShadingType.CLEAR, color: "F2B07E", fill: "F2B07E" } : undefined;
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [run(lbl, { bold: isTotal })] })], width: { size: sL, type: WidthType.DXA }, shading: sh, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
          new TableCell({ children: [new Paragraph({ children: [run(val, { bold: isTotal })], alignment: "right" })], width: { size: sV, type: WidthType.DXA }, shading: sh, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        ],
      });
    }),
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        headerTable,
        titleTable,
        infoTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        addrTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        itemsTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        summaryTable,
        ...(data.declaration ? [
          new Paragraph({ text: "", spacing: { after: 80 } }),
          new Paragraph({ children: [run("Declaration", { bold: true, color: "374151" })], spacing: { after: 40 } }),
          new Paragraph({ children: [run(data.declaration, { size: 18, color: "374151" })], spacing: { after: 80 } }),
        ] : []),
        new Paragraph({ text: "", spacing: { after: 120 } }),
        ...[
          ["Created By",   data.createdBy,   fmt.dateTime(data.createdAt)],
          ["Submitted By", data.submittedBy, fmt.dateTime(data.submittedAt)],
          ["Approved By",  data.approvedBy,  fmt.dateTime(data.finalApprovedAt)],
        ].map(([lbl, name, date]) =>
          new Paragraph({
            children: [
              run(lbl, { color: "374151" }),
              run(" : ", { color: "374151" }),
              run(name || "-"),
              ...(date && date !== "-" ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : []),
            ],
            spacing: { after: 60 },
          })
        ),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `SaleInvoice_${data.saleBillNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function SaleBillPrintPage() {
  const { uuid }    = useParams();
  const [data,      setData]    = useState(null);
  const [error,     setError]   = useState(null);
  const [loading,   setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_BILL.GET_BY_UUID}${uuid}` })
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

  const items       = (data.items    || []).filter(Boolean);
  const selectedGst = (data.gstLines || []).filter((l) => l.isSelected);
  const totalInvoice = Number(data.totalInvoiceAmount || 0);
  const roundOff    = Number(data.roundOff  || 0);
  const discount    = Number(data.discount  || 0);

  return (
    <>
      <PrintTopBar
        title={`${data.mode || "Sale Invoice"} — ${data.saleBillNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-200">
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
                {data.mode || "Sale Invoice"}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-600`}>www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={68} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </div>

          {/* ── INFO SECTION ───────────────────────────────────────────── */}
          <div className="grid px-6 py-3 border-b border-gray-200" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Invoice No"      value={data.saleBillNo} />
              <InfoRow label="Invoice Date"    value={fmt.date(data.invoiceDate)} />
              <InfoRow label="Reference No"    value={data.referenceNo || "-"} />
              <InfoRow label="Reference Date"  value={fmt.date(data.referenceDate)} />
              <InfoRow label="Project Code"    value={data.projectCode} />
            </div>
            <div className="pl-6 border-l border-gray-200">
              <InfoRow label="Sale Order No"     value={data.saleOrderNo} labelWidth="w-[155px] min-w-[155px]" />
              <InfoRow label="Certified Bill No" value={data.certifiedBillNo} labelWidth="w-[155px] min-w-[155px]" />
              <InfoRow label="Bill Abstract No"  value={data.billAbstractNo} labelWidth="w-[155px] min-w-[155px]" />
              <InfoRow label="Abstract Date"     value={fmt.date(data.billAbstractDate)} labelWidth="w-[155px] min-w-[155px]" />
              <InfoRow label="Payment Terms"     value={data.paymentTerms || "-"} labelWidth="w-[155px] min-w-[155px]" />
            </div>
          </div>

          {/* ── ADDRESSES ──────────────────────────────────────────────── */}
          <div className="grid px-6 py-3 border-b border-gray-200" style={{ gridTemplateColumns: "50% 50%" }}>
            <div>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.semibold} text-gray-700 mb-1`}>Bill To</p>
              <p className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-800 whitespace-pre-wrap`}>
                {data.billToAddress || "-"}
              </p>
            </div>
            <div className="pl-6 border-l border-gray-200">
              <p className={`${SIZE.sectionTitle} ${WEIGHT.semibold} text-gray-700 mb-1`}>Ship To</p>
              <p className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-800 whitespace-pre-wrap`}>
                {data.shipToAddress || "-"}
              </p>
            </div>
          </div>

          {/* ── BASIC ITEMS TABLE ──────────────────────────────────────── */}
          <div className="px-6 py-3">
            <p className={`${SIZE.sectionTitle} ${WEIGHT.semibold} text-gray-700 mb-2`}>BASIC</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 600 }}>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {[
                      { label: "SL",               cls: "w-[5%]"  },
                      { label: "CC Code",           cls: "w-[11%]" },
                      { label: "Name & Description",cls: "w-[50%]" },
                      { label: "HSN/SAC",           cls: "w-[12%]" },
                      { label: "Amount (₹)",        cls: "w-[22%]" },
                    ].map(({ label, cls }) => (
                      <th
                        key={label}
                        className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 ${cls}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className={COLOR.tableRowOdd} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`}>{item.ccCode}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5`}>
                        <p className={`${SIZE.tableCell} ${WEIGHT.medium} text-gray-900`}>{item.ccName}</p>
                        {item.description && (
                          <p className={`text-[11px] ${WEIGHT.normal} text-gray-500 mt-0.5`}>{item.description}</p>
                        )}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{item.hsnSac || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`}>
                        <FmtNum value={item.basicAmount} />
                      </td>
                    </tr>
                  ))}
                  <tr className={COLOR.tableHeadBg}>
                    <td colSpan={4} className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>
                      TOTAL
                    </td>
                    <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>
                      <FmtNum value={data.basicAmount} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── GST SECTION ────────────────────────────────────────────── */}
          {selectedGst.length > 0 && (
            <div className="px-6 pb-3">
              <p className={`${SIZE.sectionTitle} ${WEIGHT.semibold} text-gray-700 mb-2`}>GST</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr className="bg-[#F5E4D7]">
                      {["GST Type", "CC Code", "CC Name", "Rate (%)", "GST Amount (₹)"].map((h) => (
                        <th key={h} className={`border ${COLOR.tableBorder} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGst.map((l, idx) => (
                      <tr key={idx} className={COLOR.tableRowOdd}>
                        <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center ${WEIGHT.semibold}`}>{l.gstType}</td>
                        <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`}>{l.ccCode}</td>
                        <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`}>{l.ccName}</td>
                        <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{l.percent}%</td>
                        <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`}>
                          <FmtNum value={l.gstAmount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SUMMARY ────────────────────────────────────────────────── */}
          <div className="px-6 pb-3">
            <div className="ml-auto w-full max-w-[420px] border border-gray-200 rounded-sm overflow-hidden">
              <SummaryRow label="Basic Amount" value={<FmtNum value={data.basicAmount} />} />
              {selectedGst.map((l, i) => (
                <SummaryRow key={i} label={`GST @ ${l.percent}% (${l.gstType})`} value={<FmtNum value={l.gstAmount} />} />
              ))}
              {discount > 0 && (
                <SummaryRow label="Discount" value={<>- <FmtNum value={discount} /></>} />
              )}
              {roundOff !== 0 && (
                <SummaryRow
                  label="Round Off"
                  value={
                    <span className={roundOff > 0 ? "text-green-700" : "text-red-600"}>
                      {roundOff > 0 ? "+" : "-"}<FmtNum value={Math.abs(roundOff)} />
                    </span>
                  }
                />
              )}
              <SummaryRow label="Total Invoice Amount (Rs.)" value={<FmtNum value={totalInvoice} />} highlight bold />
            </div>
          </div>

          {/* ── AMOUNT IN WORDS ────────────────────────────────────────── */}
          <div className="px-6 pb-3">
            <div className="flex border border-gray-200 rounded-sm overflow-hidden">
              <div className="px-3 py-2 bg-[#DCE8D2] shrink-0 text-[12px] font-semibold text-gray-800">
                Amount (In Words)
              </div>
              <div className="flex-1 px-3 py-2 bg-[#F8EFC8] text-[12px] italic text-gray-800">
                {totalInvoice > 0 ? amountToWordsIN(totalInvoice) : "-"}
              </div>
            </div>
          </div>

          {/* ── DECLARATION ────────────────────────────────────────────── */}
          {data.declaration && (
            <div className="px-6 pb-3">
              <p className={`${SIZE.sectionTitle} ${WEIGHT.semibold} text-gray-700 mb-1`}>Declaration</p>
              <p className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-700 whitespace-pre-wrap leading-relaxed`}>
                {data.declaration}
              </p>
            </div>
          )}

          {/* ── SIGNATURES ─────────────────────────────────────────────── */}
          <div className="px-6 pb-6 pt-2 border-t border-gray-200 mt-2">
            <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
            <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
          </div>

        </div>
      </div>

      {/* Hidden QR canvas used by DOCX download */}
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
