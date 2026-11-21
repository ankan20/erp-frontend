// Sale Order bulk upload — Excel template (Orders + Items sheets) and parsing.
// Same approach as the Expenses Docket / Journal bulk uploads: parse in the
// browser, the backend validates and imports.

export const ORDER_COLUMNS = [
  { key: "soRef",         header: "SO Ref",            width: 10 },
  { key: "soDate",        header: "SO Date",           width: 13 },
  { key: "orderTitle",    header: "Order Title",       width: 40 },
  { key: "orderNo",       header: "Customer Order No", width: 20 },
  { key: "orderValidity", header: "Order Validity",    width: 14 },
  { key: "debtorCode",    header: "Debtor Code",       width: 16 },
];

export const ITEM_COLUMNS = [
  { key: "soRef",           header: "SO Ref",           width: 10 },
  { key: "itemType",        header: "Item Type",        width: 11 },
  { key: "itemCode",        header: "Item Code",        width: 13 },
  { key: "itemName",        header: "Item Name",        width: 40 },
  { key: "itemDescription", header: "Item Description", width: 40 },
  { key: "unit",            header: "Unit",             width: 9  },
  { key: "qty",             header: "Qty",              width: 10 },
  { key: "rate",            header: "Rate",             width: 12 },
  { key: "gstPercent",      header: "GST %",            width: 8  },
];

const DATE_KEYS = ["soDate", "orderValidity"];

// Header aliases → field key (compared after lower-casing and stripping non-alphanumerics)
const ORDER_ALIASES = {
  soRef:         ["soref", "ref", "refno", "orderref", "saleorderref", "group", "entryno"],
  soDate:        ["sodate", "date", "orderdate", "saleorderdate", "ddmmyyyy"],
  orderTitle:    ["ordertitle", "title", "ordershortdescription", "shortdescription", "description", "subject"],
  orderNo:       ["customerorderno", "orderno", "pono", "customerpono", "workorderno", "loino", "custorderno"],
  orderValidity: ["ordervalidity", "validity", "validtill", "validupto", "validuntil", "expirydate"],
  debtorCode:    ["debtorcode", "debtor", "sundrydebtor", "customercode", "ledgercode", "customer", "partycode"],
};

const ITEM_ALIASES = {
  soRef:           ["soref", "ref", "refno", "orderref", "saleorderref", "group", "entryno"],
  itemType:        ["itemtype", "type", "boqnonboq", "boq"],
  itemCode:        ["itemcode", "code", "boqcode", "itemno", "slno"],
  itemName:        ["itemname", "name", "item", "particulars"],
  itemDescription: ["itemdescription", "description", "desc", "details", "specification"],
  unit:            ["unit", "uom", "units"],
  qty:             ["qty", "quantity", "orderqty", "orderquantity"],
  rate:            ["rate", "unitrate", "price", "unitprice"],
  gstPercent:      ["gst", "gstpercent", "gstrate", "tax", "taxpercent", "gstpct"],
};

const EXAMPLE_PREFIX = "EXAMPLE";

