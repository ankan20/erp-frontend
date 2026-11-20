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
