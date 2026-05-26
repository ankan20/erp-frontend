"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import {
  Loader2,
} from "lucide-react";

import {
  toast,
} from "sonner";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import SaveButton from "@/components/common/SaveButton";

import EditButton from "@/components/common/EditButton";

import SaveDraftButton from "@/components/common/SaveDraftButton";

import OrderBasicSection from "./sections/OrderBasicSection";

import OrderItemsTab from "./tabs/OrderItemsTab";

import OrderTermsTab from "./tabs/OrderTermsTab";

import OrderSummaryTab from "./tabs/OrderSummaryTab";

import {
  orderSchema,
} from "./schema/order.schema";

import {
  apiRequest,
} from "@/lib/apiClient";

import {
  API_ENDPOINTS,
} from "@/config/api.config";

import {
  getLocalStorage,
} from "@/lib/localStorage";

const defaultValues = {

  categoryCode:
    "Purchases",

  subCategoryCode:
    "",

  vendorId:
    "",

  orderNo:
    "",

  orderDate:
    "",

  validityDate:
    "",

  partyAddress:
    "",

  gstn:
    "",

  site:
    "",

  billingAddress:
    "",

  shippingAddress:
    "",

  orderMessage:
    "",

  gstType:
    "",

  items: [],

  terms: [],

  summary: {

    basicAmount: 0,

    gstAmount: 0,

    totalAmount: 0,
  },
};

