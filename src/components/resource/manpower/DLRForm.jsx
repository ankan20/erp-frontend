"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller } from "react-hook-form";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass, labelClass } from "@/lib/formStyles";

import DLRDetailsTable, { emptyRow } from "./DLRDetailsTable";
import DLRSummaryTab from "./DLRSummaryTab";
import FileUpload, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUpload";

// ── Schema ────────────────────────────────────────────────────────────────────

const dlrSchema = z.object({
  dlrDate:    z.string().min(1, "DLR Date is required"),
  vendorId:   z.string().optional(),
  orderId:    z.string().optional(),
  reportBy:   z.string().optional(),
  verifiedBy: z.string().optional(),
  dlrNo:      z.string().optional(),
});

const defaultValues = {
  dlrDate:    "",
  vendorId:   "",
  orderId:    "",
  reportBy:   "",
  verifiedBy: "",
  dlrNo:      "",
};

// ── Label constant (matches SRN/GRN pattern) ─────────────────────────────────
const LABEL = `${labelClass} w-full sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px]`;

// ── Tab bar styles ────────────────────────────────────────────────────────────

const TAB_CLIP = "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)";

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ clipPath: TAB_CLIP }}
      className={`px-5 h-[30px] text-[12px] font-semibold transition-colors select-none
        ${active
          ? "bg-[#ffd966] text-[#3d3200] border border-[#c9a800]"
          : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
        }`}
    >
      {label}
    </button>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────────

