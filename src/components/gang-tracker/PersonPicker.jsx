"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initials, personColor } from "./shared";

/**
 * Type-ahead over every registered gang contact. Typing a name that is not there yet
 * offers "Add as new contact" — the backend registers it on save, so next time it is
 * in this list.
 *
 * value: null | { id, name } (existing) | { name, isNew: true }
 */
export default function PersonPicker({ people = [], value, onChange, placeholder = "Type a name…", autoFocus = false }) {
  const [text, setText] = useState(value?.name || "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);

  // keep the box in sync when the parent changes the value (adjust-during-render, no effect)
  const valueKey = `${value?.id ?? ""}|${value?.name ?? ""}`;
  const [syncedKey, setSyncedKey] = useState(valueKey);
  if (syncedKey !== valueKey) {
    setSyncedKey(valueKey);
    setText(value?.name || "");
  }

  useEffect(() => {
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const q = text.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q
      ? people.filter((p) => p.name.toLowerCase().includes(q) || (p.mobile || "").includes(q))
      : people;
    return list.slice(0, 8);
  }, [people, q]);
  const exact = people.find((p) => p.name.toLowerCase() === q);
  const options = [...matches.map((p) => ({ ...p })), ...(q && !exact ? [{ name: text.trim().replace(/\s+/g, " "), isNew: true }] : [])];

  function pick(opt) {
    setText(opt?.name || "");
    setOpen(false);
    onChange(opt ? (opt.isNew ? { name: opt.name, isNew: true } : { id: opt.id, name: opt.name }) : null);
  }

  // leaving the field keeps what was typed: an existing name links, a new one is registered on save
  function commitTyped() {
    if (!q) return value && onChange(null);
    if (exact) return value?.id !== exact.id && onChange({ id: exact.id, name: exact.name });
    if (!value || value.name !== text.trim()) onChange({ name: text.trim().replace(/\s+/g, " "), isNew: true });
  }

  function onKey(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); options[hi] && pick(options[hi]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {value?.id && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
            style={{ background: personColor(value.id) }}>{initials(value.name)}</span>
        )}
        <input
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={commitTyped}
          onKeyDown={onKey}
          placeholder={placeholder}
          className={`border border-gray-300 rounded-lg py-2 text-xs w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${value?.id ? "pl-9" : "pl-3"} ${value ? "pr-14" : "pr-3"}`}
        />
        {value?.isNew && <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">NEW</span>}
        {value && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 text-xs" title="Clear">✕</button>
        )}
      </div>

      {open && options.length > 0 && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
          {options.map((o, i) => (
            <button type="button" key={o.isNew ? "__new" : o.id}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} onMouseEnter={() => setHi(i)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs ${i === hi ? "bg-blue-50" : ""}`}>
              {o.isNew ? (
                <>
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">+</span>
                  <span>Add <b>“{o.name}”</b> as new contact</span>
                </>
              ) : (
                <>
                  <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                    style={{ background: personColor(o.id) }}>{initials(o.name)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800">{o.name}</span>
                    <span className="text-gray-400"> {[o.skill, o.mobile].filter(Boolean).join(" · ")}</span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// API payload for a picked person: existing → {id}, new → {name}
export const personPayload = (p) => (!p ? null : p.id ? { id: p.id } : { name: p.name });
