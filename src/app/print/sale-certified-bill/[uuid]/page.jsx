"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt, ITEM_NAME, ITEM_SUB } from "@/components/print/printStyles";

/* ─── helpers ──────────────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[160px] min-w-[160px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-900 flex-1`}>{value || "-"}</span>
    </div>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 mr-2`}>:</span>
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
    TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try {
    const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png");
    logoBuffer = await r.arrayBuffer();
  } catch (_) {}

  let qrBuffer = null;
  try {
    const c = qrCanvasRef?.current;
    if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then((r) => r.arrayBuffer()); }
  } catch (_) {}

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: "Calibri", size: 20, ...opts });
  const nilB       = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const blueShading = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };
  const grayShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };

  const PAGE_W = 10466;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const qrImage = qrBuffer
    ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })
    : null;

  const mkCell = (children, w) =>
    new TableCell({ children, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } });

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({ children: [
      mkCell([new Paragraph({ children: logoContent })], hLogoW),
      mkCell([new Paragraph({ text: "" })], hSpacerW),
      new TableCell({
        children: [
          new Paragraph({ children: [run("SALE CERTIFIED BILL", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  const iL = 1900; const iV = 2000; const iG = 1800; const iR = 1900;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo  = [
    ["Bill No",         data.billingNo],
    ["Bill Date",       fmt.date(data.billingDate)],
    ["Sale Order No",   data.ogSaleOrderNo],
    ["Claim Bill No",   data.claimBillingNo],
    ["Project Code",    data.projectCode],
  ];
  const rightInfo = [
    ["Order Title",     data.orderTitle],
    ["Job Location",    data.jobLocation],
    ["Status",          data.workflowStatus],
    ["Title",           data.title],
    ["",                ""],
  ];

  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: leftInfo.map((left, i) => {
      const right = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        infoCell([new Paragraph({ children: [run(left[0])] })], iL),
        infoCell([new Paragraph({ children: [run(`: ${left[1] || "-"}`)] })], iV),
        infoCell([new Paragraph({ text: "" })], iG),
        infoCell([new Paragraph({ children: [run(right[0])] })], iR),
        infoCell([new Paragraph({ children: [run(right[0] ? `: ${right[1] || "-"}` : "")] })], iW),
      ]});
    }),
  });

  // Items table: SL | Type | Item Code | Item Name & Desc | Unit | Certified Qty | Rate | GST% | Amount
  const cW = [0.05, 0.08, 0.09, 0.29, 0.06, 0.09, 0.10, 0.06, 0.18].map((p) => Math.round(PAGE_W * p));
  cW[8] = PAGE_W - cW.slice(0, 8).reduce((a, b) => a + b, 0);

  const tCell = (text, w, bold = false, shading, align = AlignmentType.LEFT) =>
    new TableCell({
      children: [new Paragraph({ alignment: align, children: [run(String(text ?? ""), { bold, size: bold ? 20 : 18 })] })],
      width: { size: w, type: WidthType.DXA }, shading: shading || undefined, borders: tblBorders,
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
    });

  const tCellMulti = (paras, w, shading) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, shading: shading || undefined, borders: tblBorders, margins: { top: 50, bottom: 50, left: 70, right: 70 } });

  const rawItems    = (data.items    || []).filter(Boolean);
  const rawBoqItems = (data.boqItems || []).filter(Boolean);
  const allRows     = [
    ...rawItems.map((it)    => ({ ...it, rowType: "Non-BOQ" })),
    ...rawBoqItems.map((it) => ({ ...it, rowType: "BOQ" })),
  ];
  const hdrs = ["Sl\nNo", "Type", "Item\nCode", "Item Name & Description", "Unit", "Certified\nQty", "Rate", "GST\n%", "Amount"];

  const nilSide = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const solidB  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const noB     = nilSide;

  const mkAmtRow = (label, val, bold = false, shading) =>
    new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 6, borders: { left: solidB, right: noB, top: nilSide, bottom: nilSide, insideH: nilSide, insideV: nilSide }, width: { size: cW.slice(0, 6).reduce((a, b) => a + b, 0), type: WidthType.DXA }, margins: { top: 0, bottom: 0 } }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [run(label, { bold, size: bold ? 20 : 18 })] })],
        columnSpan: 2,
        width: { size: cW[6] + cW[7], type: WidthType.DXA },
        shading: shading || undefined,
        borders: { top: nilSide, bottom: nilSide, left: solidB, right: solidB, insideH: nilSide, insideV: nilSide },
        margins: { top: 40, bottom: 40, left: 70, right: 70 },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(String(val ?? "-"), { bold, size: bold ? 20 : 18 })] })],
        width: { size: cW[8], type: WidthType.DXA },
        shading: shading || undefined,
        borders: { top: nilSide, bottom: nilSide, left: solidB, right: solidB, insideH: nilSide, insideV: nilSide },
        margins: { top: 40, bottom: 40, left: 70, right: 70 },
      }),
    ]});

  const mkAmtTotalRow = (label, val) =>
    new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ text: "" })], columnSpan: 6, borders: { top: nilSide, bottom: solidB, left: solidB, right: noB, insideH: nilSide, insideV: nilSide }, width: { size: cW.slice(0, 6).reduce((a, b) => a + b, 0), type: WidthType.DXA }, margins: { top: 0, bottom: 0 } }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [run(label, { bold: true, size: 20 })] })],
        columnSpan: 2, width: { size: cW[6] + cW[7], type: WidthType.DXA },
        shading: grayShading, borders: tblBorders,
        margins: { top: 50, bottom: 50, left: 70, right: 70 },
      }),
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(String(val ?? "-"), { bold: true, size: 20 })] })],
        width: { size: cW[8], type: WidthType.DXA },
        shading: grayShading, borders: tblBorders,
        margins: { top: 50, bottom: 50, left: 70, right: 70 },
      }),
    ]});

  const billedAmount = Number(data.billedAmount || data.thisBillClaim || 0);
  const gstAmount    = Number(data.gstAmount    || 0);
  const totalAmount  = billedAmount + gstAmount;

  const itemsTable = new Table({
    columnWidths: cW, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children: hdrs.map((h, i) => tCell(h, cW[i], true, headShading, AlignmentType.CENTER)) }),
      ...allRows.map((item, idx) => new TableRow({ children: [
        tCell(idx + 1,                                          cW[0], false, undefined, AlignmentType.CENTER),
        tCell(item.rowType,                                     cW[1], false, undefined, AlignmentType.CENTER),
        tCell(item.itemCode,                                    cW[2]),
        tCellMulti([
          new Paragraph({ children: [run(item.itemName || "", { bold: true, size: 19 })] }),
          ...(item.itemDescription ? [new Paragraph({ children: [run(item.itemDescription, { size: 16, color: "6B7280" })] })] : []),
        ], cW[3]),
        tCell(item.unit,                                        cW[4], false, undefined, AlignmentType.CENTER),
        tCell(item.certifiedQty ?? item.claimQty,               cW[5], false, undefined, AlignmentType.RIGHT),
        tCell(fmt.number(item.rate),                            cW[6], false, undefined, AlignmentType.RIGHT),
        tCell(item.gstPercent != null ? `${item.gstPercent}%` : "-", cW[7], false, undefined, AlignmentType.CENTER),
        tCell(fmt.number(item.amount),                          cW[8], false, undefined, AlignmentType.RIGHT),
      ]}) ),
      new TableRow({ children: [
        tCell("", cW[0], false, blueShading), tCell("", cW[1], false, blueShading),
        tCell("", cW[2], false, blueShading), tCell("", cW[3], false, blueShading),
        tCell("", cW[4], false, blueShading), tCell("", cW[5], false, blueShading),
        tCell("TOTAL=", cW[6], true, blueShading, AlignmentType.RIGHT),
        tCell("", cW[7], false, blueShading),
        tCell(fmt.number(billedAmount), cW[8], true, blueShading, AlignmentType.RIGHT),
      ]}),
      mkAmtRow("This Bill Amount", fmt.number(billedAmount)),
      mkAmtRow("GST Amount",       fmt.number(gstAmount)),
      mkAmtTotalRow("Total Amount", fmt.number(totalAmount)),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: [
      headerTable,
      new Paragraph({ text: "", spacing: { after: 120 } }),
      infoTable,
      new Paragraph({ text: "", spacing: { after: 120 } }),
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
  a.href = url; a.download = `SaleCertifiedBill_${data.billingNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function SaleCertifiedBillPrintPage() {
  const { uuid }    = useParams();
  const [data,      setData]    = useState(null);
  const [error,     setError]   = useState(null);
  const [loading,   setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.PROJECT.SALE_CERTIFIED_BILL.GET_BY_UUID}${uuid}` })
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

  const printItems    = (data.items    || []).filter(Boolean);
  const printBoqItems = (data.boqItems || []).filter(Boolean);
  const allPrintRows  = [
    ...printItems.map((it)    => ({ ...it, rowType: "Non-BOQ" })),
    ...printBoqItems.map((it) => ({ ...it, rowType: "BOQ" })),
  ];
  const billedAmount = Number(data.billedAmount || data.thisBillClaim || 0);
  const gstAmount    = Number(data.gstAmount    || 0);
  const totalAmount  = billedAmount + gstAmount;
  const borderSide   = "1px solid #b0b0b0";

  return (
    <>
      <PrintTopBar
        title={`Sale Certified Bill — ${data.billingNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[960px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <div className="w-[160px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Company Logo"
                width={160} height={80}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                SALE CERTIFIED BILL
              </h1>
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

          {/* ── INFO SECTION ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 px-6 py-3" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Bill No"        value={data.billingNo} />
              <InfoRow label="Bill Date"      value={fmt.date(data.billingDate)} />
              <InfoRow label="Sale Order No"  value={data.ogSaleOrderNo} />
              <InfoRow label="Claim Bill No"  value={data.claimBillingNo} />
              <InfoRow label="Project Code"   value={data.projectCode} />
            </div>
            <div className="pl-6">
              <InfoRow label="Order Title"    value={data.orderTitle} />
              <InfoRow label="Job Location"   value={data.jobLocation} />
              <InfoRow label="Title"          value={data.title} />
              <InfoRow label="Status"         value={data.workflowStatus} />
            </div>
          </div>

          {/* ── ITEMS TABLE ─────────────────────────────────────────────── */}
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {[
                      { label: "SL\nNo",                  align: "center", cls: "w-[5%]"  },
                      { label: "Type",                     align: "center", cls: "w-[8%]"  },
                      { label: "Item\nCode",               align: "center", cls: "w-[8%]"  },
                      { label: "Item Name & Description",  align: "center", cls: "w-[29%]" },
                      { label: "Unit",                     align: "center", cls: "w-[6%]"  },
                      { label: "Certified\nQty",           align: "center", cls: "w-[9%]"  },
                      { label: "Rate",                     align: "center", cls: "w-[10%]" },
                      { label: "GST\n%",                   align: "center", cls: "w-[7%]"  },
                      { label: "Amount",                   align: "center", cls: "w-[18%]" },
                    ].map(({ label, align, cls }) => (
                      <th
                        key={label}
                        className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 text-${align} ${cls}`}
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPrintRows.map((item, idx) => (
                    <tr key={idx} style={{ breakInside: "avoid" }}>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.rowType}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell}`}>{item.itemCode || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5`}>
                        <p className={ITEM_NAME}>{item.itemName || "-"}</p>
                        {item.itemDescription && <p className={ITEM_SUB}>{item.itemDescription}</p>}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.unit || "-"}</td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}>
                        {item.certifiedQty ?? item.claimQty ?? "-"}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={item.rate} /></td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>
                        {item.gstPercent != null ? `${item.gstPercent}%` : "-"}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={item.amount} /></td>
                    </tr>
                  ))}

                  {/* ── Blue TOTAL row ── */}
                  <tr className={COLOR.signatureBg}>
                    <td colSpan={8} className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>
                      TOTAL=
                    </td>
                    <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>
                      <FmtNum value={billedAmount} />
                    </td>
                  </tr>

                  {/* ── Amount summary rows ── */}
                  {[
                    ["This Bill Amount", billedAmount],
                    ["GST Amount",       gstAmount],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td colSpan={6} style={{ borderLeft: borderSide, borderTop: "none", borderBottom: "none", borderRight: "none", padding: 0 }} />
                      <td
                        colSpan={2}
                        style={{ borderLeft: borderSide, borderTop: "none", borderBottom: "none", borderRight: borderSide, padding: "3px 6px" }}
                        className={`${SIZE.tableCell} text-left text-gray-700`}
                      >
                        {label}
                      </td>
                      <td
                        style={{ borderLeft: borderSide, borderRight: borderSide, borderTop: "none", borderBottom: "none", padding: "3px 4px" }}
                        className={`${SIZE.tableCell} text-right`}
                      >
                        <FmtNum value={val} />
                      </td>
                    </tr>
                  ))}

                  {/* ── Total Amount highlighted ── */}
                  <tr>
                    <td
                      colSpan={6}
                      style={{ borderLeft: borderSide, borderBottom: borderSide, borderTop: "none", borderRight: "none", padding: 0 }}
                    />
                    <td
                      colSpan={2}
                      style={{ border: borderSide, padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9" }}
                      className={`${SIZE.tableCell} text-left`}
                    >
                      Total Amount
                    </td>
                    <td
                      style={{ border: borderSide, padding: "4px 4px", fontWeight: 700, backgroundColor: "#d9d9d9" }}
                      className={`${SIZE.tableCell} text-right`}
                    >
                      <FmtNum value={totalAmount} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SIGNATURES ─────────────────────────────────────────────── */}
          <div className="px-6 pb-6 pt-4 border-t border-gray-200 mt-2">
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
          size: A4;
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
