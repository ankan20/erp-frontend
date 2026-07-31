"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt } from "@/components/print/printStyles";

/* ─── helpers ────────────────────────────────────────────────── */

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-900 flex-1`}>{value || "-"}</span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className={`${COLOR.tableHeadBg} px-3 py-[3px] ${SIZE.labelText} ${WEIGHT.bold} text-gray-800 mb-1`}>
      {children}
    </div>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 w-[180px] min-w-[180px]`}>{label}</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-900`}>{name || "-"}</span>
      {dateStr && <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-500 ml-3`}>[{dateStr}]</span>}
    </div>
  );
}

/* ─── Excel download ─────────────────────────────────────────── */
function downloadExcel(data) {
  const XLSX = require("xlsx");
  const rows = [
    ["BATCHING PLANT DOCKET"],
    [],
    ["Despatch No",      data.despatchNo,       "", "Status",          data.workflowStatus],
    ["Project Code",     data.projectCode,       "", "Order No",        data.orderNo],
    ["Project Name",     data.projectName,       "", "Supplier Name",   data.vendorName],
    ["Production Date",  fmt.date(data.productionDate), "", "", ""],
    [],
    ["MATERIALS DETAILS"],
    ["Type of Concrete", data.materialType,      "", "Production Unit", data.productionUnitName],
    ["Grade",            data.grade,             "", "Operator Name",   data.operatorName],
    ["Unit of Concrete", data.unitOfConcrete,    "", "Prod Completed",  data.productionCompleted],
    ["Volume (CUM)",     data.volumeOfConcrete,  "", "Batch Slip No",   data.batchSlipNo],
    ["Weight (Kg)",      data.weightOfConcrete,  "", "", ""],
    [],
    ["TRANSIT DETAILS"],
    ["Vehicle Number",   data.vehicleNumber,     "", "Requisition By",  data.requisitionBy],
    ["Driver Name",      data.driverName,        "", "Req Date",        fmt.date(data.requisitionDate)],
    ["Loading Time",     data.loadingFinishTime, "", "Req Time",        data.requisitionTime],
    ["Pouring Time",     data.pouringStartTime,  "", "", ""],
    ["Completion Time",  data.completionTime,    "", "", ""],
    [],
    ["Created By",       data.createdBy,  "", "Created At",      fmt.dateTime(data.createdAt)],
    ["Submitted By",     data.submittedBy || "-", "", "Submitted At", fmt.dateTime(data.submittedAt)],
    ["Approved By",      data.approvedBy  || "-", "", "Approved At",  fmt.dateTime(data.finalApprovedAt)],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 4 }, { wch: 20 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "Batching Plant");
  XLSX.writeFile(wb, `BP_${data.despatchNo || "Docket"}.xlsx`);
}

