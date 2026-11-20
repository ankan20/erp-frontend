"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeftRight, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { useRouter } from "next/navigation";

const columns = [
  { header: "Sl. No",                  accessor: "sl" },
  { header: "Supplier ID",             accessor: "supplierCode" },
  { header: "Supplier / Concern Name", accessor: "supplierName" },
  { header: "Address",                 accessor: "address" },
  { header: "Mobile Number",           accessor: "mobileNumber" },
  { header: "Nature of Product",       accessor: "natureOfService" },
  { header: "Product Details / List",  accessor: "serviceDescriptionShort" },
];

// ── Pill chip ──────────────────────────────────────────────────────────────
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

// ── Inline searchable multi-select ─────────────────────────────────────────
const CHIP_PREVIEW = 3;

function InlineMultiSelect({ label, options, value, onChange, valueKey, labelKey, searchKeys, placeholder, loading: optLoading, disabled = false, disabledHint }) {
  const [search, setSearch]       = useState("");
  const [chipsExpanded, setChipsExpanded] = useState(false);

  const getLabel = (item) =>
    Array.isArray(labelKey)
      ? labelKey.map((k) => item[k]).filter(Boolean).join(" · ")
      : item[labelKey];

  const filtered = search.trim()
    ? options.filter((o) => {
        const keys = searchKeys?.length ? searchKeys : Array.isArray(labelKey) ? labelKey : [labelKey];
        return keys.some((k) => String(o[k] || "").toLowerCase().includes(search.toLowerCase()));
      })
    : options;

  const toggle = (item) => {
    const v = item[valueKey];
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    if (next.length <= CHIP_PREVIEW) setChipsExpanded(false);
    onChange(next);
  };

  const selected = options.filter((o) => value.includes(o[valueKey]));
  const visibleChips = chipsExpanded ? selected : selected.slice(0, CHIP_PREVIEW);
  const hiddenCount  = selected.length - CHIP_PREVIEW;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-red-400 hover:text-red-600 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/60 border border-blue-100 rounded-md min-h-[32px] overflow-hidden transition-all duration-300">
          {visibleChips.map((o) => (
            <Chip key={o[valueKey]} label={getLabel(o)} onRemove={() => toggle(o)} />
          ))}
          {!chipsExpanded && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setChipsExpanded(true)}
              className="inline-flex items-center gap-0.5 text-[11px] bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-indigo-200 transition-colors"
            >
              +{hiddenCount} more
            </button>
          )}
          {chipsExpanded && selected.length > CHIP_PREVIEW && (
            <button
              type="button"
              onClick={() => setChipsExpanded(false)}
              className="inline-flex items-center gap-0.5 text-[11px] bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5 font-semibold hover:bg-gray-200 transition-colors"
            >
              − less
            </button>
          )}
        </div>
      )}

      {/* Search */}
      {!disabled && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${placeholder || label}...`}
          className="h-8 w-full border border-gray-300 rounded-md px-3 text-[12px] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition"
        />
      )}

      {/* List */}
      <div className={`border rounded-md overflow-hidden ${disabled ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
        {disabled ? (
          <div className="px-3 py-6 text-[12px] text-gray-400 text-center">{disabledHint || "Disabled"}</div>
        ) : optLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin w-4 h-4 text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-gray-400 text-center">No results</div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto divide-y divide-gray-100">
            {filtered.map((item) => {
              const checked = value.includes(item[valueKey]);
              return (
                <button
                  key={item[valueKey]}
                  type="button"
                  onClick={() => toggle(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors ${
                    checked ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    checked ? "bg-blue-500 border-blue-500" : "border-gray-300"
                  }`}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className={`truncate ${checked ? "font-medium" : ""}`}>{getLabel(item)}</span>
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

// ── Migration panel ────────────────────────────────────────────────────────
// rawSuppliers — already fetched by the parent page, no double call needed
function MigrationPanel({ pageType, rawSuppliers, onSuccess }) {
  const [open, setOpen]                           = useState(false);
  const [projects, setProjects]                   = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [selectedProjects, setSelectedProjects]   = useState([]);
  const [loadingProjects, setLoadingProjects]     = useState(false);
  const [saving, setSaving]                       = useState(false);

  // Only fetch projects (suppliers come from parent)
  useEffect(() => {
    if (!open || projects.length) return;
    setLoadingProjects(true);
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjects(Array.isArray(res?.data) ? res.data : []))
      .catch((err) => toast.error(err?.message || "Failed to load projects"))
      .finally(() => setLoadingProjects(false));
  }, [open]);

  // When projects selection changes: auto-select suppliers already linked to those projects
  const handleProjectsChange = (ids) => {
    setSelectedProjects(ids);
    if (!ids.length) { setSelectedSuppliers([]); return; }
    // Collect supplierId of any supplier whose linkedProjects overlaps with ids
    const autoIds = rawSuppliers
      .filter((s) =>
        (s.linkedProjects || []).some((lp) => ids.includes(lp.projectId ?? lp.id))
      )
      .map((s) => s.supplierId);
    // Merge with any manually selected ones, dedup
    setSelectedSuppliers((prev) => [...new Set([...autoIds, ...prev.filter((id) => !autoIds.includes(id) && prev.includes(id))])]);
  };

  const handleSave = async () => {
    if (!selectedSuppliers.length || !selectedProjects.length) {
      toast.error("Select at least one supplier and one project");
      return;
    }
    setSaving(true);
    try {
      await apiRequest({
        url: API_ENDPOINTS.SUPPLIER.BULK_ASSIGN_PROJECTS,
        method: "POST",
        data: { supplierIds: selectedSuppliers, projectIds: selectedProjects },
      });
      toast.success("Migration successful");
      setSelectedSuppliers([]);
      setSelectedProjects([]);
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err?.message || "Migration failed");
    } finally {
      setSaving(false);
    }
  };

  const supplierOptions = rawSuppliers.map((s) => ({
    supplierId: s.supplierId,
    label: s.supplierName,
    code: s.supplierCode || "",
  }));

  // API returns `id`, not `projectId` — use `id` as the value key
  const projectOptions = projects.map((p) => ({
    id: p.id,
    label: `${p.projectCode} — ${p.projectName}`,
    state: p.state || "",
  }));

  return (
    <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => !saving && setOpen((p) => !p)}
        disabled={saving}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} className="text-blue-600" />
          <span className="text-[13px] font-semibold text-blue-800">Migrate Suppliers to Projects</span>
          {(selectedSuppliers.length > 0 || selectedProjects.length > 0) && !open && (
            <span className="text-[11px] bg-blue-600 text-white rounded-full px-2 py-0.5">
              {selectedSuppliers.length}S · {selectedProjects.length}P
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-blue-600" /> : <ChevronDown size={15} className="text-blue-600" />}
      </button>

      {/* Body */}
      {open && (
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InlineMultiSelect
              label="Projects"
              options={projectOptions}
              value={selectedProjects}
              onChange={handleProjectsChange}
              valueKey="id"
              labelKey="label"
              searchKeys={["label", "state"]}
              placeholder="projects"
              loading={loadingProjects}
              disabled={saving}
            />
            <InlineMultiSelect
              label="Suppliers"
              options={supplierOptions}
              value={selectedSuppliers}
              onChange={setSelectedSuppliers}
              valueKey="supplierId"
              labelKey={["label", "code"]}
              searchKeys={["label", "code"]}
              placeholder="suppliers"
              loading={false}
              disabled={saving || selectedProjects.length === 0}
              disabledHint="Select a project first"
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-[11px] text-gray-400">
              Assign{" "}
              <strong className="text-gray-600">{selectedSuppliers.length} supplier{selectedSuppliers.length !== 1 ? "s" : ""}</strong>
              {" "}to{" "}
              <strong className="text-gray-600">{selectedProjects.length} project{selectedProjects.length !== 1 ? "s" : ""}</strong>
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedSuppliers.length || !selectedProjects.length}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />}
              {saving ? "Saving…" : "Migrate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SettingsSupplierListPage({ pageType, pageLabel }) {
  const router = useRouter();
  const [rawSuppliers, setRawSuppliers] = useState([]);
  const [data, setData]         = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading]   = useState(true);

  const actions = getPageActions({ router });

  const fetchSuppliers = async () => {
    try {
      const res = await apiRequest({
        url: API_ENDPOINTS.SUPPLIER.LIST,
        method: "GET",
        params: { supplierType: pageType },
      });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRawSuppliers(list);
      const formatted = list.map((s, i) => ({
        ...s,
        sl: i + 1,
        address: s.registeredAddress || s.corporateAddress || "—",
        serviceDescriptionShort: s.serviceDescription
          ? s.serviceDescription.length > 40
            ? s.serviceDescription.slice(0, 40) + "…"
            : s.serviceDescription
          : "—",
        natureOfService: Array.isArray(s.natureOfService)
          ? s.natureOfService.join(", ") || "—"
          : s.natureOfService || "—",
      }));
      setData(formatted);
      setFiltered(formatted);
    } catch (err) {
      toast.error(err?.message || "Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [pageType]);

  const handleSearch = ({ search }) => {
    if (!search) { setFiltered(data); return; }
    const q = search.toLowerCase();
    setFiltered(
      data.filter((r) =>
        [r.supplierName, r.supplierCode, r.address, r.mobileNumber, r.natureOfService]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <MigrationPanel pageType={pageType} rawSuppliers={rawSuppliers} onSuccess={fetchSuppliers} />
        <SearchSection onSearch={handleSearch} />
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(row) =>
            router.push(
              `/master/contact-dairy/${
                pageType === "Work_Force" ? "work-force"
                : pageType === "Plant_Machinery" ? "plant-machinery"
                : "materials"
              }/${row.supplierId}`
            )
          }
        />
      </div>
    </HeaderWrapper>
  );
}
