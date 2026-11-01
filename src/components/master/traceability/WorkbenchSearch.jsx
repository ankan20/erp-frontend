"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History, Loader2, Search, X } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";
import { DOC_ICON, STAGE_STYLE, fmtDate, fmtQty, formatWorkflowStatus, statusClass } from "./wbUtils";

const RECENT_KEY = "traceability-workbench-recent";
const MAX_RECENT = 8;

export function rememberTrace(entry) {
  const list = (getLocalStorage(RECENT_KEY) || []).filter(
    (r) => !(r.docType === entry.docType && r.docId === entry.docId),
  );
  setLocalStorage(RECENT_KEY, [entry, ...list].slice(0, MAX_RECENT));
}

function ResultRow({ r, onPick, active }) {
  const Icon = DOC_ICON[r.docType === "INDENT_ITEM" ? "INDENT" : r.docType];
  const style = STAGE_STYLE[r.stage] || STAGE_STYLE.REQUISITION;
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(r)}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#f0f6ff] ${active ? "bg-[#f0f6ff]" : ""}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${style.dot}`}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#144664]">{r.docNo}</span>
          {r.docType === "INDENT_ITEM" && (
            <span className="truncate text-[12px] text-gray-700">
              {r.itemName || r.itemCode} · {fmtQty(r.qty)} {r.unit || ""}
            </span>
          )}
          <span className={`rounded border px-1.5 text-[10px] font-semibold ${statusClass(r.status)}`}>
            {formatWorkflowStatus(r.status)}
          </span>
        </span>
        <span className="block truncate text-[11px] text-gray-500">
          {fmtDate(r.date)} · {r.projectCode || "—"}
          {r.party ? ` · ${r.party}` : ""}
        </span>
      </span>
    </button>
  );
}

export default function WorkbenchSearch({ docTypes = [], projectCode, onPick }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [cursor, setCursor] = useState(0);
  const reqId = useRef(0);

  useEffect(() => setRecent(getLocalStorage(RECENT_KEY) || []), [open]);

  // debounced search; stale responses are ignored
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { q: term };
        if (type) params.type = type;
        if (projectCode) params.projectCode = projectCode;
        const res = await apiRequest({ url: API_ENDPOINTS.MASTER.TRACEABILITY.SEARCH, params });
        if (id === reqId.current) {
          setResults(res?.data || []);
          setCursor(0);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, type, projectCode]);

  const grouped = useMemo(() => {
    const g = {};
    for (const r of results) (g[r.typeLabel] ||= []).push(r);
    return Object.entries(g);
  }, [results]);
  const flat = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);

  const pick = (r) => {
    setOpen(false);
    setQ("");
    onPick(r);
  };

  const onKey = (e) => {
    if (!open || !flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const searchable = docTypes.filter((t) => t.searchable && !t.legacy);

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="h-[36px] shrink-0 rounded-l-sm border border-r-0 border-[#6f7f8f] bg-[#d6e6f2] px-2 text-[13px] font-medium outline-none"
        aria-label="Document type"
      >
        <option value="">All documents</option>
        <option value="INDENT_ITEM">Item (indent lines)</option>
        {searchable.map((t) => (
          <option key={t.docType} value={t.docType}>
            {t.label}
          </option>
        ))}
      </select>
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder="Document number (IND, ORD, GRN, SRN, BRR, PB…) or item code / name"
          className="h-[36px] w-full rounded-r-sm border border-[#6f7f8f] bg-white pl-8 pr-8 text-[13px] outline-none focus:border-[#2f6f9f]"
          aria-label="Search documents"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 h-4 w-4 animate-spin text-gray-400" />
        ) : q ? (
          <button type="button" onClick={() => setQ("")} className="absolute right-2 text-gray-400 hover:text-gray-600" aria-label="Clear">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[40px] z-40 max-h-[60vh] overflow-y-auto rounded-md border border-[#b5c7d8] bg-white shadow-xl">
          {q.trim().length < 2 ? (
            recent.length ? (
              <div>
                <div className="flex items-center gap-1.5 border-b bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <History className="h-3 w-3" /> Recent traces
                </div>
                {recent.map((r) => (
                  <ResultRow key={`${r.docType}:${r.docId}`} r={r} onPick={pick} />
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-gray-500">
                Type at least 2 characters of a document number, item code or item name.
              </div>
            )
          ) : loading && !results.length ? (
            <div className="px-3 py-3 text-[12px] text-gray-500">Searching…</div>
          ) : !results.length ? (
            <div className="px-3 py-3 text-[12px] text-gray-500">No documents you can access match “{q.trim()}”.</div>
          ) : (
            grouped.map(([label, list]) => (
              <div key={label}>
                <div className="sticky top-0 border-b bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </div>
                {list.map((r) => (
                  <ResultRow key={`${r.docType}:${r.docId}`} r={r} onPick={pick} active={flat[cursor] === r} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
