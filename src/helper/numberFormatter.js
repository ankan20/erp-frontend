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
