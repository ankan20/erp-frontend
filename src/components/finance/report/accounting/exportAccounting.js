import { getLocalStorage } from "@/lib/localStorage";

const fmtINR = (v) =>
  Number(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function getCompany() {
  const c = getLocalStorage("companyInfo") || {};
  return {
    name: c.companyName || c.company_name || "",
    address: c.address || "",
    contact: c.contact || c.phone || "",
    email: c.email || "",
  };
}

function splitAmount(text) {
  if (typeof text !== "string") return null;
  const dot = text.lastIndexOf(".");
  if (dot === -1) return null;
  const intPart = text.slice(0, dot);
  const decPart = text.slice(dot);
  if (!/^\.\d+$/.test(decPart)) return null;
  return { intPart, decPart };
}

function isAmountCol(colIdx, amountCols) {
  if (!amountCols) return false;
  return amountCols.includes(colIdx);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
export async function exportPDF(opts) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: opts.orientation || "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const co = getCompany();
  let y = 12;

  // Company name
  if (co.name) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(co.name.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 4.5;
  }

  // Address
  if (co.address) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(co.address, pageW / 2, y, { align: "center" });
    y += 3;
  }

  // Contact | Email
  const contactParts = [];
  if (co.contact) contactParts.push(`Ph: ${co.contact}`);
  if (co.email) contactParts.push(co.email);
  if (contactParts.length) {
    doc.setFontSize(6.5);
    doc.text(contactParts.join("   |   "), pageW / 2, y, { align: "center" });
    y += 3.5;
  }
  doc.setTextColor(0, 0, 0);

  // Thin divider
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(10, y, pageW - 10, y);
  y += 4;

  // Report title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, pageW / 2, y, { align: "center" });
  y += 4.5;

  // Period + Project line
  const meta = [];
  if (opts.period) meta.push(opts.period);
  if (opts.project && opts.project !== "All") meta.push(`Project: ${opts.project}`);
  if (meta.length) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(meta.join("     |     "), pageW / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  const amountCols = opts.amountColumns || [];

  autoTable(doc, {
    startY: y,
    head: opts.head,
    body: opts.body,
    foot: opts.foot || [],
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
      lineColor: [200, 200, 200],
      lineWidth: 0.15,
      textColor: [30, 30, 30],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 7.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fillColor: false,
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      fontSize: 7.5,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
    },
    columnStyles: opts.columnStyles || {},
    margin: { left: 10, right: 10 },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.2,

    didParseCell: (data) => {
      const text = (data.cell.text || []).join("");
      if (data.section === "body") {
        if (text.startsWith("  ") && !text.startsWith("    ")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [248, 248, 248];
        }
        if (
          text === "Profit & Loss" || text === "Balance Sheet" ||
          text === "Income / Revenue" || text === "Expenses" ||
          text === "Assets" || text === "Equity & Liabilities"
        ) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
          data.cell.styles.textColor = [30, 30, 30];
        }
        if (text.includes("Sub-total") || text.includes("Total Income") ||
            text.includes("Total Expense") || text.includes("Total Assets") ||
            text.includes("Total Equity") || text.includes("Net Profit") ||
            text.includes("Net Loss") || text.includes("Closing Balance") ||
            text === "Difference") {
          data.cell.styles.fontStyle = "bold";
        }
      }
    },

    willDrawCell: (data) => {
      if (data.section !== "body" && data.section !== "foot") return;
      if (!isAmountCol(data.column.index, amountCols)) return;
      const text = (data.cell.text || []).join("");
      const parts = splitAmount(text);
      if (!parts) return;
      data.cell.text = [];
      data.cell._amountParts = parts;
    },

    didDrawCell: (data) => {
      if (!data.cell._amountParts) return;
      const { intPart, decPart } = data.cell._amountParts;
      const cell = data.cell;
      const styles = cell.styles;
      const x = cell.x + cell.width - styles.cellPadding.right;
      const yPos = cell.y + cell.height / 2 + 1;

      doc.setFont("helvetica", styles.fontStyle || "normal");

      doc.setFontSize(5.5);
      const decW = doc.getTextWidth(decPart);
      doc.setTextColor(...(styles.textColor || [30, 30, 30]));
      doc.text(decPart, x, yPos, { align: "right" });

      doc.setFontSize(styles.fontSize || 7.5);
      doc.text(intPart, x - decW, yPos, { align: "right" });

      doc.setTextColor(0, 0, 0);
    },

    didDrawPage: (data) => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(10, pageH - 10, pageW - 10, pageH - 10);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 130);
      doc.text(
        `${co.name || ""}   |   ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
        10,
        pageH - 7,
      );
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
        pageW - 10,
        pageH - 7,
        { align: "right" },
      );
      doc.setTextColor(0, 0, 0);
    },
  });

  const fname = opts.filename || "report";
  doc.save(`${fname}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Excel ───────────────────────────────────────────────────────────────────
export function exportExcel(opts) {
  const XLSX = require("xlsx");
  const co = getCompany();

  const aoa = [];

  if (co.name) aoa.push([co.name.toUpperCase()]);
  if (co.address) aoa.push([co.address]);
  const contactParts = [];
  if (co.contact) contactParts.push(`Ph: ${co.contact}`);
  if (co.email) contactParts.push(co.email);
  if (contactParts.length) aoa.push([contactParts.join("   |   ")]);

  aoa.push([]);
  aoa.push([opts.title]);

  const meta = [];
  if (opts.period) meta.push(opts.period);
  if (opts.project && opts.project !== "All") meta.push(`Project: ${opts.project}`);
  if (meta.length) aoa.push([meta.join("   |   ")]);
  aoa.push([]);

  const headerRowIdx = aoa.length;
  aoa.push(opts.headers);
  aoa.push(...opts.rows);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  if (opts.colWidths) {
    ws["!cols"] = opts.colWidths.map((w) => ({ wch: w }));
  }

  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName || "Report");

  const fname = opts.filename || "report";
  XLSX.writeFile(wb, `${fname}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
