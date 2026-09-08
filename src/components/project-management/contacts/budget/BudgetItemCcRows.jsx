"use client";

import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import SearchableSelect from "@/components/common/SearchableSelect";
import AmountInput      from "@/components/common/AmountInput";
import { formatAmount } from "@/helper/numberFormatter";

/**
 * CC code allocations for ONE budget item.
 *
 * Its own component because a nested useFieldArray cannot be called in a loop —
 * each item needs its own hook instance for `items.<i>.ccCodes`.
 *
 * cc_total = order_qty × cc_value  (per the Budget Master spec), so the same
 * unit value costs more on a larger item.
 *
 * Every editable cell is bound to its own LEAF path (`…ccCodes.<j>.ccValue`),
 * never to the row object as a whole — an object-level Controller updates its
 * own copy without the parent's `useWatch("items")` seeing the change, which
 * left the item's CC Cost and the Grand Total stuck at 0.
 */
export default function BudgetItemCcRows({
  control,
  setValue,
  itemIndex,
  orderQty = 0,
  ccOptions = [],
  disabled = false,
  colSpan,
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `items.${itemIndex}.ccCodes`,
  });

  const addRow = () =>
    append({ ccCodeId: null, ccCode: "", ccName: "", ccValue: "" });

  return (
    <tr className="bg-[#fbfcfe]">
      <td colSpan={colSpan} className="border border-[#d5d5d5] p-0">
        <div className="pl-8 pr-2 py-1.5">
          {fields.length === 0 ? (
            <div className="flex items-center gap-3 py-1">
              <span className="text-[11px] italic text-gray-400">
                No CC code allocated to this item yet
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1 text-[11px] text-[#3b6ea5] hover:underline"
                >
                  <Plus size={12} /> Add CC Code
                </button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-[#4a5a6a]">
                  <th className="px-2 py-1 text-left font-semibold w-[38px]">#</th>
                  <th className="px-2 py-1 text-left font-semibold w-[230px]">CC Code</th>
                  <th className="px-2 py-1 text-left font-semibold">CC Name</th>
                  <th className="px-2 py-1 text-right font-semibold w-[130px]">CC Value / unit</th>
                  <th className="px-2 py-1 text-right font-semibold w-[130px]">CC Total</th>
                  {!disabled && <th className="w-[36px]" />}
                </tr>
              </thead>
              <tbody>
                {fields.map((f, ci) => (
                  <CcRow
                    key={f.id}
                    control={control}
                    setValue={setValue}
                    itemIndex={itemIndex}
                    ccIndex={ci}
                    orderQty={orderQty}
                    ccOptions={ccOptions}
                    disabled={disabled}
                    onRemove={() => remove(ci)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {fields.length > 0 && !disabled && (
            <button
              type="button"
              onClick={addRow}
              className="mt-1 ml-2 flex items-center gap-1 text-[11px] text-[#3b6ea5] hover:underline"
            >
              <Plus size={12} /> Add CC Code
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CcRow({ control, setValue, itemIndex, ccIndex, orderQty, ccOptions, disabled, onRemove }) {
  const base = `items.${itemIndex}.ccCodes.${ccIndex}`;
  const row  = useWatch({ control, name: base }) || {};

  const ccTotal = Number(orderQty || 0) * Number(row.ccValue || 0);

  return (
    <tr className="align-middle">
      <td className="px-2 py-0.5 text-gray-500">{ccIndex + 1}</td>

      <td className="px-1 py-0.5">
        <Controller
          control={control}
          name={`${base}.ccCodeId`}
          render={({ field }) => (
            <SearchableSelect
              options={ccOptions}
              value={field.value ? String(field.value) : ""}
              disabled={disabled}
              onChange={(val, opt) => {
                field.onChange(val ? Number(val) : null);
                // Snapshot the code/name alongside the id, as the payload stores both
                setValue(`${base}.ccCode`, opt?.ccCode || "", { shouldDirty: true });
                setValue(`${base}.ccName`, opt?.ccName || "", { shouldDirty: true });
              }}
              placeholder="Select CC code…"
              labelKey="displayLabel"
              valueKey="id"
              searchKeys={["displayLabel", "ccCode", "ccName"]}
            />
          )}
        />
      </td>

      <td className="px-2 py-0.5 text-gray-700">{row.ccName || "—"}</td>

      <td className="px-1 py-0.5">
        <Controller
          control={control}
          name={`${base}.ccValue`}
          render={({ field }) => (
            <AmountInput
              {...field}
              value={field.value ?? ""}
              disabled={disabled}
              placeholder="0.00"
              className={`w-full h-[24px] text-[11px] text-right px-1.5 rounded-sm border-0 outline-none md:text-[11px] focus-visible:ring-0 ${
                disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fffbe6] focus:bg-white"
              }`}
            />
          )}
        />
      </td>

      <td className="px-2 py-0.5 text-right tabular-nums text-gray-700">
        {formatAmount(ccTotal)}
      </td>

      {!disabled && (
        <td className="px-1 py-0.5 text-center">
          <button
            type="button"
            onClick={onRemove}
            title="Remove CC code"
            className="p-0.5 text-red-400 hover:text-red-600 transition"
          >
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  );
}
