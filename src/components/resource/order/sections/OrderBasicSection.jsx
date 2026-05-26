"use client";

import { useEffect, useState } from "react";

import { Download } from "lucide-react";

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

import { getInputClass } from "@/lib/formStyles";

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

  const [ledgerList, setLedgerList] =
    useState([]);

  const [billingOptions, setBillingOptions] =
    useState([]);

  const [shippingOptions, setShippingOptions] =
    useState([]);

  const {

    register,

    control,

    setValue,

    watch,

    formState: {
      errors,
    },
  } = form;

  const projectInfo =
    getLocalStorage(
      "projectInfo",
    );

  const projectId =
    projectInfo?.projectId;

  const selectedVendorId =
    watch(
      "vendorId",
    );

  // LOAD LEDGERS

  useEffect(() => {

    const fetchLedgers =
      async () => {

        try {

          const res =
            await apiRequest({

              url:
                API_ENDPOINTS
                  .MASTER
                  .GET_ALL_LEDGER,

              method:
                "GET",
            });

          setLedgerList(
            res.data || [],
          );

        } catch {

          toast.error(
            "Failed to load vendors",
          );
        }
      };

    fetchLedgers();

  }, []);

  // LOAD PROJECT

  useEffect(() => {

    if (!projectId) {
      return;
    }

    const fetchProject =
      async () => {

        try {

          const res =
            await apiRequest({

              url:
                `${API_ENDPOINTS.SETTINGS.GET_PROJECT_BY_ID}/${projectId}`,

              method:
                "GET",
            });

          const data =
            res.data?.[0];

          if (!data) {
            return;
          }

          const billing =
            [];

          const shipping =
            [];

          if (
            data.billingAddress
          ) {

            billing.push(
              data.billingAddress,
            );
          }

          if (
            data.shippingAddress
          ) {

            shipping.push(
              data.shippingAddress,
            );
          }

          if (
            data.shippingAddress2
          ) {

            shipping.push(
              data.shippingAddress2,
            );
          }

          if (
            data.shippingAddress3
          ) {

            shipping.push(
              data.shippingAddress3,
            );
          }

          setBillingOptions(
            billing,
          );

          setShippingOptions(
            shipping,
          );

        } catch {

          toast.error(
            "Failed to load project details",
          );
        }
      };

    fetchProject();

  }, [projectId]);

  // VENDOR AUTO FILL

  useEffect(() => {

    if (
      !selectedVendorId
    ) {

      setValue(
        "partyAddress",
        "",
      );

      setValue(
        "gstn",
        "",
      );

      return;
    }

    const selectedVendor =
      ledgerList.find(
        (
          item,
        ) =>

          String(
            item.ledgerId,
          ) ===
          String(
            selectedVendorId,
          ),
      );

    if (
      !selectedVendor
    ) {
      return;
    }

    setValue(

      "partyAddress",

      selectedVendor.corporateAddress ||
        "",
    );

    setValue(

      "gstn",

      selectedVendor.gstin ||
        "",
    );

  }, [
    selectedVendorId,
    ledgerList,
    setValue,
  ]);

  return (

    <div
      className="
        border
        rounded-md

        p-4

        bg-white
      "
    >

      <div
        className="
          grid

          grid-cols-1
          lg:grid-cols-2

          gap-x-6
          gap-y-4
        "
      >

        {/* CATEGORY */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Category

          </label>

          <Input

            value="Purchases"

            disabled

            className={getInputClass(
              errors.categoryCode,
              true,
            )}
          />

        </div>

        {/* SUB CATEGORY */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Sub Category

          </label>

          <Controller
            control={control}
            name="subCategoryCode"

            render={({
              field,
            }) => (

              <Select

                value={
                  field.value
                }

                onValueChange={
                  field.onChange
                }

                disabled={
                  disabled
                }
              >

                <SelectTrigger
                  className={getInputClass(
                    errors.subCategoryCode,
                    disabled,
                  )}
                >

                  <SelectValue placeholder="Select Sub Category" />

                </SelectTrigger>

                <SelectContent>

                  {CATEGORY_OPTIONS.itemCategory.map(
                    (
                      item,
                    ) => (

                      <SelectItem
                        key={
                          item.value
                        }

                        value={
                          item.value
                        }
                      >

                        {item.label}

                      </SelectItem>
                    ),
                  )}

                </SelectContent>

              </Select>
            )}
          />

        </div>

        {/* ORDER NO */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Order No

          </label>

          <Input

            {...register(
              "orderNo",
            )}

            disabled

            placeholder="Auto Generated"

            className={getInputClass(
              errors.orderNo,
              true,
            )}
          />

        </div>

        {/* ORDER DATE */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Order Date

          </label>

          <Input

            type="date"

            {...register(
              "orderDate",
            )}

            disabled={
              disabled
            }

            className={getInputClass(
              errors.orderDate,
              disabled,
            )}
          />

        </div>

        {/* VALIDITY */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Order Validity

          </label>

          <Input

            type="date"

            {...register(
              "validityDate",
            )}

            disabled={
              disabled
            }

            className={getInputClass(
              errors.validityDate,
              disabled,
            )}
          />

        </div>

        {/* PARTY */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Party Name

          </label>

          <Controller
            control={control}
            name="vendorId"

            render={({
              field,
            }) => (

              <Select

                value={
                  field.value
                    ? String(
                        field.value,
                      )
                    : ""
                }

                onValueChange={
                  field.onChange
                }

                disabled={
                  disabled
                }
              >

                <SelectTrigger
                  className={getInputClass(
                    errors.vendorId,
                    disabled,
                  )}
                >

                  <SelectValue placeholder="Select Party" />

                </SelectTrigger>

                <SelectContent>

                  {ledgerList.map(
                    (
                      ledger,
                    ) => (

                      <SelectItem
                        key={
                          ledger.ledgerId
                        }

                        value={String(
                          ledger.ledgerId,
                        )}
                      >

                        {
                          ledger.primaryContactPerson
                        }

                      </SelectItem>
                    ),
                  )}

                </SelectContent>

              </Select>
            )}
          />

        </div>

        {/* PARTY ADDRESS */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Party Address

          </label>

          <Input

            {...register(
              "partyAddress",
            )}

            disabled

            className={getInputClass(
              errors.partyAddress,
              true,
            )}
          />

        </div>

        {/* GSTN */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            GSTN

          </label>

          <Input

            {...register(
              "gstn",
            )}

            disabled

            className={getInputClass(
              errors.gstn,
              true,
            )}
          />

        </div>

        {/* SITE */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Site

          </label>

          <Input

            value={
              projectInfo?.projectCode ||
              ""
            }

            disabled

            className={getInputClass(
              null,
              true,
            )}
          />

        </div>

        {/* BILLING */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Billing Address

          </label>

          <Controller
            control={control}
            name="billingAddress"

            render={({
              field,
            }) => (

              <Select

                value={
                  field.value
                }

                onValueChange={
                  field.onChange
                }

                disabled={
                  disabled
                }
              >

                <SelectTrigger
                  className={getInputClass(
                    errors.billingAddress,
                    disabled,
                  )}
                >

                  <SelectValue placeholder="Select Billing Address" />

                </SelectTrigger>

                <SelectContent>

                  {billingOptions.map(
                    (
                      item,
                      index,
                    ) => (

                      <SelectItem
                        key={
                          index
                        }

                        value={
                          item
                        }
                      >

                        {item}

                      </SelectItem>
                    ),
                  )}

                </SelectContent>

              </Select>
            )}
          />

        </div>

        {/* SHIPPING */}

        <div>

          <label
            className="
              text-sm
              font-medium
              mb-1
              block
            "
          >

            Shipping Address

          </label>

          <Controller
            control={control}
            name="shippingAddress"

            render={({
              field,
            }) => (

              <Select

                value={
                  field.value
                }

                onValueChange={
                  field.onChange
                }

                disabled={
                  disabled
                }
              >

                <SelectTrigger
                  className={getInputClass(
                    errors.shippingAddress,
                    disabled,
                  )}
                >

                  <SelectValue placeholder="Select Shipping Address" />

                </SelectTrigger>

                <SelectContent>

                  {shippingOptions.map(
                    (
                      item,
                      index,
                    ) => (

                      <SelectItem
                        key={
                          index
                        }

                        value={
                          item
                        }
                      >

                        {item}

                      </SelectItem>
                    ),
                  )}

                </SelectContent>

              </Select>
            )}
          />

        </div>

      </div>

      {/* ORDER MESSAGE */}

      <div className="mt-4">

        <label
          className="
            text-sm
            font-medium
            mb-1
            block
          "
        >

          Order Message

        </label>

        <Controller
          control={control}
          name="orderMessage"

          render={({
            field,
          }) => (

            <ExpandableTextField

              value={
                field.value
              }

              onChange={
                field.onChange
              }

              disabled={
                disabled
              }

              error={
                errors.orderMessage
              }

              title="Order Message"

              placeholder="Enter Order Message"

              minHeight="min-h-[60px]"

              modalHeight="min-h-[220px]"
            />
          )}
        />

      </div>

      {/* FILE */}

      <div className="mt-4">

        <label
          className="
            text-sm
            font-medium
            mb-1
            block
          "
        >

          Attachment

        </label>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
          "
        >

          {!disabled && (

            <input

              ref={fileRef}

              type="file"

              accept=".pdf"

              onChange={(
                e,
              ) => {

                const file =
                  e.target
                    .files?.[0];

                if (
                  !file
                ) {
                  return;
                }

                setAttachedFile(
                  file,
                );

                setFileName(
                  file.name,
                );

                setFileUrl(
                  "",
                );
              }}

              className="
                block
                text-sm
              "
            />
          )}

          {fileName && (

            <span
              className="
                text-sm
                text-gray-700
              "
            >

              {fileName}

            </span>
          )}

          {!fileName &&
            fileUrl && (

            <a

              href={
                fileUrl
              }

              target="_blank"

              rel="noreferrer"

              className="
                flex
                items-center
                gap-1

                text-blue-600

                hover:underline

                text-sm
              "
            >

              <Download
                className="
                  w-4
                  h-4
                "
              />

              Download File

            </a>
          )}
        </div>

      </div>

    </div>
  );
}