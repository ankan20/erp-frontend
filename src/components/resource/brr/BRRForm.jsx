"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Controller } from "react-hook-form";
import { Loader2 } from "lucide-react";
import FileUpload, { ACCEPT_DOC, TYPES_DOC } from "@/components/common/FileUpload";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass, labelClass } from "@/lib/formStyles";
import { useRouter } from "next/navigation";

// All order sub-categories from terms config
const ORDER_CATEGORIES = [
  { label: "Purchases Order",        value: "Purchases_Order" },
  // { label: "Service Order",          value: "Service_Order" },
  { label: "Work Order",             value: "Work_Order" },
  { label: "Customer Supply Order",  value: "Customer_Supply_Order" },
  { label: "Site Transfer Order",    value: "Site_Transfer_Order" },
  { label: "Hire Order",             value: "Hire_Order" },
  { label: "Job Contract Order",     value: "Job_Contract_Order" },
];

const brrSchema = z.object({
  vendorId:          z.string().min(1, "Required"),
  partyAddress:      z.string().optional(),
  gstn:              z.string().optional(),
  orderCategory:     z.string().optional(),
  orderId:           z.string().optional(),
  orderDate:         z.string().optional(),
  partyBillNo:       z.string().min(1, "Required"),
  partyDate:         z.string().min(1, "Required"),
  receivedCategory:  z.string().optional(),
  submittedByName:   z.string().optional(),
  submissionDate:    z.string().optional(),
  receivedThrough:   z.string().optional(),
  receivedReference: z.string().optional(),
  basicAmount:       z.number({ invalid_type_error: "Required" }).min(0),
  gstAmount:         z.number({ invalid_type_error: "Required" }).min(0),
  totalAmount:       z.number().optional(),
  brrNo:             z.string().optional(),
  brrDate:           z.string().optional(),
});

const defaultValues = {
  vendorId:          "",
  partyAddress:      "",
  gstn:              "",
  orderCategory:     "",
  orderId:           "",
  orderDate:         "",
  partyBillNo:       "",
  partyDate:         "",
  receivedCategory:  "",
  submittedByName:   "",
  submissionDate:    "",
  receivedThrough:   "",
  receivedReference: "",
  basicAmount:       0,
  gstAmount:         0,
  totalAmount:       0,
  brrNo:             "",
  brrDate:           "",
};