const norm = (s) => String(s ?? "").toLowerCase().replace(/\*/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

const pad = (n) => String(n).padStart(2, "0");

// Excel serial date → DD-MM-YYYY (timezone-safe)
const serialToDate = (XLSX, v) => {
  const p = XLSX.SSF.parse_date_code(v);
  if (!p || !p.y) return String(v);
  return `${pad(p.d)}-${pad(p.m)}-${p.y}`;
};

// ── TEMPLATE ──────────────────────────────────────────────────────────────────

const INSTRUCTIONS = [
  ["SALE ORDER BULK UPLOAD — HOW TO FILL"],
  [""],
  ["1. 'Orders' sheet: ONE ROW = ONE SALE ORDER. Give each order its own SO Ref (1, 2, 3… or any text)."],
  ["2. 'Items' sheet: ONE ROW = ONE ITEM LINE. Put the SO Ref of the order it belongs to. An order can have many items."],
  ["3. Every order needs at least one item, and every item's SO Ref must be on the Orders sheet."],
  ["4. Amount and GST amount are calculated for you: Amount = Qty x Rate, GST = Amount x GST % / 100."],
  ["5. Rows whose SO Ref starts with 'EXAMPLE' are ignored — delete or overwrite them."],
  ["6. Keep this as an Excel file (.xlsx). A CSV file cannot hold two sheets."],
  [""],
  ["ORDERS SHEET", "REQUIRED", "WHAT TO ENTER"],
  ["SO Ref",            "Yes", "Links the order to its items. Not saved — the system gives the real OSO number."],
  ["SO Date",           "Yes", "DD-MM-YYYY (e.g. 05-11-2026). Excel date cells also work."],
  ["Order Title",       "Yes", "Short description of the order (max 200 characters)."],
  ["Customer Order No", "No",  "The customer's PO / work order number. If it already exists in this project you get a warning (still allowed)."],
  ["Order Validity",    "No",  "DD-MM-YYYY. Cannot be before the SO Date."],
  ["Debtor Code",       "Yes", "Sundry Debtor ledger code (see 'Debtors' sheet)."],
  [""],
  ["ITEMS SHEET", "REQUIRED", "WHAT TO ENTER"],
  ["SO Ref",           "Yes", "SO Ref of the order on the Orders sheet."],
  ["Item Type",        "Yes", "BOQ  |  Non-BOQ"],
  ["Item Code",        "No",  "Your item / BOQ code."],
  ["Item Name",        "Yes", "Item name."],
  ["Item Description", "No",  "Longer description."],
  ["Unit",             "No",  "Nos, Cum, Sqm, LS …"],
  ["Qty",              "Yes", "Greater than 0."],
  ["Rate",             "Yes", "0 or more. Numbers only; commas are fine."],
  ["GST %",            "No",  "0 to 100. Blank = 0."],
  [""],
  ["AFTER UPLOAD"],
  ["• You will see every order with its items: the ones that are ready, and the ones that need correction (with the exact reason). Fix them on screen."],
  ["• Ready orders are created as DRAFT. Tick 'Submit for approval after import' to send them for approval straight away."],
  ["• Attachments can be added later by opening an order. Max 1000 orders and 5000 item rows per file."],
];

export async function downloadSaleOrderTemplate({ debtors = [], projectCode = "" }) {
  const XLSX = await import("xlsx");
  const d1 = debtors[0]?.code || "DR00001";
  const d2 = debtors[1]?.code || d1;

  const orders = [
    [`${EXAMPLE_PREFIX}-1`, "05-11-2026", "Civil works — Block A", "PO/2026/118", "31-03-2027", d1],
    [`${EXAMPLE_PREFIX}-2`, "06-11-2026", "Electrical maintenance", "",           "",           d2],
  ];
  const items = [
    [`${EXAMPLE_PREFIX}-1`, "BOQ",     "1.1", "Excavation",          "Earth work in excavation", "Cum", 120, 450,   18],
    [`${EXAMPLE_PREFIX}-1`, "BOQ",     "1.2", "PCC 1:4:8",           "",                         "Cum", 35,  5200,  18],
    [`${EXAMPLE_PREFIX}-2`, "Non-BOQ", "",    "Monthly maintenance", "Nov-2026",                 "LS",  1,   65000, 18],
  ];

  const wb = XLSX.utils.book_new();

  const wsO = XLSX.utils.aoa_to_sheet([ORDER_COLUMNS.map((c) => c.header), ...orders]);
  wsO["!cols"] = ORDER_COLUMNS.map((c) => ({ wch: c.width }));
  // keep example dates as text so Excel doesn't reformat DD-MM-YYYY
  for (let r = 1; r <= orders.length; r++) {
    [1, 4].forEach((c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (wsO[addr]) { wsO[addr].t = "s"; wsO[addr].z = "@"; }
    });
  }
  XLSX.utils.book_append_sheet(wb, wsO, "Orders");

  const wsI = XLSX.utils.aoa_to_sheet([ITEM_COLUMNS.map((c) => c.header), ...items]);
  wsI["!cols"] = ITEM_COLUMNS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, wsI, "Items");

  const wsH = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);
  wsH["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsH, "Instructions");

  const wsD = XLSX.utils.aoa_to_sheet([
    ["Debtor Code", "Debtor Name", "GSTIN", "Status"],
    ...debtors.map((d) => [d.code, d.name, d.gstin || "", d.status || ""]),
  ]);
  wsD["!cols"] = [{ wch: 16 }, { wch: 45 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsD, "Debtors");

  XLSX.writeFile(wb, `Sale_Order_Upload_Template${projectCode ? "_" + projectCode : ""}.xlsx`);
}

// ── ERROR REPORT (orders that need correction → Excel, same two sheets) ───────

export async function downloadErrorReport(orders, orphanItems = []) {
  const XLSX = await import("xlsx");
  const oA = [[...ORDER_COLUMNS.map((c) => c.header), "Errors"]];
  const iA = [[...ITEM_COLUMNS.map((c) => c.header), "Errors"]];
  orders.forEach((o) => {
    oA.push([...ORDER_COLUMNS.map((c) => o[c.key] ?? ""), (o.errors || []).join(" | ")]);
    (o.items || []).forEach((i) => {
      iA.push([...ITEM_COLUMNS.map((c) => (c.key === "soRef" ? o.soRef : i[c.key]) ?? ""), (i.errors || []).join(" | ")]);
    });
  });
  orphanItems.forEach((i) => iA.push([...ITEM_COLUMNS.map((c) => i[c.key] ?? ""), (i.errors || []).join(" | ")]));

  const wb = XLSX.utils.book_new();
  const wsO = XLSX.utils.aoa_to_sheet(oA);
  wsO["!cols"] = [...ORDER_COLUMNS.map((c) => ({ wch: c.width })), { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsO, "Orders");
  const wsI = XLSX.utils.aoa_to_sheet(iA);
  wsI["!cols"] = [...ITEM_COLUMNS.map((c) => ({ wch: c.width })), { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsI, "Items");
  XLSX.writeFile(wb, "Sale_Order_Upload_Corrections.xlsx");
}

// ── PARSE ─────────────────────────────────────────────────────────────────────

const headerMapper = (aliases) => (h) => {
  const n = norm(h);
  if (!n) return null;
  for (const [key, list] of Object.entries(aliases)) if (list.includes(n)) return key;
  return null;
};

// reads one sheet → rows of { rowNo, ...columns }
function readSheet(XLSX, ws, columns, aliases, required, sheetLabel) {
  const mapHeader = headerMapper(aliases);
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: false });

  let headerIdx = -1, colMap = {};
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const map = {};
    (aoa[i] || []).forEach((h, ci) => {
      const k = mapHeader(h);
      if (k && map[k] === undefined) map[k] = ci;
    });
    if (Object.keys(map).length >= Math.min(3, required.length)) { headerIdx = i; colMap = map; break; }
  }
  if (headerIdx < 0) {
    throw new Error(`Could not find the header row on the '${sheetLabel}' sheet. Please use the template — first row must be: ` +
      columns.map((c) => c.header).join(", "));
  }
  const missing = required.filter((k) => colMap[k] === undefined);
  if (missing.length) {
    const labels = missing.map((k) => columns.find((c) => c.key === k)?.header || k);
    throw new Error(`'${sheetLabel}' sheet is missing column(s): ${labels.join(", ")}. Please use the template.`);
  }

  const rows = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const line = aoa[i] || [];
    const r = { rowNo: i + 1 };
    columns.forEach(({ key }) => {
      let v = colMap[key] === undefined ? "" : line[colMap[key]];
      if (DATE_KEYS.includes(key) && typeof v === "number") v = serialToDate(XLSX, v);
      r[key] = v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v).trim();
    });
    if (columns.every(({ key }) => r[key] === "")) continue;
    if (String(r.soRef).toUpperCase().startsWith(EXAMPLE_PREFIX)) { skipped++; continue; }
    rows.push(r);
  }
  return { rows, skipped };
}

