"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
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

// CHANGED: New category values for existing Order module
const ORDER_CATEGORIES = [
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
  // SubCategory: Material only; assetOnly = costHead === "Fixed Asset" (handled in modal)
  "Site_Transfer_Order": [
    { label: "Project Work", value: "Project_Work" },
    { label: "Fixed Asset", value: "Fixed_Asset" },
  ],
};

export default function OrderBasicSection({
  form,
  disabled,
  fileName,
  setFileName,
  fileUrl,
  setFileUrl,
  attachedFile,
  setAttachedFile,
  fileRef,
}) {
  const [ledgerList, setLedgerList] = useState([]);
  const [billingOptions, setBillingOptions] = useState([]);
  const [shippingOptions, setShippingOptions] = useState([]);

  const { register, control, setValue, watch, formState: { errors } } = form;

  const projectInfo = getLocalStorage("projectInfo");
  const projectId = projectInfo?.projectId;

  const selectedVendorId = watch("vendorId");
  const categoryCode = watch("categoryCode");

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

  // LOAD PROJECT
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

  // VENDOR AUTO FILL
  useEffect(() => {
    if (!selectedVendorId) {
      setValue("partyAddress", "");
      setValue("gstn", "");
      setValue("contactPerson", "");
      setValue("contactNumber", "");
      return;
    }
    const selectedVendor = ledgerList.find(
      (item) => String(item.ledgerId) === String(selectedVendorId)
    );
    if (!selectedVendor) return;
    setValue("partyAddress", selectedVendor.corporateAddress || "");
    setValue("gstn", selectedVendor.gstin || "");
    setValue("contactPerson", selectedVendor.primaryContactPerson || "");
    setValue("contactNumber", selectedVendor.primaryContactNumber || "");
  }, [selectedVendorId, ledgerList, setValue]);

  // CHANGED: When category changes reset costHead and items
  const handleCategoryChange = (value) => {
    setValue("categoryCode", value);
    setValue("subCategoryCode", "MAT_001");
    setValue("costHead", "");
    setValue("items", []);
  };

  const costHeadOptions = COST_HEAD_OPTIONS[categoryCode] || COST_HEAD_OPTIONS["Purchases_Order"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-x-6 gap-y-5">

      {/* CATEGORY SECTION */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">

        {/* CATEGORY — CHANGED: "Purchases Order" / "Customer Supply Order" */}
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
                    {ORDER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* SUB CATEGORY — CHANGED: always "Material" for both categories */}
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Sub Category</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller
              control={control}
              name="subCategoryCode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger className={`${getInputClass(errors.subCategoryCode, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAT_001">Material</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* COST HEAD — CHANGED: new field; options vary by category */}
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
                    // Clear items — costHead change means different assetOnly = different item list
                    setValue("items", []);
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

      {/* ORDER SECTION — unchanged */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Order No</div>
          <Input {...register("orderNo")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Order Date</div>
          <Input type="date" {...register("orderDate")} disabled={disabled} className={`${getInputClass(errors.orderDate, disabled)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Order Validity</div>
          <Input type="date" {...register("validityDate")} disabled={disabled} className={`${getInputClass(errors.validityDate, disabled)} w-[220px] h-[34px]`} />
        </div>
      </div>

      {/* PARTY SECTION — unchanged */}
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
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger className={`${getInputClass(errors.vendorId, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Filter from Vendor List" />
                  </SelectTrigger>
                  <SelectContent>
                    {ledgerList.map((ledger) => (
                      <SelectItem key={ledger.ledgerId} value={String(ledger.ledgerId)}>
                        {ledger.ledgerName}
                      </SelectItem>
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
              <ExpandableTextField value={field.value} onChange={field.onChange} disabled={true} title="Party Address" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[220px]" />
            )} />
          </div>
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Party GSTN</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            <Controller control={control} name="gstn" render={({ field }) => (
              <ExpandableTextField value={field.value} onChange={field.onChange} disabled={true} title="Party GSTN" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[180px]" />
            )} />
          </div>
        </div>
      </div>

      {/* PROJECT SECTION — unchanged */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Site</div>
          <Input value={projectInfo?.projectCode || ""} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
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
                  {billingOptions.map((item, index) => <SelectItem key={index} value={item}>{item}</SelectItem>)}
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
                  {shippingOptions.map((item, index) => <SelectItem key={index} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
        </div>
      </div>

      {/* CONTACT SECTION — unchanged */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Contact Person</div>
          <Input {...register("contactPerson")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Contact Number</div>
          <Input {...register("contactNumber")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-[220px] h-[34px]`} />
        </div>
      </div>

      {/* QUOTATION SECTION — unchanged */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Quotation No</div>
          <Input {...register("quotationNo")} disabled={disabled} className={`${getInputClass(errors.quotationNo, disabled)} w-[220px] min-w-[220px] max-w-[220px] h-[34px]`} />
        </div>
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Quotation Date</div>
          <Input type="date" {...register("quotationDate")} disabled={disabled} className={`${getInputClass(errors.quotationDate, disabled)} w-[220px] min-w-[220px] max-w-[220px] h-[34px]`} />
        </div>
      </div>

      {/* ORDER MESSAGE — unchanged */}
      <div>
        <div className="flex items-start">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Order Message</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px] overflow-hidden break-words">
            <Controller control={control} name="orderMessage" render={({ field }) => (
              <ExpandableTextField value={field.value} onChange={field.onChange} disabled={disabled} error={errors.orderMessage} title="Order Message" placeholder="Text" minHeight="min-h-[36px]" modalHeight="min-h-[220px]" />
            )} />
          </div>
        </div>
      </div>

      {/* FILE SECTION — unchanged */}
      <div>
        <div className="inline-flex items-center justify-center min-h-[38px] px-6 bg-[#FFE7A3] border border-[#E29B34] rounded-[8px] text-[15px] font-semibold text-black">
          Attached Party Quotation
        </div>
        <div className="mt-3">
          {!disabled ? (
            <div className="w-[220px]">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setAttachedFile(null);
                    setFileName("");
                    if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
                    setFileUrl("");
                    if (fileRef.current) fileRef.current.value = "";
                    return;
                  }
                  setAttachedFile(file);
                  setFileName(file.name);
                  if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
                  setFileUrl(URL.createObjectURL(file));
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              {fileName ? (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-[36px] px-3 flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-left">
                  <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1" title={fileName}>{fileName}</span>
                </button>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-[36px] px-3 flex items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer text-left">
                  <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-400">Click to upload PDF</span>
                </button>
              )}
            </div>
          ) : (
            !attachedFile && fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-700 text-sm font-medium hover:underline">
                <Download className="w-4 h-4" />
                Download Attachment
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}
