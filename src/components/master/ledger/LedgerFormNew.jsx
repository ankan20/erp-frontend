"use client";

import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, Loader2, Search, X } from "lucide-react";

import SaveButton from "@/components/common/SaveButton";
import PhoneInput from "@/components/common/PhoneInput";
import EditButton from "@/components/common/EditButton";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/common/SearchableSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getInputClass } from "@/lib/formStyles";
import { getStateCodeByName, INDIAN_STATES } from "@/config/indianStates.config";
import NatureOfServiceSelect, { TYPE_LABEL, TYPE_BADGE_COLOR } from "@/components/contact-dairy/NatureOfServiceSelect";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TYPES = [
  { value: "Materials",       label: "Materials" },
  { value: "Work_Force",      label: "Work Force" },
  { value: "Plant_Machinery", label: "Plant & Machinery" },
  { value: "Others",          label: "Others" },
];


// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z.object({
  ledgerName:            z.string().min(1, "Required"),
  registeredAddress:     z.string().optional(),
  corporateAddress:      z.string().optional(),
  pan:                   z.string().refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v), "Invalid PAN (e.g. ABCDE1234F)").optional(),
  gstin:                 z.string().optional(),
  stateCode:             z.string().optional(),
  stateName:             z.string().optional(),
  primaryContactPerson:  z.string().optional(),
  primaryContactNumber:  z.string().optional(),
  designation:           z.string().optional(),
  whatsappNumber:        z.string().optional(),
  email:                 z.string().optional(),
  bankAccountNumber:     z.string().optional(),
  bankName:              z.string().optional(),
  branchName:            z.string().optional(),
  ifscCode:              z.string().optional(),
});

// ─── Supplier name suggestion hook ───────────────────────────────────────────

function useSuggestionFetch({ query, minLen = 2, delay = 600, onResult, onLoading }) {
  const timerRef    = useRef(null);
  const lastFetched = useRef("");
  const cancelRef   = useRef(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < minLen) {
      clearTimeout(timerRef.current);
      lastFetched.current = "";
      onResult([]);
      return;
    }
    if (trimmed === lastFetched.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const q = query.trim();
      if (!q || q.length < minLen || q === lastFetched.current) return;
      lastFetched.current = q;
      cancelRef.current = false;
      onLoading(true);
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.SUPPLIER.LIST,
          method: "GET",
          params: { search: q },
        });
        if (cancelRef.current) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        onResult(list.slice(0, 6));
      } catch {
        if (!cancelRef.current) onResult([]);
      } finally {
        if (!cancelRef.current) onLoading(false);
      }
    }, delay);
    return () => { clearTimeout(timerRef.current); cancelRef.current = true; };
  }, [query]); // eslint-disable-line
}

// ─── Suggestion item ──────────────────────────────────────────────────────────

