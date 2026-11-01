// Lets an active call survive a page reload. On the way out the call window
// saves itself here (sessionStorage = this tab only); on the next load the
// comm context picks it up and rejoins if it's recent enough.
const KEY = "commCallResume";
export const RESUME_WINDOW_MS = 18000;   // a bit under the server's 20s "away" grace

export function saveCallResume(call, followState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ call, followState, at: Date.now() }));
  } catch {}
}

export function clearCallResume() {
  try { sessionStorage.removeItem(KEY); } catch {}
}

// Returns { call, followState } once, if saved within RESUME_WINDOW_MS
export function takeCallResume() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.call?.callId || Date.now() - saved.at > RESUME_WINDOW_MS) return null;
    return saved;
  } catch {
    return null;
  }
}