export default function OrderForm({

  mode = "create",

  orderId,
}) {

  const [activeTab, setActiveTab] =
    useState("items");

  const [loading, setLoading] =
    useState(false);

  const [isEditing, setIsEditing] =
    useState(
      mode === "create",
    );

  const [isSubmitted, setIsSubmitted] =
    useState(false);

  const [allowSubmit, setAllowSubmit] =
    useState(
      mode === "edit",
    );

  const [fileName, setFileName] =
    useState("");

  const [fileUrl, setFileUrl] =
    useState("");

  const [attachedFile, setAttachedFile] =
    useState(null);

  const [initialData, setInitialData] =
    useState(null);

  const [initialFileData, setInitialFileData] =
    useState({

      fileName: "",

      fileUrl: "",
    });

  const fileRef =
    useRef(null);

  const projectInfo =
    getLocalStorage(
      "projectInfo",
    );

  const projectCode =
    projectInfo?.projectCode;

  const disabled =

    mode === "view" ||

    mode === "approver" ||

    !isEditing ||

    isSubmitted;

  const form =
    useForm({

      resolver:
        zodResolver(
          orderSchema,
        ),

      defaultValues,

      mode:
        "onChange",
    });

  const {

    reset,

    watch,

    setValue,

    getValues,

    handleSubmit,

    formState: {

      isSubmitting,
    },
  } = form;

  const items =
    watch(
      "items",
    ) || [];

  // LOAD ORDER

  useEffect(() => {

    if (
      mode === "create" ||

      !orderId
    ) {

      return;
    }

    const fetchOrder =
      async () => {

        try {

          setLoading(
            true,
          );

          const res =
            await apiRequest({

              url:
                `${API_ENDPOINTS.RESOURCE.ORDER.GET_ORDER_BY_ID}${orderId}`,

              method:
                "GET",
            });

          const data =
            res.data;

          const formattedData = {

            categoryCode:
              data.categoryCode || "Purchases",

            subCategoryCode:
              data.subCategoryCode || "",

            vendorId:
              data.vendorId || "",

            orderNo:
              data.orderNo || "",

            orderDate:
              data.orderDate || "",

            validityDate:
              data.validityDate || "",

            partyAddress:
              data.partyAddress || "",

            gstn:
              data.gstn || "",

            site:
              data.site || "",

            billingAddress:
              data.billingAddress || "",

            shippingAddress:
              data.shippingAddress || "",

            orderMessage:
              data.orderMessage || "",

            gstType:
              data.gstType || "",

            items:
              data.items || [],

            terms:
              data.terms || [],

            summary:
              data.summary || {

                basicAmount: 0,

                gstAmount: 0,

                totalAmount: 0,
              },
          };

          reset(
            formattedData,
          );

          setInitialData(
            formattedData,
          );

          setFileUrl(
            data.orderFile ||
              "",
          );

          const extractedFileName =
            data.orderFile
              ?.split("/")
              ?.pop() || "";

          setInitialFileData({

            fileName:
              extractedFileName,

            fileUrl:
              data.orderFile ||
              "",
          });

          if (

            data.orderStatus !==
              "Reback" &&

            data.orderStatus !==
              "Draft" &&

            mode === "edit"
          ) {

            setIsSubmitted(
              true,
            );

            setIsEditing(
              false,
            );

          } else {

            setIsEditing(
              false,
            );

            setAllowSubmit(
              true,
            );
          }

        } catch (err) {

          toast.error(
            err.message ||
              "Failed to load order",
          );

        } finally {

          setLoading(
            false,
          );
        }
      };

    fetchOrder();

  }, [
    orderId,
    mode,
    reset,
  ]);

  // BUILD FORM DATA

  const buildFormData =
    () => {

      const values =
        getValues();

      const formData =
        new FormData();

      formData.append(
        "projectCode",
        projectCode,
      );

      formData.append(
        "categoryCode",
        values.categoryCode,
      );

      formData.append(
        "subCategoryCode",
        values.subCategoryCode,
      );

      formData.append(
        "vendorId",
        values.vendorId,
      );

      formData.append(
        "orderDate",
        values.orderDate,
      );

      formData.append(
        "validityDate",
        values.validityDate,
      );

      formData.append(
        "billingAddress",
        values.billingAddress,
      );

      formData.append(
        "shippingAddress",
        values.shippingAddress,
      );

      formData.append(
        "orderMessage",
        values.orderMessage?.trim(),
      );

      formData.append(

        "items",

        JSON.stringify(

          values.items.map(
            (
              item,
            ) => ({

              indentItemId:
                item.indentItemId,

              qty:
                Number(
                  item.qty,
                ),

              rate:
                Number(
                  item.rate,
                ),

              gstPercent:
                Number(
                  item.gstPercent,
                ),
            }),
          ),
        ),
      );

      formData.append(

        "terms",

        JSON.stringify(

          values.terms.map(
            (
              term,
            ) =>
              term.termId,
          ),
        ),
      );

      if (
        attachedFile
      ) {

        formData.append(
          "orderFile",
          attachedFile,
        );
      }

      return formData;
    };

  // SAVE DRAFT

  const handleSaveDraft =
    async () => {

      let toastId;

      try {

        toastId =
          toast.loading(
            mode === "create"
              ? "Creating order..."
              : "Updating order...",
          );

        const payload =
          buildFormData();

        const res =
          await apiRequest({

            url:

              mode ===
              "create"

                ? API_ENDPOINTS
                    .RESOURCE
                    .ORDER
                    .CREATE_ORDER

                : `${API_ENDPOINTS.RESOURCE.ORDER.UPDATE_ORDER_BY_ID}${orderId}`,

            method:

              mode ===
              "create"

                ? "POST"

                : "PUT",

            data:
              payload,
          });

        if (
          res?.data?.orderNo
        ) {

          setValue(
            "orderNo",

            res.data.orderNo,
          );
        }

        if (
          res?.data?.orderFile
        ) {

          setFileUrl(
            res.data.orderFile,
          );

          setInitialFileData({

            fileName:
              res.data.orderFile
                ?.split("/")
                ?.pop() || "",

            fileUrl:
              res.data.orderFile,
          });
        }

        setInitialData(
          getValues(),
        );

        setIsEditing(
          false,
        );

        setAllowSubmit(
          true,
        );

        toast.success(
          "Draft saved successfully",

          {
            id: toastId,
          },
        );

      } catch (err) {

        toast.error(

          err.message ||
            "Failed to save draft",

          {
            id: toastId,
          },
        );
      }
    };

  // SUBMIT

  const onSubmit =
    async () => {

      if (
        !items.length
      ) {

        toast.error(
          "Please add at least one item",
        );

        return;
      }

      let toastId;

      try {

        toastId =
          toast.loading(
            "Submitting order...",
          );

        await apiRequest({

          url:
            `${API_ENDPOINTS.RESOURCE.ORDER.SUBMIT_ORDER_BY_ID}${orderId}`,

          method:
            "POST",
        });

        toast.success(
          "Order submitted successfully",

          {
            id: toastId,
          },
        );

        setIsSubmitted(
          true,
        );

        setIsEditing(
          false,
        );

        setAllowSubmit(
          false,
        );

      } catch (err) {

        toast.error(

          err.message ||
            "Failed to submit order",

          {
            id: toastId,
          },
        );
      }
    };

  // EDIT / CANCEL

  const handleEdit =
    () => {

      // CANCEL

      if (
        isEditing
      ) {

        if (
          initialData
        ) {

          reset(
            initialData,
          );
        }

        setAttachedFile(
          null,
        );

        setFileUrl(
          initialFileData.fileUrl,
        );

        setFileName(
          "",
        );

        if (
          fileRef.current
        ) {

          fileRef.current.value =
            "";
        }

        setIsEditing(
          false,
        );

        setAllowSubmit(
          true,
        );

        return;
      }

      // EDIT

      setIsEditing(
        true,
      );

      setAllowSubmit(
        false,
      );
    };

  // LOADING

  if (
    loading
  ) {

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

    <div
      className="
        p-3
        space-y-4
      "
    >

      {/* BASIC */}

      <OrderBasicSection

        form={form}

        disabled={
          disabled
        }

        fileName={
          fileName
        }

        setFileName={
          setFileName
        }

        fileUrl={
          fileUrl
        }

        setFileUrl={
          setFileUrl
        }

        attachedFile={
          attachedFile
        }

        setAttachedFile={
          setAttachedFile
        }

        fileRef={
          fileRef
        }
      />

      {/* TABS */}

      <Tabs

        value={
          activeTab
        }

        onValueChange={
          setActiveTab
        }
      >

        <TabsList>

          <TabsTrigger value="items">
            Items
          </TabsTrigger>

          <TabsTrigger value="terms">
            Terms & Conditions
          </TabsTrigger>

          <TabsTrigger value="summary">
            Summary
          </TabsTrigger>

        </TabsList>

        {/* ITEMS */}

        <TabsContent value="items">

          <OrderItemsTab

            form={form}

            disabled={
              disabled
            }
          />

        </TabsContent>

        {/* TERMS */}

        <TabsContent value="terms">

          <OrderTermsTab

            form={form}

            disabled={
              disabled
            }
          />

        </TabsContent>

        {/* SUMMARY */}

        <TabsContent value="summary">

          <OrderSummaryTab

            form={form}

            disabled={
              disabled
            }
          />

        </TabsContent>

      </Tabs>

      {/* FOOTER */}

      {(mode !==
        "view" &&

        mode !==
          "approver") && (

        <div
          className="
            flex
            justify-end
            gap-3
          "
        >

          {/* SAVE DRAFT */}

          {((mode ===
            "create" &&

            isEditing) ||

            (mode ===
              "edit" &&

              isEditing &&

              !isSubmitted)) && (

            <SaveDraftButton

              onClick={() =>
                handleSubmit(
                  handleSaveDraft,
                )()
              }

              loading={
                isSubmitting
              }

              disabled={
                isSubmitting
              }

              requireConfirmation
            />
          )}

          {/* SUBMIT */}

          <SaveButton

            onClick={() =>
              handleSubmit(
                onSubmit,
              )()
            }

            loading={
              isSubmitting
            }

            disabled={

              !allowSubmit ||

              isEditing ||

              isSubmitted ||

              !items.length ||

              isSubmitting
            }

            requireConfirmation

            confirmationTitle="Submit Order?"

            confirmationMessage="Once submitted, this order will go for approval."
          >

            Submit

          </SaveButton>

          {/* EDIT */}

          {mode ===
            "edit" &&

            !isSubmitted && (

            <EditButton

              onClick={
                handleEdit
              }

              disabled={
                isSubmitting
              }
            >

              {isEditing
                ? "Cancel"
                : "Edit"}

            </EditButton>
          )}

        </div>
      )}

    </div>
  );
}