/**
 * Returns { orders, items, skippedExamples } or throws Error with a friendly message.
 */
export async function parseSaleOrderFile(file) {
  const XLSX = await import("xlsx");
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    throw new Error("Please upload the Excel template (.xlsx). Sale orders need two sheets (Orders and Items), which a CSV file cannot hold.");
  }
  if (!/\.(xlsx|xls|xlsm)$/.test(name)) throw new Error("Please upload an Excel file (.xlsx / .xls)");
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB");

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const find = (...names) => wb.SheetNames.find((n) => names.includes(norm(n)));
  const oName = find("orders", "order", "saleorders", "saleorder");
  const iName = find("items", "item", "itemlines", "orderitems", "saleorderitems");
  if (!oName || !iName) {
    throw new Error("The file must have an 'Orders' sheet and an 'Items' sheet. Please download and use the template.");
  }

  const o = readSheet(XLSX, wb.Sheets[oName], ORDER_COLUMNS, ORDER_ALIASES, ["soRef", "soDate", "orderTitle", "debtorCode"], oName);
  const i = readSheet(XLSX, wb.Sheets[iName], ITEM_COLUMNS, ITEM_ALIASES, ["soRef", "itemName", "qty", "rate"], iName);

  if (!o.rows.length) {
    throw new Error(o.skipped
      ? "Only the EXAMPLE orders were found. Add your own rows (or rename the SO Ref) and upload again."
      : "No orders found on the Orders sheet.");
  }
  return { orders: o.rows, items: i.rows, skippedExamples: o.skipped + i.skipped };
}
