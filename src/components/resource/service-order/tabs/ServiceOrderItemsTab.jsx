"use client";

import { Controller, useFieldArray } from "react-hook-form";
import { Trash2 } from "lucide-react";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { getInputClass } from "@/lib/formStyles";
import AmountInput from "@/components/common/AmountInput";
import QtyInput from "@/components/common/QtyInput";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";
import ServiceOrderItemSelectionModal from "../modals/ServiceOrderItemSelectionModal";

export default function ServiceOrderItemsTab({ form, disabled, openItemModal, setOpenItemModal }) {
  const { control, watch, setValue, formState: { errors } } = form;
  const { fields, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items") || [];

  const totalAmount = items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const totalGstAmount = items.reduce((sum, item) => sum + Number(item?.gstAmount || 0), 0);

  const recalculate = (index, field, value) => {
    const qty = Number(items[index]?.qty || 0);
    const rate = field === "rate" ? Number(value || 0) : Number(items[index]?.rate || 0);
    const gstPercent = field === "gstPercent" ? Number(value || 0) : Number(items[index]?.gstPercent || 0);
    const amount = qty * rate;
    const gstAmount = (amount * gstPercent) / 100;
    setValue(`items.${index}.amount`, Number(amount.toFixed(3)));
    setValue(`items.${index}.gstAmount`, Number(gstAmount.toFixed(3)));
  };

  return (
    <div className="w-full bg-white">
      <div className="border border-gray-300">
        <div className="w-full bg-[#DCE8D2] border-b border-gray-300 px-4 py-1">
          <h2 className="text-[15px] font-semibold text-black">Service Order Items</h2>
        </div>

        {!fields.length && (
          <div className="h-[140px] flex items-center justify-center text-sm text-gray-500">
            No Items Added
          </div>
        )}

        {!!fields.length && (
          <div className="overflow-auto max-h-[680px]">
            <table className="w-full border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#D3D3D3]">
                  <th className="border px-2 py-1 text-sm min-w-[44px]">Sl No</th>
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
                  {!disabled && <th className="border px-2 py-1 text-sm min-w-[50px]">Action</th>}
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id}>
                    <td className="border px-2 py-[2px] text-sm text-center">{index + 1}</td>
                    <td className="border px-2 py-[2px] text-sm bg-[#edf8ed]">
                      {items[index]?.itemCode || ""}
                    </td>
                    <td className="border px-2 py-[2px] align-top overflow-hidden">
                      <ExpandableTextField value={items[index]?.itemName || ""} disabled title="Item Name" placeholder="Item Name" minHeight="min-h-[34px]" modalHeight="min-h-[180px]" />
                    </td>
                    <td className="border p-0 align-top">
                      <div className="w-[70px] overflow-hidden">
                        <Controller control={control} name={`items.${index}.note`} render={({ field }) => (
                          <ExpandableTextField value={field.value} onChange={field.onChange} disabled={disabled} error={errors?.items?.[index]?.note} title="Note" placeholder="Note" minHeight="min-h-[34px]" modalHeight="min-h-[180px]" />
                        )} />
                      </div>
                    </td>
                    <td className="border px-2 py-[2px] align-top overflow-hidden">
                      <ExpandableTextField value={items[index]?.itemUnit || ""} onChange={() => {}} disabled title="Unit" placeholder="" minHeight="min-h-[34px]" modalHeight="min-h-[120px]" />
                    </td>
                    <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-center">
                      {formatQtyDisplay(items[index]?.qty) || ""}
                    </td>
                    {disabled ? (
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                        {formatAmount(items[index]?.rate) || ""}
                      </td>
                    ) : (
                      <td className="border px-2 py-[2px]">
                        <Controller control={control} name={`items.${index}.rate`} render={({ field }) => (
                          <AmountInput
                            {...field}
                            onChange={(e) => { field.onChange(e.target.value); recalculate(index, "rate", e.target.value); }}
                            className={getInputClass(errors?.items?.[index]?.rate, false)}
                          />
                        )} />
                      </td>
                    )}
                    <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                      {formatAmount(items[index]?.amount) || "0.00"}
                    </td>
                    {disabled ? (
                      <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                        {formatAmount(items[index]?.gstPercent) || ""}
                      </td>
                    ) : (
                      <td className="border px-2 py-[2px]">
                        <Controller control={control} name={`items.${index}.gstPercent`} render={({ field }) => (
                          <AmountInput
                            {...field}
                            onChange={(e) => { field.onChange(e.target.value); recalculate(index, "gstPercent", e.target.value); }}
                            className={getInputClass(errors?.items?.[index]?.gstPercent, false)}
                          />
                        )} />
                      </td>
                    )}
                    <td className="border px-2 py-[2px] text-sm bg-[#edf8ed] text-right">
                      {formatAmount(items[index]?.gstAmount) || "0.00"}
                    </td>
                    <td className="border p-0 align-top">
                      <div className="w-[90px] overflow-hidden">
                        <Controller control={control} name={`items.${index}.location`} render={({ field }) => (
                          <ExpandableTextField value={field.value} onChange={field.onChange} disabled={disabled} error={errors?.items?.[index]?.location} title="Location" placeholder="Location" minHeight="min-h-[34px]" modalHeight="min-h-[180px]" />
                        )} />
                      </div>
                    </td>
                    {!disabled && (
                      <td className="border px-2 py-[2px] text-center">
                        <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-[#D3D3D3] font-semibold">
                  <td colSpan={7} className="border px-2 py-1 text-center text-sm">TOTAL</td>
                  <td className="border px-2 py-1 text-sm text-right">{formatAmount(totalAmount)}</td>
                  <td className="border px-2 py-1" />
                  <td className="border px-2 py-1 text-sm text-right">{formatAmount(totalGstAmount)}</td>
                  <td className="border px-2 py-1" colSpan={disabled ? 1 : 2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServiceOrderItemSelectionModal
        open={openItemModal}
        onClose={() => setOpenItemModal(false)}
        form={form}
      />
    </div>
  );
}
