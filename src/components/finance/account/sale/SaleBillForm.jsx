"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Controller } from "react-hook-form";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen, FileStack } from "lucide-react";
import { useRouter } from "next/navigation";

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
} from "@/components/finance/account/common/SaleBillRightPanel";
import AccountSummary from "@/components/finance/account/common/AccountSummary";

import AccountingJournalTable from "@/components/finance/account/common/AccountingJournalTable";
import BillwiseBreakdownTable from "@/components/finance/account/sale/BillwiseBreakdownTable";
import CertifiedBillPickerModal from "@/components/finance/account/sale/CertifiedBillPickerModal";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import AiPanel             from "@/components/ai/AiPanel";
import { formatAmount }    from "@/helper/numberFormatter";

// ─── Constants ────────────────────────────────────────────────────────────────

const SALE_BILL_MODES = [
  { label: "Sale Invoice",   value: "Sale Invoice"   },
  { label: "Proforma Invoice", value: "Proforma Invoice" },
];

// ─── Schema ───────────────────────────────────────────────────────────────────

const sourceSchema = z.object({
  saleOrderId:     z.coerce.number().nullable().optional(),
  saleOrderNo:     z.string().optional().default(""),
  saleOrderErpNo:  z.string().optional().default(""),
  debtorName:      z.string().optional().default(""),
  certifiedBillId: z.coerce.number().nullable().optional(),
  certifiedBillNo: z.string().optional().default(""),
  billingNo:       z.string().optional().default(""),
  billingDate:     z.string().optional().default(""),
  basicAmount:     z.coerce.number().min(0).default(0),
});

const itemSchema = z.object({
  slNo:           z.number(),
  ccCode:         z.string(),
  ccName:         z.string(),
  description:    z.string().optional().default(""),
  hsnSac:         z.string().optional().default(""),
  basicAmount:    z.coerce.number().min(0).default(0),
  gstPercent:     z.coerce.number().min(0).default(0),
  billingItemId:  z.number().nullable().optional(),
  certBillId:     z.number().nullable().optional(),
  sourceIndex:    z.number().nullable().optional(),
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
  mode:             z.string().min(1, "Mode is required"),
  invoiceDate:      zodDate(z, "invoiceDate", true),
  referenceNo:      z.string().optional().default(""),
  referenceDate:    zodDate(z, "referenceDate"),
  billToAddress:    z.string().optional().default(""),
  shipToAddress:    z.string().optional().default(""),
  bankAcId:         z.coerce.number().nullable().optional(),
  paymentTermsDays: z.string().optional().default(""),
  declaration:      z.string().optional().default(""),
  discount:         z.coerce.number().min(0).default(0),
  roundOff:         z.coerce.number().default(0),
  sources:          z.array(sourceSchema).default([]),
  items:            z.array(itemSchema).default([]),
  gstLines:         z.array(gstLineSchema).length(3),
});

const DEFAULT_VALUES = {
  mode: "",
  invoiceDate: "",
  referenceNo: "",
  referenceDate: "",
  billToAddress: "",
  shipToAddress: "",
  bankAcId: null,
  paymentTermsDays: "",
  declaration: "",
  discount: 0,
  roundOff: 0,
  sources: [],
  items: [],
  gstLines: DEFAULT_GST_LINES,
};

