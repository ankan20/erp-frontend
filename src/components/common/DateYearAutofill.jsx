"use client";

import { useEffect } from "react";

// App-wide helper for every <input type="date"> and <input type="datetime-local">.
//
// 1. Placeholder: an EMPTY box shows the current year instead of "yyyy"
//    (e.g. "dd/mm/2026"). The browser's date box can't hold a partial date, so
//    the native "yyyy" text is made transparent and a small label with the year
//    is drawn on top of it. The box's value stays empty until the user enters a
//    date, exactly like a placeholder. (Chrome / Edge / Safari only; other
//    browsers keep the native "yyyy".)
//
// 2. Typing: when the box is empty and the user starts typing, it is first
//    filled with today's date, so the year really is the current year. The
//    digit typed then overwrites the day / month segment as normal, and the year
//    can still be changed.
//
// - Skips read-only / disabled boxes, and any box with data-no-year-autofill.
// - Respects min / max: if today is outside them, the nearest allowed value is used.
// - Picking from the calendar is untouched (it already opens on today).
// - Works with plain inputs, React-controlled inputs and react-hook-form.

const DATE_TYPES = new Set(["date", "datetime-local"]);
const SELECTOR = 'input[type="date"], input[type="datetime-local"]';
const ATTR = "data-year-ph";
// Chrome draws each date segment (dd, mm, yyyy) with 1px padding on both sides.
const FIELD_PAD = 5;

const pad = (n) => String(n).padStart(2, "0");
const nowValue = (type) => {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return type === "datetime-local" ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

const isDateInput = (el) => el instanceof HTMLInputElement && DATE_TYPES.has(el.type);
const isEditable = (el) => !el.readOnly && !el.disabled && !el.hasAttribute("data-no-year-autofill");

// ── Typing prefill ──────────────────────────────────────────────────────────

let nativeValueSetter = null;

function prefill(el) {
  let v = nowValue(el.type);
  if (el.min && v < el.min) v = el.min;
  if (el.max && v > el.max) v = el.max;
  if (nativeValueSetter) nativeValueSetter.call(el, v); else el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// ── Year placeholder ────────────────────────────────────────────────────────

const STYLE = `
input[${ATTR}]::-webkit-datetime-edit-year-field { color: transparent; }
.date-year-ph {
  position: absolute; left: 0; top: 0; margin: 0; padding: 0; border: 0;
  pointer-events: none; user-select: none; white-space: pre; line-height: normal;
  background: transparent;
}
`;

// Text the browser shows before the year, e.g. "dd/mm/" (en-GB) or "mm/dd/" (en-US).
function yearPrefix() {
  try {
    const parts = new Intl.DateTimeFormat(navigator.language, {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).formatToParts(new Date(2000, 0, 1));
    let s = "";
    for (const p of parts) {
      if (p.type === "year") return s;
      s += p.type === "day" ? "dd" : p.type === "month" ? "mm" : p.value;
    }
  } catch { /* fall through */ }
  return "dd/mm/";
}

let canvasCtx = null;
function textWidth(text, cs) {
  if (!canvasCtx) canvasCtx = document.createElement("canvas").getContext("2d");
  canvasCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return canvasCtx.measureText(text).width;
}

export default function DateYearAutofill() {
  useEffect(() => {
    nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

    // ── 1. typing prefill ──
    const onKeyDown = (e) => {
      const el = e.target;
      if (!isDateInput(el) || !isEditable(el)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[0-9]$/.test(e.key)) return;
      // empty, and not half-typed (a half-typed box also has value "" but badInput)
      if (el.value !== "" || el.validity?.badInput) return;
      prefill(el);
    };
    document.addEventListener("keydown", onKeyDown, true);

    // ── 2. year placeholder ──
    const supported = typeof CSS !== "undefined"
      && CSS.supports?.("selector(::-webkit-datetime-edit-year-field)");
    if (!supported) {
      return () => document.removeEventListener("keydown", onKeyDown, true);
    }

    const styleEl = document.createElement("style");
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    const year = String(new Date().getFullYear());
    const prefix = yearPrefix();
    const labels = new Map(); // input -> label span

    const removeLabel = (el) => {
      labels.get(el)?.remove();
      labels.delete(el);
      el.removeAttribute(ATTR);
    };

    const sync = (el) => {
      const show = el.isConnected && isEditable(el) && el.value === ""
        && !el.validity?.badInput && el.getClientRects().length > 0;
      if (!show) { removeLabel(el); return; }

      let span = labels.get(el);
      if (!span || span.previousSibling !== el) {
        span?.remove();
        span = document.createElement("span");
        span.className = "date-year-ph";
        span.setAttribute("aria-hidden", "true");
        span.textContent = year;
        el.after(span);
        labels.set(el, span);
      }
      el.setAttribute(ATTR, "");

      const cs = getComputedStyle(el);
      span.style.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      span.style.color = cs.color;
      span.style.left = "0px";
      span.style.top = "0px";
      const base = span.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
        + textWidth(prefix, cs) + FIELD_PAD;
      const y = r.top + (r.height - base.height) / 2;
      span.style.left = `${x - base.left}px`;
      span.style.top = `${y - base.top}px`;
    };

    let raf = 0;
    const syncAll = () => {
      raf = 0;
      for (const el of [...labels.keys()]) if (!el.isConnected) removeLabel(el);
      document.querySelectorAll(SELECTOR).forEach(sync);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(syncAll); };

    // React / react-hook-form set .value directly (no event), e.g. on reset()
    // while loading a saved record — catch that so the label never covers a real year.
    const proto = HTMLInputElement.prototype;
    const valueDesc = Object.getOwnPropertyDescriptor(proto, "value");
    Object.defineProperty(proto, "value", {
      ...valueDesc,
      set(v) {
        valueDesc.set.call(this, v);
        if (DATE_TYPES.has(this.type)) schedule();
      },
    });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["class", "style", "type", "value", "disabled", "readonly", "hidden", "open"],
    });
    const events = ["input", "change", "focusin", "focusout", "reset", "transitionend", "animationend"];
    events.forEach((ev) => document.addEventListener(ev, schedule, true));
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    const timer = setInterval(schedule, 1000); // safety net for anything missed
    schedule();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      events.forEach((ev) => document.removeEventListener(ev, schedule, true));
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      ro.disconnect();
      clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      Object.defineProperty(proto, "value", valueDesc);
      for (const el of [...labels.keys()]) removeLabel(el);
      styleEl.remove();
    };
  }, []);

  return null;
}
