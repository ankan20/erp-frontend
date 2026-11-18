"use client";

import { Controller } from "react-hook-form";
import { Package } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";

import {
  LogisticsField,
  LogisticsSection,
  LogisticsReadOnly,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

const TRANSFER_TYPES = [
  { label: "Sale Dispatch",     value: "Sale_Dispatch"    },
  { label: "Internal Transfer", value: "Internal_Transfer"},
  { label: "Vendor Return",     value: "Vendor_Return"    },
  { label: "Inter-Project",     value: "Inter_Project"    },
];

const PRIORITY = [
  { label: "Urgent", value: "Urgent", color: "text-rose-600"   },
  { label: "High",   value: "High",   color: "text-orange-600" },
  { label: "Medium", value: "Medium", color: "text-amber-600"  },
  { label: "Low",    value: "Low",    color: "text-emerald-600"},
];

export default function TRBasicSection({ form, disabled, mode, seq = 1 }) {
  const { register, control, watch, setValue, formState: { errors } } = form;
  const trNo = watch("trNo");

  return (
    <LogisticsSection title="Request Details" icon={Package} seq={seq}>

      <LogisticsField label="TR No">
        <LogisticsReadOnly value={trNo} />
      </LogisticsField>

      <LogisticsField label="Request Date" required error={errors.requestDate}>
        <Input
          type="date"
          {...register("requestDate")}
          disabled={disabled}
          className={inputCls(errors.requestDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Transfer Type">
        <Controller
          name="transferType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(false, disabled)}>
                <SelectValue placeholder="Select transfer type" />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Priority">
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(false, disabled)}>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={o.color + " font-medium"}>{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Required By">
        <Input
          type="date"
          {...register("requiredDeliveryDate")}
          disabled={disabled}
          className={inputCls(errors.requiredDeliveryDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Purpose">
        <Input
          {...register("purpose")}
          disabled={disabled}
          placeholder="e.g. Site demand for Block-B"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Remarks">
        <ExpandableTextField
          value={watch("remarks")}
          onChange={(val) => setValue("remarks", val)}
          disabled={disabled}
          title="Remarks"
          placeholder="Additional remarks"
          minHeight="min-h-[32px]"
          modalHeight="min-h-[200px]"
        />
      </LogisticsField>
    </LogisticsSection>
  );
}
