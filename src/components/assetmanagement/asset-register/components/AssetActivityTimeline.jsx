"use client";

import { Clock3, User2, FileText } from "lucide-react";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const ACTION_COLORS = {
  "Registered":     "bg-blue-500",
  "Allocated":      "bg-green-500",
  "Status Updated": "bg-amber-500",
  "Transferred":    "bg-purple-500",
  "Maintenance":    "bg-orange-500",
  "Disposed":       "bg-red-500",
  "Batch Split":    "bg-teal-500",
};

export default function AssetActivityTimeline({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
        <Clock3 className="w-8 h-8" />
        <p className="text-sm">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((act, idx) => {
        const isLast = idx === activities.length - 1;
        const dotColor = ACTION_COLORS[act.action] || "bg-gray-400";
        return (
          <div key={act.id} className="relative flex gap-4">
            {/* dot + line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${dotColor} flex items-center justify-center shrink-0 z-10 shadow-sm`}>
                <FileText className="w-3.5 h-3.5 text-white" />
              </div>
              {!isLast && <div className="w-[2px] flex-1 min-h-[20px] my-[3px] bg-gray-200" />}
            </div>

            {/* card */}
            <div className={`pb-4 flex-1 min-w-0 ${isLast ? "pb-1" : ""}`}>
              <div className="rounded-xl border border-[#e8eef5] bg-[#f7f9fc] px-4 py-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md text-white ${dotColor}`}>
                        {act.action}
                      </span>
                      <span className="flex items-center gap-1 text-[13px] text-gray-700">
                        <User2 className="w-3.5 h-3.5 text-gray-400" />
                        {act.by}
                      </span>
                    </div>
                    {act.note && (
                      <p className="mt-1.5 text-[12px] text-gray-500 italic leading-relaxed">
                        {act.note}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                    {formatDate(act.at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
