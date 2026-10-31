"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getPendingApprovalsFor } from "@/lib/commApi";
import { MODULE_OPTIONS } from "@/lib/moduleRegistry";

// Module dropdown + list of records waiting on `userId`'s approval, with multi-select.
// <PendingApprovalPicker userId={5} module={mod} onModuleChange={setMod}
//                        selected={ids} onSelectedChange={setIds} />
// onRecordsLoaded(records) lets the parent know the record numbers (for display).
export default function PendingApprovalPicker({ userId, module, onModuleChange, selected = [], onSelectedChange, onRecordsLoaded }) {
  const [loaded, setLoaded] = useState({ key: null, records: [], error: null });
  const key = `${module}:${userId}`;

  useEffect(() => {
    if (!module || !userId) return;
    let cancelled = false;
    getPendingApprovalsFor(module, userId)
      .then(r => {
        if (cancelled) return;
        const records = Array.isArray(r) ? r : [];
        setLoaded({ key, records, error: null });
        onRecordsLoaded?.(records);
      })
      .catch(e => { if (!cancelled) setLoaded({ key, records: [], error: e?.message || "Could not load records" }); });
    return () => { cancelled = true; };
  }, [key]);

  const loading = !!module && !!userId && loaded.key !== key;
  const records = loaded.key === key ? loaded.records : [];
  const allOn   = records.length > 0 && records.every(r => selected.includes(r.id));

  const toggle = (id) => onSelectedChange?.(
    selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
  );
  const toggleAll = () => onSelectedChange?.(allOn ? [] : records.map(r => r.id));

  return (
    <div className="space-y-2">
      <select value={module || ""} onChange={e => { onModuleChange?.(e.target.value); onSelectedChange?.([]); }}
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#003b8e] bg-white">
        <option value="" disabled>Select module…</option>
        {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {!module ? null : loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
      ) : loaded.error && loaded.key === key ? (
        <p className="text-xs text-red-500 py-2">{loaded.error}</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">Nothing pending for this person in this module</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button type="button" onClick={toggleAll}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500">
            <Check on={allOn} /> {allOn ? "Clear all" : `Select all (${records.length})`}
          </button>
          <div className="max-h-40 overflow-y-auto">
            {records.map(r => {
              const on = selected.includes(r.id);
              return (
                <button key={r.id} type="button" onClick={() => toggle(r.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition ${on ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <Check on={on} />
                  <span className="font-semibold flex-1 truncate">{r.recordNo || `#${r.id}`}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{r.createdAt?.slice(0, 10)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Check({ on }) {
  return (
    <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0
      ${on ? "bg-[#003b8e] border-[#003b8e]" : "border-gray-300"}`}>
      {on && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
    </span>
  );
}
