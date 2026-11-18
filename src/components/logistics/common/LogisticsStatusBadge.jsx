"use client";

// One badge for every status flavour in the logistics module.
// - Workflow (Draft / Pending / Approved / Rejected / Reback)
// - Transit  (Pending_Dispatch / Dispatched / In_Transit / Delivered / RTO)
// - POD      (Awaited / Uploaded / Verified)
// - Payment  (Unpaid / Partial / Paid)
// - Fulfillment (Open / Partial / Fulfilled / Cancelled)
// All share the same visual language: a 2px coloured bar + tight text.

const PRESETS = {
  // workflow
  Draft:         { bar: "bg-slate-400",   fg: "text-slate-700",   bg: "bg-slate-50"   },
  Pending:       { bar: "bg-amber-500",   fg: "text-amber-800",   bg: "bg-amber-50"   },
  Approved:      { bar: "bg-emerald-500", fg: "text-emerald-800", bg: "bg-emerald-50" },
  Rejected:      { bar: "bg-rose-500",    fg: "text-rose-800",    bg: "bg-rose-50"    },
  Reback:        { bar: "bg-orange-500",  fg: "text-orange-800",  bg: "bg-orange-50"  },

  // transit
  Pending_Dispatch:    { bar: "bg-slate-400", fg: "text-slate-700", bg: "bg-slate-50"  },
  Dispatched:          { bar: "bg-blue-500",  fg: "text-blue-800",  bg: "bg-blue-50"   },
  In_Transit:          { bar: "bg-indigo-500",fg: "text-indigo-800",bg: "bg-indigo-50" },
  Partially_Delivered: { bar: "bg-violet-500",fg: "text-violet-800",bg: "bg-violet-50" },
  Delivered:           { bar: "bg-teal-500",  fg: "text-teal-800",  bg: "bg-teal-50"   },
  RTO:                 { bar: "bg-rose-500",  fg: "text-rose-800",  bg: "bg-rose-50"   },

  // POD
  Awaited:  { bar: "bg-slate-400",   fg: "text-slate-700",   bg: "bg-slate-50"   },
  Uploaded: { bar: "bg-blue-500",    fg: "text-blue-800",    bg: "bg-blue-50"    },
  Verified: { bar: "bg-emerald-500", fg: "text-emerald-800", bg: "bg-emerald-50" },

  // payment
  Unpaid:  { bar: "bg-rose-500",    fg: "text-rose-800",    bg: "bg-rose-50"    },
  Partial: { bar: "bg-amber-500",   fg: "text-amber-800",   bg: "bg-amber-50"   },
  Paid:    { bar: "bg-emerald-500", fg: "text-emerald-800", bg: "bg-emerald-50" },

  // fulfillment
  Open:       { bar: "bg-slate-400",   fg: "text-slate-700",   bg: "bg-slate-50"   },
  Fulfilled:  { bar: "bg-emerald-500", fg: "text-emerald-800", bg: "bg-emerald-50" },
  Cancelled:  { bar: "bg-rose-500",    fg: "text-rose-800",    bg: "bg-rose-50"    },
};

const FALLBACK = { bar: "bg-slate-400", fg: "text-slate-700", bg: "bg-slate-50" };

export default function LogisticsStatusBadge({ status, size = "sm" }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;
  const key = String(status).trim();
  const p = PRESETS[key] || FALLBACK;
  const label = key.replace(/_/g, " ");
  const sizing = size === "xs"
    ? "text-[10px] py-[1px] pr-2"
    : "text-[11px] py-0.5 pr-2.5";
  return (
    <span className={`inline-flex items-center gap-1.5 ${sizing} ${p.bg} ${p.fg} rounded-sm`}>
      <span className={`inline-block w-[3px] self-stretch ${p.bar}`} />
      <span className="font-medium whitespace-nowrap">{label}</span>
    </span>
  );
}
