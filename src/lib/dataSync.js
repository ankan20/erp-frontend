// Live data sync between windows (split view windows and browser tabs).
// After a successful create / update / delete, the window tells every other
// window of this app; they reload their data (see DataSyncBoundary).
// Same origin only (BroadcastChannel). Never throws.

const CHANNEL = "erp-data-sync";
const FALLBACK_KEY = "erp-data-sync-event";

// calls that do not change business records
const IGNORE_URL = [
  /^\/(auth|comm|ai|traceability)(\/|$)/i,
  /(^|\/)(heartbeat|typing|ping|pings|notifications?|read|read-all|search|suggest|lookup|check|verify|validate|preview|calculate|export|download|print|pdf|upload|login|logout|refresh-token)(\/|$|\?)/i,
];

export const WINDOW_ID =
  typeof window === "undefined" ? "server" : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let channel = null;
function getChannel() {
  if (typeof window === "undefined") return null;
  if (channel) return channel;
  try {
    if ("BroadcastChannel" in window) channel = new BroadcastChannel(CHANNEL);
  } catch {
    channel = null;
  }
  return channel;
}

/** Should this request tell other windows? (non-GET, business data only) */
export function isDataChange(method, url) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  const path = String(url || "").split("?")[0];
  return !IGNORE_URL.some((re) => re.test(path));
}

/** Called by apiRequest after a successful change. */
export function notifyDataChanged(method, url) {
  try {
    if (!isDataChange(method, url)) return;
    const msg = { from: WINDOW_ID, method: String(method).toUpperCase(), url: String(url).split("?")[0], at: Date.now() };
    const ch = getChannel();
    if (ch) ch.postMessage(msg);
    else window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(msg)); // fires "storage" in other tabs
  } catch {
    /* never break the request */
  }
}

/** Listen for changes made in other windows. Returns an unsubscribe function. */
export function onDataChanged(callback) {
  if (typeof window === "undefined") return () => {};
  const handle = (msg) => {
    if (!msg || msg.from === WINDOW_ID) return;
    callback(msg);
  };
  const ch = getChannel();
  const onMessage = (e) => handle(e.data);
  const onStorage = (e) => {
    if (e.key !== FALLBACK_KEY || !e.newValue) return;
    try {
      handle(JSON.parse(e.newValue));
    } catch {
      /* ignore */
    }
  };
  ch?.addEventListener("message", onMessage);
  window.addEventListener("storage", onStorage);
  return () => {
    ch?.removeEventListener("message", onMessage);
    window.removeEventListener("storage", onStorage);
  };
}
