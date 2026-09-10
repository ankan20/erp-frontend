import { PL_COLUMNS } from "@/config/profitLoss.config";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * PDF and Excel exports for the P&L statement.
 *
 * Both take the same `rows` the table renders (from buildProfitLossRows), so a
 * download can never show different numbers from the screen. The PDF keeps the
 * on-screen layout: the same column pairs and the same section shading.
 */

// family → shade by depth, mirroring the table's bands exactly
const PDF_SHADES = {
  sale:    [[207, 232, 212]],
  expense: [[247, 212, 212], [250, 228, 228], [253, 240, 240]],
  result:  [[188, 214, 236]],
};

/** Band fill for a row, or null for leaf rows (which stay white). */
function pdfFill(row) {
  if (!row?.family) return null;
  if (!row.isGroup && row.family !== "result") return null;
  const shades = PDF_SHADES[row.family] || PDF_SHADES.result;
  return shades[Math.min(row.depth, shades.length - 1)];
}

const amountCell  = (v) => (v === null || v === undefined ? "" : formatAmount(v));
const percentCell = (v) =>
  v === null || v === undefined || !isFinite(v) ? "" : `${v.toFixed(2)}%`;

const subtitle = ({ projectCode, fromDate, toDate }) => {
  const parts = [];
  if (projectCode) parts.push(`Project: ${projectCode}`);
  parts.push(fromDate || toDate ? `Period: ${fromDate || "…"} to ${toDate || "…"}` : "Period: All dates");
  parts.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
  return parts.join("   |   ");
};

const fileStamp = () => new Date().toISOString().slice(0, 10);

// ─── PDF ──────────────────────────────────────────────────────────────────────

const MARGIN = 8;

/**
 * Build the statement document.
 *
 * Column widths are DERIVED from the page width so the table fills the sheet
 * edge to edge — fixed millimetre widths left ~42mm of dead space on the right
 * and squeezed Particulars until the longer labels wrapped or clipped.
 */
async function buildProfitLossDoc({ rows, projectCode, fromDate, toDate }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const usable = pageW - MARGIN * 2;              // 281mm on A4 landscape
  const refW   = 16;
  const codeW  = 14;
  const amtW   = 23;
  const pctW   = 13;
  // Particulars soaks up whatever is left, so nothing is clipped
  const partW  = usable - refW - codeW - PL_COLUMNS.length * (amtW + pctW);

  let y = 14;

  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Profit & Loss Statement", pageW / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(subtitle({ projectCode, fromDate, toDate }), pageW / 2, y, { align: "center" });
  y += 4;

  // Two header rows: column label spanning its Amount + % pair
  const head = [
    [
      { content: "Ref",         rowSpan: 2 },
      { content: "Code",        rowSpan: 2 },
      { content: "Particulars", rowSpan: 2 },
      ...PL_COLUMNS.map((c) => ({ content: c.label, colSpan: 2, styles: { halign: "center" } })),
    ],
    PL_COLUMNS.flatMap(() => [
      { content: "Amount", styles: { halign: "right" } },
      { content: "%",      styles: { halign: "right" } },
    ]),
  ];

  const body = rows.map((r) => [
    r.ref,
    r.code || "",
    r.title,
    ...PL_COLUMNS.flatMap((c) => [amountCell(r.values?.[c.key]), percentCell(r.percents?.[c.key])]),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    theme: "grid",
    tableWidth: usable,
    styles:     { fontSize: 7, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [20, 70, 100], textColor: 255, fontSize: 7, halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: refW },
      1: { cellWidth: codeW },
      2: { cellWidth: partW },
      ...PL_COLUMNS.reduce((acc, _c, i) => {
        acc[3 + i * 2]     = { cellWidth: amtW, halign: "right" };
        acc[3 + i * 2 + 1] = { cellWidth: pctW, halign: "right" };
        return acc;
      }, {}),
    },
    // Shade section rows exactly as the table does
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row  = rows[data.row.index];
      const fill = pdfFill(row);
      if (fill) {
        data.cell.styles.fillColor = fill;
        data.cell.styles.fontStyle = "bold";
      }
      // Indent Particulars by nesting depth, as on screen
      if (data.column.index === 2 && row?.depth) {
        data.cell.styles.cellPadding = { top: 1.2, bottom: 1.2, right: 1.2, left: 1.2 + row.depth * 2 };
      }
      const value = row?.values?.[PL_COLUMNS[Math.floor((data.column.index - 3) / 2)]?.key];
      if (data.column.index >= 3 && (data.column.index - 3) % 2 === 0 && value < 0) {
        data.cell.styles.textColor = [190, 30, 30];
      }
    },
    didDrawPage: (data) => {
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageW - MARGIN, pageH - 4, { align: "right" },
      );
      doc.setTextColor(0);
      data.settings.margin.top = 10;   // continuation pages start higher
    },
    margin: { left: MARGIN, right: MARGIN, top: 10, bottom: 10 },
  });

  return doc;
}

