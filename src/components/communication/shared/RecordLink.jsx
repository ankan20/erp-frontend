"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getRecordRoute, moduleLabel } from "@/lib/moduleRegistry";

// Clickable record number that opens the record's detail page, from any page.
// <RecordLink module="order" id={12} label="ORD-013" onNavigate={closePanel} />
export default function RecordLink({ module, id, label, showModule = false, onNavigate, className = "" }) {
  const router = useRouter();
  const href   = getRecordRoute(module, id);
  const text   = `${showModule ? `${moduleLabel(module)} ` : ""}${label || `#${id}`}`;

  if (!href) return <span className={className}>{text}</span>;

  return (
    <button type="button" title={`Open ${moduleLabel(module)} ${label || id}`}
      onClick={(e) => { e.stopPropagation(); onNavigate?.(); router.push(href); }}
      className={`inline-flex items-center gap-1 font-semibold text-[#003b8e] hover:underline ${className}`}>
      {text}
      <ExternalLink size={11} className="shrink-0" />
    </button>
  );
}
