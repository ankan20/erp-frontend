"use client";

import { useEffect, useState } from "react";
import { Controller }          from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { Loader2 }        from "lucide-react";

import SaveButton        from "@/components/common/SaveButton";
import EditButton        from "@/components/common/EditButton";
import SearchableSelect  from "@/components/common/SearchableSelect";
import PMSection         from "@/components/project-management/common/PMSection";
import PMFormRow         from "@/components/project-management/common/PMFormRow";
import PMDateInput       from "@/components/project-management/common/PMDateInput";
import PMTextarea        from "@/components/project-management/common/PMTextarea";
import AmountInput       from "@/components/common/AmountInput";
import { formatAmount }  from "@/helper/numberFormatter";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  paymentMode:    z.enum(["Cash", "Bank"]).default("Bank"),
  cashAcId:       z.coerce.number().nullable().optional().default(null),
  bankAcId:       z.coerce.number().nullable().optional().default(null),
  utrVoucherNo:   z.string().optional().default(""),
  paymentRemarks: z.string().optional().default(""),
  totalAmount:    z.coerce.number().min(0.01, "Total Amount is required"),
});

const DEFAULT_VALUES = {
  paymentMode:    "Bank",
  cashAcId:       null,
  bankAcId:       null,
  utrVoucherNo:   "",
  paymentRemarks: "",
  totalAmount:    "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SaleReceiptParentForm({ mode = "create", receiptId, onSaved }) {
  const router      = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,    setIsEditing]    = useState(mode === "create");
  const [isLoading,    setIsLoading]    = useState(false);
  const [initialData,  setInitialData]  = useState(null);
  const [receiptNo,    setReceiptNo]    = useState("");
  const [entryDate,    setEntryDate]    = useState("");
  const [bankCashOpts, setBankCashOpts] = useState([]);

  const {
    register, control, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const paymentMode  = watch("paymentMode");
  const watchTotal   = watch("totalAmount");
  const disabled     = !isEditing || isSubmitting;

  const bankFiltered = bankCashOpts
    .filter((a) => a.type === "BANK")
    .map((a) => ({ ...a, displayLabel: [a.bankName, a.bankAcNumber].filter(Boolean).join(" — ") || a.bankHolderName || a.bankCode }));
  const cashFiltered = bankCashOpts
    .filter((a) => a.type === "CASH")
    .map((a) => ({ ...a, displayLabel: [a.bankHolderName, a.bankCode].filter(Boolean).join(" — ") }));

  // ── Load bank/cash accounts ───────────────────────────────────────────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.BANK_CASH.LIST}?projectCode=${projectCode}`, method: "GET" })
      .then((res) => setBankCashOpts(res.data || []))
      .catch(() => {});
  }, [projectCode]);

  // ── Fetch parent detail (edit/view) ──────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !receiptId) return;
    setIsLoading(true);
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.GET_BY_ID}${receiptId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};
        const values = {
          paymentMode:    d.paymentMode    || "Bank",
          cashAcId:       d.cashAcId       || null,
          bankAcId:       d.bankAcId       || null,
          utrVoucherNo:   d.utrVoucherNo   || "",
          paymentRemarks: d.paymentRemarks || "",
          totalAmount:    Number(d.totalAmount || 0),
        };
        reset(values);
        setInitialData(values);
        setReceiptNo(d.receiptNo  || "");
        setEntryDate(d.entryDate  || "");
      })
      .catch(() => toast.error("Failed to load receipt details"))
      .finally(() => setIsLoading(false));
  }, [receiptId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSubmit = async (v) => {
    const payload = {
      projectCode,
      paymentMode:    v.paymentMode,
      cashAcId:       v.paymentMode === "Cash" ? (v.cashAcId || null) : null,
      bankAcId:       v.paymentMode === "Bank" ? (v.bankAcId || null) : null,
      utrVoucherNo:   v.utrVoucherNo   || "",
      paymentRemarks: v.paymentRemarks || "",
      totalAmount:    Number(v.totalAmount),
    };
    try {
      if (mode === "create") {
        const res = await apiRequest({
          url: API_ENDPOINTS.FINANCE.SALE_RECEIPT.CREATE, method: "POST", data: payload,
        });
        toast.success("Receipt created");
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/receipt/${newId}`), 350);
      } else {
        await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.EDIT}${receiptId}`, method: "PUT", data: payload,
        });
        toast.success("Receipt updated");
        setIsEditing(false);
        setInitialData(v);
        onSaved?.();
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const inputCls = (err) =>
    `w-full h-[30px] text-[13px] rounded-sm border px-2 outline-none transition ${
      err
        ? "border-red-500 bg-red-50 text-red-700"
        : disabled
        ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500"
        : "border-gray-300 bg-white focus:border-[#3b6ea5]"
    }`;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[200px]">
        <Loader2 className="animate-spin w-5 h-5" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">

      <PMSection title="Receipt Details:">
        {mode !== "create" && (
          <>
            <PMFormRow label="Receipt No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={receiptNo || "[Auto]"} disabled readOnly className={inputCls()} />
            </PMFormRow>
            <PMFormRow label="Entry Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <input value={entryDate ? getfmtDisplaydate(entryDate) : "[Auto - Today]"} disabled readOnly className={inputCls()} />
            </PMFormRow>
          </>
        )}

        <PMFormRow label="Payment Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
          <Controller name="paymentMode" control={control} render={({ field }) => (
            <div className="flex gap-4 items-center h-[30px]">
              {["Cash", "Bank"].map((m) => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                  <input type="radio" value={m} checked={field.value === m} disabled={disabled}
                    onChange={() => field.onChange(m)} className="accent-[#3b6ea5]" />
                  {m}
                </label>
              ))}
            </div>
          )} />
        </PMFormRow>

        {paymentMode === "Cash" && (
          <PMFormRow label="Cash A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <Controller name="cashAcId" control={control} render={({ field }) => (
              <SearchableSelect
                options={cashFiltered}
                value={field.value ? String(field.value) : ""}
                disabled={disabled}
                onChange={(v) => field.onChange(v ? Number(v) : null)}
                placeholder="Select Cash A/c"
                labelKey="displayLabel"
                valueKey="id"
                searchKeys={["bankHolderName", "bankCode", "bankAcNumber", "bankName", "branchName"]}
              />
            )} />
          </PMFormRow>
        )}

        {paymentMode === "Bank" && (
          <PMFormRow label="Bank A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
            <Controller name="bankAcId" control={control} render={({ field }) => (
              <SearchableSelect
                options={bankFiltered}
                value={field.value ? String(field.value) : ""}
                disabled={disabled}
                onChange={(v) => field.onChange(v ? Number(v) : null)}
                placeholder="Select Bank A/c"
                labelKey="displayLabel"
                valueKey="id"
                searchKeys={["bankName", "bankHolderName", "bankCode", "bankAcNumber", "branchName"]}
              />
            )} />
          </PMFormRow>
        )}

        <PMFormRow label="UTR / Voucher No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
          <input {...register("utrVoucherNo")} disabled={disabled} placeholder="UTR / Voucher reference"
            className={inputCls(errors.utrVoucherNo)} />
        </PMFormRow>

        <PMFormRow label="Total Amount" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
          <div className="max-w-[180px]">
            <AmountInput
              {...register("totalAmount")}
              value={watchTotal}
              disabled={disabled}
              placeholder="0.00"
              className={inputCls(errors.totalAmount)}
            />
            {errors.totalAmount && (
              <p className="text-[11px] text-red-500 mt-0.5">{errors.totalAmount.message}</p>
            )}
          </div>
        </PMFormRow>

        <PMFormRow label="Payment Remarks" labelWidth="sm:w-[150px] sm:min-w-[150px]">
          <Controller name="paymentRemarks" control={control} render={({ field }) => (
            <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled}
              placeholder="Remarks" rows={2} maxRows={5} />
          )} />
        </PMFormRow>
      </PMSection>

      <div className="flex items-center justify-end gap-2 pt-1">
        {isEditing && (
          <SaveButton
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
            requireConfirmation={mode !== "create"}
            confirmationTitle={mode === "create" ? undefined : "Save Receipt?"}
            confirmationMessage={mode === "create" ? undefined : "Update this receipt's payment details?"}
          >
            {mode === "create" ? "Create Receipt" : "Save"}
          </SaveButton>
        )}
        {mode !== "create" && (
          <EditButton onClick={handleEdit} disabled={isSubmitting}>
            {isEditing ? "Cancel" : "Edit"}
          </EditButton>
        )}
      </div>
    </form>
  );
}
