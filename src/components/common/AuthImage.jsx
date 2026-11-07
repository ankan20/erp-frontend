"use client";

import { useEffect, useState } from "react";
import API_BASE_URL from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// <img> for uploaded files.
//  • API URLs (e.g. /auth/user-file/...) are fetched with the login token and
//    shown from a blob URL — a plain <img> can't send the Authorization header.
//  • Local previews (blob:/data:) and other URLs load directly; if a direct
//    load fails, it retries once with the token.
// Shows `fallback` when there is no src or the image can't be loaded.
export default function AuthImage({ src, alt = "", className = "", fallback = null }) {
  const isApi = !!src && src.startsWith(API_BASE_URL);

  const [blobUrl, setBlobUrl] = useState("");
  const [retrySrc, setRetrySrc] = useState(isApi ? src : "");
  const [failed, setFailed] = useState(false);

  // reset when the source changes (derived-state pattern)
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setBlobUrl("");
    setRetrySrc(isApi ? src : "");
    setFailed(false);
  }

  useEffect(() => {
    if (!retrySrc) return;
    if (retrySrc.startsWith("blob:") || retrySrc.startsWith("data:")) {
      setFailed(true);
      return;
    }
    let alive = true;
    let created = "";
    (async () => {
      try {
        const token = getLocalStorage("token");
        const res = await fetch(retrySrc, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error(`not an image (${blob.type})`);
        created = URL.createObjectURL(blob);
        if (alive) setBlobUrl(created);
      } catch (e) {
        console.warn("AuthImage: could not load", retrySrc, e?.message);
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [retrySrc]);

  if (!src || failed) return fallback;
  if (isApi && !blobUrl) return null; // loading

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl || src}
      alt={alt}
      className={className}
      onError={() => {
        if (!blobUrl && !retrySrc) setRetrySrc(src);
        else setFailed(true);
      }}
    />
  );
}
