"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
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
import { getLocalStorage } from "@/lib/localStorage";
import { FilterLabel } from "@/components/finance/report/accounting/shared";

export default function OpeningBalancePage() {
  const access = getPageAccess({ pageCode: "accounting_opening_balance", pageType: "LIST" });
  const router = useRouter();
  const actions = usePageActions({ router });

  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";

  const [fyList, setFyList] = useState([]);
  const [ccList, setCcList] = useState([]);
  const [vendorList, setVendorList] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [projectList, setProjectList] = useState([]);

  const [selectedFy, setSelectedFy] = useState("");
  const [accountType, setAccountType] = useState("CC");
  const [accountId, setAccountId] = useState("");
  const [drCr, setDrCr] = useState("Dr");
  const [amount, setAmount] = useState("");
  const [projectCode, setProjectCode] = useState(defaultProject);
  const [narration, setNarration] = useState("");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    Promise.all([
      apiRequest({ url: API_ENDPOINTS.FINANCE.ACCOUNTING.FINANCIAL_YEAR, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_CC_CODE, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" }),
      apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" }),
    ]).then(([fy, cc, v, b, p]) => {
      const fyData = fy?.data || [];
      setFyList(fyData);
      setCcList(cc?.data || []);
      setVendorList(v?.data || []);
      setBankList(b?.data || []);
      setProjectList(p?.data || []);
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

  const handleDelete = (id) => {
    setConfirm({
      title: "Delete this opening balance entry?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: async () => {
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
      },
    });
  };

  const fyOptions = fyList.map((f) => ({
    id: String(f.id),
    label: f.fyCode || `FY ${f.id}`,
  }));


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <h2 className="text-[15px] font-bold text-[#144664]">Central Accounting — Opening Balances</h2>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Financial Year</FilterLabel>
            <div className="w-[160px]">
              <SearchableSelect
                options={fyOptions}
                value={selectedFy}
                onChange={setSelectedFy}
                labelKey="label"
                valueKey="id"
                placeholder="Select FY"
                searchKeys={["label"]}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <div className="w-[200px]">
              <SearchableSelect
                options={projectList}
                value={projectCode}
                onChange={(val) => setProjectCode(val)}
                labelKey={["projectCode", "projectName"]}
                labelSeparator=" : "
                valueKey="projectCode"
                placeholder="All Projects"
                clearLabel="— All Projects —"
                searchKeys={["projectCode", "projectName"]}
              />
            </div>
          </div>
        </div>

        {/* Entry Form */}
        <div className="border border-[#d1d5db] bg-[#f8f9fb] p-3 space-y-2">
          <h3 className="text-[12px] font-bold text-[#144664]">Add Opening Balance</h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FilterLabel>Account Type</FilterLabel>
              <select
                value={accountType}
                onChange={(e) => { setAccountType(e.target.value); setAccountId(""); }}
                className="h-[28px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
              >
                <option value="CC">CC Code</option>
                <option value="Vendor">Vendor / Customer</option>
                <option value="BankCash">Bank / Cash</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <FilterLabel>Account</FilterLabel>
              <div className="w-[240px]">
                <SearchableSelect
                  options={accountOptions}
                  value={accountId}
                  onChange={setAccountId}
                  labelKey={accountLabelKey}
                  labelSeparator=" : "
                  valueKey={accountValueKey}
                  placeholder="Select account…"
                  searchKeys={accountLabelKey}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FilterLabel>Dr / Cr</FilterLabel>
              <select
                value={drCr}
                onChange={(e) => setDrCr(e.target.value)}
                className="h-[28px] w-[70px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white focus:border-[#1b2f3a] focus:outline-none transition-colors"
              >
                <option value="Dr">Dr</option>
                <option value="Cr">Cr</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <FilterLabel>Amount</FilterLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-[28px] w-[130px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white text-right tabular-nums focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <FilterLabel>Narration</FilterLabel>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Optional note"
                className="h-[28px] w-[180px] border border-[#d1d5db] px-2 text-[12px] text-[#374151] bg-white placeholder:text-[#9ca3af] focus:border-[#1b2f3a] focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-[5px] bg-[#1b2f3a] hover:bg-[#263f4d] text-white text-[12px] font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Save
            </button>
          </div>
        </div>

        {/* Entries Table */}
        {loading ? (
          <div className="flex justify-center items-center h-[200px]">
            <EdoxMark size={32} />
          </div>
        ) : !entries.length ? (
          <div className="text-center text-[#9ca3af] text-[12px] py-10">
            No opening balances for the selected financial year
          </div>
        ) : (
          <>
            <span className="text-[11.5px] text-[#6b7280]">{entries.length} entr{entries.length !== 1 ? "ies" : "y"}</span>
            <div className="border border-[#d1d5db] overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#1b2f3a]">
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[36px]">#</th>
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Account Type</th>
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Account</th>
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[80px]">Project</th>
                    <th className="px-2 py-[6px] text-center font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[55px]">Dr/Cr</th>
                    <th className="px-2 py-[6px] text-right font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[110px]">Amount</th>
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a]">Narration</th>
                    <th className="px-2 py-[6px] text-left font-medium text-white text-[11px] border-r border-[#2a4a5a] w-[80px]">FY</th>
                    <th className="px-2 py-[6px] text-center font-medium text-white text-[11px] w-[50px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`border-b border-[#e5e7eb] ${i % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"} hover:bg-[#f0f4f8] transition-colors`}
                    >
                      <td className="px-2 py-[4px] text-[#6b7280] border-r border-[#f0f0f0]">{i + 1}</td>
                      <td className="px-2 py-[4px] text-[#374151] border-r border-[#f0f0f0]">{e.accountType}</td>
                      <td className="px-2 py-[4px] font-medium text-[#374151] border-r border-[#f0f0f0]">{e.accountName}</td>
                      <td className="px-2 py-[4px] text-[#374151] border-r border-[#f0f0f0]">{e.projectCode || "—"}</td>
                      <td className="px-2 py-[4px] text-center border-r border-[#f0f0f0]">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${
                          e.drCr === "Dr"
                            ? "bg-[#fef3c7] text-[#b45309]"
                            : "bg-[#d1fae5] text-[#065f46]"
                        }`}>
                          {e.drCr}
                        </span>
                      </td>
                      <td className="px-2 py-[4px] text-right tabular-nums text-[#374151] border-r border-[#f0f0f0]">{formatAmount(e.amount)}</td>
                      <td className="px-2 py-[4px] text-[#6b7280] border-r border-[#f0f0f0]">{e.narration || "—"}</td>
                      <td className="px-2 py-[4px] text-[#374151] border-r border-[#f0f0f0]">{e.fyCode || "—"}</td>
                      <td className="px-2 py-[4px] text-center">
                        <button
                          onClick={() => handleDelete(e.id)}
                          disabled={deleting === e.id}
                          className="text-[#ef4444] hover:text-[#dc2626] disabled:opacity-40"
                          title="Delete"
                        >
                          {deleting === e.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </HeaderWrapper>
  );
}
