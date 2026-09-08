"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }           from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast }       from "sonner";
import { useRouter }   from "next/navigation";
import {
  Loader2, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight,
} from "lucide-react";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMInput          from "@/components/project-management/common/PMInput";
import PMDateInput      from "@/components/project-management/common/PMDateInput";
import PMTextarea       from "@/components/project-management/common/PMTextarea";
import BudgetItemCcRows from "./BudgetItemCcRows";

import { apiRequest }        from "@/lib/apiClient";
import { API_ENDPOINTS }     from "@/config/api.config";
import { getLocalStorage }   from "@/lib/localStorage";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

const BUDGET = API_ENDPOINTS.PROJECT.BUDGET_MASTER;

// ─── Schema ───────────────────────────────────────────────────────────────────

const ccCodeSchema = z.object({
  ccCodeId: z.coerce.number({ message: "Required" }).min(1, "Select a CC code"),
  ccCode:   z.string().optional().default(""),
  ccName:   z.string().optional().default(""),
  // AmountInput keeps the typed string in form state
  ccValue:  z.coerce.number().min(0).default(0),
});

const itemSchema = z.object({
  ogSaleOrderItemId: z.coerce.number().nullable().optional(),
  slNo:              z.coerce.number().default(1),
  itemCode:          z.string().optional().default(""),
  itemName:          z.string().optional().default(""),
  itemDescription:   z.string().optional().default(""),
  unitItem:          z.string().optional().default(""),
  orderQty:          z.coerce.number().min(0).default(0),
  rate:              z.coerce.number().min(0).default(0),
  ccCodes:           z.array(ccCodeSchema).default([]),
});

const schema = z.object({
  saleOrderId: z.coerce.number({ message: "Sale Order is required" }).min(1, "Sale Order is required"),
  budgetDate:  z.string().min(1, "Budget date is required"),
  remarks:     z.string().optional().default(""),
  items:       z.array(itemSchema).min(1, "Select a sale order to load its items"),
});

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_VALUES = {
  saleOrderId: null,
  budgetDate:  today(),
  remarks:     "",
  items:       [],
};

