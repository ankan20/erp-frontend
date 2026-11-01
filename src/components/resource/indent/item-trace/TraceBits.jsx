"use client";

import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatWorkflowStatus, getDocRoute, statusClass } from "./traceUtils";

export function StatusBadge({ status, className = "" }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-[1px] text-[11px] font-semibold ${statusClass(status)} ${className}`}
    >
      {formatWorkflowStatus(status)}
    </span>
  );
}

// Marks a value as a proportional estimate, never an exact figure.
export function AllocatedTag({ basis, label = "Allocated" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          {label}
          <Info className="h-3 w-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" variant="text" className="max-w-[min(360px,90vw)]">
        {basis}
      </TooltipContent>
    </Tooltip>
  );
}

export function InfoHint({ text, side = "top" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-gray-400 hover:text-gray-600" aria-label="More info">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} variant="text" className="max-w-[min(320px,90vw)]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// Opens the existing document page in a new tab so the trace stays open.
export function ViewDocLink({ docType, docId, label = "View" }) {
  const href = getDocRoute(docType, docId);
  if (!href) return null;
  return (
    <Link
      href={href}
      prefetch={false}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-[#e8f2ff] px-2 py-[1px] text-[11px] font-medium text-[#144664] hover:brightness-95"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="truncate text-[12px] font-medium text-gray-800">{children ?? "—"}</div>
    </div>
  );
}

export function EmptyNote({ children }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
      {children}
    </div>
  );
}