const parsePaymentTerms = (val) =>
  val ? String(val).replace(/\s*[Dd]ays?\s*$/, "").trim() : "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaleBillForm({
  mode = "create",
  billId,
  onAfterSubmit,
  onUuid,
}) {
  const isViewMode = mode === "view" || mode === "approver";
  const router     = useRouter();
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allowSubmit, setAllowSubmit] = useState(mode === "edit");
  const [isLoading,   setIsLoading]   = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [erpBillNo,   setErpBillNo]   = useState("");

  // ── New state for certified bill selection workflow ──────────────────────────
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const [sources,            setSources]            = useState([]); // enriched source objects
  const [debtorName,         setDebtorName]         = useState("");
  const [breakdownSelections, setBreakdownSelections] = useState({});
  // Snapshots for cancel-edit restore
  const [initialSources,    setInitialSources]    = useState([]);
  const [initialDebtorName, setInitialDebtorName] = useState("");
  const [initialBreakdownSel, setInitialBreakdownSel] = useState({});

  const [bankOpts, setBankOpts] = useState([]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // ── Watched values for calculations ─────────────────────────────────────────
  const watchedItems    = watch("items")    || [];
  const watchedGstLines = watch("gstLines") || DEFAULT_GST_LINES;
  const watchedDiscount = Number(watch("discount") || 0);
  const watchedRoundOff = Number(watch("roundOff") || 0);

  const basicTotal   = useMemo(
    () => watchedItems.reduce((s, it) => s + Number(it.basicAmount || 0), 0),
    [watchedItems],
  );
  const gstTotal     = useMemo(
    () => watchedGstLines.filter((g) => g.isSelected).reduce((s, g) => s + Number(g.gstAmount || 0), 0),
    [watchedGstLines],
  );
  const totalInvoice = useMemo(
    () => basicTotal + gstTotal - watchedDiscount + watchedRoundOff,
    [basicTotal, gstTotal, watchedDiscount, watchedRoundOff],
  );

  // Effective GST % from gstLines (IGST rate = full rate; CGST/SGST = half each)
  const igstPercent = Number(watchedGstLines[0]?.percent) || 18;
  const cgstPercent = Number(watchedGstLines[1]?.percent) || 9;
  const sgstPercent = Number(watchedGstLines[2]?.percent) || 9;

  // ── Journal entries derived from selections ───────────────────────────────
  const journalEntries = useMemo(() => {
    if (sources.length === 0) return [];
    const entries = [];
    // SRCW CR entry — always show when bills are selected; dim if no SRCW rows checked
    entries.push({
      ccCode:     "SRCW",
      ccName:     "Construction of Civil Work",
      amount:     basicTotal,
      isSelected: basicTotal > 0,
    });
    // Always show all 3 GST lines so user can toggle each via "Select All" checkbox
    watchedGstLines.forEach((g) => {
      entries.push({
        ccCode:     g.ccCode,
        ccName:     g.ccName,
        amount:     Number(g.gstAmount) || 0,
        isSelected: !!g.isSelected,
      });
    });
    return entries;
  }, [sources.length, basicTotal, watchedGstLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCr = useMemo(
    () =>
      journalEntries
        .filter((e) => e.isSelected)
        .reduce((s, e) => s + e.amount, 0) - watchedDiscount + watchedRoundOff,
    [journalEntries, watchedDiscount, watchedRoundOff],
  );

  // ── Fetch Bank List ──────────────────────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.BANK_CASH.LIST, method: "GET" })
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        setBankOpts(all.filter((b) => b.type === "BANK"));
      })
      .catch(() => setBankOpts([]));
  }, []);

  // ── Sync breakdown selections → RHF items + gstLines ────────────────────────
  useEffect(() => {
    if (sources.length === 0) return;

    // Build items[] from selected SRCW rows
    const newItems = [];
    sources.forEach((s, si) => {
      const srcwKey = `${s.certifiedBillId}_SRCW`;
      const srcwSel = breakdownSelections[srcwKey];
      if (srcwSel?.checked) {
        newItems.push({
          slNo:          newItems.length + 1,
          ccCode:        "SRCW",
          // TODO: Connect SRCW CC code/name to CC master lookup (currently hardcoded)
          ccName:        "Construction of Civil Work",
          description:   srcwSel.description || "",
          hsnSac:        "",
          basicAmount:   Number(s.basicAmount) || 0,
          gstPercent:    0, // GST handled separately via gstLines
          billingItemId: null,
          certBillId:    s.certifiedBillId,
          sourceIndex:   si,
        });
      }
    });

    // Compute GST totals from selected per-bill GST rows
    let igstTotal = 0, cgstTotal = 0, sgstTotal = 0;
    sources.forEach((s) => {
      const basic = Number(s.basicAmount) || 0;
      if (breakdownSelections[`${s.certifiedBillId}_IGST`]?.checked) igstTotal += (basic * igstPercent) / 100;
      if (breakdownSelections[`${s.certifiedBillId}_CGST`]?.checked) cgstTotal += (basic * cgstPercent) / 100;
      if (breakdownSelections[`${s.certifiedBillId}_SGST`]?.checked) sgstTotal += (basic * sgstPercent) / 100;
    });

    const anyIgst = sources.some((s) => breakdownSelections[`${s.certifiedBillId}_IGST`]?.checked);
    const anyCgst = sources.some((s) => breakdownSelections[`${s.certifiedBillId}_CGST`]?.checked);
    const anySgst = sources.some((s) => breakdownSelections[`${s.certifiedBillId}_SGST`]?.checked);

    const currentGstLines = getValues("gstLines") || DEFAULT_GST_LINES;
    const newGstLines = [
      { ...currentGstLines[0], gstAmount: igstTotal, isSelected: anyIgst },
      { ...currentGstLines[1], gstAmount: cgstTotal, isSelected: anyCgst },
      { ...currentGstLines[2], gstAmount: sgstTotal, isSelected: anySgst },
    ];

    setValue("items",   newItems,    { shouldDirty: true });
    setValue("sources", sources.map((s) => ({
      saleOrderId:     s.saleOrderId     || null,
      saleOrderNo:     s.saleOrderNo     || "",
      saleOrderErpNo:  s.saleOrderErpNo  || "",
      certifiedBillId: s.certifiedBillId || null,
      certifiedBillNo: s.certifiedBillNo || "",
      billingNo:       s.billingNo       || s.certifiedBillNo || "",
      billingDate:     s.billingDate     || "",
      basicAmount:     Number(s.basicAmount) || 0,
    })), { shouldDirty: true });
    setValue("gstLines", newGstLines, { shouldDirty: true });

    // Auto-populate Reference No from bill numbers (always)
    // Reference Date: always set from first bill's date (editable for multi-bill cases)
    const refNo = sources.map((s) => s.billingNo || s.certifiedBillNo).filter(Boolean).join(", ");
    setValue("referenceNo", refNo, { shouldDirty: true });
    setValue("referenceDate", sources[0]?.billingDate || "", { shouldDirty: true });

  }, [sources, breakdownSelections]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Modal confirm ────────────────────────────────────────────────────────────
  const handleModalConfirm = useCallback((newSources) => {
    setSources(newSources);
    setDebtorName(newSources[0]?.debtorName || "");

    // Auto-generate initial selections: SRCW + IGST checked by default
    const initialSel = {};
    newSources.forEach((s) => {
      initialSel[`${s.certifiedBillId}_SRCW`] = { checked: true,  description: "" };
      initialSel[`${s.certifiedBillId}_IGST`] = { checked: true,  description: "" };
      initialSel[`${s.certifiedBillId}_CGST`] = { checked: false, description: "" };
      initialSel[`${s.certifiedBillId}_SGST`] = { checked: false, description: "" };
    });
    setBreakdownSelections(initialSel);
  }, []);

  // ── Breakdown selection change ───────────────────────────────────────────────
  const handleSelectionsChange = useCallback((newSel) => {
    setBreakdownSelections(newSel);
  }, []);

  // ── Bulk toggle from journal table ───────────────────────────────────────────
  const handleBulkToggle = useCallback((ccCode, checked) => {
    setBreakdownSelections((prev) => {
      const next = { ...prev };
      if (ccCode === "IGST") {
        if (checked) {
          sources.forEach((s) => {
            next[`${s.certifiedBillId}_IGST`] = { ...(next[`${s.certifiedBillId}_IGST`] || {}), checked: true };
            next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: false };
            next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: false };
          });
        } else {
          sources.forEach((s) => {
            next[`${s.certifiedBillId}_IGST`] = { ...(next[`${s.certifiedBillId}_IGST`] || {}), checked: false };
          });
        }
      } else if (ccCode === "CGST" || ccCode === "SGST") {
        if (checked) {
          sources.forEach((s) => {
            next[`${s.certifiedBillId}_IGST`] = { ...(next[`${s.certifiedBillId}_IGST`] || {}), checked: false };
            next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: true };
            next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: true };
          });
        } else {
          sources.forEach((s) => {
            next[`${s.certifiedBillId}_CGST`] = { ...(next[`${s.certifiedBillId}_CGST`] || {}), checked: false };
            next[`${s.certifiedBillId}_SGST`] = { ...(next[`${s.certifiedBillId}_SGST`] || {}), checked: false };
          });
        }
      } else {
        // SRCW or any other ccCode
        sources.forEach((s) => {
          next[`${s.certifiedBillId}_${ccCode}`] = { ...(next[`${s.certifiedBillId}_${ccCode}`] || {}), checked };
        });
      }
      return next;
    });
  }, [sources]);

  // ── Load Detail (edit / view) ────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !billId) return;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.FINANCE.SALE_BILL.GET_BY_ID}${billId}`,
          method: "GET",
        });
        const d = res.data;

        // Build sources from API response
        let sourcesData = [];
        if (Array.isArray(d.sources) && d.sources.length > 0) {
          sourcesData = d.sources.map((s) => ({
            saleOrderId:     s.saleOrderId     || null,
            saleOrderNo:     s.saleOrderNo     || "",
            saleOrderErpNo:  s.saleOrderErpNo  || "",
            debtorName:      s.debtorName      || "",
            certifiedBillId: s.certifiedBillId || null,
            certifiedBillNo: s.certifiedBillNo || "",
            billingNo:       s.billingNo       || s.certifiedBillNo || "",
            billingDate:     s.billingDate     || "",
            basicAmount:     Number(s.basicAmount || 0),
          }));
        } else {
          // Legacy single-source bill
          sourcesData = [{
            saleOrderId:     d.saleOrderId     || null,
            saleOrderNo:     d.saleOrderNo     || "",
            saleOrderErpNo:  "",
            debtorName:      "",
            certifiedBillId: d.certifiedBillId || null,
            certifiedBillNo: d.certifiedBillNo || "",
            billingNo:       d.certifiedBillNo || "",
            billingDate:     "",
            basicAmount:     0,
          }];
        }

        const loadedItems    = (d.items    || []).map((it, i) => ({
          slNo:          it.slNo || i + 1,
          ccCode:        it.ccCode || "",
          ccName:        it.ccName || "",
          description:   it.description || "",
          hsnSac:        it.hsnSac || "",
          basicAmount:   Number(it.basicAmount || 0),
          gstPercent:    Number(it.gstPercent  || 0),
          billingItemId: it.billingItemId || null,
          certBillId:    it.certBillId    || null,
          sourceIndex:   it.sourceIndex   ?? null,
        }));
        const loadedGstLines = d.gstLines?.length
          ? mapApiGstLines(d.gstLines, { keepSelection: true })
          : DEFAULT_GST_LINES;

        const formatted = {
          mode:             d.mode || "",
          invoiceDate:      d.invoiceDate || "",
          referenceDate:    d.referenceDate || "",
          billToAddress:    d.billToAddress || "",
          shipToAddress:    d.shipToAddress || "",
          bankAcId:         d.bankAcId || null,
          paymentTermsDays: parsePaymentTerms(d.paymentTerms),
          declaration:      d.declaration || "",
          discount:         d.discount ?? 0,
          roundOff:         d.roundOff ?? 0,
          sources: sourcesData.map((s) => ({
            saleOrderId:     s.saleOrderId,
            saleOrderNo:     s.saleOrderNo,
            saleOrderErpNo:  s.saleOrderErpNo,
            certifiedBillId: s.certifiedBillId,
            certifiedBillNo: s.certifiedBillNo,
            billingNo:       s.billingNo,
            billingDate:     s.billingDate,
            basicAmount:     s.basicAmount,
          })),
          items:    loadedItems,
          gstLines: loadedGstLines,
        };

        reset(formatted);
        setInitialData(formatted);

        // Restore local sources state
        setSources(sourcesData);

        // Attempt to restore debtor name from first source's sale order
        if (sourcesData[0]?.saleOrderId) {
          apiRequest({
            url: `${API_ENDPOINTS.PROJECT.OG_SALE_ORDER.GET_BY_ID}${sourcesData[0].saleOrderId}`,
            method: "GET",
          })
            .then((soRes) => {
              const name = soRes.data?.debtorName || soRes.data?.debtor?.ledgerName || "";
              setDebtorName(name);
              setInitialDebtorName(name);
            })
            .catch(() => {});
        }

        // Restore breakdown selections from loaded items and gstLines
        const sel = {};
        const igstSelected = loadedGstLines[0]?.isSelected ?? false;
        const cgstSelected = loadedGstLines[1]?.isSelected ?? false;
        const sgstSelected = loadedGstLines[2]?.isSelected ?? false;

        sourcesData.forEach((s, si) => {
          // SRCW: find item with sourceIndex matching this source (new-style) or ccCode=SRCW
          const srcwItem = loadedItems.find(
            (it) => (it.sourceIndex === si || it.certBillId === s.certifiedBillId) && it.ccCode === "SRCW",
          );
          sel[`${s.certifiedBillId}_SRCW`] = {
            checked:     !!srcwItem,
            description: srcwItem?.description || "",
          };
          // GST: restore selection based on global gstLines (best effort)
          sel[`${s.certifiedBillId}_IGST`] = { checked: igstSelected, description: loadedGstLines[0]?.description || "" };
          sel[`${s.certifiedBillId}_CGST`] = { checked: cgstSelected, description: loadedGstLines[1]?.description || "" };
          sel[`${s.certifiedBillId}_SGST`] = { checked: sgstSelected, description: loadedGstLines[2]?.description || "" };
        });
        setBreakdownSelections(sel);
        setInitialBreakdownSel(sel);
        setInitialSources(sourcesData);

        if (d.saleBillNo && d.saleBillNo !== "auto") setErpBillNo(d.saleBillNo);
        if (d.saleBillUuid && onUuid) onUuid(d.saleBillUuid);

        const editable = ["draft", "reback"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Sale Bill already Approved");
          else if (st === "Rejected") toast.info("Sale Bill already Rejected");
          else                        toast.info("Sale Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err.message || "Failed to load Sale Bill");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [billId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit / Cancel ────────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (isEditing) {
      if (initialData) reset(initialData);
      setSources(initialSources);
      setDebtorName(initialDebtorName);
      setBreakdownSelections(initialBreakdownSel);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  // ── Build payload ─────────────────────────────────────────────────────────────
  const buildPayload = () => {
    const v         = getValues();
    const gstLines  = v.gstLines || DEFAULT_GST_LINES;
    const items     = v.items    || [];
    const basicTotalVal = items.reduce((s, it) => s + Number(it.basicAmount || 0), 0);

    // gstLines amounts are already correctly computed by the breakdown useEffect
    const computedGst = gstLines.map((l) => ({ ...l }));

    return {
      projectCode,
      mode:             v.mode,
      invoiceDate:      v.invoiceDate || "",
      referenceDate:    v.referenceDate || "",
      billToAddress:    v.billToAddress || "",
      shipToAddress:    v.shipToAddress || "",
      bankAcId:         v.bankAcId ? Number(v.bankAcId) : null,
      paymentTerms:     v.paymentTermsDays ? `${v.paymentTermsDays} Days` : "",
      declaration:      v.declaration || "",
      discount:         Number(v.discount || 0),
      roundOff:         Number(v.roundOff || 0),
      sources: sources.map((s) => ({
        saleOrderId:     s.saleOrderId     || null,
        saleOrderNo:     s.saleOrderNo     || "",
        certifiedBillId: s.certifiedBillId ? Number(s.certifiedBillId) : null,
        certifiedBillNo: s.certifiedBillNo || "",
        basicAmount:     Number(s.basicAmount || 0),
      })),
      items: items.map((it, i) => ({
        slNo:          it.slNo || i + 1,
        ccCode:        it.ccCode      || "CRIN",
        ccName:        it.ccName      || "",
        description:   it.description || "",
        hsnSac:        it.hsnSac      || "",
        basicAmount:   Number(it.basicAmount  || 0),
        gstPercent:    Number(it.gstPercent   || 0),
        billingItemId: it.billingItemId || null,
        sourceIndex:   it.sourceIndex  ?? null,
      })),
      gstLines: computedGst.map((l) => ({
        gstType:     l.gstType,
        ccCode:      l.ccCode,
        ccName:      l.ccName,
        description: l.description || "",
        percent:     l.percent,
        gstAmount:   l.gstAmount,
        isSelected:  l.isSelected,
      })),
    };
  };

  // ── Save Draft / Update ──────────────────────────────────────────────────────
  const onSave = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    if (sources.length === 0) { toast.error("Please select at least one Certified Bill"); return; }
    let tid;
    try {
      tid = toast.loading(mode === "create" ? "Creating…" : "Saving…");
      const res = await apiRequest({
        url: mode === "create"
          ? API_ENDPOINTS.FINANCE.SALE_BILL.CREATE
          : `${API_ENDPOINTS.FINANCE.SALE_BILL.EDIT}${billId}`,
        method: mode === "create" ? "POST" : "PUT",
        data: buildPayload(),
      });
      setInitialData(getValues());
      setInitialSources([...sources]);
      setInitialDebtorName(debtorName);
      setInitialBreakdownSel({ ...breakdownSelections });
      setIsEditing(false);
      setAllowSubmit(true);
      toast.success(mode === "create" ? "Sale Bill created" : "Sale Bill updated", { id: tid });
      if (mode === "create") {
        const newId = res.data?.id;
        if (newId) setTimeout(() => router.push(`/finance-management/account/sale/${newId}`), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: tid });
    }
  };

  // ── Submit for Approval ──────────────────────────────────────────────────────
  const onSubmitForApproval = async () => {
    if (!billId) { toast.error("Please save first"); return; }
    let tid;
    try {
      tid = toast.loading("Submitting for approval…");
      await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_BILL.SUBMIT}${billId}`,
        method: "POST",
      });
      toast.success("Sale Bill submitted for approval", { id: tid });
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit", { id: tid });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  // ── Current sale order info (from first source) ──────────────────────────────
  const currentSaleOrderLabel = sources.length > 0
    ? `${sources.length} bill${sources.length !== 1 ? "s" : ""} from ${sources[0]?.saleOrderErpNo || sources[0]?.saleOrderNo || "—"}`
    : null;

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

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <div className={`w-full lg:w-[380px] lg:shrink-0 space-y-2 ${!sidebarOpen ? "lg:hidden" : ""}`}>

          {/* Mode */}
          <PMSection title="Mode:">
            <PMFormRow label="Mode" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={SALE_BILL_MODES}
                  value={watch("mode") || ""}
                  disabled={disabled}
                  onChange={(v) => setValue("mode", v, { shouldDirty: true })}
                  placeholder="Sale Invoice / Proforma Invoice"
                  labelKey="label"
                  valueKey="value"
                  searchKeys={["label"]}
                />
              </div>
            </PMFormRow>
          </PMSection>

          {/* Invoice Details */}
          <PMSection title="Invoice Details:">
            <PMFormRow label="Invoice Number" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMInput value={erpBillNo || "[Auto]"} disabled readOnly />
            </PMFormRow>
            <PMFormRow label="Invoice Date" required={!disabled} labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <PMDateInput
                {...register("invoiceDate")}
                disabled={disabled}
                hasError={errors.invoiceDate}
                className="max-w-[200px]"
              />
            </PMFormRow>
            <PMFormRow label="Reference No." labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="referenceNo"
                control={control}
                render={({ field }) => (
                  <PMInput
                    {...field}
                    disabled={true}
                    placeholder="Auto-filled from certified bills"
                    fieldLabel="Reference No."
                  />
                )}
              />
            </PMFormRow>
            <PMFormRow label="Reference Date" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="referenceDate"
                control={control}
                render={({ field }) => (
                  <PMDateInput
                    {...field}
                    disabled={disabled}
                    hasError={errors.referenceDate}
                    className="max-w-[200px]"
                  />
                )}
              />
            </PMFormRow>
          </PMSection>

          {/* Addresses */}
          <PMSection title="Addresses:">
            <PMFormRow label="Bill To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="billToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Client address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>
            <PMFormRow label="Ship To Address" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="shipToAddress"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Site address"
                    rows={2}
                    maxRows={5}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>

          {/* Bank & Payment */}
          <PMSection title="Bank & Payment:">
            <PMFormRow label="Bank A/c" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex-1">
                <SearchableSelect
                  options={bankOpts}
                  value={watch("bankAcId") || ""}
                  disabled={disabled}
                  onChange={(v) => setValue("bankAcId", v ? Number(v) : null, { shouldDirty: true })}
                  placeholder="Select Bank"
                  labelKey={["bankName", "bankAcNumber"]}
                  labelSeparator=" — "
                  valueKey="id"
                  searchKeys={["bankName", "bankCode", "bankAcNumber", "branchName"]}
                />
              </div>
            </PMFormRow>
            <PMFormRow label="Payment Terms" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <div className="flex items-center gap-1.5 max-w-[180px]">
                <Controller
                  name="paymentTermsDays"
                  control={control}
                  render={({ field }) => (
                    <PMInput
                      {...field}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={disabled}
                      placeholder="e.g. 30"
                      fieldLabel="Payment Terms (Days)"
                    />
                  )}
                />
                <span className="text-[13px] text-[#444] shrink-0">Days</span>
              </div>
            </PMFormRow>
            <PMFormRow label="Declaration" labelWidth="sm:w-[150px] sm:min-w-[150px]">
              <Controller
                name="declaration"
                control={control}
                render={({ field }) => (
                  <PMTextarea
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    placeholder="Declaration text"
                    rows={3}
                    maxRows={8}
                  />
                )}
              />
            </PMFormRow>
          </PMSection>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Certified Bill Selection Button */}
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1c3a5e] hover:bg-[#163050] text-white text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileStack className="h-4 w-4" />
              Select Certified Bills
            </button>
            {currentSaleOrderLabel && (
              <span className="text-[12px] text-gray-500 italic">
                {currentSaleOrderLabel}
                {debtorName ? ` — ${debtorName}` : ""}
              </span>
            )}
            {!currentSaleOrderLabel && (
              <span className="text-[12px] text-red-400 italic">
                No bills selected — please select certified bills to proceed
              </span>
            )}
          </div>

          {/* Accounting Journal Table */}
          <AccountingJournalTable
            debtorName={debtorName || "—"}
            entries={journalEntries}
            totalDr={totalInvoice}
            totalCr={totalCr}
            disabled={disabled}
            sources={sources}
            selections={breakdownSelections}
            onBulkToggle={!disabled ? handleBulkToggle : undefined}
          />

          {/* Bill-wise Breakdown Table */}
          <BillwiseBreakdownTable
            sources={sources}
            gstPercent={igstPercent}
            selections={breakdownSelections}
            onSelectionsChange={handleSelectionsChange}
            disabled={disabled}
          />

          {/* Invoice Summary */}
          <AccountSummary
            basicTotal={basicTotal}
            gstTotal={gstTotal}
            totalInvoice={totalInvoice}
            register={register}
            watch={watch}
            disabled={disabled}
          />

          {/* Action Buttons */}
          {!isViewMode && (
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isEditing && (
                <SaveDraftButton
                  onClick={() => handleSubmit(onSave)()}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              )}
              <SaveButton
                onClick={onSubmitForApproval}
                loading={isSubmitting}
                disabled={!allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"}
                loadingText="Submitting..."
                confirmationTitle="Submit Sale Bill?"
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
                <DeleteRequestButton
                  moduleCode="SALE_BILL"
                  recordId={Number(billId)}
                  onDeleted={() => router.back()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Certified Bill Picker Modal */}
      <CertifiedBillPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectCode={projectCode}
        currentSources={sources}
        onConfirm={handleModalConfirm}
        saleBillId={billId || null}
      />

      {/* AI Assistant Panel */}
      <AiPanel
        projectCode={projectCode}
        endpoint={API_ENDPOINTS.AI.SUGGEST_SALE_BILL}
        method="POST"
        onApply={() => {}}
        applyLabel="Use this suggestion"
        title="Sale Bill AI"
      />
    </div>
  );
}
