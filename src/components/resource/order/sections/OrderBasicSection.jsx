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

const ORDER_CATEGORIES = [
  { label: "Purchases Order",       value: "Purchases_Order"       },
  { label: "Customer Supply Order", value: "Customer_Supply_Order" },
  { label: "Site Transfer Order",   value: "Site_Transfer_Order"   },
];

const COST_HEAD_OPTIONS = {
  Purchases_Order:       [{ label: "Project Work", value: "Project_Work" }, { label: "Fixed Asset", value: "Fixed_Asset" }],
  Customer_Supply_Order: [{ label: "Project Work", value: "Project_Work" }],
  Site_Transfer_Order:   [{ label: "Project Work", value: "Project_Work" }, { label: "Fixed Asset", value: "Fixed_Asset" }],
};

const LABEL = `${labelClass} w-[180px] min-w-[180px] max-w-[180px]`;
const INPUT_W = "w-[220px] min-w-[220px] max-w-[220px]";

export default function OrderBasicSection({
  form,
  mode = "create",
  disabled,
  fileName,
  setFileName,
  fileUrl,
  setFileUrl,
  attachedFile,
  setAttachedFile,
  fileRef,
}) {
  const [ledgerList,          setLedgerList]          = useState([]);
  const [billingOptions,      setBillingOptions]      = useState([]);
  const [shippingOptions,     setShippingOptions]     = useState([]);
  const [currentProjectData,  setCurrentProjectData]  = useState(null); // full data for current project
  const [allProjects,         setAllProjects]         = useState([]);   // for site transfer select
  const [transferProjectData, setTransferProjectData] = useState(null); // selected transfer project details

  const { register, control, setValue, watch, formState: { errors } } = form;

  const projectInfo  = getLocalStorage("projectInfo");
  const projectId    = projectInfo?.projectId;
  const categoryCode        = watch("categoryCode");
  const selectedVendorId    = watch("vendorId");
  const transferProjectSite = watch("transferProjectSite");
  const partyAddress        = watch("partyAddress");

  // ── LOAD LEDGERS (for Purchases Order vendor select)
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setLedgerList(res.data || []))
      .catch(() => toast.error("Failed to load vendors"));
  }, []);

  // ── LOAD ALL PROJECTS (for Site Transfer select)
  useEffect(() => {
    const projectCode = projectInfo?.projectCode;
    const url = projectCode
      ? `${API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS}?excludeCurrent=true&currentProjectCode=${projectCode}`
      : API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS;
    apiRequest({ url, method: "GET" })
      .then((res) => setAllProjects(res.data || []))
      .catch(() => {});
  }, []);

  // ── LOAD CURRENT PROJECT DETAILS (for billing/shipping + Customer Supply auto-fill)
  useEffect(() => {
    if (!projectId) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`, method: "GET" })
      .then((res) => {
        const data = res.data?.[0];
        if (!data) return;
        setCurrentProjectData(data);
        const billing  = [data.billingAddress].filter(Boolean);
        const shipping = [data.shippingAddress, data.shippingAddress2, data.shippingAddress3].filter(Boolean);
        setBillingOptions(billing);
        setShippingOptions(shipping);
      })
      .catch(() => toast.error("Failed to load project details"));
  }, [projectId]);

  // ── AUTO-FILL: Customer Supply Order → from current project (create mode only — edit mode handled in fetchOrder)
  useEffect(() => {
    if (mode !== "create") return;
    if (categoryCode !== "Customer_Supply_Order" || !currentProjectData) return;
    setValue("partyAddress",   currentProjectData.registeredAddress     || "");
    setValue("gstn",           currentProjectData.gstn                  || "");
    setValue("contactPerson",  currentProjectData.commercialManager     || "");
    setValue("contactNumber",  currentProjectData.commMgmtContactNumber || "");
  }, [categoryCode, currentProjectData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FALLBACK FILL: Site Transfer initial load — fires only when partyAddress is still empty
  // fetchOrder is the primary source; this covers the case where fetchOrder's secondary call fails
  // or allProjects loads after fetchOrder completes with empty party fields.
  useEffect(() => {
    if (categoryCode !== "Site_Transfer_Order" || !transferProjectSite || partyAddress) return;
    const project = allProjects.find((p) => p.projectCode === transferProjectSite);
    if (!project) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${project.id}`, method: "GET" })
      .then((res) => {
        const data = res.data?.[0];
        if (!data) return;
        setTransferProjectData(data);
        setValue("partyAddress",  data.registeredAddress     || "");
        setValue("gstn",          data.gstn                  || "");
        setValue("contactPerson", data.projectManager        || "");
        setValue("contactNumber", data.projMgmtContactNumber || "");
      })
      .catch(() => {});
  }, [transferProjectSite, categoryCode, allProjects, partyAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CATEGORY CHANGE: reset party fields + re-fill Customer Supply immediately if data ready
  const handleCategoryChange = (value) => {
    setValue("categoryCode",       value);
    setValue("subCategoryCode",    "MAT_001");
    setValue("costHead",           "");
    setValue("items",              []);
    setValue("vendorId",           "");
    setValue("transferProjectSite","");
    setValue("partyAddress",       "");
    setValue("gstn",               "");
    setValue("contactPerson",      "");
    setValue("contactNumber",      "");

    // Immediately populate if Customer Supply and project data already loaded
    if (value === "Customer_Supply_Order" && currentProjectData) {
      setValue("partyAddress",  currentProjectData.registeredAddress     || "");
      setValue("gstn",          currentProjectData.gstn                  || "");
      setValue("contactPerson", currentProjectData.commercialManager     || "");
      setValue("contactNumber", currentProjectData.commMgmtContactNumber || "");
    }
  };

  const costHeadOptions = COST_HEAD_OPTIONS[categoryCode] || COST_HEAD_OPTIONS["Purchases_Order"];

  // Category, Sub Category, Cost Head are locked after creation
  const lockedAfterCreate = mode !== "create";

  // ── PARTY LABEL by category
  const partyLabel =
    categoryCode === "Customer_Supply_Order" ? "Client Name" :
    categoryCode === "Site_Transfer_Order"   ? "Transfer Site" :
    "Party Name";

  return (
    <div className="flex flex-col gap-y-4 w-full xl:w-[410px] shrink-0 xl:overflow-y-auto xl:max-h-[calc(100vh-110px)] pr-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4">

        {/* ── CATEGORY SECTION */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">

          {/* Category */}
          <div className="flex items-center">
            <div className={LABEL}>Category</div>
            <div className={INPUT_W}>
              <Controller
                control={control}
                name="categoryCode"
                render={({ field }) => (
                  <Select
                    {...(field.value ? { value: field.value } : {})}
                    onValueChange={(val) => { field.onChange(val); handleCategoryChange(val); }}
                    disabled={disabled || lockedAfterCreate}
                  >
                    <SelectTrigger className={`${getInputClass(errors.categoryCode, disabled || lockedAfterCreate)} w-full h-[36px]`}>
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

          {/* Sub Category */}
          <div className="flex items-center">
            <div className={LABEL}>Sub Category</div>
            <div className={INPUT_W}>
              <Controller
                control={control}
                name="subCategoryCode"
                render={({ field }) => (
                  <Select {...(field.value ? { value: field.value } : {})} onValueChange={field.onChange} disabled={disabled || lockedAfterCreate}>
                    <SelectTrigger className={`${getInputClass(errors.subCategoryCode, disabled || lockedAfterCreate)} w-full h-[36px]`}>
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

          {/* Cost Head — key=categoryCode forces remount on category switch, clearing stale visual state */}
          <div className="flex items-center">
            <div className={LABEL}>Cost Head</div>
            <div className={INPUT_W}>
              <Controller
                control={control}
                name="costHead"
                render={({ field }) => (
                  <Select
                    key={categoryCode}
                    value={field.value ? field.value : undefined}
                    onValueChange={(val) => { field.onChange(val); setValue("items", []); }}
                    disabled={disabled || lockedAfterCreate}
                  >
                    <SelectTrigger className={`${getInputClass(errors.costHead, disabled || lockedAfterCreate)} w-full h-[36px]`}>
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

        {/* ── ORDER SECTION */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">
          <div className="flex items-center">
            <div className={LABEL}>Order No</div>
            <Input {...register("orderNo")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Order Date</div>
            <Input type="date" {...register("orderDate")} disabled={disabled} className={`${getInputClass(errors.orderDate, disabled)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Order Validity</div>
            <Input type="date" {...register("validityDate")} disabled={disabled} className={`${getInputClass(errors.validityDate, disabled)} ${INPUT_W} h-[34px]`} />
          </div>
        </div>

        {/* ── PARTY SECTION — conditional by category */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">

          {/* Party Name / Client Name / Transfer Site */}
          <div className="flex items-center">
            <div className={LABEL}>{partyLabel}</div>
            <div className={INPUT_W}>

              {/* Purchases Order: vendor select */}
              {(!categoryCode || categoryCode === "Purchases_Order") && (
                <Controller
                  control={control}
                  name="vendorId"
                  render={({ field }) => (
                    <Select
                      {...(field.value ? { value: String(field.value) } : {})}
                      onValueChange={(val) => {
                        field.onChange(val);
                        if (!val) {
                          setValue("partyAddress", ""); setValue("gstn", "");
                          setValue("contactPerson", ""); setValue("contactNumber", "");
                          return;
                        }
                        const vendor = ledgerList.find((v) => String(v.ledgerId) === String(val));
                        if (!vendor) return;
                        setValue("partyAddress",  vendor.corporateAddress     || "");
                        setValue("gstn",          vendor.gstin                || "");
                        setValue("contactPerson", vendor.primaryContactPerson || "");
                        setValue("contactNumber", vendor.primaryContactNumber || "");
                      }}
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
              )}

              {/* Customer Supply Order: read-only client name from project info */}
              {categoryCode === "Customer_Supply_Order" && (
                <Input
                  value={projectInfo?.clientName || ""}
                  disabled
                  placeholder="[Auto]"
                  className={`w-full h-[34px] ${getInputClass(false, true)}`}
                />
              )}

              {/* Site Transfer Order: select from all projects */}
              {categoryCode === "Site_Transfer_Order" && (
                <Controller
                  control={control}
                  name="transferProjectSite"
                  render={({ field }) => (
                    <Select
                      value={field.value ? field.value : undefined}
                      onValueChange={(val) => {
                        field.onChange(val);
                        const project = allProjects.find((p) => p.projectCode === val);
                        if (!project) return;
                        apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${project.id}`, method: "GET" })
                          .then((res) => {
                            const d = res.data?.[0];
                            if (!d) return;
                            setTransferProjectData(d);
                            setValue("partyAddress",  d.registeredAddress     || "");
                            setValue("gstn",          d.gstn                  || "");
                            setValue("contactPerson", d.projectManager        || "");
                            setValue("contactNumber", d.projMgmtContactNumber || "");
                          })
                          .catch(() => {});
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className={`${getInputClass(errors.transferProjectSite, disabled)} w-full h-[36px]`}>
                        <SelectValue placeholder="Select Transfer Site" />
                      </SelectTrigger>
                      <SelectContent>
                        {allProjects.map((p) => (
                            <SelectItem key={p.projectCode} value={p.projectCode}>
                              {p.projectCode} — {p.projectName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
          </div>

          {/* Party Address */}
          <div className="flex items-center">
            <div className={LABEL}>Party Address</div>
            <div className={INPUT_W}>
              <Controller control={control} name="partyAddress" render={({ field }) => (
                <ExpandableTextField value={field.value} onChange={field.onChange} disabled={true} title="Party Address" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[220px]" />
              )} />
            </div>
          </div>

          {/* Party GSTN */}
          <div className="flex items-center">
            <div className={LABEL}>Party GSTN</div>
            <div className={INPUT_W}>
              <Controller control={control} name="gstn" render={({ field }) => (
                <ExpandableTextField value={field.value} onChange={field.onChange} disabled={true} title="Party GSTN" placeholder="[Auto]" minHeight="min-h-[36px]" modalHeight="min-h-[180px]" />
              )} />
            </div>
          </div>
        </div>

        {/* ── PROJECT / SITE SECTION */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">
          <div className="flex items-center">
            <div className={LABEL}>Site</div>
            <Input value={projectInfo?.projectCode || ""} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Billing Address</div>
            <div className={INPUT_W}>
              <Controller control={control} name="billingAddress" render={({ field }) => (
                <Select {...(field.value ? { value: field.value } : {})} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger className={`${getInputClass(errors.billingAddress, disabled)} w-full`}>
                    <SelectValue placeholder="Select Billing Address" />
                  </SelectTrigger>
                  <SelectContent>
                    {billingOptions.map((item, i) => <SelectItem key={i} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Shipping Address</div>
            <div className={INPUT_W}>
              <Controller control={control} name="shippingAddress" render={({ field }) => (
                <Select {...(field.value ? { value: field.value } : {})} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger className={`${getInputClass(errors.shippingAddress, disabled)} w-full`}>
                    <SelectValue placeholder="Select Shipping Address" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingOptions.map((item, i) => <SelectItem key={i} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>
        </div>

        {/* ── CONTACT SECTION */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">
          <div className="flex items-center">
            <div className={LABEL}>Contact Person</div>
            <Input {...register("contactPerson")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Contact Number</div>
            <Input {...register("contactNumber")} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} ${INPUT_W} h-[34px]`} />
          </div>
        </div>

        {/* ── QUOTATION SECTION */}
        <div className="flex flex-col gap-[2px] break-inside-avoid">
          <div className="flex items-center">
            <div className={LABEL}>Quotation No</div>
            <Input {...register("quotationNo")} disabled={disabled} className={`${getInputClass(errors.quotationNo, disabled)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Quotation Date</div>
            <Input type="date" {...register("quotationDate")} disabled={disabled} className={`${getInputClass(errors.quotationDate, disabled)} ${INPUT_W} h-[34px]`} />
          </div>
        </div>

        {/* ── ORDER MESSAGE */}
        <div>
          <div className="flex items-start">
            <div className={LABEL}>Order Message</div>
            <div className={`${INPUT_W} overflow-hidden break-words`}>
              <Controller control={control} name="orderMessage" render={({ field }) => (
                <ExpandableTextField value={field.value} onChange={field.onChange} disabled={disabled} error={errors.orderMessage} title="Order Message" placeholder="Text" minHeight="min-h-[36px]" modalHeight="min-h-[220px]" />
              )} />
            </div>
          </div>
        </div>

        {/* ── FILE SECTION */}
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
    </div>
  );
}