// Stable fallback — a fresh [] each render would re-run the totals useMemo every time
const NO_ITEMS = [];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BudgetMasterForm({ mode = "create", budgetId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(false);
  const [isLoading,   setIsLoading]   = useState(mode !== "create");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [budgetNo,   setBudgetNo]   = useState("");
  const [orderOpts,  setOrderOpts]  = useState([]);
  const [ccOptions,  setCcOptions]  = useState([]);
  const [orderInfo,  setOrderInfo]  = useState({ no: "", title: "" });
  const [expanded,   setExpanded]   = useState({});   // itemIndex → bool
  const [initialData, setInitialData] = useState(null);

  const {
    control, register, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields, replace: replaceItems } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // useWatch, not watch(): the CC rows live in a nested useFieldArray inside a
  // child component, and watch() does not reliably re-render this parent when
  // one of those nested values changes — which left CC Cost and Grand Total at 0
  const watchedItems = useWatch({ control, name: "items", defaultValue: NO_ITEMS }) ?? NO_ITEMS;

  // ── Totals — Grand Total = Σ initial amounts + Σ all CC code costs ─────────
  const totals = useMemo(() => {
    let initial = 0;
    let cc      = 0;
    const perItem = watchedItems.map((it) => {
      const qty           = Number(it?.orderQty || 0);
      const initialAmount = qty * Number(it?.rate || 0);
      const itemCcCost    = (it?.ccCodes || []).reduce(
        (s, c) => s + qty * Number(c?.ccValue || 0),
        0,
      );
      initial += initialAmount;
      cc      += itemCcCost;
      return { initialAmount, itemCcCost, totalCost: initialAmount + itemCcCost };
    });
    return { perItem, totalInitialCost: initial, totalCcCost: cc, grandTotal: initial + cc };
  }, [watchedItems]);

  // ── Lookups ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${BUDGET.SALE_ORDERS}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.list || []);
        setOrderOpts(
          list.map((o) => ({
            ...o,
            id: o.id ?? o.saleOrderId ?? o.ogSaleOrderId,
            displayLabel: [o.ogSaleOrderNo || o.saleOrderNo || o.orderNo, o.orderTitle || o.saleOrderTitle]
              .filter(Boolean).join(" — "),
          })),
        );
      })
      .catch(() => toast.error("Failed to load sale orders"));

    apiRequest({ url: BUDGET.CC_CODES, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.list || []);
        setCcOptions(
          list.map((c) => ({
            ...c,
            id: c.id ?? c.ccId ?? c.ccCodeId,
            displayLabel: [c.ccCode, c.ccName].filter(Boolean).join(" — "),
          })),
        );
      })
      .catch(() => toast.error("Failed to load CC codes"));
  }, [projectCode]);

  // ── Sale order selected → pull its items ──────────────────────────────────
  const loadOrderItems = useCallback(async (soId, option) => {
    if (!soId) return;
    setItemsLoading(true);
    try {
      const res  = await apiRequest({ url: `${BUDGET.SALE_ORDER_ITEMS}${soId}`, method: "GET" });
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      replaceItems(
        list.map((it, i) => ({
          ogSaleOrderItemId: it.id ?? it.ogSaleOrderItemId ?? null,
          slNo:              it.slNo || i + 1,
          itemCode:          it.itemCode        || "",
          itemName:          it.itemName        || "",
          itemDescription:   it.itemDescription || it.description || "",
          unitItem:          it.unitItem        || it.unit || "",
          orderQty:          Number(it.orderQty ?? it.qty ?? 0),
          rate:              Number(it.rate     ?? 0),
          ccCodes:           [],
        })),
      );
      setOrderInfo({
        no:    option?.ogSaleOrderNo || option?.saleOrderNo || option?.orderNo || res.data?.saleOrderNo || "",
        title: option?.orderTitle    || option?.saleOrderTitle || res.data?.saleOrderTitle || "",
      });
      setExpanded({});
      if (!list.length) toast.info("This sale order has no items");
    } catch (err) {
      toast.error(err?.message || "Failed to load sale order items");
    } finally {
      setItemsLoading(false);
    }
  }, [replaceItems]);

  // ── Load existing budget (edit / view / approver) ──────────────────────────
  useEffect(() => {
    if (mode === "create" || !budgetId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({ url: `${BUDGET.GET_BY_ID}${budgetId}`, method: "GET" });
        const d   = res.data || {};
        const formatted = {
          saleOrderId: d.saleOrderId ?? null,
          budgetDate:  d.budgetDate  || "",
          remarks:     d.remarks     || "",
          items: (d.items || []).map((it, i) => ({
            ogSaleOrderItemId: it.ogSaleOrderItemId ?? null,
            slNo:              it.slNo || i + 1,
            itemCode:          it.itemCode        || "",
            itemName:          it.itemName        || "",
            itemDescription:   it.itemDescription || "",
            unitItem:          it.unitItem        || it.unit || "",
            orderQty:          Number(it.orderQty || 0),
            rate:              Number(it.rate     || 0),
            ccCodes: (it.ccCodes || []).map((c) => ({
              ccCodeId: c.ccCodeId ?? c.id ?? null,
              ccCode:   c.ccCode   || "",
              ccName:   c.ccName   || "",
              ccValue:  Number(c.ccValue || 0),
            })),
          })),
        };
        reset(formatted);
        setInitialData(formatted);
        setBudgetNo(d.budgetNo || "");
        setOrderInfo({ no: d.saleOrderNo || "", title: d.saleOrderTitle || "" });
        if (d.budgetUuid && onUuid) onUuid(d.budgetUuid);

        // Editable only while Draft / Reback, per the spec
        const editable = ["draft", "reback"].includes(String(d.workflowStatus || "").toLowerCase());
        setIsSubmitted(!editable);
        setAllowSubmit(editable);
        setIsEditing(false);
      } catch (err) {
        toast.error(err?.message || "Failed to load budget");
        setIsSubmitted(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [budgetId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Payload ───────────────────────────────────────────────────────────────
  const buildPayload = (v) => ({
    projectCode,
    saleOrderId: Number(v.saleOrderId),
    budgetDate:  v.budgetDate,
    remarks:     v.remarks || "",
    items: v.items.map((it, i) => ({
      ogSaleOrderItemId: it.ogSaleOrderItemId ?? null,
      slNo:              i + 1,
      itemCode:          it.itemCode        || "",
      itemName:          it.itemName        || "",
      itemDescription:   it.itemDescription || "",
      unitItem:          it.unitItem        || "",
      orderQty:          Number(it.orderQty || 0),
      rate:              Number(it.rate     || 0),
      ccCodes: (it.ccCodes || []).map((c) => ({
        ccCodeId: Number(c.ccCodeId),
        ccValue:  Number(c.ccValue || 0),
      })),
    })),
  });

  // A CC code must not be allocated twice on the same item
  const findDuplicateCc = (items) => {
    for (let i = 0; i < items.length; i++) {
      const seen = new Set();
      for (const c of items[i].ccCodes || []) {
        const id = Number(c.ccCodeId);
        if (!id) continue;
        if (seen.has(id)) return { row: i + 1, ccCode: c.ccCode || id };
        seen.add(id);
      }
    }
    return null;
  };

  const onSave = async (v) => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    const dupe = findDuplicateCc(v.items);
    if (dupe) {
      toast.error(`Item ${dupe.row}: CC code ${dupe.ccCode} is allocated twice`);
      return;
    }

    const tid = toast.loading(mode === "create" ? "Creating budget…" : "Saving budget…");
    try {
      const res = await apiRequest({
        url:    mode === "create" ? BUDGET.CREATE : `${BUDGET.UPDATE}${budgetId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(v),
      });
      toast.success(mode === "create" ? "Budget saved as draft" : "Budget updated", { id: tid });
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      if (res?.data?.budgetNo) setBudgetNo(res.data.budgetNo);
      if (res?.data?.budgetUuid && onUuid) onUuid(res.data.budgetUuid);
      onAfterSubmit?.();
      if (mode === "create" && res?.data?.id) {
        setTimeout(() => router.push(`/project-management/contacts/budget/${res.data.id}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save budget", { id: tid });
    }
  };

  const onSubmitForApproval = async () => {
    const tid = toast.loading("Submitting…");
    try {
      await apiRequest({ url: `${BUDGET.SUBMIT}${budgetId}`, method: "POST" });
      toast.success("Budget submitted for approval", { id: tid });
      setIsSubmitted(true);
      setAllowSubmit(false);
      setIsEditing(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Failed to submit", { id: tid });
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  const toggleExpand = (i) => setExpanded((p) => ({ ...p, [i]: !p[i] }));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
      </div>
    );
  }

  const COL_COUNT = 9;

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

        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[385px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Budget Details:">
            <PMFormRow label="Budget No" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={budgetNo || "[Auto]"} disabled readOnly expandable={false} className="max-w-[180px]" />
            </PMFormRow>

            <PMFormRow label="Budget Date" required={!disabled} labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMDateInput
                {...register("budgetDate")}
                disabled={disabled}
                hasError={errors.budgetDate}
                className="max-w-[200px]"
              />
            </PMFormRow>

            <PMFormRow label="Sale Order" required={!disabled} labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <Controller
                name="saleOrderId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={orderOpts}
                    value={field.value ? String(field.value) : ""}
                    // The item list is a snapshot of the order — changing it after
                    // CC codes are allocated would silently discard them
                    disabled={disabled || mode !== "create"}
                    onChange={(val, opt) => {
                      field.onChange(val ? Number(val) : null);
                      loadOrderItems(val, opt);
                    }}
                    placeholder="Select approved sale order…"
                    labelKey="displayLabel"
                    valueKey="id"
                    searchKeys={["displayLabel", "ogSaleOrderNo", "orderNo", "orderTitle"]}
                    className={errors.saleOrderId ? "border-red-500" : ""}
                  />
                )}
              />
            </PMFormRow>

            <PMFormRow label="Sale Order No" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={orderInfo.no || ""} disabled readOnly placeholder="[Auto]" />
            </PMFormRow>

            <PMFormRow label="Order Title" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={orderInfo.title || ""} disabled readOnly placeholder="[Auto]" fieldLabel="Order Title" />
            </PMFormRow>
          </PMSection>

          <PMSection title="Cost Summary:">
            <PMFormRow label="Initial Cost" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={formatAmount(totals.totalInitialCost)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="CC Code Cost" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <PMInput value={formatAmount(totals.totalCcCost)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Grand Total" labelWidth="sm:w-[130px] sm:min-w-[130px]">
              <div className="w-full h-[30px] flex items-center justify-end px-2 rounded-sm bg-[#f6d9b8] border border-[#d99b57] text-[13px] font-bold text-[#6b3000] tabular-nums">
                {formatAmount(totals.grandTotal)}
              </div>
            </PMFormRow>
          </PMSection>

          <PMSection title="Remarks:">
            <Controller
              name="remarks"
              control={control}
              render={({ field }) => (
                <PMTextarea
                  value={field.value || ""}
                  onChange={field.onChange}
                  disabled={disabled}
                  placeholder="Budget remarks…"
                  rows={3}
                  maxRows={8}
                />
              )}
            />
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="border border-gray-300 rounded-sm overflow-hidden">
            <div className="bg-[#d6e6f2] px-3 py-[6px] border-b border-gray-300 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#144664]">
                Budget Items &amp; CC Code Allocation
              </span>
              <span className="text-[12px] font-semibold text-[#144664] tabular-nums">
                Grand Total: {formatAmount(totals.grandTotal)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#144664] text-white">
                    <th className="border border-[#2e5a72] px-1 py-1.5 w-[30px]" />
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-center font-semibold w-[46px]">SL</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-left font-semibold w-[92px]">Item Code</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-left font-semibold">Item Name &amp; Description</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-left font-semibold w-[76px]">Unit</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[96px]">Order Qty</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[104px]">Rate</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[120px]">Initial Amt</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[120px]">CC Cost</th>
                    <th className="border border-[#2e5a72] px-2 py-1.5 text-right font-semibold w-[130px]">Total Cost</th>
                  </tr>
                </thead>

                <tbody>
                  {itemsLoading ? (
                    <tr>
                      <td colSpan={COL_COUNT + 1} className="border border-gray-200 py-6 text-center text-gray-400">
                        <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading sale order items…
                      </td>
                    </tr>
                  ) : itemFields.length === 0 ? (
                    <tr>
                      <td colSpan={COL_COUNT + 1} className="border border-gray-200 py-8 text-center text-[#bbb] italic">
                        Select a Sale Order to load its items
                      </td>
                    </tr>
                  ) : (
                    itemFields.map((field, idx) => {
                      const item  = watchedItems[idx] || {};
                      const calc  = totals.perItem[idx] || { initialAmount: 0, itemCcCost: 0, totalCost: 0 };
                      const open  = expanded[idx] ?? true;
                      const ccQty = (item.ccCodes || []).length;

                      return (
                        <FragmentRows
                          key={field.id}
                          idx={idx}
                          item={item}
                          calc={calc}
                          open={open}
                          ccQty={ccQty}
                          onToggle={() => toggleExpand(idx)}
                          control={control}
                          setValue={setValue}
                          ccOptions={ccOptions}
                          disabled={disabled}
                          colSpan={COL_COUNT + 1}
                        />
                      );
                    })
                  )}

                  {itemFields.length > 0 && (
                    <tr className="bg-[#d6e6f2] font-semibold">
                      <td colSpan={7} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                        TOTAL
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">
                        {formatAmount(totals.totalInitialCost)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums">
                        {formatAmount(totals.totalCcCost)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px] tabular-nums font-bold">
                        {formatAmount(totals.grandTotal)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {errors.items && (
            <p className="text-[12px] text-red-500">{errors.items.message || "Check the item rows"}</p>
          )}

          {/* ── Action buttons ─────────────────────────────────────────────── */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  requireConfirmation
                  confirmationTitle="Save Budget as Draft?"
                  confirmationMessage="This budget will be saved as a draft and can be edited or submitted later."
                >
                  Save as Draft
                </SaveDraftButton>
              )}

              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                loadingText="Submitting…"
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                requireConfirmation
                confirmationTitle="Submit Budget for Approval?"
                confirmationMessage="Once submitted, this budget is locked and sent for approval."
              >
                Submit
              </SaveButton>

              {mode === "edit" && !isSubmitted && (
                <EditButton onClick={handleEdit} disabled={isSubmitting}>
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

/* Item row + its CC allocation rows */
function FragmentRows({ idx, item, calc, open, ccQty, onToggle, control, setValue, ccOptions, disabled, colSpan }) {
  return (
    <>
      <tr className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
        <td className="border border-gray-200 px-1 py-[3px] text-center align-top">
          <button
            type="button"
            onClick={onToggle}
            title={open ? "Hide CC codes" : "Show CC codes"}
            className="p-0.5 text-[#3b6ea5] hover:bg-[#e6eef7] rounded transition"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-500 align-top">
          {item.slNo || idx + 1}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top font-medium text-[#144664]">
          {item.itemCode || "—"}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top">
          <div className="text-gray-800">{item.itemName || "—"}</div>
          {item.itemDescription && (
            <div className="text-[11px] text-gray-500">{item.itemDescription}</div>
          )}
          {!open && ccQty > 0 && (
            <div className="text-[10px] text-[#3b6ea5] mt-0.5">{ccQty} CC code{ccQty > 1 ? "s" : ""} allocated</div>
          )}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-gray-600">{item.unitItem || "—"}</td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-right tabular-nums">
          {formatQtyDisplay(item.orderQty)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-right tabular-nums">
          {formatAmount(item.rate)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-right tabular-nums bg-[#f3f8f3]">
          {formatAmount(calc.initialAmount)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-right tabular-nums">
          {formatAmount(calc.itemCcCost)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] align-top text-right tabular-nums font-semibold">
          {formatAmount(calc.totalCost)}
        </td>
      </tr>

      {open && (
        <BudgetItemCcRows
          control={control}
          setValue={setValue}
          itemIndex={idx}
          orderQty={item.orderQty}
          ccOptions={ccOptions}
          disabled={disabled}
          colSpan={colSpan}
        />
      )}
    </>
  );
}
