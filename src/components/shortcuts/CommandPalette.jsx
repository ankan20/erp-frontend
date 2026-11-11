"use client";

// Search / command box (Ctrl+K).
//
//   indent              → pages whose name matches
//   new indent          → start a new entry
//   IN01 / IN02         → T-code (list / new)
//   sharma              → vendors / ledgers, items and documents that match
//   /v sharma           → only vendors / ledgers   → Enter opens the 360 view
//   /v sharma > ledger  → …and lands on the Ledger tab
//   /i cement           → only items        (also /a asset, /p project,
//                         /b bank, /cc cost centre, /e employee)
//   /o PO-0042          → only one document type (see DOC_PREFIXES)
//
// Pages come from the same permission rules as the sidebar. Masters and
// documents are searched by the backend, which checks project and module
// access again.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Boxes,
  Building2,
  FileText,
  FolderKanban,
  Hash,
  Keyboard,
  Landmark,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Tags,
  Truck,
  UserRound,
} from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { DOC_PREFIXES, MASTER_PREFIXES, deepSearchRoute } from "@/config/shortcuts.config";
import { docRoute, fmtDate } from "@/components/master/traceability/wbUtils";
import { getShortcutPages, resolveTcodeForUser } from "@/lib/shortcuts";
import Kbd from "./Kbd";

const MIN_QUERY = 2;
const NEW_WORDS = ["new", "create", "add"];
const MAX_PAGE_ROWS = 8;
const MAX_NEW_ROWS = 5;
const MASTERS_IN_MIXED_SEARCH = 3; // of each record type, when no prefix is typed
const MIXED_KINDS = MASTER_PREFIXES.filter((p) => p.mixed).map((p) => p.kind);

// What the typed text means:
//   "cement"            → { mode: "all",    term }
//   "/v sharma > bills" → { mode: "master", master, term, tab }
//   "/o PO-12"          → { mode: "doc",    doc, term }
//   "/" or "/zz"        → { mode: "help",   typedPrefix }
function parseQuery(raw) {
  const text = raw.trim();
  if (!text.startsWith("/")) return { mode: "all", term: text };
  const m = /^\/([a-z]+)(?:\s+(.*))?$/i.exec(text);
  const typedPrefix = m ? m[1].toLowerCase() : "";
  const rest = m ? (m[2] || "").trim() : "";

  const master = MASTER_PREFIXES.find((p) => p.prefix === typedPrefix);
  if (master) {
    const [term, tab] = rest.split(">").map((s) => s.trim());
    return { mode: "master", master, term: term || "", tab: tab || "" };
  }
  const doc = DOC_PREFIXES.find((p) => p.prefix === typedPrefix);
  if (doc) return { mode: "doc", doc, term: rest };
  return { mode: "help", typedPrefix };
}

const searchMasters = (kind, q, limit) =>
  apiRequest({ url: API_ENDPOINTS.DEEP_SEARCH.QUICK, params: { type: kind, q, limit } }).then((r) => r?.data || []);

const searchDocs = (q, type) =>
  apiRequest({ url: API_ENDPOINTS.MASTER.TRACEABILITY.SEARCH, params: type ? { q, type } : { q } }).then((r) =>
    (r?.data || []).filter((d) => d.docType !== "INDENT_ITEM" && docRoute(d.docType, d.docId, d)),
  );

