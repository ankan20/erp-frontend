"use client";

import { useEffect, useState } from "react";
import { getLocalStorage } from "@/lib/localStorage";

// <img> for uploaded files. Tries the URL directly first; if the media server
// needs a login (plain <img> can't send the token), it re-fetches the file with
// the Authorization header and shows it from a blob URL. Same idea as
// lib/fileViewer.js → openFileWithAuth.
export default function AuthImage({ src, alt = "", className = "", fallback = null, onFail }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const [failed, setFailed] = useState(false);

  // reset when the source changes (derived-state pattern, no effect needed)
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setBlobUrl("");
    setFailedSrc("");
    setFailed(false);
  }

  // Direct load failed → retry with the token
  useEffect(() => {
    if (!failedSrc || failedSrc.startsWith("blob:") || failedSrc.startsWith("data:")) {
      if (failedSrc) {
        setFailed(true);
        onFail?.();
      }
      return;
    }
    let alive = true;
    let created = "";
    (async () => {
      try {
        const token = getLocalStorage("token");
        const res = await fetch(failedSrc, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error("not an image");
        created = URL.createObjectURL(blob);
        if (alive) setBlobUrl(created);
      } catch (e) {
        console.warn("AuthImage: could not load", failedSrc, e?.message);
        if (alive) {
          setFailed(true);
          onFail?.();
        }
      }
    })();
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [failedSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src || failed) return fallback;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl || src}
      alt={alt}
      className={className}
      onError={() => {
        if (!blobUrl) setFailedSrc(src);
        else {
          setFailed(true);
          onFail?.();
        }
      }}
    />
  );
}
