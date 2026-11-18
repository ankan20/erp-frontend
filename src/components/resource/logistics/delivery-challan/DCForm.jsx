"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";
import { useCopySource, copyLoadedToast } from "@/lib/copyRecord";

import DCBasicSection     from "./DCBasicSection";
import DCConsigneeSection from "./DCConsigneeSection";
import DCVehicleSection   from "./DCVehicleSection";
import DCItemsTable       from "./DCItemsTable";

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;

const dcSchema = z.object({
  dcNo:                z.string().optional(),
  challanDate:         zodDate(z, "Challan Date", true),
  orderType:           z.string().min(1, "Order Type is required"),
  orderId:             z.string().min(1, "Order No is required"),
  dispatchType:        z.string().optional(),
  transitRequestId:    z.string().optional(),

  // Consignee
  consigneeName:       z.string().optional(),
  consigneeGstin:      z.string().optional(),
  consigneeAddress:    z.string().optional(),

  // Locations
  fromDisplayCode:     z.string().optional(),
  fromDisplayName:     z.string().optional(),
  shippingFromAddress: z.string().optional(),
  shippingToAddress:   z.string().optional(),
  contactPerson:       z.string().optional(),
  purposeForDelivery:  z.string().optional(),

  // Vehicle / transporter
  transporterId:       z.string().optional(),
  lrNo:                z.string().optional(),
  deliveryMode:        z.string().optional(),
  vehicleNumber:       z.string().optional(),
  driverName:          z.string().optional(),
  driverContactNumber: z.string().optional(),
  driverLicense:       z.string().optional(),
  ewayBillNumber:      z.string().optional(),
  ewayBillDate:        zodDate(z, "E-Way Bill Date"),
  ewayBillExpiryDate:  zodDate(z, "E-Way Bill Expiry"),
});

const defaultValues = {
  dcNo:                "",
  challanDate:         "",
  orderType:           "",
  orderId:             "",
  dispatchType:        "",
  transitRequestId:    "",
  consigneeName:       "",
  consigneeGstin:      "",
  consigneeAddress:    "",
  fromDisplayCode:     "",
  fromDisplayName:     "",
  shippingFromAddress: "",
  shippingToAddress:   "",
  contactPerson:       "",
  purposeForDelivery:  "",
  transporterId:       "",
  lrNo:                "",
  deliveryMode:        "Road",
  vehicleNumber:       "",
  driverName:          "",
  driverContactNumber: "",
  driverLicense:       "",
  ewayBillNumber:      "",
  ewayBillDate:        "",
  ewayBillExpiryDate:  "",
};

