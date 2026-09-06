"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter }                                  from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast }                                      from "sonner";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMSelect        from "@/components/project-management/common/PMSelect";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMInput         from "@/components/project-management/common/PMInput";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";

const LABEL_W = "sm:w-[130px] sm:min-w-[130px]";
const BASE    = API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.BASE;

const FUND_OPTIONS = [
  { value: "Cash",     label: "Cash"      },
  { value: "Bank/UPI", label: "Bank / UPI" },
];

const STATUS_STYLES = {
  approved: "bg-green-100 text-green-700",
  draft:    "bg-gray-100  text-gray-600",
  reback:   "bg-amber-100 text-amber-700",
  rejected: "bg-red-100   text-red-600",
};
function StatusBadge({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const cls = key.startsWith("pending")
    ? "bg-blue-100 text-blue-700"
    : (STATUS_STYLES[key] || "bg-gray-100 text-gray-600");
  return (
    <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// Normalize IDs to string to avoid int/string type mismatch across API responses
const sid = (v) => String(v ?? "");

// ─── snapshot helper ──────────────────────────────────────────────────────────
function snapshotFromLines(lines = []) {
  return {
    items:  new Set(lines.map((l) => sid(l.docketDetailId))),
    docket: lines.length > 0 ? sid(lines[0].docketVoucherId) : null,
  };
}

// ─── CC-wise grouped Cash panel ──────────────────────────────────────────────
function CashPanel({ dockets, selectedItems, onToggleItem, onToggleCc }) {
  const [expanded, setExpanded] = useState({});

  const ccGroups = useMemo(() => {
    const map = {};
    dockets.forEach((doc) => {
      (doc.rows || []).forEach((row) => {
        const key = row.ccCode;
        if (!map[key]) map[key] = { ccCode: row.ccCode, ccName: row.ccName, rows: [] };
        map[key].rows.push({
          ...row,
          _sid:            sid(row.docketDetailId),
          docketVoucherId: doc.docketVoucherId,
          docketNo:        doc.voucherNo,
          docketDate:      doc.voucherDate,
        });
      });
    });
    return Object.values(map);
  }, [dockets]);

  const activeCc = useMemo(() => {
    for (const grp of ccGroups) {
      if (grp.rows.some((r) => selectedItems.has(r._sid))) return grp.ccCode;
    }
    return null;
  }, [ccGroups, selectedItems]);

  const totalSelected = useMemo(() => {
    let sum = 0;
    ccGroups.forEach((grp) =>
      grp.rows.forEach((r) => { if (selectedItems.has(r._sid)) sum += Number(r.amount || 0); })
    );
    return sum;
  }, [ccGroups, selectedItems]);

  if (!dockets.length) {
    return (
      <div className="flex items-center justify-center h-[160px] text-gray-400 text-[13px]">
        No approved Cash docket vouchers available
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {activeCc && (
        <div className="px-3 py-1.5 bg-[#fffbe6] border-b border-[#e8d89a] text-[11px] text-amber-700">
          All items must share the same CC code. Currently locked to: <strong>{activeCc}</strong>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[500px]">
          <thead className="bg-[#144664]">
            <tr>
              <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[36px]" />
              <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[80px]">CC Code</th>
              <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-left">CC Name / Description</th>
              <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[120px]">Docket No</th>
              <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-right w-[110px]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ccGroups.map((grp) => {
              const grpSids    = grp.rows.map((r) => r._sid);
              const selCount   = grpSids.filter((s) => selectedItems.has(s)).length;
              const allSel     = selCount === grpSids.length;
              const partialSel = selCount > 0 && !allSel;
              const isOpen     = expanded[grp.ccCode] ?? true;
              const grpTotal   = grp.rows.reduce((s, r) => s + Number(r.amount || 0), 0);
              const isLocked   = activeCc && activeCc !== grp.ccCode;

              return (
                <React.Fragment key={`grp-${grp.ccCode}`}>
                  {/* CC group header row */}
                  <tr
                    className={`bg-[#eef5fb] hover:bg-[#e0eef8] cursor-pointer ${isLocked ? "opacity-40 pointer-events-none" : ""}`}
                    onClick={() => setExpanded((prev) => ({ ...prev, [grp.ccCode]: !isOpen }))}
                  >
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSel}
                        ref={(el) => { if (el) el.indeterminate = partialSel; }}
                        onChange={(e) => { e.stopPropagation(); onToggleCc(grpSids, e.target.checked); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 accent-[#144664] cursor-pointer"
                      />
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-center text-[11px] font-bold text-[#144664]">
                      {grp.ccCode}
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        {isOpen
                          ? <ChevronDown size={12} className="text-gray-400 shrink-0" />
                          : <ChevronRight size={12} className="text-gray-400 shrink-0" />}
                        <span className="text-[12px] font-semibold text-gray-700">{grp.ccName}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({grp.rows.length} item{grp.rows.length !== 1 ? "s" : ""})</span>
                      </div>
                    </td>
                    <td className="border border-[#d0d0d0] px-2 py-1.5" />
                    <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-[12px] font-semibold text-gray-700">
                      {formatAmount(grpTotal)}
                    </td>
                  </tr>

                  {/* CC child rows — indented under the group header */}
                  {isOpen && grp.rows.map((row, ri) => {
                    const isSel = selectedItems.has(row._sid);
                    return (
                      <tr
                        key={`row-${sid(row.docketVoucherId)}-${row._sid}`}
                        onClick={() => !isLocked && onToggleItem(row._sid)}
                        className={`cursor-pointer transition-colors
                          ${isSel ? "bg-[#ebf5ff]" : ri % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
                          hover:bg-[#e8f4fd] ${isLocked ? "opacity-40 pointer-events-none" : ""}`}
                      >
                        {/* Indented checkbox — pl-5 shifts child visually right of parent */}
                        <td className="border border-[#d0d0d0] py-1 text-center pl-5 pr-2">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => onToggleItem(row._sid)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 accent-[#144664] cursor-pointer"
                          />
                        </td>
                        {/* Connector indicator instead of repeating CC Code */}
                        <td className="border border-[#d0d0d0] px-1 py-1 text-center">
                          <span className="text-gray-300 text-[13px] leading-none select-none">└</span>
                        </td>
                        {/* Description — indented with left padding */}
                        <td className="border border-[#d0d0d0] pl-4 pr-2 py-1 text-[11px] text-gray-600">
                          {row.shortDescription || "—"}
                        </td>
                        <td className="border border-[#d0d0d0] px-2 py-1 text-center text-[11px] text-[#144664] font-medium">
                          {row.docketNo}
                        </td>
                        <td className="border border-[#d0d0d0] px-2 py-1 text-right text-[12px] font-mono text-gray-700">
                          {formatAmount(row.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#d6e6f2] font-semibold">
              <td colSpan={4} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">
                {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected — TOTAL =
              </td>
              <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                {totalSelected > 0 ? formatAmount(totalSelected) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Bank single-select panel ─────────────────────────────────────────────────
function BankPanel({ dockets, selectedDocketSid, onSelect }) {
  if (!dockets.length) {
    return (
      <div className="flex items-center justify-center h-[160px] text-gray-400 text-[13px]">
        No approved Bank/UPI docket vouchers available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[500px]">
        <thead className="bg-[#144664]">
          <tr>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[36px]" />
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[130px]">Voucher No</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[90px]">Date</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-left">CC Names</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-right w-[120px]">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {dockets.map((doc, di) => {
            const docSid = sid(doc.docketVoucherId);
            const isSel  = selectedDocketSid === docSid;
            return (
              <React.Fragment key={`doc-${docSid}`}>
                <tr
                  onClick={() => onSelect(docSid)}
                  className={`cursor-pointer transition-colors
                    ${isSel ? "bg-[#ebf5ff]" : di % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
                    hover:bg-[#e8f4fd]`}
                >
                  <td className="border border-[#d0d0d0] px-2 py-1.5 text-center">
                    <input
                      type="radio"
                      checked={isSel}
                      onChange={() => onSelect(docSid)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-[#144664] cursor-pointer"
                    />
                  </td>
                  <td className="border border-[#d0d0d0] px-2 py-1.5 text-center text-[12px] font-semibold text-[#144664]">
                    {doc.voucherNo}
                  </td>
                  <td className="border border-[#d0d0d0] px-2 py-1.5 text-center text-[11px] text-gray-500">
                    {doc.voucherDate ? new Date(doc.voucherDate).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="border border-[#d0d0d0] px-2 py-1.5 text-[11px] text-gray-600">
                    {(doc.rows || []).map((r) => r.ccName).filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="border border-[#d0d0d0] px-2 py-1.5 text-right text-[12px] font-mono font-semibold">
                    {formatAmount(doc.totalAmount || 0)}
                  </td>
                </tr>

                {/* Expanded rows when selected */}
                {isSel && (doc.rows || []).length > 0 && (doc.rows || []).map((row, ri) => (
                  <tr key={`row-${sid(row.docketDetailId)}`} className={ri % 2 === 0 ? "bg-[#f5fbff]" : "bg-[#edf6ff]"}>
                    <td className="border border-[#d0d0d0]" />
                    <td className="border border-[#d0d0d0] px-2 py-1 text-center text-[10px] text-gray-400 font-mono">{row.ccCode}</td>
                    <td className="border border-[#d0d0d0] px-2 py-1 text-[11px] text-gray-500 italic">all rows included</td>
                    <td className="border border-[#d0d0d0] px-2 py-1 text-[11px] text-gray-600">{row.ccName}</td>
                    <td className="border border-[#d0d0d0] px-2 py-1 text-right text-[11px] font-mono">{formatAmount(row.amount)}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
        {selectedDocketSid && (
          <tfoot>
            <tr className="bg-[#d6e6f2] font-semibold">
              <td colSpan={4} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">
                1 docket selected — all rows included — TOTAL =
              </td>
              <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                {formatAmount(
                  (dockets.find((d) => sid(d.docketVoucherId) === selectedDocketSid)?.rows || [])
                    .reduce((s, r) => s + Number(r.amount || 0), 0)
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Read-only lines table (view mode right panel) ────────────────────────────
function LinesTable({ lines = [], totalAmount }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[460px]">
        <thead className="bg-[#144664]">
          <tr>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[44px]">SL no</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[80px]">CC Code</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-center w-[100px]">Docket No</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-left">CC Name &amp; Short Description</th>
            <th className="border border-[#2e5a72] px-2 py-1 text-white font-semibold text-right w-[120px]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-6 text-gray-400 text-[13px]">No lines found</td>
            </tr>
          ) : lines.map((l, i) => (
            <tr key={l.id || i} className={i % 2 === 0 ? "bg-white" : "bg-[#f7f7f7]"}>
              <td className="border border-[#d0d0d0] px-2 py-1.5 text-center text-gray-500">{l.slNo || i + 1}</td>
              <td className="border border-[#d0d0d0] px-2 py-1 text-[12px] font-medium text-gray-700 bg-[#f0f6fb] text-center">
                {l.ccCode || "—"}
              </td>
              <td className="border border-[#d0d0d0] px-2 py-1 text-[11px] text-gray-600 text-center whitespace-nowrap">
                {l.docketVoucherNo || "—"}
              </td>
              <td className="border border-[#d0d0d0] p-0 align-top">
                <div className="flex flex-col">
                  <span className="px-2 py-1 text-[12px] font-medium text-gray-800">{l.ccName || "—"}</span>
                  {l.shortDescription && (
                    <span className="px-2 pb-1 text-[11px] text-gray-500 border-t border-[#e8e8e8]">{l.shortDescription}</span>
                  )}
                </div>
              </td>
              <td className="border border-[#d0d0d0] px-2 py-1.5 text-right font-mono text-[12px]">
                {formatAmount(l.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr className="bg-[#d6e6f2] font-semibold">
              <td colSpan={4} className="border border-[#b5b5b5] px-2 py-1 text-right text-sm">TOTAL =</td>
              <td className="border border-[#b5b5b5] px-2 py-1 text-right text-sm font-bold">
                {formatAmount(totalAmount)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────
export default function JournalVoucherForm({ mode = "create", voucherId, onUuid, onAfterSubmit }) {
  const isViewMode  = mode === "view" || mode === "approver";
  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isLoading,       setIsLoading]       = useState(mode !== "create");
  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [allowSubmit,     setAllowSubmit]     = useState(false);
  const [voucherNo,       setVoucherNo]       = useState("");
  const [voucherData,     setVoucherData]     = useState(null);

  // editable fields
  const [date,            setDate]            = useState("");
  const [fundSource,      setFundSource]      = useState("");

  // saved snapshots (for cancel-revert and re-enter-edit preselection)
  const [savedDate,       setSavedDate]       = useState("");
  const [savedFundSource, setSavedFundSource] = useState("");
  const [savedItems,      setSavedItems]      = useState(new Set());   // Set<string>
  const [savedDocket,     setSavedDocket]     = useState(null);        // string | null

  // docket selector state (used when isEditing)
  const [dockets,         setDockets]         = useState([]);
  const [fetchLoading,    setFetchLoading]    = useState(false);
  const [fetched,         setFetched]         = useState(false);
  const [selectedItems,   setSelectedItems]   = useState(new Set());   // Set<string>
  const [selectedDocket,  setSelectedDocket]  = useState(null);        // string | null

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch available dockets with optional preselection.
  // existingLines: previously saved voucher lines — merged into docs if backend excludes them.
  const fetchDockets = useCallback(async (source, preItems = null, preDocket = null, existingLines = []) => {
    if (!source || !projectCode) return;
    setFetchLoading(true);
    setFetched(false);
    try {
      let url = `${API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.AVAILABLE_DOCKETS}?projectCode=${projectCode}&fundSource=${encodeURIComponent(source)}`;
      if (voucherId) url += `&voucherId=${voucherId}`;
      const res  = await apiRequest({ url, method: "GET" });
      const docs = res.data?.dockets || [];

      // Merge in previously-saved lines that the backend excluded from the available list.
      // This handles the case where already-committed rows are filtered out by the endpoint.
      if (existingLines.length > 0) {
        const existingIds = new Set();
        docs.forEach((doc) => (doc.rows || []).forEach((row) => existingIds.add(sid(row.docketDetailId))));

        // Group missing lines by their source docketVoucherId
        const missingByDoc = {};
        existingLines.forEach((l) => {
          const detailSid = sid(l.docketDetailId);
          if (existingIds.has(detailSid)) return; // already in list
          const dSid = sid(l.docketVoucherId);
          // Check if the parent docket is already fetched — add the row to it
          const existing = docs.find((d) => sid(d.docketVoucherId) === dSid);
          if (existing) {
            existing.rows = existing.rows || [];
            if (!existing.rows.some((r) => sid(r.docketDetailId) === detailSid)) {
              existing.rows.push({ docketDetailId: l.docketDetailId, ccCode: l.ccCode, ccName: l.ccName, shortDescription: l.shortDescription, amount: l.amount });
            }
          } else {
            if (!missingByDoc[dSid]) {
              missingByDoc[dSid] = { docketVoucherId: l.docketVoucherId, voucherNo: l.docketVoucherNo || `DV-${l.docketVoucherId}`, voucherDate: null, totalAmount: 0, rows: [], _restored: true };
            }
            missingByDoc[dSid].rows.push({ docketDetailId: l.docketDetailId, ccCode: l.ccCode, ccName: l.ccName, shortDescription: l.shortDescription, amount: l.amount });
            missingByDoc[dSid].totalAmount += Number(l.amount || 0);
          }
        });
        const missing = Object.values(missingByDoc);
        if (missing.length > 0) docs.unshift(...missing);
      }

      setDockets(docs);
      setFetched(true);
      // Apply preselection with string-normalized IDs
      if (source === "Cash"     && Array.isArray(preItems) && preItems.length > 0) {
        setSelectedItems(new Set(preItems));
      }
      if (source === "Bank/UPI" && preDocket) {
        setSelectedDocket(preDocket);
      }
    } catch {
      toast.error("Failed to fetch available dockets");
    } finally {
      setFetchLoading(false);
    }
  }, [projectCode, voucherId]);

  // Apply loaded voucher data to state (initial load + after save-draft)
  const applyVoucherData = useCallback((d) => {
    if (!d) return;
    setVoucherData(d);
    setVoucherNo(d.voucherNo || "");
    if (d.voucherUuid) onUuid?.(d.voucherUuid);

    const lines   = d.lines || [];
    const { items, docket } = snapshotFromLines(lines);
    const dateStr = d.voucherDate ? d.voucherDate.split("T")[0] : "";
    const src     = d.fundSource || "";

    setDate(dateStr);
    setFundSource(src);
    setSavedDate(dateStr);
    setSavedFundSource(src);
    setSavedItems(items);
    setSavedDocket(docket);

    const editable = d.workflowStatus === "Draft" || d.workflowStatus === "Reback";
    setAllowSubmit(editable);
    setIsSubmitted(!editable);
    setIsEditing(false);
  }, [onUuid]);

  // Load existing voucher (edit / view mode)
  useEffect(() => {
    if (mode === "create" || !voucherId) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.GET_BY_ID}${voucherId}`,
          method: "GET",
        });
        applyVoucherData(res.data);
      } catch (err) {
        toast.error(err.message || "Failed to load journal voucher");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [voucherId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFundSourceChange = (e) => {
    const val = e.target.value;
    setFundSource(val);
    setFetched(false);
    setDockets([]);
    setSelectedItems(new Set());
    setSelectedDocket(null);
    if (val) fetchDockets(val);
  };

  const handleEdit = () => {
    if (isEditing) {
      // Cancel — revert to saved snapshot
      setDate(savedDate);
      setFundSource(savedFundSource);
      setSelectedItems(new Set(savedItems));
      setSelectedDocket(savedDocket);
      setDockets([]);
      setFetched(false);
      setIsEditing(false);
      setAllowSubmit(true);
    } else {
      // Enter edit — fetch dockets with saved preselection + inject saved lines
      setIsEditing(true);
      setAllowSubmit(false);
      fetchDockets(savedFundSource, [...savedItems], savedDocket, voucherData?.lines || []);
    }
  };

  const toggleItem = (strId) => {
    setSelectedItems((prev) => {
      const n = new Set(prev);
      n.has(strId) ? n.delete(strId) : n.add(strId);
      return n;
    });
  };
  const toggleCc = (strIds, checked) => {
    setSelectedItems((prev) => {
      const n = new Set(prev);
      strIds.forEach((s) => checked ? n.add(s) : n.delete(s));
      return n;
    });
  };

  // Build lines array for POST/PUT payload
  const buildLines = () => {
    if (fundSource === "Cash") {
      let slNo = 1;
      const lines = [];
      dockets.forEach((doc) => {
        (doc.rows || []).forEach((row) => {
          if (selectedItems.has(sid(row.docketDetailId))) {
            lines.push({
              docketVoucherId:  doc.docketVoucherId,
              docketDetailId:   row.docketDetailId,
              slNo:             slNo++,
              ccCode:           row.ccCode,
              ccName:           row.ccName,
              shortDescription: row.shortDescription || "",
              amount:           row.amount,
            });
          }
        });
      });
      return lines;
    } else {
      const doc = dockets.find((d) => sid(d.docketVoucherId) === selectedDocket);
      if (!doc) return [];
      return (doc.rows || []).map((row, i) => ({
        docketVoucherId:  doc.docketVoucherId,
        docketDetailId:   row.docketDetailId,
        slNo:             i + 1,
        ccCode:           row.ccCode,
        ccName:           row.ccName,
        shortDescription: row.shortDescription || "",
        amount:           row.amount,
      }));
    }
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("projectCode", projectCode);
    fd.append("fundSource",  fundSource);
    fd.append("lines",       JSON.stringify(buildLines()));
    return fd;
  };

  const validate = () => {
    if (!date)       { toast.error("Please select a date");        return false; }
    if (!fundSource) { toast.error("Please select a fund source"); return false; }
    if (fundSource === "Cash") {
      if (selectedItems.size === 0) { toast.error("Select at least one item"); return false; }
      const lines = buildLines();
      if (new Set(lines.map((l) => l.ccCode)).size > 1) {
        toast.error("All selected items must share the same CC code");
        return false;
      }
    }
    if (fundSource === "Bank/UPI" && !selectedDocket) {
      toast.error("Select a docket voucher");
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    let tid;
    try {
      tid = toast.loading("Saving draft…");
      if (mode === "create") {
        const res = await apiRequest({
          url:    API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.CREATE,
          method: "POST",
          data:   buildFormData(),
        });
        toast.success("Saved as draft", { id: tid });
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/journal/vouchering/${newId}`), 400);
      } else {
        await apiRequest({ url: `${BASE}/${voucherId}/edit`, method: "PUT", data: buildFormData() });
        toast.success("Draft saved", { id: tid });
        const res2 = await apiRequest({
          url:    `${API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.GET_BY_ID}${voucherId}`,
          method: "GET",
        });
        applyVoucherData(res2.data);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  const handleSubmitVoucher = async () => {
    let tid;
    try {
      tid = toast.loading("Submitting…");
      await apiRequest({ url: `${BASE}/${voucherId}/submit`, method: "POST" });
      toast.success("Submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.JOURNAL_VOUCHERING.GET_BY_ID}${voucherId}`,
        method: "GET",
      });
      setVoucherData(res.data);
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  // disabled state — same single variable pattern as DocketVoucherForm
  const disabled = isViewMode || !isEditing;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── LEFT PANEL ─────────────────────────────────── */}
        <div className={`w-full lg:w-[340px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>
          <PMSection title="Voucher Info">
            <PMFormRow label="Voucher No" labelWidth={LABEL_W}>
              <PMInput value={voucherNo || "Auto"} disabled />
            </PMFormRow>

            <PMFormRow label="Date" required labelWidth={LABEL_W}>
              <PMDateInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={disabled}
                className="max-w-[210px]"
              />
            </PMFormRow>

            <PMFormRow label="Fund Source" required labelWidth={LABEL_W}>
              <PMSelect
                value={fundSource}
                onChange={isEditing ? handleFundSourceChange : undefined}
                disabled={disabled}
                placeholder="Select…"
                options={FUND_OPTIONS}
              />
            </PMFormRow>

          </PMSection>
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────── */}
        <div className="flex-1 min-w-0 mt-4 lg:mt-0">
          <div className="border border-[#b5b5b5]">
            {/* Panel header */}
            <div className="bg-[#d6e6f2] px-3 py-1.5 border-b border-[#b5b5b5] font-bold text-[16px] flex items-center justify-between gap-2">
              <span>
                {isEditing
                  ? fundSource
                    ? `Available Dockets — ${FUND_OPTIONS.find((o) => o.value === fundSource)?.label ?? fundSource}`
                    : "Select Fund Source to load dockets"
                  : "Journal Voucher Lines"}
              </span>
              {isEditing && fundSource === "Cash" && (
                <span className="text-[11px] font-normal text-gray-500">Select items — same CC code only</span>
              )}
              {isEditing && fundSource === "Bank/UPI" && (
                <span className="text-[11px] font-normal text-gray-500">Select one docket (all rows included)</span>
              )}
            </div>

            {/* Panel body */}
            {isEditing ? (
              !fundSource ? (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-[13px]">
                  Select a fund source to load available dockets
                </div>
              ) : fetchLoading ? (
                <div className="flex items-center justify-center h-[180px]">
                  <Loader2 className="animate-spin w-5 h-5 text-gray-400" />
                </div>
              ) : fetched && fundSource === "Cash" ? (
                <CashPanel
                  dockets={dockets}
                  selectedItems={selectedItems}
                  onToggleItem={toggleItem}
                  onToggleCc={toggleCc}
                />
              ) : fetched && fundSource === "Bank/UPI" ? (
                <BankPanel
                  dockets={dockets}
                  selectedDocketSid={selectedDocket}
                  onSelect={(s) => setSelectedDocket((prev) => (prev === s ? null : s))}
                />
              ) : null
            ) : (
              <LinesTable
                lines={voucherData?.lines || []}
                totalAmount={voucherData?.totalAmount || 0}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Action buttons ─────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-6">
          {isEditing && (
            <SaveDraftButton
              onClick={handleSaveDraft}
              loading={false}
              disabled={false}
              requireConfirmation
            />
          )}

          <SaveButton
            onClick={handleSubmitVoucher}
            loading={false}
            disabled={!allowSubmit || isEditing || isSubmitted || mode === "create"}
            requireConfirmation
            confirmationTitle="Submit Journal Voucher?"
            confirmationMessage="Once submitted, this journal voucher will be sent for approval."
          >
            Submit
          </SaveButton>

          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
        </div>
      )}
    </div>
  );
}
