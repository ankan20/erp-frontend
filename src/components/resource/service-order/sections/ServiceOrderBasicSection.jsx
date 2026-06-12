"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileText, Upload } from "lucide-react";
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

// Category config — drives subCategory options, costHead options, and assetOnly flag
// Keys are underscore values (safe for URLs); label is the display text
const CATEGORY_CONFIG = {
  "Work_Order": {
    label: "Work Order",
    subCategories: [
      { label: "Service", value: "SER_001" },
      { label: "Composite", value: "COM_001" },
    ],
    costHeads: [{ label: "Project Work", value: "Project_Work" }],
    multiSelect: true,
    assetOnly: false,
  },
  "Hire_Order": {
    label: "Hire Order",
    subCategories: [{ label: "Service", value: "SER_001" }],
    costHeads: [{ label: "Project Work", value: "Project_Work" }],
    multiSelect: false,
    assetOnly: false,
  },
  // Site Transfer Order moved to existing Order module
  "Job_Contract_Order": {
    label: "Job Contract Order",
    subCategories: [{ label: "Expenses", value: "EXP_001" }],
    costHeads: [{ label: "Project Work", value: "Project_Work" }],
    multiSelect: false,
    assetOnly: false,
  },
};

// { label: "Work Order", value: "Work_Order" } — used by the select
const SERVICE_ORDER_CATEGORIES = Object.entries(CATEGORY_CONFIG).map(
  ([value, config]) => ({ label: config.label, value }),
);

export default function ServiceOrderBasicSection({
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
  const [subDropdownOpen, setSubDropdownOpen] = useState(false);
  const subDropdownRef = useRef(null);

  const { register, control, setValue, watch, formState: { errors } } = form;

  const projectInfo = getLocalStorage("projectInfo");
  const projectId = projectInfo?.projectId;

  const selectedVendorId = watch("vendorId");
  const categoryCode = watch("categoryCode");
  const subCategoryCodes = watch("subCategoryCodes") || [];

  const categoryConfig = CATEGORY_CONFIG[categoryCode] || CATEGORY_CONFIG["Work_Order"];

  // Close sub dropdown on outside click
  useEffect(() => {
    if (!subDropdownOpen) return;
    const handleOutside = (e) => {
      if (subDropdownRef.current && !subDropdownRef.current.contains(e.target)) {
        setSubDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [subDropdownOpen]);

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

  // When category changes — reset sub/costHead/items
  const handleCategoryChange = (value) => {
    setValue("categoryCode", value);
    const config = CATEGORY_CONFIG[value];
    // Auto-set single sub category options
    if (!config.multiSelect) {
      setValue("subCategoryCodes", [config.subCategories[0].value]);
    } else {
      setValue("subCategoryCodes", []);
    }
    // Auto-set costHead if only one option
    if (config.costHeads.length === 1) {
      setValue("costHead", config.costHeads[0].value);
    } else {
      setValue("costHead", "");
    }
    setValue("items", []);
  };

  // Multi-select toggle
  const toggleSubCategory = (value) => {
    const current = subCategoryCodes;
    const exists = current.includes(value);
    const updated = exists ? current.filter((v) => v !== value) : [...current, value];
    setValue("subCategoryCodes", updated, { shouldValidate: true });
  };

  const subLabel = subCategoryCodes.length > 0
    ? categoryConfig.subCategories
        .filter((o) => subCategoryCodes.includes(o.value))
        .map((o) => o.label)
        .join(", ")
    : "Select";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-x-6 gap-y-5">

      {/* CATEGORY SECTION */}
      <div className="flex flex-col gap-[2px] break-inside-avoid">

        {/* CATEGORY */}
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
                    {SERVICE_ORDER_CATEGORIES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* SUB CATEGORY — multi-select for Work Order, single for others */}
        <div className="flex items-center">
          <div className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}>Sub Category</div>
          <div className="w-[220px] min-w-[220px] max-w-[220px]">
            {categoryConfig.multiSelect ? (
              // MULTI-SELECT dropdown
              <div ref={subDropdownRef} className="relative">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setSubDropdownOpen((p) => !p)}
                  className={`
                    ${getInputClass(errors.subCategoryCodes, disabled)}
                    w-full h-[36px] px-3 flex items-center justify-between text-sm
                  `}
                >
                  <span className={`truncate ${!subCategoryCodes.length ? "text-gray-400" : ""}`}>
                    {subLabel}
                  </span>
                  <ChevronDown size={14} className="shrink-0 ml-1 text-gray-500" />
                </button>

                {subDropdownOpen && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                    {categoryConfig.subCategories.map((opt) => {
                      const checked = subCategoryCodes.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          onClick={() => toggleSubCategory(opt.value)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer"
                        >
                          <input type="checkbox" readOnly checked={checked} className="accent-blue-500 cursor-pointer" />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* {errors.subCategoryCodes && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.subCategoryCodes.message}</p>
                )} */}
              </div>
            ) : (
              // SINGLE select — only one option, show as disabled select
              <Controller
                control={control}
                name="subCategoryCodes"
                render={({ field }) => (
                  <Select
                    value={field.value?.[0] || ""}
                    onValueChange={(val) => field.onChange([val])}
                    disabled={disabled}
                  >
                    <SelectTrigger className={`${getInputClass(errors.subCategoryCodes, disabled)} w-full h-[36px]`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryConfig.subCategories.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
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
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger className={`${getInputClass(errors.costHead, disabled)} w-full h-[36px]`}>
                    <SelectValue placeholder="Select Cost Head" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryConfig.costHeads.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* ORDER SECTION */}
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

      {/* PARTY SECTION */}
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

      {/* PROJECT SECTION */}
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

      {/* CONTACT SECTION */}
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

      {/* QUOTATION SECTION */}
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

      {/* ORDER MESSAGE */}
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

      {/* FILE SECTION — same as order module */}
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
