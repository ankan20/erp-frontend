"use client";

import { useEffect, useState } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import PageNotAvailable from "./PageNotAvailable";
import { EdoxSplash } from "./EdoxLoader";

const SPLASH_KEY = "edox:splashShown"; // once per browser tab session (i.e. right after login)
const SPLASH_MS = 2300;                // long enough for the logo intro to finish
const LEAVE_MS = 450;                  // fade-out

function readSplashSeen() {
  try { return sessionStorage.getItem(SPLASH_KEY) === "1"; } catch { return true; }
}

export default function ProtectedLayoutAuth({ children }) {
  const { loading, authorized } = useAuthGuard();

  // "show" → "leave" (fading) → "done". The app renders underneath the whole
  // time, so the splash never delays data loading — it only covers it.
  const [phase, setPhase] = useState(() =>
    typeof window === "undefined" || readSplashSeen() ? "done" : "show"
  );

  useEffect(() => {
    if (phase !== "show" || loading || !authorized) return;
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    const t1 = setTimeout(() => setPhase("leave"), SPLASH_MS);
    const t2 = setTimeout(() => setPhase("done"), SPLASH_MS + LEAVE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, loading, authorized]);

  if (loading) return <EdoxSplash />;

  if (!authorized) return <PageNotAvailable />;

  return (
    <>
      {children}
      {phase !== "done" && <EdoxSplash leaving={phase === "leave"} />}
    </>
  );
}
