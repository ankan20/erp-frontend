"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PanelLeftClose, PanelLeftOpen, Package, Route } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import SaveButton        from "@/components/common/SaveButton";
import SaveDraftButton   from "@/components/common/SaveDraftButton";
import EditButton        from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";

import TRBasicSection from "./TRBasicSection";
import TRRouteSection from "./TRRouteSection";
import TRItemsTable   from "./TRItemsTable";

const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

// Only truly-required fields are in the schema. Everything else is optional
// so the user isn't yelled at before they've even filled in the basics.
const trSchema = z.object({
  requestDate:         zodDate(z, "Request Date", true),
  orderType:           z.string().min(1, "Order Type is required"),
  transferType:        z.string().optional(),
  orderId:             z.string().optional(),
  sourceLocation:      z.string().min(1, "Source Location is required"),
  destinationLocation: z.string().min(1, "Destination is required"),
  priority:            z.string().optional(),
  modeOfTransport:     z.string().optional(),
  preferredCarrierId:  z.string().optional(),
  estimatedFreight:    z.string().optional(),
  requiredDeliveryDate:zodDate(z, "Required Delivery Date"),
  purpose:             z.string().optional(),
  remarks:             z.string().optional(),
});

const defaultValues = {
  trNo:                "",
  requestDate:         "",
  orderType:           "",
  transferType:        "",
  orderId:             "",
  sourceLocation:      "",
  destinationLocation: "",
  priority:            "Medium",
  modeOfTransport:     "Road",
  preferredCarrierId:  "",
  estimatedFreight:    "",
  requiredDeliveryDate:"",
  purpose:             "",
  remarks:             "",
};

