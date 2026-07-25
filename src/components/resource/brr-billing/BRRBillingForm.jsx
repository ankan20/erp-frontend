"use client";

import { useEffect, useState } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import BRRBillingLeftPanel from "./BRRBillingLeftPanel";
import BRRBillingDetailsTab from "./tabs/BRRBillingDetailsTab";
import BRRBillingSummaryTab from "./tabs/BRRBillingSummaryTab";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useRouter } from "next/navigation";
import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";

const schema = z.object({
  brrNo:           z.string().optional(),
  billingNo:       z.string().optional(),
  billingDate:     z.string().min(1, "Required"),
  partyName:       z.string().optional(),
  partyAddress:    z.string().optional(),
  partyGstn:       z.string().optional(),
  orderCategory:   z.string().optional(),
  orderNo:         z.string().optional(),
  orderDate:       z.string().optional(),
  partyBillNo:     z.string().optional(),
  partyDate:       z.string().optional(),
  billingAddress:  z.string().optional(),
  shippingAddress: z.string().optional(),
  itemCategory:    z.string().optional(),
  costHead:        z.string().optional(),
  items:           z.array(z.any()).optional(),
  ccSummary:       z.array(z.any()).optional(),
  basicAmount:     z.number().optional(),
  gstAmount:       z.number().optional(),
  totalAmount:     z.number().optional(),
});

const today = new Date().toISOString().split("T")[0];

const defaultValues = {
  brrNo: "", billingNo: "", billingDate: today,
  partyName: "", partyAddress: "", partyGstn: "",
  orderCategory: "", orderNo: "", orderDate: "",
  partyBillNo: "", partyDate: "",
  billingAddress: "", shippingAddress: "",
  itemCategory: "", costHead: "",
  items: [], ccSummary: [],
  basicAmount: 0, gstAmount: 0, totalAmount: 0,
};

