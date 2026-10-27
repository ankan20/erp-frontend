"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import BudgetCcMatrix   from "./BudgetCcMatrix";

import { apiRequest }        from "@/lib/apiClient";
import { API_ENDPOINTS }     from "@/config/api.config";
import { getLocalStorage }   from "@/lib/localStorage";
import { formatAmount }      from "@/helper/numberFormatter";

const BUDGET = API_ENDPOINTS.PROJECT.BUDGET_MASTER;

// ─── Schema ───────────────────────────────────────────────────────────────────

const entrySchema = z.object({
  slNo:        z.coerce.number().default(1),
  description: z.string().default(""),
  amount:      z.coerce.number().min(0).default(0),
});

const ccCodeSchema = z.object({
  ccCodeId: z.coerce.number().min(1),
  ccCode:   z.string().default(""),
  ccName:   z.string().default(""),
  ccValue:  z.coerce.number().min(0).default(0),
  entries:  z.array(entrySchema).default([]),
});

const overheadCcSchema = z.object({
  ccCodeId:      z.coerce.number().min(1),
  ccCode:        z.string().default(""),
  ccName:        z.string().default(""),
  estimatedCost: z.coerce.number().min(0).default(0),
});

const itemSchema = z.object({
  ogSaleOrderItemId: z.coerce.number().nullable().optional(),
  type:              z.string().default(""),
  slNo:              z.coerce.number().default(1),
  itemCode:          z.string().default(""),
  itemName:          z.string().default(""),
  itemDescription:   z.string().default(""),
  unitItem:          z.string().default(""),
  orderQty:          z.coerce.number().min(0).default(0),
  rate:              z.coerce.number().min(0).default(0),
  ccCodes:           z.array(ccCodeSchema).default([]),
});

const schema = z.object({
  saleOrderId:       z.coerce.number({ message: "Sale Order is required" }).min(1),
  budgetDate:        z.string().min(1, "Budget date is required"),
  remarks:           z.string().default(""),
  orderValueExclGst: z.coerce.number().default(0),
  projectOverhead:   z.array(overheadCcSchema).default([]),
  employeeOverhead:  z.array(overheadCcSchema).default([]),
  items:             z.array(itemSchema).min(1, "Select a sale order to load items"),
});

const today = () => new Date().toISOString().slice(0, 10);

const DEFAULT_VALUES = {
  saleOrderId:       null,
  budgetDate:        today(),
  remarks:           "",
  orderValueExclGst: 0,
  projectOverhead:   [],
  employeeOverhead:  [],
  items:             [],
};

const NO_ITEMS = [];

