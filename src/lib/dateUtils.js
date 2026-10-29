/**
 * Validate a date string (YYYY-MM-DD) or Date object.
 * Rules: format must be YYYY-MM-DD, year must be exactly 4 digits (1000–9999),
 * and it must be a real calendar date (no Feb 30, etc.).
 * Returns an error message string on failure, or null if valid.
 *
 * @param {string|Date|null|undefined} value
 * @param {string} [label] - field label shown in the error message
 * @returns {string|null}
 */
export function validateDateString(value, label = "Date") {
  if (!value && value !== 0) return null; // optional fields pass through

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return `${label}: invalid date`;
    const year = value.getFullYear();
    if (year < 1000 || year > 9999) return `${label}: year must be 4 digits`;
    return null;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Strict format: exactly YYYY-MM-DD with 4-digit year
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return `${label}: expected format YYYY-MM-DD (e.g. 2025-06-15)`;

  const year = parseInt(match[1], 10);
  if (year < 1000) return `${label}: year must be 4 digits`;

  // Check it is a real calendar date (rejects 2024-02-30, 2024-13-01, etc.)
  const parsed = new Date(str + "T00:00:00");
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== str) {
    return `${label}: '${str}' is not a valid calendar date`;
  }

  return null;
}

/**
 * Validate multiple date fields at once.
 * Pass an object mapping { fieldKey: { value, label } }.
 * Returns an object of { fieldKey: errorMessage } for any failures,
 * or an empty object if all pass.
 *
 * @param {{ [key: string]: { value: any, label?: string } }} fields
 * @returns {{ [key: string]: string }}
 *
 * @example
 * const errors = validateDateFields({
 *   partyDate:      { value: formData.partyDate,      label: "Party Date" },
 *   submissionDate: { value: formData.submissionDate, label: "Submission Date" },
 * });
 * if (Object.keys(errors).length) { ... show errors ... }
 */
export function validateDateFields(fields) {
  const errors = {};
  for (const [key, { value, label }] of Object.entries(fields)) {
    const err = validateDateString(value, label || key);
    if (err) errors[key] = err;
  }
  return errors;
}

/**
 * Quick check — returns true if the date value is valid (or empty).
 */
export function isValidDate(value, label) {
  return validateDateString(value, label) === null;
}

/**
 * Zod schema factory for date string fields.
 * Use this in place of z.string() for any date field so validation
 * lives in one place — no per-field .refine() needed.
 *
 * @param {import('zod')} z   Pass the z import from zod
 * @param {string} label      Human-readable label shown in error messages
 * @param {boolean} required  true → field must not be empty
 *
 * @example
 * import { z } from "zod";
 * import { zodDate } from "@/lib/dateUtils";
 *
 * const schema = z.object({
 *   grnDate:   zodDate(z, "GRN Date", true),   // required
 *   partyDate: zodDate(z, "Party Date"),        // optional
 * });
 */
export function zodDate(z, label, required = false) {
  const base = required
    ? z.string().min(1, `${label} is required`)
    : z.string().optional();
  const guard = required
    ? (v) => !validateDateString(v, label)
    : (v) => !v || !validateDateString(v, label);
  return base.refine(guard, {
    message: `${label}: must be a valid date in YYYY-MM-DD format with a 4-digit year`,
  });
}
