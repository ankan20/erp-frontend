"use client";

import { useEffect, useMemo, useState } from "react";
import OrderItemSelectionModal from "../modals/OrderItemSelectionModal";
import {
  Controller,
  useFieldArray,
} from "react-hook-form";

import {
  Trash2,
  Plus,
} from "lucide-react";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";

import ExpandableTextField from "@/components/common/ExpandableTextField";

import { getInputClass } from "@/lib/formStyles";

export default function OrderItemsTab({

  form,

  disabled,
}) {

  const [openItemModal, setOpenItemModal] =
    useState(false);

  const {

    control,

    register,

    watch,

    setValue,

    formState: {
      errors,
    },
  } = form;

  const {

    fields,

    append,

    remove,

    replace,
  } = useFieldArray({

    control,

    name: "items",
  });

  const items =
    watch("items") || [];

  // LIVE CALCULATIONS

  useEffect(() => {

    items.forEach(
      (
        item,
        index,
      ) => {

        const qty =
          Number(
            item?.qty || 0,
          );

        const rate =
          Number(
            item?.rate || 0,
          );

        const gst =
          Number(
            item?.gstPercent || 0,
          );

        const amount =
          qty * rate;

        const gstAmount =
          (
            amount *
            gst
          ) / 100;

        setValue(

          `items.${index}.amount`,

          Number(
            amount.toFixed(
              3,
            ),
          ),
        );

        setValue(

          `items.${index}.gstAmount`,

          Number(
            gstAmount.toFixed(
              3,
            ),
          ),
        );

      },
    );

  }, [
    items,
    setValue,
  ]);

  return (

    <div
      className="
        border
        rounded-md

        bg-white

        p-4
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          items-center
          justify-between

          gap-3

          mb-4
        "
      >

        <h2
          className="
            text-base
            font-semibold
          "
        >

          Order Items

        </h2>

        {!disabled && (

          <Button

            type="button"

            onClick={() =>
              setOpenItemModal(
                true,
              )
            }

            className="
              h-9
              px-4
            "
          >

            <Plus
              className="
                w-4
                h-4
                mr-1
              "
            />

            Add Items

          </Button>
        )}

      </div>

      {/* EMPTY */}

      {!fields.length && (

        <div
          className="
            h-[120px]

            border
            border-dashed

            rounded-md

            flex
            items-center
            justify-center

            text-sm
            text-gray-500
          "
        >

          No Items Added

        </div>
      )}

      {/* TABLE */}

      {!!fields.length && (

        <div
          className="
            overflow-x-auto
          "
        >

          <table
            className="
              w-full
              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  bg-gray-100
                "
              >

                <th className="border p-2 text-sm min-w-[120px]">
                  Item Code
                </th>

                <th className="border p-2 text-sm min-w-[180px]">
                  Item Name
                </th>

                <th className="border p-2 text-sm min-w-[90px]">
                  Unit
                </th>

                <th className="border p-2 text-sm min-w-[100px]">
                  Qty
                </th>

                <th className="border p-2 text-sm min-w-[120px]">
                  Rate
                </th>

                <th className="border p-2 text-sm min-w-[130px]">
                  Amount
                </th>

                <th className="border p-2 text-sm min-w-[100px]">
                  GST %
                </th>

                <th className="border p-2 text-sm min-w-[130px]">
                  GST Amount
                </th>

                <th className="border p-2 text-sm min-w-[200px]">
                  Location
                </th>

                <th className="border p-2 text-sm min-w-[220px]">
                  Note
                </th>

                {!disabled && (

                  <th className="border p-2 text-sm min-w-[80px]">
                    Action
                  </th>
                )}

              </tr>

            </thead>

            <tbody>

              {fields.map(
                (
                  field,
                  index,
                ) => {

                  return (

                    <tr
                      key={
                        field.id
                      }
                    >

                      {/* ITEM CODE */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.itemCode ||
                            ""
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* ITEM NAME */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.itemName ||
                            ""
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* UNIT */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.unit ||
                            ""
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* QTY */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.qty ||
                            ""
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* RATE */}

                      <td className="border p-2">

                        <Input

                          type="number"

                          step="0.001"

                          {...register(
                            `items.${index}.rate`,
                          )}

                          disabled={
                            disabled
                          }

                          className={getInputClass(

                            errors?.items?.[
                              index
                            ]?.rate,

                            disabled,
                          )}
                        />

                      </td>

                      {/* AMOUNT */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.amount ||
                            0
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* GST */}

                      <td className="border p-2">

                        <Input

                          type="number"

                          step="0.001"

                          {...register(
                            `items.${index}.gstPercent`,
                          )}

                          disabled={
                            disabled
                          }

                          className={getInputClass(

                            errors?.items?.[
                              index
                            ]?.gstPercent,

                            disabled,
                          )}
                        />

                      </td>

                      {/* GST AMOUNT */}

                      <td className="border p-2">

                        <Input

                          value={
                            items[
                              index
                            ]
                              ?.gstAmount ||
                            0
                          }

                          disabled

                          className={getInputClass(
                            null,
                            true,
                          )}
                        />

                      </td>

                      {/* LOCATION */}

                      <td className="border p-2 align-top">

                        <Controller

                          control={
                            control
                          }

                          name={`items.${index}.location`}

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
                                errors?.items?.[
                                  index
                                ]?.location
                              }

                              title="Location"

                              placeholder="Enter Location"

                              minHeight="min-h-[42px]"

                              modalHeight="min-h-[180px]"
                            />
                          )}
                        />

                      </td>

                      {/* NOTE */}

                      <td className="border p-2 align-top">

                        <Controller

                          control={
                            control
                          }

                          name={`items.${index}.note`}

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
                                errors?.items?.[
                                  index
                                ]?.note
                              }

                              title="Note"

                              placeholder="Enter Note"

                              minHeight="min-h-[42px]"

                              modalHeight="min-h-[180px]"
                            />
                          )}
                        />

                      </td>

                      {/* DELETE */}

                      {!disabled && (

                        <td className="border p-2 text-center">

                          <button

                            type="button"

                            onClick={() =>
                              remove(
                                index,
                              )
                            }

                            className="
                              text-red-500

                              hover:text-red-700
                            "
                          >

                            <Trash2
                              className="
                                w-4
                                h-4
                              "
                            />

                          </button>

                        </td>
                      )}

                    </tr>
                  );
                },
              )}

            </tbody>

          </table>

        </div>
      )}

      {/* TODO MODAL */}

      {openItemModal && (

        <div className="hidden">

          {/* 
            NEXT STEP:
            OrderItemSelectionModal
          */}
          <OrderItemSelectionModal

  open={
    openItemModal
  }

  onClose={() =>
    setOpenItemModal(
      false,
    )
  }

  form={form}

  disabled={
    disabled
  }
/>

        </div>
      )}

    </div>
  );
}