"use client";

import { useMemo } from "react";
import DataTable from "@/components/common/DataTable";
import { AllocatedTag } from "./TraceBits";
import { fmtAmt, fmtDate, fmtQty, formatWorkflowStatus, getDocRoute } from "./traceUtils";

const COLUMNS = [
  { header: "Sl. no", accessor: "sl", width: "60px" },
  { header: "Document No", accessor: "docNo", width: "130px" },
  { header: "Date", accessor: "date", width: "110px" },
  { header: "Module", accessor: "module", width: "110px" },
  { header: "Transaction Type", accessor: "transactionType", width: "160px" },
  { header: "Parent Ref", accessor: "parentRef", width: "130px" },
  { header: "Qty", accessor: "qty", width: "100px", align: "right" },
  { header: "Unit", accessor: "unit", width: "70px", align: "center" },
  { header: "Rate", accessor: "rate", width: "100px", align: "right" },
  { header: "Amount (₹)", accessor: "amount", width: "175px", align: "right" },
  { header: "Status", accessor: "status", width: "120px" },
  { header: "Action", accessor: "action", width: "110px" },
];

export default function TraceLedgerTab({ ledger, allocationBasis }) {
  // DataTable renders plain values and sorts on them, so rows are pre-formatted.
  const rows = useMemo(
    () =>
      (ledger || []).map((r, i) => {
        const route = getDocRoute(r.docType, r.docId);
        return {
          id: i + 1,
          sl: i + 1,
          docNo: r.docNo || "—",
          date: r.date ? fmtDate(r.date) : "—",
          module: r.module,
          transactionType: r.transactionType,
          parentRef: r.parentRef || "—",
          qty: r.qty === null || r.qty === undefined ? "—" : fmtQty(r.qty),
          unit: r.qty === null || r.qty === undefined ? "—" : r.unit || "—",
          rate: r.rate === null || r.rate === undefined ? "—" : fmtAmt(r.rate),
          amount:
            r.amount === null || r.amount === undefined
              ? "—"
              : r.isAllocated
                ? `≈ ${fmtAmt(r.amount)} (est.)`
                : fmtAmt(r.amount),
          status: formatWorkflowStatus(r.status),
          action: route ? "Open ↗" : "—",
          _route: route,
        };
      }),
    [ledger],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
        <span>
          Every document line linked to this indent item, oldest first. Click a document number to open it in a new tab.
        </span>
        <span className="flex items-center gap-1">
          Amounts marked ≈ are <AllocatedTag basis={allocationBasis} />
        </span>
      </div>
      <DataTable
        columns={COLUMNS}
        data={rows}
        storageKey="indent-item-trace-ledger"
        onRowClick={(row) => {
          if (row._route) window.open(row._route, "_blank", "noopener,noreferrer");
        }}
      />
    </div>
  );
}
