"use client";

import { useEffect, useRef, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

import DCBasicSection from "./DCBasicSection";
import DCItemsTable from "./DCItemsTable";

// ── ZOD SCHEMA ────────────────────────────────────────────────────────────────
const dcSchema = z.object({
  dcNo:               z.string().optional(),
  challanDate:        z.string().min(1, "Challan Date is required"),
  orderType:          z.string().min(1, "Order Type is required"),
  orderId:            z.string().min(1, "Order No is required"),
  fromDisplayCode:    z.string().optional(),
  fromDisplayName:    z.string().optional(),
  shippingFromAddress:z.string().optional(),
  fromGstn:           z.string().optional(),
  toProjectCode:      z.string().optional(),
  toProjectName:      z.string().optional(),
  shippingToAddress:  z.string().optional(),
  toGstn:             z.string().optional(),
  contactPerson:      z.string().optional(),
  purposeForDelivery: z.string().optional(),
  deliveryMode:       z.string().optional(),
  vehicleNumber:      z.string().optional(),
  driverName:         z.string().optional(),
  driverContactNumber:z.string().optional(),
  ewayBillNumber:     z.string().optional(),
  ewayBillDate:       z.string().optional(),
  ewayBillExpiryDate: z.string().optional(),
});

const defaultValues = {
  dcNo:               "",
  challanDate:        "",
  orderType:          "",
  orderId:            "",
  fromDisplayCode:    "",
  fromDisplayName:    "",
  shippingFromAddress:"",
  fromGstn:           "",
  toProjectCode:      "",
  toProjectName:      "",
  shippingToAddress:  "",
  toGstn:             "",
  contactPerson:      "",
  purposeForDelivery: "",
  deliveryMode:       "",
  vehicleNumber:      "",
  driverName:         "",
  driverContactNumber:"",
  ewayBillNumber:     "",
  ewayBillDate:       "",
  ewayBillExpiryDate: "",
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function DCForm({ mode = "create", dcId, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";
  const router     = useRouter();
  const fileRef    = useRef(null);

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [allowSubmit,     setAllowSubmit]     = useState(mode === "edit");
  const [isLoading,       setIsLoading]       = useState(false);
  const [items,           setItems]           = useState([]);
  const [initialItems,    setInitialItems]    = useState([]);
  const [attachedFile,    setAttachedFile]    = useState(null);
  const [newFileName,     setNewFileName]     = useState("");
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl,  setInitialFileUrl]  = useState("");
  const [initialFormData, setInitialFormData] = useState(null);
  const [sidebarOpen,    setSidebarOpen]     = useState(true);

  // ── FORM ───────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(dcSchema),
    defaultValues,
    mode: "onChange",
  });

  const { reset, getValues, handleSubmit, formState: { isSubmitting } } = form;

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── LOAD DC DETAILS (edit / view / approver) ───────────────────────────────
  useEffect(() => {
    if (mode === "create" || !dcId) return;

    const fetchDC = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.GET_BY_ID}/${dcId}`,
        });
        const d = res.data?.[0] || res.data;

        const formData = {
          dcNo:               d.dcNo               || "",
          challanDate:        d.challanDate         || "",
          orderType:          d.orderType           || "",
          orderId:            String(d.orderId      || ""),
          fromDisplayCode:    d.fromType === "vendor" ? "Vendor" : (d.fromProjectCode || ""),
          fromDisplayName:    d.fromType === "vendor" ? (d.fromVendorName || "") : (d.fromProjectName || ""),
          shippingFromAddress:d.shippingFromAddress || "",
          fromGstn:           d.fromGstn            || "",
          toProjectCode:      d.toProjectCode       || "",
          toProjectName:      d.toProjectName       || "",
          shippingToAddress:  d.shippingToAddress   || "",
          toGstn:             d.toGstn              || "",
          contactPerson:      d.contactPerson        || "",
          purposeForDelivery: d.purposeForDelivery  || "",
          deliveryMode:       d.deliveryMode         || "",
          vehicleNumber:      d.vehicleNumber        || "",
          driverName:         d.driverName           || "",
          driverContactNumber:d.driverContactNumber  || "",
          ewayBillNumber:     d.ewayBillNumber       || "",
          ewayBillDate:       d.ewayBillDate         || "",
          ewayBillExpiryDate: d.ewayBillExpiryDate   || "",
        };

        reset(formData);
        setInitialFormData(formData);

        const mappedItems = (d.items || []).map((it) => ({
          orderItemId:  it.orderItemId,
          itemCode:     it.itemCode    || "",
          itemName:     it.itemName    || "",
          itemUnit:     it.itemUnit    || "",
          balanceQty:   it.balanceQty  ?? it.orderQty ?? 0,
          issueQty:     it.issueQty    ?? 0,
          stockLocation:it.stockLocation || "",
        }));
        setItems(mappedItems);
        setInitialItems(mappedItems);

        const furl = d.attachedDoc || "";
        setExistingFileUrl(furl);
        setInitialFileUrl(furl);

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("DC already Approved");
          else if (st === "Rejected") toast.info("DC already Rejected");
          else                         toast.info("DC already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load DC");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDC();
  }, [dcId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ORDER ITEMS CALLBACK ───────────────────────────────────────────────────
  const handleOrderItemsFetched = (data) => {
    if (!data) {
      setItems([]);
      setInitialItems([]);
      return;
    }
    const mapped = (Array.isArray(data) ? data : []).map((it) => ({
      orderItemId:  it.orderItemId,
      itemCode:     it.itemCode    || "",
      itemName:     it.itemName    || "",
      itemUnit:     it.itemUnit    || "",
      balanceQty:   it.balanceQty  ?? 0,
      issueQty:     it.issueQty    ?? it.balanceQty ?? 0,
      stockLocation:it.stockLocation || "",
    }));
    setItems(mapped);
    setInitialItems(mapped);
  };

  // ── ITEM CELL CHANGE ───────────────────────────────────────────────────────
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ── VALIDATE ITEMS ─────────────────────────────────────────────────────────
  const validateItems = () => {
    if (!items.length) {
      toast.error("Please select an Order No to load items");
      return false;
    }
    const hasQty = items.some((it) => Number(it.issueQty) > 0);
    if (!hasQty) {
      toast.error("Please enter an issue quantity for at least one item");
      return false;
    }
    const exceeded = items.some((it) => Number(it.issueQty) > Number(it.balanceQty));
    if (exceeded) {
      toast.error("One or more items exceed the available balance quantity");
      return false;
    }
    return true;
  };

  // ── BUILD FORMDATA PAYLOAD ─────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    fd.append("currentProjectCode", projectCode);
    fd.append("orderId",            v.orderId);
    fd.append("orderType",          v.orderType);
    fd.append("challanDate",        v.challanDate);
    if (v.contactPerson)       fd.append("contactPerson",       v.contactPerson);
    if (v.purposeForDelivery)  fd.append("purposeForDelivery",  v.purposeForDelivery);
    if (v.deliveryMode)        fd.append("deliveryMode",        v.deliveryMode);
    if (v.vehicleNumber)       fd.append("vehicleNumber",       v.vehicleNumber);
    if (v.driverName)          fd.append("driverName",          v.driverName);
    if (v.driverContactNumber) fd.append("driverContactNumber", v.driverContactNumber);
    if (v.ewayBillNumber)      fd.append("ewayBillNumber",      v.ewayBillNumber);
    if (v.ewayBillDate)        fd.append("ewayBillDate",        v.ewayBillDate);
    if (v.ewayBillExpiryDate)  fd.append("ewayBillExpiryDate",  v.ewayBillExpiryDate);
    if (v.shippingToAddress)   fd.append("shippingToAddress",   v.shippingToAddress);

    const itemsPayload = items
      .filter((it) => Number(it.issueQty) > 0)
      .map((it) => ({
        orderItemId:  it.orderItemId,
        itemCode:     it.itemCode,
        issueQty:     Number(it.issueQty),
        stockLocation:it.stockLocation || "",
      }));
    fd.append("items", JSON.stringify(itemsPayload));

    if (attachedFile) fd.append("attachedDoc", attachedFile);
    return fd;
  };

  // ── SAVE DRAFT ─────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!projectCode) {
      toast.error("Please select a project first");
      return;
    }
    if (!validateItems()) return;

    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating DC..." : "Updating DC...");

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.CREATE
            : `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.UPDATE}/${dcId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      if (res?.data?.dcNo || res?.data?.[0]?.dcNo) {
        form.setValue("dcNo", res.data?.dcNo || res.data?.[0]?.dcNo);
      }

      if (res?.data?.attachedDoc || res?.data?.[0]?.attachedDoc) {
        const url = res.data?.attachedDoc || res.data?.[0]?.attachedDoc;
        setExistingFileUrl(url);
        setInitialFileUrl(url);
        setAttachedFile(null);
        setNewFileName("");
        if (fileRef.current) fileRef.current.value = "";
      }

      setInitialFormData(getValues());
      setInitialItems([...items]);
      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(
        mode === "create" ? "DC created successfully" : "DC updated successfully",
        { id: toastId },
      );

      if (mode === "create") {
        const newId = res.data?.dcId || res.data?.[0]?.dcId || res.data?.id;
        if (newId) {
          setTimeout(() => {
            router.push(`/resource-management/material/logistics/delivery-challan/${newId}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save DC", { id: toastId });
    }
  };

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmitDC = async () => {
    if (!dcId) {
      toast.error("Please save as Draft first");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Submitting DC...");
      await apiRequest({
        url:    `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.SUBMIT}/${dcId}`,
        method: "POST",
      });
      toast.success("DC submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit DC", { id: toastId });
    }
  };

  // ── EDIT / CANCEL ──────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialFormData) reset(initialFormData);
      setItems([...initialItems]);
      setAttachedFile(null);
      setNewFileName("");
      setExistingFileUrl(initialFileUrl);
      if (fileRef.current) fileRef.current.value = "";
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── FILE CHANGE ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachedFile(null);
      setNewFileName("");
      return;
    }
    const allowed = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, Excel, JPG or PNG files are allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setAttachedFile(file);
    setNewFileName(file.name);
    setExistingFileUrl("");
  };

  // ── LOADING STATE ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <div className="flex flex-col xl:flex-row items-start gap-4">

        {/* LEFT PANEL */}
        {sidebarOpen && (
          <DCBasicSection
            form={form}
            disabled={disabled}
            mode={mode}
            onOrderItemsFetched={handleOrderItemsFetched}
            fileRef={fileRef}
            newFileName={newFileName}
            existingFileUrl={existingFileUrl}
            onFileChange={handleFileChange}
          />
        )}

        {/* DIVIDER + COLLAPSE BUTTON — xl only */}
        <div className="hidden xl:flex flex-col items-center self-stretch">
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
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        {/* RIGHT PANEL — items table */}
        <div className="w-full flex-1 min-w-0">
          <div className="bg-[#d8e0d1] border border-[#c7cfbf] px-3 py-1 mb-2">
            <h2 className="text-[15px] font-semibold text-[#1a3a5c]">ITEMS</h2>
          </div>

          <DCItemsTable
            items={items}
            onItemChange={handleItemChange}
            disabled={disabled}
          />
        </div>

      </div>

      {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-5 pt-3 flex-wrap">
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save as Draft?"
              confirmationMessage="The DC will be saved as a draft. You can edit and submit later."
            />
          )}

          <SaveButton
            onClick={() => handleSubmit(handleSubmitDC)()}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit DC?"
            confirmationMessage="Once submitted, this Delivery Challan will go for approval."
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
    </div>
  );
}
