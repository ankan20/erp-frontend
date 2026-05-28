"use client";

import { useEffect, useRef, useState } from "react";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { Loader2, Plus } from "lucide-react";

import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import SaveButton from "@/components/common/SaveButton";

import EditButton from "@/components/common/EditButton";

import SaveDraftButton from "@/components/common/SaveDraftButton";

import OrderBasicSection from "./sections/OrderBasicSection";

import OrderItemsTab from "./tabs/OrderItemsTab";

import OrderTermsTab from "./tabs/OrderTermsTab";

import OrderSummaryTab from "./tabs/OrderSummaryTab";

import { orderSchema } from "./schema/order.schema";

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

import { getLocalStorage } from "@/lib/localStorage";

const defaultValues = {
  categoryCode: "Purchases",

  subCategoryCode: "",

  vendorId: "",

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

export default function OrderForm({
  mode = "create",

  orderId,
}) {
  const [activeTab, setActiveTab] = useState("items");

  const [loading, setLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(mode === "create");

  const [isSubmitted, setIsSubmitted] = useState(false);

  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");

  const [fileName, setFileName] = useState("");

  const [fileUrl, setFileUrl] = useState("");

  const [attachedFile, setAttachedFile] = useState(null);

  const [initialData, setInitialData] = useState(null);

  const [initialFileData, setInitialFileData] = useState({
    fileName: "",

    fileUrl: "",
  });

  const fileRef = useRef(null);

  const projectInfo = getLocalStorage("projectInfo");

  const projectCode = projectInfo?.projectCode;

  const form = useForm({
    resolver: zodResolver(orderSchema),

    defaultValues,

    mode: "onChange",
  });
  const [openTermsModal, setOpenTermsModal] = useState(false);
  const [openItemModal, setOpenItemModal] = useState(false);

  const {
    reset,

    watch,

    setValue,

    getValues,

    handleSubmit,

    formState: { isSubmitting },
  } = form;

  const disabled =
    mode === "view" ||
    mode === "approver" ||
    !isEditing ||
    isSubmitted ||
    isSubmitting;

  const items = watch("items") || [];

  // LOAD ORDER

  useEffect(() => {
    if (mode === "create" || !orderId) {
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);

        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.ORDER.GET_ORDER_BY_ID}/${orderId}`,

          method: "GET",
        });

        const data = res.data;

        const formattedData = {
          categoryCode: data.categoryCode || "Purchases",

          subCategoryCode: data.subCategoryCode || "",

          vendorId: String(data.vendorId || ""),

          orderNo: data.orderNo || "",

          orderDate: data.orderDate || "",

          validityDate: data.validityDate || "",

          // partyAddress: data.partyAddress || "",

          // gstn: data.gstn || "",

          site: data.projectCode || "",

          billingAddress: data.billingAddress || "",

          shippingAddress: data.shippingAddress || "",

          // contactPerson: data.contactPerson || "",

          // contactNumber: data.contactNumber || "",

          quotationNo: data.quotationNo || "",

          quotationDate: data.quotationDate || "",

          orderMessage: data.orderMessage || "",

          gstType: data.gstType || "",

          items: data.items || [],

          terms: data.terms || [],

          ccSummary: data.ccSummary || [],

          basicAmount: Number(data.basicAmount || 0),

          gstAmount: Number(data.gstAmount || 0),

          totalAmount: Number(data.totalAmount || 0),
        };

        reset(formattedData);

        setInitialData(formattedData);

        setFileUrl(data.attachedQuota || "");

        const extractedFileName = data.attachedQuota?.split("/")?.pop() || "";

        setInitialFileData({
          fileName: extractedFileName,

          fileUrl: data.attachedQuota || "",
        });

        if (
          data.status !== "Reback" &&
          data.status !== "Draft" &&
          mode === "edit"
        ) {
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

  // BUILD FORM DATA

  const buildFormData = () => {
    const values = getValues();

    const formData = new FormData();

    formData.append("projectCode", projectCode);

    formData.append("categoryCode", values.categoryCode);

    formData.append("subCategoryCode", values.subCategoryCode);

    formData.append("vendorId", values.vendorId);

    formData.append("orderDate", values.orderDate);

    formData.append("validityDate", values.validityDate);

    formData.append("billingAddress", values.billingAddress);

    formData.append("shippingAddress", values.shippingAddress);

    formData.append("contactPerson", values.contactPerson);

    formData.append("contactNumber", values.contactNumber);

    formData.append("quotationNo", values.quotationNo);

    formData.append("quotationDate", values.quotationDate);

    formData.append("orderMessage", values.orderMessage?.trim());

    formData.append(
      "items",

      JSON.stringify(
        values.items.map((item) => ({
          indentItemId: item.indentItemId,

          qty: Number(item.qty),

          rate: Number(item.rate),

          gstPercent: Number(item.gstPercent),

          note: item.note || "",
        })),
      ),
    );

    formData.append(
      "terms",

      JSON.stringify(
        values.terms.map((term) => ({
          termId: term.termId,
          description: term.description || "",
        })),
      ),
    );

    if (attachedFile) {
      formData.append("orderFile", attachedFile);
    }

    return formData;
  };

  // SAVE DRAFT

  const handleSaveDraft = async () => {
    let toastId;
    console.log("working");
    let values = getValues();
    const validItems = values.items?.filter((item) => item?.indentItemId) || [];

    if (!validItems.length) {
      toast.error("Please add at least one order item");

      return;
    }

    const validTerms = values.terms?.filter((term) => term?.termId) || [];

    if (!validTerms.length) {
      toast.error("Please add at least one term & condition");

      return;
    }

    try {
      toastId = toast.loading(
        mode === "create" ? "Creating order..." : "Updating order...",
      );

      const payload = buildFormData();

      const res = await apiRequest({
        url:
          mode === "create"
            ? API_ENDPOINTS.RESOURCE.ORDER.CREATE_ORDER
            : `${API_ENDPOINTS.RESOURCE.ORDER.UPDATE_ORDER_BY_ID}${orderId}`,

        method: mode === "create" ? "POST" : "PUT",

        data: payload,
      });

      if (res?.data?.orderNo) {
        setValue(
          "orderNo",

          res.data.orderNo,
        );
      }

      if (res?.data?.orderFile) {
        setFileUrl(res.data.orderFile);

        setInitialFileData({
          fileName: res.data.orderFile?.split("/")?.pop() || "",

          fileUrl: res.data.orderFile,
        });
      }

      setInitialData(getValues());

      setIsEditing(false);

      setAllowSubmit(true);

      toast.success(
        "Draft saved successfully",

        {
          id: toastId,
        },
      );
    } catch (err) {
      toast.error(
        err.message || "Failed to save draft",

        {
          id: toastId,
        },
      );
    }
  };

  // SUBMIT

  const onSubmit = async () => {
    let values = getValues();
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
        url: `${API_ENDPOINTS.RESOURCE.ORDER.SUBMIT_ORDER_BY_ID}${orderId}`,

        method: "POST",
      });

      toast.success(
        "Order submitted successfully",

        {
          id: toastId,
        },
      );

      setIsSubmitted(true);

      setIsEditing(false);

      setAllowSubmit(false);
    } catch (err) {
      toast.error(
        err.message || "Failed to submit order",

        {
          id: toastId,
        },
      );
    }
  };

  // EDIT / CANCEL

  const handleEdit = () => {
    // CANCEL

    if (isEditing) {
      if (initialData) {
        reset(initialData);
      }

      setAttachedFile(null);

      setFileUrl(initialFileData.fileUrl);

      setFileName("");

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      setIsEditing(false);

      setAllowSubmit(true);

      return;
    }

    // EDIT

    setIsEditing(true);

    setAllowSubmit(false);
  };

  const validateTableSections = ({
    values,

    requireItems = false,

    requireTerms = false,
  }) => {
    // ITEMS

    if (requireItems) {
      const validItems =
        values.items?.filter((item) => item?.indentItemId) || [];

      if (!validItems.length) {
        toast.error("Please add at least one order item");

        return false;
      }
    }

    // TERMS

    if (requireTerms) {
      const validTerms = values.terms?.filter((term) => term?.termId) || [];

      if (!validTerms.length) {
        toast.error("Please add at least one term & condition");

        return false;
      }
    }

    return true;
  };

  // LOADING

  if (loading) {
    return (
      <div
        className="
          h-[300px]

          flex
          items-center
          justify-center
        "
      >
        <Loader2
          className="
            w-6
            h-6
            animate-spin
          "
        />
      </div>
    );
  }
  return (
    <>
      <div
        className="
    flex
    flex-col
    xl:flex-row
    items-start
    gap-5
    p-3
  "
      >
        {/* LEFT SECTION */}

        <div
          className="
      w-full
      xl:w-auto

      shrink-0
    "
        >
          <OrderBasicSection
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

        {/* ERP SEPARATOR */}

        <div
          className="
      hidden
      xl:block
      w-px
      self-stretch
      bg-sky-300
    "
        />

        {/* RIGHT SECTION */}

        <div
          className="
      w-full
      min-w-0

      overflow-x-auto
    "
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* TOP BAR */}

            <div
              className="
          flex
          flex-col
          lg:flex-row

          lg:items-end
          lg:justify-between

          gap-3

          mb-[2px]

          min-w-[900px]
        "
            >
              {/* LEFT TABS */}

              <TabsList
                className="
            h-auto

            bg-transparent

            p-0

            gap-[2px]

            rounded-none

            border-0

            shadow-none

            flex
            flex-wrap
          "
              >
                {/* SUMMARY */}

                <TabsTrigger
                  value="summary"
                  className="
              relative

              h-[40px]

              min-w-[125px]

              rounded-none

              border
              border-[#5B6B8C]

              border-b-0

              bg-[#E5E5E5]

              px-5

              text-[15px]
              font-semibold
              text-black

              data-[state=active]:bg-[#F4C400]

              data-[state=active]:shadow-none

              transition-none
            "
                  style={{
                    clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Summary
                </TabsTrigger>

                {/* DETAILS */}

                <TabsTrigger
                  value="items"
                  className="
              relative

              h-[40px]

              min-w-[125px]

              rounded-none

              border
              border-[#5B6B8C]

              border-b-0

              bg-[#E5E5E5]

              px-5

              text-[15px]
              font-semibold
              text-black

              data-[state=active]:bg-[#F4C400]

              data-[state=active]:shadow-none

              transition-none
            "
                  style={{
                    clipPath: "polygon(0 0, 84% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Details
                </TabsTrigger>

                {/* TERMS */}

                <TabsTrigger
                  value="terms"
                  className="
              relative

              h-[40px]

              min-w-[220px]

              rounded-none

              border
              border-[#5B6B8C]

              border-b-0

              bg-[#E5E5E5]

              px-5

              text-[15px]
              font-semibold
              text-black

              data-[state=active]:bg-[#F4C400]

              data-[state=active]:shadow-none

              transition-none
            "
                  style={{
                    clipPath: "polygon(0 0, 92% 0, 100% 100%, 0% 100%)",
                  }}
                >
                  Terms & Conditions
                </TabsTrigger>
              </TabsList>

              {/* RIGHT ACTION BUTTONS */}

              <div
                className="
            flex
            items-center
            gap-2

            lg:justify-end
          "
              >
                {/* ITEMS BUTTON */}

                {activeTab === "items" && !disabled && (
                  <button
                    type="button"
                    onClick={() => setOpenItemModal(true)}
                    className="
                  h-[34px]

                  min-w-[170px]

                  px-4

                  bg-[#9F96F2]

                  border
                  border-[#5D58A5]

                  rounded-md

                  text-black
                  text-sm
                  font-medium

                  flex
                  items-center
                  justify-center

                  hover:opacity-90
                  transition
                "
                  >
                    + Add Order Items
                  </button>
                )}

                {/* TERMS BUTTON */}

                {activeTab === "terms" && !disabled && (
                  <button
                    type="button"
                    onClick={() => setOpenTermsModal(true)}
                    className="
                  h-[34px]

                  min-w-[150px]

                  px-4

                  bg-[#9F96F2]

                  border
                  border-[#5D58A5]

                  rounded-md

                  text-black
                  text-sm
                  font-medium

                  flex
                  items-center
                  justify-center

                  hover:opacity-90
                  transition
                "
                  >
                    + Add T&C
                  </button>
                )}
              </div>
            </div>

            {/* TAB CONTENT */}

            <div
              className="
          border
          border-[#CFCFCF]

          bg-white

          min-w-[900px]
        "
            >
              {/* ITEMS */}

              <TabsContent value="items" className="m-0">
                <OrderItemsTab
                  form={form}
                  disabled={disabled}
                  openItemModal={openItemModal}
                  setOpenItemModal={setOpenItemModal}
                />
              </TabsContent>

              {/* TERMS */}

              <TabsContent value="terms" className="m-0">
                <OrderTermsTab
                  form={form}
                  disabled={disabled}
                  openTermsModal={openTermsModal}
                  setOpenTermsModal={setOpenTermsModal}
                />
              </TabsContent>

              {/* SUMMARY */}

              <TabsContent value="summary" className="m-0">
                <OrderSummaryTab form={form} disabled={disabled} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
      {/* FOOTER */}

      {mode !== "view" && mode !== "approver" && (
        <div
          className="
          flex
          justify-end
          gap-3

          mt-5
        "
        >
          {/* SAVE DRAFT */}

          {((mode === "create" && isEditing) ||
            (mode === "edit" && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => {
                const values = getValues();

                const isValid = validateTableSections({
                  values,

                  requireItems: true,

                  requireTerms: true,
                });

                if (!isValid) {
                  return;
                }

                handleSubmit(handleSaveDraft)();
              }}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}

          {/* SUBMIT */}

          <SaveButton
            onClick={() => {
              const values = getValues();

              const isValid = validateTableSections({
                values,

                requireItems: true,

                requireTerms: true,
              });

              if (!isValid) {
                return;
              }

              handleSubmit(onSubmit)();
            }}
            loading={isSubmitting}
            disabled={
              !allowSubmit ||
              isEditing ||
              isSubmitted ||
              // !items.length ||
              isSubmitting
            }
            requireConfirmation
            confirmationTitle="Submit Order?"
            confirmationMessage="Once submitted, this order will go for approval."
          >
            Submit
          </SaveButton>

          {/* EDIT */}

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
