/**
 * Format a quantity value with up to `decimals` decimal places.
 * Strips trailing zeros. Returns 0 for null/undefined/NaN.
 * Switches to exponential notation for values > 999,999,999.
 *
 * @param {number|string} num
 * @param {number} [decimals=3]
 * @returns {number|string}
 */
export function formatQty(num, decimals = 3) {
  const value = Number(num);
  if (!num || isNaN(value)) return 0;
  if (value > 999_999_999) return value.toExponential(2);
  return parseFloat(value.toFixed(decimals));
}

/**
 * Format a monetary amount in the Indian numbering system (en-IN locale).
 * Produces output like: 1,00,000.00 / 12,500.50 / 0.00
 *
 * ─── WHERE TO USE ────────────────────────────────────────────────────────────
 *   READ-ONLY display contexts only:
 *     • Table cells / <td> showing amounts
 *     • <ReadCell value={formatAmount(item.rate)} />
 *     • Totals rows / summary bars / labels
 *     • Print / PDF views
 *     • e.g:  <span>{formatAmount(item.totalAmt)}</span>
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   Never pass the formatted string into an input's value — commas break
 *   number parsing and the field will show NaN or refuse to validate.
 *
 *     ❌  <input value={formatAmount(item.rate)} onChange={...} />
 *     ✅  <input value={item.rate} onChange={...} />          ← raw number
 *         <ReadCell value={formatAmount(item.rate)} />        ← formatted display
 *
 *   Input fields (type="number" or controlled text inputs for amounts) should
 *   always bind to the raw numeric value from form state.
 *
 * @param {number|string} num  - Raw numeric value
 * @param {number} [decimals=2]
 * @returns {string}  Formatted string, e.g. "1,00,000.00". Empty string for 0 / falsy.
 */
export function formatAmount(num, decimals = 2) {
  const value = Number(num);
  if (!num || isNaN(value) || value === 0) return "";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
