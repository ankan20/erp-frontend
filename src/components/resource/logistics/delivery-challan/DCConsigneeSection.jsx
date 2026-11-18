"use client";

import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";

import {
  LogisticsField,
  LogisticsSection,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

// Consignee = the receiving party, printed on the DC + e-way bill.
// Required on Direct Sale dispatch; optional on internal transfers.

export default function DCConsigneeSection({ form, disabled, seq = 2 }) {
  const { register, watch, setValue, formState: { errors } } = form;

  return (
    <LogisticsSection title="Consignee (Ship To)" icon={Building2} seq={seq}>

      <LogisticsField label="Name">
        <Input
          {...register("consigneeName")}
          disabled={disabled}
          placeholder="Receiving party name"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="GSTIN">
        <Input
          {...register("consigneeGstin")}
          disabled={disabled}
          placeholder="22AAAAA0000A1Z5"
          maxLength={15}
          className={`${inputCls(false, disabled)} uppercase`}
        />
      </LogisticsField>

      <LogisticsField label="Address">
        <ExpandableTextField
          value={watch("consigneeAddress")}
          onChange={(val) => setValue("consigneeAddress", val)}
          disabled={disabled}
          title="Consignee Address"
          placeholder="Full ship-to address"
          minHeight="min-h-[32px]"
          modalHeight="min-h-[200px]"
        />
      </LogisticsField>

      <LogisticsField label="Ship-To Address">
        <ExpandableTextField
          value={watch("shippingToAddress")}
          onChange={(val) => setValue("shippingToAddress", val)}
          disabled={disabled}
          title="Shipping Address"
          placeholder="If different from above"
          minHeight="min-h-[32px]"
          modalHeight="min-h-[200px]"
        />
      </LogisticsField>
    </LogisticsSection>
  );
}