/* ─── Field row helper ─────────────────────────────────────── */
function FieldRow({ label, children, required }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-h-[34px]">
      <div className={`${labelClass} w-full sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* ─── BRRForm ──────────────────────────────────────────────── */
export default function BRRForm({ mode = "create", brrId, onDataLoaded, onAfterSubmit }) {
  const [loading, setLoading]       = useState(false);
  const [isEditing, setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);

  const [ledgerList, setLedgerList]     = useState([]);
  const [vendorOrders, setVendorOrders] = useState([]);
  const [orderMaxTotal, setOrderMaxTotal] = useState(null);

  const [attachedFile, setAttachedFile] = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);

  const router = useRouter();
  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({
    resolver: zodResolver(brrSchema),
    defaultValues,
    mode: "onChange",
  });

  const { register, control, setValue, watch, getValues, handleSubmit, reset,
    formState: { errors, isSubmitting } } = form;

  const disabled =
    mode === "view" ||
    mode === "approver" ||
    !isEditing ||
    isSubmitted ||
    isSubmitting;

  const vendorId      = watch("vendorId");
  const orderCategory = watch("orderCategory");
  const basicAmount   = watch("basicAmount");
  const gstAmount     = watch("gstAmount");

  // Auto-total
  useEffect(() => {
    const basic = Number(basicAmount) || 0;
    const gst   = Number(gstAmount)   || 0;
    setValue("totalAmount", basic + gst);
  }, [basicAmount, gstAmount, setValue]);

  // Load ledgers
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => setLedgerList(res.data || []))
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // Load vendor orders when vendor + category change
  useEffect(() => {
    if (!vendorId || !projectCode) {
      setTimeout(() => setVendorOrders([]), 0);
      return;
    }
    const params = new URLSearchParams({ vendorId, projectCode });
    if (orderCategory) params.set("orderCategory", orderCategory);
    apiRequest({
      url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.GET_VENDOR_ORDERS}?${params}`,
      method: "GET",
    })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.orders || []);
        setVendorOrders(list);
      })
      .catch(() => toast.error("Failed to load orders"));
  }, [vendorId, orderCategory, projectCode]);

  // Sync orderMaxTotal when vendor orders load in edit mode (order already selected)
  useEffect(() => {
    if (vendorOrders.length === 0) return;
    const currentOrderId = getValues("orderId");
    if (!currentOrderId) return;
    const order = vendorOrders.find((o) => String(o.orderId ?? o.id) === String(currentOrderId));
    setOrderMaxTotal(order ? Number(order.totalAmount) : null);
  }, [vendorOrders]);

  // Load BRR in edit/view/approver mode
  useEffect(() => {
    if (mode === "create" || !brrId) return;
    const fetchBRR = async () => {
      setLoading(true);
      try {
        const res = await apiRequest({ url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.DETAILS}/${brrId}`, method: "GET" });
        const d = res.data;
        const data = {
          vendorId:          String(d.vendorId || ""),
          partyAddress:      d.partyAddress      || "",
          gstn:              d.partyGstn || d.gstn || "",
          orderCategory:     d.orderCategory     || "",
          orderId:           d.orderId ? String(d.orderId) : "",
          orderDate:         d.orderDate         || "",
          partyBillNo:       d.partyBillNo        || "",
          partyDate:         d.partyDate          || "",
          receivedCategory:  d.receivedCategory   || "",
          submittedByName:   d.submittedByName    || "",
          submissionDate:    d.submissionDate     || "",
          receivedThrough:   d.receivedThrough    || "",
          receivedReference: d.receivedReference  || "",
          basicAmount:       Number(d.basicAmount  || 0),
          gstAmount:         Number(d.gstAmount    || 0),
          totalAmount:       Number(d.totalAmount  || 0),
          brrNo:             d.brrNo              || "",
          brrDate:           d.brrDate            || "",
        };
        reset(data);
        setInitialData(data);
        onDataLoaded?.({ workflowStatus: d.workflowStatus || "", orderCategory: d.orderCategory || "" });
        if (d.attachedDoc) {
          setExistingFileUrl(d.attachedDoc);
          setInitialFileUrl(d.attachedDoc);
        }
        const st = (d.workflowStatus || "").toLowerCase();
        if (["draft", "reback"].includes(st)) {
          setIsEditing(false);
          setAllowSubmit(true);
        } else {
          setIsSubmitted(true);
          setIsEditing(false);
          setAllowSubmit(false);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load BRR");
      } finally {
        setLoading(false);
      }
    };
    fetchBRR();
  }, [brrId, mode, reset]);

  // Build FormData payload
  const buildFormData = () => {
    const v = getValues();
    const fd = new FormData();
    fd.append("projectCode",       projectCode);
    fd.append("vendorId",          v.vendorId);
    if (v.orderCategory)     fd.append("orderCategory",     v.orderCategory);
    if (v.orderId)           fd.append("orderId",           v.orderId);
    fd.append("partyBillNo",       v.partyBillNo);
    fd.append("partyDate",         v.partyDate);
    if (v.receivedCategory)  fd.append("receivedCategory",  v.receivedCategory);
    if (v.submittedByName)   fd.append("submittedByName",   v.submittedByName);
    if (v.submissionDate)    fd.append("submissionDate",    v.submissionDate);
    if (v.receivedThrough)   fd.append("receivedThrough",   v.receivedThrough);
    if (v.receivedReference) fd.append("receivedReference", v.receivedReference);
    fd.append("basicAmount",       String(v.basicAmount || 0));
    fd.append("gstAmount",         String(v.gstAmount   || 0));
    if (attachedFile) fd.append("attachedDoc", attachedFile);
    return fd;
  };

  // Save draft
  const handleSaveDraft = async () => {
    if (totalExceedsOrder) {
      const fmt = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      toast.error(
        `BRR total ₹${fmt(totalAmount)} exceeds order total ₹${fmt(orderMaxTotal)}. Please reduce the amounts.`
      );
      return;
    }
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating BRR…" : "Updating BRR…");
      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.CREATE
          : `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.EDIT}/${brrId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildFormData(),
      });
      if (res?.data?.brrNo) setValue("brrNo", res.data.brrNo);
      setInitialData(getValues());
      if (res?.data?.attachedDoc) {
        setExistingFileUrl(res.data.attachedDoc);
        setInitialFileUrl(res.data.attachedDoc);
      }
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved", { id: toastId });
      if (mode === "create" && res.data?.brrId) {
        setTimeout(() => {
          router.push(`/resource-management/sub-contractor-billing/bill-receive-register/${res.data.brrId}`);
        }, 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    }
  };

  // Submit
  const onSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Submitting BRR…");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.SUBMIT}/${brrId}`,
        method: "POST",
      });
      toast.success("BRR submitted", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    }
  };

  // Edit / cancel
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setAttachedFile(null);
      setExistingFileUrl(initialFileUrl);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const totalAmount = (Number(basicAmount) || 0) + (Number(gstAmount) || 0);
  const totalExceedsOrder = orderMaxTotal !== null && totalAmount > orderMaxTotal;

  return (
    <>
      <div className="p-3">
        {/* Two-column form grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-[3px]">

            {/* BRR info */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="e-Bill No">
                <Input {...register("brrNo")} disabled placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="e-Bill Date">
                <Input {...register("brrDate")} disabled placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
            </div>

            {/* Party info */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Party Name" required>
                <Controller control={control} name="vendorId" render={({ field }) => (
                  <SearchableSelect
                    options={ledgerList}
                    value={field.value ? String(field.value) : ""}
                    onChange={(val) => {
                      field.onChange(val ? String(val) : "");
                      setValue("orderId", "");
                      setValue("orderDate", "");
                      setVendorOrders([]);
                      if (!val) { setValue("partyAddress", ""); setValue("gstn", ""); return; }
                      const vendor = ledgerList.find((v) => String(v.ledgerId) === String(val));
                      if (!vendor) return;
                      setValue("partyAddress", vendor.registeredAddress || vendor.corporateAddress || "");
                      setValue("gstn", vendor.gstin || "");
                    }}
                    disabled={disabled}
                    placeholder="Select from Vendor List"
                    labelKey="ledgerName"
                    valueKey="ledgerId"
                    searchKeys={["ledgerName"]}
                    className={errors.vendorId ? "border-red-500" : ""}
                  />
                )} />
              </FieldRow>
              <FieldRow label="Party Address">
                <Controller control={control} name="partyAddress" render={({ field }) => (
                  <ExpandableTextField
                    value={field.value}
                    onChange={field.onChange}
                    disabled
                    title="Party Address"
                    placeholder="[Auto]"
                    minHeight="min-h-[34px]"
                    modalHeight="min-h-[180px]"
                  />
                )} />
              </FieldRow>
              <FieldRow label="Party GSTN">
                <Input {...register("gstn")} disabled placeholder="[Auto]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
            </div>

            {/* Received info */}
            <div className="flex flex-col gap-[2px]">
              <FieldRow label="Received Category">
                <Input {...register("receivedCategory")} disabled={disabled}
                  className={`${getInputClass(errors.receivedCategory, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Submitted By">
                <Input {...register("submittedByName")} disabled={disabled}
                  className={`${getInputClass(false, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Submission Date">
                <Input type="date" {...register("submissionDate")} disabled={disabled}
                  className={`${getInputClass(false, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Received Through">
                <Input {...register("receivedThrough")} disabled={disabled}
                  className={`${getInputClass(false, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Received Reference">
                <Input {...register("receivedReference")} disabled={disabled}
                  className={`${getInputClass(false, disabled)} w-full h-[34px]`} />
              </FieldRow>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-[3px]">

            {/* Order info */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Order Category">
                <Controller control={control} name="orderCategory" render={({ field }) => (
                  <Select value={field.value} onValueChange={(val) => {
                    field.onChange(val);
                    setValue("orderId", "");
                    setValue("orderDate", "");
                    setVendorOrders([]);
                  }} disabled={disabled}>
                    <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[36px]`}>
                      <SelectValue placeholder="All Order Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FieldRow>
              <FieldRow label="Order No">
                <Controller control={control} name="orderId" render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(val) => {
                      field.onChange(val);
                      const order = vendorOrders.find((o) => String(o.orderId ?? o.id) === String(val));
                      setValue("orderDate", order?.orderDate || "");
                      setOrderMaxTotal(order ? Number(order.totalAmount) : null);
                    }}
                    disabled={disabled || !vendorId}
                  >
                    <SelectTrigger className={`${getInputClass(false, disabled)} w-full h-[36px]`}>
                      <SelectValue placeholder="Select from Filter Order List" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorOrders.map((o) => {
                        const id = o.orderId ?? o.id;
                        return <SelectItem key={id} value={String(id)}>{o.orderNo}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                )} />
              </FieldRow>
              <FieldRow label="Order Date">
                <Input {...register("orderDate")} disabled placeholder="[Date]"
                  className={`${getInputClass(false, true)} w-full h-[34px]`} />
              </FieldRow>
            </div>

            {/* Party bill */}
            <div className="flex flex-col gap-[2px] mb-3">
              <FieldRow label="Party Bill No" required>
                <Input {...register("partyBillNo")} disabled={disabled}
                  className={`${getInputClass(errors.partyBillNo, disabled)} w-full h-[34px]`} />
              </FieldRow>
              <FieldRow label="Party Date" required>
                <Input type="date" {...register("partyDate")} disabled={disabled}
                  className={`${getInputClass(errors.partyDate, disabled)} w-full h-[34px]`} />
              </FieldRow>
            </div>

            {/* Amounts */}
            <div className="flex flex-col gap-[2px] mb-4">
              <FieldRow label="Basic Amount" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("basicAmount", { valueAsNumber: true })}
                  disabled={disabled}
                  className={`${getInputClass(errors.basicAmount, disabled)} w-full h-[34px]`}
                />
              </FieldRow>
              <FieldRow label="GST Amount" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("gstAmount", { valueAsNumber: true })}
                  disabled={disabled}
                  className={`${getInputClass(errors.gstAmount, disabled)} w-full h-[34px]`}
                />
              </FieldRow>
              <FieldRow label="Total Amount">
                <div>
                  <Input
                    value={totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    disabled
                    className={`${getInputClass(false, true)} w-full h-[34px] ${totalExceedsOrder ? "bg-red-50 border-red-400" : "bg-orange-50"}`}
                  />
                </div>
              </FieldRow>
            </div>

            {/* Attachment */}
            <FileUpload
              label="Attached Doc"
              onChange={(file) => setAttachedFile(file)}
              existingUrl={existingFileUrl}
              onClearExisting={() => setExistingFileUrl("")}
              disabled={disabled}
              resetKey={fileResetKey}
              accept={ACCEPT_DOC}
              allowedTypes={TYPES_DOC}
              showImagePreview
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-4 px-3 pb-3">
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          <SaveButton
            onClick={() => handleSubmit(onSubmit)()}
            loading={isSubmitting}
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting}
            requireConfirmation
            confirmationTitle="Submit BRR?"
            confirmationMessage="Once submitted, this BRR will go for approval."
          >
            Submit
          </SaveButton>
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
        </div>
      )}
    </>
  );
}
