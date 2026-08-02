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

/* ─── helpers ──────────────────────────────────────────────── */
function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800 w-[140px] min-w-[140px]`}>{label}</span>
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
      {dateStr && (
        <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

/* ─── Download helpers ──────────────────────────────────────── */
function printAsPDF() {
  window.print();
}

async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle,
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
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const blueShading = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };

  const PAGE_W = 10466;
  const mkCell = (children, w) =>
    new TableCell({
      children,
      width: { size: w, type: WidthType.DXA },
      borders: nilBorders,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
    });

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

  const titleColW  = 3600;
  const titleSideW = Math.floor((PAGE_W - titleColW) / 2);
  const titleTable = new Table({
    columnWidths: [titleSideW, titleColW, PAGE_W - titleSideW - titleColW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: nilBorders,
    rows: [new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: titleSideW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
        new TableCell({
          children: [new Paragraph({ children: [run("SALE ORDER", { bold: true, size: 40 })] })],
          width: { size: titleColW, type: WidthType.DXA },
          borders: nilBorders,
          margins: { top: 80, bottom: 80, left: 0, right: 0 },
        }),
        new TableCell({ children: [new Paragraph({ text: "" })], width: { size: PAGE_W - titleSideW - titleColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
      ],
    })],
  });

  const iL = 1900; const iV = 2000; const iG = 2200; const iR = 1900;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) =>
    new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders, margins: { top: 40, bottom: 40, left: 60, right: 60 } });

  const orderNoDisplay = [data.prefix, data.ogSaleOrderNo, data.suffix].filter(Boolean).join(" | ");
  const leftInfo  = [["Order No", orderNoDisplay], ["Order Date", fmt.date(data.ogSaleOrderDate)], ["Ref. Order No", data.orderNo]];
  const rightInfo = [["Order Title", data.orderTitle], ["Order Validity", fmt.date(data.orderValidity)], ["Project Code", data.projectCode]];

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

  const cW = [0.05, 0.11, 0.10, 0.30, 0.08, 0.10, 0.12, 0.14].map((p) => Math.round(PAGE_W * p));
  cW[7] = PAGE_W - cW.slice(0, 7).reduce((a, b) => a + b, 0);

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
        children: ["Sl No", "Item Code", "Disp. Code", "Item Name", "Unit", "Qty", "Rate", "Amount"].map((h, i) =>
          itemCell(h, cW[i], true, headShading)
        ),
      }),
      ...items.map((item, idx) =>
        new TableRow({
          children: [
            itemCell(idx + 1,                       cW[0]),
            itemCell(item.itemCode,                  cW[1]),
            itemCell(item.itemDisplayCode || "",      cW[2]),
            itemCell(item.itemName,                  cW[3]),
            itemCell(item.unit,                      cW[4]),
            itemCell(item.orderQty,                  cW[5]),
            itemCell(fmt.number(item.rate),          cW[6]),
            itemCell(fmt.number(item.amount),        cW[7]),
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
        titleTable,
        infoTable,
        new Paragraph({ text: "", spacing: { after: 120 } }),
        itemsTable,
        new Paragraph({ text: "", spacing: { after: 120 } }),
        ...([
          ["Basic Amount", fmt.number(data.basicAmount)],
          ["GST Amount",   fmt.number(data.gstAmount)],
          ["Total Amount", fmt.number(data.totalAmount)],
        ].map(([lbl, val]) =>
          new Paragraph({
            children: [run(lbl, { bold: true, color: "374151" }), run(` : ${val}`)],
            spacing: { after: 40 },
          })
        )),
        new Paragraph({ text: "", spacing: { after: 200 } }),
        ...[
          ["Created By",  data.createdBy,   fmt.dateTime(data.createdAt)],
          ["Submitted By",data.submittedBy, fmt.dateTime(data.submittedAt)],
          ["Approved By", data.approvedBy,  fmt.dateTime(data.finalApprovedAt)],
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `SaleOrder_${data.ogSaleOrderNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function OGSaleOrderPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.GET_BY_UUID}/${uuid}` })
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

  const items          = (data.items || []).filter(Boolean);
  const orderNoDisplay = [data.prefix, data.ogSaleOrderNo, data.suffix].filter(Boolean).join(" | ");

  return (
    <>
      <PrintTopBar
        title={`Sale Order — ${data.ogSaleOrderNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ─────────────────────────────────────── */}
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
                SALE ORDER
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

          {/* ── INFO SECTION ───────────────────────────────── */}
          <div className="grid grid-cols-2 px-6 py-3" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Order No"      value={orderNoDisplay} />
              <InfoRow label="Order Date"    value={fmt.date(data.ogSaleOrderDate)} />
              <InfoRow label="Ref. Order No" value={data.orderNo} />
              <InfoRow label="Project Code"  value={data.projectCode} />
            </div>
            <div className="pl-6">
              <InfoRow label="Order Title"    value={data.orderTitle} />
              <InfoRow label="Order Validity" value={fmt.date(data.orderValidity)} />
              <InfoRow label="Status"         value={data.workflowStatus} />
            </div>
          </div>

          {/* ── ITEMS TABLE ────────────────────────────────── */}
          <div className="px-6 py-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 700 }}>
                <thead>
                  <tr className={COLOR.tableHeadBg}>
                    {[
                      { label: "SL\nNo",          cls: "w-[5%]" },
                      { label: "Item\nCode",       cls: "w-[9%]" },
                      { label: "Disp.\nCode",      cls: "w-[10%]" },
                      { label: "Item Name & Description", cls: "w-[32%]" },
                      { label: "Unit",             cls: "w-[7%]" },
                      { label: "Order\nQty",       cls: "w-[9%]" },
                      { label: "Rate",             cls: "w-[12%]" },
                      { label: "Amount",           cls: "w-[16%]" },
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
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`}>{item.itemCode}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell}`}>{item.itemDisplayCode || ""}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5`}>
                        <p className={ITEM_NAME}>{item.itemName}</p>
                        {item.itemDescription && item.itemDescription !== "-" && (
                          <p className={ITEM_SUB}>{item.itemDescription}</p>
                        )}
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-center`}>{item.unit}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`}>{item.orderQty}</td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`}>
                        <FmtNum value={item.rate} />
                      </td>
                      <td className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} text-right`}>
                        <FmtNum value={item.amount} />
                      </td>
                    </tr>
                  ))}
                  <tr className={COLOR.signatureBg}>
                    {Array(8).fill(null).map((_, j) => (
                      <td key={j} className={`border ${COLOR.tableBorder} px-2 py-2`} />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── TOTALS ─────────────────────────────────────── */}
          <div className="px-6 pb-3 flex justify-end">
            <div className="min-w-[260px]">
              {[
                ["Basic Amount", data.basicAmount],
                ["GST Amount",   data.gstAmount],
                ["Total Amount", data.totalAmount],
              ].map(([label, val], i) => (
                <div
                  key={label}
                  className={`flex justify-between gap-8 py-1 px-3 ${i === 2 ? "font-semibold bg-[#d6e4f5] rounded" : ""}`}
                >
                  <span className={`${SIZE.labelText} text-gray-700`}>{label}</span>
                  <span className={`${SIZE.valueText} text-gray-900 tabular-nums`}>
                    <FmtNum value={val} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── SIGNATURES ─────────────────────────────────── */}
          <div className="px-6 pb-6 pt-2">
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
