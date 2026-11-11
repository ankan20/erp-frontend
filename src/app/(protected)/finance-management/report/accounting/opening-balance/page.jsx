"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import SearchableSelect from "@/components/common/SearchableSelect";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";
import { fmtDate } from "@/components/finance/report/accounting/shared";

export default function OpeningBalancePage() {
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();
  const actions = usePageActions({ router });

  const [fyList, setFyList] = useState([]);
  const [ccList, setCcList] = useState([]);
  const [vendorList, setVendorList] = useState([]);
  const [bankList, setBankList] = useState([]);

  const [selectedFy, setSelectedFy] = useState("");
  const [accountType, setAccountType] = useState("CC");
  const [accountId, setAccountId] = useState("");
  const [drCr, setDrCr] = useState("Dr");
  const [amount, setAmount] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [narration, setNarration] = useState("");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.FINANCE.ACCOUNTING.FINANCIAL_YEAR, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" }),
    ]).then(([fy, cc, v, b]) => {
      const fyData = fy?.data || [];
      setFyList(fyData);
      setCcList(cc?.data || []);
      setVendorList(v?.data || []);
      setBankList(b?.data || []);
      const active = fyData.find((f) => f.isCurrent);
      if (active) setSelectedFy(String(active.id));
    }).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!selectedFy) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("financial_year_id", selectedFy);
      if (projectCode) params.set("project_code", projectCode);
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.OPENING_BALANCE}?${params}`,
        method: "GET",
      });
      setEntries(res?.data || []);
    } catch (err) {
      toast.error(err?.message || "Failed to load opening balances");
    } finally {
      setLoading(false);
    }
  }, [selectedFy, projectCode]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const accountOptions =
    accountType === "CC" ? ccList
    : accountType === "Vendor" ? vendorList
    : bankList;

  const accountLabelKey =
    accountType === "CC" ? ["ccCode", "ccName"]
    : accountType === "Vendor" ? ["ledgerCode", "ledgerName"]
    : ["bankCode", "bankName"];

  const accountValueKey =
    accountType === "CC" ? "ccId"
    : accountType === "Vendor" ? "ledgerId"
    : "id";

  const handleSave = async () => {
    if (!selectedFy) { toast.error("Select a financial year"); return; }
    if (!accountId) { toast.error("Select an account"); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; }

    setSaving(true);
    try {
      await apiRequest({
        url: API_ENDPOINTS.FINANCE.ACCOUNTING.OPENING_BALANCE,
        method: "POST",
        data: {
          financial_year_id: parseInt(selectedFy, 10),
          account_type: accountType,
          account_id: parseInt(accountId, 10),
          dr_cr: drCr,
          amount: parseFloat(amount),
          project_code: projectCode || null,
          narration: narration || null,
        },
      });
      toast.success("Opening balance saved");
      setAccountId("");
      setAmount("");
      setNarration("");
      fetchEntries();
    } catch (err) {
      toast.error(err?.message || "Failed to save opening balance");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this opening balance entry?")) return;
    setDeleting(id);
    try {
      await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.ACCOUNTING.OPENING_BALANCE}/${id}`,
        method: "DELETE",
      });
      toast.success("Opening balance deleted");
      fetchEntries();
    } catch (err) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const fyOptions = fyList.map((f) => ({
    id: String(f.id),
    label: f.fyCode || `FY ${f.id}`,
  }));

  const defaultProject = typeof window !== "undefined"
    ? localStorage.getItem("selected_project") || ""
    : "";

  useEffect(() => {
    if (defaultProject && !projectCode) setProjectCode(defaultProject);
  }, [defaultProject]);


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-4 space-y-5">
        <h1 className="text-lg font-bold text-[#1a1a4e]">Opening Balances</h1>

        {/* ─── Filter Bar ──────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3 bg-[#f5f5fa] p-3 rounded-sm border border-[#ddd]">
          <div>
            <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Financial Year</label>
            <SearchableSelect
              options={fyOptions}
              value={selectedFy}
              onChange={setSelectedFy}
              labelKey="label"
              valueKey="id"
              placeholder="Select FY"
              searchKeys={["label"]}
              className="w-[180px]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Project Code</label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              placeholder="e.g. P001"
              className="h-8 w-[120px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>
        </div>

        {/* ─── Entry Form ──────────────────────────────────── */}
        <div className="bg-white border border-[#ccc] rounded-sm p-4 space-y-3">
          <h2 className="text-[13px] font-bold text-[#1a1a4e]">Add Opening Balance</h2>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => { setAccountType(e.target.value); setAccountId(""); }}
                className="h-8 w-[130px] border border-[#8f8f8f] px-2 text-sm rounded-sm bg-white"
              >
                <option value="CC">CC Code</option>
                <option value="Vendor">Vendor / Customer</option>
                <option value="BankCash">Bank / Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Account</label>
              <SearchableSelect
                options={accountOptions}
                value={accountId}
                onChange={setAccountId}
                labelKey={accountLabelKey}
                valueKey={accountValueKey}
                placeholder="Select account"
                searchKeys={accountLabelKey}
                className="w-[240px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Dr / Cr</label>
              <select
                value={drCr}
                onChange={(e) => setDrCr(e.target.value)}
                className="h-8 w-[80px] border border-[#8f8f8f] px-2 text-sm rounded-sm bg-white"
              >
                <option value="Dr">Dr</option>
                <option value="Cr">Cr</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-8 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm text-right"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-0.5">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Optional note"
                className="h-8 w-[200px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Save
            </button>
          </div>
        </div>

        {/* ─── Existing Entries Table ──────────────────────── */}
        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !entries.length ? (
          <div className="text-center text-gray-400 text-[13px] py-10">
            No opening balances for the selected financial year
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#ccc] rounded-sm">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-[#e8e8f0]">
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">#</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Account Type</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Account</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Project</th>
                  <th className="px-3 py-2 text-center font-semibold border-b border-[#bbb]">Dr/Cr</th>
                  <th className="px-3 py-2 text-right font-semibold border-b border-[#bbb]">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">Narration</th>
                  <th className="px-3 py-2 text-left font-semibold border-b border-[#bbb]">FY</th>
                  <th className="px-3 py-2 text-center font-semibold border-b border-[#bbb]">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff]`}
                  >
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{e.accountType}</td>
                    <td className="px-3 py-1.5 font-medium">{e.accountName}</td>
                    <td className="px-3 py-1.5">{e.projectCode || "—"}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        e.drCr === "Dr"
                          ? "bg-[#fff3e0] text-[#e65100]"
                          : "bg-[#e0f2f1] text-[#00695c]"
                      }`}>
                        {e.drCr}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatAmount(e.amount)}</td>
                    <td className="px-3 py-1.5 text-gray-600">{e.narration || "—"}</td>
                    <td className="px-3 py-1.5">{e.fyCode || "—"}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        title="Delete"
                      >
                        {deleting === e.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HeaderWrapper>
  );
}
