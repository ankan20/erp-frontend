import { formatAmount } from "@/helper/numberFormatter";
import { buildELRows, buildAssetsRows } from "./buildBalanceSheetRows";

const fileStamp = () => new Date().toISOString().slice(0, 10);

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Flatten rows for export — all rows included regardless of UI collapse state. */
function flattenRows(rows) {
  return rows.map((row) => {
    const isGroup = row.type === "group";
    const isTotal = row.type === "subtotal" || row.type === "section-total";
    return {
      code:    row.code || "",
      label:   isGroup ? row.label.toUpperCase() : row.label,
      indent:  isGroup ? 0 : (row.depth || 0),
      amount:  !isGroup && row.value !== null ? row.value : null,
      isGroup,
      isTotal,
    };
  });
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function downloadBalanceSheetPDF({ data, projectCode, fromDate, toDate }) {
  const { default: jsPDF }     = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc   = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 297 mm
  const pageH = doc.internal.pageSize.getHeight();  // 210 mm
  const M     = 10;
  const GAP   = 5;
  const usable = pageW - M * 2;
  const panelW = (usable - GAP) / 2;  // ~136 mm each panel

  // ── Title / meta ────────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("BALANCE SHEET", pageW / 2, M + 5, { align: "center" });

  const meta = [
    projectCode ? `Project: ${projectCode}` : null,
    fromDate || toDate
      ? `Period: ${fromDate || "—"} to ${toDate || "—"}`
      : "Period: All dates",
    `As at: ${new Date().toLocaleDateString("en-IN")}`,
  ].filter(Boolean).join("     ");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(meta, pageW / 2, M + 11, { align: "center" });

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(M, M + 13.5, pageW - M, M + 13.5);

  const startY = M + 16;

  // ── Column widths ────────────────────────────────────────────────────────────
  const codeW  = panelW * 0.13;
  const partW  = panelW * 0.60;
  const amtW   = panelW * 0.27;

  // ── Render one panel; returns finalY of the panel ────────────────────────────
  function renderPanel(title, rows, x) {
    const body = rows.map((r) => {
      const pad = r.indent > 0 ? " ".repeat(r.indent * 3) : "";
      return [r.code, pad + r.label, r.amount !== null ? formatAmount(r.amount) : ""];
    });

    autoTable(doc, {
      startY,
      margin: { left: x, right: M },
      tableWidth: panelW,
      head: [
        [{ content: title, colSpan: 3, styles: { halign: "left" } }],
        ["Code", "Particulars", "Amount (₹)"],
      ],
      body,
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      columnStyles: {
        0: { cellWidth: codeW, fontSize: 7, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 1 } },
        1: { cellWidth: partW, fontSize: 7, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 1 } },
        2: { cellWidth: amtW,  fontSize: 7, halign: "right", cellPadding: { top: 1.2, bottom: 1.2, left: 1, right: 2 } },
      },
      styles: {
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [180, 180, 180],
        lineWidth: 0.1,
      },
      didParseCell: ({ section, row, column, cell }) => {
        if (section === "head") {
          if (row.index === 1) {
            // Sub-header row: "Code / Particulars / Amount"
            cell.styles.fillColor = [55, 55, 55];
            cell.styles.textColor = [215, 215, 215];
            cell.styles.fontStyle = "normal";
            cell.styles.fontSize  = 7;
          }
          return;
        }
        const r = rows[row.index];
        if (!r) return;
        if (r.isGroup) {
          cell.styles.fillColor = [230, 230, 230];
          cell.styles.fontStyle = "bold";
        } else if (r.isTotal) {
          cell.styles.fontStyle = "bold";
          if (column.index === 2) cell.styles.lineWidth = { top: 0.4 };
        }
      },
    });

    return doc.lastAutoTable?.finalY ?? startY;
  }

  // ── Draw both panels starting from the same page ─────────────────────────────
  // After the first panel finishes jsPDF's current page advances to wherever
  // that panel ended. Resetting to startPage ensures the Assets panel begins
  // on page 1 (right column), not on page 2.
  const elRows    = flattenRows(buildELRows(data?.equityAndLiabilities));
  const assetRows = flattenRows(buildAssetsRows(data?.assets));

  const startPage = doc.internal.getNumberOfPages();  // always 1 here

  const elFinalY = renderPanel("EQUITY & LIABILITIES", elRows, M);

  doc.setPage(startPage);  // reset before drawing the second panel

  const asFinalY = renderPanel("ASSETS", assetRows, M + panelW + GAP);

  // Move to the last page so the footer lands after both panels.
  const lastPage = doc.internal.getNumberOfPages();
  doc.setPage(lastPage);

  // ── Grand total footer ───────────────────────────────────────────────────────
  const footerY = Math.max(elFinalY, asFinalY) + 3;

  const elGT = data?.equityAndLiabilities?.grandTotal ?? 0;
  const asGT = data?.assets?.grandTotal ?? 0;
  const diff = asGT - elGT;

  doc.setFillColor(30, 30, 30);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  doc.rect(M, footerY, panelW, 7, "F");
  doc.text("GRAND TOTAL — EQUITY & LIABILITIES", M + 2, footerY + 4.5);
  doc.text(formatAmount(elGT), M + panelW - 2, footerY + 4.5, { align: "right" });

  doc.rect(M + panelW + GAP, footerY, panelW, 7, "F");
  doc.text("GRAND TOTAL — ASSETS", M + panelW + GAP + 2, footerY + 4.5);
  doc.text(formatAmount(asGT), M + panelW * 2 + GAP - 2, footerY + 4.5, { align: "right" });

  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");

  if (Math.abs(diff) >= 0.01) {
    doc.setFontSize(7);
    doc.setTextColor(180, 0, 0);
    doc.text(
      `Note: Sheet is not balanced — Difference: ${formatAmount(Math.abs(diff))}`,
      M, footerY + 10,
    );
    doc.setTextColor(0);
  }

  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated on ${new Date().toLocaleString("en-IN")}`,
    pageW - M, pageH - 4, { align: "right" },
  );

  doc.save(`Balance_Sheet_${fileStamp()}.pdf`);
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function downloadBalanceSheetExcel({ data, projectCode, fromDate, toDate }) {
  const XLSX = await import("xlsx");

  const elRows    = flattenRows(buildELRows(data?.equityAndLiabilities));
  const assetRows = flattenRows(buildAssetsRows(data?.assets));

  // Single sheet, side-by-side:
  //   A: E&L Code  | B: E&L Particulars  | C: E&L Amount
  //   D: (gap)
  //   E: Assets Code | F: Assets Particulars | G: Assets Amount

  const sheetData = [];

  // Title row
  sheetData.push(["BALANCE SHEET", "", "", "", "BALANCE SHEET", "", ""]);

  // Period row
  const period = [
    projectCode ? `Project: ${projectCode}` : null,
    fromDate || toDate ? `Period: ${fromDate || "—"} to ${toDate || "—"}` : "All dates",
    `As at: ${new Date().toLocaleDateString("en-IN")}`,
  ].filter(Boolean).join("  |  ");
  sheetData.push([period, "", "", "", period, "", ""]);

  // Blank separator
  sheetData.push(["", "", "", "", "", "", ""]);

  // Column headers
  sheetData.push(["Code", "Equity & Liabilities", "Amount (₹)", "", "Code", "Assets", "Amount (₹)"]);

  // Data rows (pad the shorter side with blanks)
  const maxLen = Math.max(elRows.length, assetRows.length);
  for (let i = 0; i < maxLen; i++) {
    const el = elRows[i];
    const as = assetRows[i];

    const elPad  = el ? "  ".repeat(el.indent) : "";
    const asPad  = as ? "  ".repeat(as.indent) : "";

    sheetData.push([
      el ? el.code  : "",
      el ? elPad + el.label : "",
      el && el.amount !== null ? el.amount : "",
      "",
      as ? as.code  : "",
      as ? asPad + as.label : "",
      as && as.amount !== null ? as.amount : "",
    ]);
  }

  // Grand total row
  const elGT = data?.equityAndLiabilities?.grandTotal ?? 0;
  const asGT = data?.assets?.grandTotal ?? 0;
  sheetData.push(["", "", "", "", "", "", ""]);
  sheetData.push([
    "", "GRAND TOTAL — EQUITY & LIABILITIES", elGT,
    "",
    "", "GRAND TOTAL — ASSETS", asGT,
  ]);

  const diff = asGT - elGT;
  if (Math.abs(diff) >= 0.01) {
    sheetData.push([
      "", `Difference (sheet not balanced): ${formatAmount(Math.abs(diff))}`, "", "", "", "", "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!cols"] = [
    { wch: 8 },   // A
    { wch: 42 },  // B
    { wch: 16 },  // C
    { wch: 2 },   // D gap
    { wch: 8 },   // E
    { wch: 42 },  // F
    { wch: 16 },  // G
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
  XLSX.writeFile(wb, `Balance_Sheet_${fileStamp()}.xlsx`);
}
