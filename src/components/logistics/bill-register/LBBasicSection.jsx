"use client";

import { Controller } from "react-hook-form";
import { Receipt } from "lucide-react";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";

import {
  LogisticsField,
  LogisticsSection,
  LogisticsReadOnly,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

const FREIGHT_BASIS = [
  { label: "Fixed",    value: "Fixed"    },
  { label: "Per KM",   value: "Per_KM"   },
  { label: "Per Ton",  value: "Per_Ton"  },
  { label: "Per Trip", value: "Per_Trip" },
];

export default function LBBasicSection({
  form,
  disabled,
  vendors,
  attachedFile,
  existingFileUrl,
  onFileChange,
  onFileClear,
  fileResetKey,
  seq = 1,
}) {
  const { register, control, watch, setValue, formState: { errors } } = form;

  return (
    <LogisticsSection title="Bill Details" icon={Receipt} seq={seq}>

      <LogisticsField label="LB No">
        <LogisticsReadOnly value={watch("lbNo")} />
      </LogisticsField>

      <LogisticsField label="Bill Date" required error={errors.billDate}>
        <Input
          type="date"
          {...register("billDate")}
          disabled={disabled}
          className={inputCls(errors.billDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Transporter" required error={errors.vendorId}>
        <Controller
          name="vendorId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onChange={(v) => field.onChange(v)}
              options={vendors || []}
              valueKey="ledgerId"
              labelKey={["ledgerCode", "ledgerName"]}
              searchKeys={["ledgerCode", "ledgerName", "gstin"]}
              labelSeparator=" · "
              placeholder="Select transporter"
              disabled={disabled}
              className={inputCls(errors.vendorId, disabled)}
            />
          )}
        />
      </LogisticsField>

      <LogisticsField label="Invoice No" required error={errors.vendorInvoiceNo}>
        <Input
          {...register("vendorInvoiceNo")}
          disabled={disabled}
          placeholder="Vendor invoice ref"
          className={inputCls(errors.vendorInvoiceNo, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Invoice Date" required error={errors.vendorInvoiceDate}>
        <Input
          type="date"
          {...register("vendorInvoiceDate")}
          disabled={disabled}
          className={inputCls(errors.vendorInvoiceDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Freight Basis">
        <Controller
          name="freightBasis"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(false, disabled)}>
                <SelectValue placeholder="Basis" />
              </SelectTrigger>
              <SelectContent>
                {FREIGHT_BASIS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Remarks">
        <div className="flex-1 min-w-0">
          <ExpandableTextArea
            value={watch("remarks") ?? ""}
            onChange={(v) => setValue("remarks", v)}
            disabled={disabled}
            title="Remarks"
            placeholder="Additional notes"
            rows={1}
            maxInlineRows={3}
            modalRows={8}
          />
        </div>
      </LogisticsField>

      <LogisticsField label="Attachment">
        <FileUpload
          showLabel={false}
          onChange={onFileChange}
          existingUrl={existingFileUrl}
          onClearExisting={onFileClear}
          disabled={disabled}
          resetKey={fileResetKey}
          accept={ACCEPT_ALL}
          allowedTypes={TYPES_ALL}
          showImagePreview={true}
        />
      </LogisticsField>
    </LogisticsSection>
  );
}
