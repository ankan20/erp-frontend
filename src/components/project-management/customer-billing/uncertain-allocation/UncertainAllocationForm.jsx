"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMInput         from "@/components/project-management/common/PMInput";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import AmountInput         from "@/components/common/AmountInput";
import { useColumnResize } from "@/hooks/useColumnResize";

const UA = API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION;

// ── Colour tokens (matching budget master style) ─────────────────────────────
const HDR       = "bg-[#144664] text-white";
const CERT_HDR  = "bg-[#374151] text-white";
const CERT_CELL = "bg-[#f8fafc]";
const OB_HDR    = "bg-[#7f1d1d] text-white";
const OB_CELL   = "bg-[#fef2f2]";
const US_HDR    = "bg-[#1e3a8a] text-white";
const UC_HDR    = "bg-[#1d4ed8] text-white";
const UC_CELL   = "bg-[#eff6ff]";

const today = () => new Date().toISOString().slice(0, 10);

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function UncertainAllocationForm({ mode = "create", uaId, onAfterSubmit, onUuid }) {
  const { tableRef }  = useColumnResize();
  const isViewMode    = mode === "view" || mode === "approver";
  const router        = useRouter();
  const projectCode   = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,     setIsEditing]     = useState(mode === "create");
  const [isLoading,     setIsLoading]     = useState(mode !== "create");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [isSubmitted,   setIsSubmitted]   = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [uaUuid,        setUaUuid]        = useState(null);

  // header fields
  const [uaDate,  setUaDate]  = useState(today());
  const [remarks, setRemarks] = useState("");
  const [status,  setStatus]  = useState("Draft");
  const [locked,  setLocked]  = useState(false);
  const [uaNo,    setUaNo]    = useState("");

  // lines: array of item-level rows, each with ogSaleOrderId to group by
  const [lines,         setLines]         = useState([]);
  // saleOrders: lookup list (order-level)
  const [saleOrders,    setSaleOrders]    = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedSoId,  setSelectedSoId]  = useState("");
  // addedSoIds: set of ogSaleOrderId already in lines (to prevent duplicate adds)
  const [addedSoIds,    setAddedSoIds]    = useState(new Set());
  const [itemsLoading,  setItemsLoading]  = useState(false);

  // ── load sale order lookup ─────────────────────────────────────────────────
  const loadSaleOrders = useCallback(async () => {
    if (!projectCode) return;
    setLookupLoading(true);
    try {
      const res = await apiRequest({
        url: `${UA.SALE_ORDER_LOOKUP}?projectCode=${projectCode}`,
        method: "GET",
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setSaleOrders(
        list.map((o) => ({
          ...o,
          displayLabel: [o.ogSaleOrderNo || o.orderNo, o.orderTitle].filter(Boolean).join(" — "),
        })),
      );
    } catch {
      toast.error("Failed to load sale orders");
    } finally {
      setLookupLoading(false);
    }
  }, [projectCode]);

  // ── load existing record ───────────────────────────────────────────────────
  const loadDetails = useCallback(async () => {
    if (!uaId) return;
    setIsLoading(true);
    try {
      const res = await apiRequest({ url: `${UA.GET_BY_ID}${uaId}`, method: "GET" });
      const d = res.data;
      if (!d) return;
      setUaNo(d.uaNo || "");
      setUaDate(d.uaDate || today());
      setRemarks(d.remarks || "");
      setStatus(d.workflowStatus || "Draft");
      setLocked(!!d.locked);
      if (d.uaUuid) { setUaUuid(d.uaUuid); onUuid?.(d.uaUuid); }
      setIsSubmitted(d.workflowStatus !== "Draft" && d.workflowStatus !== "Reback");

      const loadedLines = (d.lines || []).map((l) => ({
        ogSaleOrderId:                   l.ogSaleOrderId,
        ogSaleOrderNo:                   l.ogSaleOrderNo   || "",
        orderTitle:                      l.orderTitle      || "",
        orderNo:                         l.orderNo         || "",
        ogSaleOrderItemId:               l.ogSaleOrderItemId,
        itemType:                        l.itemType        || "item",
        boqSlNo:                         l.boqSlNo,
        itemCode:                        l.itemCode        || "",
        itemName:                        l.itemName        || "",
        itemNameDesc:                    l.itemNameDesc    || "",
        unit:                            l.unit            || "",
        boqQty:                          l.boqQty          ?? 0,
        unitRate:                        l.unitRate        ?? 0,
        claimAmount:                     l.claimAmount     ?? 0,
        certifiedAmount:                 l.certifiedAmount ?? 0,
        difference:                      l.difference      ?? 0,
        overBillingCalculationMistake:   l.overBillingCalculationMistake  ?? "",
        certifiedHoldAmendmentPending:   l.certifiedHoldAmendmentPending  ?? "",
        nonBoqItemsRate:                 l.nonBoqItemsRate                ?? "",
        holdWork:                        l.holdWork                       ?? "",
        holdForFullWorkNotCompleted:     l.holdForFullWorkNotCompleted     ?? "",
        remarks:                         l.remarks || "",
      }));
      setLines(loadedLines);
      setAddedSoIds(new Set(loadedLines.map((l) => l.ogSaleOrderId)));
    } catch {
      toast.error("Failed to load details");
    } finally {
      setIsLoading(false);
    }
  }, [uaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === "create") {
      loadSaleOrders();
    } else {
      loadDetails();
      loadSaleOrders();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── add items from a selected sale order ──────────────────────────────────
  const handleSoSelect = async (soId) => {
    if (!soId) return;
    const soIdNum = Number(soId);
    if (addedSoIds.has(soIdNum)) {
      toast.warning("This sale order is already added");
      setSelectedSoId(String(soIdNum));
      return;
    }
    setItemsLoading(true);
    setSelectedSoId(String(soIdNum));
    try {
      const res = await apiRequest({
        url: `${UA.SALE_ORDER_ITEMS}${soIdNum}?projectCode=${projectCode}`,
        method: "GET",
      });
      const d = res.data;
      if (!d || !d.items?.length) {
        toast.warning("No items found for this sale order");
        return;
      }
      const newRows = d.items.map((item) => ({
        ogSaleOrderId:                  soIdNum,
        ogSaleOrderNo:                  d.ogSaleOrderNo   || "",
        orderTitle:                     d.orderTitle      || "",
        orderNo:                        d.orderNo         || "",
        ogSaleOrderItemId:              item.ogSaleOrderItemId,
        itemType:                       item.itemType,
        boqSlNo:                        item.boqSlNo,
        itemCode:                       item.itemCode     || "",
        itemName:                       (item.itemName     || "").trim(),
        itemNameDesc:                   (item.itemNameDesc || "").trim(),
        unit:                           item.unit         || "",
        boqQty:                         item.boqQty       ?? 0,
        unitRate:                       item.unitRate      ?? 0,
        claimAmount:                    item.claimAmount   ?? 0,
        certifiedAmount:                item.certifiedAmount ?? 0,
        difference:                     item.difference    ?? 0,
        overBillingCalculationMistake:  "",
        certifiedHoldAmendmentPending:  "",
        nonBoqItemsRate:                "",
        holdWork:                       "",
        holdForFullWorkNotCompleted:    "",
        remarks:                        "",
      }));
      setLines((prev) => [...prev, ...newRows]);
      setAddedSoIds((prev) => new Set([...prev, soIdNum]));
    } catch {
      toast.error("Failed to load sale order items");
    } finally {
      setItemsLoading(false);
    }
  };

  const updateLine = (idx, field, value) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  // ── balance check per line ─────────────────────────────────────────────────
  const lineBalance = (l) => {
    const sum =
      Number(l.overBillingCalculationMistake  || 0) +
      Number(l.certifiedHoldAmendmentPending  || 0) +
      Number(l.nonBoqItemsRate                || 0) +
      Number(l.holdWork                       || 0) +
      Number(l.holdForFullWorkNotCompleted     || 0);
    return { sum, ok: Math.abs(sum - Number(l.difference)) < 0.01 };
  };

  // ── totals ─────────────────────────────────────────────────────────────────
  const totalClaim      = lines.reduce((s, l) => s + Number(l.claimAmount     || 0), 0);
  const totalCertified  = lines.reduce((s, l) => s + Number(l.certifiedAmount || 0), 0);
  const totalDifference = lines.reduce((s, l) => s + Number(l.difference      || 0), 0);

  // ── group lines by sale order for display ─────────────────────────────────
  const groupedLines = lines.reduce((acc, line, idx) => {
    const key = line.ogSaleOrderId;
    if (!acc[key]) {
      acc[key] = { soId: key, soNo: line.ogSaleOrderNo, title: line.orderTitle, rows: [] };
    }
    acc[key].rows.push({ ...line, _idx: idx });
    return acc;
  }, {});
  const groups = Object.values(groupedLines);

  // ── save ───────────────────────────────────────────────────────────────────
  const buildPayload = () => ({
    projectCode,
    uaDate,
    remarks,
    lines: lines.map((l) => ({
      ogSaleOrderId:                  l.ogSaleOrderId,
      ogSaleOrderNo:                  l.ogSaleOrderNo,
      orderTitle:                     l.orderTitle,
      ogSaleOrderItemId:              l.ogSaleOrderItemId,
      itemType:                       l.itemType,
      boqSlNo:                        l.boqSlNo,
      itemCode:                       l.itemCode,
      itemName:                       l.itemName,
      itemNameDesc:                   l.itemNameDesc,
      unit:                           l.unit,
      boqQty:                         Number(l.boqQty)   || 0,
      unitRate:                       Number(l.unitRate)  || 0,
      claimAmount:                    Number(l.claimAmount)     || 0,
      certifiedAmount:                Number(l.certifiedAmount) || 0,
      overBillingCalculationMistake:  Number(l.overBillingCalculationMistake)  || 0,
      certifiedHoldAmendmentPending:  Number(l.certifiedHoldAmendmentPending)  || 0,
      nonBoqItemsRate:                Number(l.nonBoqItemsRate)                || 0,
      holdWork:                       Number(l.holdWork)                       || 0,
      holdForFullWorkNotCompleted:    Number(l.holdForFullWorkNotCompleted)     || 0,
      remarks:                        l.remarks || null,
    })),
  });

  const handleSave = async () => {
    if (!uaDate)          { toast.error("Date is required"); return; }
    if (lines.length < 1) { toast.error("Add at least one sale order"); return; }
    const unbalanced = lines.filter((l) => !lineBalance(l).ok);
    if (unbalanced.length > 0) {
      toast.warning(`${unbalanced.length} line(s) have justification totals that don’t match the difference.`);
    }
    setIsLoading(true);
    try {
      let res;
      if (mode === "create") {
        res = await apiRequest({ url: UA.CREATE, method: "POST", data: buildPayload() });
      } else {
        const { projectCode: _pc, ...editPayload } = buildPayload();
        res = await apiRequest({ url: `${UA.UPDATE}${uaId}`, method: "PUT", data: editPayload });
      }
      toast.success(res.message || "Saved successfully");
      if (mode === "create") {
        router.push(`/project-management/customer-billing/uncertified-statement/${res.data?.uaId}`);
      } else {
        setIsEditing(false);
        loadDetails();
      }
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setIsLoading(false);
    }
  };

  // ── submit for approval ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest({ url: `${UA.SUBMIT}${uaId}`, method: "POST" });
      toast.success(res.message || "Submitted successfully");
      setIsSubmitted(true);
      setLocked(true);
      setStatus(res.data?.workflowStatus || "Pending_L1");
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEdit   = !locked && (status === "Draft" || status === "Reback");
  const canSubmit = canEdit && !isEditing && lines.length > 0 && uaId;
  const disabled  = isViewMode || !isEditing || isSubmitting;

  if (isLoading && mode !== "create") {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
      </div>
    );
  }

  const TOTAL_COLS = 15; // BOQ Sl + Item Code + Item Name + BOQ Qty + Unit + Unit Rate + Claim + Certified + Diff + 5 just + Remarks

  return (
    <div className="p-3">
      {/* collapse toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[385px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Statement Details:">
            <PMFormRow label="UA No" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={uaNo || "[Auto]"} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Date" required={!disabled} labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMDateInput
                value={uaDate}
                onChange={(e) => setUaDate(e.target.value)}
                disabled={disabled}
                className="max-w-[200px]"
              />
            </PMFormRow>
            {uaNo && (
              <PMFormRow label="Status" labelWidth="sm:w-[130px] sm:min-w-[130px]">
                <PMInput value={status} disabled readOnly expandable={false} />
              </PMFormRow>
            )}
            {isEditing && (
              <PMFormRow label="Sale Order" labelWidth="sm:w-[130px] sm:min-w-[130px]">
                {lookupLoading ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <SearchableSelect
                    options={saleOrders}
                    value={selectedSoId}
                    onChange={(val) => { if (val) handleSoSelect(val); }}
                    placeholder="Search sale order…"
                    labelKey="displayLabel"
                    valueKey="ogSaleOrderId"
                    searchKeys={["displayLabel", "ogSaleOrderNo", "orderTitle", "orderNo"]}
                  />
                )}
                {itemsLoading && <Loader2 className="animate-spin w-4 h-4 mt-1" />}
              </PMFormRow>
            )}
          </PMSection>

          <PMSection title="Totals:">
            <PMFormRow label="Total Claim" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={formatAmount(totalClaim)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Total Certified" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={formatAmount(totalCertified)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Total Difference" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <div className={`w-full h-[30px] flex items-center justify-end px-2 rounded-sm border text-[13px] font-bold tabular-nums ${
                totalDifference >= 0
                  ? "bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]"
                  : "bg-[#f0fdf4] border-[#86efac] text-[#166534]"
              }`}>
                {formatAmount(totalDifference)}
              </div>
            </PMFormRow>
          </PMSection>

          <PMSection title="Remarks:">
            <PMTextarea
              value={remarks}
              onChange={setRemarks}
              disabled={disabled}
              placeholder="Remarks…"
              rows={3}
              maxRows={8}
            />
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Table */}
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            {/* Header strip */}
            <div className="bg-[#d6e6f2] px-3 py-[6px] border-b border-gray-300 flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[#144664]">
                Uncertified Statement — Item Level
              </span>
              <span className="ml-auto text-[12px] font-semibold text-[#144664] tabular-nums">
                Rows: {lines.length}
              </span>
            </div>

            <TooltipProvider>
            <div className="overflow-x-auto">
              <table
                ref={tableRef}
                className="w-full table-fixed border-collapse text-[12px]"
                style={{ minWidth: 1480 }}
              >
                <thead className="sticky top-0 z-30">
                  {/* Group header row */}
                  <tr>
                    <th colSpan={6} className={`${HDR} border border-[#2e5a72] px-2 py-1 text-center text-[11px] font-semibold`}>
                      BOQ Details
                    </th>
                    <th colSpan={3} className={`${CERT_HDR} border border-[#4b5563] px-2 py-1 text-center text-[11px] font-semibold`}>
                      Certification Statement
                    </th>
                    <th colSpan={6} className={`${US_HDR} border border-[#1e3a8a] px-2 py-1 text-center text-[11px] font-semibold`}>
                      Uncertified Statement
                    </th>
                  </tr>
                  {/* Leaf column header row */}
                  <tr>
                    <th className={`${HDR} border border-[#2e5a72] px-1 py-1.5 text-center text-[11px] w-[50px] min-w-[50px]`}>BOQ Sl</th>
                    <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-left text-[11px] w-[80px] min-w-[70px]`}>Item Code</th>
                    <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-left text-[11px] w-[200px] min-w-[150px]`}>Item Name</th>
                    <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-right text-[11px] w-[80px] min-w-[70px]`}>BOQ Qty</th>
                    <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-center text-[11px] w-[60px] min-w-[55px]`}>Unit</th>
                    <th className={`${HDR} border border-[#2e5a72] px-2 py-1.5 text-right text-[11px] w-[90px] min-w-[80px]`}>Unit Rate</th>
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[110px] min-w-[100px]`}>Claim</th>
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[110px] min-w-[100px]`}>Certified</th>
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[110px] min-w-[100px]`}>Difference</th>
                    <th className={`${OB_HDR} border border-[#7f1d1d] px-2 py-1.5 text-center text-[11px] w-[120px] min-w-[110px]`}>
                      Over Billing / Calc Mistake
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[120px] min-w-[110px]`}>
                      Certified Hold Amnd Pending
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[110px] min-w-[100px]`}>
                      Non BOQ Items Rate
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[110px] min-w-[100px]`}>
                      Hold Unsatisfactory Work
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[110px] min-w-[100px]`}>
                      Hold Full Work Not Done
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[100px] min-w-[90px]`}>
                      Remarks
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={TOTAL_COLS} className="border border-gray-200 py-8 text-center text-[#bbb] italic text-[12px]">
                        {isEditing
                          ? "Use the “Sale Order” selector on the left to add items"
                          : "No items added"}
                      </td>
                    </tr>
                  ) : (
                    groups.map((group) => {
                      const groupTotal = {
                        claim:      group.rows.reduce((s, r) => s + Number(r.claimAmount     || 0), 0),
                        certified:  group.rows.reduce((s, r) => s + Number(r.certifiedAmount || 0), 0),
                        difference: group.rows.reduce((s, r) => s + Number(r.difference      || 0), 0),
                      };
                      return [
                        /* Sale order group header */
                        <tr key={`grp-${group.soId}`} className="bg-[#1e3a5f]">
                          <td colSpan={TOTAL_COLS} className="px-3 py-[5px] text-white text-[11px] font-semibold">
                            <span className="opacity-70 mr-2">SO:</span>
                            <span className="mr-3">{group.soNo}</span>
                            <span className="opacity-70 mr-2">|</span>
                            <span>{group.title}</span>
                            <span className="ml-4 opacity-70 text-[10px]">
                              Claim: {formatAmount(groupTotal.claim)} &nbsp;|&nbsp;
                              Certified: {formatAmount(groupTotal.certified)} &nbsp;|&nbsp;
                              Diff: {formatAmount(groupTotal.difference)}
                            </span>
                          </td>
                        </tr>,
                        /* Item rows */
                        ...group.rows.map((l, rowNum) => {
                          const idx   = l._idx;
                          const { ok } = lineBalance(l);
                          const zebra  = rowNum % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]";
                          return (
                            <tr key={`${l.ogSaleOrderId}-${l.ogSaleOrderItemId ?? idx}`}
                                className={!ok && isEditing ? "bg-yellow-50/60" : zebra}>

                              <td className="border border-gray-200 px-1 py-[3px] text-center text-[11px] text-gray-600">{l.boqSlNo}</td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-[11px] text-gray-600">{l.itemCode}</td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-[11px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <div className="truncate">{l.itemName?.trim()}</div>
                                      {l.itemNameDesc?.trim() && l.itemNameDesc?.trim() !== l.itemName?.trim() && (
                                        <div className="truncate text-gray-400 text-[10px]">{l.itemNameDesc?.trim()}</div>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent variant="text" side="top">
                                    <div className="font-semibold">{l.itemName?.trim()}</div>
                                    {l.itemNameDesc?.trim() && l.itemNameDesc?.trim() !== l.itemName?.trim() && (
                                      <div className="mt-0.5 text-gray-300">{l.itemNameDesc?.trim()}</div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                                {l.boqQty != null ? Number(l.boqQty).toLocaleString() : ""}
                              </td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-center text-[11px] text-gray-600">{l.unit}</td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                                {l.unitRate != null ? formatAmount(l.unitRate) : ""}
                              </td>

                              {/* Certification Statement — read-only */}
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] ${CERT_CELL}`}>
                                {formatAmount(l.claimAmount)}
                              </td>
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] ${CERT_CELL}`}>
                                {formatAmount(l.certifiedAmount)}
                              </td>
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] font-medium ${CERT_CELL}`}>
                                {formatAmount(l.difference)}
                              </td>

                              {/* Over Billing */}
                              <td className={`border border-gray-200 p-0.5 ${OB_CELL}`}>
                                <AmountInput
                                  value={l.overBillingCalculationMistake ?? ""}
                                  disabled={!isEditing}
                                  onChange={(e) => updateLine(idx, "overBillingCalculationMistake", e.target.value)}
                                  placeholder="0.00"
                                  className={`w-full h-[24px] text-[11px] px-1.5 text-right rounded-sm border-0 outline-none focus-visible:ring-0 ${isEditing ? "bg-white/80 focus:bg-white" : "bg-transparent"}`}
                                />
                              </td>

                              {/* Uncertified Statement cells */}
                              {["certifiedHoldAmendmentPending", "nonBoqItemsRate", "holdWork", "holdForFullWorkNotCompleted"].map((field) => (
                                <td key={field} className={`border border-gray-200 p-0.5 ${UC_CELL}`}>
                                  <AmountInput
                                    value={l[field] ?? ""}
                                    disabled={!isEditing}
                                    onChange={(e) => updateLine(idx, field, e.target.value)}
                                    placeholder="0.00"
                                    className={`w-full h-[24px] text-[11px] px-1.5 text-right rounded-sm border-0 outline-none focus-visible:ring-0 ${isEditing ? "bg-white/80 focus:bg-white" : "bg-transparent"}`}
                                  />
                                </td>
                              ))}

                              {/* Remarks */}
                              <td className={`border border-gray-200 p-0.5 ${UC_CELL}`}>
                                <input
                                  type="text"
                                  value={l.remarks}
                                  disabled={!isEditing}
                                  onChange={(e) => updateLine(idx, "remarks", e.target.value)}
                                  className={`w-full h-[24px] text-[11px] px-1.5 rounded-sm border-0 outline-none focus-visible:ring-0 ${isEditing ? "bg-white/80 focus:bg-white" : "bg-transparent"} disabled:cursor-default`}
                                />
                              </td>
                            </tr>
                          );
                        }),
                      ];
                    })
                  )}

                  {/* Totals row */}
                  {lines.length > 0 && (() => {
                    const totalOB   = lines.reduce((s, l) => s + Number(l.overBillingCalculationMistake  || 0), 0);
                    const totalCH   = lines.reduce((s, l) => s + Number(l.certifiedHoldAmendmentPending  || 0), 0);
                    const totalNB   = lines.reduce((s, l) => s + Number(l.nonBoqItemsRate                || 0), 0);
                    const totalHW   = lines.reduce((s, l) => s + Number(l.holdWork                       || 0), 0);
                    const totalHF   = lines.reduce((s, l) => s + Number(l.holdForFullWorkNotCompleted     || 0), 0);
                    return (
                      <tr className="bg-[#0f2744] text-white font-semibold text-[11px]">
                        <td colSpan={6} className="border border-[#1e3a5f] px-2 py-1.5 text-right tracking-wide">TOTAL</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalClaim)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalCertified)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalDifference)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalOB)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalCH)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalNB)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalHW)}</td>
                        <td className="border border-[#1e3a5f] px-2 py-1.5 text-right tabular-nums">{formatAmount(totalHF)}</td>
                        <td className="border border-[#1e3a5f]" />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            </TooltipProvider>
          </div>

          {/* Balance warnings */}
          {isEditing && lines.some((l) => !lineBalance(l).ok) && (
            <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700">
              &#9888; Some lines have justification fields that don&apos;t sum to the difference. Please verify before submitting.
            </div>
          )}

          {/* Action buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={handleSave}
                  loading={isLoading}
                  disabled={isLoading}
                  requireConfirmation
                  confirmationTitle="Save as Draft?"
                  confirmationMessage="This will be saved as a draft and can be edited or submitted later."
                >
                  Save as Draft
                </SaveDraftButton>
              )}

              <SaveButton
                onClick={handleSubmit}
                loading={isSubmitting}
                loadingText="Submitting…"
                disabled={!canSubmit || isEditing || isSubmitting}
                requireConfirmation
                confirmationTitle="Submit for Approval?"
                confirmationMessage="Once submitted, this record is locked and sent for approval."
              >
                Submit
              </SaveButton>

              {mode === "edit" && !isSubmitted && canEdit && (
                <EditButton
                  onClick={isEditing ? () => { setIsEditing(false); loadDetails(); } : () => { setIsEditing(true); loadSaleOrders(); }}
                  disabled={isSubmitting}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </EditButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
