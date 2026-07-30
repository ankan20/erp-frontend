"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import FileUpload, { ACCEPT_PDF, TYPES_PDF } from "@/components/common/FileUpload";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import SearchableSelect from "@/components/common/SearchableSelect";
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

// labelClass has w-[250px] baked in — define our own to keep visual style but use fluid width
const LABEL = "w-[160px] shrink-0 px-3 h-[34px] flex items-center bg-[#d6e6f2] border border-[#6f7f8f] text-sm rounded-sm";
const INPUT_W = "flex-1 min-w-0";

export default function OrderBasicSection({
  form,
  mode = "create",
  disabled,
  existingFileUrl,
  onFileChange,
  onClearExisting,
  fileResetKey,
  withIndent,
  setWithIndent,
}) {
  const [ledgerList,          setLedgerList]          = useState([]);
  const [currentProjectData,  setCurrentProjectData]  = useState(null);
  const [allProjects,         setAllProjects]         = useState([]);
  const [transferProjectData, setTransferProjectData] = useState(null);

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
      .then((res) => setLedgerList((res.data || []).slice().sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""))))
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

  // ── LOAD CURRENT PROJECT DETAILS (for billing/shipping options + Customer Supply auto-fill)
  useEffect(() => {
    if (!projectId) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`, method: "GET" })
      .then((res) => {
        const data = res.data?.[0];
        if (!data) return;
        setCurrentProjectData(data);
      })
      .catch(() => toast.error("Failed to load project details"));
  }, [projectId]);

  // ── COMPUTE billing/shipping options from current category + project data
  const billingOptions = (() => {
    if (!currentProjectData) return [];
    if (categoryCode === "Purchases_Order") {
      return [currentProjectData.companyBillingAddress].filter(Boolean);
    }
    // Customer Supply and Site Transfer (FROM = current project)
    return [currentProjectData.shippingAddress, currentProjectData.shippingAddress2, currentProjectData.shippingAddress3].filter(Boolean);
  })();

  const shippingOptions = (() => {
    if (categoryCode === "Site_Transfer_Order") {
      if (!transferProjectData) return [];
      return [transferProjectData.shippingAddress, transferProjectData.shippingAddress2, transferProjectData.shippingAddress3].filter(Boolean);
    }
    if (!currentProjectData) return [];
    return [currentProjectData.shippingAddress, currentProjectData.shippingAddress2, currentProjectData.shippingAddress3].filter(Boolean);
  })();

  // ── AUTO-SELECT billing/shipping when only one option available
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

  // ── AUTO-FILL: Customer Supply Order → from current project (create mode only)
  useEffect(() => {
    if (mode !== "create") return;
    if (categoryCode !== "Customer_Supply_Order" || !currentProjectData) return;
    setValue("partyAddress", currentProjectData.registeredAddress || "");
    setValue("gstn",         currentProjectData.gstn              || "");
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
        setValue("partyAddress", data.registeredAddress || "");
        setValue("gstn",         data.gstn              || "");
      })
      .catch(() => {});
  }, [transferProjectSite, categoryCode, allProjects, partyAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CATEGORY CHANGE: reset party fields + re-fill Customer Supply immediately if data ready
  const handleCategoryChange = (value) => {
    setValue("categoryCode",        value);
    setValue("subCategoryCode",     "MAT_001");
    setValue("costHead",            "Project_Work");
    setValue("items",               []);
    setValue("terms",               []);
    setValue("vendorId",            "");
    setValue("transferProjectSite", "");
    setValue("partyAddress",        "");
    setValue("gstn",                "");
    setValue("billingAddress",      "");
    setValue("shippingAddress",     "");
    setTransferProjectData(null);

    if (value === "Customer_Supply_Order" && currentProjectData) {
      setValue("partyAddress", currentProjectData.registeredAddress || "");
      setValue("gstn",         currentProjectData.gstn              || "");
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
    <div className="flex flex-col gap-y-4 w-full xl:w-[410px] shrink-0 xl:overflow-y-auto xl:max-h-[calc(100vh-110px)] pr-1 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4">

        {/* ── WITH / WITHOUT INDENT TOGGLE */}
        <div className="flex items-center break-inside-avoid">
          <div className={LABEL}>Indent Type</div>
          <div className="flex rounded-sm border border-[#8f8f8f] overflow-hidden text-sm shrink-0">
            {[
              { label: "With Indent", value: true },
              { label: "Without Indent", value: false },
            ].map(({ label, value }) => (
              <button
                key={label}
                type="button"
                disabled={mode !== "create"}
                onClick={() => {
                  if (mode !== "create") return;
                  setWithIndent(value);
                  setValue("items", []);
                }}
                className={`px-3 py-1 whitespace-nowrap transition cursor-pointer disabled:cursor-default ${
                  withIndent === value
                    ? "bg-[#7fc3d4] text-black font-semibold"
                    : "bg-white text-gray-600 hover:bg-gray-100 disabled:hover:bg-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

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
                    <SearchableSelect
                      options={ledgerList}
                      value={field.value ? String(field.value) : ""}
                      onChange={(val) => {
                        field.onChange(val ? String(val) : "");
                        if (!val) {
                          setValue("partyAddress", "");
                          setValue("gstn", "");
                          return;
                        }
                        const vendor = ledgerList.find((v) => String(v.ledgerId) === String(val));
                        if (!vendor) return;
                        setValue("partyAddress", vendor.corporateAddress || "");
                        setValue("gstn",         vendor.gstin            || "");
                      }}
                      disabled={disabled}
                      placeholder="Filter from Vendor List"
                      labelKey="ledgerName"
                      valueKey="ledgerId"
                      searchKeys={["ledgerName"]}
                      className={errors.vendorId ? "border-red-500" : ""}
                    />
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
                            setValue("partyAddress", d.registeredAddress || "");
                            setValue("gstn",         d.gstn              || "");
                            setValue("shippingAddress", "");
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
            <Input {...register("contactPerson")} disabled={disabled} placeholder="Text" className={`${getInputClass(errors.contactPerson, disabled)} ${INPUT_W} h-[34px]`} />
          </div>
          <div className="flex items-center">
            <div className={LABEL}>Contact Number</div>
            <Input {...register("contactNumber")} disabled={disabled} placeholder="Text" className={`${getInputClass(errors.contactNumber, disabled)} ${INPUT_W} h-[34px]`} />
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
        <FileUpload
          label="Attached Party Quotation"
          onChange={onFileChange}
          existingUrl={existingFileUrl}
          onClearExisting={onClearExisting}
          disabled={disabled}
          resetKey={fileResetKey}
          required={mode === "create"}
          accept={ACCEPT_PDF}
          allowedTypes={TYPES_PDF}
        />

      </div>
    </div>
  );
}
