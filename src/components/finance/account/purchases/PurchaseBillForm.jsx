"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z }              from "zod";
import { zodResolver }    from "@hookform/resolvers/zod";
import { toast }          from "sonner";
import { useRouter }      from "next/navigation";
import { FileSearch, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";
import SearchableSelect    from "@/components/common/SearchableSelect";
import PMSection           from "@/components/project-management/common/PMSection";
import PMFormRow           from "@/components/project-management/common/PMFormRow";
import PMDateInput         from "@/components/project-management/common/PMDateInput";
import PMTextarea          from "@/components/project-management/common/PMTextarea";
import PMInput             from "@/components/project-management/common/PMInput";

import {
  DEFAULT_GST_LINES,
  mapApiGstLines,
  igstEquivalent,
} from "@/components/finance/account/common/AccountGstTable";
import AccountSummary         from "@/components/finance/account/common/AccountSummary";
import BrrPickerModal                from "@/components/finance/account/purchases/BrrPickerModal";
import PurchaseBillBreakdownTable   from "@/components/finance/account/purchases/PurchaseBillBreakdownTable";
import AccountingJournalTable       from "@/components/finance/account/common/AccountingJournalTable";
import { getfmtDisplaydate }        from "@/helper/getfmtDisplayDate";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import AiPanel           from "@/components/ai/AiPanel";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }       from "@/lib/dateUtils";

const PURCHASE_BILL_MODES = [
  { label: "Purchases Invoice", value: "purchase_invoice" },
  { label: "Proforma Invoice",  value: "proforma_invoice" },
];


// ─── Schema ───────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  slNo:        z.number(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  hsnSac:      z.string().optional().default(""),
  basicAmount: z.coerce.number().min(0).default(0),
});

const gstLineSchema = z.object({
  gstType:     z.string(),
  ccCode:      z.string(),
  ccName:      z.string(),
  description: z.string().optional().default(""),
  percent:     z.number(),
  gstAmount:   z.coerce.number().default(0),
  isSelected:  z.boolean().default(false),
});

