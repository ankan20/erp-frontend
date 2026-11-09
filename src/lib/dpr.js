// Daily Progress Report helpers shared by the list, day and print pages.

import { useSyncExternalStore } from "react";
import { getLocalStorage } from "@/lib/localStorage";

export const DPR_BASE = "/project-management/planning/dpr";

/** Today in India time as YYYY-MM-DD (site days follow IST). */
export const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

/** YYYY-MM-DD ± n days. */
export const shiftDay = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isValidDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day || "") && !isNaN(new Date(`${day}T00:00:00Z`));

/** "Sat, 08 Nov 2026" */
export const longDay = (day) =>
  isValidDay(day)
    ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
        weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
      })
    : day || "";

/** "2026-11-08 14:05:00" → "14:05" */
export const timeOf = (s) => (s ? String(s).slice(11, 16) : "");

export const SEVERITY_STYLE = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
};

export const STATUS_STYLE = (s = "") =>
  s === "Approved"
    ? "bg-green-100 text-green-700"
    : s.startsWith("Pending")
      ? "bg-amber-100 text-amber-800"
      : s === "Rejected"
        ? "bg-red-100 text-red-700"
        : s === "Reback"
          ? "bg-orange-100 text-orange-700"
          : "bg-gray-100 text-gray-700";

/**
 * Shrink only very large photos before upload. Normal phone photos go as they
 * are, so the server can read their EXIF date and GPS (shrinking drops EXIF).
 */
export const shrinkImage = (file, maxEdge = 2400, quality = 0.88) =>
  new Promise((resolve) => {
    if (!file.type?.startsWith("image/") || file.size < 20 * 1024 * 1024) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });


const noSubscribe = () => () => {};
/** Current project code from local storage ("" on the server), hydration-safe. */
export const useProjectCode = () =>
  useSyncExternalStore(noSubscribe, () => getLocalStorage("projectInfo")?.projectCode || "", () => "");
