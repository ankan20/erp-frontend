"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpLeft, Crosshair, ExternalLink, Lock, Loader2, Route } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { LinkChip } from "./FlowTree";
import DocIcon from "./DocIcon";
import {
  STAGE_STYLE,
  docRoute,
  fmtAmt,
  fmtDate,
  fmtPercent,
  fmtQty,
  formatWorkflowStatus,
  statusClass,
} from "./wbUtils";

const Section = ({ title, children, right, guide }) => (
  <div className="border-t border-[#e3e8ee] px-3 py-2" data-guide={guide}>
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</span>
      {right}
    </div>
    {children}
  </div>
);

function Relation({ edge, node, dir, onSelect }) {
  if (!node) return null;
  const D = dir === "up" ? ArrowUpLeft : ArrowDownRight;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.key)}
      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-[#f0f6ff]"
    >
      <D className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <DocIcon node={node} className="h-3.5 w-3.5 shrink-0 text-gray-500" />
      <span className={`truncate text-[12px] font-medium ${node.restricted ? "italic text-gray-500" : "text-[#144664]"}`}>
        {node.restricted ? "Restricted document" : node.docNo}
      </span>
      <span className="truncate text-[10.5px] text-gray-500">{node.typeLabel}</span>
      <span className="ml-auto shrink-0">
        <LinkChip edge={edge} />
      </span>
    </button>
  );
}

