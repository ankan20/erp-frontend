"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { ViewDocLink } from "./TraceBits";

const SEVERITY = {
  error: { icon: AlertOctagon, cls: "border-red-200 bg-red-50 text-red-800", iconCls: "text-red-600", label: "Mismatch" },
  warning: { icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-900", iconCls: "text-amber-600", label: "Pending" },
  info: { icon: Info, cls: "border-blue-100 bg-blue-50 text-blue-900", iconCls: "text-blue-600", label: "Note" },
};

export function exceptionCounts(exceptions = []) {
  return exceptions.reduce(
    (acc, e) => ({ ...acc, [e.severity]: (acc[e.severity] || 0) + 1 }),
    { error: 0, warning: 0, info: 0 },
  );
}

export default function TraceExceptions({ exceptions = [], unavailableMetrics = [] }) {
  return (
    <div className="space-y-3">
      {exceptions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          No pending quantities or mismatches found for this item.
        </div>
      ) : (
        <div className="space-y-1.5">
          {exceptions.map((e, i) => {
            const cfg = SEVERITY[e.severity] || SEVERITY.info;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] ${cfg.cls}`}>
                <Icon className={`mt-[1px] h-4 w-4 shrink-0 ${cfg.iconCls}`} />
                <span className="w-[70px] shrink-0 text-[10.5px] font-bold uppercase tracking-wide opacity-80">
                  {cfg.label}
                </span>
                <span className="flex-1">{e.message}</span>
                {e.ref && <ViewDocLink docType={e.ref.docType} docId={e.ref.docId} />}
              </div>
            );
          })}
        </div>
      )}

      {unavailableMetrics.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] text-gray-600">
          <div className="mb-1 font-semibold text-gray-700">Not tracked by the current data</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {unavailableMetrics.map((m) => (
              <li key={m.metric}>{m.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
