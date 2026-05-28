"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { Trash2, FileText } from "lucide-react";

import { getInputClass } from "@/lib/formStyles";

import SearchableSelect from "@/components/common/SearchableSelect";

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

  const [activeModal, setActiveModal] = useState(null);
  const [tempValue, setTempValue] = useState("");

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

  const formatNumber = (num) => {
    if (!num) return 0;

    const value = Number(num);

    if (value > 999999999) {
      return value.toExponential(2);
    }

    return value;
  };

  const renderPreviewText = (text) => {
    if (!text) {
      return (
        <span className="text-[#888] italic text-[13px]">No content added</span>
      );
    }

    if (text.length <= 28) {
      return text;
    }

    return `${text.trim().slice(0, 28).trim()}...`;
  };

  const openModal = (index, field) => {
    const currentValue = watch(`items.${index}.${field}`) || "";
    setTempValue(currentValue);
    setActiveModal({ index, field });
  };

  const closeModal = () => {
    setTempValue("");
    setActiveModal(null);
  };
  const handleSave = () => {
    if (!activeModal) return;
    const fieldPath = `items.${activeModal.index}.${activeModal.field}`;
    setValue(fieldPath, tempValue.trim(), {
      shouldValidate: true,
      shouldDirty: true,
    });
    closeModal();
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="border border-[#b5b5b5] overflow-hidden">
        {/* HEADER */}
        <div className="bg-[#e8f0df] px-2 py-1 border-b border-[#b5b5b5] font-bold text-[18px]">
          BASIC
        </div>

        {/* TABLE */}
        <div className="w-full overflow-x-auto">
          <div
            className={`
              overflow-auto
              ${fields.length > 7 ? "max-h-[320px]" : ""}
            `}
          >
            <table className="min-w-[1010px] w-full border-collapse text-sm">
              {/* HEADER */}
              <thead className="sticky top-0 z-20 bg-[#d9d9d9]">
                <tr>
                  <th className="border border-[#b5b5b5] w-[40px] text-center">
                    Sl no
                  </th>

                  <th className="border border-[#b5b5b5] w-[100px] text-left px-2">
                    Item Code
                  </th>

                  <th className="border border-[#b5b5b5] w-[180px] text-left px-2">
                    Item Name
                  </th>

                  <th className="border border-[#b5b5b5] w-[220px] text-left px-2">
                    Note
                  </th>

                  <th className="border border-[#b5b5b5] w-[90px] text-center">
                    Unit
                  </th>

                  <th className="border border-[#b5b5b5] w-[90px] text-center">
                    Qty
                  </th>

                  <th className="border border-[#b5b5b5] w-[100px] text-center">
                    Ammenmend Qty
                  </th>

                  <th className="border border-[#b5b5b5] w-[220px] text-left px-2">
                    Location
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
                        <button
                          type="button"
                          onClick={() => openModal(index, "note")}
                          className={`
                            w-full
                            h-[36px]
                            px-2
                            flex
                            items-center
                            justify-between
                            gap-2
                            text-left
                            transition-colors
                            cursor-pointer
                            ${
                              !isEditing || isSubmitting
                                ? "bg-[#edf8ed] cursor-default"
                                : "bg-white hover:bg-[#f7f7f7] cursor-pointer"
                            }
                          `}
                        >
                          <span className="truncate text-[13px]">
                            {renderPreviewText(noteValue)}
                          </span>

                          <span
                            className="
                              text-blue-600
                              text-[11px]
                              shrink-0
                              flex
                              items-center
                              gap-1
                            "
                          >
                            <FileText className="w-3 h-3" />
                            more
                          </span>
                        </button>
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
                        <Input
                          type="number"
                          min={0}
                          {...register(`items.${index}.qty`, {
                            min: 0,
                            onChange: (e) => {
                              if (Number(e.target.value) < 0) {
                                e.target.value = 0;
                              }
                            },
                          })}
                          disabled={!isEditing || isSubmitting}
                          className={`
                            ${getInputClass(
                              errors?.items?.[index]?.qty,
                              !isEditing || isSubmitting,
                            )}
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

                      {/* LOCATION */}
                      <td className="border border-[#b5b5b5] p-0">
                        <button
                          type="button"
                          onClick={() => openModal(index, "location")}
                          className={`
                            w-full
                            h-[36px]
                            px-2
                            flex
                            items-center
                            justify-between
                            gap-2
                            text-left
                            transition-colors
                            cursor-pointer
                          ${
                            !isEditing || isSubmitting
                              ? "bg-[#edf8ed] cursor-default"
                              : "bg-white hover:bg-[#f7f7f7] cursor-pointer"
                          }
                          `}
                        >
                          <span className="truncate text-[13px]">
                            {renderPreviewText(locationValue)}
                          </span>

                          <span
                            className="
                              text-blue-600
                              text-[11px]
                              shrink-0
                              flex
                              items-center
                              gap-1
                            "
                          >
                            <FileText className="w-3 h-3" />
                            more
                          </span>
                        </button>
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
                    {formatNumber(totalQty)}
                  </td>

                  <td className="border border-[#b5b5b5] text-center px-2">
                    {formatNumber(totalAmmenmendQty)}
                  </td>

                  <td className="border border-[#b5b5b5]"></td>

                  {isEditing && <td className="border border-[#b5b5b5]"></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ADD ROW */}
      {isEditing && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => append(defaultItemRow)}
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

      {/* MODAL */}
      <Dialog
        open={!!activeModal}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="sm:max-w-[650px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">
              {activeModal?.field === "note"
                ? "Note Details"
                : "Location Details"}
            </DialogTitle>
          </DialogHeader>

          {activeModal && (
            <div className="space-y-3">
              <div className="text-[13px] text-[#666]">
                {activeModal?.field === "note"
                  ? "Add detailed note information below."
                  : "Add detailed location information below."}
              </div>

              <textarea
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                disabled={!isEditing || isSubmitting}
                placeholder={
                  activeModal?.field === "note"
                    ? "Enter detailed note..."
                    : "Enter detailed location..."
                }
                className={`
            ${getInputClass(
              errors?.items?.[activeModal.index]?.[activeModal.field],
              !isEditing || isSubmitting,
            )}
            w-full
            min-h-[220px]
            resize-none
            border
            rounded-md
            px-3
            py-3
            text-sm
            leading-6
            outline-none
          `}
              />

              <div className="flex justify-between items-center">
                <div className="text-[12px] text-[#888]">
                  Character Count : {tempValue.trim().length}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="h-[34px] bg"
                  >
                    Close
                  </Button>

                  {/* Save only in edit mode */}
                  {isEditing && !isSubmitting && (
                    <Button
                      type="button"
                      onClick={handleSave}
                      className="h-[34px]"
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
