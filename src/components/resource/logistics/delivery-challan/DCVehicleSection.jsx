"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { Truck } from "lucide-react";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";

import {
  LogisticsField,
  LogisticsSection,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const TRANSPORT_MODES = [
  { label: "Road",    value: "Road"    },
  { label: "Rail",    value: "Rail"    },
  { label: "Air",     value: "Air"     },
  { label: "Courier", value: "Courier" },
];

export default function DCVehicleSection({
  form,
  disabled,
  attachedFile,
  existingFileUrl,
  onFileChange,
  onFileClear,
  fileResetKey,
  seq = 3,
}) {
  const { register, control, formState: { errors } } = form;

  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=transporter` })
      .then((r) => setVendors(r.data || []))
      .catch(() => setVendors([]));
  }, []);

  return (
    <LogisticsSection title="Transport & Vehicle" icon={Truck} seq={seq}>

      <LogisticsField label="Transporter">
        <Controller
          name="transporterId"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onChange={(v) => field.onChange(v)}
              options={vendors}
              valueKey="ledgerId"
              labelKey={["ledgerCode", "ledgerName"]}
              searchKeys={["ledgerCode", "ledgerName", "gstin"]}
              labelSeparator=" · "
              placeholder="Select transporter"
              disabled={disabled}
              className={inputCls(false, disabled)}
              clearLabel="— None —"
            />
          )}
        />
      </LogisticsField>

      <LogisticsField label="Transport Mode">
        <Controller
          name="deliveryMode"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(false, disabled)}>
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_MODES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="LR / Consignment No">
        <Input
          {...register("lrNo")}
          disabled={disabled}
          placeholder="Transporter reference"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Vehicle No">
        <Input
          {...register("vehicleNumber")}
          disabled={disabled}
          placeholder="MH-12-AB-1234"
          className={`${inputCls(false, disabled)} uppercase`}
        />
      </LogisticsField>

      <LogisticsField label="Driver Name">
        <Input
          {...register("driverName")}
          disabled={disabled}
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Driver Phone">
        <Input
          {...register("driverContactNumber")}
          disabled={disabled}
          placeholder="10-digit"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Driver License">
        <Input
          {...register("driverLicense")}
          disabled={disabled}
          className={`${inputCls(false, disabled)} uppercase`}
        />
      </LogisticsField>

      <LogisticsField label="E-Way Bill No">
        <Input
          {...register("ewayBillNumber")}
          disabled={disabled}
          placeholder="For dispatches > ₹50k"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="E-Way Bill Date" error={errors.ewayBillDate}>
        <Input
          type="date"
          {...register("ewayBillDate")}
          disabled={disabled}
          className={inputCls(errors.ewayBillDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="E-Way Bill Expiry" error={errors.ewayBillExpiryDate}>
        <Input
          type="date"
          {...register("ewayBillExpiryDate")}
          disabled={disabled}
          className={inputCls(errors.ewayBillExpiryDate, disabled)}
        />
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
