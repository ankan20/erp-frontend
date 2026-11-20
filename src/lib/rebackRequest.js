/**
 * Reback request — shared state for the record page that is open now.
 *
 * useMyApprovalStatus (used by every workflow view page) loads the record's
 * reback-request info and publishes it here. The Approve / Action icon in the
 * page header (PageActionButtons) becomes "Reback request" on a fully approved
 * record, and RebackRequestDialog (rendered by HeaderWrapper) shows the dialog.
 */

let state = { record: null, open: false, version: 0, changes: 0 };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function setRebackRecord(record) {
  state = { ...state, record, open: record ? state.open : false, version: state.version + 1 };
  emit();
}

export function openRebackRequestDialog() {
  if (!state.record) return;
  state = { ...state, open: true };
  emit();
}

export function closeRebackRequestDialog() {
  state = { ...state, open: false };
  emit();
}

/** After raise / accept / decline / cancel — the navbar count re-reads. */
export function rebackRequestsChanged() {
  state = { ...state, changes: state.changes + 1 };
  emit();
}

export function subscribeRebackRequest(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getRebackRequestState = () => state;
const SERVER_STATE = { record: null, open: false, version: 0, changes: 0 };
export const getServerRebackRequestState = () => SERVER_STATE;

// ── View-only access to records opened from the Reback Requests page ─────────
// Admins / final approvers may not have the module's page permission. Opening
// a request's document from that page grants VIEW of exactly that page (this
// browser tab only); getPageAccess reads it. Nothing else opens this way.
const VIEW_KEY = "rebackRequestView";

export function grantRebackView(pageUrl) {
  if (typeof window === "undefined" || !pageUrl) return;
  try {
    const list = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "[]");
    if (!list.includes(pageUrl)) list.push(pageUrl);
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage blocked: the page just stays "not available" */
  }
}

export function hasRebackView(pathname) {
  if (typeof window === "undefined" || !pathname) return false;
  try {
    return JSON.parse(sessionStorage.getItem(VIEW_KEY) || "[]").includes(pathname.replace(/\/$/, ""));
  } catch {
    return false;
  }
}
