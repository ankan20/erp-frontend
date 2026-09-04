"use client";

import { useEffect, useRef, useState } from "react";
import { useParams }     from "next/navigation";
import Image             from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { DOCX_FONT }     from "@/config/fonts.config";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar       from "@/components/print/PrintTopBar";
import PrintErrorPage    from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt } from "@/components/print/printStyles";
import { amountToWordsIN } from "@/lib/amountToWords";

const B   = "border border-[#b0b0b0]";
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;

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

  const run        = (text, opts = {}) => new TextRun({ text: String(text ?? "—"), font: DOCX_FONT, size: 20, ...opts });
  const nilB       = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorder  = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const tblBorders = { top: tblBorder, bottom: tblBorder, left: tblBorder, right: tblBorder, insideH: tblBorder, insideV: tblBorder };
  const headShading = { type: ShadingType.CLEAR, color: "D3D3D3", fill: "D3D3D3" };
  const totShading  = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const noB         = { style: BorderStyle.NIL, size: 0, color: "auto" };
  const PAGE_W      = 9638;

  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 150, height: 75 }, type: "png" })]
    : [run("Company", { bold: true, size: 22 })];
  const qrImage = qrBuffer
    ? new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })
    : null;

  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({ children: [
      new TableCell({ children: [new Paragraph({ children: logoContent })], width: { size: hLogoW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      new TableCell({ children: [new Paragraph({ text: "" })], width: { size: hSpacerW, type: WidthType.DXA }, borders: nilBorders }),
      new TableCell({
        children: [
          new Paragraph({ children: [run("DOCKET VOUCHER", { bold: true, size: 36 })] }),
          ...(qrImage ? [new Paragraph({ children: [qrImage] })] : []),
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  const details   = (data.details || []).slice().sort((a, b) => a.slNo - b.slNo);
  const totalAmt  = details.reduce((s, d) => s + Number(d.amount || 0), 0);
  const cW = [0.05, 0.12, 0.53, 0.30].map((p) => Math.round(PAGE_W * p));
  cW[2] += PAGE_W - cW.reduce((a, b) => a + b, 0);

  const tCell  = (content, w, bold = false, shading, align = "left") =>
    new TableCell({ children: [new Paragraph({ alignment: align, children: [run(String(content ?? ""), { bold, size: bold ? 20 : 18 })] })], width: { size: w, type: WidthType.DXA }, shading: shading || undefined, margins: { top: 50, bottom: 50, left: 70, right: 70 } });
  const numCell = (val, w, bold = false, shading) => tCell(fmt.number(val), w, bold, shading, "right");

  const mainTable = new Table({
    columnWidths: cW,
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: tblBorders,
    rows: [
      new TableRow({ tableHeader: true, children: ["Sl.", "CC Code", "CC Name & Description", "Amount (₹)"].map((h, i) => tCell(h, cW[i], true, headShading, "center")) }),
      ...details.map((d, idx) => new TableRow({ children: [
        tCell(String(d.slNo || idx + 1), cW[0], false, undefined, "center"),
        tCell(d.ccCode || "—",           cW[1], false, undefined, "center"),
        tCell(`${d.ccName || "—"}\n${d.shortDescription || ""}`, cW[2]),
        numCell(d.amount, cW[3]),
      ]})),
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ alignment: "right", children: [run("TOTAL", { bold: true })] })], columnSpan: 3, width: { size: cW[0]+cW[1]+cW[2], type: WidthType.DXA }, shading: totShading, margins: { top: 50, bottom: 50, left: 70, right: 70 } }),
        numCell(totalAmt, cW[3], true, totShading),
      ]}),
      new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [run("Amount in Words: ", { bold: true }), run(amountToWordsIN(totalAmt), { italic: true })] })], columnSpan: 4, width: { size: PAGE_W, type: WidthType.DXA }, borders: { left: tblBorder, right: tblBorder, top: noB, bottom: tblBorder }, margins: { top: 50, bottom: 50, left: 80, right: 80 } })] }),
    ],
  });

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: [
      headerTable,
      new Paragraph({ text: "", spacing: { after: 80 } }),
      mainTable,
      new Paragraph({ text: "", spacing: { after: 200 } }),
      ...["Created By", "Submitted By", "Approved By"].map((lbl, i) => {
        const [name, date] = [[data.createdBy, fmt.dateTime(data.createdAt)], [data.submittedBy, fmt.dateTime(data.submittedAt)], [data.approvedBy, fmt.dateTime(data.finalApprovedAt)]][i];
        return new Paragraph({ children: [run(lbl, { color: "374151" }), run(" : ", { color: "374151" }), run(name || "—"), ...(date && date !== "-" ? [run(`  [${date}]`, { color: "6B7280", size: 18 })] : [])], spacing: { after: 60 } });
      }),
    ]}],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `DocketVoucher_${data.voucherNo || uuid}.docx`; a.click();
  URL.revokeObjectURL(url);
}

