"use client";
import { DOCX_FONT } from "@/config/fonts.config";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar    from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt } from "@/components/print/printStyles";

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

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: DOCX_FONT, size: 20, ...opts });
  const nilB        = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders  = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder   = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders  = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const redShading  = { type: ShadingType.CLEAR, color: "FECACA", fill: "FECACA" };
  const blueShading = { type: ShadingType.CLEAR, color: "BFDBFE", fill: "BFDBFE" };
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
          new Paragraph({ children: [run("UNCERTIFIED STATEMENT", { bold: true, size: 32 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  // Info section
  const iL = 1800; const iV = 2200; const iG = 1600; const iR = 1800;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo  = [["ERP Doc No", data.uaNo], ["Date", fmt.date(data.uaDate)], ["Project", data.projectCode]];
  const rightInfo = [["Status", data.workflowStatus], ["Remarks", data.remarks || "-"], ["", ""]];

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
        infoCell([new Paragraph({ children: [run(`: ${right[1] || "-"}`)] })], iW),
      ]});
    }),
  });

  // Item-level columns: Sl | BOQ Sl | Description | BOQ Qty | Unit | Unit Rate | Claim | Certified | Diff | Over Billing | Cert Hold | Non BOQ | Hold Unsat | Hold Full | Remarks
  const cols = [0.03, 0.04, 0.14, 0.05, 0.04, 0.07, 0.07, 0.07, 0.07, 0.08, 0.08, 0.07, 0.08, 0.08, 0.07].map((p) => Math.round(PAGE_W * p));
  cols[14] = PAGE_W - cols.slice(0, 14).reduce((a, b) => a + b, 0);
  const NC = cols.length;

  const tCell = (text, w, bold = false, shading, align = AlignmentType.LEFT) =>
    new TableCell({
      children: [new Paragraph({ alignment: align, children: [run(String(text ?? ""), { bold, size: bold ? 20 : 18 })] })],
      width: { size: w, type: WidthType.DXA }, shading: shading || undefined, borders: tblBorders,
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
    });

  const navyShading = { type: ShadingType.CLEAR, color: "1E3A5F", fill: "1E3A5F" };

  const hdrs = ["Sl", "BOQ Sl", "Description", "BOQ Qty", "Unit", "Unit Rate", "Claim", "Certified", "Difference",
    "Over Billing / Calc Mistake", "Cert Hold Amnd Pending", "Non BOQ Items Rate", "Hold Unsatisfactory Work", "Hold Full Work Not Done", "Remarks"];

  // Group lines by ogSaleOrderId
  const lineGroups = (data.lines || []).reduce((acc, l, idx) => {
    const k = l.ogSaleOrderId;
    if (!acc[k]) acc[k] = { soNo: l.erpDocNumber, title: l.orderTitle, rows: [] };
    acc[k].rows.push({ ...l, _idx: idx });
    return acc;
  }, {});

  const dataRows = [];
  Object.values(lineGroups).forEach((g) => {
    // Sale order group header row
    const soLabel = `${g.soNo}  |  ${g.title}`;
    dataRows.push(new TableRow({ children: [
      new TableCell({
        children: [new Paragraph({ children: [run(soLabel, { bold: true, size: 18, color: "FFFFFF" })] })],
        columnSpan: NC,
        width: { size: PAGE_W, type: WidthType.DXA }, shading: navyShading, borders: tblBorders,
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
      }),
    ]}));
    g.rows.forEach((l, rowNum) => dataRows.push(new TableRow({ children: [
      tCell(l._idx + 1,                                         cols[0],  false, undefined, AlignmentType.CENTER),
      tCell(l.boqSlNo ?? "",                                    cols[1],  false, undefined, AlignmentType.CENTER),
      tCell(l.itemName || "",                                   cols[2]),
      tCell(l.boqQty != null ? Number(l.boqQty).toLocaleString() : "", cols[3], false, undefined, AlignmentType.RIGHT),
      tCell(l.unit || "",                                       cols[4],  false, undefined, AlignmentType.CENTER),
      tCell(fmt.number(l.unitRate),                             cols[5],  false, undefined, AlignmentType.RIGHT),
      tCell(fmt.number(l.claimAmount),                          cols[6],  false, undefined, AlignmentType.RIGHT),
      tCell(fmt.number(l.certifiedAmount),                      cols[7],  false, undefined, AlignmentType.RIGHT),
      tCell(fmt.number(l.difference),                           cols[8],  false, undefined, AlignmentType.RIGHT),
      tCell(fmt.number(l.overBillingCalculationMistake),        cols[9],  false, redShading,  AlignmentType.RIGHT),
      tCell(fmt.number(l.certifiedHoldAmendmentPending),        cols[10], false, blueShading, AlignmentType.RIGHT),
      tCell(fmt.number(l.nonBoqItemsRate),                      cols[11], false, blueShading, AlignmentType.RIGHT),
      tCell(fmt.number(l.holdWork),                             cols[12], false, blueShading, AlignmentType.RIGHT),
      tCell(fmt.number(l.holdForFullWorkNotCompleted),          cols[13], false, blueShading, AlignmentType.RIGHT),
      tCell(l.remarks || "",                                    cols[14], false, blueShading),
    ]}) ));
  });

  const itemsTable = new Table({
    columnWidths: cols, width: { size: PAGE_W, type: WidthType.DXA }, borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children: hdrs.map((h, i) => tCell(h, cols[i], true, headShading, AlignmentType.CENTER)) }),
      ...dataRows,
      // Totals row
      new TableRow({ children: [
        tCell("", cols[0], false, grayShading), tCell("", cols[1], false, grayShading),
        tCell("Total", cols[2], true, grayShading, AlignmentType.RIGHT),
        tCell("", cols[3], false, grayShading), tCell("", cols[4], false, grayShading), tCell("", cols[5], false, grayShading),
        tCell(fmt.number(data.totalClaim),      cols[6], true, grayShading, AlignmentType.RIGHT),
        tCell(fmt.number(data.totalCertified),  cols[7], true, grayShading, AlignmentType.RIGHT),
        tCell(fmt.number(data.totalDifference), cols[8], true, grayShading, AlignmentType.RIGHT),
        tCell("", cols[9],  false, grayShading), tCell("", cols[10], false, grayShading),
        tCell("", cols[11], false, grayShading), tCell("", cols[12], false, grayShading),
        tCell("", cols[13], false, grayShading), tCell("", cols[14], false, grayShading),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 600, right: 600 }, size: { width: 15840, height: 12240, orientation: "landscape" } } }, children: [
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
  a.href = url; a.download = `UncertifiedStatement_${data.uaNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function UncertifiedStatementPrintPage() {
  const { uuid }    = useParams();
  const [data,      setData]    = useState(null);
  const [error,     setError]   = useState(null);
  const [loading,   setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.GET_BY_UUID}${uuid}` })
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

  const lines = data.lines || [];

  return (
    <>
      <PrintTopBar
        title={`Uncertified Statement — ${data.uaNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[1200px] mx-auto shadow-md print:shadow-none print:max-w-none"
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
                UNCERTIFIED STATEMENT
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
          <div className="grid grid-cols-2 px-6 py-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div>
              <InfoRow label="ERP Doc No"    value={data.uaNo} />
              <InfoRow label="Date"         value={fmt.date(data.uaDate)} />
              <InfoRow label="Project Code" value={data.projectCode} />
            </div>
            <div className="pl-6">
              <InfoRow label="Status"       value={data.workflowStatus} />
              <InfoRow label="Remarks"      value={data.remarks} />
            </div>
          </div>

          {/* ── LINES TABLE ─────────────────────────────────────────────── */}
          <div className="px-4 pb-3 overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: "1350px" }}>
              <thead>
                {/* Group header row */}
                <tr className={COLOR.tableHeadBg}>
                  <th colSpan={6} className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableHead} ${WEIGHT.bold} text-center`}>BOQ Details</th>
                  <th colSpan={3} className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableHead} ${WEIGHT.bold} text-center`}>Certification Statement</th>
                  <th colSpan={1} className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center`} style={{ background: "rgba(239,68,68,0.15)" }}>Over Billing</th>
                  <th colSpan={5} className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center`} style={{ background: "rgba(59,130,246,0.15)" }}>Uncertified Statement</th>
                </tr>
                {/* Sub-header row */}
                <tr className={COLOR.tableHeadBg}>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[3%]`}>Sl</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[4%]`}>BOQ Sl</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-left w-[14%]`}>Description</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-right w-[5%]`}>BOQ Qty</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[4%]`}>Unit</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-right w-[7%]`}>Unit Rate</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-right w-[7%] bg-[#e5e7eb]`}>Claim</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-right w-[7%] bg-[#e5e7eb]`}>Certified</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-right w-[7%] bg-[#e5e7eb]`}>Difference</th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[8%]`} style={{ background: "rgba(239,68,68,0.15)" }}>
                    Over Billing / Calc Mistake
                  </th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[8%]`} style={{ background: "rgba(59,130,246,0.12)" }}>
                    Cert Hold Amnd Pending
                  </th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[7%]`} style={{ background: "rgba(59,130,246,0.12)" }}>
                    Non BOQ Items Rate
                  </th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[8%]`} style={{ background: "rgba(59,130,246,0.12)" }}>
                    Hold Unsatisfactory Work
                  </th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-center w-[8%]`} style={{ background: "rgba(59,130,246,0.12)" }}>
                    Hold Full Work Not Done
                  </th>
                  <th className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableHead} ${WEIGHT.bold} text-left w-[7%]`} style={{ background: "rgba(59,130,246,0.12)" }}>
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // group by sale order
                  const grps = lines.reduce((acc, l, idx) => {
                    const k = l.ogSaleOrderId;
                    if (!acc[k]) acc[k] = { soNo: l.erpDocNumber, title: l.orderTitle, rows: [] };
                    acc[k].rows.push({ ...l, _idx: idx });
                    return acc;
                  }, {});
                  return Object.values(grps).map((g) => [
                    <tr key={`grp-${g.soNo}`} style={{ background: "#1e3a5f" }}>
                      <td colSpan={15} className={`border ${COLOR.tableBorder} px-2 py-[5px] ${SIZE.tableCell} font-semibold text-white`}>
                        SO: {g.soNo}&nbsp;&nbsp;|&nbsp;&nbsp;{g.title}
                      </td>
                    </tr>,
                    ...g.rows.map((l) => (
                      <tr key={l.id ?? l._idx} style={{ breakInside: "avoid" }}>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-center`}>{l._idx + 1}</td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-center`}>{l.boqSlNo}</td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell}`}>{l.itemName || "-"}</td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`}>
                          {l.boqQty != null ? Number(l.boqQty).toLocaleString() : "-"}
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-center`}>{l.unit || "-"}</td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`}><FmtNum value={l.unitRate} /></td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right bg-gray-50`}><FmtNum value={l.claimAmount} /></td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right bg-gray-50`}><FmtNum value={l.certifiedAmount} /></td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right bg-gray-50`}><FmtNum value={l.difference} /></td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`} style={{ background: "rgba(239,68,68,0.08)" }}>
                          <FmtNum value={l.overBillingCalculationMistake} />
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`} style={{ background: "rgba(59,130,246,0.07)" }}>
                          <FmtNum value={l.certifiedHoldAmendmentPending} />
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`} style={{ background: "rgba(59,130,246,0.07)" }}>
                          <FmtNum value={l.nonBoqItemsRate} />
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`} style={{ background: "rgba(59,130,246,0.07)" }}>
                          <FmtNum value={l.holdWork} />
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell} text-right`} style={{ background: "rgba(59,130,246,0.07)" }}>
                          <FmtNum value={l.holdForFullWorkNotCompleted} />
                        </td>
                        <td className={`border ${COLOR.tableBorder} px-1 py-1 ${SIZE.tableCell}`} style={{ background: "rgba(59,130,246,0.07)" }}>
                          {l.remarks || "-"}
                        </td>
                      </tr>
                    )),
                  ]);
                })()}

                {/* Totals row */}
                {lines.length > 0 && (
                  <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
                    <td colSpan={6} className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>Total</td>
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={data.totalClaim} /></td>
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={data.totalCertified} /></td>
                    <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={data.totalDifference} /></td>
                    <td colSpan={6} className={`border ${COLOR.tableBorder} px-1 py-1.5`}></td>
                  </tr>
                )}
              </tbody>
            </table>
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
          size: A3 landscape;
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
