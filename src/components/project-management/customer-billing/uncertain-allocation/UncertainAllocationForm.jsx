"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton      from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
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
import QtyInput            from "@/components/common/QtyInput";
import ExpandableTextField  from "@/components/common/ExpandableTextField";
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

  // lines: array of item-level rows grouped by billingId
  const [lines,            setLines]           = useState([]);
  // sale order lookup
  const [saleOrders,       setSaleOrders]       = useState([]);
  const [lookupLoading,    setLookupLoading]    = useState(false);
  const [selectedSoId,     setSelectedSoId]     = useState("");
  // claim bill lookup (filtered by selected SO)
  const [claimBills,       setClaimBills]       = useState([]);
  const [billsLoading,     setBillsLoading]     = useState(false);
  const [selectedBillId,   setSelectedBillId]   = useState("");
  // addedBillIds: set of billingId already in lines (prevent duplicate adds)
  const [addedBillIds,     setAddedBillIds]     = useState(new Set());
  const [itemsLoading,     setItemsLoading]     = useState(false);

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
        billingId:                       l.billingId,
        billingNo:                       l.billingNo       || "",
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
        ogBOQQty:                        l.ogBOQQty        ?? 0,   // original sale order ordered qty
        boqQty:                          l.boqQty          ?? 0,   // claim qty
        certifiedQty:                    l.certifiedQty    ?? 0,   // certified qty (computed)
        unitRate:                        l.unitRate        ?? 0,
        claimAmount:                     l.claimAmount     ?? 0,   // for total row
        certifiedAmount:                 l.certifiedAmount ?? 0,   // for total row
        difference:                      l.difference      ?? 0,   // for total row
        overBillingCalculationMistake:   l.overBillingCalculationMistake  ?? "",  // QTY
        certifiedHoldAmendmentPending:   l.certifiedHoldAmendmentPending  ?? "",  // QTY
        nonBoqItemsRate:                 l.nonBoqItemsRate                ?? "",  // QTY
        holdWork:                        l.holdWork                       ?? "",  // QTY
        holdForFullWorkNotCompleted:     l.holdForFullWorkNotCompleted     ?? "",  // QTY
        remarks:                         l.remarks || "",
      }));
      setLines(loadedLines);
      setAddedBillIds(new Set(loadedLines.map((l) => l.billingId).filter(Boolean)));
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

  // ── Step 1: SO selected → load its claim bills ────────────────────────────
  const handleSoSelect = async (soId) => {
    if (!soId) return;
    setSelectedSoId(String(soId));
    setSelectedBillId("");
    setClaimBills([]);
    setBillsLoading(true);
    try {
      const result = await apiRequest({
        url: `${UA.CLAIM_BILLS}${soId}`,
        method: "GET",
      });
      const list = Array.isArray(result.data) ? result.data : [];
      if (!list.length) {
        toast.warning("No approved claim bills found for this sale order");
      }
      setClaimBills(list.map((b) => ({
        ...b,
        displayLabel: b.title ? `${b.billingNo} — ${b.title}` : b.billingNo,
      })));
    } catch {
      toast.error("Failed to load claim bills");
    } finally {
      setBillsLoading(false);
    }
  };

  // ── Step 2: Claim bill selected → populate table rows ─────────────────────
  const handleBillSelect = async (billId) => {
    if (!billId) return;
    const billIdNum = Number(billId);
    if (addedBillIds.has(billIdNum)) {
      toast.warning("This claim bill is already added");
      setSelectedBillId(String(billIdNum));
      return;
    }
    setItemsLoading(true);
    setSelectedBillId(String(billIdNum));
    try {
      const result = await apiRequest({
        url: `${UA.CLAIM_BILL_ITEMS}${billIdNum}`,
        method: "GET",
      });
      const d = result.data;
      if (!d || !d.items?.length) {
        toast.warning("No items found in this claim bill");
        return;
      }
      const newRows = d.items.map((item) => ({
        billingId:                      billIdNum,
        billingNo:                      d.billingNo        || "",
        ogSaleOrderId:                  d.ogSaleOrderId,
        ogSaleOrderNo:                  d.ogSaleOrderNo    || "",
        orderTitle:                     d.orderTitle       || "",
        orderNo:                        d.orderNo          || "",
        ogSaleOrderItemId:              item.billingItemId,
        itemType:                       item.itemType,
        boqSlNo:                        item.boqSlNo,
        itemCode:                       item.itemCode      || "",
        itemName:                       (item.itemName      || "").trim(),
        itemNameDesc:                   (item.itemNameDesc  || "").trim(),
        unit:                           item.unit          || "",
        ogBOQQty:                       item.orderQty      ?? 0,
        boqQty:                         item.claimQty      ?? 0,
        certifiedQty:                   item.certifiedQty  ?? 0,
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
      setAddedBillIds((prev) => new Set([...prev, billIdNum]));
    } catch {
      toast.error("Failed to load claim bill items");
    } finally {
      setItemsLoading(false);
    }
  };

  const updateLine = (idx, field, value) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));

  // ── balance check per line ─────────────────────────────────────────────────
  const lineBalance = (l) => {
    const rate = Number(l.unitRate || 0);
    const sumAmt =
      (Number(l.overBillingCalculationMistake || 0) +
       Number(l.certifiedHoldAmendmentPending || 0) +
       Number(l.nonBoqItemsRate               || 0) +
       Number(l.holdWork                      || 0) +
       Number(l.holdForFullWorkNotCompleted   || 0)) * rate;
    return { sum: sumAmt, ok: Math.abs(sumAmt - Number(l.difference)) < 0.01 };
  };

  // ── totals ─────────────────────────────────────────────────────────────────
  const totalClaim      = lines.reduce((s, l) => s + Number(l.claimAmount     || 0), 0);
  const totalCertified  = lines.reduce((s, l) => s + Number(l.certifiedAmount || 0), 0);
  const totalDifference = lines.reduce((s, l) => s + Number(l.difference      || 0), 0);

  // ── group lines by billing for display ────────────────────────────────────
  const groupedLines = lines.reduce((acc, line, idx) => {
    const key = line.billingId ?? `so-${line.ogSaleOrderId}`;
    if (!acc[key]) {
      acc[key] = {
        billingId: line.billingId,
        billingNo: line.billingNo,
        soNo:      line.ogSaleOrderNo,
        title:     line.orderTitle,
        rows:      [],
      };
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
      billingId:                      l.billingId,
      billingNo:                      l.billingNo,
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
      ogBOQQty:                       Number(l.ogBOQQty)  || 0,  // original order qty
      boqQty:                         Number(l.boqQty)    || 0,  // claim qty
      unitRate:                       Number(l.unitRate)  || 0,
      certifiedAmount:                Number(l.certifiedAmount) || 0,  // for fallback when no billing_id
      // Justification as QTY — backend computes amounts
      overBillingCalculationMistake:  Number(l.overBillingCalculationMistake) || 0,
      certifiedHoldAmendmentPending:  Number(l.certifiedHoldAmendmentPending) || 0,
      nonBoqItemsRate:                Number(l.nonBoqItemsRate)               || 0,
      holdWork:                       Number(l.holdWork)                      || 0,
      holdForFullWorkNotCompleted:    Number(l.holdForFullWorkNotCompleted)    || 0,
      remarks:                        l.remarks || null,
    })),
  });

  const handleSave = async () => {
    if (!uaDate)          { toast.error("Date is required"); return; }
    if (lines.length < 1) { toast.error("Add at least one sale order"); return; }
    const unbalanced = lines.filter((l) => !lineBalance(l).ok);
    if (unbalanced.length > 0) {
      toast.warning(`${unbalanced.length} line(s) have justification totals that don't match the difference.`);
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

  const TOTAL_COLS = 15; // BOQ Sl + Item Code + Item Name + BOQ Qty + Claim Qty + Unit + Rate + Cert Qty + Diff Qty + 5 just (qty) + Remarks

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
              <>
                <PMFormRow label="Sale Order" labelWidth="sm:w-[130px] sm:min-w-[130px]">
                  <SearchableSelect
                    options={saleOrders}
                    value={selectedSoId}
                    onChange={(val) => { if (val) handleSoSelect(val); }}
                    placeholder="Search sale order…"
                    labelKey="displayLabel"
                    valueKey="ogSaleOrderId"
                    searchKeys={["displayLabel", "ogSaleOrderNo", "orderTitle", "orderNo"]}
                    loading={lookupLoading}
                    disabled={lookupLoading}
                  />
                </PMFormRow>

                <PMFormRow label="Claim Bill" labelWidth="sm:w-[130px] sm:min-w-[130px]">
                  <SearchableSelect
                    options={claimBills}
                    value={selectedBillId}
                    onChange={(val) => { if (val) handleBillSelect(val); }}
                    placeholder={selectedSoId ? (itemsLoading ? "Loading items…" : "Select claim bill…") : "Select a sale order first"}
                    labelKey="displayLabel"
                    valueKey="billingId"
                    searchKeys={["displayLabel", "billingNo", "title"]}
                    disabled={!selectedSoId || itemsLoading}
                    loading={billsLoading}
                  />
                  {selectedSoId && !billsLoading && claimBills.length === 0 && (
                    <span className="text-[12px] text-orange-500 italic mt-1">No approved claim bills for this sale order</span>
                  )}
                </PMFormRow>
              </>
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
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "60vh" }}>
              <table
                ref={tableRef}
                className="w-full table-fixed border-collapse text-[12px]"
                style={{ minWidth: 1600 }}
              >
                <thead className="sticky top-0 z-30">
                  {/* Group header row */}
                  <tr>
                    <th colSpan={6} className={`${HDR} border border-[#2e5a72] px-2 py-1 text-center text-[11px] font-semibold`}>
                      BOQ Details
                    </th>
                    <th colSpan={3} className={`${CERT_HDR} border border-[#4b5563] px-2 py-1 text-center text-[11px] font-semibold`}>
                      Certification Statement (Qty)
                    </th>
                    <th colSpan={6} className={`${US_HDR} border border-[#1e3a8a] px-2 py-1 text-center text-[11px] font-semibold`}>
                      Uncertified Statement (Qty)
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
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[100px] min-w-[90px]`}>Claim Qty</th>
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[100px] min-w-[90px]`}>Certified Qty</th>
                    <th className={`${CERT_HDR} border border-[#4b5563] px-2 py-1.5 text-right text-[11px] w-[100px] min-w-[90px]`}>Difference Qty</th>
                    <th className={`${OB_HDR} border border-[#7f1d1d] px-2 py-1.5 text-center text-[11px] w-[110px] min-w-[100px]`}>
                      Over Bill / Calc Mistake
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[110px] min-w-[100px]`}>
                      Cert. Hold Amnd Pending
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[100px] min-w-[90px]`}>
                      Non BOQ Rate
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[100px] min-w-[90px]`}>
                      Hold Unsatisfactory
                    </th>
                    <th className={`${UC_HDR} border border-[#1e40af] px-2 py-1.5 text-center text-[11px] w-[100px] min-w-[90px]`}>
                      Hold Not Completed
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
                          ? "Select a Sale Order then a Claim Bill on the left to add items"
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
                        /* Bill group header */
                        <tr key={`grp-${group.billingId ?? group.soNo}`} className="bg-[#1e3a5f]">
                          <td colSpan={TOTAL_COLS} className="px-3 py-[5px] text-white text-[11px] font-semibold">
                            <span className="opacity-70 mr-1">Bill:</span>
                            <span className="mr-3 text-yellow-300">{group.billingNo}</span>
                            <span className="opacity-50 mr-2">|</span>
                            <span className="opacity-70 mr-1">SO:</span>
                            <span className="mr-2">{group.soNo}</span>
                            <span className="opacity-50 mr-2">|</span>
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
                              {/* BOQ ordered qty (original sale order) */}
                              <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                                {l.ogBOQQty != null && Number(l.ogBOQQty) !== 0 ? Number(l.ogBOQQty).toLocaleString(undefined, { maximumFractionDigits: 4 }) : ""}
                              </td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-center text-[11px] text-gray-600">{l.unit}</td>
                              <td className="border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px]">
                                {l.unitRate != null ? formatAmount(l.unitRate) : ""}
                              </td>

                              {/* Claim qty — under Certification Statement */}
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] ${CERT_CELL}`}>
                                {l.boqQty != null ? Number(l.boqQty).toLocaleString(undefined, { maximumFractionDigits: 4 }) : ""}
                              </td>
                              {/* Cert. Qty and Diff. Qty — read-only */}
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] ${CERT_CELL}`}>
                                {Number(l.certifiedQty).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>
                              <td className={`border border-gray-200 px-1.5 py-[3px] text-right tabular-nums text-[11px] font-medium ${CERT_CELL}`}>
                                {(Number(l.boqQty || 0) - Number(l.certifiedQty || 0)).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </td>

                              {/* Over Billing — allows negative */}
                              <td className={`border border-gray-200 p-0.5 ${OB_CELL}`}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={l.overBillingCalculationMistake ?? ""}
                                  disabled={!isEditing}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const isNeg = raw.startsWith("-");
                                    const cleaned = raw.replace(/[^\d.]/g, "");
                                    const [whole, ...rest] = cleaned.split(".");
                                    const sanitized = rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 3)}`;
                                    updateLine(idx, "overBillingCalculationMistake", isNeg ? (sanitized ? `-${sanitized}` : "-") : sanitized);
                                  }}
                                  placeholder="—"
                                  className={`w-full h-[24px] text-[11px] px-1.5 text-right rounded-sm border-0 outline-none focus-visible:ring-0 ${isEditing ? "bg-white/80 focus:bg-white" : "bg-transparent"}`}
                                />
                              </td>

                              {/* Uncertified Statement cells */}
                              {["certifiedHoldAmendmentPending", "nonBoqItemsRate", "holdWork", "holdForFullWorkNotCompleted"].map((field) => (
                                <td key={field} className={`border border-gray-200 p-0.5 ${UC_CELL}`}>
                                  <QtyInput
                                    value={l[field] ?? ""}
                                    disabled={!isEditing}
                                    onChange={(e) => updateLine(idx, field, e.target.value)}
                                    placeholder="—"
                                    className={`w-full h-[24px] text-[11px] px-1.5 text-right rounded-sm border-0 outline-none focus-visible:ring-0 ${isEditing ? "bg-white/80 focus:bg-white" : "bg-transparent"}`}
                                  />
                                </td>
                              ))}

                              {/* Remarks */}
                              <td className={`border border-gray-200 p-0.5 ${UC_CELL}`}>
                                <ExpandableTextField
                                  value={l.remarks || ""}
                                  disabled={!isEditing}
                                  onChange={(val) => updateLine(idx, "remarks", val)}
                                  placeholder="Remarks..."
                                  title="Remarks"
                                  subHeader=""
                                  minHeight="min-h-[24px]"
                                  modalHeight="min-h-[120px]"
                                  className="text-[11px] px-1.5 py-0 rounded-sm border-0 shadow-none"
                                />
                              </td>
                            </tr>
                          );
                        }),
                      ];
                    })
                  )}

                </tbody>

                {/* Sticky totals footer */}
                {lines.length > 0 && (() => {
                  const totalOB = lines.reduce((s, l) => s + Number(l.overBillingCalculationMistake || 0) * Number(l.unitRate || 0), 0);
                  const totalCH = lines.reduce((s, l) => s + Number(l.certifiedHoldAmendmentPending || 0) * Number(l.unitRate || 0), 0);
                  const totalNB = lines.reduce((s, l) => s + Number(l.nonBoqItemsRate               || 0) * Number(l.unitRate || 0), 0);
                  const totalHW = lines.reduce((s, l) => s + Number(l.holdWork                      || 0) * Number(l.unitRate || 0), 0);
                  const totalHF = lines.reduce((s, l) => s + Number(l.holdForFullWorkNotCompleted   || 0) * Number(l.unitRate || 0), 0);
                  return (
                    <tfoot className="sticky bottom-0 z-20">
                      <tr className="bg-[#0f2744] text-white font-semibold text-[11px]">
                        <td colSpan={6} className="border border-[#1e3a5f] px-2 py-1.5 text-right tracking-wide text-[10px] opacity-80">TOTAL AMOUNT (BASIC)</td>
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
                    </tfoot>
                  );
                })()}
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
                  onClick={isEditing
                    ? () => {
                        setIsEditing(false);
                        setSelectedSoId("");
                        setSelectedBillId("");
                        setClaimBills([]);
                        loadDetails();
                      }
                    : () => {
                        setIsEditing(true);
                        loadSaleOrders();
                      }
                  }
                  disabled={isSubmitting}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </EditButton>
              )}


          {mode === "edit" && !isEditing && (
            <DeleteRequestButton
              moduleCode="UNCERTAIN_ALLOC"
              recordId={Number(uaId)}
              onDeleted={() => router.back()}
            />
          )}            </div>
          )}
        </div>
      </div>
    </div>
  );
}
