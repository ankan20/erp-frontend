"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }           from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast }       from "sonner";
import { useRouter }   from "next/navigation";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton       from "@/components/common/SaveButton";
import SaveDraftButton  from "@/components/common/SaveDraftButton";
import EditButton       from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection        from "@/components/project-management/common/PMSection";
import PMFormRow        from "@/components/project-management/common/PMFormRow";
import PMInput          from "@/components/project-management/common/PMInput";
import PMDateInput      from "@/components/project-management/common/PMDateInput";
import PMTextarea       from "@/components/project-management/common/PMTextarea";
import BudgetCcMatrix    from "./BudgetCcMatrix";

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

/**
 * Give every item the same CC column list, in first-seen order.
 * A saved budget only stores the CC codes an item actually uses, but the grid
 * addresses cells by column index, so the arrays must line up.
 */
function alignCcColumns(items) {
  const columns = [];
  const seen    = new Set();
  items.forEach((it) => {
    (it.ccCodes || []).forEach((c) => {
      const id = Number(c.ccCodeId);
      if (!id || seen.has(id)) return;
      seen.add(id);
      columns.push({ ccCodeId: id, ccCode: c.ccCode || "", ccName: c.ccName || "" });
    });
  });
  return items.map((it) => ({
    ...it,
    ccCodes: columns.map((col) => {
      const hit = (it.ccCodes || []).find((c) => Number(c.ccCodeId) === col.ccCodeId);
      return { ...col, ccValue: hit ? hit.ccValue : "" };
    }),
  }));
}

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
  const [initialData, setInitialData] = useState(null);

  const {
    control, register, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { replace: replaceItems } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // useWatch, not watch(): the CC rows live in a nested useFieldArray inside a
  // child component, and watch() does not reliably re-render this parent when
  // one of those nested values changes — which left CC Cost and Grand Total at 0
  const watchedItems = useWatch({ control, name: "items", defaultValue: NO_ITEMS }) ?? NO_ITEMS;

  // CC codes are columns shared by every item, so items[i].ccCodes is kept
  // index-aligned with this list — cell (i, c) is items.<i>.ccCodes.<c>
  const ccColumns = watchedItems[0]?.ccCodes ?? NO_ITEMS;

  // ── Totals — Grand Total = Σ initial amounts + Σ all CC code costs ─────────
  const totals = useMemo(() => {
    let initial = 0;
    let cc      = 0;
    const perColumn = [];
    const perItem = watchedItems.map((it) => {
      const qty           = Number(it?.orderQty || 0);
      const initialAmount = qty * Number(it?.rate || 0);
      let itemCcCost      = 0;
      (it?.ccCodes || []).forEach((c, ci) => {
        const cell = qty * Number(c?.ccValue || 0);
        itemCcCost   += cell;
        perColumn[ci] = (perColumn[ci] || 0) + cell;
      });
      initial += initialAmount;
      cc      += itemCcCost;
      return { initialAmount, itemCcCost, totalCost: initialAmount + itemCcCost };
    });
    return {
      perItem, perColumn,
      totalInitialCost: initial,
      totalCcCost:      cc,
      grandTotal:       initial + cc,
    };
  }, [watchedItems]);

  // ── CC columns: adding one gives every item a new allocation cell ──────────
  const addCcColumn = useCallback((ccId, opt) => {
    const items = getValues("items") || [];
    if (!items.length) return;
    const id = Number(ccId);
    if ((items[0].ccCodes || []).some((c) => Number(c.ccCodeId) === id)) {
      toast.error(`${opt?.ccCode || "That CC code"} is already a column`);
      return;
    }
    setValue(
      "items",
      items.map((it) => ({
        ...it,
        ccCodes: [
          ...(it.ccCodes || []),
          { ccCodeId: id, ccCode: opt?.ccCode || "", ccName: opt?.ccName || "", ccValue: "" },
        ],
      })),
      { shouldDirty: true },
    );
  }, [getValues, setValue]);

  const removeCcColumn = useCallback((colIndex) => {
    const items = getValues("items") || [];
    setValue(
      "items",
      items.map((it) => ({
        ...it,
        ccCodes: (it.ccCodes || []).filter((_, i) => i !== colIndex),
      })),
      { shouldDirty: true },
    );
  }, [getValues, setValue]);

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
        // Saved items only carry the CC codes they actually use. The grid needs
        // every item aligned to one column list, so normalise to their union.
        formatted.items = alignCcColumns(formatted.items);
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
      // A column exists for every item, but only cells with a value are a real
      // allocation — send those, so an item is not stored against CC codes it
      // was never budgeted for
      ccCodes: (it.ccCodes || [])
        .filter((c) => Number(c.ccCodeId) > 0 && Number(c.ccValue || 0) > 0)
        .map((c) => ({
          ccCodeId: Number(c.ccCodeId),
          ccValue:  Number(c.ccValue),
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
          <BudgetCcMatrix
            control={control}
            items={watchedItems}
            ccColumns={ccColumns}
            totals={totals}
            ccOptions={ccOptions}
            disabled={disabled}
            itemsLoading={itemsLoading}
            onAddColumn={addCcColumn}
            onRemoveColumn={removeCcColumn}
          />


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
