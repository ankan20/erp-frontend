"use client";

// "Copy from…" on a create page: pick an earlier entry of this module and the
// form fills with its details (same as the Copy button on a detail page).

import { useEffect, useMemo, useState } from "react";
import { CopyPlus, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { loadPickDetail, loadPickRows, startCopyFrom, useCopySource } from "@/lib/copyRecord";

const SHOW_MAX = 200;

export default function CopyFromButton({ base, className = "" }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ loading: false, rows: [], error: null });
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(null); // row under the mouse / keyboard focus
  const currentCopy = useCopySource();

  const openPicker = () => {
    setOpen(true);
    setState({ loading: true, rows: [], error: null });
    loadPickRows(base)
      .then((rows) => setState({ loading: false, rows, error: null }))
      .catch((e) => setState({ loading: false, rows: [], error: e?.message || "Could not load entries" }));
  };

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length ? state.rows.filter((r) => words.every((w) => r.text.includes(w))) : state.rows;
    return list.slice(0, SHOW_MAX);
  }, [q, state.rows]);

  const active = shown.find((r) => String(r.id) === String(activeId)) || shown[0] || null;

  // Full record (items etc.) of the entry being looked at — loaded after a short pause.
  const [details, setDetails] = useState({}); // id → { status, data }
  const activeKey = open && active ? String(active.id) : null;
  useEffect(() => {
    if (!activeKey || details[activeKey]) return;
    const t = setTimeout(() => {
      setDetails((m) => ({ ...m, [activeKey]: { status: "loading" } }));
      loadPickDetail(base, activeKey)
        .then((data) => setDetails((m) => ({ ...m, [activeKey]: { status: "done", data } })))
        .catch(() => setDetails((m) => ({ ...m, [activeKey]: { status: "error" } })));
    }, 250);
    return () => clearTimeout(t);
  }, [activeKey, base, details]);
  const detail = activeKey ? details[activeKey] : null;
  const extraFields = useMemo(() => {
    if (!active || detail?.status !== "done" || !detail.data) return [];
    const seen = new Set(active.fields.map((f) => f.label));
    return detail.data.fields.filter((f) => !seen.has(f.label));
  }, [active, detail]);

  const pick = (id) => {
    setOpen(false);
    setQ("");
    startCopyFrom(base, id);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={openPicker} className={className} data-shortcut="copy-from">
            <CopyPlus size={24} strokeWidth={2.2} className="text-[#2563EB]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" variant="icon">
          Copy from an earlier entry (Alt+C)
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Copy from an earlier entry</DialogTitle>
            <DialogDescription>
              Point at an entry to see its details, then pick one — the form fills in. Change anything, then save as a new entry.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border border-gray-300 rounded-md px-2.5 h-9">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, name, date…"
              className="flex-1 min-w-0 text-sm outline-none bg-transparent"
            />
          </div>

          <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {state.loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : state.error ? (
              <p className="text-sm text-red-500 py-4 text-center">{state.error}</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {state.rows.length ? "No entry matches your search" : "No earlier entries yet"}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {shown.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => pick(r.id)}
                      onMouseEnter={() => setActiveId(r.id)}
                      onFocus={() => setActiveId(r.id)}
                      className={`w-full text-left px-2 py-2 rounded-md transition outline-none ${
                        active && String(active.id) === String(r.id)
                          ? "bg-blue-50 ring-1 ring-blue-200"
                          : String(currentCopy) === String(r.id)
                            ? "bg-blue-50/60"
                            : "hover:bg-blue-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                      {r.sub && <div className="text-xs text-gray-500 truncate">{r.sub}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Details of the row under the mouse (wide screens) */}
          <aside className="hidden md:block max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            {active ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 break-words">{active.title}</div>
                    {String(currentCopy) === String(active.id) && (
                      <div className="text-[11px] text-blue-600">Currently copied into the form</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => pick(active.id)}
                    className="shrink-0 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md px-2.5 py-1"
                  >
                    Use this
                  </button>
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
                  {[...active.fields, ...extraFields].map((f, i) => (
                    <div key={i} className="contents">
                      <dt className="text-gray-500 whitespace-nowrap">{f.label}</dt>
                      <dd className="text-gray-900 break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                {detail?.status === "loading" && (
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-3">
                    <Loader2 size={12} className="animate-spin" /> Loading items…
                  </div>
                )}
                {detail?.status === "error" && (
                  <p className="text-[11px] text-gray-400 mt-3">Could not load the items of this entry.</p>
                )}
                {detail?.status === "done" &&
                  detail.data?.tables.map((t) => (
                    <div key={t.label} className="mt-3">
                      <div className="text-[11px] font-semibold text-gray-600 mb-1">
                        {t.label} ({t.rows.length + t.more})
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                        <table className="w-full text-[11px]">
                          <thead className="bg-gray-100 text-gray-600">
                            <tr>
                              <th className="px-1.5 py-1 text-left font-medium">#</th>
                              {t.columns.map((c) => (
                                <th key={c} className="px-1.5 py-1 text-left font-medium whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {t.rows.map((row, ri) => (
                              <tr key={ri} className="border-t border-gray-100 align-top">
                                <td className="px-1.5 py-1 text-gray-400">{ri + 1}</td>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-1.5 py-1 text-gray-900">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {t.more > 0 && <p className="text-[10px] text-gray-400 mt-0.5">+{t.more} more</p>}
                    </div>
                  ))}
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center py-6">Point at an entry to see its details</p>
            )}
          </aside>
          </div>
          {state.rows.length > SHOW_MAX && shown.length === SHOW_MAX && (
            <p className="text-[11px] text-gray-400">Showing the first {SHOW_MAX} — search to find others.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