const schema = z.object({
  mode:           z.string().min(1, "Mode is required"),
  vendorId:       z.coerce.number().min(1, "Party is required"),
  processingDate: zodDate(z, "processingDate", true),
  brrId:          z.coerce.number().nullable().optional(),
  brrNo:          z.string().optional().default(""),
  brrDate:        z.string().optional().default(""),
  orderNo:        z.string().optional().default(""),
  vendorBillNo:   z.string().optional().default(""),
  vendorBillDate: zodDate(z, "vendorBillDate"),
  remarks:        z.string().optional().default(""),
  discount:       z.coerce.number().min(0).default(0),
  roundOff:       z.coerce.number().default(0),
  items:          z.array(itemSchema).min(1, "At least one item required"),
  gstLines:       z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  mode: "",
  vendorId: null,
  processingDate: new Date().toISOString().split("T")[0],
  brrId: null,
  brrNo: "",
  brrDate: "",
  orderNo: "",
  vendorBillNo: "",
  vendorBillDate: "",
  remarks: "",
  discount: 0,
  roundOff: 0,
  items: [],
  gstLines: DEFAULT_GST_LINES,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseBillForm({ mode = "create", billId, onAfterSubmit, onUuid }) {
  const router      = useRouter();
  const isViewMode  = mode === "view" || mode === "approver";
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [erpBillNo,   setErpBillNo]   = useState("");
  const [actualGstTotal, setActualGstTotal] = useState(null);

  const [vendorList,     setVendorList]     = useState([]);
  const [brrPickerOpen,  setBrrPickerOpen]  = useState(false);
  const [itemsLoading,   setItemsLoading]   = useState(false);

  const {
    register, control, handleSubmit, reset, setValue, watch, getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const disabled         = isViewMode || !isEditing || isSubmitting || isSubmitted;
  const watchedBrrNo     = watch("brrNo");
  const watchedBrrDate   = watch("brrDate");
  const selectedVendorId = watch("vendorId");

  // ── Journal derivations ──────────────────────────────────────────────────────
  const watchedItems    = watch("items")    || [];
  const watchedGstLines = watch("gstLines") || DEFAULT_GST_LINES;
  const watchedDiscount = Number(watch("discount") || 0);
  const watchedRoundOff = Number(watch("roundOff") || 0);

  const vendorName = useMemo(
    () => vendorList.find((v) => String(v.ledgerId) === String(selectedVendorId))?.ledgerName || "Sundry Creditor",
    [vendorList, selectedVendorId],
  );

  const basicTotal = useMemo(
    () => watchedItems.reduce((s, it) => s + Number(it?.basicAmount || 0), 0),
    [watchedItems],
  );

  // Mirror AccountGstTable maths so amounts stay accurate after selection toggles
  const isIGST     = !!watchedGstLines[0]?.isSelected;
  const isCGSTSGST = !!watchedGstLines[1]?.isSelected;
  const hasActual  = actualGstTotal !== null && actualGstTotal !== undefined;
  const igstAmt    = isIGST     ? (hasActual ? actualGstTotal     : basicTotal * (watchedGstLines[0]?.percent || 18) / 100) : 0;
  const cgstAmt    = isCGSTSGST ? (hasActual ? actualGstTotal / 2 : basicTotal * (watchedGstLines[1]?.percent || 9)  / 100) : 0;
  const sgstAmt    = isCGSTSGST ? (hasActual ? actualGstTotal / 2 : basicTotal * (watchedGstLines[2]?.percent || 9)  / 100) : 0;
  const gstTotal   = igstAmt + cgstAmt + sgstAmt;

  // Sync computed GST amounts back into form state so the journal table reads them
  useEffect(() => {
    setValue("gstLines.0.gstAmount", igstAmt, { shouldDirty: false });
    setValue("gstLines.1.gstAmount", cgstAmt, { shouldDirty: false });
    setValue("gstLines.2.gstAmount", sgstAmt, { shouldDirty: false });
  }, [igstAmt, cgstAmt, sgstAmt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto round-off
  useEffect(() => {
    const subtotal = basicTotal + gstTotal - watchedDiscount;
    const auto = parseFloat((Math.round(subtotal) - subtotal).toFixed(2));
    setValue("roundOff", auto, { shouldDirty: false });
  }, [basicTotal, gstTotal, watchedDiscount]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalInvoice = basicTotal + gstTotal - watchedDiscount + watchedRoundOff;

  // All DR entries for journal: item rows (not toggleable) + all 3 GST rows (toggleable)
  const journalEntries = useMemo(() => {
    if (watchedItems.length === 0) return [];
    const entries = [];
    watchedItems.forEach((it) => {
      if (Number(it?.basicAmount || 0) > 0) {
        entries.push({ ccCode: it.ccCode, ccName: it.ccName, amount: Number(it.basicAmount || 0), isSelected: true, toggleable: false });
      }
    });
    watchedGstLines.forEach((g) => {
      entries.push({ ccCode: g.gstType, ccName: g.ccName, amount: Number(g.gstAmount || 0), isSelected: !!g.isSelected, toggleable: true, toggleKey: g.gstType });
    });
    return entries;
  }, [watchedItems, watchedGstLines]);

  const totalDr = journalEntries.filter((e) => e.isSelected).reduce((s, e) => s + e.amount, 0);
  const totalCr = totalDr; // Always balanced: CR vendor mirrors sum of selected DR entries

  // ── GST toggle (IGST ↔ CGST+SGST mutual exclusion) ──────────────────────────
  // Full array replacement so watch("gstLines") always gets a new reference.
  // Also bake in the new gstAmount immediately so the breakdown table doesn't
  // show "—" for one render while the separate useEffect is still pending.
  const handleGstToggle = useCallback((gstType, checked) => {
    const current = getValues("gstLines") || DEFAULT_GST_LINES;

    const willIGST     = gstType === "IGST" ? checked : (checked ? false : current[0].isSelected);
    const willCGSTSGST = gstType !== "IGST" ? checked : (checked ? false : current[1].isSelected);

    const curActual = actualGstTotal;
    const curHasActual = curActual !== null && curActual !== undefined;

    const newIgstAmt  = willIGST     ? (curHasActual ? curActual     : basicTotal * (current[0]?.percent || 18) / 100) : 0;
    const newCgstAmt  = willCGSTSGST ? (curHasActual ? curActual / 2 : basicTotal * (current[1]?.percent || 9)  / 100) : 0;
    const newSgstAmt  = willCGSTSGST ? (curHasActual ? curActual / 2 : basicTotal * (current[2]?.percent || 9)  / 100) : 0;
    const newAmts     = [newIgstAmt, newCgstAmt, newSgstAmt];
    const newSelected = [willIGST, willCGSTSGST, willCGSTSGST];

    const updated = current.map((g, i) => ({
      ...g,
      isSelected: newSelected[i],
      gstAmount:  newAmts[i],
    }));
    setValue("gstLines", updated, { shouldDirty: true });
  }, [setValue, getValues, basicTotal, actualGstTotal]);

  // ── Load Vendors (sundry creditors only: isDebtor=false) ────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((res) => {
        const creditors = (res.data || [])
          .filter((v) => v.isDebtor === false || v.isDebtor === "false")
          .sort((a, b) => (a.ledgerName || "").localeCompare(b.ledgerName || ""));
        setVendorList(creditors);
      })
      .catch(() => toast.error("Failed to load vendor list"));
  }, []);

  // ── Handle Vendor selection ──────────────────────────────────────────────────
  const handleVendorChange = (v) => {
    setValue("vendorId", v ? Number(v) : null, { shouldDirty: true });
    setValue("brrId",   null, { shouldDirty: true });
    setValue("brrNo",   "",   { shouldDirty: true });
    setValue("brrDate", "",   { shouldDirty: true });
    setValue("orderNo", "",   { shouldDirty: true });
    setValue("items",   [],   { shouldDirty: true });
    setActualGstTotal(null);
  };

  // ── Handle BRR confirmed from picker ────────────────────────────────────────
  const handleBrrPickerConfirm = useCallback(
    async ({ brrId, brrNo, brrDate, orderNo }) => {
      setValue("brrId",   brrId,        { shouldDirty: true });
      setValue("brrNo",   brrNo  || "", { shouldDirty: true });
      setValue("brrDate", brrDate || "", { shouldDirty: true });
      setValue("orderNo", orderNo || "", { shouldDirty: true });
      setValue("items", [], { shouldDirty: true });
      setActualGstTotal(null);

      if (!brrId || !projectCode) return;
      setItemsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.BRR_ITEMS}?brrId=${brrId}&projectCode=${projectCode}`,
          method: "GET",
        });
        const d = res.data || {};
        setValue("vendorBillNo",   d.vendorBillNo   || "");
        setValue("vendorBillDate", d.vendorBillDate || "");

        const newItems = (d.items || []).map((it, i) => ({
          slNo:        i + 1,
          ccCode:      it.ccCode      || "",
          ccName:      it.ccName      || "",
          description: it.description || "",
          hsnSac:      it.hsnSac      || "",
          basicAmount: Number(it.basicAmount || 0),
        }));
        setValue("items", newItems, { shouldDirty: true });
        setValue("gstLines", mapApiGstLines(d.gstLines), { shouldDirty: true });
        setActualGstTotal(igstEquivalent(d.gstLines));
        setAllowSubmit(false);
      } catch {
        setActualGstTotal(null);
        toast.error("Failed to load BRR items");
      } finally {
        setItemsLoading(false);
      }
    },
    [projectCode, setValue],
  );

  // ── Load Detail (edit/view) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!billId || mode === "create") return;
    apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.GET_BY_ID}${billId}`, method: "GET" })
      .then((res) => {
        const d = res.data || {};

        const formatted = {
          mode:           d.mode           || "",
          vendorId:       d.vendorId       || null,
          processingDate: d.processingDate || "",
          brrId:          d.brrId          || null,
          brrNo:          d.brrNo          || "",
          brrDate:        d.brrDate        || "",
          orderNo:        d.orderNo        || "",
          vendorBillNo:   d.vendorBillNo   || "",
          vendorBillDate: d.vendorBillDate || "",
          remarks:        d.remarks        || "",
          discount:       Number(d.discount || 0),
          roundOff:       Number(d.roundOff || 0),
          items: (d.items || []).map((it, i) => ({
            slNo:        i + 1,
            ccCode:      it.ccCode      || "",
            ccName:      it.ccName      || "",
            description: it.description || "",
            hsnSac:      it.hsnSac      || "",
            basicAmount: Number(it.basicAmount || 0),
          })),
          gstLines: d.gstLines?.length
            ? mapApiGstLines(d.gstLines, { keepSelection: true })
            : DEFAULT_GST_LINES,
        };
        reset(formatted);

        const savedBasic = formatted.items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);
        const igstPct    = Number(formatted.gstLines[0]?.percent || 0);
        const pairPct    = Number(formatted.gstLines[1]?.percent || 0) + Number(formatted.gstLines[2]?.percent || 0);
        const effPct     = igstPct > 0 ? igstPct : pairPct;
        setActualGstTotal(effPct > 0 && savedBasic > 0 ? (savedBasic * effPct) / 100 : null);

        const locked = d.workflowStatus && !["Draft", "Reback"].includes(d.workflowStatus);
        setIsSubmitted(locked);
        setAllowSubmit(!locked);
        if (d.purchaseBillNo) setErpBillNo(d.purchaseBillNo);
        if (d.purchaseBillUuid && onUuid) onUuid(d.purchaseBillUuid);
      })
      .catch(() => toast.error("Failed to load bill details"));
  }, [billId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save Draft ───────────────────────────────────────────────────────────────
  const onSave = async (v) => {
    const igstSelected    = !!v.gstLines?.[0]?.isSelected;
    const cgstSgstSelected = !!v.gstLines?.[1]?.isSelected;
    if (!igstSelected && !cgstSgstSelected) {
      toast.error("Please select a GST type — either IGST or CGST + SGST — before saving.");
      return;
    }

    const url    = mode === "create"
      ? API_ENDPOINTS.FINANCE.PURCHASE_BILL.CREATE
      : `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.EDIT}${billId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      projectCode,
      mode:           v.mode,
      vendorId:       v.vendorId,
      processingDate: v.processingDate,
      brrId:          v.brrId ? Number(v.brrId) : null,
      orderNo:        v.orderNo || "",
      vendorBillNo:   v.vendorBillNo   || "",
      vendorBillDate: v.vendorBillDate || "",
      remarks:        v.remarks        || "",
      discount:       Number(v.discount || 0),
      roundOff:       Number(v.roundOff || 0),
      items: (v.items || []).map((it, i) => ({
        slNo:        it.slNo || i + 1,
        ccCode:      it.ccCode,
        ccName:      it.ccName,
        description: it.description || "",
        hsnSac:      it.hsnSac      || "",
        basicAmount: Number(it.basicAmount || 0),
      })),
      gstLines: (v.gstLines || []).map((l) => ({
        gstType:     l.gstType,
        ccCode:      l.ccCode,
        ccName:      l.ccName,
        description: l.description || "",
        percent:     l.percent,
        gstAmount:   l.gstAmount,
        isSelected:  l.isSelected,
      })),
    };

    try {
      const res = await apiRequest({ url, method, data: payload });
      toast.success(mode === "create" ? "Bill saved as draft" : "Bill updated");
      setAllowSubmit(true);
      setIsEditing(false);
      onAfterSubmit?.();
      if (res?.data?.purchaseBillUuid && onUuid) onUuid(res.data.purchaseBillUuid);
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/purchases/bill/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    }
  };

  // ── Submit for Approval ───────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    try {
      await apiRequest({ url: `${API_ENDPOINTS.FINANCE.PURCHASE_BILL.SUBMIT}${billId}`, method: "POST" });
      toast.success("Bill submitted for approval");
      setIsSubmitted(true);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Failed to submit");
    }
  };

  const handleEdit = () => {
    if (isEditing) { reset(); setIsEditing(false); }
    else setIsEditing(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-3">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        title={sidebarOpen ? "Hide left panel" : "Show left panel"}
        className="mb-2 hidden lg:inline-flex p-1 rounded hover:bg-gray-100 text-gray-500 transition"
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          {/* Mode */}
          <PMSection title="Mode:">
            <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <SearchableSelect
                options={PURCHASE_BILL_MODES}
                value={watch("mode") || ""}
                disabled={disabled}
                onChange={(v) => setValue("mode", v, { shouldDirty: true })}
                placeholder="Select Mode"
                labelKey="label"
                valueKey="value"
                searchKeys={["label"]}
              />
            </PMFormRow>
          </PMSection>

          {/* Bill Details */}
          <PMSection title="Bill Details:">
            <PMFormRow label="ERP Doc. No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={erpBillNo || "[Auto]"} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Processing Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput {...register("processingDate")} disabled={disabled} hasError={errors.processingDate} className="max-w-[200px]" />
            </PMFormRow>
          </PMSection>

          {/* Vendor + BRR Picker */}
          <PMSection title="Party:">
            <PMFormRow label="Party Name" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <Controller name="vendorId" control={control} render={({ field }) => (
                    <SearchableSelect
                      options={vendorList}
                      value={field.value ? String(field.value) : ""}
                      disabled={disabled}
                      onChange={(v) => handleVendorChange(v)}
                      placeholder="Select Vendor (Sundry Creditor)"
                      labelKey="ledgerName"
                      valueKey="ledgerId"
                      searchKeys={["ledgerName"]}
                    />
                  )} />
                </div>
                {!disabled && (
                  <button
                    type="button"
                    title="Select BRR"
                    disabled={!selectedVendorId}
                    onClick={() => setBrrPickerOpen(true)}
                    className="shrink-0 p-1.5 rounded border border-gray-300 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <FileSearch size={16} />
                  </button>
                )}
              </div>
            </PMFormRow>

            {/* Selected BRR info badge */}
            {watchedBrrNo && (
              <div className="mx-1 mt-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md text-[11px] text-blue-800 flex items-center gap-2">
                {itemsLoading && <Loader2 size={11} className="animate-spin shrink-0" />}
                <span>
                  BRR: <strong>{watchedBrrNo}</strong>
                  {watchedBrrDate && <> · {getfmtDisplaydate(watchedBrrDate)}</>}
                </span>
              </div>
            )}
            {!watchedBrrNo && !disabled && selectedVendorId && (
              <p className="mx-1 mt-1 text-[11px] text-gray-400">
                Click <FileSearch size={11} className="inline" /> to select a BRR.
              </p>
            )}
          </PMSection>

          {/* Vendor Bill details */}
          <PMSection title="Vendor Bill:">
            <PMFormRow label="Vendor Bill No" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillNo" control={control} render={({ field }) => (
                <PMInput {...field} disabled={disabled} placeholder="[From BVS]" fieldLabel="Vendor Bill No" />
              )} />
            </PMFormRow>
            <PMFormRow label="Vendor Bill Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="vendorBillDate" control={control} render={({ field }) => (
                <PMDateInput {...field} disabled={disabled} className="max-w-[200px]" />
              )} />
            </PMFormRow>
          </PMSection>

          {/* Remarks */}
          <PMSection title="Other:">
            <PMFormRow label="Remarks" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller name="remarks" control={control} render={({ field }) => (
                <PMTextarea value={field.value || ""} onChange={field.onChange} disabled={disabled} placeholder="Text" rows={3} maxRows={8} />
              )} />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Accounting Journal */}
          <AccountingJournalTable
            creditorMode
            debtorName={vendorName}
            entries={journalEntries}
            totalDr={totalDr}
            totalCr={totalCr}
            disabled={disabled}
            onToggle={!disabled ? handleGstToggle : undefined}
            emptyText="Select a BRR to generate accounting entries"
          />

          {/* BRR Items + GST selection breakdown */}
          <PurchaseBillBreakdownTable
            orderNo={watch("orderNo")}
            brrNo={watchedBrrNo}
            brrDate={watchedBrrDate}
            items={watchedItems}
            gstLines={watchedGstLines}
            register={register}
            control={control}
            onGstToggle={!disabled ? handleGstToggle : undefined}
            disabled={disabled}
            itemsLoading={itemsLoading}
          />

          {/* Summary */}
          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
          />

          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton onClick={() => handleSubmit(onSave)()} loading={isSubmitting} disabled={isSubmitting} />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting..."
                confirmationTitle="Submit Purchase Bill?"
                requireConfirmation
              >
                Submit
              </SaveButton>
              {mode !== "create" && !isSubmitted && (
                <EditButton onClick={handleEdit} disabled={isSubmitting}>
                  {isEditing ? "Cancel" : "Edit"}
                </EditButton>
              )}
              {mode === "edit" && !isEditing && (
                <DeleteRequestButton moduleCode="PURCHASE_BILL" recordId={Number(billId)} onDeleted={() => router.back()} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* BRR Picker Modal */}
      <BrrPickerModal
        isOpen={brrPickerOpen}
        onClose={() => setBrrPickerOpen(false)}
        vendorId={selectedVendorId}
        projectCode={projectCode}
        currentBrrId={watch("brrId") || null}
        onConfirm={handleBrrPickerConfirm}
      />

      {/* AI Assistant Panel */}
      <AiPanel
        projectCode={projectCode}
        endpoint={API_ENDPOINTS.AI.SUGGEST_PURCHASE_BILL}
        method="POST"
        onApply={() => toast.info("AI suggestion ready — check the AI panel for vendor & item details.", { duration: 4000 })}
        applyLabel="Use this suggestion"
        title="Purchase Bill AI"
      />
    </div>
  );
}
