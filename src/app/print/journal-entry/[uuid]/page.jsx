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

/* ── helpers ────────────────────────────────────────────────────────────────── */
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;
const B   = "border border-[#b0b0b0]";

function InfoRow({ label, value }) {
  return (
    <p className={VAL}>
      <span className={LBL}>{label}</span> : {value || "—"}
    </p>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "—"}</span>
      {dateStr && dateStr !== "-" && (
        <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-500 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

function printAsPDF() { window.print(); }

/* ── DOCX export ────────────────────────────────────────────────────────────── */
async function downloadDocx(data, uuid, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try {
    const c = qrCanvasRef?.current;
    if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then((r) => r.arrayBuffer()); }
  } catch (_) {}

  const run       = (text, opts = {}) => new TextRun({ text: String(text ?? "—"), font: "Calibri", size: 20, ...opts });
  const nilB      = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };
  const totShading  = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const noB         = { style: BorderStyle.NIL, size: 0, color: "auto" };

  const PAGE_W = 9638;

  // Header
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 150, height: 75 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];
  const qrImage = qrBuffer
    ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })
    : null;

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logoContent })], width: { size: hLogoW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: hSpacerW, type: WidthType.DXA }, borders: nilBorders }),
      new TableCell({
        children: [
          new Paragraph({ children: [run("JOURNAL ENTRY", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  // Info section
  const iL = 1800; const iV = 2400; const iG = 600; const iR = 1600;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const leftInfo  = [
    ["Voucher No",  data.voucherNo  || "—"],
    ["Entry Date",  fmt.date(data.entryDate)],
    ["Status",      data.workflowStatus || "—"],
  ];
  const rightInfo = [
    ["Lines",   String((data.lines || []).length)],
    ...(data.remarks ? [["Remarks", data.remarks]] : []),
  ];

  const maxRows  = Math.max(leftInfo.length, rightInfo.length);
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: Array.from({ length: maxRows }, (_, i) => {
      const left  = leftInfo[i]  || ["", ""];
      const right = rightInfo[i] || ["", ""];
      return new TableRow({ children: [
        infoCell([new Paragraph({ children: [run(left[0],  { bold: true })] })], iL),
        infoCell([new Paragraph({ children: [run(`: ${left[1] || "—"}`)] })],  iV),
        infoCell([new Paragraph({ text: "" })], iG),
        infoCell([new Paragraph({ children: [run(right[0], { bold: true })] })], iR),
        infoCell([new Paragraph({ children: [run(`: ${right[1] || "—"}`)] })],  iW),
      ]});
    }),
  });

  // Lines table: Sl | Type | Dr/Cr | Particulars | Opening | Debit | Credit | Closing
  const cW = [0.05, 0.07, 0.07, 0.28, 0.13, 0.13, 0.13, 0.14].map((p) => Math.round(PAGE_W * p));
  cW[3] += PAGE_W - cW.reduce((a, b) => a + b, 0);

  const tCell = (content, w, bold = false, shading, align = "left") =>
    new TableCell({
      children: [new Paragraph({ alignment: align, children: [run(String(content ?? ""), { bold, size: bold ? 20 : 18 })] })],
      width: { size: w, type: WidthType.DXA },
      shading: shading || undefined,
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
    });
  const numCell = (val, w, bold = false, shading) => tCell(fmt.number(val), w, bold, shading, "right");

  const lines      = (data.lines || []).slice().sort((a, b) => a.slNo - b.slNo);
  const totalDebit  = lines.reduce((s, l) => s + Number(l.debitAmount  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);

  const mainTable = new Table({
    columnWidths: cW,
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children:
        ["Sl.", "Type", "Dr./Cr.", "Particulars", "Opening (₹)", "Debit (₹)", "Credit (₹)", "Closing (₹)"].map((h, i) =>
          tCell(h, cW[i], true, headShading, "center"),
        ),
      }),
      ...lines.map((l, idx) => {
        const rowShading = idx % 2 === 0 ? undefined : { type: ShadingType.CLEAR, color: "F2F2F2", fill: "F2F2F2" };
        return new TableRow({ children: [
          tCell(String(l.slNo || idx + 1),      cW[0], false, rowShading, "center"),
          tCell(l.type        || "—",           cW[1], false, rowShading, "center"),
          tCell(l.drCr        || "—",           cW[2], true,  rowShading, "center"),
          tCell(l.accountName || l.accountCode || "—", cW[3], false, rowShading),
          numCell(l.openingBalance, cW[4], false, rowShading),
          numCell(l.debitAmount,    cW[5], l.drCr === "Dr", rowShading),
          numCell(l.creditAmount,   cW[6], l.drCr === "Cr", rowShading),
          numCell(l.closingBalance, cW[7], false, rowShading),
        ]});
      }),
      // Total row
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ alignment: "right", children: [run("TOTAL", { bold: true, size: 20 })] })],
          columnSpan: 5,
          width: { size: cW[0] + cW[1] + cW[2] + cW[3] + cW[4], type: WidthType.DXA },
          shading: totShading,
          margins: { top: 50, bottom: 50, left: 70, right: 70 },
        }),
        numCell(totalDebit,  cW[5], true, totShading),
        numCell(totalCredit, cW[6], true, totShading),
        tCell("",            cW[7], false, totShading),
      ]}),
      // Amount in words
      new TableRow({ children: [
        new TableCell({
          children: [new Paragraph({ children: [
            run("Amount in Words: ", { bold: true }),
            run(amountToWordsIN(Number(data.totalAmount || totalDebit)), { italic: true }),
          ]})],
          columnSpan: 8,
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: { left: tblBorder, right: tblBorder, top: noB, bottom: tblBorder },
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
        }),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        headerTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        infoTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        mainTable,
        new Paragraph({ text: "", spacing: { after: 200 } }),
        ...["Created By", "Submitted By", "Approved By"].map((lbl, i) => {
          const [name, date] = [
            [data.createdBy,   fmt.dateTime(data.createdAt)],
            [data.submittedBy, fmt.dateTime(data.submittedAt)],
            [data.approvedBy,  fmt.dateTime(data.finalApprovedAt)],
          ][i];
          return new Paragraph({
            children: [
              run(lbl, { color: "374151" }),
              run(" : ", { color: "374151" }),
              run(name || "—"),
              ...(date && date !== "-" ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : []),
            ],
            spacing: { after: 60 },
          });
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `JournalEntry_${data.voucherNo || uuid}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function JournalEntryPrintPage() {
  const { uuid }  = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.JOURNAL_ENTRY.GET_BY_UUID}${uuid}` })
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

  const lines       = (data.lines || []).slice().sort((a, b) => a.slNo - b.slNo);
  const totalDebit  = lines.reduce((s, l) => s + Number(l.debitAmount  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.creditAmount || 0), 0);
  const totalAmount = Number(data.totalAmount || totalDebit);
  const B_side      = "border-l border-r border-[#b0b0b0]";

  return (
    <>
      <PrintTopBar
        title={`Journal Entry — ${data.voucherNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, uuid, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[860px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[130px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Company Logo"
                width={130} height={65}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                Journal Entry
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-600`}>www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0  w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0  w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={60} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </div>

          {/* ── INFO SECTION ────────────────────────────────────────────── */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="space-y-0.5">
              <InfoRow label="Voucher No"  value={data.voucherNo} />
              <InfoRow label="Entry Date"  value={fmt.date(data.entryDate)} />
              <InfoRow label="Status"      value={data.workflowStatus} />
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="No. of Lines" value={String(lines.length)} />
              {data.remarks && (
                <p className={VAL}>
                  <span className={LBL}>Remarks</span> :{" "}
                  <span className="whitespace-pre-wrap">{data.remarks}</span>
                </p>
              )}
            </div>
          </div>

          {/* ── JOURNAL LINES TABLE ─────────────────────────────────────── */}
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "5%"  }} />
                  <col style={{ width: "7%"  }} />
                  <col style={{ width: "7%"  }} />
                  <col style={{ width: "29%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "13%" }} />
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {["Sl.", "Type", "Dr./Cr.", "Particulars", "Opening (₹)", "Debit (₹)", "Credit (₹)", "Closing (₹)"].map((h) => (
                      <th key={h} className={`${B} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => {
                    const isDr  = l.drCr === "Dr";
                    const rowBg = idx % 2 === 0 ? COLOR.tableRowOdd : COLOR.tableRowEven;
                    return (
                      <tr key={idx} className={rowBg}>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center text-gray-500`}>
                          {l.slNo || idx + 1}
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center`}>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            l.type === "Vendor"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {l.type || "—"}
                          </span>
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center ${WEIGHT.bold} ${isDr ? "text-[#c0392b]" : "text-[#1a7a3c]"}`}>
                          {l.drCr}
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} ${WEIGHT.medium}`} style={{ wordBreak: "break-word" }}>
                          {l.accountName || l.accountCode || "—"}
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                          <FmtNum value={l.openingBalance} />
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums ${isDr ? WEIGHT.semibold : "text-gray-400"}`} style={{ whiteSpace: "nowrap" }}>
                          {isDr ? <FmtNum value={l.debitAmount} /> : "—"}
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums ${!isDr ? WEIGHT.semibold : "text-gray-400"}`} style={{ whiteSpace: "nowrap" }}>
                          {!isDr ? <FmtNum value={l.creditAmount} /> : "—"}
                        </td>
                        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                          <FmtNum value={l.closingBalance} />
                        </td>
                      </tr>
                    );
                  })}

                  {/* Total row */}
                  <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
                    <td colSpan={5} className={`${B} px-3 py-1.5 ${SIZE.tableCell} text-right`}>
                      TOTAL
                    </td>
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                      <FmtNum value={totalDebit} />
                    </td>
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                      <FmtNum value={totalCredit} />
                    </td>
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right text-gray-500`}>—</td>
                  </tr>

                  {/* Amount in Words */}
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        borderLeft:   "1px solid #b0b0b0",
                        borderRight:  "1px solid #b0b0b0",
                        borderBottom: "1px solid #b0b0b0",
                        borderTop:    "none",
                        padding:      "5px 10px",
                      }}
                      className={SIZE.labelText}
                    >
                      <span className={WEIGHT.bold}>Amount in Words: </span>
                      {totalAmount > 0 ? amountToWordsIN(totalAmount) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

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
          .print\\:hidden    { display: none !important; }
          .print\\:p-0       { padding: 0 !important; }
          .print\\:bg-white  { background: white !important; }
          .print\\:shadow-none  { box-shadow: none !important; }
          .print\\:max-w-none  { max-width: none !important; }
        }
      `}</style>
    </>
  );
}
