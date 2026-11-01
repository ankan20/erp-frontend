"use client";

import { Info } from "lucide-react";
import { fmtAmt, fmtDate, formatWorkflowStatus, statusClass } from "./wbUtils";

function Money({ label, value, tone = "base", sub }) {
  const tones = {
    base: "border-[#b5c7d8] bg-[#f3f7ff]",
    good: "border-green-200 bg-green-50",
    warn: "border-amber-200 bg-amber-50",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[11px] font-medium text-gray-600">{label}</div>
      <div className="text-[16px] font-bold text-gray-900">₹ {fmtAmt(value)}</div>
      {sub && <div className="text-[10.5px] text-gray-500">{sub}</div>}
    </div>
  );
}

const Doc = ({ no, status, onClick }) => (
  <span className="inline-flex items-center gap-1.5">
    <button type="button" onClick={onClick} className="font-semibold text-[#144664] hover:underline">
      {no}
    </button>
    <span className={`rounded border px-1 text-[9.5px] font-semibold ${statusClass(status)}`}>{formatWorkflowStatus(status)}</span>
  </span>
);

export default function FinancialsPanel({ fin, onDoc }) {
  const { brrs = [], purchaseBills = [], totals = {} } = fin || {};
  const th = "whitespace-nowrap px-2 py-1.5 font-semibold";
  const td = "whitespace-nowrap px-2 py-1";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] text-blue-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Document-level amounts — <b>exact</b>, taken directly from the bill receive registers, BRB billing, Purchase
          Bills and payments in this flow. Purchase Bills and payments are recorded per cost-centre code, so they are not
          split by item here; use <b>Track item</b> on an indent line for an allocated (estimated) item share.
        </span>
      </div>

      {!brrs.length && !purchaseBills.length ? (
        <div className="py-8 text-center text-[12px] text-gray-500">No billing or accounts documents in this flow (or none you can access).</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Money label="Bills received (BRR)" value={totals.billReceived} />
            <Money label="Reconciled (BRB)" value={totals.reconciled} sub="non-rejected BRB" />
            <Money label="Booked (Purchase Bill)" value={totals.booked} />
            <Money label="Paid" value={totals.paid} tone="good" sub="approved payments" />
            <Money label="Payment in process" value={totals.inProcess} sub="awaiting approval" />
            <Money label="Outstanding" value={totals.outstanding} tone={totals.outstanding > 0 ? "warn" : "base"} sub="approved bills" />
          </div>

          {brrs.length > 0 && (
            <div className="space-y-1">
              <div className="text-[12.5px] font-semibold text-gray-800">Bill receive registers</div>
              <div className="overflow-x-auto rounded-md border border-[#9e9e9e]">
                <table className="w-full min-w-[860px] border-collapse text-[12px]">
                  <thead className="bg-[#144664] text-white">
                    <tr>
                      <th className={`${th} text-left`}>BRR</th>
                      <th className={`${th} text-left`}>Date</th>
                      <th className={`${th} text-left`}>Type</th>
                      <th className={`${th} text-left`}>Party Bill</th>
                      <th className={`${th} text-right`}>Bill Received</th>
                      <th className={`${th} text-right`}>Reconciled (BRB)</th>
                      <th className={`${th} text-right`}>Not Reconciled</th>
                      <th className={`${th} text-right`}>Booked (PB)</th>
                      <th className={`${th} text-right`}>PBs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brrs.map((b, i) => (
                      <tr key={b.brrId} className={i % 2 ? "bg-white" : "bg-[#f7f7f7]"}>
                        <td className={td}><Doc no={b.brrNo} status={b.status} onClick={() => onDoc(`BRR:${b.brrId}`)} /></td>
                        <td className={td}>{fmtDate(b.brrDate)}</td>
                        <td className={td}>{b.billingType || "—"}</td>
                        <td className={td}>{b.partyBillNo || "—"}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(b.billReceived)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(b.reconciled)}</td>
                        <td className={`${td} text-right tabular-nums ${Math.abs(b.unreconciled) > 0.01 ? "bg-amber-50 font-semibold text-amber-800" : ""}`}>{fmtAmt(b.unreconciled)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(b.booked)}</td>
                        <td className={`${td} text-right ${b.purchaseBillCount > 1 ? "bg-amber-50 font-semibold text-amber-800" : ""}`}>{b.purchaseBillCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {purchaseBills.length > 0 && (
            <div className="space-y-1">
              <div className="text-[12.5px] font-semibold text-gray-800">Purchase Bills & payments</div>
              <div className="overflow-x-auto rounded-md border border-[#9e9e9e]">
                <table className="w-full min-w-[960px] border-collapse text-[12px]">
                  <thead className="bg-[#144664] text-white">
                    <tr>
                      <th className={`${th} text-left`}>Purchase Bill</th>
                      <th className={`${th} text-left`}>Date</th>
                      <th className={`${th} text-left`}>Vendor Bill</th>
                      <th className={`${th} text-right`}>Taxable</th>
                      <th className={`${th} text-right`}>GST</th>
                      <th className={`${th} text-right`}>Disc. / R.Off</th>
                      <th className={`${th} text-right`}>Total</th>
                      <th className={`${th} text-right`}>Paid</th>
                      <th className={`${th} text-right`}>In Process</th>
                      <th className={`${th} text-right`}>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseBills.map((p, i) => (
                      <tr key={p.purchaseBillId} className={i % 2 ? "bg-white" : "bg-[#f7f7f7]"}>
                        <td className={td}><Doc no={p.purchaseBillNo} status={p.status} onClick={() => onDoc(`PURCHASE_BILL:${p.purchaseBillId}`)} /></td>
                        <td className={td}>{fmtDate(p.date)}</td>
                        <td className={td}>{p.vendorBillNo || "—"}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(p.basic)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(p.gst)}</td>
                        <td className={`${td} text-right tabular-nums`}>-{fmtAmt(p.discount)} / {fmtAmt(p.roundOff)}</td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>{fmtAmt(p.total)}</td>
                        <td className={`${td} text-right tabular-nums text-green-700`}>{fmtAmt(p.paid)}</td>
                        <td className={`${td} text-right tabular-nums`}>{fmtAmt(p.inProcess)}</td>
                        <td className={`${td} text-right tabular-nums ${p.outstanding > 0 ? "bg-amber-50 font-semibold text-amber-800" : ""}`}>
                          {p.outstanding === null ? "not approved" : fmtAmt(p.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
