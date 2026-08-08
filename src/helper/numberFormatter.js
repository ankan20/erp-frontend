
/**
 * Format a monetary amount in the Indian numbering system (en-IN locale).
 * Always shows exactly 2 decimal places.
 * Produces output like: 1,00,000.00 / 12,500.50
 *
 * ─── WHERE TO USE ────────────────────────────────────────────────────────────
 *   READ-ONLY / VIEW display contexts only:
 *     • Table cells / <td> showing amounts
 *     • <ReadCell value={formatAmount(item.rate)} />
 *     • Totals rows, summary bars, labels
 *     • e.g:  <span>{formatAmount(item.totalAmt)}</span>
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   Never pass into an input's value — Indian commas break number parsing.
 *
 *     ❌  <input value={formatAmount(item.rate)} onChange={...} />
 *     ✅  <input value={item.rate} onChange={...} />           ← raw number in input
 *         <ReadCell value={formatAmount(item.rate)} />         ← formatted in display
 *
 * ─── RESTRICTING USER INPUT TO 2 DECIMAL PLACES ─────────────────────────────
 *   To prevent the user from typing more than 2 decimal places (e.g. 1.234):
 *
 *   Option A — step attribute (simplest, browser-native):
 *     <input type="number" step="0.01" min="0" />
 *
 *   Option B — onBlur rounding (rounds when user leaves the field):
 *     onBlur={(e) => setValue("fieldName", parseFloat(Number(e.target.value).toFixed(2)))}
 *
 *   Option C — onChange validation (blocks extra digits while typing):
 *     onChange={(e) => {
 *       const val = e.target.value;
 *       if (/^\d*(\.\d{0,2})?$/.test(val)) setValue("fieldName", val);
 *     }}
 *
 * @param {number|string} num  - Raw numeric value
 * @returns {string}  e.g. "1,00,000.00". Returns "" for 0 / falsy.
 */
export function formatAmount(num) {
  const value = Number(num);
  if (!num || isNaN(value) || value === 0) return "";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a quantity value for DISPLAY with always 3 decimal places.
 * Produces output like: 100.500 / 12.750 / 1.000
 *
 * ─── WHERE TO USE ────────────────────────────────────────────────────────────
 *   READ-ONLY / VIEW display contexts only:
 *     • Table cells / <td> showing qty
 *     • <ReadCell value={formatQtyDisplay(item.billingQty)} />
 *     • e.g:  <span>{formatQtyDisplay(item.receivedQty)}</span>
 *
 * ─── WHERE NOT TO USE ────────────────────────────────────────────────────────
 *   Do not pass into an editable input's value — the trailing zeros ("100.500")
 *   interfere with user typing experience even though they won't break parsing.
 *
 *     ❌  <input value={formatQtyDisplay(item.qty)} onChange={...} />
 *     ✅  <input value={item.qty} onChange={...} />              ← raw number in input
 *         <ReadCell value={formatQtyDisplay(item.qty)} />        ← formatted in display
 *
 * ─── RESTRICTING USER INPUT TO 3 DECIMAL PLACES ─────────────────────────────
 *   To prevent the user from typing more than 3 decimal places (e.g. 1.2345):
 *
 *   Option A — step attribute (simplest):
 *     <input type="number" step="0.001" min="0" />
 *
 *   Option B — onBlur rounding:
 *     onBlur={(e) => setValue("fieldName", parseFloat(Number(e.target.value).toFixed(3)))}
 *
 *   Option C — onChange validation:
 *     onChange={(e) => {
 *       const val = e.target.value;
 *       if (/^\d*(\.\d{0,3})?$/.test(val)) setValue("fieldName", val);
 *     }}
 *
 * @param {number|string} num  - Raw numeric value
 * @returns {string}  e.g. "100.500". Returns "" for 0 / falsy.
 */
export function formatQtyDisplay(num) {
  const value = Number(num);
  if (!num || isNaN(value) || value === 0) return "";
  return value.toFixed(3);
}