export default function DocketVoucherPrintPage() {
  const { uuid }  = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER.GET_BY_UUID}${uuid}` })
      .then((res) => setData(res.data))
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

  const details  = (data.details || []).slice().sort((a, b) => a.slNo - b.slNo);
  const totalAmt = details.reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <>
      <PrintTopBar
        title={`Docket Voucher — ${data.voucherNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, uuid, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div className="bg-white max-w-[860px] mx-auto shadow-md print:shadow-none print:max-w-none" style={{ fontFamily: "var(--font-print), sans-serif" }}>

          {/* HEADER */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[130px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={130} height={65} className="object-contain" priority />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>Docket Voucher</h1>
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

          {/* INFO */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="space-y-0.5">
              <InfoRow label="Voucher No"     value={data.voucherNo} />
              <InfoRow label="Voucher Date"   value={fmt.date(data.voucherDate)} />
              <InfoRow label="Budget Ref"     value={data.budgetNo} />
              <InfoRow label="Expenses By"    value={data.expensesBy} />
              <InfoRow label="Status"         value={data.workflowStatus} />
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="Mode of Payment" value={data.modeOfPayment} />
              <InfoRow label="Fund Source"      value={data.fundSource} />
              <InfoRow label="Payment Ref. ID"  value={data.paymentRefId} />
              <InfoRow label="Project"          value={data.projectCode} />
              <InfoRow label="Total Amount"     value={`₹ ${fmt.number(data.totalAmount || totalAmt)}`} />
            </div>
          </div>

          {/* DETAILS TABLE */}
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "5%"  }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "53%" }} />
                  <col style={{ width: "30%" }} />
                </colgroup>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {["Sl.", "CC Code", "CC Name & Short Description", "Amount (₹)"].map((h) => (
                      <th key={h} className={`${B} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center text-gray-500`}>{d.slNo || idx + 1}</td>
                      <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center ${WEIGHT.medium}`}>{d.ccCode || "—"}</td>
                      <td className={`${B} px-2 py-2 ${SIZE.tableCell}`} style={{ wordBreak: "break-word" }}>
                        <div className={WEIGHT.medium}>{d.ccName || "—"}</div>
                        {d.shortDescription && <div className="text-gray-500 text-[11px] mt-0.5">{d.shortDescription}</div>}
                      </td>
                      <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                        <FmtNum value={d.amount} />
                      </td>
                    </tr>
                  ))}

                  <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
                    <td colSpan={3} className={`${B} px-3 py-1.5 ${SIZE.tableCell} text-right`}>TOTAL</td>
                    <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                      <FmtNum value={totalAmt} />
                    </td>
                  </tr>

                  <tr>
                    <td colSpan={4} style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "5px 10px" }} className={SIZE.labelText}>
                      <span className={WEIGHT.bold}>Amount in Words: </span>
                      {totalAmt > 0 ? amountToWordsIN(totalAmt) : "—"}
                    </td>
                  </tr>
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

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page { size: A4; margin: 8mm 8mm 12mm 8mm; }
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
