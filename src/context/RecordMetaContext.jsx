"use client";

/**
 * RecordMetaContext — shows created/updated audit info on every detail page.
 *
 * How it works without touching each page:
 * 1. apiClient.js fires a custom window event "erp:recordmeta" whenever a
 *    single-record GET response contains any of createdAt/updatedAt/createdBy/updatedBy.
 * 2. The Provider listens and stores that payload in state.
 * 3. It clears state when the pathname changes via a second custom event.
 * 4. RecordMeta badge (fixed bottom-right) reads from this context.
 */

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const Ctx = createContext(null);

export function RecordMetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const pathname = usePathname();

  // All setState calls go through the event listener (callbacks) to satisfy
  // the react-hooks/set-state-in-effect lint rule which disallows direct calls.
  useEffect(() => {
    function onSet(e) {
      setMeta(e.detail || null);
    }
    function onClear() {
      setMeta(null);
    }
    window.addEventListener("erp:recordmeta", onSet);
    window.addEventListener("erp:clearrecordmeta", onClear);
    return () => {
      window.removeEventListener("erp:recordmeta", onSet);
      window.removeEventListener("erp:clearrecordmeta", onClear);
    };
  }, []);

  // Clear when navigating — dispatch the clear event (not setState directly)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("erp:clearrecordmeta"));
  }, [pathname]);

  return <Ctx.Provider value={meta}>{children}</Ctx.Provider>;
}

export function useRecordMeta() {
  return useContext(Ctx);
}

/**
 * Optional manual override — call in a page if the automatic detection
 * misses the data (e.g. a form that doesn't go through apiClient).
 * Pass null to clear.
 */
export function useSetRecordMeta(data) {
  useEffect(() => {
    if (!data) return;
    const { createdAt, updatedAt, createdBy, updatedBy } = data;
    if (createdAt || updatedAt || createdBy || updatedBy) {
      window.dispatchEvent(
        new CustomEvent("erp:recordmeta", {
          detail: { createdAt, updatedAt, createdBy, updatedBy },
        })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);
}
