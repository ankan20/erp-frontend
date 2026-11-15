"use client";

import { useEffect, useState } from "react";
import { Timer, Lock } from "lucide-react";
import { liveSeconds, fmtDuration } from "@/lib/misTasks";

/** Re-render every `ms` while `active` (keeps running timers live without refetching). */
export function useTick(active, ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/**
 * Worked time for a task, e.g. "⏱ 1h 20m / 3h". Red with "over" when past the estimate.
 * compact = list/board size.
 */
export default function TaskTimer({ task, now, compact = false }) {
  if (!task) return null;
  const sec = liveSeconds(task, now);
  const est = task.estimatedHours != null ? Number(task.estimatedHours) : null;
  const over = est != null && est > 0 && sec > est * 3600;
  if (!task.startedAt && !sec) {
    return est != null ? <span className="text-[11px] text-gray-500">est {est}h</span> : <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 ${compact ? "text-[11px]" : "text-sm"} tabular-nums whitespace-nowrap
        ${over ? "text-red-600 font-semibold" : task.isRunning ? "text-blue-700 font-semibold" : "text-gray-700"}`}
      title={task.isRunning ? "Clock running" : task.isLocked ? "Finished — locked" : "Clock paused"}
    >
      {task.isLocked ? <Lock size={compact ? 11 : 13} /> : <Timer size={compact ? 11 : 13} className={task.isRunning ? "animate-pulse" : ""} />}
      {fmtDuration(sec)}
      {est != null && <span className="font-normal text-gray-500">/ {est}h</span>}
      {over && <span className="font-semibold">over</span>}
    </span>
  );
}
