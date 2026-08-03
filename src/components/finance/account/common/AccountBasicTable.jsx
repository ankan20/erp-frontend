"use client";

import { Controller } from "react-hook-form";
import { Loader2 }    from "lucide-react";
import { ACC }        from "./accountTheme";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";

const fmt = (val) => {
  const n = Number(val);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AccountBasicTable({
  itemFields   = [],
  watch,
  register,
  control,
  disabled     = false,
  itemsLoading = false,
  emptyText    = "Select a certified bill to load items",
}) {
  const items      = watch("items") || [];
  const basicTotal = items.reduce((s, it) => s + Number(it?.basicAmount || 0), 0);

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* Header strip */}
      <div className={`${ACC.basicHeader} px-3 py-[5px]`}>
        <span className={ACC.sectionTitle}>BASIC</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[12px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[46px]">SL no</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[76px]">CC Code</th>
              {/* Merged Name + Description column */}
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold">Name &amp; Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[88px]">HSN/SAC</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[115px]">Basic Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemsLoading ? (
              <tr>
                <td colSpan={5} className="border border-gray-200 py-5 text-center text-gray-400">
                  <Loader2 className="animate-spin w-4 h-4 inline mr-1.5" />Loading items…
                </td>
              </tr>
            ) : itemFields.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-gray-200 py-6 text-center text-[#bbb] italic">
                  {emptyText}
                </td>
              </tr>
            ) : (
              itemFields.map((field, idx) => (
                <tr key={field.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#f7f9fc]"}>
                  <td className="border border-gray-200 px-2 py-[3px] text-center align-top pt-[6px]">{idx + 1}</td>
                  <td className="border border-gray-200 px-2 py-[3px] align-top pt-[6px]">{watch(`items.${idx}.ccCode`)}</td>

                  {/* Combined CC Name + editable Description */}
                  <td className="border border-gray-200 p-0 min-w-[160px]">
                    <div className="px-2 pt-[5px] pb-[2px] text-[12px] font-medium leading-snug text-gray-800">
                      {watch(`items.${idx}.ccName`)}
                    </div>
                    <Controller
                      name={`items.${idx}.description`}
                      control={control}
                      render={({ field: f }) => (
                        <ExpandableTextCell
                          value={f.value || ""}
                          onChange={disabled ? undefined : f.onChange}
                          disabled={disabled}
                          placeholder="Enter description"
                          label="Description"
                          textSize="text-[11px]"
                          className="text-gray-500"
                        />
                      )}
                    />
                  </td>

                  <td className="border border-gray-200 p-0.5 align-top">
                    <input
                      type="text"
                      {...register(`items.${idx}.hsnSac`)}
                      disabled={disabled}
                      placeholder="HSN/SAC"
                      className={`w-full h-[26px] text-[12px] px-1.5 outline-none rounded-sm border-0 ${
                        disabled
                          ? "bg-[#edf8ed] text-gray-500"
                          : "bg-transparent focus:bg-white focus:border focus:border-[#93b5cc]"
                      }`}
                    />
                  </td>
                  <td className="border border-gray-200 px-2 py-[3px] text-right font-medium align-top pt-[6px]">
                    {fmt(watch(`items.${idx}.basicAmount`))}
                  </td>
                </tr>
              ))
            )}
            {/* Total row */}
            <tr className={`${ACC.tableHead} font-semibold`}>
              <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">TOTAL</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">{fmt(basicTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