export default function DocumentInspector({ node, edges, nodesByKey, onSelect, onTraceFrom, onTrackItem, isStart }) {
  // key -> { data } | { error }; fetched once per document
  const [details, setDetails] = useState({});
  const entry = node ? details[node.key] : null;
  const detail = entry?.data || null;
  const error = entry?.error || "";
  const loading = !!node && !node.restricted && !entry;

  useEffect(() => {
    if (!node || node.restricted || entry) return;
    const key = node.key;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.TRACEABILITY.DOCUMENT}/${node.docType}/${node.docId}` })
      .then((res) => setDetails((d) => ({ ...d, [key]: { data: res?.data || null } })))
      .catch((e) => setDetails((d) => ({ ...d, [key]: { error: e?.message || "Failed to load document" } })));
  }, [node, entry]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[12px] text-gray-500">
        Select a document in the flow to inspect it.
      </div>
    );
  }

  const style = STAGE_STYLE[node.stage];
  const ups = edges.filter((e) => e.to === node.key);
  const downs = edges.filter((e) => e.from === node.key);
  const href = docRoute(node.docType, node.docId, { billingType: node.billingType });

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${node.restricted ? "bg-gray-400" : style.dot}`}>
            <DocIcon node={node} className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-gray-500">{node.typeLabel}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[16px] font-bold text-[#144664]">{node.restricted ? "Restricted" : node.docNo}</span>
              {!node.restricted && (
                <span className={`rounded-md border px-1.5 text-[10.5px] font-semibold ${statusClass(node.status)}`}>
                  {formatWorkflowStatus(node.status)}
                </span>
              )}
            </div>
          </div>
        </div>
        {!node.restricted && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {href && (
              <Link
                data-guide="open-doc"
                href={href}
                prefetch={false}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm border border-[#6d9dc5] bg-[#e8f2ff] px-2 py-1 text-[11.5px] font-medium text-[#144664] hover:brightness-95"
              >
                Open document <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {!isStart && (
              <button
                type="button"
                data-guide="trace-from"
                onClick={() => onTraceFrom(node.docType, node.docId)}
                className="inline-flex items-center gap-1 rounded-sm border border-[#6d9dc5] bg-[#9fc5e8] px-2 py-1 text-[11.5px] font-medium hover:brightness-95"
              >
                <Crosshair className="h-3 w-3" /> Trace from here
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {node.restricted ? (
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            This document is in a project or module you do not have access to. Its position in the flow is shown, but
            not its details.
          </div>
        ) : (
          <Section title="Summary">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <Fact label="Date" value={fmtDate(node.date)} />
              <Fact label="Project" value={(node.projectCodes || []).join(" → ") || "—"} />
              <Fact label="Party" value={detail?.party || node.party || "—"} wide />
              {detail?.partyGstin && <Fact label="GSTIN" value={detail.partyGstin} />}
              {(detail?.fields || []).map((f) => (
                <Fact
                  key={f.label}
                  label={f.label}
                  value={f.kind === "amount" ? `₹ ${fmtAmt(f.value)}` : f.kind === "date" ? fmtDate(f.value) : String(f.value)}
                />
              ))}
              {detail?.approvedAt && <Fact label="Approved" value={fmtDate(detail.approvedAt)} />}
              {detail?.rejectedAt && <Fact label="Rejected" value={fmtDate(detail.rejectedAt)} />}
            </div>
          </Section>
        )}

        <Section title={`Comes from (${ups.length})`} guide="comes-from">
          {ups.length ? (
            ups.map((e) => <Relation key={e.from} edge={e} node={nodesByKey[e.from]} dir="up" onSelect={onSelect} />)
          ) : (
            <div className="text-[11.5px] text-gray-400">Origin of this flow.</div>
          )}
        </Section>
        <Section title={`Leads to (${downs.length})`} guide="leads-to">
          {downs.length ? (
            downs.map((e) => <Relation key={e.to} edge={e} node={nodesByKey[e.to]} dir="down" onSelect={onSelect} />)
          ) : (
            <div className="text-[11.5px] text-gray-400">No follow-on documents in this view.</div>
          )}
        </Section>

        {!node.restricted && (
          <Section title="Lines" guide="lines" right={loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}>
            {error ? (
              <div className="text-[12px] text-red-600">{error}</div>
            ) : loading && !detail ? (
              <div className="space-y-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : detail?.lines?.length ? (
              <LinesTable detail={detail} onTrackItem={onTrackItem} onTraceFrom={onTraceFrom} />
            ) : detail?.ccLines?.length ? (
              <CcTable detail={detail} />
            ) : (
              <div className="text-[11.5px] text-gray-400">
                {node.docType === "BRR"
                  ? "A bill receive register has no item lines; its billing is reconciled in BRB documents."
                  : "No lines."}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, wide }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="truncate font-medium text-gray-800" title={value}>
        {value}
      </div>
    </div>
  );
}

function LinesTable({ detail, onTrackItem, onTraceFrom }) {
  const isIndent = detail.docType === "INDENT";
  const hasMoney = detail.lines.some((l) => l.amount !== null);
  return (
    <div className="overflow-x-auto rounded border border-[#e3e8ee]">
      <table className="w-full border-collapse text-[11.5px]">
        <thead className="bg-[#eef3f8] text-gray-600">
          <tr>
            <th className="px-1.5 py-1 text-left font-semibold">Item</th>
            <th className="px-1.5 py-1 text-right font-semibold">Qty</th>
            {hasMoney && <th className="px-1.5 py-1 text-right font-semibold">Rate</th>}
            {hasMoney && <th className="px-1.5 py-1 text-right font-semibold">Amount</th>}
            <th className="px-1.5 py-1 text-left font-semibold">{isIndent ? "" : "From"}</th>
          </tr>
        </thead>
        <tbody>
          {detail.lines.map((l) => (
            <tr key={l.lineId} className="border-t border-[#eef1f5] align-top">
              <td className="px-1.5 py-1">
                <div className="font-medium text-gray-800">
                  {l.itemName || l.itemCode || "—"}
                  {l.isAsset && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">FA</span>}
                </div>
                <div className="text-[10.5px] text-gray-500">{l.itemCode}</div>
              </td>
              <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">
                {fmtQty(l.qty)} <span className="text-gray-500">{l.unit || ""}</span>
              </td>
              {hasMoney && <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{l.rate !== null ? fmtAmt(l.rate) : "—"}</td>}
              {hasMoney && (
                <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums" title={l.gstPercent !== null ? `GST ${fmtPercent(l.gstPercent)} · ₹ ${fmtAmt(l.gstAmount)}` : ""}>
                  {l.amount !== null ? fmtAmt(l.amount) : "—"}
                </td>
              )}
              <td className="px-1.5 py-1">
                {isIndent ? (
                  <div className="flex flex-col items-start gap-0.5">
                    <button type="button" data-guide="track-item" onClick={() => onTrackItem(l)} className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10.5px] font-medium text-[#144664] hover:underline">
                      <Route className="h-3 w-3" /> Track item
                    </button>
                    <button type="button" data-guide="trace-item" onClick={() => onTraceFrom("INDENT_ITEM", l.lineId)} className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10.5px] font-medium text-[#144664] hover:underline">
                      <Crosshair className="h-3 w-3" /> Trace item flow
                    </button>
                  </div>
                ) : (
                  (l.parentRefs || []).map((p) => (
                    <div key={`${p.docType}:${p.lineId}`} className="whitespace-nowrap text-[10.5px] text-gray-600">
                      {p.docNo}
                    </div>
                  ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CcTable({ detail }) {
  const gst = (detail.gstLines || []).filter((g) => g.selected);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border border-[#e3e8ee]">
        <table className="w-full border-collapse text-[11.5px]">
          <thead className="bg-[#eef3f8] text-gray-600">
            <tr>
              <th className="px-1.5 py-1 text-left font-semibold">Cost centre</th>
              <th className="px-1.5 py-1 text-right font-semibold">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {detail.ccLines.map((c) => (
              <tr key={c.slNo} className="border-t border-[#eef1f5]">
                <td className="px-1.5 py-1">
                  <span className="font-medium">{c.ccCode}</span> <span className="text-gray-500">{c.ccName}</span>
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{fmtAmt(c.amount)}</td>
              </tr>
            ))}
            {gst.map((g, i) => (
              <tr key={`g${i}`} className="border-t border-[#eef1f5] text-gray-600">
                <td className="px-1.5 py-1">
                  {g.gstType} {g.percent !== undefined && g.percent !== null ? fmtPercent(g.percent) : ""} · {g.ccCode}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums">{fmtAmt(g.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10.5px] text-gray-500">
        Accounts documents are recorded per cost-centre code, not per item. Use <b>Track item</b> on an indent line for
        an allocated (estimated) item-level view.
      </p>
    </div>
  );
}