export default function TRForm({
  mode = "create",
  trId,
  onAfterSubmit,
  onDetailLoaded,
  onUuid,
}) {
  const router = useRouter();
  const isViewMode = mode === "view" || mode === "approver";

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const [isEditing,      setIsEditing]      = useState(mode === "create");
  const [isSubmitted,    setIsSubmitted]    = useState(false);
  const [allowSubmit,    setAllowSubmit]    = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [items,          setItems]          = useState([]);
  const [initialItems,   setInitialItems]   = useState([]);
  const [attachedFile,   setAttachedFile]   = useState(null);
  const [existingFileUrl,setExistingFileUrl]= useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");
  const [fileResetKey,   setFileResetKey]   = useState(0);
  const [initialFormData,setInitialFormData]= useState(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  const form = useForm({
    resolver: zodResolver(trSchema),
    defaultValues,
    // IMPORTANT: default mode is "onSubmit" — no premature validation on first render
  });

  const { reset, getValues, setValue, handleSubmit, formState: { isSubmitting } } = form;

  // Fields live-disabled whenever we are not actively editing
  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ───────────────────────────────────────────────────────────────
  // LOAD DETAIL (edit / view / approver)
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !trId) return;

    (async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({ url: `${TR.GET_BY_ID}/${trId}` });
        const d = res.data?.[0] || res.data || {};

        const formData = {
          trNo:                 d.trNo || "",
          requestDate:          d.requestDate || "",
          orderType:            d.orderType || "",
          transferType:         d.transferType || "",
          orderId:              d.orderId ? String(d.orderId) : "",
          sourceLocation:       d.sourceLocation || "",
          destinationLocation:  d.destinationLocation || "",
          priority:             d.priority || "Medium",
          modeOfTransport:      d.modeOfTransport || "Road",
          preferredCarrierId:   d.preferredCarrierId ? String(d.preferredCarrierId) : "",
          estimatedFreight:     d.estimatedFreight != null ? String(d.estimatedFreight) : "",
          requiredDeliveryDate: d.requiredDeliveryDate || "",
          purpose:              d.purpose || "",
          remarks:              d.remarks || "",
        };
        reset(formData);
        setInitialFormData(formData);

        const mapped = (d.items || []).map((it) => ({
          orderItemId:   it.orderItemId,
          itemCode:      it.itemCode || "",
          itemName:      it.itemName || "",
          itemUnit:      it.itemUnit || "",
          orderQty:      it.orderQty    ?? 0,
          dispatchedQty: it.dispatchedQty ?? 0,
          requestedQty:  it.requestedQty ?? 0,
          remainingQty:  it.remainingQty ?? 0,
          remarks:       it.remarks || "",
        }));
        setItems(mapped);
        setInitialItems(mapped);

        setExistingFileUrl(d.attachedDoc || "");
        setInitialFileUrl(d.attachedDoc || "");

        if (onDetailLoaded) onDetailLoaded(d);
        if (onUuid && (d.trUuid || d.uuid)) onUuid(d.trUuid || d.uuid);

        const editable = ["draft", "reback", "correction"].includes(
          (d.workflowStatus || "").toLowerCase()
        );
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          setIsEditing(false);
          setAllowSubmit(false);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("TR already Approved");
          else if (st === "Rejected") toast.info("TR already Rejected");
          else                         toast.info("TR already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load Transit Request");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [trId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Items table updater (called by TRBasicSection when order selected)
  const handleOrderItemsFetched = (data) => {
    if (!data) { setItems([]); setInitialItems([]); return; }
    const mapped = (Array.isArray(data) ? data : []).map((it) => ({
      orderItemId:   it.orderItemId,
      itemCode:      it.itemCode || "",
      itemName:      it.itemName || "",
      itemUnit:      it.itemUnit || "",
      orderQty:      it.orderQty    ?? 0,
      dispatchedQty: it.dispatchedQty ?? 0,
      requestedQty:  it.requestedQty ?? 0,
      remarks:       "",
    }));
    setItems(mapped);
    setInitialItems(mapped);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // ───────────────────────────────────────────────────────────────
  // PAYLOAD
  // ───────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    fd.append("projectCode",         projectCode);
    fd.append("requestDate",         v.requestDate);
    fd.append("orderType",           v.orderType);
    if (v.orderId)             fd.append("orderId", v.orderId);
    if (v.transferType)        fd.append("transferType", v.transferType);
    fd.append("sourceLocation",      v.sourceLocation);
    fd.append("destinationLocation", v.destinationLocation);
    if (v.priority)             fd.append("priority", v.priority);
    if (v.modeOfTransport)      fd.append("modeOfTransport", v.modeOfTransport);
    if (v.preferredCarrierId)   fd.append("preferredCarrierId", v.preferredCarrierId);
    if (v.estimatedFreight)     fd.append("estimatedFreight", v.estimatedFreight);
    if (v.requiredDeliveryDate) fd.append("requiredDeliveryDate", v.requiredDeliveryDate);
    if (v.purpose)              fd.append("purpose", v.purpose);
    if (v.remarks)              fd.append("remarks", v.remarks);

    const itemsPayload = items
      .filter((it) => Number(it.requestedQty) > 0)
      .map((it) => ({
        orderItemId:  it.orderItemId || null,
        itemCode:     it.itemCode,
        requestedQty: Number(it.requestedQty),
        remarks:      it.remarks || "",
      }));
    fd.append("items", JSON.stringify(itemsPayload));

    if (attachedFile) fd.append("attachedDoc", attachedFile);
    else if (mode === "edit" && !existingFileUrl) fd.append("clearAttachedDoc", "true");
    return fd;
  };

  const validateItems = () => {
    if (!items.length) {
      toast.error("Please add at least one item");
      return false;
    }
    const hasQty = items.some((it) => Number(it.requestedQty) > 0);
    if (!hasQty) {
      toast.error("Please enter a requested quantity for at least one item");
      return false;
    }
    return true;
  };

  // ───────────────────────────────────────────────────────────────
  // SAVE DRAFT
  // ───────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    if (!validateItems()) return;

    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating TR..." : "Updating TR...");

      const res = await apiRequest({
        url:    mode === "create" ? TR.CREATE : `${TR.UPDATE}/${trId}`,
        method: mode === "create" ? "POST"   : "PUT",
        data:   buildPayload(),
      });

      const saved = res?.data?.trNo || res?.data?.[0]?.trNo;
      toast.dismiss(toastId);
      toast.success(saved ? `TR ${saved} saved` : "TR saved");

      if (mode === "create") {
        const newId = res?.data?.id || res?.data?.[0]?.id || res?.data?.trId;
        if (newId) router.push(`/logistics/transit-request/${newId}`);
        return;
      }

      // After successful update: reflect the (possibly new) file URL
      const newUrl = res?.data?.attachedDoc ?? existingFileUrl;
      setExistingFileUrl(newUrl);
      setInitialFileUrl(newUrl);
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      if (saved) setValue("trNo", saved);
      if (res?.data?.uuid && onUuid) onUuid(res.data.uuid);

      setInitialFormData(getValues());
      setInitialItems(items);

      setIsEditing(false);
      setAllowSubmit(true);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to save TR");
    }
  };

  // ───────────────────────────────────────────────────────────────
  // SUBMIT (only after save — exactly like IndentForm)
  // ───────────────────────────────────────────────────────────────
  const handleFinalSubmit = async () => {
    let toastId;
    try {
      toastId = toast.loading("Submitting TR...");
      await apiRequest({ url: `${TR.SUBMIT}/${trId}`, method: "POST" });
      toast.dismiss(toastId);
      toast.success("TR submitted for approval");
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to submit");
    }
  };

  // ───────────────────────────────────────────────────────────────
  // EDIT / CANCEL
  // ───────────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isSubmitting || isViewMode || isSubmitted) return;

    if (isEditing) {
      // CANCEL
      if (initialFormData) reset(initialFormData);
      setItems(initialItems);
      setExistingFileUrl(initialFileUrl);
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    // EDIT
    setIsEditing(true);
    setAllowSubmit(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <EdoxMark size={32} />
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#F3EEE4]/40 min-h-full">
      <div className="flex flex-col lg:flex-row gap-3 items-start">

        {/* LEFT: info panel (two stacked sections) */}
        {sidebarOpen && (
          <div className="w-full lg:w-[380px] lg:shrink-0 flex flex-col gap-3">
            <TRBasicSection
              form={form}
              disabled={disabled}
              mode={mode}
            />
            <TRRouteSection
              form={form}
              disabled={disabled}
              mode={mode}
              onOrderItemsFetched={handleOrderItemsFetched}
              attachedFile={attachedFile}
              existingFileUrl={existingFileUrl}
              onFileChange={setAttachedFile}
              onFileClear={() => setExistingFileUrl("")}
              fileResetKey={fileResetKey}
            />
          </div>
        )}

        {/* COLLAPSE TAB */}
        <div className="hidden lg:flex flex-col items-center self-stretch">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Hide details" : "Show details"}
            className={`flex items-center justify-center w-5 h-10 rounded border transition my-1 ${
              sidebarOpen
                ? "bg-sky-100 border-sky-300 hover:bg-sky-200 text-sky-700"
                : "bg-[#144664] border-[#144664] hover:bg-[#1e5f84] text-white"
            }`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        {/* RIGHT: items */}
        <div className="flex-1 min-w-0">
          <TRItemsTable
            items={items}
            onItemChange={handleItemChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* TOOLBAR — pinned bottom-right, IndentForm pattern */}
      {!isViewMode && (
        <div className="flex justify-end gap-2 mt-4 border-t border-gray-200 pt-3">
          {/* Save Draft — only while actively editing */}
          {((mode === "create" && isEditing) ||
            (mode === "edit"   && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}

          {/* Submit — only after a saved draft, when not editing */}
          <SaveButton
            onClick={handleFinalSubmit}
            loading={isSubmitting}
            disabled={
              !allowSubmit ||
              isEditing ||
              isSubmitted ||
              isSubmitting ||
              mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Transit Request?"
            confirmationMessage="Once submitted, the TR goes to approval."
          >
            Submit
          </SaveButton>

          {/* Edit / Cancel toggle */}
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}

          {/* Delete request — only in a saved, non-editing state */}
          {mode === "edit" && !isEditing && !isSubmitted && (
            <DeleteRequestButton
              moduleCode="TR"
              recordId={Number(trId)}
              onDeleted={() => router.back()}
            />
          )}
        </div>
      )}
    </div>
  );
}
