"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { getInputClass } from "@/lib/formStyles";
import SearchableSelect from "@/components/common/SearchableSelect";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatQtyDisplay } from "@/helper/numberFormatter";
import QtyInput from "@/components/common/QtyInput";

export default function IndentItemsTable({
  fields,
  register,
  setValue,
  watch,
  append,
  remove,
  errors,
  isEditing,
  isSubmitting,
  itemsOptions,
  projectCode,
}) {
  const defaultItemRow = {
    itemCode: "",
    itemName: "",
    note: "",
    unit: "",
    qty: "",
    ammenmendQty: "",
    location: "",
  };

  const scrollRef = useRef(null);

  const [useLocations, setUseLocations] = useState([]);

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({
      url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`,
      method: "GET",
    })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setUseLocations(data.filter((l) => l.locationType === "Use"));
      })
      .catch(() => setUseLocations([]));
  }, [projectCode]);

  const totalQty = watch("items")?.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0,
  );

  const totalAmmenmendQty = watch("items")?.reduce(
    (sum, item) => sum + Number(item?.ammenmendQty || 0),
    0,
  );

  const handleItemSelect = (rowIndex, value, item) => {
    setValue(`items.${rowIndex}.itemCode`, item?.itemCode || "");

    setValue(`items.${rowIndex}.itemName`, item?.itemName || "");

    setValue(`items.${rowIndex}.unit`, item?.unit || "");
  };


  return (
    <div className="flex-1 min-w-0">
      <div className="border border-[#b5b5b5]">
        {/* HEADER */}
        <div className="bg-[#e8f0df] px-2 py-1 border-b border-[#b5b5b5] font-bold text-[18px]">
          BASIC
        </div>

        {/* TABLE */}
        <div
          ref={scrollRef}
          className="overflow-auto max-h-[calc(100vh-300px)]"
        >
            <table className="min-w-[1120px] w-full border-collapse text-sm table-fixed">
              {/* HEADER */}
              <thead className="sticky top-0 z-20 bg-[#d9d9d9]">
                <tr>
                  <th className="border border-[#b5b5b5] w-[40px] text-center">
                    Sl no
                  </th>

                  <th className="border border-[#b5b5b5] w-[100px] text-left px-2">
                    Item Code
                  </th>

                  <th className="border border-[#b5b5b5] w-[190px] text-left px-2">
                    Item Name
                  </th>

                  <th className="border border-[#b5b5b5] w-[200px] text-left px-2">
                    Note
                  </th>

                  <th className="border border-[#b5b5b5] w-[80px] text-center">
                    Unit
                  </th>

                  <th className="border border-[#b5b5b5] w-[100px] text-center">
                    Qty
                  </th>

                  <th className="border border-[#b5b5b5] w-[80px] text-center">
                    Ammenmend Qty
                  </th>

                  <th className="border border-[#b5b5b5] w-[140px] text-left px-2">
                    Use To
                  </th>

                  {isEditing && (
                    <th className="border border-[#b5b5b5] w-[50px] text-center">
                      Action
                    </th>
                  )}
                </tr>
              </thead>

              {/* BODY */}
              <tbody>
                {fields.map((field, index) => {
                  const selectedItemCode = watch(`items.${index}.itemCode`);

                  const noteValue = watch(`items.${index}.note`);

                  const locationValue = watch(`items.${index}.location`);

                  return (
                    <tr key={field.id}>
                      {/* SL */}
                      <td className="border border-[#b5b5b5] text-center bg-[#f7f7f7]">
                        {index + 1}
                      </td>

                      {/* ITEM CODE */}
                      <td className="border border-[#b5b5b5] p-0">
                        <Input
                          {...register(`items.${index}.itemCode`)}
                          disabled
                          className={`
                            ${getInputClass(false, true)}
                            border-0
                            rounded-none
                            h-[36px]
                          `}
                        />
                      </td>

                      {/* ITEM NAME */}
                      <td className="border border-[#b5b5b5] p-0">
                        <SearchableSelect
                          options={itemsOptions}
                          value={selectedItemCode}
                          disabled={!isEditing || isSubmitting}
                          onChange={(value, item) =>
                            handleItemSelect(index, value, item)
                          }
                          placeholder="Select Item"
                          labelKey="itemName"
                          valueKey="itemCode"
                          searchKeys={["itemName", "itemCode"]}
                          className="rounded-none"
                        />
                      </td>

                      {/* NOTE */}
                      <td className="border border-[#b5b5b5] p-0">
                        <ExpandableTextField
                          value={noteValue || ""}
                          onChange={(v) => setValue(`items.${index}.note`, v, { shouldDirty: true })}
                          disabled={!isEditing || isSubmitting}
                          title="Note"
                          placeholder="Enter detailed note..."
                          subHeader="Add detailed note information below."
                          minHeight="min-h-[36px]"
                          modalHeight="min-h-[220px]"
                        />
                      </td>

                      {/* UNIT */}
                      <td className="border border-[#b5b5b5] p-0">
                        <Input
                          {...register(`items.${index}.unit`)}
                          disabled
                          className={`
                            ${getInputClass(false, true)}
                            border-0
                            rounded-none
                            h-[36px]
                            text-center
                          `}
                        />
                      </td>

                      {/* QTY */}
                      <td className="border border-[#b5b5b5] p-0">
                        <QtyInput
                          {...register(`items.${index}.qty`)}
                          value={watch(`items.${index}.qty`)}
                          disabled={!isEditing || isSubmitting}
                          className={`
                            ${getInputClass(errors?.items?.[index]?.qty, !isEditing || isSubmitting)}
                            border-0
                            rounded-none
                            h-[36px]
                            text-center
                          `}
                        />
                      </td>

                      {/* AMMENDMENT */}
                      <td className="border border-[#b5b5b5] p-0">
                        <Input
                          type="number"
                          value={watch(`items.${index}.ammenmendQty`) || ""}
                          disabled
                          className={`
                            ${getInputClass(false, true)}
                            border-0
                            rounded-none
                            h-[36px]
                            text-center
                          `}
                        />
                      </td>

                      {/* USE TO (LOCATION) */}
                      <td className="border border-[#b5b5b5] p-0">
                        <SearchableSelect
                          options={useLocations}
                          value={locationValue}
                          disabled={!isEditing || isSubmitting}
                          onChange={(value) =>
                            setValue(`items.${index}.location`, value, {
                              shouldDirty: true,
                            })
                          }
                          placeholder="Select location"
                          labelKey="locationName"
                          valueKey="locationName"
                          searchKeys={["locationName"]}
                          className="rounded-none border-0"
                        />
                      </td>

                      {/* DELETE */}
                      {isEditing && (
                        <td className="border border-[#b5b5b5] text-center">
                          <button
                            type="button"
                            disabled={fields.length === 1}
                            onClick={() => remove(index)}
                            className="inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              {/* FOOTER */}
              <tfoot className="sticky bottom-0 z-20 bg-[#d9d9d9]">
                <tr className="font-bold">
                  <td className="border border-[#b5b5b5]"></td>

                  <td className="border border-[#b5b5b5]"></td>

                  <td className="border border-[#b5b5b5]"></td>

                  <td className="border border-[#b5b5b5] text-center">TOTAL</td>

                  <td className="border border-[#b5b5b5]"></td>

                  <td className="border border-[#b5b5b5] text-center px-2">
                    {formatQtyDisplay(totalQty)}
                  </td>

                  <td className="border border-[#b5b5b5] text-center px-2">
                    {formatQtyDisplay(totalAmmenmendQty)}
                  </td>

                  <td className="border border-[#b5b5b5]"></td>

                  {isEditing && <td className="border border-[#b5b5b5]"></td>}
                </tr>
              </tfoot>
            </table>
        </div>
      </div>

      {/* ADD ROW */}
      {isEditing && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              append(defaultItemRow);
              setTimeout(() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }, 50);
            }}
            className="
              px-4
              py-1
              bg-[#9fc5e8]
              border
              border-[#6d9dc5]
              rounded-sm
              text-sm
              font-medium
              hover:brightness-95
              cursor-pointer
            "
          >
            Add Row
          </button>
        </div>
      )}

    </div>
  );
}
