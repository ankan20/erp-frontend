"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass, labelClass as baseLabelClass } from "@/lib/formStyles";
import { getLocalStorage } from "@/lib/localStorage";

const BP = API_ENDPOINTS.RESOURCE.BATCHING_PLANT;

const schema = z.object({
  productionDate:      z.string().optional(),
  materialType:        z.string().optional(),
  grade:               z.string().optional(),
  unitOfConcrete:      z.string().optional(),
  volumeOfConcrete:    z.string().optional(),
  weightOfConcrete:    z.string().optional(),
  productionUnitName:  z.string().optional(),
  operatorName:        z.string().optional(),
  productionCompleted: z.string().optional(),
  batchSlipNo:         z.string().optional(),
  vehicleNumber:       z.string().optional(),
  driverName:          z.string().optional(),
  loadingFinishTime:   z.string().optional(),
  pouringStartTime:    z.string().optional(),
  completionTime:      z.string().optional(),
  requisitionBy:       z.string().optional(),
  requisitionDate:     z.string().optional(),
  requisitionTime:     z.string().optional(),
});

const defaultValues = {
  productionDate: "", materialType: "", grade: "", unitOfConcrete: "",
  volumeOfConcrete: "", weightOfConcrete: "", productionUnitName: "",
  operatorName: "", productionCompleted: "", batchSlipNo: "",
  vehicleNumber: "", driverName: "", loadingFinishTime: "",
  pouringStartTime: "", completionTime: "", requisitionBy: "",
  requisitionDate: "", requisitionTime: "",
};

const LBL = `${baseLabelClass} shrink-0 w-[170px] min-w-[170px]`;

function FieldRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className={LBL}>{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="text-[13px] font-semibold text-[#2e5a7a] border-b border-[#b8c7da] pb-0.5 mb-2">
      {children}
    </div>
  );
}

