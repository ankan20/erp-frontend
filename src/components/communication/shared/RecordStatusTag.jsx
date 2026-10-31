"use client";

import { recordStatusStyle } from "./recordStatus";

// Small pill showing where a record stands: Pending / Opened / ✓ Approved / Rejected …
// <RecordStatusTag status="approved" />   <RecordStatusTag status="pending" opened />
export default function RecordStatusTag({ status, opened = false, workflowStatus, className = "" }) {
  const s = recordStatusStyle(status, opened);
  if (!s) return null;
  return (
    <span title={workflowStatus ? `Now: ${workflowStatus.replace("_", " ")}` : undefined}
      className={`inline-block rounded px-1.5 py-px text-[9px] font-semibold leading-tight ${s.tag} ${className}`}>
      {s.label}
    </span>
  );
}
