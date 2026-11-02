"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, LayoutList, Loader2, Plus, Search, Copy, Hash } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { docRoute, fmtDate } from "@/components/master/traceability/wbUtils";
import { MAX_PANES, splitActions, useSplitState, currentUrl } from "./splitStore";
import { getAllowedPages, resolveTcode } from "./allowedPages";
import { toast } from "sonner";

const MIN_DOC_QUERY = 2;

export default function OpenInSplitDialog() {
  const split = useSplitState();
  const open = split.pickerOpen;
  const [tab, setTab] = useState("pages");
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState({ q: "", list: [], error: "", loading: false });
  const inputRef = useRef(null);

  // allowed pages are read when the dialog opens (permissions may change after login)
  const allowed = useMemo(() => (open ? getAllowedPages() : []), [open]);
  const full = split.panes.length >= MAX_PANES;

  // the page the request came from (main page or the window that asked)
  const fromUrl = useMemo(() => {
    if (!open) return null;
    const pane = split.panes.find((p) => p.id === split.pickerFrom);
    return pane ? pane.url : currentUrl();
  }, [open, split.panes, split.pickerFrom]);

  const q = query.trim().toLowerCase();
  const tcodePath = useMemo(() => resolveTcode(q, allowed), [q, allowed]);
  const pageMatches = useMemo(() => {
    const list = q
      ? allowed.filter((p) => [p.title, p.trail, p.path].some((v) => v.toLowerCase().includes(q)))
      : allowed;
    return list.slice(0, 60);
  }, [allowed, q]);

  // document search (backend checks project + document-type access)
  useEffect(() => {
    if (!open || tab !== "docs") return;
    const term = query.trim();
    if (term.length < MIN_DOC_QUERY) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setDocs((d) => ({ ...d, loading: true, error: "" }));
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.MASTER.TRACEABILITY.SEARCH, params: { q: term } });
        const list = (res?.data || []).filter((r) => r.docType !== "INDENT_ITEM" && docRoute(r.docType, r.docId, r));
        if (!cancelled) setDocs({ q: term, list, error: "", loading: false });
      } catch (e) {
        if (!cancelled) setDocs({ q: term, list: [], error: e?.message || "Document search is not available", loading: false });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, tab, query]);

  const openUrl = (url) => {
    if (!url) return;
    if (!splitActions.addPane(url)) {
      toast.warning(`You can open up to ${MAX_PANES} extra windows. Close one first.`);
      return;
    }
    setQuery("");
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (tcodePath) return openUrl(tcodePath);
    if (tab === "pages" && pageMatches[0]) return openUrl(pageMatches[0].path);
    if (tab === "docs" && docs.list[0]) return openUrl(docRoute(docs.list[0].docType, docs.list[0].docId, docs.list[0]));
  };

  const showDocs = query.trim().length >= MIN_DOC_QUERY;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && splitActions.closePicker()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-3" data-sync-ignore>
        <DialogHeader>
          <DialogTitle>Open in split window</DialogTitle>
        </DialogHeader>

        {full ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            {MAX_PANES} extra windows are already open. Close one to open another.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={tab === "pages" ? "Page name (e.g. Indent, Material Order) or T-code (e.g. pr01)" : "Document number (Indent, Order, GRN, SRN, GIN, DC, BRR, Bill…)"}
                className="h-9 w-full rounded-md border border-[#8f8f8f] pl-8 pr-2 text-[13px] outline-none focus:border-[#2f6f9f]"
                aria-label="Search pages or documents"
              />
            </div>

            <div className="flex gap-1 text-[12.5px]" role="tablist">
              {[
                ["pages", "Pages", LayoutList],
                ["docs", "Documents", FileText],
              ].map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium ${
                    tab === key ? "bg-[#144664] text-white" : "border border-[#b5c7d8] text-[#144664] hover:bg-[#f0f6ff]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="min-h-[200px] flex-1 overflow-y-auto rounded-md border border-[#e3e8ee]">
              {tcodePath && (
                <Row
                  icon={<Hash className="h-4 w-4 text-[#2f6f9f]" />}
                  title={`T-code ${query.trim().toUpperCase()}`}
                  sub={tcodePath}
                  onOpen={() => openUrl(tcodePath)}
                />
              )}

              {tab === "pages" && (
                <>
                  {!q && fromUrl && (
                    <Row
                      icon={<Copy className="h-4 w-4 text-[#2f6f9f]" />}
                      title="Same page again"
                      sub={fromUrl}
                      onOpen={() => openUrl(fromUrl)}
                    />
                  )}
                  {pageMatches.length === 0 && !tcodePath && (
                    <div className="p-4 text-center text-[12.5px] text-gray-500">No page you can open matches “{query}”.</div>
                  )}
                  {pageMatches.map((p) => (
                    <Row
                      key={p.path}
                      icon={<LayoutList className="h-4 w-4 text-gray-500" />}
                      title={p.title}
                      sub={p.trail}
                      onOpen={() => openUrl(p.path)}
                      extra={
                        p.newPath && (
                          <button
                            type="button"
                            onClick={() => openUrl(p.newPath)}
                            className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] px-2 py-0.5 text-[11.5px] font-medium text-[#144664] hover:bg-[#f0f6ff]"
                            aria-label={`Create new ${p.title} in split window`}
                          >
                            <Plus className="h-3 w-3" /> New
                          </button>
                        )
                      }
                    />
                  ))}
                </>
              )}

              {tab === "docs" && (
                <>
                  {!showDocs && (
                    <div className="p-4 text-center text-[12.5px] text-gray-500">Type at least {MIN_DOC_QUERY} characters of a document number.</div>
                  )}
                  {showDocs && docs.loading && (
                    <div className="flex items-center justify-center gap-2 p-4 text-[12.5px] text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  )}
                  {showDocs && !docs.loading && docs.error && (
                    <div className="p-4 text-center text-[12.5px] text-red-600">{docs.error}</div>
                  )}
                  {showDocs && !docs.loading && !docs.error && docs.q === query.trim() && docs.list.length === 0 && (
                    <div className="p-4 text-center text-[12.5px] text-gray-500">No document you can open matches “{query}”.</div>
                  )}
                  {showDocs &&
                    !docs.loading &&
                    docs.list.map((r) => (
                      <Row
                        key={`${r.docType}:${r.docId}`}
                        icon={<FileText className="h-4 w-4 text-gray-500" />}
                        title={`${r.typeLabel} ${r.docNo}`}
                        sub={[fmtDate(r.date), r.projectCode, r.party, r.status].filter(Boolean).join(" · ")}
                        onOpen={() => openUrl(docRoute(r.docType, r.docId, r))}
                      />
                    ))}
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Only pages and documents you have access to are listed. Press Enter to open the first result.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, title, sub, onOpen, extra }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#eef1f5] px-3 py-1.5 last:border-b-0 hover:bg-[#f7faff]">
      {icon}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate text-[13px] font-medium text-[#144664]">{title}</div>
        {sub && <div className="truncate text-[11px] text-gray-500">{sub}</div>}
      </button>
      {extra}
      <button
        type="button"
        onClick={onOpen}
        className="rounded bg-[#144664] px-2.5 py-0.5 text-[11.5px] font-medium text-white hover:brightness-110"
      >
        Open
      </button>
    </div>
  );
}
