"use client";

import { useEffect, useState, useCallback } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import PMSection from "@/components/project-management/common/PMSection";
import PMFormRow from "@/components/project-management/common/PMFormRow";
import PMDateInput from "@/components/project-management/common/PMDateInput";
import PMTextarea from "@/components/project-management/common/PMTextarea";
import PMInput from "@/components/project-management/common/PMInput";

import SaleBillRightPanel, {
  DEFAULT_GST_LINES,
} from "@/components/finance/account/common/SaleBillRightPanel";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_BILL_MODES = [
  { label: "Sale Invoice", value: "Sale Invoice" },
  { label: "Proforma Invoice", value: "Proforma Invoice" },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  slNo: z.number(),
  ccCode: z.string(),
  ccName: z.string(),
  description: z.string().optional().default(""),
  hsnSac: z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
});

const gstLineSchema = z.object({
  gstType: z.string(),
  ccCode: z.string(),
  ccName: z.string(),
  description: z.string().optional().default(""),
  percent: z.number(),
  gstAmount: z.coerce.number().default(0),
  isSelected: z.boolean().default(false),
});

const schema = z.object({
  mode: z.string().min(1, "Mode is required"),
  certifiedBillId: z.coerce.number().min(1, "Certified Bill is required"),
  ogSaleOrderNo: z.string().min(1, "Sale Order is required"),
  saleOrderDate: z.string().optional().default(""),
  invoiceDate: z.string().min(1, "Invoice Date is required"),
  referenceNo: z.string().optional().default(""),
  referenceDate: z.string().optional().default(""),
  billToAddress: z.string().optional().default(""),
  shipToAddress: z.string().optional().default(""),
  billAbstractNo: z.string().optional().default(""),
  billAbstractDate: z.string().optional().default(""),
  bankAcId: z.coerce.number().nullable().optional(),
  paymentTermsDays: z.string().optional().default(""),
  declaration: z.string().optional().default(""),
  discount: z.coerce.number().min(0).default(0),
  roundOff: z.coerce.number().default(0),
  items: z.array(itemSchema).min(1, "At least one item required"),
  gstLines: z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  mode: "",
  certifiedBillId: null,
  ogSaleOrderNo: "",
  saleOrderDate: "",
  invoiceDate: "",
  referenceNo: "",
  referenceDate: "",
  billToAddress: "",
  shipToAddress: "",
  billAbstractNo: "",
  billAbstractDate: "",
  bankAcId: null,
  paymentTermsDays: "",
  declaration: "",
  discount: 0,
  roundOff: 0,
  items: [],
  gstLines: DEFAULT_GST_LINES,
};

const parsePaymentTerms = (val) =>
  val
    ? String(val)
        .replace(/\s*[Dd]ays?\s*$/, "")
        .trim()
    : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleBillForm({
  mode = "create",
  billId,
  onAfterSubmit,
  onUuid,
}) {
  const isViewMode = mode === "view" || mode === "approver";
  const router = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading, setIsLoading] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [saleOrderOpts, setSaleOrderOpts] = useState([]);
  const [certifiedBillOpts, setCertifiedBillOpts] = useState([]);
  const [certifiedBillsLoading, setCertifiedBillsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [bankOpts, setBankOpts] = useState([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields: itemFields } = useFieldArray({ control, name: "items" });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Fetch OG Sale Orders ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.LIST}?projectCode=${projectCode}&workflowStatus=Approved`,
      method: "GET",
    })
      .then((res) => {
        const orders = (Array.isArray(res.data) ? res.data : []).map((o) => ({
          ...o,
          displayLabel: [o.prefix, o.ogSaleOrderNo, o.suffix]
            .filter(Boolean)
            .join(" | "),
        }));
        setSaleOrderOpts(orders);
      })
      .catch(() => setSaleOrderOpts([]));
  }, [projectCode]);

  // ── Fetch Bank List (type=BANK only) ───────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setBankOpts(all.filter((b) => b.type === "BANK"));
      })
      .catch(() => setBankOpts([]));
  }, []);

  // ── Back-fill saleOrderDate from order list (API doesn't return it in bill) ─
  // Runs whenever saleOrderOpts or initialData changes — whichever arrives last wins.
  useEffect(() => {
    if (!saleOrderOpts.length || !initialData || mode === "create") return;
    if (getValues("saleOrderDate")) return; // already populated
    const currentOrderNo = getValues("ogSaleOrderNo");
    if (!currentOrderNo) return;
    const order = saleOrderOpts.find((o) => o.ogSaleOrderNo === currentOrderNo);
    if (order?.ogSaleOrderDate) {
      setValue("saleOrderDate", order.ogSaleOrderDate, { shouldDirty: false });
    }
  }, [saleOrderOpts, initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Certified Bills for a Sale Order ─────────────────────────────────
  const fetchCertifiedBills = useCallback(
    async (ogSaleOrderNo) => {
      if (!ogSaleOrderNo || !projectCode) {
        setCertifiedBillOpts([]);
        return;
      }
      setCertifiedBillsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILLS}?ogSaleOrderNo=${encodeURIComponent(ogSaleOrderNo)}&projectCode=${projectCode}`,
          method: "GET",
        });
        setCertifiedBillOpts(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCertifiedBillOpts([]);
      } finally {
        setCertifiedBillsLoading(false);
      }
    },
    [projectCode],
  );

  // ── OG Sale Order Selection ─────────────────────────────────────────────────
  const handleOrderSelect = useCallback(
    (value, option) => {
      setValue("ogSaleOrderNo", value, { shouldDirty: true });
      setValue("saleOrderDate", option?.ogSaleOrderDate || "", {
        shouldDirty: true,
      });
      setValue("certifiedBillId", null, { shouldDirty: true });
      setValue("billAbstractNo", "", { shouldDirty: true });
      setValue("billAbstractDate", "", { shouldDirty: true });
      setValue("items", [], { shouldDirty: true });
      setValue("gstLines", DEFAULT_GST_LINES, { shouldDirty: true });
      setCertifiedBillOpts([]);
      fetchCertifiedBills(value);
    },
    [setValue, fetchCertifiedBills],
  );

  // ── Certified Bill Selection → abstract No/Date + BASIC items ──────────────
  // API returns { id, billingNo, billingDate, thisBillClaim }
  const handleCertifiedBillSelect = useCallback(
    async (id, option) => {
      setValue("certifiedBillId", id ? Number(id) : null, {
        shouldDirty: true,
      });
      setValue("billAbstractNo", option?.billingNo || "", {
        shouldDirty: true,
      });
      setValue("billAbstractDate", option?.billingDate || "", {
        shouldDirty: true,
      });

      if (!id || !projectCode) return;
      setItemsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILL_ITEMS}?certifiedBillId=${encodeURIComponent(id)}&projectCode=${projectCode}`,
          method: "GET",
        });
        const items = (res.data?.items || []).map((it, i) => ({
          slNo: it.slNo || i + 1,
          ccCode: it.ccCode || "",
          ccName: it.ccName || "",
          description: it.description || "",
          hsnSac: it.hsnSac || "",
          basicAmount: Number(it.basicAmount || 0),
        }));
        setValue("items", items, { shouldDirty: true });
        setValue("gstLines", DEFAULT_GST_LINES, { shouldDirty: true });
      } catch {
        toast.error("Failed to load certified bill items");
      } finally {
        setItemsLoading(false);
      }
    },
    [projectCode, setValue],
  );

  // ── Load Detail (edit / view) ───────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;
        const formatted = {
          mode: d.mode || "",
          certifiedBillId: d.certifiedBillId || null,
          ogSaleOrderNo: d.saleOrderNo || d.ogSaleOrderNo || "",
          saleOrderDate: d.saleOrderDate || "",
          invoiceDate: d.invoiceDate || "",
          referenceNo: d.referenceNo || "",
          referenceDate: d.referenceDate || "",
          billToAddress: d.billToAddress || "",
          shipToAddress: d.shipToAddress || "",
          billAbstractNo: d.billAbstractNo || "",
          billAbstractDate: d.billAbstractDate || "",
          bankAcId: d.bankAcId || d.bankAc || null,
          paymentTermsDays: parsePaymentTerms(d.paymentTerms),
          declaration: d.declaration || "",
          discount: d.discount ?? 0,
          roundOff: d.roundOff ?? 0,
          items: (d.items || []).map((it, i) => ({
            slNo: it.slNo || i + 1,
            ccCode: it.ccCode || "",
            ccName: it.ccName || "",
            description: it.description || "",
            hsnSac: it.hsnSac || "",
            basicAmount: Number(it.basicAmount || 0),
          })),
          gstLines: (d.gstLines?.length === 3
            ? d.gstLines
            : DEFAULT_GST_LINES
          ).map((l) => ({
            gstType: l.gstType || "",
            ccCode: l.ccCode || "",
            ccName: l.ccName || "",
            description: l.description || "",
            percent: Number(l.percent || 0),
            gstAmount: Number(l.gstAmount || 0),
            isSelected: !!l.isSelected,
          })),
        };
        reset(formatted);
        setInitialData(formatted);
        if (d.saleBillUuid && onUuid) onUuid(d.saleBillUuid);
        if (formatted.ogSaleOrderNo)
          fetchCertifiedBills(formatted.ogSaleOrderNo);
        const editable = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if (st === "Approved") toast.info("Sale Bill already Approved");
          else if (st === "Rejected") toast.info("Sale Bill already Rejected");
          else toast.info("Sale Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Sale Bill");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [billId, mode]);

  // ── Edit / Cancel ───────────────────────────────────────────────────────────
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

  // ── Build payload (reads current gstLines to compute amounts) ───────────────
  const buildPayload = () => {
    const v = getValues();
    const gstLines = v.gstLines || DEFAULT_GST_LINES;
    const basicTotal = (v.items || []).reduce(
      (s, it) => s + Number(it.basicAmount || 0),
      0,
    );
    const isIGST = !!gstLines[0]?.isSelected;
    const isCGSTSGST = !!gstLines[1]?.isSelected;

    const computedGst = gstLines.map((l, i) => {
      let amt = 0;
      if (i === 0 && isIGST) amt = (basicTotal * l.percent) / 100;
      if (i === 1 && isCGSTSGST) amt = (basicTotal * l.percent) / 100;
      if (i === 2 && isCGSTSGST) amt = (basicTotal * l.percent) / 100;
      return {
        ...l,
        gstAmount: amt,
        isSelected: i === 0 ? isIGST : isCGSTSGST,
      };
    });

    return {
      projectCode,
      mode: v.mode,
      certifiedBillId: Number(v.certifiedBillId),
      invoiceDate: v.invoiceDate || "",
      referenceNo: v.referenceNo || "",
      referenceDate: v.referenceDate || "",
      billToAddress: v.billToAddress || "",
      shipToAddress: v.shipToAddress || "",
      billAbstractNo: v.billAbstractNo || "",
      billAbstractDate: v.billAbstractDate || "",
      bankAc: v.bankAcId ? Number(v.bankAcId) : null,
      paymentTerms: v.paymentTermsDays ? `${v.paymentTermsDays} Days` : "",
      declaration: v.declaration || "",
      discount: Number(v.discount || 0),
      roundOff: Number(v.roundOff || 0),
      items: (v.items || []).map((it, i) => ({
        slNo: it.slNo || i + 1,
        ccCode: it.ccCode,
        ccName: it.ccName,
        description: it.description || "",
        hsnSac: it.hsnSac || "",
        basicAmount: Number(it.basicAmount || 0),
      })),
      gstLines: computedGst.map((l) => ({
        gstType: l.gstType,
        ccCode: l.ccCode,
        ccName: l.ccName,
        description: l.description || "",
        percent: l.percent,
        gstAmount: l.gstAmount,
        isSelected: l.isSelected,
      })),
    };
  };

  // ── Save Draft / Update ─────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) {
      toast.error("Please select a project first");
      return;
    }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.FINANCE.SALE_BILL.CREATE
            : `${API_ENDPOINTS.FINANCE.SALE_BILL.EDIT}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });
      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(
        mode === "create" ? "Sale Bill created" : "Sale Bill updated",
        { id: tid },
      );
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId)
          setTimeout(
            () => router.push(`/finance-management/account/sale/${newId}`),
            400,
          );
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for Approval ─────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) {
      toast.error("Please save first");
      return;
    }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_BILL.SUBMIT}${billId}`,
        method: "POST",
      });
      toast.success("Sale Bill submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? (
          <PanelLeftClose size={18} />
        ) : (
          <PanelLeftOpen size={18} />
        )}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* ── LEFT PANEL (PM commons) ─────────────────────────────────────── */}
        <div
          className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}
        >
          {/* ── Section 1: Mode ─────────────────────────────────────────────── */}
          <PMSection title="Mode:">
            <PMFormRow
              label="Mode"
              required={!disabled}
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div className="flex-1">
                <SearchableSelect
                  options={SALE_BILL_MODES}
                  value={watch("mode") || ""}
                  disabled={disabled}
                  onChange={(v) => setValue("mode", v, { shouldDirty: true })}
                  placeholder="Sale Invoice / Proforma Invoice"
                  labelKey="label"
                  valueKey="value"
                  searchKeys={["label"]}
                />
                {/* {errors.mode && (
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {errors.mode.message}
                  </p>
                )} */}
              </div>
            </PMFormRow>
          </PMSection>

          {/* ── Section 2: Invoice Details ───────────────────────────────────── */}
          <PMSection title="Invoice Details:">
            <PMFormRow
              label="Invoice Number"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <input
                value="[Auto]"
                disabled
                readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>

            <PMFormRow
              label="Invoice Date"
              required={!disabled}
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div>
                <PMDateInput
                  {...register("invoiceDate")}
                  disabled={disabled}
                  hasError={errors.invoiceDate}
                  className="max-w-[200px]"
                />
                {/* {errors.invoiceDate && (
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {errors.invoiceDate.message}
                  </p>
                )} */}
              </div>
            </PMFormRow>

            <PMFormRow
              label="Reference No."
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <PMInput
                {...register("referenceNo")}
                disabled={disabled}
                placeholder="Reference No."
                fieldLabel="Reference No."
              />
            </PMFormRow>

            <PMFormRow
              label="Reference Date"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <PMDateInput
                {...register("referenceDate")}
                disabled={disabled}
                className="max-w-[200px]"
              />
            </PMFormRow>
          </PMSection>

          {/* ── Section 3: Sale Order ────────────────────────────────────────── */}
          <PMSection title="Sale Order:">
            <PMFormRow
              label="Sale Order No."
              required={!disabled}
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div className="flex-1">
                <SearchableSelect
                  options={saleOrderOpts}
                  value={watch("ogSaleOrderNo") || ""}
                  disabled={disabled}
                  onChange={(v, opt) => handleOrderSelect(v, opt)}
                  placeholder="Select Drop Down List"
                  labelKey="displayLabel"
                  valueKey="ogSaleOrderNo"
                  searchKeys={["ogSaleOrderNo", "orderTitle", "displayLabel"]}
                />
                {/* {errors.ogSaleOrderNo && (
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {errors.ogSaleOrderNo.message}
                  </p>
                )} */}
              </div>
            </PMFormRow>

            <PMFormRow
              label="Sale Order Date"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <input
                value={watch("saleOrderDate") || "[Auto]"}
                disabled
                readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>

            <PMFormRow
              label="Bill To Address"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <Controller
                name="billToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Client address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>

            <PMFormRow
              label="Ship To Address"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <Controller
                name="shipToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Site address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>

          {/* ── Section 4: Bill Abstract ─────────────────────────────────────── */}
          {/* "Bill Abstract No." IS the certified bill select — billingNo is the abstract no. */}
          <PMSection title="Bill Abstract:">
            <PMFormRow
              label="Bill Abstract No."
              required={!disabled}
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div className="flex-1">
                <SearchableSelect
                  options={certifiedBillOpts}
                  value={watch("certifiedBillId") || ""}
                  disabled={
                    disabled ||
                    certifiedBillsLoading ||
                    itemsLoading ||
                    !watch("ogSaleOrderNo")
                  }
                  onChange={(v, opt) => handleCertifiedBillSelect(v, opt)}
                  placeholder={
                    certifiedBillsLoading
                      ? "Loading…"
                      : itemsLoading
                        ? "Loading items…"
                        : !watch("ogSaleOrderNo")
                          ? "Select order first"
                          : "Select Bill Abstract No."
                  }
                  labelKey="billingNo"
                  valueKey="id"
                  searchKeys={["billingNo"]}
                />
                {/* {errors.certifiedBillId && (
                  <p className="text-[11px] text-red-500 mt-0.5">
                    {errors.certifiedBillId.message}
                  </p>
                )} */}
              </div>
            </PMFormRow>

            <PMFormRow
              label="Bill Abstract Date"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <input
                value={watch("billAbstractDate") || "[Auto]"}
                disabled
                readOnly
                className="w-full h-[30px] text-[13px] rounded-sm border border-[#7fa37f] bg-[#edf8ed] text-gray-500 px-2 outline-none"
              />
            </PMFormRow>
          </PMSection>

          {/* ── Section 5: Bank & Payment ────────────────────────────────────── */}
          <PMSection title="Bank & Payment:">
            <PMFormRow
              label="Bank A/c"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div className="flex-1">
                <SearchableSelect
                  options={bankOpts}
                  value={watch("bankAcId") || ""}
                  disabled={disabled}
                  onChange={(v) =>
                    setValue("bankAcId", v ? Number(v) : null, {
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select Bank"
                  labelKey={["bankName", "bankAcNumber"]}
                  labelSeparator=" — "
                  valueKey="id"
                  searchKeys={[
                    "bankName",
                    "bankCode",
                    "bankAcNumber",
                    "branchName",
                  ]}
                />
              </div>
            </PMFormRow>

            <PMFormRow
              label="Payment Terms"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <div className="flex items-center gap-1.5 max-w-[180px]">
                <PMInput
                  type="number"
                  min="0"
                  {...register("paymentTermsDays")}
                  disabled={disabled}
                  placeholder="e.g. 30"
                  fieldLabel="Payment Terms (Days)"
                />
                <span className="text-[13px] text-[#444] shrink-0">Days</span>
              </div>
            </PMFormRow>

            <PMFormRow
              label="Declaration"
              labelWidth="sm:w-[150px] sm:min-w-[150px]"
            >
              <Controller
                name="declaration"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Declaration text"
                    rows={3}
                    maxRows={8}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL (finance/account common) ────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">
          <SaleBillRightPanel
            control={control}
            watch={watch}
            setValue={setValue}
            register={register}
            disabled={disabled}
            itemsLoading={itemsLoading}
            itemFields={itemFields}
          />

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting..."
                confirmationTitle="Submit Sale Bill?"
                requireConfirmation
              >
                Submit
              </SaveButton>
              {mode !== "create" && !isSubmitted && (
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
