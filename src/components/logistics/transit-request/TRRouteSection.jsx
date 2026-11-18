"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { Route } from "lucide-react";
import { toast } from "sonner";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import AmountInput from "@/components/common/AmountInput";
import SearchableSelect from "@/components/common/SearchableSelect";
import FileUpload, { ACCEPT_ALL, TYPES_ALL } from "@/components/common/FileUpload";

import {
  LogisticsField,
  LogisticsSection,
  inputCls,
} from "@/components/logistics/common/LogisticsField";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

const ORDER_TYPES = [
  { label: "Purchase Order",      value: "Purchase_Order"      },
  { label: "Site Transfer Order", value: "Site_Transfer_Order" },
];

const TRANSPORT_MODES = [
  { label: "Road",    value: "Road"    },
  { label: "Rail",    value: "Rail"    },
  { label: "Air",     value: "Air"     },
  { label: "Courier", value: "Courier" },
];

export default function TRRouteSection({
  form,
  disabled,
  mode,
  onOrderItemsFetched,
  attachedFile,
  existingFileUrl,
  onFileChange,
  onFileClear,
  fileResetKey,
  seq = 2,
}) {
  const { register, control, watch, setValue, formState: { errors } } = form;
  const orderType = watch("orderType");
  const orderId   = watch("orderId");

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [orders,        setOrders]        = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [vendors,       setVendors]       = useState([]);

  // Load approved orders when orderType changes
  useEffect(() => {
    if (!orderType || !projectCode) { setOrders([]); return; }
    setLoadingOrders(true);
    apiRequest({
      url: `${TR.GET_APPROVED_ORDERS}?projectCode=${projectCode}&orderType=${orderType}`,
    })
      .then((r) => setOrders(r.data || []))
      .catch(() => { setOrders([]); toast.error("Failed to load orders"); })
      .finally(() => setLoadingOrders(false));
  }, [orderType, projectCode]);

  // Transporter vendors (for preferred carrier)
  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=transporter` })
      .then((r) => setVendors(r.data || []))
      .catch(() => setVendors([]));
  }, []);

  const handleOrderTypeChange = (val) => {
    setValue("orderType", val);
    if (mode === "create") {
      setValue("orderId", "");
      onOrderItemsFetched?.(null);
    }
  };

  const handleOrderChange = async (val) => {
    setValue("orderId", val);
    if (!val) { onOrderItemsFetched?.(null); return; }
    try {
      const r = await apiRequest({ url: `${TR.GET_ORDER_ITEMS}/${val}` });
      onOrderItemsFetched?.(r.data || []);
    } catch {
      toast.error("Failed to load order items");
      onOrderItemsFetched?.(null);
    }
  };

  return (
    <LogisticsSection title="Route & Transport" icon={Route} seq={seq}>

      <LogisticsField label="Order Type" required error={errors.orderType}>
        <Controller
          name="orderType"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => { field.onChange(v); handleOrderTypeChange(v); }}
              disabled={disabled || mode !== "create"}
            >
              <SelectTrigger className={inputCls(errors.orderType, disabled || mode !== "create")}>
                <SelectValue placeholder="Select Order Type" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Order No">
        <Controller
          name="orderId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => { field.onChange(v); handleOrderChange(v); }}
              disabled={disabled || mode !== "create" || !orderType || loadingOrders}
            >
              <SelectTrigger className={inputCls(false, disabled || mode !== "create")}>
                <SelectValue placeholder={loadingOrders ? "Loading…" : "Select order"} />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.orderNo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Source" required error={errors.sourceLocation}>
        <Input
          {...register("sourceLocation")}
          disabled={disabled}
          placeholder="Dispatch location"
          className={inputCls(errors.sourceLocation, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Destination" required error={errors.destinationLocation}>
        <Input
          {...register("destinationLocation")}
          disabled={disabled}
          placeholder="Delivery location"
          className={inputCls(errors.destinationLocation, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Transport Mode">
        <Controller
          name="modeOfTransport"
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

      <LogisticsField label="Preferred Carrier">
        <Controller
          name="preferredCarrierId"
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
              placeholder="Transporter (optional)"
              disabled={disabled}
              className={inputCls(false, disabled)}
              clearLabel="— None —"
            />
          )}
        />
      </LogisticsField>

      <LogisticsField label="Est. Freight ₹">
        <Controller
          name="estimatedFreight"
          control={control}
          render={({ field }) => (
            <AmountInput
              value={field.value}
              onChange={(e) => field.onChange(e.target?.value ?? e)}
              disabled={disabled}
              placeholder="0.00"
              className={inputCls(false, disabled)}
            />
          )}
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
