"use client";

import { useEffect, useState } from "react";
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

import GRNLeftPanel from "./GRNLeftPanel";
import GRNItemsTable from "./GRNItemsTable";

// ── ZOD SCHEMA ───────────────────────────────────────────────────────────────
const grnSchema = z.object({
  grnDate: z.string().min(1, "GRN Date is required"),
  vendorId: z.string().min(1, "Party Name is required"),
  orderId: z.string().min(1, "Order No is required"),
  grnNo: z.string().optional(),
  receivedCategory: z.string().optional(),
  itemCategory: z.string().optional(),
  costHead: z.string().optional(),
  partyAddress: z.string().optional(),
  partyGstn: z.string().optional(),
  orderDate: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  challanNo: z.string().optional(),
  challanDate: z.string().optional(),
  partyBillNo: z.string().optional(),
  partyBillDate: z.string().optional(),
  deliverVehicleNo: z.string().optional(),
  deliveredConcern: z.string().optional(),
  unloadingDatetime: z.string().optional(),
  physicallyVerifiedBy: z.string().optional(),
});

const defaultValues = {
  grnNo: "",
  grnDate: "",
  vendorId: "",
  orderId: "",
  receivedCategory: "",
  itemCategory: "",
  costHead: "",
  partyAddress: "",
  partyGstn: "",
  orderDate: "",
  billingAddress: "",
  shippingAddress: "",
  challanNo: "",
  challanDate: "",
  partyBillNo: "",
  partyBillDate: "",
  deliverVehicleNo: "",
  deliveredConcern: "",
  unloadingDatetime: "",
  physicallyVerifiedBy: "",
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function GRNForm({ mode = "create", grnId, onUuid, onAfterSubmit }) {
  const isViewMode = mode === "view" || mode === "approver";
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  // ── STATE ─────────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [storeLocations, setStoreLocations] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [initialItems, setInitialItems] = useState([]);
  const [attachedFile, setAttachedFile] = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);
  const [initialFormData, setInitialFormData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── FORM ──────────────────────────────────────────────────────────────────
  const form = useForm({
    resolver: zodResolver(grnSchema),
    defaultValues,
    mode: "onChange",
  });
  const {
    reset,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── FETCH STORE LOCATIONS ──────────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setStoreLocations(data.filter((l) => l.locationType === "Store"));
      })
      .catch(() => setStoreLocations([]));
  }, [projectCode]);

  // ── LOAD GRN DETAILS (edit / view / approver) ─────────────────────────────
  useEffect(() => {
    if (mode === "create" || !grnId) return;

    const fetchGRN = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_GRN_BY_ID}/${grnId}`,
        });
        const d = res.data;

        const formData = {
          grnNo: d.grnNo || "",
          grnDate: (d.grnDate),
          vendorId: String(d.vendorId || ""),
          orderId: String(d.orderId || ""),
          receivedCategory: d.receivedCategory || "",
          itemCategory: d.itemCategory || "",
          costHead: d.costHead || "",
          partyAddress: d.partyAddress || "",
          partyGstn: d.partyGstn || "",
          orderDate: (d.orderDate),
          billingAddress: d.billingAddress || "",
          shippingAddress: d.shippingAddress || "",
          challanNo: d.challanNo || "",
          challanDate: d.challanDate || "",
          partyBillNo: d.partyBillNo || "",
          partyBillDate: (d.partyBillDate),
          deliverVehicleNo: d.deliverVehicleNo || "",
          deliveredConcern: d.deliveredConcern || "",
          unloadingDatetime: d.unloadingDatetime
            ? d.unloadingDatetime.replace(" ", "T").slice(0, 16)
            : "",
          physicallyVerifiedBy: d.physicallyVerifiedBy || "",
        };

        reset(formData);
        setInitialFormData(formData);

        // Populate items from details
        const mappedItems = (d.items || []).map((it) => ({
          orderItemId: it.orderItemId,
          grnl: it.grnl || "",
          indentNo: it.indentNo || "",
          itemCode: it.itemCode || "",
          itemName: it.itemName || "",
          itemUnit: it.itemUnit || "",
          note: it.note || "",
          orderQty: it.orderQty,
          preReceivedQty: it.preReceivedQty,
          balanceQty: it.balanceQty,
          currentReceivedQty: it.currentReceivedQty ?? 0,
          effectiveMax: Number(it.balanceQty ?? 0) + Number(it.currentReceivedQty ?? 0),
          useLocation: it.useLocation || "",
          storeLocation: it.storeLocation || "",
        }));
        setItems(mappedItems);
        setInitialItems(mappedItems);

        // File
        const furl = d.attachedDoc || "";
        setExistingFileUrl(furl);
        setInitialFileUrl(furl);

        if (d.uuid && onUuid) onUuid(d.uuid);

        // Lock state
        const editable = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if (st === "Approved") toast.info("GRN already Approved");
          else if (st === "Rejected") toast.info("GRN already Rejected");
          else toast.info("GRN already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load GRN");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGRN();
  }, [grnId, mode]);

  // ── ORDER ITEMS CALLBACK (from GRNLeftPanel when user picks an order) ──────
  const handleOrderItemsFetched = (orderData) => {
    if (!orderData) {
      setItems([]);
      setInitialItems([]);
      return;
    }
    const mapped = (orderData.items || []).map((it) => ({
      orderItemId: it.orderItemId,
      grnl: "",
      indentNo: it.indentNo || "",
      itemCode: it.itemCode || "",
      itemName: it.itemName || "",
      itemUnit: it.itemUnit || "",
      note: it.note || "",
      orderQty: it.orderQty,
      preReceivedQty: it.preReceivedQty,
      balanceQty: it.balanceQty,
      currentReceivedQty: 0,
      effectiveMax: Number(it.balanceQty ?? 0),
      useLocation:  it.useLocation  || "",
      storeLocation: it.storeLocation || "",
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
    const hasQty = items.some((it) => Number(it.currentReceivedQty) > 0);
    if (!hasQty) {
      toast.error("Please enter a received quantity for at least one item");
      return false;
    }
    const exceeded = items.some(
      (it) => Number(it.currentReceivedQty) > Number(it.effectiveMax ?? it.balanceQty),
    );
    if (exceeded) {
      toast.error("One or more items exceed the balance quantity");
      return false;
    }
    return true;
  };

  // ── BUILD FORMDATA ─────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v = getValues();
    const fd = new FormData();

    fd.append("projectCode", projectCode);
    fd.append("grnDate", v.grnDate);
    fd.append("orderId", v.orderId);
    fd.append("vendorId", v.vendorId);
    if (v.receivedCategory) fd.append("receivedCategory", v.receivedCategory);
    if (v.itemCategory) fd.append("itemCategory", v.itemCategory);
    if (v.costHead) fd.append("costHead", v.costHead);
    if (v.billingAddress) fd.append("billingAddress", v.billingAddress);
    if (v.shippingAddress) fd.append("shippingAddress", v.shippingAddress);
    if (v.challanNo) fd.append("challanNo", v.challanNo);
    if (v.challanDate) fd.append("challanDate", v.challanDate);
    if (v.partyBillNo) fd.append("partyBillNo", v.partyBillNo);
    if (v.partyBillDate) fd.append("partyBillDate", v.partyBillDate);
    if (v.deliverVehicleNo) fd.append("deliverVehicleNo", v.deliverVehicleNo);
    if (v.deliveredConcern) fd.append("deliveredConcern", v.deliveredConcern);
    if (v.unloadingDatetime)
      fd.append("unloadingDatetime", v.unloadingDatetime.replace("T", " "));
    if (v.physicallyVerifiedBy)
      fd.append("physicallyVerifiedBy", v.physicallyVerifiedBy);

    // Only items where currentReceivedQty > 0
    const itemsPayload = items
      .filter((it) => Number(it.currentReceivedQty) > 0)
      .map((it) => ({
        orderItemId: it.orderItemId,
        currentReceivedQty: Number(it.currentReceivedQty),
        useLocation: it.useLocation || "",
        storeLocation: it.storeLocation || "",
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
        mode === "create" ? "Creating GRN..." : "Updating GRN...",
      );

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.CREATE_GRN
            : `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.UPDATE_GRN_BY_ID}/${grnId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });

      if (res?.data?.grnNo) form.setValue("grnNo", res.data.grnNo);
      if (res?.data?.uuid && onUuid) onUuid(res.data.uuid);

      if (res?.data?.attachedDoc) {
        const url = res.data.attachedDoc;
        setExistingFileUrl(url);
        setInitialFileUrl(url);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }

      setInitialFormData(getValues());
      setInitialItems([...items]);
      setIsEditing(false);
      setAllowSubmit(true);

      toast.success(
        mode === "create"
          ? "GRN created successfully"
          : "GRN updated successfully",
        { id: toastId },
      );

      // After first-time create → navigate to edit page
      if (mode === "create") {
        const newId = res.data?.grnId || res.data?.id;
        if (newId) {
          setTimeout(() => {
            router.push(`/resource-management/material/grn/${newId}`);
          }, 400);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save GRN", { id: toastId });
    }
  };

  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmitGRN = async () => {
    if (!grnId) {
      toast.error("Please save as Draft first");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Submitting GRN...");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.GRN.SUBMIT_GRN_BY_ID}/${grnId}`,
        method: "POST",
      });
      toast.success("GRN submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit GRN", { id: toastId });
    }
  };

  // ── EDIT / CANCEL ──────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      // CANCEL — restore everything
      if (initialFormData) reset(initialFormData);
      setItems([...initialItems]);
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


  // ── LOADING ────────────────────────────────────────────────────────────────
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
      <div className="flex flex-col xl:flex-row items-start gap-3">
        {/* LEFT PANEL */}
        {sidebarOpen && (
          <GRNLeftPanel
            form={form}
            disabled={disabled}
            mode={mode}
            onOrderItemsFetched={handleOrderItemsFetched}
            onVendorClear={() => {
              setItems([]);
              setInitialItems([]);
            }}
            existingFileUrl={existingFileUrl}
            onFileChange={(file) => setAttachedFile(file)}
            onClearExisting={() => setExistingFileUrl("")}
            fileResetKey={fileResetKey}
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

        {/* RIGHT PANEL */}
        <div className="w-full flex-1 min-w-0 flex flex-col gap-4">
          <div>
            {/* BASIC SECTION HEADER */}
            <div className="bg-[#d8e0d1] border border-[#c7cfbf] px-3 py-1  text-[#1a3a5c] ">
              <h2
                className="text-[15px]
              font-semibold"
              >
                BASIC
              </h2>
            </div>

            {/* ITEMS TABLE */}
            <GRNItemsTable
              items={items}
              onItemChange={handleItemChange}
              disabled={disabled}
              storeLocations={storeLocations}
            />
          </div>

        </div>
        {/* end right panel */}
      </div>

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
      {!isViewMode && (
        <div className="flex justify-end gap-3 mt-5 pt-3  flex-wrap">
          {/* Save as Draft — available while editing or in create mode */}
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
              confirmationTitle="Save as Draft?"
              confirmationMessage="The GRN will be saved as a draft. You can edit and submit later."
            />
          )}

          {/* Submit — available only after draft saved, not while editing */}
          <SaveButton
            onClick={() => handleSubmit(handleSubmitGRN)()}
            loading={isSubmitting}
            disabled={
              !allowSubmit ||
              isEditing ||
              isSubmitted ||
              isSubmitting ||
              mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit GRN?"
            confirmationMessage="Once submitted, this GRN will go for approval."
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
