// Expenses Docket (petty cash) bulk upload — template generation + file parsing (xlsx / xls / csv).
// Same approach as the Journal bulk upload: parse in the browser, backend validates and imports.

export const COLUMNS = [
  { key: "docketRef",     header: "Docket Ref",     width: 12 },
  { key: "date",          header: "Date",           width: 13 },
  { key: "budgetNo",      header: "Budget No",      width: 13 },
  { key: "expensesBy",    header: "Expenses By",    width: 20 },
  { key: "paymentMode",   header: "Payment Mode",   width: 13 },
  { key: "accountCode",   header: "Account Code",   width: 15 },
  { key: "transactionId", header: "Transaction ID", width: 16 },
  { key: "ccCode",        header: "CC Code",        width: 12 },
  { key: "description",   header: "Description",    width: 36 },
  { key: "amount",        header: "Amount",         width: 13 },
];

// docket-level columns: one value per docket, repeated on each of its rows
export const HEADER_KEYS = ["date", "budgetNo", "expensesBy", "paymentMode", "accountCode", "transactionId"];

// Header aliases → field key (compared after lower-casing and stripping non-alphanumerics)
const HEADER_ALIASES = {
  docketRef:     ["docketref", "docketno", "docket", "ref", "refno", "voucherref", "voucherno", "group", "entryno", "dvref"],
  date:          ["date", "docketdate", "voucherdate", "expensedate", "ddmmyyyy", "dateddmmyyyy"],
  budgetNo:      ["budgetno", "budget", "budgetref", "budgetrefno", "budgetnumber"],
  expensesBy:    ["expensesby", "expenseby", "spentby", "paidby", "person", "employee", "name"],
  paymentMode:   ["paymentmode", "modeofpayment", "mode", "payment", "paymode"],
  accountCode:   ["accountcode", "account", "bankcode", "cashcode", "bankcashcode", "bankcash", "accountno"],
  transactionId: ["transactionid", "transid", "txnid", "paymentrefid", "paymentref", "utr", "refid", "chequeno"],
  ccCode:        ["cccode", "cc", "costcentre", "costcenter", "expensehead", "head"],
  description:   ["description", "shortdescription", "remarks", "remark", "narration", "particulars", "details", "note"],
  amount:        ["amount", "amt", "expense", "expenseamount", "value", "amountrs"],
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

const exampleRows = (budgets, accounts) => {
  const b    = budgets[0];
  const bNo  = b?.budgetNo || "PB00001";
  const ccA  = b?.rows?.[0]?.ccCode || "CC0001";
  const ccB  = b?.rows?.[1]?.ccCode || ccA;
  const bank = accounts.find((a) => a.type === "BANK")?.bankCode || "BANK001";
  const cash = accounts.find((a) => a.type === "CASH")?.bankCode || "CASH001";
  return [
    [`${EXAMPLE_PREFIX}-1`, "15-11-2026", bNo, "Ramesh Kumar", "Bank/UPI", bank, "UTR123456", ccA, "Site tea & snacks", 1200],
    [`${EXAMPLE_PREFIX}-1`, "15-11-2026", bNo, "Ramesh Kumar", "Bank/UPI", bank, "UTR123456", ccB, "Local conveyance",  800],
    [`${EXAMPLE_PREFIX}-2`, "16-11-2026", bNo, "Suresh Das",   "Cash",     cash, "",          ccA, "Stationery",        450],
  ];
};

const INSTRUCTIONS = [
  ["EXPENSES DOCKET BULK UPLOAD — HOW TO FILL"],
  [""],
  ["1. Fill the 'Expense Dockets' sheet. ONE ROW = ONE CC expense line."],
  ["2. Rows with the same 'Docket Ref' become ONE docket (e.g. 1,1,1 then 2). Use any number or text."],
  ["3. Docket-level columns (Date, Budget No, Expenses By, Payment Mode, Account Code, Transaction ID) must be the same on every row of a docket."],
  ["4. Every docket must reference an APPROVED petty cash budget, and each CC must be a line of that budget (see 'Budget Balance' sheet)."],
  ["5. A CC's amount cannot be more than the balance left in the budget. Earlier dockets in the same file are counted too."],
  ["6. Rows whose Docket Ref starts with 'EXAMPLE' are ignored — delete or overwrite them."],
  [""],
  ["COLUMN", "REQUIRED", "WHAT TO ENTER"],
  ["Docket Ref",     "Yes", "Groups lines into one docket. Not saved — the system gives the real DV number."],
  ["Date",           "Yes", "DD-MM-YYYY (e.g. 15-11-2026). Excel date cells also work."],
  ["Budget No",      "Yes", "Approved budget number of this project, e.g. PB00012 (see 'Budget Balance' sheet)."],
  ["Expenses By",    "Yes", "Name of the person who spent the money (max 100 characters)."],
  ["Payment Mode",   "Yes", "Cash  |  Bank/UPI.   A Cash docket can have only ONE line."],
  ["Account Code",   "Yes*","Cash / Bank account code linked to the project (see 'Accounts' sheet). Must match the payment mode. *Can be left blank if the project has only one account of that type."],
  ["Transaction ID", "No",  "UTR / UPI ref / cheque no. for Bank/UPI payments."],
  ["CC Code",        "Yes", "CC code from the selected budget."],
  ["Description",    "No",  "Short description of the expense (max 255 characters)."],
  ["Amount",         "Yes", "Greater than 0. Numbers only. Commas are fine."],
  [""],
  ["AFTER UPLOAD"],
  ["• You will see a preview: dockets that are ready, and those that need correction (with the exact reason)."],
  ["• Ready dockets are created as DRAFT expense dockets. Fix the others on screen or in Excel and re-upload just those."],
  ["• Drafts go through the normal Submit → Approval flow. Bills/attachments can be added later by opening a docket. Max 5000 rows per file."],
];

export async function downloadDocketTemplate({ format = "xlsx", budgets = [], accounts = [], projectCode = "" }) {
  const XLSX = await import("xlsx");
  const headers = COLUMNS.map((c) => c.header);
  const examples = exampleRows(budgets, accounts);
  const fname = `Expense_Docket_Upload_Template${projectCode ? "_" + projectCode : ""}`;

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
  XLSX.utils.book_append_sheet(wb, ws, "Expense Dockets");

  const wsI = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  wsI["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Instructions");

  const wsB = XLSX.utils.aoa_to_sheet([
    ["Budget No", "From", "To", "CC Code", "CC Name", "Budget", "Used", "Balance"],
    ...budgets.flatMap((b) => (b.rows || []).map((r) => [
      b.budgetNo,
      b.fromDate ? b.fromDate.split("-").reverse().join("-") : "",
      b.toDate   ? b.toDate.split("-").reverse().join("-")   : "",
      r.ccCode, r.ccName, r.budgetAmount, r.usedAmount, r.remaining,
    ])),
  ]);
  wsB["!cols"] = [{ wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsB, "Budget Balance");

  const wsA = XLSX.utils.aoa_to_sheet([
    ["Account Code", "Type", "Name", "Use with Payment Mode"],
    ...accounts.map((a) => [a.bankCode, a.type, a.name, a.type === "CASH" ? "Cash" : "Bank/UPI"]),
  ]);
  wsA["!cols"] = [{ wch: 16 }, { wch: 8 }, { wch: 36 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsA, "Accounts");

  XLSX.writeFile(wb, `${fname}.xlsx`);
}

// ── ERROR REPORT (failed dockets → Excel, to fix offline and re-upload) ───────

export async function downloadErrorReport(dockets) {
  const XLSX = await import("xlsx");
  const aoa = [[...COLUMNS.map((c) => c.header), "Errors"]];
  dockets.forEach((d) => {
    d.rows.forEach((r, i) => {
      const errs = [...(i === 0 ? d.errors || [] : []), ...(r.errors || [])];
      aoa.push([...COLUMNS.map((c) => r[c.key] ?? ""), errs.join(" | ")]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [...COLUMNS.map((c) => ({ wch: c.width })), { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expense Dockets");
  XLSX.writeFile(wb, `Expense_Docket_Upload_Corrections.xlsx`);
}

// ── PARSE ─────────────────────────────────────────────────────────────────────

/**
 * Returns { rows, skippedExamples, sheetName } or throws Error with a friendly message.
 * Each row: { rowNo (Excel row number), ...COLUMNS keys }
 */
export async function parseDocketFile(file) {
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
    wb = XLSX.read(text.replace(/^﻿/, ""), { type: "string", raw: true });
  } else {
    wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  }

  const sheetName =
    wb.SheetNames.find((n) => norm(n) === "expensedockets") ||
    wb.SheetNames.find((n) => !["instructions", "budgetbalance", "accounts"].includes(norm(n))) ||
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
    if (Object.keys(map).length >= 4) { headerIdx = i; colMap = map; break; }
  }
  if (headerIdx < 0) {
    throw new Error("Could not find the header row. Please use the template — first row must be: " + COLUMNS.map((c) => c.header).join(", "));
  }
  const missing = ["docketRef", "date", "ccCode", "amount"].filter((k) => colMap[k] === undefined);
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
    if (COLUMNS.every(({ key }) => r[key] === "")) continue;
    if (String(r.docketRef).toUpperCase().startsWith(EXAMPLE_PREFIX)) { skippedExamples++; continue; }
    rows.push(r);
  }

  if (!rows.length) {
    throw new Error(skippedExamples
      ? "Only the EXAMPLE rows were found. Add your own rows (or rename the Docket Ref) and upload again."
      : "No data rows found in the file.");
  }
  return { rows, skippedExamples, sheetName };
}
