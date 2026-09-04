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
    itemDisplayCode: "",
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
    setValue(`items.${rowIndex}.itemDisplayCode`, item?.itemDisplayCode || "");
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
          <table className="w-full border-collapse text-sm min-w-[1000px]">
            {/* HEADER */}
            <thead className="sticky top-0 z-20 bg-[#d9d9d9]">
              <tr>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[44px] text-center">Sl no</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[90px] text-left">Item Code</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[160px] text-left">Item Name</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[80px] text-left">Note</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[70px] text-center">Unit</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[90px] text-center">Qty</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[100px] text-center">Ammenmend Qty</th>
                <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[130px] text-left">Use To</th>
                {isEditing && (
                  <th className="border border-[#b5b5b5] px-2 py-1 text-sm min-w-[50px] text-center">Action</th>
                )}
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {fields.map((field, index) => {
                const selectedItemDisplayCode = watch(`items.${index}.itemDisplayCode`);
                const noteValue = watch(`items.${index}.note`);
                const locationValue = watch(`items.${index}.location`);

                return (
                  <tr key={field.id}>
                    {/* SL */}
                    <td className="border border-[#b5b5b5] px-2 py-[2px] text-center bg-[#f7f7f7]">
                      {index + 1}
                    </td>

                    {/* ITEM CODE */}
                    <td className="border border-[#b5b5b5] px-2 py-[2px]">
                      <Input
                        {...register(`items.${index}.itemCode`)}
                        disabled
                        className={getInputClass(false, true)}
                      />
                    </td>

                    {/* ITEM NAME */}
                    <td className="border border-[#b5b5b5] p-0">
                      <SearchableSelect
                        options={itemsOptions}
                        value={selectedItemDisplayCode}
                        disabled={!isEditing || isSubmitting}
                        onChange={(value, item) => handleItemSelect(index, value, item)}
                        placeholder="Select Item"
                        labelKey="itemName"
                        valueKey="itemDisplayCode"
                        searchKeys={["itemName", "itemDisplayCode"]}
                      />
                    </td>

                    {/* NOTE */}
                    <td className="border border-[#b5b5b5] p-0 align-top">
                      <div className="min-w-[80px] overflow-hidden">
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
                      </div>
                    </td>

                    {/* UNIT */}
                    <td className="border border-[#b5b5b5] px-2 py-[2px] text-center">
                      <Input
                        {...register(`items.${index}.unit`)}
                        disabled
                        className={getInputClass(false, true)}
                      />
                    </td>

                    {/* QTY */}
                    <td className="border border-[#b5b5b5] px-2 py-[2px]">
                      <QtyInput
                        {...register(`items.${index}.qty`)}
                        value={watch(`items.${index}.qty`)}
                        disabled={!isEditing || isSubmitting}
                        className={getInputClass(errors?.items?.[index]?.qty, !isEditing || isSubmitting)}
                      />
                    </td>

                    {/* AMMENDMENT */}
                    <td className="border border-[#b5b5b5] px-2 py-[2px] text-center">
                      <Input
                        value={watch(`items.${index}.ammenmendQty`) || ""}
                        disabled
                        className={getInputClass(false, true)}
                      />
                    </td>

                    {/* USE TO (LOCATION) */}
                    <td className="border border-[#b5b5b5] p-0">
                      <SearchableSelect
                        options={useLocations}
                        value={locationValue}
                        disabled={!isEditing || isSubmitting}
                        onChange={(value) =>
                          setValue(`items.${index}.location`, value, { shouldDirty: true })
                        }
                        placeholder="Select location"
                        labelKey="locationName"
                        valueKey="locationName"
                        searchKeys={["locationName"]}
                      />
                    </td>

                    {/* DELETE */}
                    {isEditing && (
                      <td className="border border-[#b5b5b5] px-2 py-[2px] text-center">
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

              {/* TOTAL ROW */}
              <tr className="bg-[#d9d9d9] font-semibold">
                <td colSpan={4} className="border border-[#b5b5b5] px-2 py-1 text-sm text-center">TOTAL</td>
                <td className="border border-[#b5b5b5]" />
                <td className="border border-[#b5b5b5] px-2 py-1 text-sm text-center">
                  {formatQtyDisplay(totalQty)}
                </td>
                <td className="border border-[#b5b5b5] px-2 py-1 text-sm text-center">
                  {formatQtyDisplay(totalAmmenmendQty)}
                </td>
                <td className="border border-[#b5b5b5]" />
                {isEditing && <td className="border border-[#b5b5b5]" />}
              </tr>
            </tbody>
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