export default function CommandPalette({ open, onClose, onHelp }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex max-h-[76vh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        data-sync-ignore
      >
        <DialogTitle className="sr-only">Search pages, records and documents</DialogTitle>
        {/* mounted only while open, so it starts empty every time */}
        <PaletteBody onClose={onClose} onHelp={onHelp} />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({ onClose, onHelp }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [found, setFound] = useState({ key: "", masters: [], docs: [], error: "" });
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // permissions can change after login, so read the pages each time it opens
  const pages = useMemo(() => getShortcutPages(), []);
  const parsed = useMemo(() => parseQuery(query), [query]);

  // ── backend search (debounced) ─────────────────────────────────────────────
  const { mode, term = "" } = parsed;
  const scope = mode === "master" ? parsed.master.kind : mode === "doc" ? parsed.doc.type : "";
  const searchKey = mode !== "help" && term.length >= MIN_QUERY ? `${mode}|${scope}|${term}` : "";

  useEffect(() => {
    if (!searchKey) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      // each search is independent: one failing does not hide the others
      const jobs =
        mode === "master"
          ? [searchMasters(scope, term, 10)]
          : mode === "doc"
            ? [Promise.resolve([]), searchDocs(term, scope)]
            : [
                Promise.all(MIXED_KINDS.map((kind) => searchMasters(kind, term, MASTERS_IN_MIXED_SEARCH))).then(
                  (lists) => lists.flat(),
                ),
                searchDocs(term),
              ];
      const [masters, docs] = await Promise.allSettled(jobs);
      if (cancelled) return;
      const failed = [masters, docs].find((r) => r && r.status === "rejected");
      setFound({
        key: searchKey,
        masters: masters?.status === "fulfilled" ? masters.value : [],
        docs: docs?.status === "fulfilled" ? docs.value : [],
        error: failed ? failed.reason?.message || "Search is not available" : "",
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchKey, mode, scope, term]);

  // ── rows ───────────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const out = [];
    if (mode === "help") return out;

    if (mode === "all") {
      const text = term.toLowerCase();
      const words = text.split(/\s+/).filter(Boolean);
      const wantsNew = words.some((w) => NEW_WORDS.includes(w));
      const terms = words.filter((w) => !NEW_WORDS.includes(w));
      const matches = (p) => {
        const hay = `${p.title} ${p.trail} ${p.code}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      };

      // T-code, e.g. IN01
      if (/^[a-z]{2}(0[12])?$/i.test(text)) {
        const t = resolveTcodeForUser(text, pages);
        if (!t.error) {
          out.push({
            key: `tcode:${t.path}`,
            kind: "tcode",
            title: `${t.isNew ? "New " : ""}${t.title}`,
            sub: `T-code ${text.toUpperCase()}`,
            href: t.path,
          });
        }
      }

      if (text) {
        const matched = pages.filter(matches);
        if (!wantsNew) {
          for (const p of matched.slice(0, MAX_PAGE_ROWS)) {
            out.push({ key: `page:${p.path}`, kind: "page", title: p.title, sub: p.trail, code: p.code, href: p.path });
          }
        }
        for (const p of matched.filter((x) => x.newPath).slice(0, wantsNew ? MAX_PAGE_ROWS : MAX_NEW_ROWS)) {
          out.push({
            key: `new:${p.newPath}`,
            kind: "new",
            title: `New ${p.title}`,
            sub: p.trail,
            code: p.code,
            href: p.newPath,
          });
        }
        if ("keyboard shortcuts guide help".includes(text)) {
          out.push({ key: "guide", kind: "guide", title: "Keyboard shortcuts guide", sub: "Help", href: "/shortcuts" });
        }
      }
    }

    if (searchKey && found.key === searchKey) {
      for (const r of found.masters) {
        out.push({
          key: `${r.kind}:${r.id}`,
          kind: r.kind,
          title: r.name,
          sub: [r.code, r.hint].filter(Boolean).join(" · "),
          tag: "360 view",
          href: deepSearchRoute(r.kind, r.id, parsed.tab),
        });
      }
      for (const r of found.docs) {
        out.push({
          key: `doc:${r.docType}:${r.docId}`,
          kind: "doc",
          title: r.docNo || `#${r.docId}`,
          sub: [r.typeLabel, fmtDate(r.date), r.projectCode, r.party, r.status].filter(Boolean).join(" · "),
          href: docRoute(r.docType, r.docId, r),
        });
      }
    }
    return out;
  }, [mode, term, parsed.tab, pages, found, searchKey]);

  // the highlighted row (kept inside the list when results change)
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  // keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, rows.length]);

  const openRow = (row) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(rows.length ? (activeIndex + 1) % rows.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(rows.length ? (activeIndex - 1 + rows.length) % rows.length : 0);
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openRow(rows[activeIndex]);
    }
  };

  const hasQuery = !!query.trim();
  const searching = !!searchKey && found.key !== searchKey;
  const prefixList =
    mode === "help"
      ? [...MASTER_PREFIXES, ...DOC_PREFIXES].filter((p) => p.prefix.startsWith(parsed.typedPrefix || ""))
      : [];
  const scopeLabel = mode === "master" ? parsed.master.label : mode === "doc" ? parsed.doc.label : "";

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[#d8e1ea] px-3">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Page, “new indent”, T-code, vendor, item or document number…"
          className="h-11 w-full bg-transparent text-[14px] outline-none"
          aria-label="Search pages, records and documents"
          autoComplete="off"
          spellCheck={false}
        />
        {scopeLabel && (
          <span className="shrink-0 rounded-sm border border-[#b5c7d8] bg-[#eef4fa] px-1.5 py-0.5 text-[11px] font-medium text-[#144664]">
            {scopeLabel}
          </span>
        )}
        {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
      </div>

      <div ref={listRef} className="min-h-[220px] flex-1 overflow-y-auto">
        {/* nothing typed: how to use */}
        {!hasQuery && (
          <div className="space-y-2 px-4 py-3 text-[12.5px] text-gray-700">
            <p className="font-semibold text-[#144664]">What you can type</p>
            <Tip text="indent" note="open a page by its name" />
            <Tip text="new indent" note="start a new entry" />
            <Tip text="IN01" note="T-code: 01 = list, 02 = new entry" />
            <Tip text="/v sharma" note="vendor / ledger → orders, bills, payments, ledger" />
            <Tip text="/i cement" note="item → indents, orders, GRN, issues" />
            <Tip text="/p tower" note="project → every document of that project" />
            <Tip text="PO-0042" note="find a document by its number" />
            <Tip text="/" note="see every search code" />
          </div>
        )}

        {/* "/" typed: list of search codes */}
        {mode === "help" && (
          <div className="px-4 py-3 text-[12.5px]">
            <p className="mb-2 font-semibold text-[#144664]">Search one kind of record: type the code, a space, then your text</p>
            {prefixList.length === 0 && <p className="text-gray-500">No search code starts with this.</p>}
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {prefixList.map((p) => (
                <button
                  key={p.prefix}
                  type="button"
                  onClick={() => {
                    setQuery(`/${p.prefix} `);
                    inputRef.current?.focus();
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-[3px] text-left hover:bg-[#f0f6ff]"
                >
                  <span className="w-10 shrink-0 font-mono font-bold text-[#b03030]">/{p.prefix}</span>
                  <span className="text-gray-800">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {rows.map((row, i) => (
          <button
            key={row.key}
            type="button"
            data-active={i === activeIndex}
            onMouseMove={() => setActive(i)}
            onClick={() => openRow(row)}
            className={`flex w-full cursor-pointer items-center gap-3 border-b border-[#eef2f6] px-3 py-2 text-left ${
              i === activeIndex ? "bg-[#e8f2ff]" : "bg-white"
            }`}
          >
            <RowIcon kind={row.kind} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-gray-900">{row.title}</span>
              {row.sub && <span className="block truncate text-[11.5px] text-gray-500">{row.sub}</span>}
            </span>
            {row.code && (
              <span className="shrink-0 font-mono text-[11px] text-gray-500">
                {row.code}
                {row.kind === "new" ? "02" : "01"}
              </span>
            )}
            {row.tag && (
              <span className="shrink-0 rounded-sm bg-[#144664] px-1.5 py-0.5 text-[10.5px] font-medium text-white">
                {row.tag}
              </span>
            )}
          </button>
        ))}

        {hasQuery && mode !== "help" && rows.length === 0 && !searching && (
          <p className="px-4 py-6 text-center text-[12.5px] text-gray-500">
            {found.error && searchKey
              ? found.error
              : mode !== "all" && term.length < MIN_QUERY
                ? `Type at least ${MIN_QUERY} characters — ${
                    mode === "master" ? parsed.master.hint : `${parsed.doc.label} number`
                  }.`
                : "Nothing found. Check the spelling, or you may not have access to it."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-[#d8e1ea] bg-[#f6f8fa] px-3 py-1.5 text-[11.5px] text-gray-600">
        <span className="flex items-center gap-1"><Kbd combo="↑" /><Kbd combo="↓" /> move</span>
        <span className="flex items-center gap-1"><Kbd combo="Enter" /> open</span>
        <span className="flex items-center gap-1"><Kbd combo="Esc" /> close</span>
        <button
          type="button"
          onClick={onHelp}
          className="ml-auto flex cursor-pointer items-center gap-1 text-[#144664] hover:underline"
        >
          <Keyboard className="h-3.5 w-3.5" /> All shortcuts
        </button>
      </div>
    </>
  );
}

function Tip({ text, note }) {
  return (
    <p className="flex items-center gap-2">
      <span className="inline-block min-w-[92px] rounded border border-[#d8e1ea] bg-[#f6f8fa] px-1.5 py-0.5 font-mono text-[12px] text-[#144664]">
        {text}
      </span>
      <span className="text-gray-600">{note}</span>
    </p>
  );
}

function RowIcon({ kind }) {
  const cls = "h-4 w-4 shrink-0";
  if (kind === "new") return <Plus className={`${cls} text-green-700`} />;
  if (kind === "doc") return <FileText className={`${cls} text-[#b7791f]`} />;
  if (kind === "vendor") return <Building2 className={`${cls} text-[#7c3aed]`} />;
  if (kind === "item") return <Boxes className={`${cls} text-[#0f766e]`} />;
  if (kind === "asset") return <Truck className={`${cls} text-[#0f766e]`} />;
  if (kind === "project") return <FolderKanban className={`${cls} text-[#c2410c]`} />;
  if (kind === "bank") return <Landmark className={`${cls} text-[#7c3aed]`} />;
  if (kind === "cc") return <Tags className={`${cls} text-[#7c3aed]`} />;
  if (kind === "employee") return <UserRound className={`${cls} text-[#be185d]`} />;
  if (kind === "tcode") return <Hash className={`${cls} text-[#2f6f9f]`} />;
  if (kind === "guide") return <Keyboard className={`${cls} text-[#2f6f9f]`} />;
  return <LayoutList className={`${cls} text-[#2f6f9f]`} />;
}
