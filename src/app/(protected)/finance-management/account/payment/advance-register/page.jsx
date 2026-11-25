"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

import HeaderWrapper    from "@/components/layout/HeaderWrapper";
import PageHeader       from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { EdoxMark }     from "@/components/common/EdoxLoader";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess }  from "@/helper/getPageAccess";
import { apiRequest }     from "@/lib/apiClient";
import { API_ENDPOINTS }  from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }   from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import AdvanceAdjustModal from "@/components/finance/account/payment/AdvanceAdjustModal";

const EP = API_ENDPOINTS.FINANCE.ADVANCE_ADJUSTMENT;
const PR_PATH = "/resource-management/sub-contractor-billing/payment-request";

/**
 * Vendor Advance Register — vendor-wise advance paid / adjusted against
 * bills / outstanding, with every advance request under its vendor.
 * Outstanding = approved advance payments − active Advance Adjustments
 * (it is what the Balance Sheet shows under "Advance to vendors").
 */
export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "payment", pageType: "LIST" });
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [data, setData]         = useState(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [search, setSearch]     = useState("");
  const [open, setOpen]         = useState({});         // vendorId → expanded
  const [adjustPr, setAdjustPr] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    if (!projectCode) return Promise.resolve();
    return apiRequest({
      url: `${EP.REGISTER}?projectCode=${projectCode}${onlyOpen ? "&outstandingOnly=1" : ""}`,
      method: "GET",
    })
      .then((res) => setData(res.data || { vendors: [], totals: {} }))
      .catch((err) => { toast.error(err.message || "Failed to load the advance register"); setData({ vendors: [], totals: {} }); });
  }, [projectCode, onlyOpen]);

  useEffect(() => { if (access.allowed) load(); }, [access.allowed, load, reloadKey]);

  const vendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.vendors || []).filter((v) => !q
      || (v.partyName || "").toLowerCase().includes(q)
      || (v.ledgerCode || "").toLowerCase().includes(q)
      || v.advances.some((a) => (a.prNo || "").toLowerCase().includes(q)));
  }, [data, search]);

  if (!access.allowed) return <PageNotAvailable />;

  const totals = data?.totals || {};
  const cell = "border border-[#dde] px-2 py-1";
  const num = `${cell} text-right tabular-nums`;

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[15px] font-semibold text-[#1c3a5e] mr-auto">Vendor Advance Register</h1>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor / PR No"
            className="border rounded-sm px-2 py-1.5 text-[12px] w-60" />
          <label className="flex items-center gap-1.5 text-[12px] text-gray-700">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
            Outstanding only
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border rounded-sm bg-white">
          {[
            { label: "Advance Requested (approved)", value: totals.requested },
            { label: "Advance Paid", value: totals.paid },
            { label: "Adjusted Against Bills", value: totals.adjusted },
            { label: "Outstanding Advance", value: totals.outstanding, strong: true },
          ].map((t) => (
            <div key={t.label} className="px-3 py-2 border-r last:border-r-0">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</div>
              <div className={`text-[14px] tabular-nums ${t.strong ? "font-bold text-purple-700" : "font-semibold text-gray-800"}`}>
                {formatAmount(t.value || 0)}
              </div>
            </div>
          ))}
        </div>

        {!data ? (
          <div className="flex justify-center items-center h-[200px]"><EdoxMark size={32} /></div>
        ) : vendors.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-gray-400 italic border rounded-sm bg-white">
            {onlyOpen ? "No vendor has an outstanding advance" : "No approved advance in this project"}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border rounded-sm">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-[#1c3a5e] text-white">
                <tr>
                  {["", "Vendor / Advance PR", "Date", "Requested", "Paid", "Adjusted", "Outstanding", "Bills Type", ""].map((h, i) => (
                    <th key={i} className={`border border-[#2a4e7c] px-2 py-1.5 font-semibold ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const isOpen = open[v.vendorId] ?? true;
                  return (
                    <Fragment key={v.vendorId}>
                      <tr className="bg-[#eef3fa] font-semibold cursor-pointer"
                        onClick={() => setOpen((o) => ({ ...o, [v.vendorId]: !isOpen }))}>
                        <td className={`${cell} w-6`}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td className={cell}>{v.partyName} <span className="text-gray-400 font-normal">{v.ledgerCode}</span></td>
                        <td className={cell}>{v.advances.length} advance{v.advances.length === 1 ? "" : "s"}</td>
                        <td className={num}>{formatAmount(v.requested)}</td>
                        <td className={num}>{formatAmount(v.paid)}</td>
                        <td className={num}>{formatAmount(v.adjusted)}</td>
                        <td className={`${num} text-purple-700`}>{formatAmount(v.outstanding)}</td>
                        <td className={cell} />
                        <td className={cell} />
                      </tr>
                      {isOpen && v.advances.map((a) => (
                        <tr key={a.paymentRequestId} className="hover:bg-gray-50">
                          <td className={cell} />
                          <td className={cell}>
                            <button type="button" className="text-blue-600 hover:underline"
                              onClick={() => router.push(`${PR_PATH}/${a.paymentRequestId}`)}>{a.prNo}</button>
                          </td>
                          <td className={cell}>{a.prDate ? getfmtDisplaydate(a.prDate) : "—"}</td>
                          <td className={num}>{formatAmount(a.netPayable)}</td>
                          <td className={num}>{formatAmount(a.paid)}</td>
                          <td className={num}>{formatAmount(a.adjusted)}</td>
                          <td className={`${num} font-semibold`}>{formatAmount(a.outstanding)}</td>
                          <td className={cell}>{a.adjustType === "JOURNAL" ? "Journals" : a.adjustType === "BRR" ? "Purchase Bills" : "—"}</td>
                          <td className={`${cell} text-right`}>
                            {a.outstanding > 0 && access.canAdd && (
                              <button type="button" onClick={() => setAdjustPr(a.paymentRequestId)}
                                className="px-2 py-0.5 text-[11px] border border-purple-600 text-purple-700 rounded-sm hover:bg-purple-50">
                                Adjust Against Bill
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-500">
          Outstanding = approved advance payments − advance adjusted against bills. It is shown on the Balance Sheet under
          “Advance to vendors”. One advance can be adjusted against many bills, in parts; all bills of one advance are of one type.
        </p>
      </div>

      <AdvanceAdjustModal
        open={!!adjustPr}
        onClose={() => setAdjustPr(null)}
        onDone={() => { setAdjustPr(null); setReloadKey((k) => k + 1); }}
        paymentRequestId={adjustPr}
      />
    </HeaderWrapper>
  );
}
