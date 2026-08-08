
/**
 * Format a monetary amount in the Indian numbering system (en-IN locale).
 * Always shows exactly 2 decimal places.
 * Produces output like: 1,00,000.00 / 12,500.50
 *
 * ─── FIELD TYPES THAT NEED THIS ──────────────────────────────────────────────
 *   Rate, Basic Amount, GST Amount, Total Amount — any ₹ value.
 *   For EDITABLE ₹ fields use <AmountInput> instead (it calls this internally).
 *   This function is for READ-ONLY cells and left-panel summary fields.
 *
 * ─── CURRENT USAGE IN THIS PROJECT ──────────────────────────────────────────
 *
 *   OGSaleOrderForm.jsx
 *     • Basic Amt column td       → {isBoq ? formatAmount(amount) : ""}
 *     • GST Amt column td         → {isBoq ? formatAmount(gstAmt) : ""}
 *     • Amount column td          → {isBoq ? formatAmount(amount) : ""}
 *     • Footer: GST Amt, Amount   → {formatAmount(gstAmount)} / {formatAmount(boqBasic)}
 *     • Left panel: Basic Amount  → value={formatAmount(basicAmount)}
 *     • Left panel: GST / Total   → value={formatAmount(gstAmount/totalAmount)}
 *
 *   SaleClaimBillForm.jsx
 *     • Rate column td (read-only from order) → {formatAmount(rate)}
 *     • Basic Amt column td       → {formatAmount(amount)}
 *     • GST Amt column td         → {formatAmount(gstAmt)}
 *     • Amount column td          → {formatAmount(amount)}
 *     • Footer totals             → {formatAmount(gstAmount)} / {formatAmount(thisBillClaim)}
 *     • Left panel summary fields → formatAmount(thisBillClaim/gstAmount/totalClaim/preCertified)
 *
 *   SaleCertifiedBillForm.jsx
 *     • Basic Amt column td       → {formatAmount(amount)}
 *     • GST Amt column td         → {formatAmount(gstAmt)}
 *     • Amount column td          → {formatAmount(amount)}
 *     • Footer totals             → {formatAmount(gstAmount)} / {formatAmount(thisBillAmount)}
 *     • Left panel summary fields → formatAmount(thisBillAmount/gstAmount/totalBillAmount/preCertified)
 *
 * ─── HOW TO USE IN A NEW PAGE ────────────────────────────────────────────────
 *   1. Import: import { formatAmount } from "@/helper/numberFormatter";
 *   2. In any read-only <td> showing ₹:  {formatAmount(item.rate)}
 *   3. In any read-only <input> showing ₹: value={formatAmount(someTotal)}
 *   4. DO NOT remove local fmt() helpers — use this shared one instead.
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   Never pass into an editable input's value — Indian commas break number parsing.
 *   Use <AmountInput> for editable ₹ fields.
 *
 * @param {number|string} num  - Raw numeric value
 * @returns {string}  e.g. "1,00,000.00". Returns "" for empty/null/undefined.
 */
export function formatAmount(num) {
  if (num === "" || num === null || num === undefined) return "";
  const value = Number(num);
  if (isNaN(value)) return "";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a quantity value for DISPLAY with always 3 decimal places.
 * Produces output like: 100.500 / 12.750 / 1.000
 *
 * ─── FIELD TYPES THAT NEED THIS ──────────────────────────────────────────────
 *   Order Qty, Claim Qty, Certified Qty, Received Qty, Indent Qty —
 *   any unit-count value (not ₹, not %).
 *   For EDITABLE qty fields use <QtyInput> instead (it calls this internally).
 *   This function is for READ-ONLY cells only.
 *
 * ─── CURRENT USAGE IN THIS PROJECT ──────────────────────────────────────────
 *
 *   SaleClaimBillForm.jsx
 *     • Order Qty column td (always read-only reference)
 *         → {orderQty > 0 ? formatQtyDisplay(orderQty) : "—"}
 *     • overQty error message
 *         → Max: {formatQtyDisplay(orderQty)}
 *
 *   SaleCertifiedBillForm.jsx
 *     • Order Qty column td (always read-only reference)
 *         → {orderQty > 0 ? formatQtyDisplay(orderQty) : "—"}
 *     • overQty error message
 *         → Max: {formatQtyDisplay(orderQty)}
 *
 * ─── HOW TO USE IN A NEW PAGE ────────────────────────────────────────────────
 *   1. Import: import { formatQtyDisplay } from "@/helper/numberFormatter";
 *   2. In any read-only <td> showing qty:  {formatQtyDisplay(item.qty)}
 *   3. For the read-only Order Qty reference column (always present in billing
 *      forms), render as plain text td — never use <QtyInput disabled> for it.
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   Do not pass into an editable input's value — trailing zeros ("100.500")
 *   interfere with user typing experience even though they won't break parsing.
 *   Use <QtyInput> for editable qty fields.
 *
 * @param {number|string} num  - Raw numeric value
 * @returns {string}  e.g. "100.500". Returns "" for empty/null/undefined.
 */
export function formatQtyDisplay(num) {
  if (num === "" || num === null || num === undefined) return "";
  const value = Number(num);
  if (isNaN(value)) return "";
  return value.toFixed(3);
}
