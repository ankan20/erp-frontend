"use client";

// "Copy from…" on a create page: pick an earlier entry of this module and the
// form fills with its details (same as the Copy button on a detail page).

import { useMemo, useState } from "react";
import { CopyPlus, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { loadPickRows, startCopyFrom, useCopySource } from "@/lib/copyRecord";

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

  const pick = (id) => {
    setOpen(false);
    setQ("");
    startCopyFrom(base, id);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={openPicker} className={className}>
            <CopyPlus size={24} strokeWidth={2.2} className="text-[#2563EB]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" variant="icon">
          Copy from an earlier entry
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
                  {active.fields.map((f, i) => (
                    <div key={i} className="contents">
                      <dt className="text-gray-500 whitespace-nowrap">{f.label}</dt>
                      <dd className="text-gray-900 break-words">{f.value}</dd>
                    </div>
                  ))}
                </dl>
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
