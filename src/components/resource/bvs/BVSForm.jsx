"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import SaveDraftButton from "@/components/common/SaveDraftButton";
import BVSLeftPanel from "./BVSLeftPanel";
import BVSDetailsTab from "./tabs/BVSDetailsTab";
import BVSSummaryTab from "./tabs/BVSSummaryTab";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useRouter } from "next/navigation";

const bvsSchema = z.object({
  categoryCode: z.string().min(1, "Required"),
  costHead: z.string().min(1, "Required"),
  vendorId: z.string().min(1, "Required"),
  bvsNo: z.string().optional(),
  bvsDate: z.string().min(1, "Required"),
  partyBillNo: z.string().min(1, "Required"),
  partyDate: z.string().min(1, "Required"),
  orderId: z.string().min(1, "Required"),
  itemCategory: z.string().optional(),
  billingAddress: z.string().min(1, "Required"),
  shippingAddress: z.string().min(1, "Required"),
  partyAddress: z.string().optional(),
  gstn: z.string().optional(),
  gstType: z.string().optional(),
  items: z.array(z.any()).optional(),
  ccSummary: z.array(z.any()).optional(),
  basicAmount: z.number().optional(),
  gstAmount: z.number().optional(),
  totalAmount: z.number().optional(),
});

const defaultValues = {
  categoryCode: "Purchases_Order",
  costHead: "",
  itemCategory: "MAT_001",
  vendorId: "",
  bvsNo: "",
  bvsDate: "",
  partyBillNo: "",
  partyDate: "",
  orderId: "",
  billingAddress: "",
  shippingAddress: "",
  partyAddress: "",
  gstn: "",
  gstType: "",
  items: [],
  ccSummary: [],
  basicAmount: 0,
  gstAmount: 0,
  totalAmount: 0,
};