function SuggestionItem({ supplier, onClick }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-colors group"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-gray-800 group-hover:text-blue-700 truncate">
            {supplier.supplierName}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0 font-mono">{supplier.supplierCode}</span>
        </div>
        <div className="flex flex-wrap gap-1 md:shrink-0">
          {(supplier.supplierTypes || []).map((t) => (
            <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${TYPE_BADGE_COLOR[t] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {TYPE_LABEL[t] || t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Label helper ─────────────────────────────────────────────────────────────

const labelCls = "w-full md:w-[220px] md:shrink-0 px-3 py-1 bg-[#d6e6f2] border border-[#6f7f8f] text-[13px] rounded-sm";

function Row({ label, children, alignStart }) {
  return (
    <div className={`flex flex-col md:flex-row ${alignStart ? "md:items-start" : "md:items-center"} gap-1 md:gap-2`}>
      <div className={labelCls}>{label}</div>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-[13px] font-bold text-gray-800 border-b border-[#b8c7da] pb-0.5 mb-1">{title}:</div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * mode: "create" | "edit" | "view"
 * ledgerId: string (edit/view)
 * initialData: object
 * categories: [{ value, label }]
 * disabled: boolean (view-only)
 */
export default function LedgerFormNew({
  mode = "create",
  disabled: disabledProp = false,
  ledgerId,
  initialData,
  categories = [],
}) {
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [pageLoading, setPageLoading] = useState(mode !== "create");

  // ── Supplier selection state ───────────────────────────────────────────────
  const [supplierList, setSupplierList]       = useState([]);
  const [supplierListLoading, setSupplierListLoading] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId]   = useState("");
  const [linkedSupplierId, setLinkedSupplierId]       = useState(null);
  const [pendingSupplierSelect, setPendingSupplierSelect] = useState(null);

  // ── Supplier type badges ───────────────────────────────────────────────────
  const [supplierTypes, setSupplierTypes]     = useState([]);
  const [natureOfService, setNatureOfService] = useState([]);

  // ── Name suggestion state ─────────────────────────────────────────────────
  const [nameQuery, setNameQuery]             = useState("");
  const [suggestions, setSuggestions]         = useState([]);
  const [suggestLoading, setSuggestLoading]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const suggestionWrapperRef = useRef(null);
  const suppressSuggestRef = useRef(false);

  // ── Ledger code ───────────────────────────────────────────────────────────
  const [ledgerCode, setLedgerCode] = useState("");


  // ── Files ─────────────────────────────────────────────────────────────────
  const [fileNames, setFileNames] = useState({});
  const [fileUrls,  setFileUrls]  = useState({});
  const [files,     setFiles]     = useState({});
  const tradeRef = useRef(null);
  const panRef   = useRef(null);
  const gstnRef  = useRef(null);
  const bankRef  = useRef(null);

  // ── RHF ───────────────────────────────────────────────────────────────────
  const { register, handleSubmit, reset, setValue, getValues, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ledgerName: "", registeredAddress: "", corporateAddress: "",
      pan: "", gstin: "", stateCode: "", stateName: "",
      primaryContactPerson: "", primaryContactNumber: "", designation: "", whatsappNumber: "", email: "",
      bankAccountNumber: "", bankName: "", branchName: "", ifscCode: "",
    },
  });

  const fieldDisabled = disabledProp || !isEditing || isSubmitting;

  // ── Load supplier list (no params) ────────────────────────────────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.SUPPLIER.LIST, method: "GET" })
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setSupplierList(list.map((s) => ({
          value: String(s.supplierId),
          label: `${s.supplierCode} — ${s.supplierName}`,
          supplierCode: s.supplierCode,
          supplierName: s.supplierName,
          ...s,
        })));
      })
      .catch(() => {})
      .finally(() => setSupplierListLoading(false));
  }, []);


  // ── Populate from initialData ─────────────────────────────────────────────
  useEffect(() => {
    if (mode === "create" || !initialData || categories.length === 0) return;
    reset({
      ledgerName:           initialData.ledgerName           || "",
      registeredAddress:    initialData.registeredAddress    || "",
      corporateAddress:     initialData.corporateAddress     || "",
      pan:                  initialData.pan                  || "",
      gstin:                initialData.gstin                || "",
      stateCode:            initialData.stateCode            || "",
      stateName:            initialData.stateName            || "",
      primaryContactPerson: initialData.primaryContactPerson || "",
      primaryContactNumber: initialData.primaryContactNumber || "",
      designation:          initialData.designation          || "",
      whatsappNumber:       initialData.whatsappNumber       || "",
      email:                initialData.email                || "",
      bankAccountNumber:    initialData.bankAccountNumber    || "",
      bankName:             initialData.bankName             || "",
      branchName:           initialData.branchName           || "",
      ifscCode:             initialData.ifscCode             || "",
    });
    startTransition(() => {
      setLedgerCode(initialData.ledgerCode || "");
      setNameQuery(initialData.ledgerName || "");
      setSupplierTypes(Array.isArray(initialData.supplierTypes) ? initialData.supplierTypes : []);
      setNatureOfService(Array.isArray(initialData.natureOfService) ? initialData.natureOfService : initialData.natureOfService ? [initialData.natureOfService] : []);
      setLinkedSupplierId(initialData.supplierId ? String(initialData.supplierId) : null);
      setSelectedSupplierId(initialData.supplierId ? String(initialData.supplierId) : "");
      setFileUrls({
        trade: initialData.tradeLicenceFile,
        pan:   initialData.panFile,
        gstn:  initialData.gstnFile,
        bank:  initialData.bankDetailsFile,
      });
      setPageLoading(false);
    });
  }, [initialData, categories]);

  // ── Outside-click close for suggestion dropdown ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (suggestionWrapperRef.current && !suggestionWrapperRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Name suggestion hook ───────────────────────────────────────────────────
  useSuggestionFetch({
    query: nameQuery,
    onResult: (list) => {
      if (suppressSuggestRef.current) { suppressSuggestRef.current = false; return; }
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    },
    onLoading: setSuggestLoading,
  });

  // ── Populate from selected supplier ───────────────────────────────────────
  const populateFromSupplier = useCallback((s) => {
    reset((prev) => ({
      ...prev,
      ledgerName:           s.supplierName           || prev.ledgerName,
      registeredAddress:    s.registeredAddress      || prev.registeredAddress,
      corporateAddress:     s.corporateAddress       || prev.corporateAddress,
      primaryContactPerson: s.contactPerson          || prev.primaryContactPerson,
      primaryContactNumber: s.mobileNumber           || prev.primaryContactNumber,
      designation:          s.designation            || prev.designation,
      whatsappNumber:       s.whatsappNumber         || prev.whatsappNumber,
      email:                s.email                  || prev.email,
    }));
    setNameQuery(s.supplierName || "");
    setSupplierTypes(Array.isArray(s.supplierTypes) ? s.supplierTypes : []);
    setNatureOfService(Array.isArray(s.natureOfService) ? s.natureOfService : s.natureOfService ? [s.natureOfService] : []);
    setLinkedSupplierId(String(s.supplierId));
    setSelectedSupplierId(String(s.supplierId));
    setShowSuggestions(false);
    setSuggestions([]);
    setPendingSuggestion(null);
    setPendingSupplierSelect(null);
    suppressSuggestRef.current = true;
  }, [reset]);

  // ── Type toggle ────────────────────────────────────────────────────────────
  const toggleType = (val) => {
    setSupplierTypes((prev) => prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]);
  };

  // ── File helpers ───────────────────────────────────────────────────────────
  const handleFileChange = (key, file) => {
    if (!file) { setFileNames((p) => ({ ...p, [key]: "" })); setFiles((p) => ({ ...p, [key]: null })); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB allowed"); return; }
    setFiles((p) => ({ ...p, [key]: file }));
    setFileNames((p) => ({ ...p, [key]: `${file.name} (${(file.size / 1024).toFixed(1)} KB)` }));
  };

  const openFilePicker = (key, ref) => {
    ref.current?.click();
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      setTimeout(() => {
        if (!ref.current?.files?.[0]) {
          setFiles((p) => ({ ...p, [key]: null }));
          setFileNames((p) => ({ ...p, [key]: "" }));
          if (ref.current) ref.current.value = "";
        }
      }, 200);
    };
    window.addEventListener("focus", onFocus);
  };

  const renderFile = (key, ref, labelText) => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="px-3 py-1 bg-[#8e7cc3] text-white min-w-[120px] rounded-sm text-[13px]">{labelText}</div>
      {isEditing && (
        <button type="button" onClick={() => openFilePicker(key, ref)} className="bg-[#f6c85f] px-3 py-1 rounded-sm cursor-pointer text-[13px]" disabled={isSubmitting}>@</button>
      )}
      {fileNames[key] ? (
        <span className="text-[11px] text-gray-600 italic">{fileNames[key]}</span>
      ) : fileUrls[key] ? (
        <button type="button" onClick={() => window.open(fileUrls[key])} className="text-blue-500 underline text-[11px]">Download</button>
      ) : null}
      <input type="file" hidden ref={ref} onChange={(e) => handleFileChange(key, e.target.files[0])} />
    </div>
  );

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!initialData) return;
    reset({ ...initialData });
    setNameQuery(initialData.ledgerName || "");
    setSupplierTypes(Array.isArray(initialData.supplierTypes) ? initialData.supplierTypes : []);
    setNatureOfService(Array.isArray(initialData.natureOfService) ? initialData.natureOfService : initialData.natureOfService ? [initialData.natureOfService] : []);
    setFileUrls({ trade: initialData.tradeLicenceFile, pan: initialData.panFile, gstn: initialData.gstnFile, bank: initialData.bankDetailsFile });
    setFiles({}); setFileNames({});
    if (tradeRef.current) tradeRef.current.value = "";
    if (panRef.current)   panRef.current.value   = "";
    if (gstnRef.current)  gstnRef.current.value  = "";
    if (bankRef.current)  bankRef.current.value  = "";
    setIsEditing(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data) => {
    if (mode === "create" && (!files.trade || !files.pan || !files.gstn || !files.bank)) {
      toast.error("All files are required");
      return;
    }
    let toastId;
    try {
      toastId = toast.loading("Saving...");
      const normalizePhone = (v) => {
        const digits = (v || "").replace(/\D/g, "").slice(-10);
        return digits.length === 10 ? `+91${digits}` : "";
      };
      const formData = new FormData();
      const allowed = ["ledgerName","registeredAddress","corporateAddress","pan","gstin","stateCode","stateName","primaryContactPerson","designation","email","bankAccountNumber","bankName","branchName","ifscCode"];
      allowed.forEach((k) => formData.append(k, data[k] ?? ""));
      formData.append("primaryContactNumber", normalizePhone(data.primaryContactNumber));
      formData.append("whatsappNumber", normalizePhone(data.whatsappNumber));

      // Supplier-linked fields
      if (linkedSupplierId) formData.append("supplierId", linkedSupplierId);
      supplierTypes.forEach((t) => formData.append("supplierTypes[]", t));
      natureOfService.forEach((n) => formData.append("natureOfService[]", n));

      if (files.trade) formData.append("tradeLicenceFile", files.trade);
      if (files.pan)   formData.append("panFile",          files.pan);
      if (files.gstn)  formData.append("gstnFile",         files.gstn);
      if (files.bank)  formData.append("bankDetailsFile",  files.bank);

      let res;
      if (mode === "create") {
        res = await apiRequest({ url: API_ENDPOINTS.MASTER.CREATE_LEDGER, method: "POST", data: formData });
      } else {
        res = await apiRequest({ url: `${API_ENDPOINTS.MASTER.UPDATE_LEDGER_BY_ID}/${ledgerId}`, method: "PUT", data: formData });
      }

      const d = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (d?.ledgerCode) setLedgerCode(d.ledgerCode);
      setFileUrls({ trade: d?.tradeLicenceFile, pan: d?.panFile, gstn: d?.gstnFile, bank: d?.bankDetailsFile });
      setFiles({}); setFileNames({});
      setIsEditing(false);
      toast.success(mode === "create" ? "Created" : "Updated", { id: toastId });
    } catch (err) {
      toast.error(err?.message || "Failed", { id: toastId });
    }
  };

  if (pageLoading) {
    return <div className="flex justify-center items-center h-[300px]"><Loader2 className="animate-spin w-6 h-6" /></div>;
  }

  return (
    <>
      {/* ── Supplier select confirmation ────────────────────────────── */}
      <AlertDialog open={!!pendingSupplierSelect} onOpenChange={(o) => !o && setPendingSupplierSelect(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Link Supplier</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              Link <strong>{pendingSupplierSelect?.supplierName}</strong> ({pendingSupplierSelect?.supplierCode}) to this ledger?
              Their details will be pre-filled below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px] h-8" onClick={() => { setPendingSupplierSelect(null); setSelectedSupplierId(""); }}>
              No, skip
            </AlertDialogCancel>
            <AlertDialogAction className="text-[12px] h-8 bg-blue-600 hover:bg-blue-700" onClick={() => populateFromSupplier(pendingSupplierSelect)}>
              Yes, link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Name suggestion confirmation ────────────────────────────── */}
      <AlertDialog open={!!pendingSuggestion} onOpenChange={(o) => !o && setPendingSuggestion(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Existing Supplier Found</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              <strong>{pendingSuggestion?.supplierName}</strong> ({pendingSuggestion?.supplierCode}) exists as a supplier. Link and pre-fill their details?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px] h-8" onClick={() => { setPendingSuggestion(null); setShowSuggestions(false); }}>
              No, keep typing
            </AlertDialogCancel>
            <AlertDialogAction className="text-[12px] h-8 bg-blue-600 hover:bg-blue-700" onClick={() => populateFromSupplier(pendingSuggestion)}>
              Yes, link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="px-6 pt-2 pb-4 w-full">

        {/* ── Supplier selection ──────────────────────────────────────── */}
        <Section title="Link Supplier">
          <Row label="Supplier">
            <div className="flex-1">
              <SearchableSelect
                options={supplierList}
                value={selectedSupplierId}
                onChange={(val, item) => {
                  if (!isEditing) return;
                  setSelectedSupplierId(val);
                  setPendingSupplierSelect(item);
                }}
                placeholder={supplierListLoading ? "Loading..." : "Search by ID or Name"}
                searchPlaceholder="Search supplier..."
                searchKeys={["supplierCode", "supplierName", "label"]}
                disabled={fieldDisabled || supplierListLoading}
                labelKey="label"
                valueKey="value"
              />
            </div>
          </Row>
        </Section>

        {/* ── Ledger Code ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <div className={labelCls}>Ledger Code</div>
          <Input value={ledgerCode} disabled placeholder="[Auto]" className={`${getInputClass(false, true)} w-40 font-mono`} />
        </div>

        {/* ── Supplier Types (badges) ──────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-3 px-1">
          {ALL_TYPES.map((t) => {
            const checked = supplierTypes.includes(t.value);
            return (
              <label key={t.value} className={`flex items-center gap-1.5 select-none ${fieldDisabled ? "cursor-default" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={fieldDisabled}
                  onChange={() => toggleType(t.value)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-opacity ${TYPE_BADGE_COLOR[t.value] || "bg-gray-100 text-gray-600 border-gray-200"} ${!checked ? "opacity-40" : ""}`}>
                  {TYPE_LABEL[t.value] || t.label}
                </span>
              </label>
            );
          })}
        </div>

        {/* ── Nature of Service (one select per type) ──────────────────── */}
        {supplierTypes.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {supplierTypes.map((t) => (
              <div key={t} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                <div className={`${labelCls} shrink-0`}>
                  <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${TYPE_BADGE_COLOR[t] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {TYPE_LABEL[t] || t}
                  </span>
                </div>
                <div className="flex-1">
                  <NatureOfServiceSelect
                    selectedTypes={[t]}
                    value={natureOfService}
                    onChange={setNatureOfService}
                    disabled={fieldDisabled}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Supplier Details ─────────────────────────────────────────── */}
        <Section title="Supplier Details">
          {/* Ledger Name with suggestion */}
          <div className="relative" ref={suggestionWrapperRef}>
            <Row label="Ledger Name">
              <div className="relative flex-1">
                <Input
                  {...register("ledgerName")}
                  value={nameQuery}
                  onChange={(e) => {
                    setNameQuery(e.target.value);
                    setValue("ledgerName", e.target.value, { shouldValidate: true });
                    if (!e.target.value.trim()) { setSuggestions([]); setShowSuggestions(false); }
                    // clear linked supplier if name manually changed
                    if (linkedSupplierId) { setLinkedSupplierId(null); setSelectedSupplierId(""); }
                  }}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  disabled={fieldDisabled}
                  placeholder="Ledger / Concern name"
                  className={`${getInputClass(!!errors.ledgerName, fieldDisabled)} pr-8`}
                />
                {suggestLoading && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
              </div>
            </Row>

            {showSuggestions && suggestions.length > 0 && !fieldDisabled && (
              <div className="absolute left-0 md:left-[calc(220px+8px)] right-0 z-[9999] bg-white border border-blue-200 rounded-sm shadow-2xl mt-0.5">
                <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-100">
                  <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                    <Search size={10} /> Existing suppliers found
                  </span>
                  <button type="button" onClick={() => { setShowSuggestions(false); setSuggestions([]); }} className="text-gray-400 hover:text-gray-700">
                    <X size={12} />
                  </button>
                </div>
                {suggestions.map((s) => (
                  <SuggestionItem key={s.supplierId} supplier={s} onClick={() => { setShowSuggestions(false); setPendingSuggestion(s); }} />
                ))}
              </div>
            )}
          </div>

          <Row label="Registered Address">
            <Input {...register("registeredAddress")} disabled={fieldDisabled} placeholder="Registered address" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
          </Row>
          <Row label="Corporate Address">
            <Input {...register("corporateAddress")} disabled={fieldDisabled} placeholder="Corporate / head office address" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
          </Row>
        </Section>

        {/* ── Contact Details ──────────────────────────────────────────── */}
        <Section title="Contact Details">
          <Row label="Contact Person">
            <Input {...register("primaryContactPerson")} disabled={fieldDisabled} placeholder="Contact person name" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
          </Row>
          <Row label="Contact Number">
            <Controller
              name="primaryContactNumber"
              control={control}
              render={({ field }) => (
                <PhoneInput {...field} disabled={fieldDisabled} outputFormat="e164" className="w-52" />
              )}
            />
          </Row>
          <Row label="WhatsApp Number">
            <Controller
              name="whatsappNumber"
              control={control}
              render={({ field }) => (
                <PhoneInput {...field} disabled={fieldDisabled} outputFormat="e164" className="w-52" />
              )}
            />
          </Row>
          <Row label="Email">
            <Input
              {...register("email")}
              disabled={fieldDisabled}
              placeholder="email@example.com"
              type="email"
              className={`flex-1 ${getInputClass(false, fieldDisabled)}`}
            />
          </Row>
          <Row label="Designation">
            <Input {...register("designation")} disabled={fieldDisabled} placeholder="Designation" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
          </Row>
        </Section>

        {/* ── Trade Document + Account Details (two column) ────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">

          {/* LEFT */}
          <div>
            <Section title="Trade Document">
              <Row label="PAN">
                <Input
                  {...register("pan")}
                  disabled={fieldDisabled}
                  placeholder="e.g. ABCDE1234F"
                  className={`flex-1 ${getInputClass(!!errors.pan, fieldDisabled)}`}
                  onChange={(e) => setValue("pan", e.target.value.toUpperCase(), { shouldValidate: true })}
                />
              </Row>
              <Row label="GSTN">
                <Input
                  {...register("gstin")}
                  disabled={fieldDisabled}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className={`flex-1 ${getInputClass(false, fieldDisabled)}`}
                  onChange={(e) => setValue("gstin", e.target.value.toUpperCase(), { shouldValidate: false })}
                />
              </Row>
              <Row label="State Name">
                <select
                  {...register("stateName")}
                  disabled={fieldDisabled}
                  onChange={(e) => {
                    setValue("stateName", e.target.value);
                    setValue("stateCode", getStateCodeByName(e.target.value));
                  }}
                  className={`flex-1 ${getInputClass(false, fieldDisabled)} rounded-sm`}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.state}>{s.state}</option>)}
                </select>
              </Row>
              <Row label="State Code">
                <Input {...register("stateCode")} disabled placeholder="Auto" className={`w-24 ${getInputClass(false, true)}`} />
              </Row>
            </Section>

            <Section title="Account Details">
              <Row label="Bank A/c Number">
                <Input {...register("bankAccountNumber")} disabled={fieldDisabled} placeholder="Account number" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
              </Row>
              <Row label="Bank Name">
                <Input {...register("bankName")} disabled={fieldDisabled} placeholder="Bank name" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
              </Row>
              <Row label="Branch Name">
                <Input {...register("branchName")} disabled={fieldDisabled} placeholder="Branch name" className={`flex-1 ${getInputClass(false, fieldDisabled)}`} />
              </Row>
              <Row label="IFSC Code">
                <Input
                  {...register("ifscCode")}
                  disabled={fieldDisabled}
                  placeholder="IFSC code"
                  className={`flex-1 ${getInputClass(false, fieldDisabled)}`}
                  onChange={(e) => setValue("ifscCode", e.target.value.toUpperCase())}
                />
              </Row>
            </Section>
          </div>

          {/* RIGHT — file uploads */}
          <div className="flex flex-col justify-start gap-4 pt-6">
            <div className="space-y-2">
              {renderFile("pan",   panRef,   "PAN")}
              {renderFile("gstn",  gstnRef,  "GSTN")}
              {renderFile("trade", tradeRef, "Trade Licence")}
            </div>
            <div className="space-y-2 mt-2">
              {renderFile("bank",  bankRef,  "Bank A/c Copy")}
            </div>
          </div>
        </div>

        {/* ── Buttons ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 mt-6">
          {!disabledProp && mode !== "create" && (
            <EditButton onClick={isEditing ? handleCancel : () => setIsEditing(true)} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {!disabledProp && isEditing && (
            <SaveButton onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={false} />
          )}
        </div>
      </div>
    </>
  );
}
