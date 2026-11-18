// Bank statement import — template, file parsing (xlsx / xls / csv) and error report.
// Parsing happens in the browser; the backend validates (duplicates, sites) and imports.

export const COLUMNS = [
  { key: "date",    header: "DATE",    width: 12 },
  { key: "byDr",    header: "BY-DR",   width: 20 },
  { key: "toCr",    header: "TO-CR",   width: 20 },
  { key: "dr",      header: "DR",      width: 12 },
  { key: "cr",      header: "CR",      width: 12 },
  { key: "balance", header: "BALANCE", width: 14 },
  { key: "desc",    header: "DESC",    width: 34 },
  { key: "crDr",    header: "CR-DR",   width: 8  },
  { key: "site",    header: "SITE",    width: 10 },
  { key: "refNo",   header: "REF NO",  width: 16 },
];

// Header aliases → key (compared after lower-casing and stripping non-alphanumerics)
const HEADER_ALIASES = {
  date:    ["date", "txndate", "transactiondate", "valuedate", "postdate", "ddmmyyyy"],
  byDr:    ["bydr", "by", "from", "fromparty", "payer"],
  toCr:    ["tocr", "to", "toparty", "payee"],
  dr:      ["dr", "debit", "debitamount", "withdrawal", "withdrawalamt", "withdrawalamount"],
  cr:      ["cr", "credit", "creditamount", "deposit", "depositamt", "depositamount"],
  balance: ["balance", "closingbalance", "runningbalance", "bal"],
  desc:    ["desc", "description", "narration", "particulars", "remarks", "details"],
  crDr:    ["crdr", "drcr", "type", "direction", "txntype"],
  site:    ["site", "sitecode", "project", "projectcode"],
  refNo:   ["refno", "ref", "reference", "referenceno", "chqrefno", "chequeno", "utr", "utrno", "transactionid"],
};