export default function DLRForm({
  mode          = "create",
  dlrId,
  initialData,
  onDataLoaded,
  onAfterSubmit,
  disabled: disabledProp = false,
}) {
  const router = useRouter();

  const projectInfo  = getLocalStorage("projectInfo");
  const projectCode  = projectInfo?.projectCode || "";

  // ── State ─────────────────────────────────────────────────────────────────
  const [isLoading,     setIsLoading]     = useState(false);
  const [isEditing,     setIsEditing]     = useState(mode === "create");
  const [saving,        setSaving]        = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [initialFormData, setInitialFormData] = useState(null);

  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [activeTab,     setActiveTab]     = useState("details");

  const [summaryData,    setSummaryData]    = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [supplierList,     setSupplierList]     = useState([]);
  const [vendorOrders,     setVendorOrders]     = useState([]);
  const [labourList,       setLabourList]       = useState([]);
  const [locationOptions,  setLocationOptions]  = useState([]);
  const [items,         setItems]         = useState([emptyRow()]);
  const [initialItems,  setInitialItems]  = useState([emptyRow()]);

  const [scanFile,       setScanFile]       = useState(null);
  const [scanCopyUrl,    setScanCopyUrl]    = useState("");
  const [initialScanUrl, setInitialScanUrl] = useState("");
  const [scanResetKey,   setScanResetKey]   = useState(0);

  // ── Form ──────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(dlrSchema),
    defaultValues,
    mode: "onChange",
  });

  const {
    register, control, setValue, watch, getValues,
    handleSubmit, reset, formState: { errors, isSubmitting },
  } = form;

  const vendorId = watch("vendorId");

  const fieldDisabled =
    disabledProp || !isEditing || submitting || saving || isSubmitting;

  // ── Load supplier list ────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.SUPPLIER.LIST, method: "GET" })
      .then((res) => setSupplierList(Array.isArray(res?.data) ? res.data : []))
      .catch(() => toast.error("Failed to load supplier list"));
  }, []);

  // ── Load project locations once ───────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const data = Array.isArray(res?.data) ? res.data : [];
        setLocationOptions(data.filter((l) => l.locationType === "Use"));
      })
      .catch(() => setLocationOptions([]));
  }, [projectCode]);

  // ── Load vendor orders when supplier changes ───────────────────────────────
  useEffect(() => {
    if (!vendorId) {
      setVendorOrders([]);
      return;
    }
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.VENDOR_ORDERS}/${vendorId}`,
      method: "GET",
    })
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : (res?.data?.orders || []);
        setVendorOrders(list);
      })
      .catch(() => setVendorOrders([]));
  }, [vendorId]);

  // ── Load labour by supplier when supplier changes ─────────────────────────
  useEffect(() => {
    if (!vendorId) {
      setLabourList([]);
      return;
    }
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.LABOUR_BY_SUPPLIER}/${vendorId}`,
      method: "GET",
    })
      .then((res) => setLabourList(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setLabourList([]));
  }, [vendorId]);

  // ── Load DLR details (edit/view/approver) ─────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !dlrId) return;
    const fetchDLR = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.GET_BY_ID}/${dlrId}`,
          method: "GET",
        });
        const d = Array.isArray(res?.data) ? res.data[0] : res?.data;

        const formData = {
          dlrNo:      d.dlrNo      || "",
          dlrDate:    d.dlrDate    || "",
          vendorId:   d.vendorId   ? String(d.vendorId) : "",
          orderId:    d.orderId    ? String(d.orderId)  : "",
          reportBy:   d.reportBy   || "",
          verifiedBy: d.verifiedBy || "",
        };

        reset(formData);
        setInitialFormData(formData);
        setWorkflowStatus(d.workflowStatus || "");

        const mappedItems = (d.items || []).map((it) => ({
          id:             it.id,
          manId:          it.manId          || "",
          fullName:       it.fullName        || "",
          category:       it.category        || "",
          startTime:      it.startTime       || "",
          finishTime:     it.finishTime      || "",
          lunchHour:      it.lunchHour       ?? 0,
          workingHour:    it.workingHour      ?? 0,
          bonusHour:      it.bonusHour        ?? 0,
          totalWorkingHr: it.totalWorkingHr   ?? 0,
          jobLocation:    it.jobLocation      || "",
        }));
        setItems(mappedItems.length > 0 ? mappedItems : [emptyRow()]);
        setInitialItems(mappedItems.length > 0 ? mappedItems : [emptyRow()]);

        if (d.scanCopy) {
          setScanCopyUrl(d.scanCopy);
          setInitialScanUrl(d.scanCopy);
        }

        onDataLoaded?.({ workflowStatus: d.workflowStatus || "" });

        const st = (d.workflowStatus || "").toLowerCase();
        const editable = ["draft", "reback"].includes(st);
        setIsEditing(false);
        if (!editable) {
          // submitted/approved/rejected — fully locked
        }
      } catch (err) {
        toast.error(err.message || "Failed to load DLR");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDLR();
  }, [dlrId, mode, reset]);

  // ── Also handle initialData prop (passed from outside) ───────────────────
  useEffect(() => {
    if (!initialData || mode !== "create") return;
    // Nothing to pre-populate on create from outside currently
  }, [initialData, mode]);

  // ── Lazy-fetch summary once when Summary tab is first opened ──────────────
  useEffect(() => {
    if (activeTab !== "summary" || !dlrId || summaryData || summaryLoading) return;
    setSummaryLoading(true);
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.SUMMARY}/${dlrId}`,
      method: "GET",
    })
      .then((res) => {
        const raw = Array.isArray(res?.data) ? res.data[0] : res?.data;
        setSummaryData(raw || {});
      })
      .catch(() => setSummaryData({}))
      .finally(() => setSummaryLoading(false));
  }, [activeTab, dlrId, summaryData, summaryLoading]);

  // ── Build FormData ────────────────────────────────────────────────────────
  const buildFormData = () => {
    const v = getValues();
    const fd = new FormData();
    fd.append("dlrDate", v.dlrDate);
    if (projectCode)  fd.append("projectCode",  projectCode);
    if (v.vendorId)   fd.append("vendorId",   v.vendorId);
    if (v.orderId)    fd.append("orderId",    v.orderId);
    if (v.reportBy)   fd.append("reportBy",   v.reportBy);
    if (v.verifiedBy) fd.append("verifiedBy", v.verifiedBy);
    if (scanFile)     fd.append("scanCopy",   scanFile);

    // eslint-disable-next-line no-unused-vars
    const validItems = items.filter((r) => r.manId || r.id).map(({ _checked, ...rest }) => rest);
    fd.append("items", JSON.stringify(validItems));
    return fd;
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    let toastId;
    try {
      setSaving(true);
      toastId = toast.loading(mode === "create" ? "Creating DLR…" : "Updating DLR…");

      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.RESOURCE.MANPOWER.DLR.CREATE
          : `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.UPDATE}/${dlrId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildFormData(),
      });

      const saved = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (saved?.dlrNo) setValue("dlrNo", saved.dlrNo);
      if (saved?.scanCopy) {
        setScanCopyUrl(saved.scanCopy);
        setInitialScanUrl(saved.scanCopy);
        setScanFile(null);
        setScanResetKey((k) => k + 1);
      }

      setInitialFormData(getValues());
      setInitialItems([...items]);
      setIsEditing(false);
      setWorkflowStatus("Draft");
      setSummaryData(null); // invalidate so summary re-fetches after save
      toast.success(mode === "create" ? "DLR created" : "DLR updated", { id: toastId });

      if (mode === "create") {
        const newId = saved?.id || saved?.dlrId;
        if (newId) {
          setTimeout(() => {
            router.push(`/resource-management/services/manpower/dlr/${newId}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmitDLR = async () => {
    if (!dlrId) {
      toast.error("Please save as Draft first");
      return;
    }
    let toastId;
    try {
      setSubmitting(true);
      toastId = toast.loading("Submitting DLR…");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.SUBMIT}/${dlrId}`,
        method: "POST",
      });
      toast.success("DLR submitted", { id: toastId });
      setWorkflowStatus("Pending_L1");
      setIsEditing(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit / Cancel ─────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      // Cancel — restore
      if (initialFormData) reset(initialFormData);
      setItems([...initialItems]);
      setScanFile(null);
      setScanCopyUrl(initialScanUrl);
      setScanResetKey((k) => k + 1);
      setIsEditing(false);
      return;
    }
    setIsEditing(true);
  };

  const statusLower  = workflowStatus.toLowerCase();
  const isDraftOrReback = ["draft", "reback", ""].includes(statusLower);
  const isLocked     = !isDraftOrReback && workflowStatus !== "";

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      {/* Mobile toggle for left panel */}
      <div className="flex xl:hidden items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="flex items-center gap-1 text-[12px] px-3 h-[28px] rounded border bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100"
        >
          {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          {sidebarOpen ? "Hide Details" : "Show Details"}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row items-start gap-0">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="flex flex-col gap-y-4 w-full xl:w-[410px] shrink-0 xl:overflow-y-auto xl:max-h-[calc(100vh-110px)] pb-4 xl:pb-0 border-b xl:border-b-0 border-gray-200 pr-1">

            <div className="flex flex-col gap-1">
              {/* DLR No */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>DLR No</div>
                <Input
                  {...register("dlrNo")}
                  disabled
                  placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full sm:w-[220px] h-[30px]`}
                />
              </div>

              {/* Date */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>Date <span className="text-red-500">*</span></div>
                <Input
                  type="date"
                  {...register("dlrDate")}
                  disabled={fieldDisabled}
                  className={`${getInputClass(!!errors.dlrDate, fieldDisabled)} w-full sm:w-[220px] h-[30px]`}
                />
              </div>
              {errors.dlrDate && (
                <p className="text-[11px] text-red-500 sm:ml-[184px]">{errors.dlrDate.message}</p>
              )}

              {/* Supplier Name */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>Supplier Name</div>
                <div className="w-full sm:w-[220px]">
                  <Controller
                    control={control}
                    name="vendorId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={supplierList}
                        value={field.value ? String(field.value) : ""}
                        onChange={(val) => {
                          field.onChange(val ? String(val) : "");
                          setValue("orderId", "");
                          setVendorOrders([]);
                          setLabourList([]);
                          setItems([emptyRow()]);
                        }}
                        disabled={fieldDisabled}
                        placeholder="Select Supplier"
                        labelKey="supplierName"
                        valueKey="supplierId"
                        searchKeys={["supplierName", "supplierCode"]}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Order Number */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>Order Number</div>
                <div className="w-full sm:w-[220px]">
                  <Controller
                    control={control}
                    name="orderId"
                    render={({ field }) => (
                      <SearchableSelect
                        options={vendorOrders}
                        value={field.value ? String(field.value) : ""}
                        onChange={(val) => field.onChange(val ? String(val) : "")}
                        disabled={fieldDisabled || !vendorId}
                        placeholder={vendorId ? "Select Order" : "Select supplier first"}
                        labelKey="orderNo"
                        valueKey="id"
                        searchKeys={["orderNo"]}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Report By */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>Report By</div>
                <Input
                  {...register("reportBy")}
                  disabled={fieldDisabled}
                  placeholder="Name"
                  className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[220px] h-[30px]`}
                />
              </div>

              {/* Verified By */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                <div className={LABEL}>Verified By</div>
                <Input
                  {...register("verifiedBy")}
                  disabled={fieldDisabled}
                  placeholder="Name"
                  className={`${getInputClass(false, fieldDisabled)} w-full sm:w-[220px] h-[30px]`}
                />
              </div>
            </div>

            {/* ── DOCUMENT ATTACHMENT ─────────────────────────────────────── */}
            <FileUpload
              label="Scan Copy"
              onChange={(file) => setScanFile(file)}
              existingUrl={scanCopyUrl}
              onClearExisting={() => setScanCopyUrl("")}
              disabled={fieldDisabled}
              resetKey={scanResetKey}
              accept={ACCEPT_DOC}
              allowedTypes={TYPES_DOC}
            />

          </div>
        )}

        {/* ── DIVIDER + COLLAPSE BUTTON (xl only) ────────────────────────── */}
        <div className="hidden xl:flex flex-col items-center self-stretch mx-1">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Collapse details panel" : "Expand details panel"}
            className={`flex items-center justify-center w-5 h-10 rounded border transition shrink-0 my-1 ${
              sidebarOpen
                ? "bg-sky-100 border-sky-300 hover:bg-sky-200 text-sky-600"
                : "bg-[#7fc3d4] border-[#4a9fb5] hover:bg-[#6ab8cb] text-white"
            }`}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftOpen className="w-3.5 h-3.5" />
            )}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <div className="w-full flex-1 min-w-0 flex flex-col">

          {/* Tab bar */}
          <div className="flex items-end gap-1 mb-2">
            <TabButton
              label="DLR Details"
              active={activeTab === "details"}
              onClick={() => setActiveTab("details")}
            />
            <TabButton
              label="Summary"
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
            />
          </div>

          {/* Tab content */}
          {activeTab === "details" ? (
            <DLRDetailsTable
              items={items}
              onItemsChange={setItems}
              disabled={fieldDisabled}
              labourList={labourList}
              locationOptions={locationOptions}
            />
          ) : (
            <DLRSummaryTab
              items={items}
              serverData={summaryData}
              loading={summaryLoading}
            />
          )}
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────────────────── */}
      {mode !== "view" && mode !== "approver" && (
        <div className="flex flex-wrap justify-end gap-2 mt-5 pt-3 border-t border-gray-200">
          {/* Save Draft */}
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isLocked)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={saving || isSubmitting}
              disabled={saving || isSubmitting}
              requireConfirmation
              confirmationTitle="Save as Draft?"
              confirmationMessage="The DLR will be saved as a draft. You can edit and submit later."
            />
          )}

          {/* Submit */}
          {dlrId && isDraftOrReback && !isEditing && (
            <SaveButton
              onClick={handleSubmitDLR}
              loading={submitting}
              disabled={submitting || saving || isLocked}
              requireConfirmation
              confirmationTitle="Submit DLR?"
              confirmationMessage="Once submitted, this DLR will go for approval."
            >
              Submit
            </SaveButton>
          )}

          {/* Edit / Cancel */}
          {mode === "edit" && !isLocked && (
            <EditButton
              onClick={handleEdit}
              disabled={saving || submitting}
            >
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
        </div>
      )}
    </div>
  );
}