/* ─── DOCX download ──────────────────────────────────────────── */
async function downloadDocx(data, qrCanvasRef) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle,
  } = await import("docx");

  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch (_) {}
  let qrBuffer = null;
  try {
    const c = qrCanvasRef?.current;
    if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r => r.arrayBuffer()); }
  } catch (_) {}

  const run = (text, opts = {}) => new TextRun({ text: String(text ?? "-"), font: "Calibri", size: 20, ...opts });
  const nilB      = { style: BorderStyle.NIL,    size: 0, color: "auto" };
  const thinB     = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const nilBorders = { top: nilB, bottom: nilB, left: nilB, right: nilB, insideH: nilB, insideV: nilB };
  const tblBorders = { top: thinB, bottom: thinB, left: thinB, right: thinB, insideH: thinB, insideV: thinB };
  const headShading = { type: ShadingType.CLEAR, color: "D9D9D9", fill: "D9D9D9" };
  const blueShading = { type: ShadingType.CLEAR, color: "B6DDE8", fill: "B6DDE8" };
  const PAGE_W = 10466;

  const mkCell = (children, w, borders = nilBorders) => new TableCell({
    children, width: { size: w, type: WidthType.DXA }, borders,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });

  // ── Header table ──
  const hLogoW = 2600; const hQrW = 2400; const hSpacerW = PAGE_W - hLogoW - hQrW;
  const logoContent = logoBuffer
    ? [new ImageRun({ data: logoBuffer, transformation: { width: 180, height: 90 }, type: "png" })]
    : [run("DISHAAN HI-TECH", { bold: true, size: 22 })];

  const headerTable = new Table({
    columnWidths: [hLogoW, hSpacerW, hQrW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      mkCell([new Paragraph({ children: logoContent })], hLogoW),
      mkCell([new Paragraph({ text: "" })], hSpacerW),
      new TableCell({
        children: [
          new Paragraph({ children: [run("www.dishaanhitech.com", { size: 16, color: "4B5563" })] }),
          ...(qrBuffer ? [new Paragraph({ children: [new ImageRun({ data: qrBuffer, transformation: { width: 68, height: 68 }, type: "png" })] })] : []),
        ],
        width: { size: hQrW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 },
      }),
    ]})],
  });

  // ── Title table ──
  const titleColW = 5000; const titleSideW = Math.floor((PAGE_W - titleColW) / 2);
  const titleTable = new Table({
    columnWidths: [titleSideW, titleColW, PAGE_W - titleSideW - titleColW],
    width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
    rows: [new TableRow({ children: [
      mkCell([new Paragraph({ text: "" })], titleSideW),
      new TableCell({
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run("BATCHING PLANT DOCKET", { bold: true, size: 40 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [run(data.despatchNo || "", { bold: true, size: 28 })] }),
        ],
        width: { size: titleColW, type: WidthType.DXA }, borders: nilBorders, margins: { top: 80, bottom: 80, left: 0, right: 0 },
      }),
      mkCell([new Paragraph({ text: "" })], PAGE_W - titleSideW - titleColW),
    ]})],
  });

  // ── Info table (project + supplier) ──
  const iL = 1700; const iV = 1900; const iG = 2300; const iR = 1700;
  const iW = PAGE_W - iL - iV - iG - iR;
  const infoCell = (paras, w) => new TableCell({
    children: paras, width: { size: w, type: WidthType.DXA }, borders: nilBorders,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
  });
  const leftInfo = [
    ["Project Code",    data.projectCode],
    ["Project Name",    data.projectName],
    ["Production Date", fmt.date(data.productionDate)],
    ["Status",          data.workflowStatus],
  ];
  const rightInfo = [
    ["Order No",       data.orderNo],
    ["Supplier Name",  data.vendorName],
    ["Despatch No",    data.despatchNo],
    ["",               ""],
  ];
  const infoTable = new Table({
    columnWidths: [iL, iV, iG, iR, iW], width: { size: PAGE_W, type: WidthType.DXA }, borders: nilBorders,
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

  // ── Details grid table (4 sections, 2x2) ──
  const halfW = Math.floor(PAGE_W / 2);
  const sHead = (text) => new Paragraph({
    children: [run(text, { bold: true, size: 20 })],
    shading: headShading,
  });
  const sRow = (label, value) => new Paragraph({
    children: [run(`${label}: `, { bold: false, size: 19 }), run(value || "-", { size: 19 })],
    spacing: { before: 40, after: 40 },
  });

  const materialsContent = [
    sHead("Materials Details"),
    sRow("Type of Concrete", data.materialType),
    sRow("Grade",            data.grade),
    sRow("Unit of Concrete", data.unitOfConcrete),
    sRow("Volume",           data.volumeOfConcrete != null ? String(data.volumeOfConcrete) : ""),
    sRow("Weight",           data.weightOfConcrete != null ? String(data.weightOfConcrete) : ""),
  ];
  const productionContent = [
    sHead("Production Details"),
    sRow("Production Unit",  data.productionUnitName),
    sRow("Operator Name",    data.operatorName),
    sRow("Prod Completed",   data.productionCompleted),
    sRow("Batch Slip No",    data.batchSlipNo),
  ];
  const transitContent = [
    sHead("Transit Details"),
    sRow("Vehicle Number",   data.vehicleNumber),
    sRow("Driver Name",      data.driverName),
    sRow("Loading Time",     data.loadingFinishTime),
    sRow("Pouring Time",     data.pouringStartTime),
    sRow("Completion Time",  data.completionTime),
  ];
  const requisitionContent = [
    sHead("Requisition Details"),
    sRow("Requisition By",   data.requisitionBy),
    sRow("Date",             fmt.date(data.requisitionDate)),
    sRow("Time",             data.requisitionTime),
  ];

  const detailsTable = new Table({
    columnWidths: [halfW, PAGE_W - halfW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: { top: thinB, bottom: thinB, left: thinB, right: thinB, insideH: thinB, insideV: thinB },
    rows: [
      new TableRow({ children: [
        new TableCell({ children: materialsContent,  width: { size: halfW,            type: WidthType.DXA }, borders: tblBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: productionContent, width: { size: PAGE_W - halfW,   type: WidthType.DXA }, borders: tblBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      ]}),
      new TableRow({ children: [
        new TableCell({ children: transitContent,    width: { size: halfW,            type: WidthType.DXA }, borders: tblBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
        new TableCell({ children: requisitionContent,width: { size: PAGE_W - halfW,   type: WidthType.DXA }, borders: tblBorders, margins: { top: 60, bottom: 60, left: 80, right: 80 } }),
      ]}),
    ],
  });

  // ── Signature footer table ──
  const sigW = Math.floor(PAGE_W / 3);
  const sigContent = (label, name, dateStr) => [
    new Paragraph({ children: [run(label, { bold: true, size: 18, color: "374151" })], spacing: { after: 40 } }),
    new Paragraph({ children: [run(name || "-", { size: 19 })], spacing: { after: 20 } }),
    ...(dateStr ? [new Paragraph({ children: [run(dateStr, { size: 16, color: "6B7280" })] })] : []),
  ];
  const sigTable = new Table({
    columnWidths: [sigW, sigW, PAGE_W - sigW * 2],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: { top: thinB, bottom: thinB, left: nilB, right: nilB, insideH: nilB, insideV: nilB },
    rows: [new TableRow({ children: [
      new TableCell({ children: sigContent("Created By",    data.createdBy,   fmt.dateTime(data.createdAt)),       width: { size: sigW, type: WidthType.DXA }, borders: { top: thinB, bottom: thinB, left: nilB, right: nilB, insideH: nilB, insideV: nilB }, margins: { top: 80, bottom: 80, left: 60, right: 60 } }),
      new TableCell({ children: sigContent("Submitted By",  data.submittedBy, fmt.dateTime(data.submittedAt)),     width: { size: sigW, type: WidthType.DXA }, borders: { top: thinB, bottom: thinB, left: nilB, right: nilB, insideH: nilB, insideV: nilB }, margins: { top: 80, bottom: 80, left: 60, right: 60 } }),
      new TableCell({ children: sigContent("Approved By",   data.approvedBy,  fmt.dateTime(data.finalApprovedAt)), width: { size: PAGE_W - sigW * 2, type: WidthType.DXA }, borders: { top: thinB, bottom: thinB, left: nilB, right: nilB, insideH: nilB, insideV: nilB }, margins: { top: 80, bottom: 80, left: 60, right: 60 } }),
    ]})],
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        headerTable, titleTable,
        new Paragraph({ text: "", spacing: { after: 80 } }),
        infoTable,
        new Paragraph({ text: "", spacing: { after: 120 } }),
        detailsTable,
        new Paragraph({ text: "", spacing: { after: 200 } }),
        sigTable,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `BP_${data.despatchNo || "Docket"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ───────────────────────────────────────────────── */
export default function BatchingPlantPrintPage() {
  const { uuid }  = useParams();
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.BATCHING_PLANT.GET_BY_UUID}/${uuid}` })
      .then((res) => setData(res.data))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <p className="text-[13px] text-gray-500">Loading docket…</p>
      </div>
    </div>
  );

  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  return (
    <>
      <PrintTopBar
        title={`Batching Plant Docket — ${data.despatchNo || ""}`}
        onDownloadPDF={() => window.print()}
        onDownloadExcel={() => downloadExcel(data)}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >

          {/* ── HEADER ── */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-200">
            <div className="w-[160px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={160} height={80} className="object-contain" priority />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                BATCHING PLANT DOCKET
              </h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-700 tracking-widest mt-0.5`}>
                {data.despatchNo || ""}
              </p>
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

          {/* ── PROJECT / SUPPLIER INFO ── */}
          <div className="grid px-6 py-3 border-b border-gray-200" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Project Code"    value={data.projectCode} />
              <InfoRow label="Project Name"    value={data.projectName} />
              <InfoRow label="Production Date" value={fmt.date(data.productionDate)} />
              <InfoRow label="Status"          value={data.workflowStatus} />
            </div>
            <div className="pl-6 border-l border-gray-200">
              <InfoRow label="Despatch No"   value={data.despatchNo} />
              <InfoRow label="Order No"      value={data.orderNo} />
              <InfoRow label="Supplier Name" value={data.vendorName} />
            </div>
          </div>

          {/* ── DETAILS GRID ── */}
          <div className="grid grid-cols-2 border-b border-gray-200" style={{ gridTemplateColumns: "50% 50%" }}>

            {/* Materials */}
            <div className="border-r border-gray-200">
              <SectionHeader>Materials Details</SectionHeader>
              <div className="px-3 pb-3">
                <InfoRow label="Type of Concrete" value={data.materialType} />
                <InfoRow label="Grade"            value={data.grade} />
                <InfoRow label="Unit of Concrete" value={data.unitOfConcrete} />
                <InfoRow label="Volume"           value={data.volumeOfConcrete != null ? String(data.volumeOfConcrete) : undefined} />
                <InfoRow label="Weight"           value={data.weightOfConcrete != null ? String(data.weightOfConcrete) : undefined} />
              </div>
            </div>

            {/* Production */}
            <div>
              <SectionHeader>Production Details</SectionHeader>
              <div className="px-3 pb-3">
                <InfoRow label="Production Unit" value={data.productionUnitName} />
                <InfoRow label="Operator Name"   value={data.operatorName} />
                <InfoRow label="Prod Completed"  value={data.productionCompleted} />
                <InfoRow label="Batch Slip No"   value={data.batchSlipNo} />
              </div>
            </div>

          </div>

          <div className="grid grid-cols-2 border-b border-gray-200" style={{ gridTemplateColumns: "50% 50%" }}>

            {/* Transit */}
            <div className="border-r border-gray-200">
              <SectionHeader>Transit Details</SectionHeader>
              <div className="px-3 pb-3">
                <InfoRow label="Vehicle Number"  value={data.vehicleNumber} />
                <InfoRow label="Driver Name"     value={data.driverName} />
                <InfoRow label="Loading Time"    value={data.loadingFinishTime} />
                <InfoRow label="Pouring Time"    value={data.pouringStartTime} />
                <InfoRow label="Completion Time" value={data.completionTime} />
              </div>
            </div>

            {/* Requisition */}
            <div>
              <SectionHeader>Requisition Details</SectionHeader>
              <div className="px-3 pb-3">
                <InfoRow label="Requisition By" value={data.requisitionBy} />
                <InfoRow label="Date"           value={fmt.date(data.requisitionDate)} />
                <InfoRow label="Time"           value={data.requisitionTime} />
              </div>
            </div>

          </div>

          {/* ── SIGNATURES ── */}
          <div className="grid grid-cols-3 px-6 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
            <div className="border-r border-dashed border-gray-300 pr-4">
              <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
            </div>
            <div className="border-r border-dashed border-gray-300 px-4">
              <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
            </div>
            <div className="pl-4">
              <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
            </div>
          </div>

        </div>
      </div>

      {/* Hidden QR canvas for DOCX export */}
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
          .print\\:hidden    { display: none !important; }
          .print\\:p-0       { padding: 0 !important; }
          .print\\:bg-white  { background: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:max-w-none  { max-width: none !important; }
        }
      `}</style>
    </>
  );
}
