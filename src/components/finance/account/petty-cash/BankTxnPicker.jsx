"use client";

import { useEffect, useState } from "react";
import { Loader2, X, RefreshCw, Landmark } from "lucide-react";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount }  from "@/helper/numberFormatter";

const EP  = API_ENDPOINTS.FINANCE.BANK_STATEMENT;
const dmy = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("-") : "");

/** Compact view of the linked bank line inside the docket form. */
export function BankTxnChip({ txn, total, onRemove }) {
  const mismatch = Math.round(Number(total || 0) * 100) !== Math.round(Number(txn.amount || 0) * 100);
  return (
    <div className={`rounded border px-2 py-1.5 text-[11.5px] ${mismatch ? "border-red-300 bg-red-50" : "border-[#c8dff0] bg-[#f0f7fd]"}`}>
      <div className="flex items-center gap-1.5">
        <Landmark className="w-3.5 h-3.5 text-[#144664]" />
        <span className="font-semibold text-gray-800">{dmy(txn.date)}</span>
        <span className="text-red-700 font-semibold tabular-nums">DR {formatAmount(txn.amount)}</span>
        {txn.isUpi && <span className="text-[10px] px-1 rounded bg-purple-100 text-purple-700">UPI</span>}
        {txn.status === "Reconciled" ? (
          <span className="text-[10px] px-1 rounded bg-green-100 text-green-800">Reconciled</span>
        ) : txn.linkedDocketId ? (
          <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800" title="Held for this docket">Reserved</span>
        ) : (
          <span className="text-[10px] px-1 rounded bg-gray-100 text-gray-600" title="Reserved when you save the docket">Not saved yet</span>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-gray-400 hover:text-red-600" title="Unlink">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-gray-600 truncate" title={`${txn.byDr || ""} → ${txn.toCr || ""} · ${txn.desc || ""}`}>
        {txn.byDr || "—"} → {txn.toCr || "—"} · {txn.desc || ""}
      </div>
      <div className="text-gray-500">
        Site {txn.site} · {txn.bankCode}{txn.refNo ? ` · Ref ${txn.refNo}` : ""}{txn.balance != null ? ` · Bal ${formatAmount(txn.balance)}` : ""}
      </div>
      {mismatch && <div className="text-red-600 font-medium">Docket total must equal {formatAmount(txn.amount)}</div>}
    </div>
  );
}

/**
 * Modal: unreconciled DR lines of this site + bank account that no other docket holds.
 * kind = "bank" | "upi" | "all" (from the payment mode); the user can widen to all.
 */
export default function BankTxnPicker({ projectCode, bankCashId, bankLabel, kind, docketId, selectedId, onClose, onSelect }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [showAll, setShowAll] = useState(kind === "all");
  const [range,   setRange]   = useState({ fromDate: "", toDate: "" });

  const load = () => {
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ projectCode, bankCashId, kind: showAll ? "all" : kind });
    if (docketId) q.set("docketId", docketId);
    if (search) q.set("search", search);
    if (range.fromDate) q.set("fromDate", range.fromDate);
    if (range.toDate) q.set("toDate", range.toDate);
    apiRequest({ url: `${EP.AVAILABLE}?${q}`, method: "GET" })
      .then((r) => setList(r?.data?.list || []))
      .catch((e) => { setList([]); setError(e?.message || "Could not fetch bank transactions"); })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [showAll, range.fromDate, range.toDate]);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const inp = "h-7 text-[12px] px-2 border border-gray-300 rounded bg-white";
  const kindLabel = kind === "upi" ? "UPI" : kind === "bank" ? "bank (non-UPI)" : "bank + UPI";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 px-4 py-3 border-b">
          <div>
            <div className="text-[14px] font-semibold text-gray-800">Select bank transaction</div>
            <div className="text-[11.5px] text-gray-500">
              Unreconciled DR (outgoing) lines of site <b>{projectCode}</b>{bankLabel ? <> on <b>{bankLabel}</b></> : null}, {showAll ? "bank + UPI" : kindLabel}.
              Lines already linked to another docket are hidden.
            </div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
          <input className={`${inp} w-56`} placeholder="Search desc / party / ref" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(); }} />
          <input type="date" className={inp} value={range.fromDate} onChange={(e) => setRange((r) => ({ ...r, fromDate: e.target.value }))} />
          <input type="date" className={inp} value={range.toDate} onChange={(e) => setRange((r) => ({ ...r, toDate: e.target.value }))} />
          <button type="button" onClick={load} className="h-7 px-2 rounded border text-gray-600 hover:bg-gray-50 inline-flex items-center gap-1 text-[12px]">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Fetch
          </button>
          {kind !== "all" && (
            <label className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-gray-600">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show bank and UPI lines
            </label>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</div>
          ) : error ? (
            <div className="py-10 text-center text-[12.5px] text-red-600">{error}</div>
          ) : !list.length ? (
            <div className="py-10 text-center text-[12.5px] text-gray-500">
              No unreconciled DR lines for this site and account.
              <div className="text-[11.5px] mt-1">Import the statement in Finance &gt; Accounts &gt; Bank Statements, with SITE = {projectCode}.</div>
            </div>
          ) : (
            <table className="w-full text-[12px] min-w-[900px]">
              <thead className="bg-[#144664] text-white sticky top-0">
                <tr>
                  {["Date", "BY-DR", "TO-CR", "DR", "CR", "Balance", "Desc", "Ref", ""].map((h, i) => (
                    <th key={i} className={`px-2 py-1.5 font-semibold whitespace-nowrap ${["DR", "CR", "Balance"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className={`border-t hover:bg-blue-50/50 cursor-pointer ${t.id === selectedId ? "bg-blue-50" : ""}`} onClick={() => onSelect(t)}>
                    <td className="px-2 py-1 whitespace-nowrap">{dmy(t.date)}</td>
                    <td className="px-2 py-1 max-w-[140px] truncate" title={t.byDr || ""}>{t.byDr}</td>
                    <td className="px-2 py-1 max-w-[140px] truncate" title={t.toCr || ""}>{t.toCr}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-red-700 font-medium">{formatAmount(t.dr)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-gray-400">{t.cr ? formatAmount(t.cr) : ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{t.balance != null ? formatAmount(t.balance) : ""}</td>
                    <td className="px-2 py-1 max-w-[220px] truncate" title={t.desc || ""}>
                      {t.isUpi && <span className="mr-1 text-[10px] px-1 rounded bg-purple-100 text-purple-700">UPI</span>}{t.desc}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{t.refNo}</td>
                    <td className="px-2 py-1">
                      <button type="button" className="h-6 px-2 rounded bg-blue-600 text-white text-[11.5px] hover:bg-blue-700">
                        {t.id === selectedId ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-2 border-t text-[11.5px] text-gray-500">
          {list.length ? `${list.length} line(s)` : ""} · The line is reserved for this docket when you save it, and reconciled when the docket is finally approved.
        </div>
      </div>
    </div>
  );
}
