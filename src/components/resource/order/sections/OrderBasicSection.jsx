"use client";

import { useEffect, useState } from "react";

import { Download, FileText, Upload } from "lucide-react";

import { Controller } from "react-hook-form";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import ExpandableTextField from "@/components/common/ExpandableTextField";

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

import { CATEGORY_OPTIONS } from "@/config/categoryOptions.config";

import { getInputClass, labelClass } from "@/lib/formStyles";

import { getLocalStorage } from "@/lib/localStorage";

export default function OrderBasicSection({
  form,

  disabled,

  fileName,

  setFileName,

  fileUrl,

  setFileUrl,

  attachedFile,

  setAttachedFile,

  fileRef,
}) {
  const [ledgerList, setLedgerList] = useState([]);

  const [billingOptions, setBillingOptions] = useState([]);

  const [shippingOptions, setShippingOptions] = useState([]);

  const {
    register,

    control,

    setValue,

    watch,

    formState: { errors },
  } = form;

  const projectInfo = getLocalStorage("projectInfo");

  const projectId = projectInfo?.projectId;

  const selectedVendorId = watch("vendorId");

  // LOAD LEDGERS

  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER,

          method: "GET",
        });

        setLedgerList(res.data || []);
      } catch {
        toast.error("Failed to load vendors");
      }
    };

    fetchLedgers();
  }, []);

  // LOAD PROJECT

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const fetchProject = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,

          method: "GET",
        });

        const data = res.data?.[0];

        if (!data) {
          return;
        }

        const billing = [];

        const shipping = [];

        if (data.billingAddress) {
          billing.push(data.billingAddress);
        }

        if (data.shippingAddress) {
          shipping.push(data.shippingAddress);
        }

        if (data.shippingAddress2) {
          shipping.push(data.shippingAddress2);
        }

        if (data.shippingAddress3) {
          shipping.push(data.shippingAddress3);
        }

        setBillingOptions(billing);

        setShippingOptions(shipping);
      } catch {
        toast.error("Failed to load project details");
      }
    };

    fetchProject();
  }, [projectId]);

  // VENDOR AUTO FILL

  useEffect(() => {
    if (!selectedVendorId) {
      setValue("partyAddress", "");

      setValue("gstn", "");

      setValue("contactPerson", "");

      setValue("contactNumber", "");

      return;
    }

    const selectedVendor = ledgerList.find(
      (item) => String(item.ledgerId) === String(selectedVendorId),
    );

    if (!selectedVendor) {
      return;
    }

    setValue(
      "partyAddress",

      selectedVendor.corporateAddress || "",
    );

    setValue(
      "gstn",

      selectedVendor.gstin || "",
    );

    setValue("contactPerson", selectedVendor.primaryContactPerson || "");

    setValue("contactNumber", selectedVendor.primaryContactNumber || "");
  }, [selectedVendorId, ledgerList, setValue]);

  return (
    <div
      className="
      grid
    grid-cols-1
    md:grid-cols-2
    xl:grid-cols-1

    gap-x-6
    gap-y-5
    "
    >
      {/* CATEGORY SECTION */}

      <div
        className="
        flex
        flex-col
        gap-[2px] break-inside-avoid
        
      "
      >
        {/* CATEGORY */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Category
          </div>

          <div
            className="
            w-[220px]
            min-w-[220px]
            max-w-[220px]
          "
          >
            <Controller
              control={control}
              name="categoryCode"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`${getInputClass(errors.categoryCode, disabled)} w-full
            h-[36px]`}
                  >
                    <SelectValue placeholder="Purchases/Work/Service" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Purchases">Purchases</SelectItem>

                    <SelectItem value="Work">Work</SelectItem>

                    <SelectItem value="Service">Service</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* SUB CATEGORY */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Sub Category
          </div>

          <div
            className="
            w-[220px]
            min-w-[220px]
            max-w-[220px]
          "
          >
            <Controller
              control={control}
              name="subCategoryCode"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`${getInputClass(errors.subCategoryCode, disabled)} w-full
            h-[36px]`}
                  >
                    <SelectValue placeholder="Materials/Composite/PRW/Hire" />
                  </SelectTrigger>

                  <SelectContent>
                    {CATEGORY_OPTIONS.itemCategory.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* ORDER SECTION */}

      <div
        className="
        flex
        flex-col
        gap-[2px] break-inside-avoid
      "
      >
        {/* ORDER NO */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Order No
          </div>

          <Input
            {...register("orderNo")}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px]
            h-[34px]`}
          />
        </div>

        {/* ORDER DATE */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Order Date
          </div>

          <Input
            type="date"
            {...register("orderDate")}
            disabled={disabled}
            className={`${getInputClass(errors.orderDate, disabled)} w-[220px]
            h-[34px]`}
          />
        </div>

        {/* ORDER VALIDITY */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Order Validity
          </div>

          <Input
            type="date"
            {...register("validityDate")}
            disabled={disabled}
            className={`${getInputClass(errors.validityDate, disabled)} w-[220px]
            h-[34px]`}
          />
        </div>
      </div>

      {/* PARTY SECTION */}

      <div
        className="
        flex
        flex-col
        gap-[2px] break-inside-avoid
      "
      >
        {/* PARTY NAME */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Party Name
          </div>

          <div
            className="
            w-[220px]
          "
          >
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`${getInputClass(errors.vendorId, disabled)} w-full
            h-[36px]`}
                  >
                    <SelectValue placeholder="Filter from Vendor List" />
                  </SelectTrigger>

                  <SelectContent>
                    {ledgerList.map((ledger) => (
                      <SelectItem
                        key={ledger.ledgerId}
                        value={String(ledger.ledgerId)}
                      >
                        {ledger.ledgerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* PARTY ADDRESS */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Party Address
          </div>

          <div
            className="
    w-[220px]
    min-w-[220px]
    max-w-[220px]
  "
          >
            <Controller
              control={control}
              name="partyAddress"
              render={({ field }) => (
                <ExpandableTextField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={true}
                  title="Party Address"
                  placeholder="[Auto]"
                  minHeight="min-h-[36px]"
                  modalHeight="min-h-[220px]"
                />
              )}
            />
          </div>
        </div>

        {/* PARTY GST */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Party GSTN
          </div>

          <div
            className="
    w-[220px]
    min-w-[220px]
    max-w-[220px]
  "
          >
            <Controller
              control={control}
              name="gstn"
              render={({ field }) => (
                <ExpandableTextField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={true}
                  title="Party GSTN"
                  placeholder="[Auto]"
                  minHeight="min-h-[36px]"
                  modalHeight="min-h-[180px]"
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* PROJECT SECTION */}

      <div
        className="
        flex
        flex-col
        gap-[2px] break-inside-avoid
      "
      >
        {/* SITE */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Site
          </div>

          <Input
            value={projectInfo?.projectCode || ""}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px]
            h-[34px]`}
          />
        </div>

        {/* BILLING */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Billing Address
          </div>

          <div className="w-[220px]">
            <Controller
              control={control}
              name="billingAddress"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`${getInputClass(errors.billingAddress, disabled)} w-full`}
                  >
                    <SelectValue placeholder="Select Billing Address" />
                  </SelectTrigger>

                  <SelectContent>
                    {billingOptions.map((item, index) => (
                      <SelectItem key={index} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* SHIPPING */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Shipping Address
          </div>

          <div className="w-[220px]">
            <Controller
              control={control}
              name="shippingAddress"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger
                    className={`${getInputClass(errors.shippingAddress, disabled)} w-full`}
                  >
                    <SelectValue placeholder="Select Shipping Address" />
                  </SelectTrigger>

                  <SelectContent>
                    {shippingOptions.map((item, index) => (
                      <SelectItem key={index} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* CONTACT SECTION */}

      <div
        className="
        flex
        flex-col
        gap-[2px] break-inside-avoid
      "
      >
        {/* CONTACT PERSON */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Contact Person
          </div>

          <Input
            {...register("contactPerson")}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px]
            h-[34px]`}
          />
        </div>

        {/* CONTACT NUMBER */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Contact Number
          </div>

          <Input
            {...register("contactNumber")}
            disabled
            placeholder="[Auto]"
            className={`${getInputClass(false, true)} w-[220px]
            h-[34px]`}
          />
        </div>
      </div>

      {/* QUOTATION SECTION */}

      <div
        className="
    flex
    flex-col
    gap-[2px] break-inside-avoid
  "
      >
        {/* QUOTATION NO */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Quotation No
          </div>

          <Input
            {...register("quotationNo")}
            disabled={disabled}
            className={`${getInputClass(errors.quotationNo, disabled)} w-[220px]
         min-w-[220px]
         max-w-[220px]
            h-[34px]`}
          />
        </div>

        {/* QUOTATION DATE */}

        <div className="flex items-center">
          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Quotation Date
          </div>

          <Input
            type="date"
            {...register("quotationDate")}
            disabled={disabled}
            className={`${getInputClass(errors.quotationDate, disabled)} w-[220px]
         min-w-[220px]
         max-w-[220px]
            h-[34px]`}
          />
        </div>
      </div>

      {/* ORDER MESSAGE SECTION */}

      <div>
        <div className="flex items-start">
          {/* LABEL */}

          <div
            className={`${labelClass} w-[180px] min-w-[180px] max-w-[180px]`}
          >
            Order Message
          </div>

          {/* FIELD */}

          <div
            className="
        w-[220px]
        min-w-[220px]
        max-w-[220px]
        overflow-hidden
    break-words
      "
          >
            <Controller
              control={control}
              name="orderMessage"
              render={({ field }) => (
                <ExpandableTextField
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disabled}
                  error={errors.orderMessage}
                  title="Order Message"
                  placeholder="Text"
                  minHeight="min-h-[36px]"
                  modalHeight="min-h-[220px]"
                  className="
    break-all
    whitespace-pre-wrap
  "
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* FILE SECTION */}

      <div>
        {/* FILE LABEL */}
        <div
          className="
            inline-flex
            items-center
            justify-center
            min-h-[38px]
            px-6
            bg-[#FFE7A3]
            border
            border-[#E29B34]
            rounded-[8px]
            text-[15px]
            font-semibold
            text-black
    "
        >
          Attached Party Quotation
        </div>

        {/* FILE AREA */}
        <div className="mt-3">
          {!disabled ? (
            <div className="w-[220px]">
              {/* Hidden native input — always mounted so ref works */}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (!file) {
                    // User opened picker and cancelled — clear state
                    setAttachedFile(null);
                    setFileName("");
                    if (fileUrl?.startsWith("blob:")) {
                      URL.revokeObjectURL(fileUrl);
                    }
                    setFileUrl("");
                    // Reset input so onChange fires again next time same file picked
                    if (fileRef.current) fileRef.current.value = "";
                    return;
                  }

                  // New file selected
                  setAttachedFile(file);
                  setFileName(file.name);
                  if (fileUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(fileUrl);
                  }
                  setFileUrl(URL.createObjectURL(file));
                  // Reset so re-selecting same file still triggers onChange
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />

              {fileName ? (
                /* FILE SELECTED STATE — show filename, click to change */
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="
                        w-full
                        h-[36px]
                        px-3
                        flex
                        items-center
                        gap-2
                        rounded-md
                        border
                        border-gray-300
                        bg-gray-50
                        hover:bg-gray-100
                        transition-colors
                        cursor-pointer
                        text-left
            "
                >
                  <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                  <span
                    className="text-sm text-gray-700 truncate flex-1"
                    title={fileName}
                  >
                    {fileName}
                  </span>
                </button>
              ) : (
                /* NO FILE STATE — styled clickable upload area */
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="
              w-full
              h-[36px]
              px-3
              flex
              items-center
              gap-2
              rounded-md
              border
              border-dashed
              border-gray-300
              bg-white
              hover:bg-gray-50
              hover:border-gray-400
              transition-colors
              cursor-pointer
              text-left
            "
                >
                  <Upload className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-400">
                    Click to upload PDF
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* DISABLED — download only */
            !attachedFile &&
            fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="
                  inline-flex
                  items-center
                  gap-2
                  text-blue-700
                  text-sm
                  font-medium
                  hover:underline
          "
              >
                <Download className="w-4 h-4" />
                Download Attachment
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}