export default function BVSForm({ mode = "create", bvsId }) {
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [initialData, setInitialData] = useState(null);
  const [openItemModal, setOpenItemModal] = useState(false);
  const router = useRouter();

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode;

  const form = useForm({
    resolver: zodResolver(bvsSchema),
    defaultValues,
    mode: "onChange",
  });

  const { reset, watch, getValues, handleSubmit, formState: { isSubmitting } } = form;

  const disabled =
    mode === "view" ||
    mode === "approver" ||
    !isEditing ||
    isSubmitted ||
    isSubmitting;

  // LOAD BVS
  useEffect(() => {
    if (mode === "create" || !bvsId) return;

    const fetchBVS = async () => {
      try {
        setLoading(true);
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.GET_BVS_BY_ID}/${bvsId}`,
          method: "GET",
        });
        const d = res.data;

        const items = (d.items || []).map((it) => ({
          ...it,
          effectiveAvailableQty: Number(it.availableQty ?? 0) + Number(it.billingQty ?? 0),
        }));

        const formattedData = {
          categoryCode: d.receivedCategory || "Purchases_Order",
          costHead: d.costHead || "",
          vendorId: String(d.vendorId || ""),
          bvsNo: d.bvsNo || "",
          bvsDate: d.bvsDate || "",
          partyBillNo: d.partyBillNo || "",
          partyDate: d.partyDate || "",
          orderId: String(d.orderId || ""),
          billingAddress: d.billingAddress || "",
          shippingAddress: d.shippingAddress || "",
          partyAddress: d.partyAddress || "",
          gstn: d.gstn || "",
          gstType: d.gstType || "",
          items,
          ccSummary: d.ccSummary || [],
          basicAmount: Number(d.basicAmount || 0),
          gstAmount: Number(d.gstAmount || 0),
          totalAmount: Number(d.totalAmount || 0),
        };

        reset(formattedData);
        setInitialData(formattedData);

        const isEditableStatus = ["draft", "reback"].includes(
          (d.workflowStatus || "").toLowerCase(),
        );
        if (mode === "edit" && !isEditableStatus) {
          setIsSubmitted(true);
          setIsEditing(false);
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load BVS");
      } finally {
        setLoading(false);
      }
    };

    fetchBVS();
  }, [bvsId, mode, reset]);

  // BUILD JSON PAYLOAD
  const buildPayload = () => {
    const values = getValues();
    return {
      projectCode,
      receivedCategory: values.categoryCode,
      itemCategory: "MAT_001",
      costHead: values.costHead,
      vendorId: Number(values.vendorId),
      bvsDate: values.bvsDate,
      partyBillNo: values.partyBillNo,
      partyDate: values.partyDate,
      orderId: Number(values.orderId),
      site: projectCode,
      billingAddress: values.billingAddress,
      shippingAddress: values.shippingAddress,
      gstType: values.gstType || "",
      items: (values.items || []).map((item) => ({
        grnItemId: item.grnItemId,
        billingQty: Number(item.billingQty),
      })),
    };
  };

  const validateItems = () => {
    const values = getValues();
    if (!values.items?.length) {
      toast.error("Please add at least one GRN item");
      return false;
    }
    for (const item of values.items) {
      const qty = Number(item.billingQty);
      const max = Number(item.effectiveAvailableQty ?? item.availableQty ?? 0);
      if (!qty || qty <= 0) {
        toast.error(`${item.itemName}: billing qty must be greater than 0`);
        return false;
      }
      if (qty > max) {
        toast.error(`${item.itemName}: billing qty exceeds available qty`);
        return false;
      }
    }
    return true;
  };

  // SAVE DRAFT
  const handleSaveDraft = async () => {
    if (!validateItems()) return;
    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating BVS..." : "Updating BVS...");
      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.CREATE_BVS
            : `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.UPDATE_BVS_BY_ID}/${bvsId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });

      if (res?.data?.bvsNo) form.setValue("bvsNo", res.data.bvsNo);

      setInitialData(getValues());
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success("Draft saved successfully", { id: toastId });

      if (mode === "create" && res.data?.bvsId) {
        setTimeout(() => {
          router.push(`/resource-management/vendor-billing/grn/${res.data.bvsId}`);
        }, 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    }
  };

  // SUBMIT
  const onSubmit = async () => {
    if (!validateItems()) return;
    let toastId;
    try {
      toastId = toast.loading("Submitting BVS...");
      await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.VENDOR_BILLING.BVS.SUBMIT_BVS_BY_ID}/${bvsId}`,
        method: "POST",
      });
      toast.success("BVS submitted successfully", { id: toastId });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
    } catch (err) {
      toast.error(err.message || "Failed to submit BVS", { id: toastId });
    }
  };

  // EDIT / CANCEL
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
        {/* LEFT SECTION */}
        <div className="w-full xl:w-auto shrink-0">
          <BVSLeftPanel form={form} disabled={disabled} />
        </div>

        <div className="hidden xl:block w-px self-stretch bg-sky-300" />

        {/* RIGHT SECTION */}
        <div className="w-full flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-[2px] min-w-[900px]">
              <TabsList className="h-auto bg-transparent p-0 gap-[2px] rounded-none border-0 shadow-none flex flex-wrap">
                <TabsTrigger
                  value="summary"
                  className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none"
                  style={{ clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)" }}
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="relative h-[40px] min-w-[125px] rounded-none border border-[#5B6B8C] border-b-0 bg-[#E5E5E5] px-5 text-[15px] font-semibold text-black data-[state=active]:bg-[#F4C400] data-[state=active]:shadow-none transition-none"
                  style={{ clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)" }}
                >
                  Details
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 lg:justify-end">
                {activeTab === "details" && !disabled && (
                  <button
                    type="button"
                    onClick={() => setOpenItemModal(true)}
                    className="h-[34px] min-w-[170px] px-4 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition"
                  >
                    + Add GRN Items
                  </button>
                )}
              </div>
            </div>

            <div className="border border-[#CFCFCF] bg-white min-w-[900px]">
              <TabsContent value="details" className="m-0">
                <BVSDetailsTab
                  form={form}
                  disabled={disabled}
                  openItemModal={openItemModal}
                  setOpenItemModal={setOpenItemModal}
                />
              </TabsContent>
              <TabsContent value="summary" className="m-0">
                <BVSSummaryTab form={form} disabled={disabled} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {mode !== "view" && mode !== "approver" && (
        <div className="flex justify-end gap-3 mt-5">
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
            confirmationTitle="Submit BVS?"
            confirmationMessage="Once submitted, this BVS will go for approval."
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
