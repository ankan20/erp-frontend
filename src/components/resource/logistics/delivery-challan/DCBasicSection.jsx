"use client";

import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { toast } from "sonner";

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

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;
const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

const ORDER_TYPES = [
  { label: "Purchase Order",      value: "Purchase_Order"      },
  { label: "Site Transfer Order", value: "Site_Transfer_Order" },
];

const DISPATCH_TYPES = [
  { label: "Against Transit Request", value: "Against_TR"   },
  { label: "Direct Sale Dispatch",    value: "Direct_Sale"  },
  { label: "Inter-Project Transfer",  value: "Transfer"     },
  { label: "Return to Vendor",        value: "Return"       },
];

export default function DCBasicSection({ form, disabled, mode, onOrderItemsFetched, seq = 1 }) {
  const { register, control, watch, setValue, formState: { errors } } = form;
  const sp = useSearchParams();

  const orderType = watch("orderType");
  const orderId   = watch("orderId");

  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [orders,           setOrders]           = useState([]);
  const [loadingOrders,    setLoadingOrders]    = useState(false);
  const [approvedTRs,      setApprovedTRs]      = useState([]);

  // Load approved orders for this orderType
  useEffect(() => {
    if (!orderType || !projectCode) { setOrders([]); return; }
    setLoadingOrders(true);
    apiRequest({
      url: `${DC.GET_APPROVED_ORDERS}?projectCode=${projectCode}&orderType=${orderType}`,
    })
      .then((r) => setOrders(r.data || []))
      .catch(() => { setOrders([]); toast.error("Failed to load orders"); })
      .finally(() => setLoadingOrders(false));
  }, [orderType, projectCode]);

  // Load approved TRs for the selected order
  useEffect(() => {
    if (!orderId) { setApprovedTRs([]); return; }
    apiRequest({
      url: `${TR.GET_APPROVED_FOR_DC}?projectCode=${projectCode}&orderId=${orderId}`,
    })
      .then((r) => setApprovedTRs(r.data || []))
      .catch(() => setApprovedTRs([]));
  }, [orderId, projectCode]);

  // Pre-select TR from query string (/new?trId=123)
  useEffect(() => {
    const qTrId = sp?.get("trId");
    if (qTrId && mode === "create") {
      setValue("transitRequestId", qTrId);
      setValue("dispatchType", "Against_TR");
    }
  }, [sp, mode, setValue]);

  const onOrderTypeChange = (val) => {
    setValue("orderType", val);
    if (mode === "create") { setValue("orderId", ""); onOrderItemsFetched?.(null); }
  };

  const onOrderChange = async (val) => {
    setValue("orderId", val);
    if (!val) { onOrderItemsFetched?.(null); return; }
    try {
      const r = await apiRequest({ url: `${DC.GET_ORDER_ITEMS}/${val}` });
      onOrderItemsFetched?.(r.data || []);
    } catch { toast.error("Failed to load items"); onOrderItemsFetched?.(null); }
  };

  return (
    <LogisticsSection title="Challan Details" icon={FileText} seq={seq}>

      <LogisticsField label="DC No">
        <LogisticsReadOnly value={watch("dcNo")} />
      </LogisticsField>

      <LogisticsField label="Challan Date" required error={errors.challanDate}>
        <Input
          type="date"
          {...register("challanDate")}
          disabled={disabled}
          className={inputCls(errors.challanDate, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Dispatch Type">
        <Controller
          name="dispatchType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={inputCls(false, disabled)}>
                <SelectValue placeholder="Select dispatch type" />
              </SelectTrigger>
              <SelectContent>
                {DISPATCH_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </LogisticsField>

      <LogisticsField label="Order Type" required error={errors.orderType}>
        <Controller
          name="orderType"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => { field.onChange(v); onOrderTypeChange(v); }}
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

      <LogisticsField label="Order No" required error={errors.orderId}>
        <Controller
          name="orderId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => { field.onChange(v); onOrderChange(v); }}
              disabled={disabled || mode !== "create" || !orderType || loadingOrders}
            >
              <SelectTrigger className={inputCls(errors.orderId, disabled || mode !== "create")}>
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

      {approvedTRs.length > 0 && (
        <LogisticsField label="Transit Request">
          <Controller
            name="transitRequestId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger className={inputCls(false, disabled)}>
                  <SelectValue placeholder="Link to approved TR (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {approvedTRs.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.trNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </LogisticsField>
      )}

      <LogisticsField label="Purpose">
        <Input
          {...register("purposeForDelivery")}
          disabled={disabled}
          placeholder="e.g. Site delivery, Return goods"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>

      <LogisticsField label="Contact Person">
        <Input
          {...register("contactPerson")}
          disabled={disabled}
          placeholder="Receiving contact"
          className={inputCls(false, disabled)}
        />
      </LogisticsField>
    </LogisticsSection>
  );
}
