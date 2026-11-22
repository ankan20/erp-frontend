"use client";

import { useEffect } from "react";

// App-wide helper for every <input type="date">: when the box is empty and the
// user starts typing, it is first filled with today's date, so the YEAR is
// already the current year. The digit the user types then overwrites the
// day / month segment as normal, and the year can still be changed.
//
// - Only acts on a completely empty box (not on a half-typed one).
// - Skips read-only / disabled boxes, and any box with data-no-year-autofill.
// - Respects min / max: if today is outside them, the nearest allowed date is used.
// - Picking from the calendar is untouched (it already opens on today).
//
// Works with plain inputs, React-controlled inputs and react-hook-form,
// because it fires the same input/change events as typing.

const pad = (n) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const valueSetter = typeof window !== "undefined"
  ? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
  : null;

function prefill(el) {
  let v = todayIso();
  if (el.min && v < el.min) v = el.min;
  if (el.max && v > el.max) v = el.max;
  if (valueSetter) valueSetter.call(el, v); else el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function DateYearAutofill() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type !== "date") return;
      if (el.readOnly || el.disabled || el.hasAttribute("data-no-year-autofill")) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[0-9]$/.test(e.key)) return;
      // empty, and not half-typed (a half-typed box also has value "" but badInput)
      if (el.value !== "" || el.validity?.badInput) return;
      prefill(el);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
