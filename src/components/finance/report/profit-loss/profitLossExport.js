import { PL_COLUMNS } from "@/config/profitLoss.config";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * PDF and Excel exports for the P&L statement.
 *
 * Both take the same `rows` the table renders (from buildProfitLossRows), so a
 * download can never show different numbers from the screen. The PDF keeps the
 * on-screen layout: the same column pairs and the same section shading.
 */

// Row tone → PDF fill, matching the table's bands
const PDF_FILL = {
  section:  [207, 224, 240],
  subgroup: [242, 213, 234],
  group:    [217, 234, 211],
  total:    [188, 214, 236],
  leaf:     null,
};

const XLSX_FILL = {
  section:  "CFE0F0",
  subgroup: "F2D5EA",
  group:    "D9EAD3",
  total:    "BCD6EC",
  leaf:     null,
};

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

export async function downloadProfitLossPDF({ rows, projectCode, fromDate, toDate }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
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
    styles:     { fontSize: 6.5, cellPadding: 1, lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [20, 70, 100], textColor: 255, fontSize: 6.5, halign: "left" },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 13 },
      2: { cellWidth: 52 },
      ...PL_COLUMNS.reduce((acc, _c, i) => {
        acc[3 + i * 2]     = { cellWidth: 21, halign: "right" };
        acc[3 + i * 2 + 1] = { cellWidth: 11, halign: "right" };
        return acc;
      }, {}),
    },
    // Shade section rows exactly as the table does
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row  = rows[data.row.index];
      const fill = PDF_FILL[row?.tone];
      if (fill) {
        data.cell.styles.fillColor = fill;
        data.cell.styles.fontStyle = "bold";
      }
      const value = row?.values?.[PL_COLUMNS[Math.floor((data.column.index - 3) / 2)]?.key];
      if (data.column.index >= 3 && (data.column.index - 3) % 2 === 0 && value < 0) {
        data.cell.styles.textColor = [190, 30, 30];
      }
    },
    margin: { left: 8, right: 8 },
  });

  doc.save(`Profit_Loss_${projectCode || "all"}_${fileStamp()}.pdf`);
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

export { XLSX_FILL };
