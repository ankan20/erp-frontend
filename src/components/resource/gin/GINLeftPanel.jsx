"use client";

import { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { Paperclip, Download } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

// ── GIN CATEGORY MAPPING ──────────────────────────────────────────────────────
export const ISSUE_CATEGORY_OPTIONS = [
  { label: "Consumption",               value: "Consumption"               },
  { label: "Return to Vendor",          value: "Return to Vendor"          },
  { label: "Site Transfer Order",       value: "Site Transfer Order"       },
  { label: "Customer Delivery",         value: "Customer Delivery"         },
  { label: "Without Purchase Order",    value: "Without Purchase Order"    },
  { label: "Capital Issue",             value: "Capital Issue"             },
];

// Item category is always "Material" for GIN
const ITEM_CATEGORY = "Material";

const COST_HEAD_MAP = {
  "Consumption":            ["Project Work", "Fixed Asset"],
  "Return to Vendor":       ["Project Work", "Fixed Asset"],
  "Site Transfer Order":    ["Project Work", "Fixed Asset"],
  "Customer Delivery":      ["Project Work"],
  "Without Purchase Order": ["Project Work", "Fixed Asset"],
  "Capital Issue":          ["Fixed Asset"],
};

const COST_FACTOR_OPTIONS = ["Chargeable", "Non Chargeable"];

// Convert YYYYMMDD → YYYY-MM-DD for date inputs
const fmt = (d) => {
  if (!d) return "";
  const s = String(d).replace(/-/g, "");
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return d;
};

const LABEL = `${labelClass} w-[180px] min-w-[180px] max-w-[180px]`;

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function GINLeftPanel({
  form,
  disabled,
  mode,
  onOrderItemsFetched, // (orderData | null) => void
  onVendorClear,       // () => void — called when vendor/category changes
  // file props
  fileRef,
  newFileName,
  existingFileUrl,
  onFileChange,
}) {
  const { register, control, setValue, watch, formState: { errors } } = form;

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";
  const projectId   = projectInfo?.projectId;

  const vendorId        = watch("vendorId");
  const issueCategory   = watch("issueCategory");
  const costHead        = watch("costHead");
  const itemCategory    = watch("itemCategory");

  // true only when the user explicitly changed vendor/category (not on initial data load)
  const userChangedRef = useRef(false);

  const [ledgerList,      setLedgerList]      = useState([]);
  const [despatchOptions, setDespatchOptions] = useState([]);
  const [vendorOrders,    setVendorOrders]    = useState([]);
  const [loadingOrders,   setLoadingOrders]   = useState(false);
  const [loadingItems,    setLoadingItems]    = useState(false);

  const costHeadOptions = COST_HEAD_MAP[issueCategory] || [];

  // ── LOAD LEDGER LIST (vendors / parties) ──────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER });
        setLedgerList(res.data || []);
      } catch {
        toast.error("Failed to load vendor list");
      }
    };
    fetch();
  }, []);

  // ── LOAD PROJECT ADDRESSES (for Despatch From) ────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const fetch = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,
        });
        const d = res.data?.[0];
        if (!d) return;
        const despatch = [
          d.shippingAddress,
          d.shippingAddress2,
          d.shippingAddress3,
          d.billingAddress,
        ].filter(Boolean);
        setDespatchOptions(despatch);
      } catch {
        toast.error("Failed to load project addresses");
      }
    };
    fetch();
  }, [projectId]);

  // ── AUTO-FILL PARTY INFO when vendorId changes ────────────────────────────
  useEffect(() => {
    if (!vendorId) {
      setValue("partyAddress", "");
      setValue("partyGstn",    "");
      return;
    }
    const v = ledgerList.find((l) => String(l.ledgerId) === String(vendorId));
    if (!v) return;
    setValue("partyAddress", v.corporateAddress || "");
    setValue("partyGstn",    v.gstin            || "");
  }, [vendorId, ledgerList]);

  // ── FETCH VENDOR ORDERS when vendor or category changes ───────────────────
  useEffect(() => {
    if (!vendorId || !projectCode) {
      setVendorOrders([]);
      return;
    }
    const fetch = async () => {
      setLoadingOrders(true);
      try {
        let url = `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}`;
        if (issueCategory) url += `&issueCategory=${encodeURIComponent(issueCategory)}`;
        if (itemCategory)  url += `&itemCategory=${encodeURIComponent(itemCategory)}`;
        if (costHead)      url += `&costHead=${encodeURIComponent(costHead)}`;
        const res = await apiRequest({ url });
        const orders = res.data || [];
        setVendorOrders(orders);
        if (orders.length === 0 && userChangedRef.current) {
          toast.info("No approved orders found for the selected party / category filters");
        }
        userChangedRef.current = false;
      } catch {
        setVendorOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetch();
  }, [vendorId, issueCategory, itemCategory, costHead, projectCode]);

  // ── HANDLE VENDOR CHANGE ──────────────────────────────────────────────────
  const handleVendorChange = (val) => {
    userChangedRef.current = true;
    setValue("vendorId", val);
    if (mode === "create") {
      setValue("orderId",   "");
      setValue("orderDate", "");
      onVendorClear?.();
    }
  };

  // ── HANDLE ISSUE CATEGORY CHANGE ─────────────────────────────────────────
  const handleIssueCategoryChange = (val) => {
    userChangedRef.current = true;
    setValue("issueCategory", val);
    setValue("itemCategory",  ITEM_CATEGORY);
    const newOpts = COST_HEAD_MAP[val] || [];
    const cur     = watch("costHead");
    if (cur && !newOpts.includes(cur)) setValue("costHead", "");
    if (mode === "create") {
      setValue("orderId",   "");
      setValue("orderDate", "");
      onVendorClear?.();
    }
  };

  // ── HANDLE ORDER SELECT ───────────────────────────────────────────────────
  const handleOrderSelect = async (val) => {
    setValue("orderId", val);
    const order = vendorOrders.find((o) => String(o.id) === String(val));
    setValue("orderDate", order?.orderDate ? fmt(order.orderDate) : "");

    if (!val) { onOrderItemsFetched(null); return; }

    setLoadingItems(true);
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_ORDER_ITEMS}/${val}`,
      });
      onOrderItemsFetched(res.data || null);
    } catch (err) {
      toast.error(err.message || "Failed to load order items");
      onOrderItemsFetched(null);
    } finally {
      setLoadingItems(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-y-4 w-full xl:w-[410px] shrink-0 xl:overflow-y-auto xl:max-h-[calc(100vh-110px)] pr-1">

      {/* Groups: 1-col on mobile, 2-col on lg (tablet/laptop), 1-col on xl (side panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4">

      {/* ── GROUP 1: GIN INFO ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* GIN No */}
        <div className="flex items-center">
          <div className={LABEL}>GIN No</div>
          <Input
            {...register("ginNo")}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
          />
        </div>

        {/* GIN Date */}
        <div className="flex items-center">
          <div className={LABEL}>GIN Date</div>
          <Input
            type="date"
            {...register("ginDate")}
            disabled={disabled}
            className={`${getInputClass(!!errors.ginDate, disabled)} w-[220px] h-[30px]`}
          />
        </div>
        {/* {errors.ginDate && (
          <p className="text-red-500 text-[11px] ml-[184px]">{errors.ginDate.message}</p>
        )} */}
      </div>

      {/* ── GROUP 2: CATEGORY ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* Issue Category */}
        <div className="flex items-center">
          <div className={LABEL}>Issue Category</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="issueCategory"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(v) => { field.onChange(v); handleIssueCategoryChange(v); }}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[30px]`}>
                    <SelectValue placeholder="As per List" />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* Item Category — always Material, shown as disabled */}
        <div className="flex items-center">
          <div className={LABEL}>Item Category</div>
          <Input
            value={ITEM_CATEGORY}
            disabled
            className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
          />
        </div>

        {/* Cost Head */}
        <div className="flex items-center">
          <div className={LABEL}>Cost Head</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="costHead"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(v) => { userChangedRef.current = true; field.onChange(v); }}
                  disabled={disabled || costHeadOptions.length === 0}
                >
                  <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[30px]`}>
                    <SelectValue placeholder="Project Work / Fixed Asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {costHeadOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* Cost Factor */}
        <div className="flex items-center">
          <div className={LABEL}>Cost Factor</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="costFactor"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[30px]`}>
                    <SelectValue placeholder="Chargeable / Non Chargeable" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_FACTOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* ── GROUP 3: PARTY ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* Party Name */}
        <div className="flex items-center">
          <div className={LABEL}>Party Name</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => { field.onChange(v); handleVendorChange(v); }}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(!!errors.vendorId, disabled)} w-full h-[30px]`}>
                    <SelectValue placeholder="Select from Vendor List" />
                  </SelectTrigger>
                  <SelectContent>
                    {ledgerList.map((l) => (
                      <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>
                        {l.ledgerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        {/* {errors.vendorId && (
          <p className="text-red-500 text-[11px] ml-[184px]">{errors.vendorId.message}</p>
        )} */}

        {/* Party Address — auto */}
        <div className="flex items-center">
          <div className={LABEL}>Party Address</div>
          <div className="w-[220px]">
            <Controller control={control} name="partyAddress" render={({ field }) => (
              <ExpandableTextField
                value={field.value} onChange={field.onChange}
                disabled title="Party Address" placeholder="[Auto]"
                minHeight="min-h-[30px]" modalHeight="min-h-[180px]"
              />
            )} />
          </div>
        </div>

        {/* Party GSTN — auto */}
        <div className="flex items-center">
          <div className={LABEL}>Party GSTN</div>
          <div className="w-[220px]">
            <Controller control={control} name="partyGstn" render={({ field }) => (
              <ExpandableTextField
                value={field.value} onChange={field.onChange}
                disabled title="Party GSTN" placeholder="[Auto]"
                minHeight="min-h-[30px]" modalHeight="min-h-[140px]"
              />
            )} />
          </div>
        </div>
      </div>

      {/* ── GROUP 4: ORDER ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* Order No — yellow, select from vendor orders */}
        <div className="flex items-center">
          <div className={LABEL}>Order No</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="orderId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => { field.onChange(v); handleOrderSelect(v); }}
                  disabled={disabled || loadingOrders || loadingItems}
                >
                  <SelectTrigger
                    className={`
                      ${getInputClass(!!errors.orderId, disabled)}
                      w-full h-[30px]
                      ${!disabled && !errors.orderId ? "bg-[#fff8c5] border-[#c9a800]" : ""}
                    `}
                  >
                    <SelectValue
                      placeholder={
                        loadingOrders
                          ? "Loading orders..."
                          : loadingItems
                            ? "Loading items..."
                            : "Select from Filter Order List"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorOrders.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.orderNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        {/* {errors.orderId && (
          <p className="text-red-500 text-[11px] ml-[184px]">{errors.orderId.message}</p>
        )} */}

        {/* Order Date — auto */}
        <div className="flex items-center">
          <div className={LABEL}>Order Date</div>
          <Input
            {...register("orderDate")}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
          />
        </div>
      </div>

      {/* ── GROUP 5: SITE & ADDRESSES ─────────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* Site — auto */}
        <div className="flex items-center">
          <div className={LABEL}>Site</div>
          <Input
            value={projectCode}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
          />
        </div>

        {/* Despatch From — select from project store locations */}
        <div className="flex items-center">
          <div className={LABEL}>Despatch From</div>
          <div className="w-[220px]">
            <Controller control={control} name="despatchFrom" render={({ field }) => (
              <Select value={field.value || ""} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[30px]`}>
                  <SelectValue placeholder="Select from List" />
                </SelectTrigger>
                <SelectContent>
                  {despatchOptions.map((item, i) => (
                    <SelectItem key={i} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>

        {/* Shipping To — expandable text */}
        <div className="flex items-center">
          <div className={LABEL}>Shipping To</div>
          <div className="w-[220px]">
            <Controller control={control} name="shippingTo" render={({ field }) => (
              <ExpandableTextField
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                title="Shipping To"
                placeholder="Text"
                minHeight="min-h-[30px]"
                modalHeight="min-h-[200px]"
              />
            )} />
          </div>
        </div>
      </div>

      {/* ── GROUP 6: ADDITIONAL DETAILS ───────────────────────────────────── */}
      <div className="flex flex-col gap-[2px]">
        {/* Recommendation By */}
        <div className="flex items-center">
          <div className={LABEL}>Recommendation By</div>
          <Input
            {...register("recommendationBy")}
            disabled={disabled}
            placeholder="Text"
            className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
          />
        </div>

        {/* Issue Slip No */}
        <div className="flex items-center">
          <div className={LABEL}>Issue Slip No</div>
          <Input
            {...register("issueSlipNo")}
            disabled={disabled}
            placeholder="Text"
            className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
          />
        </div>

        {/* Handed Over To */}
        <div className="flex items-center">
          <div className={LABEL}>Handed Over To</div>
          <Input
            {...register("handedOverTo")}
            disabled={disabled}
            placeholder="Text"
            className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
          />
        </div>
      </div>

      </div>{/* end groups grid */}

      {/* ── DOCUMENT ATTACHMENT ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => !disabled && fileRef?.current?.click()}
          className={`h-[32px] px-4 rounded-md border border-[#c96b2c] text-sm font-medium flex items-center gap-1.5 transition
            ${disabled
              ? "bg-[#e9a06d] opacity-60 cursor-not-allowed"
              : "bg-[#e9a06d] hover:bg-[#d88b5a] cursor-pointer"
            }`}
        >
          <Paperclip className="w-4 h-4" />
          Attached Doc @
        </button>

        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pdf,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={onFileChange}
        />

        {newFileName && (
          <span className="flex items-center gap-1 text-[12px] text-gray-700">
            <Paperclip className="w-3 h-3 text-orange-500" />
            {newFileName}
          </span>
        )}

        {!newFileName && existingFileUrl && (
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Download Attached Doc
          </a>
        )}

        {!newFileName && !existingFileUrl && disabled && (
          <span className="text-[12px] italic text-gray-400">No document attached</span>
        )}

        {mode === "create" && (
          <span className="text-[11px] text-red-500">* required</span>
        )}
      </div>

    </div>
  );
}
