"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, History, Loader2, Search, Sparkles, X } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage, setLocalStorage } from "@/lib/localStorage";
import DocIcon from "./DocIcon";
import { STAGE_STYLE, fmtDate, fmtQty, formatWorkflowStatus, statusClass } from "./wbUtils";

const RECENT_KEY = "traceability-workbench-recent";
const MAX_RECENT = 8;
const CACHE_MS = 60_000; // reuse a response for a minute (backspacing, reopening the list)
const DEBOUNCE_MS = 250;

// "@" shortcuts → document type filter. "@all" clears the filter.
const ALIASES = {
  "": ["all"],
  INDENT_ITEM: ["item", "items"],
  INDENT: ["indent", "ind"],
  ORDER: ["order", "ord", "po", "mo"],
  PW_ORDER: ["service", "so", "wo"],
  GRN: ["grn"],
  SRN: ["srn"],
  GIN: ["gin"],
  DC: ["dc", "challan"],
  BRR: ["brr", "bill"],
  BRB: ["brb", "reconcile"],
  PURCHASE_BILL: ["pb", "purchase"],
  BILL_PAYMENT: ["payment", "pay", "bpr"],
};

// keep the 40 most recent responses
function trimCache(map) {
  const keys = Object.keys(map);
  if (keys.length <= 40) return map;
  keys.sort((a, b) => map[a].at - map[b].at);
  const out = { ...map };
  keys.slice(0, keys.length - 40).forEach((k) => delete out[k]);
  return out;
}

export function rememberTrace(entry) {
  const list = (getLocalStorage(RECENT_KEY) || []).filter(
    (r) => !(r.docType === entry.docType && r.docId === entry.docId),
  );
  setLocalStorage(RECENT_KEY, [entry, ...list].slice(0, MAX_RECENT));
}

/** Parse "@grn 7200" → { typeToken: "grn", rest: "7200", complete: true }. */
function parseAt(text) {
  const m = text.match(/^@(\S*)(\s+(.*))?$/);
  if (!m) return null;
  return { typeToken: m[1].toLowerCase(), rest: (m[3] || "").trimStart(), complete: m[2] !== undefined };
}

function resolveAlias(token, options) {
  if (!token) return null;
  for (const o of options) if (o.aliases.includes(token)) return o;
  return null;
}

function Highlight({ text, term }) {
  if (!text) return null;
  const s = String(text);
  if (!term) return s;
  const i = s.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return s;
  return (
    <>
      {s.slice(0, i)}
      <mark className="rounded-sm bg-yellow-200 px-0 text-inherit">{s.slice(i, i + term.length)}</mark>
      {s.slice(i + term.length)}
    </>
  );
}

