/**
 * "Created On" column shared by every list (DataTable adds it on its own).
 *
 * Every list API sends the row's DB entry time as `createdTs` (ISO-8601 UTC,
 * e.g. "2026-11-25T08:30:00Z"); it is shown in the viewer's local time.
 * Zone-less strings ("2026-11-25 08:30:00") are read as UTC, as the DB stores.
 */

export const CREATED_ON_KEY = "__createdOn";
export const CREATED_TS_KEY = "__createdTs";

const pad = (n) => String(n).padStart(2, "0");

/** createdAt value → epoch ms, or null. */
export function parseCreatedAt(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value) ? null : value.getTime();
  if (typeof value === "number") return value;
  let s = String(value).trim();
  // "YYYY-MM-DD HH:MM[:SS[.ffffff]]" or ISO without zone → treat as UTC
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/);
  if (m) s = `${m[1]}T${m[2].replace(/(\.\d{3})\d+$/, "$1")}Z`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = `${s}T00:00:00Z`;
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** epoch ms → "25 NOV 2026; 02:05 PM" (local time). */
export function formatCreatedOn(ts) {
  if (ts == null) return null;
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}; ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
}

/** Raw DB entry time on a row. */
export const rowCreatedAt = (row) => row?.createdTs ?? null;

/** "25-11-2026 12:11 PM" for a row's createdTs, or "-" — for hand-built tables. */
export const createdOnText = (row) => formatCreatedOn(parseCreatedAt(rowCreatedAt(row))) || "-";

/** Sort helper for hand-built tables: epoch ms (missing → -Infinity). */
export const createdOnSortValue = (row) => parseCreatedAt(rowCreatedAt(row)) ?? -Infinity;
