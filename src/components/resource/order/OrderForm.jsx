"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import OrderBasicSection from "./sections/OrderBasicSection";
import OrderItemsTab from "./tabs/OrderItemsTab";
import TermsSection from "@/components/common/TermsSection";
import OrderSummaryTab from "./tabs/OrderSummaryTab";
import { orderSchema } from "./schema/order.schema";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useRouter } from "next/navigation";

const defaultValues = {
  categoryCode: "Purchases_Order",
  subCategoryCode: "MAT_001",
  costHead: "Project_Work",
  vendorId: "",
  transferProjectSite: "",
  orderNo: "",
  orderDate: "",
  validityDate: "",
  partyAddress: "",
  gstn: "",
  site: "",
  billingAddress: "",
  shippingAddress: "",
  contactPerson: "",
  contactNumber: "",
  quotationNo: "",
  quotationDate: "",
  orderMessage: "",
  gstType: "",
  items: [],
  terms: [],
  ccSummary: [],
  basicAmount: 0,
  gstAmount: 0,
  totalAmount: 0,
};

export default function OrderForm({ mode = "create", orderId, onUuid, onAfterSubmit }) {
  const [activeTab, setActiveTab] = useState("items");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [attachedFile, setAttachedFile] = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl, setInitialFileUrl] = useState("");
  const [fileResetKey, setFileResetKey] = useState(0);
  const [initialData, setInitialData] = useState(null);
  const [openItemModal, setOpenItemModal] = useState(false);
  const [withIndent, setWithIndent] = useState(true);
  const [withoutIndentItemOptions, setWithoutIndentItemOptions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues,
    mode: "onChange",
  });

  const {
    reset,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const costHead = watch("costHead");

  const disabled =
    mode === "view" ||
    mode === "approver" ||
    !isEditing ||
    isSubmitted ||
    isSubmitting;

  // ─── LOAD WITHOUT-INDENT ITEM OPTIONS — re-fetch when costHead changes (assetOnly flag)
  useEffect(() => {
    if (withIndent) return;
    const url =
      costHead === "Fixed_Asset"
        ? `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_ITEMS_BY_CATEGORY}?categoryCode=MAT_001&assetOnly=true`
        : `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.GET_ITEMS_BY_CATEGORY}?categoryCode=MAT_001`;
    apiRequest({ url, method: "GET" })
      .then((res) => setWithoutIndentItemOptions(res.data || []))
      .catch(() => {});
  }, [withIndent, costHead]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── LOAD ORDER
  useEffect(() => {
    if (mode === "create" || !orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.GET_ORDER_BY_ID}/${orderId}`,
          method: "GET",
        });
        const data = res.data;

        if (data.uuid && onUuid) onUuid(data.uuid);

        // Fetch party address/gstn — derived from secondary APIs
        let partyAddress = "";
        let gstn = "";

        try {
          if (data.categoryCode === "Purchases_Order" && data.vendorId) {
            const ledgerRes = await apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" });
            const vendor = (ledgerRes.data || []).find((v) => String(v.ledgerId) === String(data.vendorId));
            if (vendor) {
              partyAddress = vendor.corporateAddress || "";
              gstn         = vendor.gstin            || "";
            }
          } else if (data.categoryCode === "Customer_Supply_Order") {
            const projRes = await apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectInfo?.projectId}`, method: "GET" });
            const projData = projRes.data?.[0];
            if (projData) {
              partyAddress = projData.registeredAddress || "";
              gstn         = projData.gstn              || "";
            }
          } else if (data.categoryCode === "Site_Transfer_Order" && data.transferProjectSite) {
            const allProjRes = await apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" });
            const transferProj = (allProjRes.data || []).find((p) => p.projectCode === data.transferProjectSite);
            if (transferProj) {
              const tpRes = await apiRequest({ url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${transferProj.id}`, method: "GET" });
              const tpData = tpRes.data?.[0];
              if (tpData) {
                partyAddress = tpData.registeredAddress || "";
                gstn         = tpData.gstn              || "";
              }
            }
          }
        } catch { /* party fields stay empty if secondary API fails */ }

        const formattedData = {
          categoryCode: data.categoryCode || "Purchases_Order",
          subCategoryCode: data.subCategoryCode || "MAT_001",
          costHead: data.costHead || "",
          vendorId: data.vendorId ? String(data.vendorId) : "",
          transferProjectSite: data.transferProjectSite || "",
          orderNo: data.orderNo || "",
          orderDate: data.orderDate || "",
          validityDate: data.validityDate || "",
          site: data.projectCode || "",
          billingAddress: data.billingAddress || "",
          shippingAddress: data.shippingAddress || "",
          quotationNo: data.quotationNo || "",
          quotationDate: data.quotationDate || "",
          orderMessage: data.orderMessage || "",
          gstType: data.gstType || "",
          items: (data.items || []).map((item) => ({
            ...item,
            unit: item.unit || item.itemUnit || "",
          })),
          terms: data.terms || [],
          ccSummary: data.ccSummary || [],
          basicAmount: Number(data.basicAmount || 0),
          gstAmount: Number(data.gstAmount || 0),
          totalAmount: Number(data.totalAmount || 0),
          partyAddress,
          gstn,
          contactPerson: data.contactPerson || "",
          contactNumber: data.contactNumber || "",
        };

        // Determine indent type from items — if any item has indentItemId null, it's without-indent
        const items = data.items || [];
        const isWithoutIndent = items.length > 0 && items.some((item) => item.indentItemId === null);
        setWithIndent(!isWithoutIndent);

        reset(formattedData);
        setInitialData(formattedData);
        setExistingFileUrl(data.orderFile || "");
        setInitialFileUrl(data.orderFile || "");

        // FIXED: check what IS editable rather than what isn't —
        // null/undefined/unexpected workflowStatus was incorrectly triggering isSubmitted=true
        const isEditableStatus = ["draft", "reback"].includes(
          (data.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !isEditableStatus) {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, mode, reset]);

  // ─── BUILD PAYLOAD (FormData — supports file)
  const buildFormData = () => {
    const values = getValues();
    const formData = new FormData();

    formData.append("projectCode", projectCode);
    formData.append("categoryCode", values.categoryCode);
    formData.append("subCategoryCode", "MAT_001");
    formData.append("costHead", values.costHead);
    formData.append("assetOnly", values.costHead === "Fixed_Asset" ? "true" : "false");

    // Category-specific payload fields
    if (values.categoryCode === "Purchases_Order") {
      formData.append("vendorId", values.vendorId);
    } else if (values.categoryCode === "Customer_Supply_Order") {
      formData.append("vendorId", "");
    } else if (values.categoryCode === "Site_Transfer_Order") {
      formData.append("vendorId", "");
      formData.append("transferProjectSite", values.transferProjectSite || "");
    }

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
        values.items.map((item) =>
          withIndent
            ? {
                indentItemId: item.indentItemId,
                qty: Number(item.qty),
                rate: Number(item.rate),
                gstPercent: Number(item.gstPercent),
                note: item.note || "",
                location: item.location || "",
              }
            : {
                indentItemId: null,
                itemCode: item.itemCode,
                qty: Number(item.qty),
                rate: Number(item.rate),
                gstPercent: Number(item.gstPercent),
                note: item.note || "",
                location: item.location || "",
              },
        ),
      ),
    );

    formData.append(
      "terms",
      JSON.stringify(
        values.terms.map((term, i) => ({
          ...(term.termId ? { termId: term.termId } : {}),
          sourceTermId: term.sourceTermId,
          termType:     term.termType,
          sortOrder:    i,
          termGroups:   (term.termGroups || []).map((g, gi) => ({
            ...(g.groupId != null ? { groupId: g.groupId } : {}),
            title:       g.title,
            description: g.description || "",
            pointStyle:  g.pointStyle,
            sortOrder:   gi,
            points:      (g.points || []).map((p, pi) => ({
              ...(p.pointId != null ? { pointId: p.pointId } : {}),
              text:      p.text,
              sortOrder: pi,
            })),
          })),
        })),
      ),
    );

    if (attachedFile) formData.append("orderFile", attachedFile);
    return formData;
  };

  // ─── SAVE DRAFT
  const handleSaveDraft = async () => {
    let toastId;
    const values = getValues();
    if (!values.items?.length) {
      toast.error("Please add at least one order item");
      return;
    }
    if (!values.terms?.length) {
      toast.error("Please add at least one term & condition");
      return;
    }
    if (mode === "create" && !attachedFile) {
      toast.error("Please upload required file.");
      return;
    }

    try {
      toastId = toast.loading(
        mode === "create" ? "Creating order..." : "Updating order...",
      );

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.CREATE_ORDER
            : `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.UPDATE_ORDER_BY_ID}${orderId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildFormData(),
      });

      if (res?.data?.orderNo) setValue("orderNo", res.data.orderNo);
      if (res?.data?.uuid && onUuid) onUuid(res.data.uuid);

      if (res?.data?.orderFile) {
        setExistingFileUrl(res.data.orderFile);
        setInitialFileUrl(res.data.orderFile);
        setAttachedFile(null);
        setFileResetKey((k) => k + 1);
      }

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved successfully", { id: toastId });
      //redirect to edit page if first time create
      if(mode ==="create" && res.data.orderId){
        setTimeout(() => {
        router.push(
          `/resource-management/procurement/order/material-order/${res.data.orderId}`,
        );
      }, 400);
      }
      
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    }
  };

  // ─── SUBMIT ───────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    const values = getValues();
    if (!values.items?.length) {
      toast.error("Please add at least one item");
      return;
    }
    if (!values.terms?.length) {
      toast.error("Please add at least one term & condition");
      return;
    }

    let toastId;
    try {
      toastId = toast.loading("Submitting order...");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.SUBMIT_ORDER_BY_ID}${orderId}`,
        method: "POST",
      });
      toast.success("Order submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit order", { id: toastId });
    }
  };

  // ─── EDIT / CANCEL ────────────────────────────────────────────────────────
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

  const validateTableSections = ({ values }) => {
    if (!values.items?.length) {
      toast.error("Please add at least one order item");
      return false;
    }
    if (!values.terms?.length) {
      toast.error("Please add at least one term & condition");
      return false;
    }
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
      <div className="flex flex-col xl:flex-row items-start gap-3 p-3">
        {/* LEFT SECTION — xl only collapse */}
        {sidebarOpen && (
          <OrderBasicSection
            form={form}
            mode={mode}
            disabled={disabled}
            existingFileUrl={existingFileUrl}
            onFileChange={(file) => setAttachedFile(file)}
            onClearExisting={() => setExistingFileUrl("")}
            fileResetKey={fileResetKey}
            withIndent={withIndent}
            setWithIndent={setWithIndent}
          />
        )}

        {/* DIVIDER + COLLAPSE BUTTON — xl only */}
        <div className="hidden xl:flex flex-col items-center self-stretch gap-0">
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

        {/* RIGHT SECTION */}
        <div className="w-full flex-1 min-w-0 overflow-x-auto">
          <div className="min-w-[900px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-[2px]">
              <TabsList className="h-auto bg-transparent p-0 gap-[2px] rounded-none border-0 shadow-none flex flex-wrap">
                <TabsTrigger
                  value="summary"
                  className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none"
                  style={{
                    clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="items"
                  className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none"
                  style={{
                    clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="terms"
                  className="relative h-[40px] min-w-[220px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none"
                  style={{
                    clipPath: "polygon(0 0, 92% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Terms & Conditions
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 lg:justify-end">
                {activeTab === "items" && !disabled && withIndent && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!getValues("costHead")) {
                        toast.error("Please select cost head first");
                        return;
                      }
                      setOpenItemModal(true);
                    }}
                    className="h-[34px] min-w-[170px] px-4 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition"
                  >
                    + Add Order Items
                  </button>
                )}
              </div>
            </div>

            <div className="border border-[#CFCFCF] bg-white">
              <TabsContent value="items" className="m-0">
                {/* CHANGED: always OrderItemsTab; assetOnly handled in modal via costHead */}
                <OrderItemsTab
                  form={form}
                  disabled={disabled}
                  openItemModal={openItemModal}
                  setOpenItemModal={setOpenItemModal}
                  withIndent={withIndent}
                  itemOptions={withoutIndentItemOptions}
                  projectCode={projectCode}
                />
              </TabsContent>
              <TabsContent value="terms" className="m-0">
                <TermsSection
                  terms={form.watch("terms") || []}
                  onChange={(v) => form.setValue("terms", v)}
                  module="Order"
                  subModule={form.watch("categoryCode")}
                  disabled={disabled}
                />
              </TabsContent>
              <TabsContent value="summary" className="m-0">
                <OrderSummaryTab form={form} disabled={disabled} />
              </TabsContent>
            </div>
          </Tabs>
          </div>
        </div>
      </div>

      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5">
          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
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
            confirmationTitle="Submit Order?"
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
