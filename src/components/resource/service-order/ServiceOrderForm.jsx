"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import ServiceOrderBasicSection from "./sections/ServiceOrderBasicSection";
import ServiceOrderItemsTab from "./tabs/ServiceOrderItemsTab";
import OrderTermsTab from "@/components/resource/order/tabs/OrderTermsTab";
import OrderSummaryTab from "@/components/resource/order/tabs/OrderSummaryTab";
import { serviceOrderSchema } from "./schema/serviceOrder.schema";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useRouter } from "next/navigation";

const PW = API_ENDPOINTS.RESOURCE.ORDER.PROJECT_WORK;

const defaultValues = {
  categoryCode: "Work Order",
  subCategoryCodes: [],
  costHead: "Project Work",
  vendorId: "",
  orderNo: "",
  orderDate: "",
  validityDate: "",
  partyAddress: "",
  gstn: "",
  billingAddress: "",
  shippingAddress: "",
  contactPerson: "",
  contactNumber: "",
  quotationNo: "",
  quotationDate: "",
  orderMessage: "",
  items: [],
  terms: [],
  ccSummary: [],
  basicAmount: 0,
  gstAmount: 0,
  totalAmount: 0,
};

export default function ServiceOrderForm({ mode = "create", serviceOrderId }) {
  const [activeTab, setActiveTab] = useState("items");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);
  const [openTermsModal, setOpenTermsModal] = useState(false);
  const [openItemModal, setOpenItemModal] = useState(false);

  // FILE STATE — same as order module
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const [initialFileData, setInitialFileData] = useState({ fileName: "", fileUrl: "" });
  const fileRef = useRef(null);
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({
    resolver: zodResolver(serviceOrderSchema),
    defaultValues,
    mode: "onChange",
  });

  const { reset, watch, setValue, getValues, handleSubmit, formState: { isSubmitting } } = form;

  const disabled =
    mode === "view" || mode === "approver" || !isEditing || isSubmitted || isSubmitting;

  // ─── LOAD ORDER 
  useEffect(() => {
    if (mode === "create" || !serviceOrderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${PW.GET_ORDER_BY_ID}/${serviceOrderId}`,
          method: "GET",
        });
        const data = res.data;

        const formattedData = {
          categoryCode: data.categoryCode || "Work Order",
          subCategoryCodes: data.subCategoryCodes || [],
          costHead: data.costHead || "Project Work",
          vendorId: String(data.vendorId || ""),
          orderNo: data.orderNo || "",
          orderDate: data.orderDate || "",
          validityDate: data.validityDate || "",
          billingAddress: data.billingAddress || "",
          shippingAddress: data.shippingAddress || "",
          quotationNo: data.quotationNo || "",
          quotationDate: data.quotationDate || "",
          orderMessage: data.orderMessage || "",
          items: data.items || [],
          terms: data.terms || [],
          ccSummary: data.ccSummary || [],
          basicAmount: Number(data.basicAmount || 0),
          gstAmount: Number(data.gstAmount || 0),
          totalAmount: Number(data.totalAmount || 0),
        };

        reset(formattedData);
        setInitialData(formattedData);

        // FILE — same as order module
        setFileUrl(data.orderFile || "");
        const extractedFileName = data.orderFile?.split("/")?.pop() || "";
        setInitialFileData({ fileName: extractedFileName, fileUrl: data.orderFile || "" });

        // FIXED: same as OrderForm — case-insensitive editable workflowStatus check
        const isEditableStatus = ["draft", "reback"].includes(
          (data.workflowStatus || "").toLowerCase()
        );
        if (mode === "edit" && !isEditableStatus) {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load service order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [serviceOrderId, mode, reset]);

  // ─── BUILD PAYLOAD — FormData to support file upload like order module ────
  const buildFormData = () => {
    const values = getValues();
    const formData = new FormData();

    formData.append("projectCode", projectCode);
    formData.append("categoryCode", values.categoryCode);
    formData.append("subCategoryCodes", JSON.stringify(values.subCategoryCodes));
    formData.append("costHead", values.costHead);
    formData.append("vendorId", values.vendorId);
    formData.append("orderDate", values.orderDate);
    formData.append("validityDate", values.validityDate);
    formData.append("billingAddress", values.billingAddress);
    formData.append("shippingAddress", values.shippingAddress);
    formData.append("contactPerson", values.contactPerson);
    formData.append("contactNumber", values.contactNumber);
    formData.append("quotationNo", values.quotationNo);
    formData.append("quotationDate", values.quotationDate);
    formData.append("orderMessage", values.orderMessage?.trim() || "");

    formData.append(
      "items",
      JSON.stringify(
        values.items.map((item) => ({
          itemCode: item.itemCode,
          qty: Number(item.qty),
          rate: Number(item.rate),
          gstPercent: Number(item.gstPercent),
          note: item.note || "",
          location: item.location || "",
        }))
      )
    );

    formData.append(
      "terms",
      JSON.stringify(
        values.terms.map((term) => ({
          termId: term.termId,
          description: term.description || "",
          sequenceNo: term.sequenceNo || 0,
        }))
      )
    );

    if (attachedFile) formData.append("orderFile", attachedFile);

    return formData;
  };

  // ─── SAVE DRAFT 
  const handleSaveDraft = async () => {
    let toastId;
    const values = getValues();
    if (!values.items?.length) { toast.error("Please add at least one order item"); return; }
    if (!values.terms?.filter((t) => t?.termId).length) { toast.error("Please add at least one term & condition"); return; }
    if(mode ==="create" && !attachedFile) { toast.error("Please upload required file."); return;}

    try {
      toastId = toast.loading(mode === "create" ? "Creating service order..." : "Updating service order...");

      const res = await apiRequest({
        url: mode === "create"
          ? PW.CREATE_ORDER
          : `${PW.UPDATE_ORDER_BY_ID}${serviceOrderId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildFormData(),
      });

      if (res?.data?.orderNo) setValue("orderNo", res.data.orderNo);

      if (res?.data?.orderFile) {
        setFileUrl(res.data.orderFile);
        setInitialFileData({ fileName: res.data.orderFile?.split("/")?.pop() || "", fileUrl: res.data.orderFile });
      }

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved successfully", { id: toastId });
      if(mode ==="create" && res.data.orderId){
        setTimeout(() => {
        router.push(
          `/resource-management/procurement/service-order/${res.data.orderId}`,
        );
      }, 500);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    }
  };

  // ─── SUBMIT ───────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    const values = getValues();
    if (!values.items?.length) { toast.error("Please add at least one item"); return; }
    if (!values.terms?.length) { toast.error("Please add at least one term & condition"); return; }

    let toastId;
    try {
      toastId = toast.loading("Submitting service order...");
      await apiRequest({ url: `${PW.SUBMIT_ORDER_BY_ID}${serviceOrderId}`, method: "POST" });
      toast.success("Service order submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
    } catch (err) {
      toast.error(err.message || "Failed to submit service order", { id: toastId });
    }
  };

  // ─── EDIT / CANCEL ────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setAttachedFile(null);
      setFileUrl(initialFileData.fileUrl);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  const validateTableSections = ({ values }) => {
    if (!values.items?.length) { toast.error("Please add at least one order item"); return false; }
    if (!values.terms?.filter((t) => t?.termId).length) { toast.error("Please add at least one term & condition"); return false; }
    return true;
  };

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col xl:flex-row items-start gap-5 p-3">
        {/* LEFT SECTION */}
        <div className="w-full xl:w-auto shrink-0">
          <ServiceOrderBasicSection
            form={form}
            disabled={disabled}
            fileName={fileName}
            setFileName={setFileName}
            fileUrl={fileUrl}
            setFileUrl={setFileUrl}
            attachedFile={attachedFile}
            setAttachedFile={setAttachedFile}
            fileRef={fileRef}
          />
        </div>

        <div className="hidden xl:block w-px self-stretch bg-sky-300" />

        {/* RIGHT SECTION */}
        <div className="w-full min-w-0 overflow-x-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-[2px] min-w-[900px]">
              <TabsList className="h-auto bg-transparent p-0 gap-[2px] rounded-none border-0 shadow-none flex flex-wrap">
                <TabsTrigger value="summary" className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none" style={{ clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)" }}>
                  Summary
                </TabsTrigger>
                <TabsTrigger value="items" className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none" style={{ clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)" }}>
                  Details
                </TabsTrigger>
                <TabsTrigger value="terms" className="relative h-[40px] min-w-[220px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none" style={{ clipPath: "polygon(0 0, 92% 0, 100% 100%, 0% 100%)" }}>
                  Terms & Conditions
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 lg:justify-end">
                {activeTab === "items" && !disabled && (
                  <button type="button" onClick={() => setOpenItemModal(true)} className="h-[34px] min-w-[180px] px-4 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition">
                    + Add Service Items
                  </button>
                )}
                {activeTab === "terms" && !disabled && (
                  <button type="button" onClick={() => setOpenTermsModal(true)} className="h-[34px] min-w-[150px] px-4 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition">
                    + Add T&C
                  </button>
                )}
              </div>
            </div>

            {/* FIXED: position-relative creates a new stacking context so sticky thead works correctly */}
            <div className="border border-[#CFCFCF] bg-white min-w-[900px] relative">
              <TabsContent value="items" className="m-0">
                <ServiceOrderItemsTab form={form} disabled={disabled} openItemModal={openItemModal} setOpenItemModal={setOpenItemModal} />
              </TabsContent>
              <TabsContent value="terms" className="m-0">
                <OrderTermsTab form={form} disabled={disabled} openTermsModal={openTermsModal} setOpenTermsModal={setOpenTermsModal} />
              </TabsContent>
              <TabsContent value="summary" className="m-0">
                <OrderSummaryTab form={form} disabled={disabled} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5">
          {((mode === "create" && isEditing) || (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => {
                const values = getValues();
                if (!validateTableSections({ values })) return;
                handleSubmit(handleSaveDraft)();
              }}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          <SaveButton
            onClick={() => {
              const values = getValues();
              if (!validateTableSections({ values })) return;
              handleSubmit(onSubmit)();
            }}
            loading={isSubmitting}
            disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting}
            requireConfirmation
            confirmationTitle="Submit Service Order?"
            confirmationMessage="Once submitted, this order will go for approval."
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
