// Journal Entry bulk upload — template generation + file parsing (xlsx / xls / csv).
// Parsing happens in the browser; the backend validates and imports.

export const COLUMNS = [
  { key: "voucherRef",  header: "Voucher Ref",  width: 13 },
  { key: "date",        header: "Date",         width: 13 },
  { key: "drCr",        header: "Dr/Cr",        width: 8  },
  { key: "accountType", header: "Account Type", width: 14 },
  { key: "accountCode", header: "Account Code", width: 16 },
  { key: "debit",       header: "Debit",        width: 14 },
  { key: "credit",      header: "Credit",       width: 14 },
  { key: "remarks",     header: "Remarks",      width: 40 },
];

// Header aliases → field key (compared after lower-casing and stripping non-alphanumerics)
const HEADER_ALIASES = {
  voucherRef:  ["voucherref", "voucherno", "voucher", "ref", "refno", "jvref", "jvno", "group", "entryno"],
  date:        ["date", "entrydate", "voucherdate", "jvdate", "ddmmyyyy", "dateddmmyyyy"],
  drCr:        ["drcr", "drorcr", "side", "type", "entrytype", "drcrtype"],
  accountType: ["accounttype", "acctype", "acctype", "ledgertype", "headtype"],
  accountCode: ["accountcode", "acccode", "code", "cccode", "ledgercode", "account", "accountname", "ledger"],
  debit:       ["debit", "debitamount", "dramount", "dr", "debitrs"],
  credit:      ["credit", "creditamount", "cramount", "cr", "creditrs"],
  remarks:     ["remarks", "remark", "narration", "description", "particulars", "note", "notes"],
};

const EXAMPLE_PREFIX = "EXAMPLE";

