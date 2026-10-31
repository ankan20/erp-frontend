"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getRecordRoute, moduleLabel } from "@/lib/moduleRegistry";
import { recordStatusStyle } from "./recordStatus";

// Clickable record number that opens the record's detail page, from any page.
// <RecordLink module="order" id={12} label="ORD-013" onNavigate={closePanel} />
// Optional `status` / `opened` colour it (strike-through once approved) — see recordStatus.js.
export default function RecordLink({
  module, id, label, showModule = false, onNavigate, className = "", status, opened = false,
}) {
  const router = useRouter();
  const href   = getRecordRoute(module, id);
  const text   = `${showModule ? `${moduleLabel(module)} ` : ""}${label || `#${id}`}`;
  const look   = recordStatusStyle(status, opened);
  const colour = look?.link || "text-[#003b8e]";

  if (!href || status === "removed") return <span className={`${colour} ${className}`}>{text}</span>;

  return (
    <button type="button" title={`Open ${moduleLabel(module)} ${label || id}`}
      onClick={(e) => { e.stopPropagation(); onNavigate?.(); router.push(href); }}
      className={`inline-flex items-center gap-1 font-semibold hover:underline ${colour} ${className}`}>
      {text}
      <ExternalLink size={11} className="shrink-0" />
    </button>
  );
}