// Ensure every item carries the same CC column list (index-aligned)
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
      return { ...col, ccValue: hit?.ccValue ?? 0, entries: hit?.entries ?? [] };
    }),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BudgetMasterForm({ mode = "create", budgetId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(mode !== "create");
  const [itemsLoading, setItemsLoading] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);

  const [budgetNo,    setBudgetNo]    = useState("");
  const [orderOpts,   setOrderOpts]   = useState([]);
  const [orderInfo,   setOrderInfo]   = useState({ no: "", title: "" });
  const [initialData, setInitialData] = useState(null);

  // CC codes split by group — loaded once
  const [directExpensesCcs,  setDirectExpensesCcs]  = useState([]);
  const [projectOverheadCcs, setProjectOverheadCcs] = useState([]);
  const [employeeOverheadCcs,setEmployeeOverheadCcs]= useState([]);

  const deCcsRef = useRef([]);

  const {
    control, register, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { replace: replaceItems } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  const watchedItems       = useWatch({ control, name: "items",            defaultValue: NO_ITEMS }) ?? NO_ITEMS;
  const watchedPO          = useWatch({ control, name: "projectOverhead",  defaultValue: [] }) ?? [];
  const watchedEO          = useWatch({ control, name: "employeeOverhead", defaultValue: [] }) ?? [];
  const orderValueExclGst  = useWatch({ control, name: "orderValueExclGst", defaultValue: 0 }) ?? 0;

  // Columns = DE cc codes (from first item, all items are aligned)
  const deCcColumns = watchedItems[0]?.ccCodes ?? NO_ITEMS;

  // ── Overhead percentages ──────────────────────────────────────────────────
  const poTotalEstimated = watchedPO.reduce((s, c) => s + Number(c.estimatedCost || 0), 0);
  const eoTotalEstimated = watchedEO.reduce((s, c) => s + Number(c.estimatedCost || 0), 0);
  const ov               = Number(orderValueExclGst || 0);
  const poPercent        = ov > 0 ? poTotalEstimated / ov * 100 : 0;
  const eoPercent        = ov > 0 ? eoTotalEstimated / ov * 100 : 0;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let totalAmount    = 0;
    let totalDrcw      = 0;
    let totalPo        = 0;
    let totalEo        = 0;
    let totalTec       = 0;
    let totalProfit    = 0;

    const perColumn = []; // per DE column totals

    const perItem = watchedItems.map((it) => {
      const qty    = Number(it?.orderQty || 0);
      const rate   = Number(it?.rate     || 0);
      const amount = qty * rate;

      // DRCW = sum of all DE CC codes (DRCW stores the per-unit cost itself,
      // but in the new model DRCW is derived = sum of sibling DE cc codes × qty)
      // We treat every DE column's ccValue as a cost component; DRCW column
      // is read-only and equals their sum. We still store ccValue per column.
      let drcwAmount = 0;
      (it?.ccCodes || []).forEach((c, ci) => {
        const cellTotal = qty * Number(c?.ccValue || 0);
        drcwAmount += cellTotal;
        perColumn[ci] = (perColumn[ci] || 0) + cellTotal;
      });

      const rowOv = Number(orderValueExclGst || 0);
      const rowPo = rowOv > 0 ? amount * (poTotalEstimated / rowOv) : 0;
      const rowEo = rowOv > 0 ? amount * (eoTotalEstimated / rowOv) : 0;
      const tec   = drcwAmount + rowPo + rowEo;
      const profit = amount - tec;
      const profitPct = amount > 0 ? profit / amount * 100 : 0;

      totalAmount += amount;
      totalDrcw   += drcwAmount;
      totalPo     += rowPo;
      totalEo     += rowEo;
      totalTec    += tec;
      totalProfit += profit;

      return { amount, drcwAmount, poAmount: rowPo, eoAmount: rowEo, tec, profit, profitPct };
    });

    const totalProfitPct = totalAmount > 0 ? totalProfit / totalAmount * 100 : 0;

    return {
      perItem, perColumn,
      totalAmount, totalDrcw, totalPo, totalEo, totalTec, totalProfit, totalProfitPct,
      poPercent, eoPercent,
    };
  }, [watchedItems, orderValueExclGst, poTotalEstimated, eoTotalEstimated, poPercent, eoPercent]);

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

    // Load all CC codes with group info
    apiRequest({ url: BUDGET.CC_CODES, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.list || []);
        const de  = list.filter((c) => c.groupName === "Direct Expenses");
        const po  = list.filter((c) => c.groupName === "Project Overhead");
        const eo  = list.filter((c) => c.groupName === "Employee Overhead");
        deCcsRef.current = de;
        setDirectExpensesCcs(de);
        setProjectOverheadCcs(po);
        setEmployeeOverheadCcs(eo);
      })
      .catch(() => toast.error("Failed to load CC codes"));
  }, [projectCode]);

  // ── Sale order selected → pull its items ─────────────────────────────────
  const loadOrderItems = useCallback(async (soId, option) => {
    if (!soId) return;
    setItemsLoading(true);
    try {
      const res  = await apiRequest({ url: `${BUDGET.SALE_ORDER_ITEMS}${soId}`, method: "GET" });
      const d    = res.data || {};
      const list = Array.isArray(d) ? d : (d.items || []);

      const deCcs = deCcsRef.current;
      const defaultCcCols = deCcs.map((c) => ({
        ccCodeId: c.id,
        ccCode:   c.ccCode,
        ccName:   c.ccName || "",
        ccValue:  0,
        entries:  [],
      }));

      replaceItems(
        list.map((it, i) => ({
          ogSaleOrderItemId: it.id ?? it.ogSaleOrderItemId ?? null,
          type:              it.type || "",
          slNo:              it.slNo || i + 1,
          itemCode:          it.itemCode        || "",
          itemName:          it.itemName        || "",
          itemDescription:   it.itemDescription || it.description || "",
          unitItem:          it.unitItem        || it.unit || "",
          orderQty:          Number(it.orderQty ?? it.qty ?? 0),
          rate:              Number(it.rate     ?? 0),
          ccCodes:           defaultCcCols,
        })),
      );

      // Store order value excl GST for overhead % calc
      const ov = Number(d.orderValueExclGst || 0);
      setValue("orderValueExclGst", ov, { shouldDirty: false });

      setOrderInfo({
        no:    option?.ogSaleOrderNo || option?.saleOrderNo || d.ogSaleOrderNo || "",
        title: option?.orderTitle    || option?.saleOrderTitle || d.orderTitle || "",
      });

      // Pre-fill overhead CC lists (no estimated cost yet)
      const poRows = (getValues("projectOverhead")  || []);
      const eoRows = (getValues("employeeOverhead") || []);
      if (!poRows.length) {
        setValue("projectOverhead",  projectOverheadCcs.map((c) => ({ ccCodeId: c.id, ccCode: c.ccCode, ccName: c.ccName || "", estimatedCost: 0 })));
      }
      if (!eoRows.length) {
        setValue("employeeOverhead", employeeOverheadCcs.map((c) => ({ ccCodeId: c.id, ccCode: c.ccCode, ccName: c.ccName || "", estimatedCost: 0 })));
      }

      if (!list.length) toast.info("This sale order has no items");
    } catch (err) {
      toast.error(err?.message || "Failed to load sale order items");
    } finally {
      setItemsLoading(false);
    }
  }, [replaceItems, setValue, getValues, projectOverheadCcs, employeeOverheadCcs]);

  // ── Load existing budget ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !budgetId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({ url: `${BUDGET.GET_BY_ID}${budgetId}`, method: "GET" });
        const d   = res.data || {};

        const formatted = {
          saleOrderId:       d.saleOrderId ?? null,
          budgetDate:        d.budgetDate  || "",
          remarks:           d.remarks     || "",
          orderValueExclGst: Number(d.orderValueExclGst || 0),
          projectOverhead: (d.projectOverhead  || []).map((c) => ({
            ccCodeId:      Number(c.ccCodeId),
            ccCode:        c.ccCode   || "",
            ccName:        c.ccName   || "",
            estimatedCost: Number(c.estimatedCost || 0),
          })),
          employeeOverhead: (d.employeeOverhead || []).map((c) => ({
            ccCodeId:      Number(c.ccCodeId),
            ccCode:        c.ccCode   || "",
            ccName:        c.ccName   || "",
            estimatedCost: Number(c.estimatedCost || 0),
          })),
          items: (d.items || []).map((it, i) => ({
            ogSaleOrderItemId: it.ogSaleOrderItemId ?? null,
            type:              it.type || "",
            slNo:              it.slNo || i + 1,
            itemCode:          it.itemCode        || "",
            itemName:          it.itemName        || "",
            itemDescription:   it.itemDescription || "",
            unitItem:          it.unitItem || it.unit || "",
            orderQty:          Number(it.orderQty || 0),
            rate:              Number(it.rate     || 0),
            ccCodes: (it.ccCodes || []).map((c) => ({
              ccCodeId: Number(c.ccCodeId ?? c.id ?? 0),
              ccCode:   c.ccCode || "",
              ccName:   c.ccName || "",
              ccValue:  Number(c.ccValue || 0),
              entries:  (c.entries || []).map((e, ei) => ({
                slNo:        e.slNo || ei + 1,
                description: e.description || "",
                amount:      Number(e.amount || 0),
              })),
            })),
          })),
        };

        formatted.items = alignCcColumns(formatted.items);
        reset(formatted);
        setInitialData(formatted);
        setBudgetNo(d.budgetNo || "");
        setOrderInfo({ no: d.saleOrderNo || "", title: d.saleOrderTitle || "" });
        if (d.budgetUuid && onUuid) onUuid(d.budgetUuid);

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
    saleOrderId:       Number(v.saleOrderId),
    budgetDate:        v.budgetDate,
    remarks:           v.remarks || "",
    orderValueExclGst: Number(v.orderValueExclGst || 0),
    projectOverhead: (v.projectOverhead || []).map((c) => ({
      ccCodeId:      Number(c.ccCodeId),
      ccCode:        c.ccCode,
      ccName:        c.ccName,
      estimatedCost: Number(c.estimatedCost || 0),
    })),
    employeeOverhead: (v.employeeOverhead || []).map((c) => ({
      ccCodeId:      Number(c.ccCodeId),
      ccCode:        c.ccCode,
      ccName:        c.ccName,
      estimatedCost: Number(c.estimatedCost || 0),
    })),
    items: v.items.map((it, i) => ({
      ogSaleOrderItemId: it.ogSaleOrderItemId ?? null,
      type:              it.type || "",
      slNo:              i + 1,
      itemCode:          it.itemCode        || "",
      itemName:          it.itemName        || "",
      itemDescription:   it.itemDescription || "",
      unitItem:          it.unitItem        || "",
      orderQty:          Number(it.orderQty || 0),
      rate:              Number(it.rate     || 0),
      ccCodes: (it.ccCodes || [])
        .filter((c) => Number(c.ccCodeId) > 0)
        .map((c) => ({
          ccCodeId: Number(c.ccCodeId),
          ccValue:  Number(c.ccValue || 0),
          entries:  (c.entries || [])
            .filter((e) => (e.description || "").trim())
            .map((e, ei) => ({
              slNo:        ei + 1,
              description: (e.description || "").trim(),
              amount:      Number(e.amount || 0),
            })),
        })),
    })),
  });

  const onSave = async (v) => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
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

        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[385px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          <PMSection title="Budget Details:">
            <PMFormRow label="Budget No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={budgetNo || "[Auto]"} disabled readOnly expandable={false} className="max-w-[180px]" />
            </PMFormRow>
            <PMFormRow label="Budget Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput
                {...register("budgetDate")}
                disabled={disabled}
                hasError={errors.budgetDate}
                className="max-w-[200px]"
              />
            </PMFormRow>
            <PMFormRow label="Sale Order" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="saleOrderId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={orderOpts}
                    value={field.value ? String(field.value) : ""}
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
            <PMFormRow label="Sale Order No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={orderInfo.no || ""} disabled readOnly placeholder="[Auto]" />
            </PMFormRow>
            <PMFormRow label="Order Title" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={orderInfo.title || ""} disabled readOnly placeholder="[Auto]" />
            </PMFormRow>
            <PMFormRow label="Order Value (excl. GST)" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={formatAmount(orderValueExclGst)} disabled readOnly expandable={false} />
            </PMFormRow>
          </PMSection>

          <PMSection title="Cost Summary:">
            <PMFormRow label="Total Amount" labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <PMInput value={formatAmount(totals.totalAmount)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Direct Expenses Cost" labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <PMInput value={formatAmount(totals.totalDrcw)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label={`Project Overhead (${totals.poPercent.toFixed(2)}%)`} labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <PMInput value={formatAmount(totals.totalPo)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label={`Employee Overhead (${totals.eoPercent.toFixed(2)}%)`} labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <PMInput value={formatAmount(totals.totalEo)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Total Exec. Cost" labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <PMInput value={formatAmount(totals.totalTec)} disabled readOnly expandable={false} />
            </PMFormRow>
            <PMFormRow label="Total Profit" labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <div className={`w-full h-[30px] flex items-center justify-end px-2 rounded-sm border text-[13px] font-bold tabular-nums ${
                totals.totalProfit >= 0
                  ? "bg-[#f0fdf4] border-[#86efac] text-[#166534]"
                  : "bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]"
              }`}>
                {formatAmount(totals.totalProfit)}
              </div>
            </PMFormRow>
            <PMFormRow label="Profit %" labelWidth="sm:w-[165px] sm:min-w-[165px]">
              <div className={`w-full h-[30px] flex items-center justify-end px-2 rounded-sm border text-[13px] font-bold tabular-nums ${
                totals.totalProfitPct >= 0
                  ? "bg-[#f0fdf4] border-[#86efac] text-[#166534]"
                  : "bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]"
              }`}>
                {totals.totalProfitPct.toFixed(2)}%
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

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">
          <BudgetCcMatrix
            control={control}
            setValue={setValue}
            items={watchedItems}
            deCcColumns={deCcColumns}
            totals={totals}
            poPercent={totals.poPercent}
            eoPercent={totals.eoPercent}
            projectOverhead={watchedPO}
            employeeOverhead={watchedEO}
            projectOverheadCcs={projectOverheadCcs}
            employeeOverheadCcs={employeeOverheadCcs}
            orderValueExclGst={ov}
            disabled={disabled}
            itemsLoading={itemsLoading}
          />

          {errors.items && (
            <p className="text-[12px] text-red-500">{errors.items.message || "Check the item rows"}</p>
          )}

          {/* ── Action buttons ───────────────────────────────────────────── */}
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
