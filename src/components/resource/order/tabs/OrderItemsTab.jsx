"use client";

import { useEffect } from "react";

import OrderItemSelectionModal from "../modals/OrderItemSelectionModal";
import WithoutIndentItemsTable from "./WithoutIndentItemsTable";

import { Controller, useFieldArray } from "react-hook-form";

import { Trash2 } from "lucide-react";

import ExpandableTextField from "@/components/common/ExpandableTextField";

import { getInputClass } from "@/lib/formStyles";
import AmountInput from "@/components/common/AmountInput";
import QtyInput from "@/components/common/QtyInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";

export default function OrderItemsTab({
  form,
  disabled,
  openItemModal,
  setOpenItemModal,
  withIndent,
  itemOptions,
  projectCode,
}) {
  const {
    control,

    register,

    watch,

    setValue,

    formState: { errors },
  } = form;

  const {
    fields,
    remove,
  } = useFieldArray({
    control,

    name: "items",
  });

  const items = watch("items") || [];

  // TOTALS

  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item?.amount || 0),

    0,
  );

  const totalGstAmount = items.reduce(
    (sum, item) => sum + Number(item?.gstAmount || 0),

    0,
  );

  if (!withIndent) {
    return <WithoutIndentItemsTable form={form} disabled={disabled} itemOptions={itemOptions} projectCode={projectCode} />;
  }

  return (
    <div
      className="
        w-full
        bg-white
      "
    >
      {/* TABLE SECTION */}

      <div
        className="
          border
          border-gray-300
        "
      >
        {/* TITLE */}

        <div
          className="
            w-full

            bg-[#DCE8D2]

            border-b
            border-gray-300

            px-4
            py-1
          "
        >
          <h2
            className="
              text-[15px]
              font-semibold
              text-black
            "
          >
            Order Items List
          </h2>
        </div>

        {/* EMPTY */}

        {!fields.length && (
          <div
            className="
              h-[140px]

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
              overflow-auto

              max-h-[680px]
            "
          >
            <table className="w-full border-collapse min-w-[900px]">
              <thead
                className="
                  sticky
                  top-0
                  z-10
                "
              >
                <tr
                  className="
                    bg-[#D3D3D3]
                  "
                >
                  <th className="border px-2 py-1 text-sm min-w-[44px]">Sl no</th>
                  <th className="border px-2 py-1 text-sm min-w-[90px]">Item Code</th>
                  <th className="border px-2 py-1 text-sm min-w-[150px]">Item Name</th>
                  <th className="border px-2 py-1 text-sm min-w-[70px]">Note</th>
                  <th className="border px-2 py-1 text-sm min-w-[70px]">Unit</th>
                  <th className="border px-2 py-1 text-sm min-w-[90px]">Qty</th>
                  <th className="border px-2 py-1 text-sm min-w-[100px]">Rate</th>
                  <th className="border px-2 py-1 text-sm min-w-[90px]">Amount</th>
                  <th className="border px-2 py-1 text-sm min-w-[80px]">GST %</th>
                  <th className="border px-2 py-1 text-sm min-w-[90px]">GST Amount</th>
                  <th className="border px-2 py-1 text-sm min-w-[90px]">Location</th>
                  {!disabled && (
                    <th className="border px-2 py-1 text-sm min-w-[50px]">Action</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {fields.map((field, index) => {
                  return (
                    <tr key={field.id}>
                      {/* SL NO */}

                      <td className="border px-2 py-[2px] text-sm text-center">
                        {index + 1}
                      </td>

                      {/* ITEM CODE */}
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed]">
                        {items[index]?.itemCode || ""}
                      </td>

                      {/* ITEM NAME */}

                      <td
                        className="
                              border
                              px-2
                              py-[2px]
                              align-top
                              overflow-hidden
                            "
                      >
                        <ExpandableTextField
                          value={items[index]?.itemName || ""}
                          disabled={true}
                          title="Item Name"
                          placeholder="Item Name"
                          minHeight="min-h-[34px]"
                          modalHeight="min-h-[180px]"
                        />
                      </td>

                      {/* NOTE */}

                      <td className="border p-0 align-top">
                        <div className="w-[70px] overflow-hidden">
                          <Controller
                            control={control}
                            name={`items.${index}.note`}
                            render={({ field }) => (
                              <ExpandableTextField
                                value={field.value}
                                onChange={field.onChange}
                                disabled={disabled}
                                error={errors?.items?.[index]?.note}
                                title="Note"
                                placeholder="Note"
                                minHeight="min-h-[34px]"
                                modalHeight="min-h-[180px]"
                              />
                            )}
                          />
                        </div>
                      </td>

                      {/* UNIT */}

                      <td className="border px-2 py-[2px] align-top overflow-hidden">
                        <ExpandableTextField
                          value={items[index]?.itemUnit || ""}
                          onChange={() => {}}
                          disabled
                          title="Unit"
                          placeholder=""
                          minHeight="min-h-[34px]"
                          modalHeight="min-h-[120px]"
                        />
                      </td>

                      {/* QTY */}
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-center">
                        {formatQtyDisplay(items[index]?.qty) || ""}
                      </td>

                      {/* RATE */}
                      {disabled ? (
                        <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                          {formatAmount(items[index]?.rate) || ""}
                        </td>
                      ) : (
                        <td className="border px-2 py-[2px]">
                          <Controller
                            control={control}
                            name={`items.${index}.rate`}
                            render={({ field }) => (
                              <AmountInput
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value);
                                  const qty = Number(items[index]?.qty || 0);
                                  const rate = Number(value || 0);
                                  const gstPercent = Number(items[index]?.gstPercent || 0);
                                  const amount = qty * rate;
                                  const gstAmount = (amount * gstPercent) / 100;
                                  setValue(`items.${index}.amount`, Number(amount.toFixed(3)));
                                  setValue(`items.${index}.gstAmount`, Number(gstAmount.toFixed(3)));
                                }}
                                className={getInputClass(errors?.items?.[index]?.rate, false)}
                              />
                            )}
                          />
                        </td>
                      )}

                      {/* AMOUNT */}
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                        {formatAmount(items[index]?.amount) || "0.00"}
                      </td>
                      {/* GST % */}
                      {disabled ? (
                        <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                          {formatAmount(items[index]?.gstPercent) || ""}
                        </td>
                      ) : (
                        <td className="border px-2 py-[2px]">
                          <Controller
                            control={control}
                            name={`items.${index}.gstPercent`}
                            render={({ field }) => (
                              <AmountInput
                                {...field}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.onChange(value);
                                  const qty = Number(items[index]?.qty || 0);
                                  const rate = Number(items[index]?.rate || 0);
                                  const gstPercent = Number(value || 0);
                                  const amount = qty * rate;
                                  const gstAmount = (amount * gstPercent) / 100;
                                  setValue(`items.${index}.amount`, Number(amount.toFixed(3)));
                                  setValue(`items.${index}.gstAmount`, Number(gstAmount.toFixed(3)));
                                }}
                                className={getInputClass(errors?.items?.[index]?.gstPercent, false)}
                              />
                            )}
                          />
                        </td>
                      )}

                      {/* GST AMOUNT */}
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                        {formatAmount(items[index]?.gstAmount) || "0.00"}
                      </td>

                      {/* LOCATION */}

                      <td className="border p-0 align-top">
                        <div className="w-[90px] overflow-hidden">
                          <Controller
                            control={control}
                            name={`items.${index}.location`}
                            render={({ field }) => (
                              <ExpandableTextField
                                value={field.value}
                                onChange={field.onChange}
                                disabled={true}
                                error={errors?.items?.[index]?.location}
                                title="Location"
                                placeholder="Location"
                                minHeight="min-h-[34px]"
                                modalHeight="min-h-[180px]"
                              />
                            )}
                          />
                        </div>
                      </td>

                      {/* ACTION */}

                      {!disabled && (
                        <td className="border px-2 py-[2px] text-center">
                          <button
                            type="button"
                            onClick={() => remove(index)}
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
                })}

                {/* TOTAL ROW */}

                <tr
                  className="
                    bg-[#D3D3D3]
                    font-semibold
                  "
                >
                  <td
                    colSpan={7}
                    className="
                      border
                      px-2
                      py-1

                      text-center
                      text-sm
                    "
                  >
                    TOTAL
                  </td>

                  <td className="border px-2 py-1 text-sm text-right">
                    {formatAmount(totalAmount)}
                  </td>

                  <td className="border px-2 py-1" />

                  <td className="border px-2 py-1 text-sm text-right">
                    {formatAmount(totalGstAmount)}
                  </td>

                  <td className="border px-2 py-1" colSpan={disabled ? 1 : 2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}

      <OrderItemSelectionModal
        open={openItemModal}
        onClose={() => setOpenItemModal(false)}
        form={form}
        disabled={disabled}
      />
    </div>
  );
}
