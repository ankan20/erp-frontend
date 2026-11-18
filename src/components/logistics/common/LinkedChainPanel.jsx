"use client";

import Link from "next/link";
import { FileText, Truck, Receipt, ChevronRight } from "lucide-react";
import LogisticsStatusBadge from "./LogisticsStatusBadge";

// Shows the TR → DC → LB chain for a record.
// Only renders links to the records that exist for this context.
//
// Props:
//   anchor : "TR" | "DC" | "LB"  — which card to highlight
//   tr     : { id, trNo, workflowStatus } | null
//   dcs    : [{ id, dcNo, workflowStatus, transitStatus }] | []
//   lbs    : [{ id, lbNo, workflowStatus, paymentStatus }] | []

const LINK = {
  TR: (id) => `/logistics/transit-request/${id}`,
  DC: (id) => `/logistics/delivery-challan/${id}`,
  LB: (id) => `/logistics/bill-register/${id}`,
};

function ChainCard({ icon: Icon, title, items, anchor, type }) {
  const isAnchor = anchor === type;
  return (
    <div className="flex-1 min-w-[180px]">
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide mb-1 ${
        isAnchor ? "text-[#144664]" : "text-gray-500"
      }`}>
        <Icon className="w-3 h-3" />
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-gray-400 italic px-2">None yet</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={LINK[type](it.id)}
                className={[
                  "flex items-center justify-between gap-2 px-2 py-1 rounded-sm border text-[12px] transition-colors",
                  isAnchor
                    ? "bg-[#144664]/5 border-[#144664]/30 text-[#144664] font-medium"
                    : "bg-white border-gray-200 hover:border-[#144664] hover:bg-[#144664]/5",
                ].join(" ")}
              >
                <span className="truncate">{it.no}</span>
                <LogisticsStatusBadge status={it.secondary || it.primary} size="xs" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LinkedChainPanel({ anchor, tr, dcs = [], lbs = [] }) {
  const trItems = tr ? [{ id: tr.id, no: tr.trNo, primary: tr.workflowStatus, secondary: tr.workflowStatus }] : [];
  const dcItems = (dcs || []).map((d) => ({
    id: d.id, no: d.dcNo,
    primary: d.workflowStatus,
    secondary: d.workflowStatus === "Approved" ? d.transitStatus : d.workflowStatus,
  }));
  const lbItems = (lbs || []).map((l) => ({
    id: l.id, no: l.lbNo,
    primary: l.workflowStatus,
    secondary: l.workflowStatus === "Approved" ? l.paymentStatus : l.workflowStatus,
  }));

  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-600">
          Logistics Chain
        </span>
        <span className="text-[10px] text-gray-400">TR → DC → Bill</span>
      </div>
      <div className="p-3 flex items-start gap-2">
        <ChainCard icon={FileText} title="Transit Request" items={trItems} anchor={anchor} type="TR" />
        <ChevronRight className="w-4 h-4 text-gray-300 mt-5 shrink-0" />
        <ChainCard icon={Truck}    title="Delivery Challan" items={dcItems} anchor={anchor} type="DC" />
        <ChevronRight className="w-4 h-4 text-gray-300 mt-5 shrink-0" />
        <ChainCard icon={Receipt}  title="Logistics Bill"  items={lbItems} anchor={anchor} type="LB" />
      </div>
    </div>
  );
}