const norm = (s) => String(s ?? "").toLowerCase().replace(/\*/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

const mapHeader = (h) => {
  const n = norm(h);
  if (!n) return null;
  for (const [key, list] of Object.entries(HEADER_ALIASES)) if (list.includes(n)) return key;
  // looser matches for headers like "Balance Amt", "Closing Bal.", "Narration / Description"
  if (n.includes("balance") || /^(closing|running|avail)?bal/.test(n)) return "balance";
  if (n.includes("narration") || n.includes("description") || n.includes("particular")) return "desc";
  return null;
};

const pad = (n) => String(n).padStart(2, "0");
const serialToDate = (XLSX, v) => {
  const p = XLSX.SSF.parse_date_code(v);
  if (!p || !p.y) return String(v);
  return `${pad(p.d)}-${pad(p.m)}-${p.y}`;
};

const INSTRUCTIONS = [
  ["BANK STATEMENT IMPORT — HOW TO FILL"],
  [""],
  ["1. One file = one bank account. Choose the account on the upload screen before uploading."],
  ["2. ONE ROW = ONE bank line. Fill either DR (money going out) or CR (money coming in), not both."],
  ["3. SITE is the project code (see 'Sites' sheet). Only sites linked to this bank account in Master > Bank/Cash are accepted."],
  ["   Leave SITE blank for lines that are not site expenses (e.g. bank charges) — they are stored but never offered to petty cash."],
  ["4. Lines already imported earlier are skipped automatically (same date, amount, balance and description)."],
  [""],
  ["COLUMN", "REQUIRED", "WHAT TO ENTER"],
  ["DATE",    "Yes", "DD-MM-YYYY (e.g. 01-11-2026). Excel date cells also work."],
  ["BY-DR",   "No",  "Party the money came from (debit side)."],
  ["TO-CR",   "No",  "Party the money went to (credit side)."],
  ["DR",      "DR rows", "Outgoing amount. Numbers only, commas are fine."],
  ["CR",      "CR rows", "Incoming amount."],
  ["BALANCE", "No",  "Running balance after this line. Negative allowed for overdraft."],
  ["DESC",    "No",  "Narration. Lines with 'UPI' in DESC / parties / REF NO are tagged as UPI."],
  ["CR-DR",   "No",  "DR or CR. If blank it is taken from the amount column. Must match the amount column if filled."],
  ["SITE",    "No",  "Project code, e.g. SSML. Required for the line to be usable in a petty cash docket."],
  ["REF NO",  "No",  "UTR / cheque / UPI reference."],
];

export async function downloadStatementTemplate({ format = "xlsx", account = null }) {
  const XLSX = await import("xlsx");
  const headers = COLUMNS.map((c) => c.header);
  const code = account?.bankCode || "ICICI912";
  const s1 = account?.sites?.[0] || "SSML";
  const s2 = account?.sites?.[1] || s1;
  const examples = [
    ["01-11-2026", "S.MAITY", code, 2700, "", 300000, "UPI/S.MAITY/site tea", "DR", s1, "UPI4512"],
    ["02-11-2026", code, "TECHNO ELECTRIC", "", 30000, 330000, "CHEQUE", "CR", s2, "000123"],
  ];
  const fname = `Bank_Statement_Template${account ? "_" + account.bankCode : ""}`;

  if (format === "csv") {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
    const blob = new Blob(["﻿" + XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" });
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
  for (let r = 1; r <= examples.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[addr]) { ws[addr].t = "s"; ws[addr].z = "@"; }
  }
  XLSX.utils.book_append_sheet(wb, ws, "Statement");

  const wsI = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  wsI["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instructions");

  const wsS = XLSX.utils.aoa_to_sheet([["SITE (project code)"], ...(account?.sites || []).map((s) => [s])]);
  wsS["!cols"] = [{ wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsS, "Sites");

  XLSX.writeFile(wb, `${fname}.xlsx`);
}

export async function downloadStatementErrors(rows, fileName = "Bank_Statement") {
  const XLSX = await import("xlsx");
  const aoa = [["Row", ...COLUMNS.map((c) => c.header), "Status", "Errors"]];
  rows.forEach((r) => aoa.push([r.rowNo, ...COLUMNS.map((c) => r[c.key] ?? ""), r.status, (r.errors || []).join(" | ")]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, ...COLUMNS.map((c) => ({ wch: c.width })), { wch: 10 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  XLSX.writeFile(wb, `${String(fileName).replace(/\.[^.]+$/, "")}_errors.xlsx`);
}

/** Returns { rows, sheetName } or throws Error with a friendly message. */
export async function parseStatementFile(file) {
  const XLSX = await import("xlsx");
  const name = (file?.name || "").toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";
  if (!isCsv && !/\.(xlsx|xls|xlsm)$/.test(name)) throw new Error("Please upload an Excel (.xlsx / .xls) or CSV file");
  if (file.size > 15 * 1024 * 1024) throw new Error("File is larger than 15 MB");

  const wb = isCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ""), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheetName =
    wb.SheetNames.find((n) => norm(n) === "statement") ||
    wb.SheetNames.find((n) => !["instructions", "sites"].includes(norm(n))) ||
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error("The file has no sheets");
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false });

  let headerIdx = -1, colMap = {};
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const map = {};
    (aoa[i] || []).forEach((h, ci) => { const k = mapHeader(h); if (k && map[k] === undefined) map[k] = ci; });
    if (Object.keys(map).length >= 4) { headerIdx = i; colMap = map; break; }
  }
  if (headerIdx < 0) throw new Error("Could not find the header row. First row must be: " + COLUMNS.map((c) => c.header).join(", "));
  const missing = ["date"].filter((k) => colMap[k] === undefined);
  if (colMap.dr === undefined && colMap.cr === undefined) missing.push("dr");
  if (missing.length) {
    throw new Error(`Missing column(s): ${missing.map((k) => COLUMNS.find((c) => c.key === k).header).join(", ")}. ` +
      (missing.includes("date") ? "DATE is required — add a DATE column to the statement." : ""));
  }

  const rows = [];
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const line = aoa[i] || [];
    const r = { rowNo: i + 1 };
    COLUMNS.forEach(({ key }) => {
      let v = colMap[key] === undefined ? "" : line[colMap[key]];
      if (key === "date" && typeof v === "number") v = serialToDate(XLSX, v);
      r[key] = v === null || v === undefined ? "" : typeof v === "number" ? v : String(v).trim();
    });
    if (COLUMNS.every(({ key }) => r[key] === "")) continue;
    rows.push(r);
  }
  if (!rows.length) throw new Error("No data rows found in the file.");
  const warnings = [];
  if (colMap.balance === undefined) warnings.push("No BALANCE column found in the file, so balance will be empty for every line. Name the column BALANCE.");
  else if (rows.every((r) => r.balance === "")) warnings.push("The BALANCE column is empty in every row.");
  if (colMap.site === undefined) warnings.push("No SITE column found. Lines can be given a site later from the Transactions tab (edit button).");
  return { rows, sheetName, warnings };
}
