"use client";

import { useEffect, useRef, useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import FileUpload, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUpload";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

// ── GRN CATEGORY CONFIG — underscore keys (URL-safe), label for display ──────
const GRN_CATEGORY_CONFIG = {
  Purchases_Order: {
    label: "Purchases Order",
    costHeads: [
      { label: "Project Work", value: "Project_Work" },
      { label: "Fixed Asset", value: "Fixed_Asset" },
    ],
  },
  Returnable_Inventory: {
    label: "Returnable Inventory",
    costHeads: [{ label: "Fixed Asset", value: "Fixed_Asset" }],
  },
  Site_Transfer_Order: {
    label: "Site Transfer Order",
    costHeads: [
      { label: "Project Work", value: "Project_Work" },
      { label: "Fixed Asset", value: "Fixed_Asset" },
    ],
  },
  With_Out_Purchases_Order: {
    label: "With Out Purchases Order",
    costHeads: [
      { label: "Project Work", value: "Project_Work" },
      { label: "Fixed Asset", value: "Fixed_Asset" },
    ],
  },
  Customer_Supply_Order: {
    label: "Customer Supply Order",
    costHeads: [{ label: "Project Work", value: "Project_Work" }],
  },
  Loan_Return: {
    label: "Loan Return",
    costHeads: [
      { label: "Project Work", value: "Project_Work" },
      { label: "Fixed Asset", value: "Fixed_Asset" },
    ],
  },
};

// Item category — value sent to API, label shown in UI
const ITEM_CATEGORY = {
  label: "Material",
  value: "MAT_001",
};

export const RECEIVED_CATEGORY_OPTIONS = Object.entries(
  GRN_CATEGORY_CONFIG,
).map(([value, config]) => ({ label: config.label, value }));

// Convert YYYYMMDD → YYYY-MM-DD for date inputs
const fmt = (d) => {
  if (!d) return "";
  const s = String(d).replace(/-/g, "");
  if (s.length === 8)
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return d;
};

const LABEL = `${labelClass} w-[180px] min-w-[180px] max-w-[180px]`;

// ── COMPONENT
export default function GRNLeftPanel({
  form,
  disabled,
  mode,
  onOrderItemsFetched, // (orderData | null) => void
  onVendorClear, // () => void  — called when vendor changes in create mode
  // file props
  existingFileUrl,
  onFileChange,
  onClearExisting,
  fileResetKey,
}) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";
  const projectId = projectInfo?.projectId;

  const vendorId = watch("vendorId");
  const receivedCategory = watch("receivedCategory");
  const costHead = watch("costHead");
  const itemCategory = watch("itemCategory");

  // true only when the user explicitly changed vendor/category (not on initial data load)
  const userChangedRef = useRef(false);

  const [ledgerList, setLedgerList] = useState([]);
  const [currentProjectData, setCurrentProjectData] = useState(null);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  // const [showMore,        setShowMore]        = useState(false);

  // ── COST HEAD OPTIONS based on selected receivedCategory
  const categoryConfig = GRN_CATEGORY_CONFIG[receivedCategory] || {
    costHeads: [],
  };
  const costHeadOptions = categoryConfig.costHeads;

  // ── LOAD LEDGER LIST (vendors)
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER,
        });
        setLedgerList((res.data || []).slice().sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || "")));
      } catch {
        toast.error("Failed to load vendors");
      }
    };
    fetch();
  }, []);

  // ── LOAD CURRENT PROJECT DETAILS (for billing/shipping options)
  useEffect(() => {
    if (!projectId) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}` })
      .then((res) => {
        const d = res.data?.[0];
        if (d) setCurrentProjectData(d);
      })
      .catch(() => toast.error("Failed to load project addresses"));
  }, [projectId]);

  // ── COMPUTE billing/shipping options from category + project data (same as order page)
  const billingOptions = (() => {
    if (!currentProjectData) return [];
    if (receivedCategory === "Purchases_Order") {
      return [currentProjectData.companyBillingAddress].filter(Boolean);
    }
    return [
      currentProjectData.shippingAddress,
      currentProjectData.shippingAddress2,
      currentProjectData.shippingAddress3,
    ].filter(Boolean);
  })();

  const shippingOptions = (() => {
    if (!currentProjectData) return [];
    return [
      currentProjectData.shippingAddress,
      currentProjectData.shippingAddress2,
      currentProjectData.shippingAddress3,
    ].filter(Boolean);
  })();

  // ── AUTO-SELECT when only one option available
  useEffect(() => {
    if (billingOptions.length === 1 && !watch("billingAddress")) {
      setValue("billingAddress", billingOptions[0]);
    }
  }, [billingOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shippingOptions.length === 1 && !watch("shippingAddress")) {
      setValue("shippingAddress", shippingOptions[0]);
    }
  }, [shippingOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FETCH VENDOR ORDERS when vendor or category changes
  useEffect(() => {
    if (!vendorId || !projectCode) {
      setVendorOrders([]);
      return;
    }
    const fetch = async () => {
      setLoadingOrders(true);
      try {
        let url = `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}`;
        if (receivedCategory)
          url += `&receivedCategory=${encodeURIComponent(receivedCategory)}`;
        if (itemCategory)
          url += `&itemCategory=${encodeURIComponent(itemCategory)}`;
        if (costHead) url += `&costHead=${encodeURIComponent(costHead)}`;
        const res = await apiRequest({ url });
        const orders = res.data || [];
        setVendorOrders(orders);
        if (orders.length === 0 && userChangedRef.current) {
          toast.info(
            "No approved orders found for the selected vendor / category filters",
          );
        }
        userChangedRef.current = false;
      } catch {
        setVendorOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetch();
  }, [vendorId, receivedCategory, itemCategory, costHead, projectCode]);

  // ── HANDLE VENDOR CHANGE (user action — clears order + items in create) ────
  const handleVendorChange = (val) => {
    userChangedRef.current = true;
    if (!val) {
      setValue("partyAddress", "");
      setValue("partyGstn", "");
    } else {
      const vendor = ledgerList.find((l) => String(l.ledgerId) === String(val));
      if (vendor) {
        setValue("partyAddress", vendor.registeredAddress || vendor.corporateAddress || "");
        setValue("partyGstn", vendor.gstin || "");
      }
    }
    if (mode === "create") {
      setValue("orderId", "");
      setValue("orderDate", "");
      onVendorClear?.();
    }
  };

  // ── HANDLE RECEIVED CATEGORY CHANGE
  const handleReceivedCategoryChange = (val) => {
    userChangedRef.current = true;
    setValue("receivedCategory", val);
    setValue("itemCategory", ITEM_CATEGORY.value);
    const config = GRN_CATEGORY_CONFIG[val];
    // auto-set costHead if single option, otherwise clear if no longer valid
    if (config?.costHeads.length === 1) {
      setValue("costHead", config.costHeads[0].value);
    } else {
      const cur = watch("costHead");
      if (cur && !config?.costHeads.some((h) => h.value === cur))
        setValue("costHead", "");
    }
    if (mode === "create") {
      setValue("orderId", "");
      setValue("orderDate", "");
      onVendorClear?.();
    }
  };

  // ── HANDLE ORDER SELECT
  const handleOrderSelect = async (val) => {
    setValue("orderId", val);
    const order = vendorOrders.find((o) => String(o.id) === String(val));
    setValue("orderDate", order?.orderDate ? fmt(order.orderDate) : "");

    if (!val) {
      onOrderItemsFetched(null);
      return;
    }

    setLoadingItems(true);
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_ORDER_ITEMS}/${val}`,
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
        {/* ── GROUP 1: CATEGORY ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          {/* Received Category */}
          <div className="flex items-center">
            <div className={LABEL}>Received Category</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="receivedCategory"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={(v) => {
                      field.onChange(v);
                      handleReceivedCategoryChange(v);
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={`${getInputClass(errors.receivedCategory, disabled)} w-full h-[30px]`}
                    >
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEIVED_CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Item Category — always Material (auto) */}
          <div className="flex items-center">
            <div className={LABEL}>Item Category</div>
            <Input
              value={receivedCategory ? ITEM_CATEGORY.label : ""}
              readOnly
              disabled
              placeholder="Material"
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
                    onValueChange={(v) => {
                      userChangedRef.current = true;
                      field.onChange(v);
                    }}
                    disabled={disabled || !receivedCategory}
                  >
                    <SelectTrigger
                      className={`${getInputClass(errors.costHead, disabled)} w-full h-[30px]`}
                    >
                      <SelectValue
                        placeholder={
                          !receivedCategory
                            ? "Select category first"
                            : "Select Cost Head"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {costHeadOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── GROUP 2: GRN INFO ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          <div className="flex items-center">
            <div className={LABEL}>GRN No</div>
            <Input
              {...register("grnNo")}
              disabled
              placeholder="[Auto]"
              className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
            />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>GRN Date</div>
            <Input
              type="date"
              {...register("grnDate")}
              disabled={disabled}
              className={`${getInputClass(!!errors.grnDate, disabled)} w-[220px] h-[30px]`}
            />
          </div>
          {/* {errors.grnDate && (
          <p className="text-red-500 text-[11px] ml-[184px]">{errors.grnDate.message}</p>
        )} */}
        </div>

        {/* ── GROUP 3: PARTY ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          {/* Party Name */}
          <div className="flex items-center">
            <div className={LABEL}>Party Name</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="vendorId"
                render={({ field }) => (
                  <SearchableSelect
                    options={ledgerList}
                    value={field.value ? String(field.value) : ""}
                    onChange={(val) => {
                      field.onChange(val ? String(val) : "");
                      handleVendorChange(val ? String(val) : "");
                    }}
                    disabled={disabled}
                    placeholder="Select from Vendor List"
                    labelKey="ledgerName"
                    valueKey="ledgerId"
                    searchKeys={["ledgerName"]}
                    className={errors.vendorId ? "border-red-500" : ""}
                  />
                )}
              />
            </div>
          </div>
          {/* {errors.vendorId && (
          <p className="text-red-500 text-[11px] ml-[184px]">{errors.vendorId.message}</p>
        )} */}

          {/* Party Address */}
          <div className="flex items-center">
            <div className={LABEL}>Party Address</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="partyAddress"
                render={({ field }) => (
                  <ExpandableTextField
                    value={field.value}
                    onChange={field.onChange}
                    disabled
                    title="Party Address"
                    placeholder="[Auto]"
                    minHeight="min-h-[30px]"
                    modalHeight="min-h-[180px]"
                  />
                )}
              />
            </div>
          </div>

          {/* Party GSTN */}
          <div className="flex items-center">
            <div className={LABEL}>Party GSTN</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="partyGstn"
                render={({ field }) => (
                  <ExpandableTextField
                    value={field.value}
                    onChange={field.onChange}
                    disabled
                    title="Party GSTN"
                    placeholder="[Auto]"
                    minHeight="min-h-[30px]"
                    modalHeight="min-h-[120px]"
                  />
                )}
              />
            </div>
          </div>
        </div>

        {/* ── GROUP 4: ORDER ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          {/* Order No — select from vendor orders */}
          <div className="flex items-center">
            <div className={LABEL}>Order No</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="orderId"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(v);
                      handleOrderSelect(v);
                    }}
                    disabled={disabled || !vendorId || loadingOrders}
                  >
                    <SelectTrigger
                      className={`${getInputClass(!!errors.orderId, disabled)} w-full h-[30px]`}
                      style={{
                        backgroundColor:
                          vendorId && !disabled ? "#fffde7" : undefined,
                      }}
                    >
                      <SelectValue
                        placeholder={
                          loadingOrders
                            ? "Loading orders..."
                            : !vendorId
                              ? "Select vendor first"
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
              placeholder="[Date]"
              className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
            />
          </div>
        </div>

        {/* ── GROUP 5: SITE + ADDRESSES ─────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          {/* Site */}
          <div className="flex items-center">
            <div className={LABEL}>Site</div>
            <Input
              value={projectCode}
              disabled
              placeholder="[Auto]"
              className={`${getInputClass(false, true)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Billing Address */}
          <div className="flex items-center">
            <div className={LABEL}>Billing Address</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="billingAddress"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={`${getInputClass(false, disabled)} w-full h-[30px]`}
                    >
                      <SelectValue placeholder="Select form List" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingOptions.map((item, i) => (
                        <SelectItem key={i} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Shipping Address */}
          <div className="flex items-center">
            <div className={LABEL}>Shipping Address</div>
            <div className="w-[220px]">
              <Controller
                control={control}
                name="shippingAddress"
                render={({ field }) => (
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={`${getInputClass(false, disabled)} w-full h-[30px]`}
                    >
                      <SelectValue placeholder="Select form List" />
                    </SelectTrigger>
                    <SelectContent>
                      {shippingOptions.map((item, i) => (
                        <SelectItem key={i} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── GROUP 6: CHALLAN / BILL ───────────────────────────────────────── */}
        <div className="flex flex-col gap-[2px]">
          {/* Challan No */}
          <div className="flex items-center">
            <div className={LABEL}>Challan No</div>
            <Input
              {...register("challanNo")}
              disabled={disabled}
              placeholder="Optional"
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Challan Date */}
          <div className="flex items-center">
            <div className={LABEL}>Challan Date</div>
            <Input
              type="date"
              {...register("challanDate")}
              disabled={disabled}
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Party Bill No */}
          <div className="flex items-center">
            <div className={LABEL}>Party Bill No</div>
            <Input
              {...register("partyBillNo")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Party Bill Date */}
          <div className="flex items-center">
            <div className={LABEL}>Party Bill Date</div>
            <Input
              type="date"
              {...register("partyBillDate")}
              disabled={disabled}
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>
        </div>

        {/* ── GROUP 7: DELIVERY & VERIFICATION — spans both cols on lg ──────── */}
        <div className="flex flex-col gap-[2px] lg:col-span-2 xl:col-span-1">
          {/* Deliver Vehicle No */}
          <div className="flex items-center">
            <div className={LABEL}>Deliver Vehicle No</div>
            <Input
              {...register("deliverVehicleNo")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Delivered Concern */}
          <div className="flex items-center">
            <div className={LABEL}>Delivered Concern</div>
            <Input
              {...register("deliveredConcern")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Unloading Date & Time */}
          <div className="flex items-center">
            <div className={LABEL}>Unloading Date & Time</div>
            <Input
              type="datetime-local"
              {...register("unloadingDatetime")}
              disabled={disabled}
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>

          {/* Physically Verified By */}
          <div className="flex items-center">
            <div className={LABEL}>Physically Verified By</div>
            <Input
              {...register("physicallyVerifiedBy")}
              disabled={disabled}
              placeholder="Text"
              className={`${getInputClass(false, disabled)} w-[220px] h-[30px]`}
            />
          </div>
        </div>
      </div>
      {/* end groups grid */}

      {/* ── DOCUMENT ATTACHMENT ───────────────────────────────────────────── */}
      <div className="pb-2">
        <FileUpload
          label="Attached Doc"
          onChange={onFileChange}
          existingUrl={existingFileUrl}
          onClearExisting={onClearExisting}
          disabled={disabled}
          resetKey={fileResetKey}
          required={mode === "create"}
          accept={ACCEPT_DOC}
          allowedTypes={TYPES_DOC}
        />
      </div>
    </div>
  );
}