export default function BRRBillingForm({ mode = "create", billingType, brrId, billingId, onAfterSubmit }) {
  const [activeTab, setActiveTab]     = useState("details");
  const [loading, setLoading]         = useState(!!(brrId || billingId));
  const [isEditing, setIsEditing]     = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);
  const [openItemModal, setOpenItemModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [effectiveBrrId, setEffectiveBrrId] = useState(brrId);
  // Cached items-by-brr response for create mode — passed to modals to avoid refetch
  const [brrContext, setBrrContext]   = useState(null);
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const isGRN = billingType === "grn";

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  const { reset, getValues, handleSubmit, formState: { isSubmitting } } = form;

  const disabled =
    mode === "view" ||
    mode === "approver" ||
    !isEditing ||
    isSubmitted ||
    isSubmitting;

  // ── Create mode: single items-by-brr fetch covers all header data ────────
  useEffect(() => {
    if (mode !== "create" || !brrId) return;
    const fetchBrrContext = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.BRB.ITEMS_BY_BRR}/${brrId}`,
          method: "GET",
        });
        const d = res.data;

        // Auto-redirect if the URL billingType doesn't match BRR's actual type
        const correctType = d.billingType === "GRN" ? "grn" : "srn";
        if (correctType !== billingType) {
          router.replace(
            `/resource-management/sub-contractor-billing/e-reconcile-bill/new?brrId=${brrId}&billingType=${correctType}`
          );
          return;
        }

        setBrrContext(d);
        reset({
          ...defaultValues,
          brrNo:           d.brrNo || "",
          partyBillNo:     d.brrPartyBillNo || "",
          partyDate:       d.brrPartyDate || "",
          partyName:       d.partyName || "",
          partyAddress:    d.partyAddress || "",
          partyGstn:       d.partyGstn || "",
          orderCategory:   d.orderCategory?.replace(/_/g, " ") || "",
          orderNo:         d.orderNo || "",
          orderDate:       d.orderDate || "",
          billingAddress:  d.billingAddress || "",
          shippingAddress: d.shippingAddress || "",
          itemCategory:    (d.itemCategory || [])
            .map((code) => CATEGORY_OPTIONS.itemCategory.find((o) => o.value === code)?.label || code.replace(/_/g, " "))
            .join(", "),
          costHead:        d.costHead?.replace(/_/g, " ") || "",
        });
      } catch (err) {
        toast.error(err.message || "Failed to load BRR details");
      } finally {
        setLoading(false);
      }
    };
    fetchBrrContext();
  }, [brrId, billingType, mode, reset]);

  // ── Edit/view mode: load BRB details ─────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billingId) return;
    const fetchBilling = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.BRB.DETAILS}/${billingId}`,
          method: "GET",
        });
        const d = res.data;

        const items = (d.items || []).map((it) => ({
          ...it,
          effectiveAvailableQty: Number(it.availableQty ?? 0) + Number(it.billingQty ?? 0),
        }));

        if (d.brrId) setEffectiveBrrId(d.brrId);

        const formattedData = {
          brrNo:           d.brrNo || "",
          billingNo:       d.brbNo || "",
          billingDate:     d.brbDate || today,
          partyName:       d.partyName || "",
          partyAddress:    d.partyAddress || "",
          partyGstn:       d.partyGstn || "",
          orderCategory:   d.orderCategory?.replace(/_/g, " ") || "",
          orderNo:         d.orderNo || "",
          orderDate:       d.orderDate || "",
          partyBillNo:     d.partyBillNo || "",
          partyDate:       d.partyDate || "",
          billingAddress:  d.billingAddress || "",
          shippingAddress: d.shippingAddress || "",
          itemCategory:    (d.itemCategory || [])
            .map((code) => CATEGORY_OPTIONS.itemCategory.find((o) => o.value === code)?.label || code.replace(/_/g, " "))
            .join(", "),
          costHead:        d.costHead?.replace(/_/g, " ") || "",
          items,
          ccSummary:       d.ccSummary || [],
          basicAmount:     Number(d.basicAmount || 0),
          gstAmount:       Number(d.gstAmount || 0),
          totalAmount:     Number(d.totalAmount || 0),
        };

        reset(formattedData);
        setInitialData(formattedData);

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
        toast.error(err.message || "Failed to load billing details");
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, [billingId, mode, reset]);

  // ── Build payload ─────────────────────────────────────────────────────────
  const buildPayload = () => {
    const values = getValues();
    const base = {
      brbDate:     values.billingDate,
      projectCode,
      partyBillNo: values.partyBillNo || "",
      partyDate:   values.partyDate || "",
    };
    if (mode === "create") base.brrId = Number(brrId);
    return {
      ...base,
      items: (values.items || []).map((it) => ({
        ...(isGRN ? { grnItemId: it.grnItemId } : { srnItemId: it.srnItemId }),
        billingQty: Number(it.billingQty),
      })),
    };
  };

  const validateItems = () => {
    const values = getValues();
    if (!values.items?.length) {
      toast.error(`Please add at least one ${isGRN ? "GRN" : "SRN"} item`);
      return false;
    }
    for (const item of values.items) {
      const qty = Number(item.billingQty);
      const max = Number(item.effectiveAvailableQty ?? item.availableQty ?? 0);
      if (!qty || qty <= 0) {
        toast.error(`${item.itemName}: billing qty must be > 0`);
        return false;
      }
      if (qty > max) {
        toast.error(`${item.itemName}: billing qty exceeds available qty`);
        return false;
      }
    }
    return true;
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!validateItems()) return;
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating BRB..." : "Updating BRB...");
      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.RESOURCE.BRB.CREATE
          : `${API_ENDPOINTS.RESOURCE.BRB.EDIT}/${billingId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });

      const newBillingId = res.data?.brbId;
      if (res.data?.brbNo)              form.setValue("billingNo",    res.data.brbNo);
      if (res.data?.ccSummary)          form.setValue("ccSummary",    res.data.ccSummary);
      if (res.data?.basicAmount != null) form.setValue("basicAmount", Number(res.data.basicAmount));
      if (res.data?.gstAmount   != null) form.setValue("gstAmount",   Number(res.data.gstAmount));
      if (res.data?.totalAmount != null) form.setValue("totalAmount", Number(res.data.totalAmount));

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      // Clear cached items context so next modal open fetches fresh available quantities
      if (mode === "edit") setBrrContext(null);
      toast.success("Draft saved", { id: toastId });

      if (mode === "create" && newBillingId) {
        const bt = isGRN ? "grn" : "srn";
        setTimeout(() => {
          router.push(
            `/resource-management/sub-contractor-billing/e-reconcile-bill/${newBillingId}?billingType=${bt}`
          );
        }, 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    if (!validateItems()) return;
    let toastId;
    try {
      toastId = toast.loading("Submitting BRB...");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.BRB.SUBMIT}/${billingId}`,
        method: "POST",
      });
      toast.success("Submitted for approval", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    }
  };

  // ── Edit / Cancel ─────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
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

  return (
    <>
      <div className="flex flex-col xl:flex-row items-start gap-5 p-3">
        {/* LEFT PANEL */}
        {sidebarOpen && (
          <BRRBillingLeftPanel
            form={form}
            disabled={disabled}
            billingType={billingType}
          />
        )}

        {/* COLLAPSE DIVIDER */}
        <div className="hidden xl:flex flex-col items-center self-stretch">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Collapse panel" : "Expand panel"}
            className={`flex items-center justify-center w-5 h-10 rounded border transition shrink-0 my-1
              ${sidebarOpen
                ? "bg-sky-100 border-sky-300 hover:bg-sky-200 text-sky-600"
                : "bg-[#7fc3d4] border-[#4a9fb5] hover:bg-[#6ab8cb] text-white"}`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        {/* RIGHT PANEL */}
        <div className="w-full flex-1 min-w-0 overflow-x-auto">
          <div className="min-w-[900px]">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-[2px]">
                <TabsList className="h-auto bg-transparent p-0 gap-[2px] rounded-none border-0 shadow-none flex flex-wrap">
                  {["summary", "details"].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none capitalize"
                      style={{ clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)" }}
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex items-center gap-2 lg:justify-end">
                  {activeTab === "details" && !disabled && (
                    <button
                      type="button"
                      onClick={() => setOpenItemModal(true)}
                      className="h-[34px] min-w-[170px] px-4 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition"
                    >
                      {`+ Add ${isGRN ? "GRN" : "SRN"} Items`}
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-[#CFCFCF] bg-white">
                <TabsContent value="details" className="m-0">
                  <BRRBillingDetailsTab
                    form={form}
                    disabled={disabled}
                    billingType={billingType}
                    brrId={effectiveBrrId}
                    brrContext={brrContext}
                    onContextFetched={setBrrContext}
                    openItemModal={openItemModal}
                    setOpenItemModal={setOpenItemModal}
                  />
                </TabsContent>
                <TabsContent value="summary" className="m-0">
                  <BRRBillingSummaryTab form={form} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5 px-3 pb-3">
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
            confirmationTitle="Submit BRB?"
            confirmationMessage="Once submitted, this will go for approval."
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
