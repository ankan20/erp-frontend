// Shared, cached /issue-tracker/status for the sidebar and the page.
//   const status = useIssueTrackerStatus();   // null while loading
//   refreshIssueTrackerStatus();              // after flipping the kill switch / members
import { useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const OFF = { enabled: false, showMenu: false, isSuperAdmin: false, canView: false, canEdit: false, isDeveloper: false };

let status = null;
let loading = null;
let forToken = null; // status belongs to this login
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());

export function refreshIssueTrackerStatus() {
  forToken = getLocalStorage("token");
  loading = apiRequest({ url: API_ENDPOINTS.ISSUE_TRACKER.STATUS })
    .then((r) => { status = { ...OFF, ...(r?.data || {}) }; })
    .catch(() => { status = OFF; })
    .finally(() => { loading = null; emit(); });
  return loading;
}

function subscribe(listener) {
  listeners.add(listener);
  const stale = status && forToken !== getLocalStorage("token"); // another user logged in
  if ((!status || stale) && !loading) refreshIssueTrackerStatus();
  return () => listeners.delete(listener);
}

export function useIssueTrackerStatus() {
  return useSyncExternalStore(subscribe, () => status, () => null);
}