const norm = (s) => String(s ?? "").toLowerCase().replace(/\*/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

const mapHeader = (h) => {
  const n = norm(h);
  if (!n) return null;
  for (const [key, list] of Object.entries(HEADER_ALIASES)) if (list.includes(n)) return key;
  return null;
};

const pad = (n) => String(n).padStart(2, "0");

// Excel serial date → DD-MM-YYYY (timezone-safe)
const serialToDate = (XLSX, v) => {
  const p = XLSX.SSF.parse_date_code(v);
  if (!p || !p.y) return String(v);
  return `${pad(p.d)}-${pad(p.m)}-${p.y}`;
};

// ── TEMPLATE ──────────────────────────────────────────────────────────────────

const exampleRows = (cc, led) => {
  const ccA  = cc[0]?.ccCode  || "CC0001";
  const ccB  = cc[1]?.ccCode  || ccA;
  const ledA = led[0]?.ledgerCode || "LED0001";
  const ledB = led[1]?.ledgerCode || ledA;
  return [
    [`${EXAMPLE_PREFIX}-1`, "15-11-2026", "Dr", "CC",       ccA,  5000,  "",    "Site expenses for November"],
    [`${EXAMPLE_PREFIX}-1`, "15-11-2026", "Dr", "CC",       ccB,  3000,  "",    ""],
    [`${EXAMPLE_PREFIX}-1`, "15-11-2026", "Cr", "Vendor",   ledA, "",    8000,  ""],
    [`${EXAMPLE_PREFIX}-2`, "16-11-2026", "Dr", "Vendor",   ledB, 12000, "",    "Adjustment against client"],
    [`${EXAMPLE_PREFIX}-2`, "16-11-2026", "Cr", "Customer", "",   "",    12000, ""],
  ];
};

const INSTRUCTIONS = [
  ["JOURNAL ENTRY BULK UPLOAD — HOW TO FILL"],
  [""],
  ["1. Fill the 'Journal Entries' sheet. ONE ROW = ONE Dr or Cr line."],
  ["2. Rows with the same 'Voucher Ref' become ONE journal entry (e.g. 1,1,1 then 2,2). Use any number or text."],
  ["3. Every voucher must balance: total Debit = total Credit. It needs at least one Dr and one Cr line."],
  ["4. Rows whose Voucher Ref starts with 'EXAMPLE' are ignored — delete or overwrite them."],
  [""],
  ["COLUMN", "REQUIRED", "WHAT TO ENTER"],
  ["Voucher Ref",  "Yes", "Groups lines into one voucher. Not saved — the system gives the real JV number."],
  ["Date",         "Yes", "DD-MM-YYYY (e.g. 15-11-2026). Same date for all lines of a voucher. Excel date cells also work."],
  ["Dr/Cr",        "Yes", "Dr or Cr. (Can be left blank if only one of Debit / Credit is filled.)"],
  ["Account Type", "Yes", "CC  |  Vendor  |  Customer.   Vendor = any ledger (creditor / debtor / sub-contractor)."],
  ["Account Code", "Yes*","CC code (see 'CC Codes' sheet) or Ledger code (see 'Ledgers' sheet). *Leave blank for Customer — project client is used."],
  ["Debit",        "Dr rows", "Amount for Dr lines. Numbers only, no minus sign. Commas are fine."],
  ["Credit",       "Cr rows", "Amount for Cr lines. Numbers only, no minus sign."],
  ["Remarks",      "No",  "Voucher remark. Only the first non-empty remark of a voucher is used."],
  [""],
  ["AFTER UPLOAD"],
  ["• You will see a preview: vouchers that are ready, and those that need correction (with the exact reason per row)."],
  ["• Ready vouchers are created as DRAFT journal entries. Fix the others on screen or in Excel and re-upload just those."],
  ["• Drafts go through the normal Submit → Approval flow. Max 5000 rows per file. CSV files use the same columns."],
];

export async function downloadJournalTemplate({ format = "xlsx", ccList = [], ledgerList = [], projectCode = "" }) {
  const XLSX = await import("xlsx");
  const headers = COLUMNS.map((c) => c.header);
  const examples = exampleRows(ccList, ledgerList);
  const fname = `Journal_Upload_Template${projectCode ? "_" + projectCode : ""}`;

  if (format === "csv") {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }

  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws["!cols"] = COLUMNS.map((c) => ({ wch: c.width }));
  // keep example dates as text so Excel doesn't reformat DD-MM-YYYY
  for (let r = 1; r <= examples.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 1 });
    if (ws[addr]) { ws[addr].t = "s"; ws[addr].z = "@"; }
  }
  XLSX.utils.book_append_sheet(wb, ws, "Journal Entries");

  const wsI = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  wsI["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instructions");

  const wsC = XLSX.utils.aoa_to_sheet([
    ["CC Code", "CC Name", "Group"],
    ...ccList.map((c) => [c.ccCode, c.ccName, c.ccGroupName || ""]),
  ]);
  wsC["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsC, "CC Codes");

  const wsL = XLSX.utils.aoa_to_sheet([
    ["Ledger Code", "Ledger Name", "Type"],
    ...ledgerList.map((l) => [l.ledgerCode, l.ledgerName, l.isDebtor ? "Debtor" : "Creditor"]),
  ]);
  wsL["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsL, "Ledgers");

  XLSX.writeFile(wb, `${fname}.xlsx`);
}

// ── ERROR REPORT (failed rows → Excel, to fix offline and re-upload) ─────────

export async function downloadErrorReport(vouchers) {
  const XLSX = await import("xlsx");
  const aoa = [[...COLUMNS.map((c) => c.header), "Errors"]];
  vouchers.forEach((v) => {
    v.rows.forEach((r, i) => {
      const errs = [...(i === 0 ? v.errors || [] : []), ...(r.errors || [])];
      aoa.push([...COLUMNS.map((c) => r[c.key] ?? ""), errs.join(" | ")]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [...COLUMNS.map((c) => ({ wch: c.width })), { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Journal Entries");
  XLSX.writeFile(wb, `Journal_Upload_Corrections.xlsx`);
}

// ── PARSE ─────────────────────────────────────────────────────────────────────

/**
 * Returns { rows, skippedExamples, sheetName } or throws Error with a friendly message.
 * Each row: { rowNo (Excel row number), voucherRef, date, drCr, accountType, accountCode, debit, credit, remarks }
 */
export async function parseJournalFile(file) {
  const XLSX = await import("xlsx");
  const name = (file?.name || "").toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  if (!isCsv && !/\.(xlsx|xls|xlsm)$/.test(name)) {
    throw new Error("Please upload an Excel (.xlsx / .xls) or CSV file");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB");

  let wb;
  if (isCsv) {
    const text = await file.text();
    // raw: keep every value as typed (don't let the parser guess US dates)
    wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  }

  const sheetName =
    wb.SheetNames.find((n) => norm(n) === "journalentries") ||
    wb.SheetNames.find((n) => !["instructions", "cccodes", "ledgers"].includes(norm(n))) ||
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("The file has no sheets");

  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false });

  // find header row in the first 10 rows
  let headerIdx = -1, colMap = {};
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const map = {};
    (aoa[i] || []).forEach((h, ci) => {
      const k = mapHeader(h);
      if (k && map[k] === undefined) map[k] = ci;
    });
    if (Object.keys(map).length >= 3) { headerIdx = i; colMap = map; break; }
  }
  if (headerIdx < 0) {
    throw new Error("Could not find the header row. Please use the template — first row must be: " + COLUMNS.map((c) => c.header).join(", "));
  }
  const missing = ["voucherRef", "date", "accountCode"].filter((k) => colMap[k] === undefined);
  if (colMap.debit === undefined && colMap.credit === undefined) missing.push("debit");
  if (missing.length) {
    const labels = missing.map((k) => COLUMNS.find((c) => c.key === k)?.header || k);
    throw new Error(`Missing column(s): ${labels.join(", ")}. Please use the template.`);
  }

  const rows = [];
  let skippedExamples = 0;
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const line = aoa[i] || [];
    const get = (k) => (colMap[k] === undefined ? "" : line[colMap[k]]);
    const r = { rowNo: i + 1 };
    COLUMNS.forEach(({ key }) => {
      let v = get(key);
      if (key === "date" && typeof v === "number") v = serialToDate(XLSX, v);
      r[key] = v === null || v === undefined ? "" : typeof v === "number" ? v : String(v).trim();
    });
    const allBlank = COLUMNS.every(({ key }) => r[key] === "" );
    if (allBlank) continue;
    if (String(r.voucherRef).toUpperCase().startsWith(EXAMPLE_PREFIX)) { skippedExamples++; continue; }
    rows.push(r);
  }

  if (!rows.length) {
    throw new Error(skippedExamples
      ? "Only the EXAMPLE rows were found. Add your own rows (or rename the Voucher Ref) and upload again."
      : "No data rows found in the file.");
  }
  return { rows, skippedExamples, sheetName };
}