export default function DCForm({
  mode = "create",
  dcId,
  onAfterSubmit,
  onDetailLoaded,
  onUuid,
}) {
  const copyFromId = useCopySource();
  const isCopy     = mode === "create" && !!copyFromId;

  const isViewMode = mode === "view" || mode === "approver";
  const router     = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [allowSubmit,     setAllowSubmit]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [items,           setItems]           = useState([]);
  const [initialItems,    setInitialItems]    = useState([]);
  const [attachedFile,    setAttachedFile]    = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl,  setInitialFileUrl]  = useState("");
  const [fileResetKey,    setFileResetKey]    = useState(0);
  const [initialFormData, setInitialFormData] = useState(null);
  const [sidebarOpen,     setSidebarOpen]     = useState(true);

  const form = useForm({
    resolver: zodResolver(dcSchema),
    defaultValues,
    // default mode is "onSubmit" — errors fire only when user tries to save
  });

  const { reset, getValues, handleSubmit, setValue, formState: { isSubmitting } } = form;
  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // Load detail (edit / view / approver)
  useEffect(() => {
    const loadId = isCopy ? copyFromId : dcId;
    if ((mode === "create" && !isCopy) || !loadId) return;

    (async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({ url: `${DC.GET_BY_ID}/${loadId}` });
        const d = res.data?.[0] || res.data || {};

        const formData = {
          dcNo:                d.dcNo || "",
          challanDate:         d.challanDate || "",
          orderType:           d.orderType || "",
          orderId:             String(d.orderId || ""),
          dispatchType:        d.dispatchType || "",
          transitRequestId:    d.transitRequestId ? String(d.transitRequestId) : "",
          consigneeName:       d.consigneeName || "",
          consigneeGstin:      d.consigneeGstin || "",
          consigneeAddress:    d.consigneeAddress || "",
          fromDisplayCode:     d.fromType === "vendor" ? "Vendor" : (d.fromProjectCode || ""),
          fromDisplayName:     d.fromType === "vendor" ? (d.fromVendorName || "") : (d.fromProjectName || ""),
          shippingFromAddress: d.shippingFromAddress || "",
          shippingToAddress:   d.shippingToAddress || "",
          contactPerson:       d.contactPerson || "",
          purposeForDelivery:  d.purposeForDelivery || "",
          transporterId:       d.transporterId ? String(d.transporterId) : "",
          lrNo:                d.lrNo || "",
          deliveryMode:        d.deliveryMode || "Road",
          vehicleNumber:       d.vehicleNumber || "",
          driverName:          d.driverName || "",
          driverContactNumber: d.driverContactNumber || "",
          driverLicense:       d.driverLicense || "",
          ewayBillNumber:      d.ewayBillNumber || "",
          ewayBillDate:        d.ewayBillDate || "",
          ewayBillExpiryDate:  d.ewayBillExpiryDate || "",
        };
        reset(formData);
        setInitialFormData(formData);

        const mapped = (d.items || []).map((it) => ({
          orderItemId:   it.orderItemId,
          itemCode:      it.itemCode || "",
          itemName:      it.itemName || "",
          itemUnit:      it.itemUnit || "",
          balanceQty:    it.balanceQty ?? it.orderQty ?? 0,
          issueQty:      it.issueQty ?? 0,
          stockLocation: it.stockLocation || "",
        }));
        setItems(mapped);
        setInitialItems(mapped);

        if (isCopy) {
          reset({ ...formData, dcNo: "" });
          copyLoadedToast(d.dcNo);
          return;
        }

        setExistingFileUrl(d.attachedDoc || "");
        setInitialFileUrl(d.attachedDoc || "");

        if (onDetailLoaded) onDetailLoaded(d);
        if (onUuid && (d.dcUuid || d.uuid)) onUuid(d.dcUuid || d.uuid);

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          setIsEditing(false);
          setAllowSubmit(false);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("DC already Approved");
          else if (st === "Rejected") toast.info("DC already Rejected");
          else                         toast.info("DC already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load DC");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [copyFromId, dcId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrderItemsFetched = (data) => {
    if (!data) { setItems([]); setInitialItems([]); return; }
    const mapped = (Array.isArray(data) ? data : []).map((it) => ({
      orderItemId:   it.orderItemId,
      itemCode:      it.itemCode || "",
      itemName:      it.itemName || "",
      itemUnit:      it.itemUnit || "",
      balanceQty:    it.balanceQty ?? 0,
      issueQty:      it.issueQty ?? it.balanceQty ?? 0,
      stockLocation: it.stockLocation || "",
    }));
    setItems(mapped);
    setInitialItems(mapped);
  };

  const handleItemChange = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const validateItems = () => {
    if (!items.length) { toast.error("Please select an Order No to load items"); return false; }
    if (!items.some((it) => Number(it.issueQty) > 0)) { toast.error("Enter issue qty for at least one item"); return false; }
    if (items.some((it) => Number(it.issueQty) > Number(it.balanceQty))) { toast.error("Issue qty exceeds balance for one or more items"); return false; }
    return true;
  };

  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();

    fd.append("currentProjectCode", projectCode);
    fd.append("orderId",            v.orderId);
    fd.append("orderType",          v.orderType);
    fd.append("challanDate",        v.challanDate);
    if (v.dispatchType)        fd.append("dispatchType",        v.dispatchType);
    if (v.transitRequestId)    fd.append("transitRequestId",    v.transitRequestId);
    if (v.consigneeName)       fd.append("consigneeName",       v.consigneeName);
    if (v.consigneeGstin)      fd.append("consigneeGstin",      v.consigneeGstin);
    if (v.consigneeAddress)    fd.append("consigneeAddress",    v.consigneeAddress);
    if (v.shippingToAddress)   fd.append("shippingToAddress",   v.shippingToAddress);
    if (v.contactPerson)       fd.append("contactPerson",       v.contactPerson);
    if (v.purposeForDelivery)  fd.append("purposeForDelivery",  v.purposeForDelivery);
    if (v.transporterId)       fd.append("transporterId",       v.transporterId);
    if (v.lrNo)                fd.append("lrNo",                v.lrNo);
    if (v.deliveryMode)        fd.append("deliveryMode",        v.deliveryMode);
    if (v.vehicleNumber)       fd.append("vehicleNumber",       v.vehicleNumber);
    if (v.driverName)          fd.append("driverName",          v.driverName);
    if (v.driverContactNumber) fd.append("driverContactNumber", v.driverContactNumber);
    if (v.driverLicense)       fd.append("driverLicense",       v.driverLicense);
    if (v.ewayBillNumber)      fd.append("ewayBillNumber",      v.ewayBillNumber);
    if (v.ewayBillDate)        fd.append("ewayBillDate",        v.ewayBillDate);
    if (v.ewayBillExpiryDate)  fd.append("ewayBillExpiryDate",  v.ewayBillExpiryDate);

    const itemsPayload = items
      .filter((it) => Number(it.issueQty) > 0)
      .map((it) => ({
        orderItemId:   it.orderItemId,
        itemCode:      it.itemCode,
        issueQty:      Number(it.issueQty),
        stockLocation: it.stockLocation || "",
      }));
    fd.append("items", JSON.stringify(itemsPayload));

    if (attachedFile) fd.append("attachedDoc", attachedFile);
    else if (mode === "edit" && !existingFileUrl) fd.append("clearAttachedDoc", "true");
    return fd;
  };

  const handleSaveDraft = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    if (!validateItems()) return;

    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating DC..." : "Updating DC...");
      const res = await apiRequest({
        url:    mode === "create" ? DC.CREATE : `${DC.UPDATE}/${dcId}`,
        method: mode === "create" ? "POST"   : "PUT",
        data:   buildPayload(),
      });

      toast.dismiss(toastId);
      toast.success(mode === "create" ? "DC created" : "DC updated");

      if (mode === "create") {
        const newId = res?.data?.dcId || res?.data?.[0]?.dcId || res?.data?.id;
        if (newId) router.push(`/logistics/delivery-challan/${newId}`);
        return;
      }

      // reflect saved file URL back into the form
      const saved = res?.data || res?.data?.[0] || {};
      if (saved.dcNo) setValue("dcNo", saved.dcNo);
      const newUrl = saved.attachedDoc ?? existingFileUrl;
      setExistingFileUrl(newUrl);
      setInitialFileUrl(newUrl);
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      if (saved.uuid && onUuid) onUuid(saved.uuid);

      setInitialFormData(getValues());
      setInitialItems([...items]);
      setIsEditing(false);
      setAllowSubmit(true);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to save DC");
    }
  };

  const handleFinalSubmit = async () => {
    if (!dcId) { toast.error("Save as draft first"); return; }
    let toastId;
    try {
      toastId = toast.loading("Submitting DC...");
      await apiRequest({ url: `${DC.SUBMIT}/${dcId}`, method: "POST" });
      toast.dismiss(toastId);
      toast.success("DC submitted for approval");
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to submit");
    }
  };

  const handleEdit = () => {
    if (isSubmitting || isViewMode || isSubmitted) return;
    if (isEditing) {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#F3EEE4]/40 min-h-full">
      <div className="flex flex-col lg:flex-row gap-3 items-start">

        {/* LEFT PANEL — three stacked sections */}
        {sidebarOpen && (
          <div className="w-full lg:w-[400px] lg:shrink-0 flex flex-col gap-3">
            <DCBasicSection
              form={form}
              disabled={disabled}
              mode={mode}
              onOrderItemsFetched={handleOrderItemsFetched}
            />
            <DCConsigneeSection form={form} disabled={disabled} />
            <DCVehicleSection
              form={form}
              disabled={disabled}
              attachedFile={attachedFile}
              existingFileUrl={existingFileUrl}
              onFileChange={setAttachedFile}
              onFileClear={() => setExistingFileUrl("")}
              fileResetKey={fileResetKey}
            />
          </div>
        )}

        {/* Divider */}
        <div className="hidden lg:flex flex-col items-center self-stretch">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Hide details" : "Show details"}
            className={`flex items-center justify-center w-5 h-10 rounded border transition my-1 ${
              sidebarOpen ? "bg-sky-100 border-sky-300 text-sky-700" : "bg-[#144664] border-[#144664] text-white"
            }`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        {/* Items */}
        <div className="flex-1 min-w-0">
          <DCItemsTable
            items={items}
            onItemChange={handleItemChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Toolbar */}
      {!isViewMode && (
        <div className="flex justify-end gap-2 mt-4 border-t border-gray-200 pt-3">
          {((mode === "create" && isEditing) ||
            (mode === "edit"   && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          <SaveButton
            onClick={handleFinalSubmit}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Delivery Challan?"
            confirmationMessage="Once submitted, the DC goes to approval."
          >
            Submit
          </SaveButton>
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {mode === "edit" && !isEditing && !isSubmitted && (
            <DeleteRequestButton
              moduleCode="DC"
              recordId={Number(dcId)}
              onDeleted={() => router.back()}
            />
          )}
        </div>
      )}
    </div>
  );
}