export async function downloadProfitLossPDF(args) {
  const doc = await buildProfitLossDoc(args);
  doc.save(`Profit_Loss_${args.projectCode || "all"}_${fileStamp()}.pdf`);
}

/**
 * Send the same document straight to the printer.
 * Rendered into a hidden iframe rather than window.open, which popup blockers
 * routinely swallow when the call comes from an async handler.
 */
export async function printProfitLossPDF(args) {
  const doc     = await buildProfitLossDoc(args);
  const blobUrl = doc.output("bloburl");

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = blobUrl;

  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(blobUrl, "_blank");   // fallback if the frame refuses
    }
    // Leave it long enough for the print dialog to take the document
    setTimeout(() => frame.remove(), 60_000);
  };

  document.body.appendChild(frame);
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function downloadProfitLossExcel({ rows, projectCode, fromDate, toDate }) {
  const XLSX = await import("xlsx");

  const titleRow  = ["Profit & Loss Statement"];
  const filterRow = [subtitle({ projectCode, fromDate, toDate })];

  const headTop = ["Ref", "Code", "Particulars"];
  const headSub = ["", "", ""];
  PL_COLUMNS.forEach((c) => {
    headTop.push(c.label, "");
    headSub.push("Amount", "%");
  });

  // Numbers stay numeric so the sheet stays usable for further work;
  // the display format is applied by the column format below.
  const body = rows.map((r) => [
    r.ref,
    r.code || "",
    r.title,
    ...PL_COLUMNS.flatMap((c) => {
      const v = r.values?.[c.key];
      const p = r.percents?.[c.key];
      return [
        v === null || v === undefined ? "" : Number(v),
        p === null || p === undefined || !isFinite(p) ? "" : Number(p.toFixed(2)),
      ];
    }),
  ]);

  const aoa = [titleRow, filterRow, [], headTop, headSub, ...body];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);

  // Merge the title, the filter line, and each column label over its pair
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 + PL_COLUMNS.length * 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 + PL_COLUMNS.length * 2 } },
    ...PL_COLUMNS.map((_c, i) => ({
      s: { r: 3, c: 3 + i * 2 },
      e: { r: 3, c: 3 + i * 2 + 1 },
    })),
    ...["Ref", "Code", "Particulars"].map((_h, c) => ({ s: { r: 3, c }, e: { r: 4, c } })),
  ];

  ws["!cols"] = [
    { wch: 10 }, { wch: 8 }, { wch: 42 },
    ...PL_COLUMNS.flatMap(() => [{ wch: 15 }, { wch: 8 }]),
  ];
  ws["!freeze"] = { xSplit: 3, ySplit: 5 };

  // Indian 2-decimal display, numbers preserved underneath
  const HEADER_ROWS = 5;
  body.forEach((_r, ri) => {
    PL_COLUMNS.forEach((_c, ci) => {
      const addr = XLSX.utils.encode_cell({ r: HEADER_ROWS + ri, c: 3 + ci * 2 });
      if (ws[addr] && typeof ws[addr].v === "number") ws[addr].z = "#,##0.00";
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
  XLSX.writeFile(wb, `Profit_Loss_${projectCode || "all"}_${fileStamp()}.xlsx`);
}
