"use client";

import { Controller } from "react-hook-form";
import { Calculator } from "lucide-react";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AmountInput from "@/components/common/AmountInput";
import GstInput    from "@/components/common/GstInput";
import { Input }   from "@/components/ui/input";

import {
  LogisticsField,
  LogisticsSection,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LBChargesSection({ form, disabled, computed, seq = 2 }) {
  const { register, control, watch, formState: { errors } } = form;
  const gstType = watch("gstType");

  const amt = (name) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AmountInput
          value={field.value}
          onChange={(e) => field.onChange(e.target?.value ?? e)}
          disabled={disabled}
          placeholder="0.00"
          className={inputCls(false, disabled) + " text-right"}
        />
      )}
    />
  );

  const pct = (name) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <GstInput
          value={field.value}
          onChange={(e) => field.onChange(e.target?.value ?? e)}
          disabled={disabled}
          placeholder="0"
          className={inputCls(false, disabled) + " text-right"}
        />
      )}
    />
  );

  return (
    <LogisticsSection title="Charges & Tax" icon={Calculator} seq={seq}>

      <LogisticsField label="Basic Freight ₹">{amt("basicFreight")}</LogisticsField>
      <LogisticsField label="Loading ₹">{amt("loadingCharges")}</LogisticsField>
      <LogisticsField label="Unloading ₹">{amt("unloadingCharges")}</LogisticsField>
      <LogisticsField label="Detention ₹">{amt("waitingCharges")}</LogisticsField>
      <LogisticsField label="Toll / FASTag ₹">{amt("tollCharges")}</LogisticsField>
      <LogisticsField label="Other ₹">{amt("otherCharges")}</LogisticsField>

      <LogisticsField label="Other Description">
        <Input
          {...register("otherChargesDescription")}
          disabled={disabled}
          placeholder="If any"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      {/* Taxable sub-total — reads as a running total line on a bill */}
      <div className="flex items-stretch border-t border-[#CBD5DD]">
        <div className="sm:w-[160px] sm:shrink-0 bg-[#F5E9D9] border-r border-[#CBD5DD] pl-4 pr-2 py-1.5 flex items-center relative">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C97B2E]" />
          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#0F2A3C]">
            Taxable
          </span>
        </div>
        <div className="flex-1 bg-white px-3 py-1.5 flex items-center justify-end font-mono tabular-nums text-[13px] font-semibold text-[#0F2A3C]">
          ₹ {fmt(computed?.taxableAmount)}
        </div>
      </div>

      <LogisticsField label="GST Type" required error={errors.gstType}>
        <Controller
          name="gstType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(errors.gstType, disabled)}>
                <SelectValue placeholder="GST Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IGST">IGST</SelectItem>
                <SelectItem value="CGST_SGST">CGST + SGST</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      {gstType === "IGST" ? (
        <LogisticsField label="IGST %">{pct("igstPercent")}</LogisticsField>
      ) : (
        <>
          <LogisticsField label="CGST %">{pct("cgstPercent")}</LogisticsField>
          <LogisticsField label="SGST %">{pct("sgstPercent")}</LogisticsField>
        </>
      )}

      <LogisticsField label="TDS %">{pct("tdsPercent")}</LogisticsField>

      {/* Receipt-style totals */}
      <div className="border-t-2 border-[#0F2A3C] bg-[#FBFAF6] px-4 py-3 flex flex-col gap-1 text-[12px] font-mono tabular-nums">
        <div className="flex justify-between text-[#4B5A66]">
          <span>GST</span>
          <span>₹ {fmt((computed?.igstAmount || 0) + (computed?.cgstAmount || 0) + (computed?.sgstAmount || 0))}</span>
        </div>
        <div className="flex justify-between text-[#4B5A66]">
          <span>Total</span>
          <span>₹ {fmt(computed?.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-rose-700">
          <span>TDS</span>
          <span>− ₹ {fmt(computed?.tdsAmount)}</span>
        </div>
        <div className="flex justify-between items-center mt-1 pt-2 border-t border-dashed border-[#0F2A3C]/40">
          <span className="text-[10.5px] uppercase tracking-[0.15em] font-bold text-[#0F2A3C] font-sans">
            Net Payable
          </span>
          <span className="text-[17px] font-bold text-[#0F2A3C]">
            ₹ {fmt(computed?.netPayable)}
          </span>
        </div>
      </div>
    </LogisticsSection>
  );
}
