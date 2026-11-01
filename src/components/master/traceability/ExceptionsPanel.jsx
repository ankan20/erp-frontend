"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const SEVERITY = {
  error: { icon: AlertOctagon, cls: "border-red-200 bg-red-50 text-red-800", iconCls: "text-red-600", label: "Mismatch" },
  warning: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-900", iconCls: "text-amber-600", label: "Pending" },
  info: { icon: Info, cls: "border-blue-100 bg-blue-50 text-blue-900", iconCls: "text-blue-600", label: "Note" },
};

export function countExceptions(list = []) {
  return list.reduce((a, e) => ({ ...a, [e.severity]: (a[e.severity] || 0) + 1 }), { error: 0, warning: 0, info: 0 });
}

export default function ExceptionsPanel({ exceptions = [], onDoc }) {
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => countExceptions(exceptions), [exceptions]);
  const shown = exceptions.filter((e) => filter === "all" || e.severity === filter);

  if (!exceptions.length) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800">
        <CheckCircle2 className="h-4 w-4" /> No pending quantities, mismatches or notes in this flow.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[
          ["all", `All (${exceptions.length})`],
          ["error", `Mismatches (${counts.error})`],
          ["warning", `Pending (${counts.warning})`],
          ["info", `Notes (${counts.info})`],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-0.5 text-[11.5px] font-medium ${
              filter === k ? "border-[#144664] bg-[#144664] text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {shown.map((e, i) => {
          const cfg = SEVERITY[e.severity] || SEVERITY.info;
          const Icon = cfg.icon;
          return (
            <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] ${cfg.cls}`}>
              <Icon className={`mt-[1px] h-4 w-4 shrink-0 ${cfg.iconCls}`} />
              <span className="w-[70px] shrink-0 text-[10.5px] font-bold uppercase tracking-wide opacity-80">{cfg.label}</span>
              <span className="flex-1">{e.message}</span>
              {e.docKey && (
                <button
                  type="button"
                  onClick={() => onDoc(e.docKey)}
                  className="shrink-0 rounded border border-current/30 bg-white/60 px-2 py-[1px] text-[11px] font-medium hover:bg-white"
                >
                  Show in flow
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
