"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

const BVS_CATEGORIES = [
  { label: "Purchases Order", value: "Purchases_Order" },
  { label: "Customer Supply Order", value: "Customer_Supply_Order" },
  { label: "Site Transfer Order", value: "Site_Transfer_Order" },
];

const COST_HEAD_OPTIONS = {
  "Purchases_Order": [
    { label: "Project Work", value: "Project_Work" },
    { label: "Fixed Asset", value: "Fixed_Asset" },
  ],
  "Customer_Supply_Order": [
    { label: "Project Work", value: "Project_Work" },
  ],
  "Site_Transfer_Order": [
    { label: "Project Work", value: "Project_Work" },
    { label: "Fixed Asset", value: "Fixed_Asset" },
  ],
};

export default function BVSLeftPanel({ form, disabled }) {
  const [ledgerList, setLedgerList] = useState([]);
  const [billingOptions, setBillingOptions] = useState([]);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);

  const { register, control, setValue, watch, formState: { errors } } = form;

  const projectInfo = getLocalStorage("projectInfo");
  const projectId = projectInfo?.projectId;
  const projectCode = projectInfo?.projectCode;

  const categoryCode = watch("categoryCode");
  const costHead = watch("costHead");
  const vendorId = watch("vendorId");

  // SET itemCategory = MAT_001 always
  useEffect(() => {
    setValue("itemCategory", "MAT_001");
  }, [setValue]);

  // LOAD LEDGERS
  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" });
        setLedgerList(res.data || []);
      } catch {
        toast.error("Failed to load vendors");
      }
    };
    fetchLedgers();
  }, []);

  // LOAD PROJECT ADDRESSES
  useEffect(() => {
    if (!projectId) return;
    const fetchProject = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,
          method: "GET",
        });
        const data = res.data?.[0];
        if (!data) return;
        const billing = [];
        const shipping = [];
        if (data.billingAddress) billing.push(data.billingAddress);
        if (data.shippingAddress) shipping.push(data.shippingAddress);
        if (data.shippingAddress2) shipping.push(data.shippingAddress2);
        if (data.shippingAddress3) shipping.push(data.shippingAddress3);
        setBillingOptions(billing);
        setShippingOptions(shipping);
      } catch {
        toast.error("Failed to load project details");
      }
    };
    fetchProject();
  }, [projectId]);

  // VENDOR AUTO-FILL
  useEffect(() => {
    if (!vendorId) {
      setValue("partyAddress", "");
      setValue("gstn", "");
      return;
    }
    const vendor = ledgerList.find((v) => String(v.ledgerId) === String(vendorId));
    if (!vendor) return;
    setValue("partyAddress", vendor.corporateAddress || "");
    setValue("gstn", vendor.gstin || "");
  }, [vendorId, ledgerList, setValue]);

  // FETCH VENDOR ORDERS when vendor + category + costHead all set
  useEffect(() => {
    if (!vendorId || !categoryCode || !costHead || !projectCode) return;
    const fetchOrders = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.GET_VENDOR_ORDERS}?vendorId=${vendorId}&projectCode=${projectCode}&receivedCategory=${categoryCode}&itemCategory=${"MAT_001"}&costHead=${costHead}`,
          method: "GET",
        });
        setVendorOrders(res.data || []);
      } catch {
        toast.error("Failed to load vendor orders");
      }
    };
    fetchOrders();
  }, [vendorId, categoryCode, costHead, projectCode]);

  const handleCategoryChange = (value) => {
    setValue("categoryCode", value);
    setValue("costHead", "");
    setValue("orderId", "");
    setValue("items", []);
    setVendorOrders([]);
  };

  const costHeadOptions = COST_HEAD_OPTIONS[categoryCode] || COST_HEAD_OPTIONS["Purchases_Order"];

  return (
    <div className="xl:overflow-y-auto xl:max-h-[calc(100vh-110px)] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-x-6 gap-y-5">

      {/* CATEGORY GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Category</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller
              control={control}
              name="categoryCode"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => { field.onChange(val); handleCategoryChange(val); }}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(errors.categoryCode, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BVS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* ITEM CATEGORY — display Material, send MAT_001 */}
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Item Category</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Input
              value="Material"
              disabled
              className={`${getInputClass(false, true)} w-full h-[34px]`}
            />
          </div>
        </div>

        {/* COST HEAD */}
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Cost Head</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller
              control={control}
              name="costHead"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("orderId", "");
                    setValue("items", []);
                    setVendorOrders([]);
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(errors.costHead, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select Cost Head" />
                  </SelectTrigger>
                  <SelectContent>
                    {costHeadOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* BVS INFO GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>BVS No</div>
          <Input {...register("bvsNo")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>BVS Date</div>
          <Input type="date" {...register("bvsDate")} disabled={disabled} className={`${getInputClass(errors.bvsDate, disabled)} w-[220px] h-[34px]`} />
        </div>
      </div>

      {/* PARTY GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party Name</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("orderId", "");
                    setValue("items", []);
                    setVendorOrders([]);
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(errors.vendorId, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {ledgerList.map((l) => (
                      <SelectItem key={l.ledgerId} value={String(l.ledgerId)}>{l.ledgerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party Address</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller control={control} name="partyAddress" render={({ field }) => (
              <ExpandableTextField value={field.value} onChange={field.onChange} disabled title="Party Address" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[220px]" />
            )} />
          </div>
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party GSTN</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller control={control} name="gstn" render={({ field }) => (
              <ExpandableTextField value={field.value} onChange={field.onChange} disabled title="Party GSTN" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[180px]" />
            )} />
          </div>
        </div>
      </div>

      {/* ORDER GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Order No</div>
          <div className="w-[220px]">
            <Controller
              control={control}
              name="orderId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(val) => {
                    field.onChange(val);
                    setValue("items", []);
                  }}
                  disabled={disabled || !vendorId || !categoryCode || !costHead}
                >
                  <SelectTrigger className={`${getInputClass(errors.orderId, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select Order" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorOrders.map((o) => {
                      const id = o.orderId ?? o.id;
                      return (
                        <SelectItem key={id} value={String(id)}>{o.orderNo}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* PARTY BILL GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party Bill No</div>
          <Input {...register("partyBillNo")} disabled={disabled} className={`${getInputClass(errors.partyBillNo, disabled)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party Bill Date</div>
          <Input type="date" {...register("partyDate")} disabled={disabled} className={`${getInputClass(errors.partyDate, disabled)} w-[220px] h-[34px]`} />
        </div>
      </div>

      {/* SITE / ADDRESS GROUP */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Site</div>
          <Input value={projectCode || ""} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Billing Address</div>
          <div className="w-[220px]">
            <Controller control={control} name="billingAddress" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger className={`${getInputClass(errors.billingAddress, disabled)} w-full`}>
                  <SelectValue placeholder="Select Billing Address" />
                </SelectTrigger>
                <SelectContent>
                  {billingOptions.map((item, idx) => <SelectItem key={idx} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Shipping Address</div>
          <div className="w-[220px]">
            <Controller control={control} name="shippingAddress" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger className={`${getInputClass(errors.shippingAddress, disabled)} w-full`}>
                  <SelectValue placeholder="Select Shipping Address" />
                </SelectTrigger>
                <SelectContent>
                  {shippingOptions.map((item, idx) => <SelectItem key={idx} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
      </div>
    </div>
  );
}
