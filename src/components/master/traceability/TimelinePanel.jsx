"use client";

import { useMemo } from "react";
import DataTable from "@/components/common/DataTable";
import { fmtAmt, fmtDate, formatWorkflowStatus } from "./wbUtils";
import { nodeQty } from "./FlowTree";

const COLUMNS = [
  { header: "Sl. no", accessor: "sl", width: "60px" },
  { header: "Document No", accessor: "docNo", width: "140px" },
  { header: "Date", accessor: "date", width: "115px" },
  { header: "Document Type", accessor: "type", width: "180px" },
  { header: "Stage", accessor: "stage", width: "130px" },
  { header: "Party / Project", accessor: "party", width: "220px" },
  { header: "Qty in Flow", accessor: "qty", width: "150px", align: "right" },
  { header: "Doc Amount (₹)", accessor: "amount", width: "140px", align: "right" },
  { header: "Status", accessor: "status", width: "120px" },
];

// Chronological register of every visible document in the flow.
export default function TimelinePanel({ nodes, stages, onDoc }) {
  const rows = useMemo(() => {
    const stageLabel = Object.fromEntries((stages || []).map((s) => [s.key, s.label]));
    return nodes
        .filter((n) => !n.restricted)
        .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
        .map((n, i) => ({
          id: i + 1,
          sl: i + 1,
          docNo: n.docNo,
          date: fmtDate(n.date),
          type: n.typeLabel,
          stage: stageLabel[n.stage] || n.stage,
          party: `${n.party || "—"}${n.projectCode ? ` · ${n.projectCode}` : ""}`,
          qty: nodeQty(n),
          amount: n.amount !== null && n.amount !== undefined ? fmtAmt(n.amount) : "—",
          status: formatWorkflowStatus(n.status),
          _key: n.key,
        }));
  }, [nodes, stages]);

  return (
    <div className="space-y-1.5">
      <p className="text-[11.5px] text-gray-600">Every document in the flow, oldest first. Click a document number to select it in the flow.</p>
      <DataTable columns={COLUMNS} data={rows} storageKey="traceability-workbench-timeline" onRowClick={(r) => onDoc(r._key)} />
    </div>
  );
}