export default function BatchingPlantForm({ mode = "create", docketId, onAfterSubmit }) {
  const router  = useRouter();
  const isCreate = mode === "create";

  const [loading,      setLoading]      = useState(!isCreate);
  const [isEditing,    setIsEditing]    = useState(isCreate);
  const [isSubmitted,  setIsSubmitted]  = useState(false);
  const [allowSubmit,  setAllowSubmit]  = useState(!isCreate);
  const [initialData,  setInitialData]  = useState(null);
  const [despatchNo,   setDespatchNo]   = useState("");
  const [pwOrders,     setPwOrders]     = useState([]);
  const [pwOrderId,    setPwOrderId]    = useState("");
  const [vendorId,     setVendorId]     = useState(null);
  const [vendorName,   setVendorName]   = useState("");

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const disabled = mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;

  // Fetch approved PW orders
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${BP.APPROVED_PW_ORDERS}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setPwOrders(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, [projectCode]);

  // Load data on edit/view
  useEffect(() => {
    if (isCreate || !docketId) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({ url: `${BP.DETAILS}/${docketId}`, method: "GET" });
        const d = res.data;
        setDespatchNo(d.despatchNo || "");
        setPwOrderId(d.pwOrderId ? String(d.pwOrderId) : "");
        setVendorId(d.vendorId || null);
        setVendorName(d.vendorName || "");

        const fd = {
          productionDate:      d.productionDate      || "",
          materialType:        d.materialType        || "",
          grade:               d.grade               || "",
          unitOfConcrete:      d.unitOfConcrete      || "",
          volumeOfConcrete:    d.volumeOfConcrete    != null ? String(d.volumeOfConcrete)    : "",
          weightOfConcrete:    d.weightOfConcrete    != null ? String(d.weightOfConcrete)    : "",
          productionUnitName:  d.productionUnitName  || "",
          operatorName:        d.operatorName        || "",
          productionCompleted: d.productionCompleted || "",
          batchSlipNo:         d.batchSlipNo         || "",
          vehicleNumber:       d.vehicleNumber       || "",
          driverName:          d.driverName          || "",
          loadingFinishTime:   d.loadingFinishTime   || "",
          pouringStartTime:    d.pouringStartTime    || "",
          completionTime:      d.completionTime      || "",
          requisitionBy:       d.requisitionBy       || "",
          requisitionDate:     d.requisitionDate     || "",
          requisitionTime:     d.requisitionTime     || "",
        };
        reset(fd);
        setInitialData({ form: fd, pwOrderId: d.pwOrderId ? String(d.pwOrderId) : "", vendorId: d.vendorId, vendorName: d.vendorName || "" });

        const st = (d.workflowStatus || "").toLowerCase();
        if (!["draft", "reback"].includes(st)) {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load docket");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [docketId, isCreate, reset]);

  const buildPayload = () => {
    const v = getValues();
    const payload = { projectCode };
    Object.entries(v).forEach(([k, val]) => {
      if (val !== "") payload[k] = val;
    });
    if (pwOrderId) payload.pwOrderId = Number(pwOrderId);
    if (vendorId)  payload.vendorId  = vendorId;
    return payload;
  };

  const handleSaveDraft = async () => {
    let tid;
    try {
      tid = toast.loading(isCreate ? "Creating docket…" : "Updating docket…");
      const res = await apiRequest({
        url:    isCreate ? BP.CREATE : `${BP.EDIT}/${docketId}`,
        method: isCreate ? "POST"    : "PUT",
        data:   buildPayload(),
      });
      if (res?.data?.despatchNo) setDespatchNo(res.data.despatchNo);
      setInitialData({ form: getValues(), pwOrderId, vendorId, vendorName });
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved", { id: tid });
      if (isCreate && res.data?.id) {
        router.push(`/resource-management/services/plant-machinery/batching-plant/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err?.message || "Save failed", { id: tid });
    }
  };

  const handleSubmitDocket = async () => {
    let tid;
    try {
      tid = toast.loading("Submitting docket…");
      await apiRequest({ url: `${BP.SUBMIT}/${docketId}`, method: "POST" });
      toast.success("Docket submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Submit failed", { id: tid });
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      if (initialData) {
        reset(initialData.form);
        setPwOrderId(initialData.pwOrderId);
        setVendorId(initialData.vendorId);
        setVendorName(initialData.vendorName);
      }
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  const handleOrderChange = async (val, item) => {
    setPwOrderId(String(val));
    if (item?.vendorId) {
      setVendorId(item.vendorId);
      setVendorName(item.vendorName || "");
    } else if (val) {
      try {
        const res = await apiRequest({ url: `${BP.VENDOR_FROM_ORDER}/${val}`, method: "GET" });
        const v = res?.data?.vendor;
        if (v) { setVendorId(v.vendorId); setVendorName(v.ledgerName || ""); }
      } catch {}
    } else {
      setVendorId(null);
      setVendorName("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">

          {/* Docket */}
          <div>
            <SectionTitle>Docket:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Despatch No">
                <Input value={despatchNo || "[Auto]"} disabled className={getInputClass(false, true)} />
              </FieldRow>
              <FieldRow label="Production Date">
                <Input type="date" {...register("productionDate")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
            </div>
          </div>

          {/* Materials Details */}
          <div>
            <SectionTitle>Materials Details:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Type">
                <Input {...register("materialType")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Grade">
                <Input {...register("grade")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Unit of Concrete">
                <Input {...register("unitOfConcrete")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Volume of Concrete">
                <Input type="number" step="0.01" {...register("volumeOfConcrete")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Weight of Concrete">
                <Input type="number" step="0.01" {...register("weightOfConcrete")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
            </div>
          </div>

          {/* Requirement Details */}
          <div>
            <SectionTitle>Requirement Details:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Requisition By">
                <Input {...register("requisitionBy")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Date">
                <Input type="date" {...register("requisitionDate")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Time">
                <Input type="time" {...register("requisitionTime")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Supplier Details */}
          <div>
            <SectionTitle>Supplier Details:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Order Number">
                <SearchableSelect
                  options={pwOrders}
                  value={pwOrderId}
                  onChange={handleOrderChange}
                  disabled={disabled}
                  placeholder="Search order…"
                  labelKey="orderNo"
                  valueKey="pwOrderId"
                  searchKeys={["orderNo", "vendorName"]}
                />
              </FieldRow>
              <FieldRow label="Supplier Name">
                <Input value={vendorName} disabled placeholder="[Auto]"
                  className={getInputClass(false, true)} />
              </FieldRow>
            </div>
          </div>

          {/* Production Details */}
          <div>
            <SectionTitle>Production Details:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Production Unit Name">
                <Input {...register("productionUnitName")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Operator Name">
                <Input {...register("operatorName")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Production Completed">
                <Input {...register("productionCompleted")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Batch Slip No">
                <Input {...register("batchSlipNo")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
            </div>
          </div>

          {/* Transit Details */}
          <div>
            <SectionTitle>Transit Details:</SectionTitle>
            <div className="space-y-1.5">
              <FieldRow label="Vehicle Number">
                <Input {...register("vehicleNumber")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Driver Name">
                <Input {...register("driverName")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Loading Finish Time">
                <Input type="time" {...register("loadingFinishTime")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Pouring Start Time">
                <Input type="time" {...register("pouringStartTime")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
              <FieldRow label="Completion Time">
                <Input type="time" {...register("completionTime")} disabled={disabled}
                  className={getInputClass(false, disabled)} />
              </FieldRow>
            </div>
          </div>

        </div>
      </div>

      {/* ── Action Buttons ── */}
      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-[#dce7f0]">
          {(isCreate || (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          {!isCreate && (
            <SaveButton
              onClick={() => handleSubmit(handleSubmitDocket)()}
              loading={isSubmitting}
              disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting}
              requireConfirmation
              confirmationTitle="Submit Docket?"
              confirmationMessage="Once submitted, this docket will go for approval."
            >
              Submit
            </SaveButton>
          )}
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
        </div>
      )}
    </div>
  );
}
