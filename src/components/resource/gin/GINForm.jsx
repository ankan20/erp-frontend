"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveButton from "@/components/common/SaveButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton from "@/components/common/EditButton";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

import GINLeftPanel from "./GINLeftPanel";
import GINItemsTable from "./GINItemsTable";

// ── ZOD SCHEMA ────────────────────────────────────────────────────────────────
const ginSchema = z.object({
  ginDate:          z.string().min(1, "GIN Date is required"),
  vendorId:         z.string().min(1, "Party Name is required"),
  orderId:          z.string().min(1, "Order No is required"),
  ginNo:            z.string().optional(),
  issueCategory:    z.string().optional(),
  itemCategory:     z.string().optional(),
  costHead:         z.string().optional(),
  costFactor:       z.string().optional(),
  partyAddress:     z.string().optional(),
  partyGstn:        z.string().optional(),
  orderDate:        z.string().optional(),
  despatchFrom:     z.string().optional(),
  shippingTo:       z.string().optional(),
  recommendationBy: z.string().optional(),
  issueSlipNo:      z.string().optional(),
  handedOverTo:     z.string().optional(),
});

const defaultValues = {
  ginNo:            "",
  ginDate:          "",
  vendorId:         "",
  orderId:          "",
  issueCategory:    "",
  itemCategory:     "",
  costHead:         "",
  costFactor:       "",
  partyAddress:     "",
  partyGstn:        "",
  orderDate:        "",
  despatchFrom:     "",
  shippingTo:       "",
  recommendationBy: "",
  issueSlipNo:      "",
  handedOverTo:     "",
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function GINForm({ mode = "create", ginId }) {
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

  // ── FORM ───────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(ginSchema),
    defaultValues,
    mode: "onChange",
  });

  const { reset, getValues, handleSubmit, formState: { isSubmitting } } = form;

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── LOAD GIN DETAILS (edit / view / approver) ──────────────────────────────
  useEffect(() => {
    if (mode === "create" || !ginId) return;

    const fetchGIN = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_GIN_BY_ID}/${ginId}`,
        });
        const d = res.data;

        const formData = {
          ginNo:            d.ginNo            || "",
          ginDate:          d.ginDate          || "",
          vendorId:         String(d.vendorId  || ""),
          orderId:          String(d.orderId   || ""),
          issueCategory:    d.issueCategory    || "",
          itemCategory:     d.itemCategory     || "",
          costHead:         d.costHead         || "",
          costFactor:       d.costFactor       || "",
          partyAddress:     d.partyAddress     || "",
          partyGstn:        d.partyGstn        || "",
          orderDate:        d.orderDate        || "",
          despatchFrom:     d.despatchFrom     || "",
          shippingTo:       d.shippingTo       || "",
          recommendationBy: d.recommendationBy || "",
          issueSlipNo:      d.issueSlipNo      || "",
          handedOverTo:     d.handedOverTo     || "",
        };

        reset(formData);
        setInitialFormData(formData);

        // Populate items from details
        const mappedItems = (d.items || []).map((it) => ({
          orderItemId:      it.orderItemId,
          ginl:             it.ginl          || "",
          itemCode:         it.itemCode      || "",
          itemName:         it.itemName      || "",
          itemUnit:         it.itemUnit      || "",
          stockQty:         it.stockQty      ?? 0,
          issueQty:         it.issueQty      ?? 0,
          stockLocation:    it.stockLocation    || "",
          itemUsedLocation: it.itemUsedLocation || "",
        }));
        setItems(mappedItems);
        setInitialItems(mappedItems);

        // File
        const furl = d.attachedDoc || "";
        setExistingFileUrl(furl);
        setInitialFileUrl(furl);

        // Lock state based on workflowStatus
        const editable = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("GIN already Approved");
          else if (st === "Rejected") toast.info("GIN already Rejected");
          else                         toast.info("GIN already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load GIN");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGIN();
  }, [ginId, mode]);

  // ── ORDER ITEMS CALLBACK (from GINLeftPanel) ───────────────────────────────
  const handleOrderItemsFetched = (orderData) => {
    if (!orderData) {
      setItems([]);
      setInitialItems([]);
      return;
    }
    const mapped = (orderData.items || []).map((it) => ({
      orderItemId:      it.orderItemId,
      ginl:             "",
      itemCode:         it.itemCode   || "",
      itemName:         it.itemName   || "",
      itemUnit:         it.itemUnit   || "",
      stockQty:         it.stockQty   ?? 0,
      issueQty:         0,
      stockLocation:    "",
      itemUsedLocation: "",
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
    const exceeded = items.some(
      (it) => Number(it.issueQty) > Number(it.stockQty),
    );
    if (exceeded) {
      toast.error("One or more items exceed the available stock quantity");
      return false;
    }
    return true;
  };

  // ── BUILD FORMDATA PAYLOAD ─────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    fd.append("projectCode", projectCode);
    fd.append("ginDate",     v.ginDate);
    fd.append("orderId",     v.orderId);
    fd.append("vendorId",    v.vendorId);
    if (v.issueCategory)    fd.append("issueCategory",    v.issueCategory);
    if (v.itemCategory)     fd.append("itemCategory",     v.itemCategory);
    if (v.costHead)         fd.append("costHead",         v.costHead);
    if (v.costFactor)       fd.append("costFactor",       v.costFactor);
    if (v.despatchFrom)     fd.append("despatchFrom",     v.despatchFrom);
    if (v.shippingTo)       fd.append("shippingTo",       v.shippingTo);
    if (v.recommendationBy) fd.append("recommendationBy", v.recommendationBy);
    if (v.issueSlipNo)      fd.append("issueSlipNo",      v.issueSlipNo);
    if (v.handedOverTo)     fd.append("handedOverTo",     v.handedOverTo);

    // Only items where issueQty > 0
    const itemsPayload = items
      .filter((it) => Number(it.issueQty) > 0)
      .map((it) => ({
        orderItemId:      it.orderItemId,
        issueQty:         Number(it.issueQty),
        stockLocation:    it.stockLocation    || "",
        itemUsedLocation: it.itemUsedLocation || "",
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
    if (mode === "create" && !attachedFile) {
      toast.error("Please attach the document before saving");
      return;
    }

    let toastId;
    try {
      toastId = toast.loading(
        mode === "create" ? "Creating GIN..." : "Updating GIN...",
      );

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.CREATE_GIN
            : `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.UPDATE_GIN_BY_ID}/${ginId}`,
        method: mode === "create" ? "POST" : "PUT",
        data:   buildPayload(),
      });

      if (res?.data?.ginNo) form.setValue("ginNo", res.data.ginNo);

      if (res?.data?.attachedDoc) {
        const url = res.data.attachedDoc;
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
        mode === "create" ? "GIN created successfully" : "GIN updated successfully",
        { id: toastId },
      );

      // First-time create → navigate to edit/detail page
      if (mode === "create") {
        const newId = res.data?.ginId || res.data?.id;
        if (newId) {
          setTimeout(() => {
            router.push(`/resource-management/material/gin/${newId}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save GIN", { id: toastId });
    }
  };

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmitGIN = async () => {
    if (!ginId) {
      toast.error("Please save as Draft first");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Submitting GIN...");
      await apiRequest({
        url:    `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GIN.SUBMIT_GIN_BY_ID}/${ginId}`,
        method: "POST",
      });
      toast.success("GIN submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
    } catch (err) {
      toast.error(err.message || "Failed to submit GIN", { id: toastId });
    }
  };

  // ── EDIT / CANCEL ──────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      // CANCEL — restore everything to last-saved state
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
      {/* ── MAIN BODY: LEFT + RIGHT ──────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row items-start gap-4">

        {/* LEFT PANEL */}
        <GINLeftPanel
          form={form}
          disabled={disabled}
          mode={mode}
          onOrderItemsFetched={handleOrderItemsFetched}
          onVendorClear={() => {
            setItems([]);
            setInitialItems([]);
          }}
          fileRef={fileRef}
          newFileName={newFileName}
          existingFileUrl={existingFileUrl}
          onFileChange={handleFileChange}
        />

        {/* VERTICAL DIVIDER (desktop only) */}
        <div className="hidden xl:block w-px self-stretch bg-sky-300" />

        {/* RIGHT PANEL — items table */}
        <div className="w-full flex-1 min-w-0">
          {/* BASIC SECTION HEADER */}
          <div className="bg-[#d8e0d1] border border-[#c7cfbf] px-3 py-1">
            <h2 className="text-[15px] font-semibold text-[#1a3a5c]">BASIC</h2>
          </div>

          <GINItemsTable
            items={items}
            onItemChange={handleItemChange}
            disabled={disabled}
          />
        </div>

      </div>

      {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-5 pt-3 flex-wrap">
          {/* Save as Draft — while actively editing */}
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save as Draft?"
              confirmationMessage="The GIN will be saved as a draft. You can edit and submit later."
            />
          )}

          {/* Submit — only after draft saved, not while editing */}
          <SaveButton
            onClick={() => handleSubmit(handleSubmitGIN)()}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit GIN?"
            confirmationMessage="Once submitted, this GIN will go for approval."
          >
            Submit
          </SaveButton>

          {/* Edit / Cancel — only in edit mode */}
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
