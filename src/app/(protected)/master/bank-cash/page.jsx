"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeftRight, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { toast } from "sonner";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const BC = API_ENDPOINTS.MASTER.BANK_CASH;

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
      {label}
      <button type="button" onClick={onRemove} className="text-blue-400 hover:text-red-500 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

// ── Project multi-select (left panel) ─────────────────────────────────────────
const CHIP_PREVIEW = 3;
function ProjectMultiSelect({ options, value, onChange, loading, disabled }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (id) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    if (next.length <= CHIP_PREVIEW) setExpanded(false);
    onChange(next);
  };

  const selected = options.filter((o) => value.includes(o.id));
  const visible  = expanded ? selected : selected.slice(0, CHIP_PREVIEW);
  const hidden   = selected.length - CHIP_PREVIEW;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Projects</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">Clear all</button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/60 border border-blue-100 rounded-md min-h-[32px]">
          {visible.map((o) => (
            <Chip key={o.id} label={o.label} onRemove={() => toggle(o.id)} />
          ))}
          {!expanded && hidden > 0 && (
            <button type="button" onClick={() => setExpanded(true)}
              className="inline-flex items-center text-[11px] bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-indigo-200 transition-colors">
              +{hidden} more
            </button>
          )}
          {expanded && selected.length > CHIP_PREVIEW && (
            <button type="button" onClick={() => setExpanded(false)}
              className="inline-flex items-center text-[11px] bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-gray-200 transition-colors">
              − less
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="h-8 w-full border border-gray-300 rounded-md px-3 text-[12px] outline-none focus:border-blue-400 transition" />
      )}

      <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin w-4 h-4 text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-gray-400 text-center">No results</div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-100">
            {filtered.map((item) => {
              const checked = value.includes(item.id);
              return (
                <button key={item.id} type="button" onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${checked ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${checked ? "font-medium" : ""}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400">{value.length} selected</p>
    </div>
  );
}

// ── Account multi-select (right panel) ───────────────────────────────────────
function AccountMultiSelect({ options, value, onChange, selectedProjectIds, disabled, disabledHint }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = search.trim()
    ? options.filter((o) => [o.label, o.type].some((f) => f?.toLowerCase().includes(search.toLowerCase())))
    : options;

  const toggle = (id) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    if (next.length <= CHIP_PREVIEW) setExpanded(false);
    onChange(next);
  };

  const selected = options.filter((o) => value.includes(o.id));
  const visible  = expanded ? selected : selected.slice(0, CHIP_PREVIEW);
  const hidden   = selected.length - CHIP_PREVIEW;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Bank / Cash Accounts</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">Clear all</button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/60 border border-blue-100 rounded-md min-h-[32px]">
          {visible.map((o) => (
            <Chip key={o.id} label={`${o.label} [${o.type}]`} onRemove={() => toggle(o.id)} />
          ))}
          {!expanded && hidden > 0 && (
            <button type="button" onClick={() => setExpanded(true)}
              className="inline-flex items-center text-[11px] bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-indigo-200 transition-colors">
              +{hidden} more
            </button>
          )}
          {expanded && selected.length > CHIP_PREVIEW && (
            <button type="button" onClick={() => setExpanded(false)}
              className="inline-flex items-center text-[11px] bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-gray-200 transition-colors">
              − less
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="h-8 w-full border border-gray-300 rounded-md px-3 text-[12px] outline-none focus:border-blue-400 transition" />
      )}

      <div className={`border rounded-md overflow-hidden ${disabled ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
        {disabled ? (
          <div className="px-3 py-6 text-[12px] text-gray-400 text-center">{disabledHint}</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-gray-400 text-center">No results</div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-100">
            {filtered.map((item) => {
              const checked = value.includes(item.id);

              // which of the selected projects is this account already linked to?
              const alreadyIn = selectedProjectIds.length > 0
                ? item.projects.filter((p) => selectedProjectIds.includes(p.id))
                : [];
              const allLinked = alreadyIn.length === selectedProjectIds.length && selectedProjectIds.length > 0;

              return (
                <button key={item.id} type="button" onClick={() => toggle(item.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${checked ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[12px] truncate ${checked ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                        {item.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        item.type === "BANK" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-700"
                      }`}>
                        {item.type}
                      </span>
                    </div>

                    {alreadyIn.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {alreadyIn.map((p) => (
                          <span key={p.id}
                            className={`inline-flex items-center gap-0.5 text-[10px] rounded-full px-2 py-0.5 font-medium ${
                              allLinked
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                            }`}>
                            <Check size={8} strokeWidth={3} />
                            {p.projectCode}
                          </span>
                        ))}
                        {allLinked
                          ? <span className="text-[10px] text-green-600 font-medium">all selected</span>
                          : <span className="text-[10px] text-yellow-600 font-medium">partial</span>
                        }
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400">{value.length} selected</p>
    </div>
  );
}

// ── Migration panel ───────────────────────────────────────────────────────────
function MigrationPanel({ rawAccounts, onSuccess }) {
  const [open, setOpen]                       = useState(false);
  const [projects, setProjects]               = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [loadingProjects, setLoadingProjects]   = useState(false);
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    if (!open || projects.length) return;
    setLoadingProjects(true);
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjects(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => toast.error(err?.message || "Failed to load projects"))
      .finally(() => setLoadingProjects(false));
  }, [open]);

  const handleSave = async () => {
    if (!selectedAccounts.length || !selectedProjects.length) {
      toast.error("Select at least one account and one project");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest({
        url: BC.MIGRATE,
        method: "POST",
        data: { bankCashIds: selectedAccounts, projectIds: selectedProjects },
      });
      const { linked = 0, skipped = 0 } = res.data?.[0] || {};
      toast.success(`Migration done — ${linked} linked, ${skipped} already existed`);
      setSelectedAccounts([]);
      setSelectedProjects([]);
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err?.message || "Migration failed");
    } finally {
      setSaving(false);
    }
  };

  const projectOptions = projects.map((p) => ({
    id:    p.id,
    label: `${p.projectCode} — ${p.projectName}`,
  }));

  const accountOptions = rawAccounts.map((a) => ({
    id:       a.id,
    label:    `${a.bankCode} — ${a.bankHolderName}`,
    type:     a.type,
    projects: a._raw?.projects || [],
  }));

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button type="button" onClick={() => !saving && setOpen((p) => !p)} disabled={saving}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors disabled:opacity-70">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} className="text-blue-600" />
          <span className="text-[13px] font-semibold text-blue-800">Migrate Bank/Cash to Projects</span>
          {(selectedAccounts.length > 0 || selectedProjects.length > 0) && !open && (
            <span className="text-[11px] bg-blue-600 text-white rounded-full px-2 py-0.5">
              {selectedAccounts.length}A · {selectedProjects.length}P
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-blue-600" /> : <ChevronDown size={15} className="text-blue-600" />}
      </button>

      {open && (
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProjectMultiSelect
              options={projectOptions}
              value={selectedProjects}
              onChange={setSelectedProjects}
              loading={loadingProjects}
              disabled={saving}
            />
            <AccountMultiSelect
              options={accountOptions}
              value={selectedAccounts}
              onChange={setSelectedAccounts}
              selectedProjectIds={selectedProjects}
              disabled={saving || selectedProjects.length === 0}
              disabledHint="Select a project first"
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-[11px] text-gray-400">
              Link{" "}
              <strong className="text-gray-600">{selectedAccounts.length} account{selectedAccounts.length !== 1 ? "s" : ""}</strong>
              {" "}to{" "}
              <strong className="text-gray-600">{selectedProjects.length} project{selectedProjects.length !== 1 ? "s" : ""}</strong>
            </p>
            <button type="button" onClick={handleSave}
              disabled={saving || !selectedAccounts.length || !selectedProjects.length}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />}
              {saving ? "Saving…" : "Migrate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── List page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const router  = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  const [rawAccounts,  setRawAccounts]  = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const fetchList = async () => {
    try {
      const res = await apiRequest({ url: BC.LIST, method: "GET" });
      const list = (res.data || []).map((item, index) => ({
        id:                   item.id,
        sl:                   index + 1,
        type:                 item.type,
        bankCode:             item.bankCode,
        bankHolderName:       item.bankHolderName,
        bankAcNumber:         item.bankAcNumber         || "—",
        bankName:             item.bankName             || "—",
        branchName:           item.branchName           || "—",
        ifscCode:             item.ifscCode             || "—",
        branchManagerName:    item.branchManagerName    || "—",
        branchManagerContact: item.branchManagerContact || "—",
        status:               item.status,
        _raw:                 item,
      }));
      setRawAccounts(list);
      setFilteredData(list);
    } catch (err) {
      toast.error(err.message || "Failed to fetch bank/cash list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(rawAccounts); return; }
    setFilteredData(
      rawAccounts.filter((item) =>
        Object.values(item).some((val) => String(val).toLowerCase().includes(search.toLowerCase()))
      )
    );
  };

  const columns = [
    { header: "Sl. No",           accessor: "sl" },
    { header: "Type",             accessor: "type" },
    { header: "Bank Code",        accessor: "bankCode" },
    { header: "Bank Holder Name", accessor: "bankHolderName" },
    { header: "A/c Number",       accessor: "bankAcNumber" },
    { header: "Bank Name",        accessor: "bankName" },
    { header: "Branch Name",      accessor: "branchName" },
    { header: "IFSC Code",        accessor: "ifscCode" },
    { header: "Branch Manager",   accessor: "branchManagerName" },
    { header: "Manager Contact",  accessor: "branchManagerContact" },
    { header: "Status",           accessor: "status" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          actions={
            canEdit
              ? [{ label: "+ New Bank/Cash", onClick: () => router.push("/master/bank-cash/new") }]
              : []
          }
        />

        {canEdit && (
          <MigrationPanel rawAccounts={rawAccounts} onSuccess={fetchList} />
        )}

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => router.push(`/master/bank-cash/${row.id}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
