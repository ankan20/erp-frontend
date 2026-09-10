import { PL_COLUMNS, PL_STRUCTURE, PL_RESULT_ROW } from "@/config/profitLoss.config";

/**
 * Flatten PL_STRUCTURE into display rows, merged with the API's values.
 *
 * The table, the PDF and the Excel sheet all render from this one function, so
 * the three can never disagree.
 *
 * ─── API SHAPE ───────────────────────────────────────────────────────────────
 *   { rows: [ { code: "DRCW", order, workDone, booked, stock, actual,
 *               orderPercent?, workDonePercent?, … } ] }
 *   A plain object keyed by code ({ DRCW: {...} }) is accepted too.
 *
 * ─── HOW VALUES ROLL UP ──────────────────────────────────────────────────────
 *   Leaf rows take their values straight from the API.
 *   Section rows (A, B.1, B.2.1 …) are SUMMED from their leaves rather than
 *   read from the response, so a section can never contradict the lines under
 *   it. Row C is Sale (A) − Expenses (B).
 *
 * ─── HOW % IS DERIVED ────────────────────────────────────────────────────────
 *   A row's % is its share of total Sale (row A) in the SAME column — the usual
 *   common-size reading, and the only base available on this sheet. If the API
 *   sends an explicit `<column>Percent` for a row, that wins.
 *   Sale is 0 → % is left blank rather than shown as 0.
 */

const COLS = PL_COLUMNS.map((c) => c.key);

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

// Index the response by CC code, accepting either an array or a keyed object
function indexByCode(data) {
  const out = {};
  const rows = Array.isArray(data?.rows) ? data.rows
             : Array.isArray(data)       ? data
             : null;
  if (rows) {
    rows.forEach((r) => {
      const code = String(r?.code || r?.ccCode || "").trim().toUpperCase();
      if (code) out[code] = r;
    });
    return out;
  }
  const keyed = data?.rows && typeof data.rows === "object" ? data.rows
              : data && typeof data === "object"            ? data
              : {};
  Object.entries(keyed).forEach(([code, r]) => {
    if (r && typeof r === "object") out[String(code).trim().toUpperCase()] = r;
  });
  return out;
}

const emptyValues = () => COLS.reduce((acc, k) => ({ ...acc, [k]: null }), {});

// Walk the tree depth-first, emitting a row per node with values rolled up.
// `ancestors` is every enclosing group's ref — the table hides a row when any
// of them is collapsed, and `family` is inherited so a branch shares a colour.
function walk(nodes, byCode, depth, out, ancestors = [], family = null) {
  const subtotal = emptyValues();

  nodes.forEach((node) => {
    const nodeFamily = node.family || family;

    if (node.children?.length) {
      const rowIndex = out.length;
      out.push(null);                                   // placeholder, filled below
      const childTotal = walk(
        node.children, byCode, depth + 1, out, [...ancestors, node.ref], nodeFamily,
      );
      out[rowIndex] = {
        ref:      node.ref,
        code:     node.code || "",
        title:    node.title,
        family:   nodeFamily,
        depth,
        ancestors,
        isGroup:  true,
        values:   childTotal,
        percents: {},
      };
      COLS.forEach((k) => {
        if (childTotal[k] !== null) subtotal[k] = (subtotal[k] ?? 0) + childTotal[k];
      });
      return;
    }

    const api    = byCode[String(node.code || "").toUpperCase()] || {};
    const values = {};
    const percents = {};
    COLS.forEach((k) => {
      values[k]   = num(api[k]);
      percents[k] = num(api[`${k}Percent`]);
      if (values[k] !== null) subtotal[k] = (subtotal[k] ?? 0) + values[k];
    });

    out.push({
      ref:    node.ref,
      code:   node.code || "",
      title:  node.title,
      family: nodeFamily,
      depth,
      ancestors,
      isGroup: false,
      values,
      percents,
    });
  });

  return subtotal;
}

export function buildProfitLossRows(apiData) {
  const byCode = indexByCode(apiData);
  const rows   = [];
  walk(PL_STRUCTURE, byCode, 0, rows);

  const totals = (ref) => rows.find((r) => r.ref === ref)?.values || emptyValues();
  const sale     = totals("A");
  const expenses = totals("B");

  // C — Profit & Loss
  const result = {};
  COLS.forEach((k) => {
    if (sale[k] === null && expenses[k] === null) result[k] = null;
    else result[k] = (sale[k] ?? 0) - (expenses[k] ?? 0);
  });
  rows.push({
    ref:    PL_RESULT_ROW.ref,
    code:   "",
    title:  PL_RESULT_ROW.title,
    family: PL_RESULT_ROW.family,
    depth:  0,
    ancestors: [],
    isGroup: false,          // nothing nests under the bottom line
    values: result,
    percents: {},
  });

  // Fill in the % each row represents of Sale, in the same column
  rows.forEach((row) => {
    COLS.forEach((k) => {
      if (row.percents[k] !== null && row.percents[k] !== undefined) return; // API wins
      const base = sale[k];
      row.percents[k] =
        base && row.values[k] !== null ? (row.values[k] / base) * 100 : null;
    });
  });

  return { rows, sale, expenses, result };
}

export { COLS as PL_COLUMN_KEYS };