function ResultRow({ r, onPick, active, term, setRef }) {
  const style = STAGE_STYLE[r.stage] || STAGE_STYLE.REQUISITION;
  return (
    <button
      ref={setRef}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(r)}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#f0f6ff] ${active ? "bg-[#e3eeff]" : ""}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${style.dot}`}>
        <DocIcon docType={r.docType === "INDENT_ITEM" ? "INDENT" : r.docType} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#144664]">
            <Highlight text={r.docNo} term={term} />
          </span>
          {r.docType === "INDENT_ITEM" && (
            <span className="truncate text-[12px] text-gray-700">
              <Highlight text={r.itemName || r.itemCode} term={term} /> · {fmtQty(r.qty)} {r.unit || ""}
              {r.itemName && r.itemCode && (
                <span className="ml-1 text-[11px] text-gray-500">
                  (<Highlight text={r.itemCode} term={term} />)
                </span>
              )}
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

function GroupHeader({ icon: Icon, children }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </div>
  );
}

export default function WorkbenchSearch({ docTypes = [], projectCode, onPick, onStateChange }) {
  const [text, setText] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  // key "(term)|(type)|(project)" → { at, data }; results are derived from it
  const [responses, setResponses] = useState({});
  const [recent, setRecent] = useState([]);
  const [cursor, setCursor] = useState(0);
  const inFlight = useRef(new Set());
  const inputRef = useRef(null);
  const rowRefs = useRef([]);

  const typeOptions = useMemo(() => {
    const list = [
      { value: "", label: "All documents", aliases: ALIASES[""] },
      { value: "INDENT_ITEM", label: "Item (indent lines)", aliases: ALIASES.INDENT_ITEM },
      ...docTypes
        .filter((t) => t.searchable && !t.legacy)
        .map((t) => ({ value: t.docType, label: t.label, aliases: ALIASES[t.docType] || [t.docType.toLowerCase()] })),
    ];
    return list;
  }, [docTypes]);
  const typeLabel = typeOptions.find((o) => o.value === type)?.label || "All documents";

  // "@" handling: "@" alone → type picker; "@grn " → set the type and keep typing
  const at = parseAt(text);
  const showTypePicker = !!at;
  const onText = (value) => {
    const p = parseAt(value);
    const match = p?.complete ? resolveAlias(p.typeToken, typeOptions) : null;
    if (match) {
      setType(match.value);
      setText(p.rest);
    } else {
      setText(value);
    }
    setCursor(0);
    setOpen(true);
  };
  const atToken = at?.typeToken ?? null;
  const pickerOptions = useMemo(
    () =>
      atToken === null
        ? []
        : typeOptions.filter(
            (o) => !atToken || o.aliases.some((a) => a.startsWith(atToken)) || o.label.toLowerCase().includes(atToken),
          ),
    [atToken, typeOptions],
  );

  const term = showTypePicker ? "" : text.trim();

  // Suggestions (empty term) or matches for the current (term, type, project).
  // Each key is fetched once per CACHE_MS; replies are stored by key, so a late
  // reply for an old term can never overwrite what is on screen.
  const key = `${term.toLowerCase()}|${type}|${projectCode || ""}`;
  const entry = responses[key];
  const results = useMemo(() => entry?.data || [], [entry]);
  const loading = open && !showTypePicker && !entry;

  useEffect(() => {
    if (!open || showTypePicker || inFlight.current.has(key)) return;
    if (entry && Date.now() - entry.at < CACHE_MS) return;
    const t = setTimeout(async () => {
      inFlight.current.add(key);
      try {
        const params = { q: term };
        if (type) params.type = type;
        if (projectCode) params.projectCode = projectCode;
        const res = await apiRequest({ url: API_ENDPOINTS.MASTER.TRACEABILITY.SEARCH, params });
        setResponses((prev) => trimCache({ ...prev, [key]: { at: Date.now(), data: res?.data || [] } }));
      } catch {
        setResponses((prev) => trimCache({ ...prev, [key]: { at: Date.now(), data: [] } }));
      } finally {
        inFlight.current.delete(key);
      }
    }, term ? DEBOUNCE_MS : 0);
    return () => clearTimeout(t);
  }, [open, showTypePicker, key, entry, term, type, projectCode]);

  // recent traces matching the current type / term (shown above suggestions)
  const recentShown = useMemo(() => {
    if (showTypePicker) return [];
    const t = term.toLowerCase();
    // only types the Workbench still traces (older saved entries may hold removed types)
    const known = new Set(typeOptions.map((o) => o.value).filter(Boolean));
    return recent
      .filter((r) => known.has(r.docType))
      .filter((r) => !type || r.docType === type)
      .filter((r) => !t || [r.docNo, r.itemName, r.itemCode].some((v) => String(v || "").toLowerCase().includes(t)))
      .slice(0, term ? 3 : 5);
  }, [recent, type, term, showTypePicker, typeOptions]);

  const grouped = useMemo(() => {
    const g = new Map();
    for (const r of results) {
      const label = r.typeLabel;
      if (!g.has(label)) g.set(label, []);
      g.get(label).push(r);
    }
    return [...g.entries()];
  }, [results]);

  // flat list for keyboard navigation, in display order
  const flat = useMemo(() => {
    if (showTypePicker) return pickerOptions.map((o) => ({ kind: "type", o }));
    return [
      ...recentShown.map((r) => ({ kind: "doc", r })),
      ...grouped.flatMap(([, list]) => list.map((r) => ({ kind: "doc", r }))),
    ];
  }, [showTypePicker, pickerOptions, recentShown, grouped]);

  useEffect(() => {
    rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const openList = () => {
    setRecent(getLocalStorage(RECENT_KEY) || []);
    setOpen(true);
  };

  const pickType = (value) => {
    setType(value);
    setText("");
    setCursor(0);
    inputRef.current?.focus();
  };
  const pickDoc = (r) => {
    setOpen(false);
    setText("");
    onPick(r);
  };
  const choose = (entry) => (entry.kind === "type" ? pickType(entry.o.value) : pickDoc(entry.r));

  const onKey = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") openList();
      return;
    }
    if (!flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[Math.min(cursor, flat.length - 1)]);
    }
  };

  // tell the page (Smart Guide) what the user is doing in the search box
  useEffect(() => {
    onStateChange?.({
      text,
      term,
      type,
      typeLabel,
      open,
      picker: showTypePicker,
      loading,
      results: results.length,
      recent: recentShown.length,
    });
  }, [onStateChange, text, term, type, typeLabel, open, showTypePicker, loading, results.length, recentShown.length]);

  let idx = -1;
  const nextIdx = () => ++idx;
  const scope = `${type ? typeLabel : "documents"}${projectCode ? ` in ${projectCode}` : ""}`;

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          setCursor(0);
          openList();
          inputRef.current?.focus();
        }}
        className="h-[36px] shrink-0 rounded-l-sm border border-r-0 border-[#6f7f8f] bg-[#d6e6f2] px-2 text-[13px] font-medium outline-none"
        aria-label="Document type"
        data-guide="search-type"
      >
        {typeOptions.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onFocus={openList}
          onClick={openList}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder="Number (e.g. 350012, 44017, 720005, DC440003) or item code / name  ·  type @ to pick a type"
          className="h-[36px] w-full rounded-r-sm border border-[#6f7f8f] bg-white pl-8 pr-8 text-[13px] outline-none focus:border-[#2f6f9f]"
          aria-label="Search documents"
          data-guide="search-input"
          aria-expanded={open}
          role="combobox"
          aria-controls="wb-search-list"
          aria-autocomplete="list"
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 h-4 w-4 animate-spin text-gray-400" />
        ) : text ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onText("")}
            className="absolute right-2 text-gray-400 hover:text-gray-600"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && (
        <div
          id="wb-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-[40px] z-40 max-h-[60vh] overflow-y-auto rounded-md border border-[#b5c7d8] bg-white shadow-xl"
        >
          {showTypePicker ? (
            <>
              <GroupHeader icon={AtSign}>Search in…</GroupHeader>
              {pickerOptions.length ? (
                pickerOptions.map((o) => {
                  const i = nextIdx();
                  return (
                    <button
                      key={o.value || "all"}
                      ref={(el) => (rowRefs.current[i] = el)}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickType(o.value)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#f0f6ff] ${cursor === i ? "bg-[#e3eeff]" : ""}`}
                    >
                      <span className="w-[160px] font-medium text-[#144664]">{o.label}</span>
                      <span className="text-[11px] text-gray-500">{o.aliases.map((a) => `@${a}`).join("  ")}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-3 text-[12px] text-gray-500">No document type matches “@{atToken}”.</div>
              )}
            </>
          ) : (
            <>
              {recentShown.length > 0 && (
                <div>
                  <GroupHeader icon={History}>Recent traces</GroupHeader>
                  {recentShown.map((r) => {
                    const i = nextIdx();
                    return (
                      <ResultRow
                        key={`recent:${r.docType}:${r.docId}`}
                        r={r}
                        term={term}
                        onPick={pickDoc}
                        active={cursor === i}
                        setRef={(el) => (rowRefs.current[i] = el)}
                      />
                    );
                  })}
                </div>
              )}

              {loading && !results.length ? (
                <div className="space-y-1.5 p-3" aria-busy="true">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="h-8 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : !results.length ? (
                <div className="px-3 py-3 text-[12px] text-gray-500">
                  {term ? `No ${scope} you can access match “${term}”.` : `No ${scope} you can access yet.`}
                </div>
              ) : (
                grouped.map(([label, list]) => (
                  <Fragment key={label}>
                    <GroupHeader icon={term ? null : Sparkles}>
                      {term ? label : `Latest ${label}`}
                      <span className="ml-auto font-normal normal-case tracking-normal text-gray-400">{list.length}</span>
                    </GroupHeader>
                    {list.map((r) => {
                      const i = nextIdx();
                      return (
                        <ResultRow
                          key={`${r.docType}:${r.docId}`}
                          r={r}
                          term={term}
                          onPick={pickDoc}
                          active={cursor === i}
                          setRef={(el) => (rowRefs.current[i] = el)}
                        />
                      );
                    })}
                  </Fragment>
                ))
              )}
              {!term && (
                <div className="border-t bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500">
                  Showing the newest {scope}. Type to search, or <b>@</b> to choose a type (e.g. <b>@grn 7200</b>).
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
