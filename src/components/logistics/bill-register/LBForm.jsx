"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormWithToast as useForm } from "@/hooks/useFormWithToast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import SaveButton          from "@/components/common/SaveButton";
import SaveDraftButton     from "@/components/common/SaveDraftButton";
import EditButton          from "@/components/common/EditButton";
import DeleteRequestButton from "@/components/common/DeleteRequestButton";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { zodDate }         from "@/lib/dateUtils";

import LBBasicSection   from "./LBBasicSection";
import LBChargesSection from "./LBChargesSection";
import LBChallanTable   from "./LBChallanTable";

const LB = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.BILL_REGISTER;

function computeAmounts(v) {
  const basic   = Number(v.basicFreight     || 0);
  const loading = Number(v.loadingCharges   || 0);
  const unload  = Number(v.unloadingCharges || 0);
  const waiting = Number(v.waitingCharges   || 0);
  const toll    = Number(v.tollCharges      || 0);
  const other   = Number(v.otherCharges     || 0);
  const taxable = basic + loading + unload + waiting + toll + other;

  let igst = 0, cgst = 0, sgst = 0;
  if (v.gstType === "IGST") {
    igst = taxable * (Number(v.igstPercent || 0) / 100);
  } else {
    cgst = taxable * (Number(v.cgstPercent || 0) / 100);
    sgst = taxable * (Number(v.sgstPercent || 0) / 100);
  }
  const gstTotal   = igst + cgst + sgst;
  const total      = taxable + gstTotal;
  const tds        = total * (Number(v.tdsPercent || 0) / 100);
  const netPayable = total - tds;

  return {
    taxableAmount: taxable,
    igstAmount: igst, cgstAmount: cgst, sgstAmount: sgst,
    totalAmount: total,
    tdsAmount:   tds,
    netPayable,
  };
}

const lbSchema = z.object({
  lbNo:                    z.string().optional(),
  billDate:                zodDate(z, "Bill Date", true),
  vendorId:                z.string().min(1, "Transporter is required"),
  vendorInvoiceNo:         z.string().min(1, "Vendor Invoice No is required"),
  vendorInvoiceDate:       zodDate(z, "Vendor Invoice Date", true),
  freightBasis:            z.string().optional(),
  gstType:                 z.string().min(1, "GST Type is required"),
  basicFreight:            z.string().optional(),
  loadingCharges:          z.string().optional(),
  unloadingCharges:        z.string().optional(),
  waitingCharges:          z.string().optional(),
  tollCharges:             z.string().optional(),
  otherChargesDescription: z.string().optional(),
  otherCharges:            z.string().optional(),
  igstPercent:             z.string().optional(),
  cgstPercent:             z.string().optional(),
  sgstPercent:             z.string().optional(),
  tdsPercent:              z.string().optional(),
  remarks:                 z.string().optional(),
});

const defaultValues = {
  lbNo:                    "",
  billDate:                "",
  vendorId:                "",
  vendorInvoiceNo:         "",
  vendorInvoiceDate:       "",
  freightBasis:            "Fixed",
  gstType:                 "IGST",
  basicFreight:            "",
  loadingCharges:          "",
  unloadingCharges:        "",
  waitingCharges:          "",
  tollCharges:             "",
  otherChargesDescription: "",
  otherCharges:            "",
  igstPercent:             "",
  cgstPercent:             "",
  sgstPercent:             "",
  tdsPercent:              "",
  remarks:                 "",
};

export default function LBForm({
  mode = "create",
  lbId,
  onAfterSubmit,
  onDetailLoaded,
  onUuid,
}) {
  const router     = useRouter();
  const isViewMode = mode === "view" || mode === "approver";

  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const [isEditing,       setIsEditing]       = useState(mode === "create");
  const [isSubmitted,     setIsSubmitted]     = useState(false);
  const [allowSubmit,     setAllowSubmit]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [availableDCs,    setAvailableDCs]    = useState([]);
  const [selectedDCs,     setSelectedDCs]     = useState([]);
  const [initialDCs,      setInitialDCs]      = useState([]);
  const [vendors,         setVendors]         = useState([]);
  const [attachedFile,    setAttachedFile]    = useState(null);
  const [existingFileUrl, setExistingFileUrl] = useState("");
  const [initialFileUrl,  setInitialFileUrl]  = useState("");
  const [fileResetKey,    setFileResetKey]    = useState(0);
  const [initialFormData, setInitialFormData] = useState(null);
  const [sidebarOpen,     setSidebarOpen]     = useState(true);

  const form = useForm({
    resolver: zodResolver(lbSchema),
    defaultValues,
  });

  const { reset, getValues, handleSubmit, watch, setValue, formState: { isSubmitting } } = form;
  const computed = computeAmounts(watch());
  const disabled = isViewMode || !isEditing || isSubmitting || isSubmitted;

  // Load transporter vendors
  useEffect(() => {
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_LEDGER}?type=transporter` })
      .then((r) => setVendors(r.data || []))
      .catch(() => setVendors([]));
  }, []);

  // Load eligible DCs
  useEffect(() => {
    if (!projectCode || isViewMode) return;
    apiRequest({ url: `${LB.ELIGIBLE_DCS}?projectCode=${projectCode}` })
      .then((r) => setAvailableDCs(r.data || []))
      .catch(() => setAvailableDCs([]));
  }, [projectCode, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load LB detail
  useEffect(() => {
    if (mode === "create" || !lbId) return;
    (async () => {
      setIsLoading(true);
      try {
        const res = await apiRequest({ url: `${LB.GET_BY_ID}/${lbId}` });
        const d = res.data?.[0] || res.data || {};

        const formData = {
          lbNo:                    d.lbNo || "",
          billDate:                d.billDate || "",
          vendorId:                String(d.vendorId || ""),
          vendorInvoiceNo:         d.vendorInvoiceNo || "",
          vendorInvoiceDate:       d.vendorInvoiceDate || "",
          freightBasis:            d.freightBasis || "Fixed",
          gstType:                 d.gstType || "IGST",
          basicFreight:            d.basicFreight     != null ? String(d.basicFreight)     : "",
          loadingCharges:          d.loadingCharges   != null ? String(d.loadingCharges)   : "",
          unloadingCharges:        d.unloadingCharges != null ? String(d.unloadingCharges) : "",
          waitingCharges:          d.waitingCharges   != null ? String(d.waitingCharges)   : "",
          tollCharges:             d.tollCharges      != null ? String(d.tollCharges)      : "",
          otherChargesDescription: d.otherChargesDescription || "",
          otherCharges:            d.otherCharges     != null ? String(d.otherCharges)     : "",
          igstPercent:             d.igstPercent      != null ? String(d.igstPercent)      : "",
          cgstPercent:             d.cgstPercent      != null ? String(d.cgstPercent)      : "",
          sgstPercent:             d.sgstPercent      != null ? String(d.sgstPercent)      : "",
          tdsPercent:              d.tdsPercent       != null ? String(d.tdsPercent)       : "",
          remarks:                 d.remarks || "",
        };
        reset(formData);
        setInitialFormData(formData);

        const dcs = (d.challans || []).map((c) => ({
          dcId:           c.dcId,
          dcNo:           c.dcNo || "",
          challanDate:    c.challanDate || "",
          toProjectName:  c.toProjectName || "",
          noOfItems:      c.noOfItems ?? 0,
          workflowStatus: c.workflowStatus || "",
          billingRemarks: c.billingRemarks || "",
        }));
        setSelectedDCs(dcs);
        setInitialDCs(dcs);

        setExistingFileUrl(d.attachedDoc || "");
        setInitialFileUrl(d.attachedDoc || "");

        if (onDetailLoaded) onDetailLoaded(d);
        if (onUuid && (d.lbUuid || d.uuid)) onUuid(d.lbUuid || d.uuid);

        const editable = ["draft", "reback", "correction"].includes((d.workflowStatus || "").toLowerCase());
        if (mode === "edit" && !editable) {
          setIsSubmitted(true);
          setIsEditing(false);
          setAllowSubmit(false);
          const st = d.workflowStatus || "";
          if      (st === "Approved") toast.info("Bill already Approved");
          else if (st === "Rejected") toast.info("Bill already Rejected");
          else                         toast.info("Bill already Submitted");
        } else {
          setIsEditing(false);
          setAllowSubmit(true);
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load Logistics Bill");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [lbId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDC = (dcId) => {
    const dc = availableDCs.find((d) => String(d.id) === String(dcId));
    if (!dc) return;
    setSelectedDCs((prev) => [...prev, {
      dcId:           dc.id,
      dcNo:           dc.dcNo || "",
      challanDate:    dc.challanDate || "",
      toProjectName:  dc.toProjectName || "",
      noOfItems:      dc.noOfItems ?? 0,
      workflowStatus: dc.workflowStatus || "",
      billingRemarks: "",
    }]);
  };

  const handleRemoveDC = (idx) =>
    setSelectedDCs((prev) => prev.filter((_, i) => i !== idx));

  const handleRemarkChange = (idx, value) =>
    setSelectedDCs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], billingRemarks: value };
      return next;
    });

  const buildPayload = () => {
    const v  = getValues();
    const fd = new FormData();
    fd.append("projectCode",         projectCode);
    fd.append("billDate",            v.billDate);
    fd.append("vendorId",            v.vendorId);
    fd.append("vendorInvoiceNo",     v.vendorInvoiceNo);
    fd.append("vendorInvoiceDate",   v.vendorInvoiceDate);
    fd.append("gstType",             v.gstType);
    if (v.freightBasis)            fd.append("freightBasis",            v.freightBasis);
    if (v.basicFreight)            fd.append("basicFreight",            v.basicFreight);
    if (v.loadingCharges)          fd.append("loadingCharges",          v.loadingCharges);
    if (v.unloadingCharges)        fd.append("unloadingCharges",        v.unloadingCharges);
    if (v.waitingCharges)          fd.append("waitingCharges",          v.waitingCharges);
    if (v.tollCharges)             fd.append("tollCharges",             v.tollCharges);
    if (v.otherChargesDescription) fd.append("otherChargesDescription", v.otherChargesDescription);
    if (v.otherCharges)            fd.append("otherCharges",            v.otherCharges);
    if (v.igstPercent)             fd.append("igstPercent",             v.igstPercent);
    if (v.cgstPercent)             fd.append("cgstPercent",             v.cgstPercent);
    if (v.sgstPercent)             fd.append("sgstPercent",             v.sgstPercent);
    if (v.tdsPercent)              fd.append("tdsPercent",              v.tdsPercent);
    if (v.remarks)                 fd.append("remarks",                 v.remarks);

    // Backend wants dcIds + a map of dcId → remark (see service.py)
    fd.append("dcIds",     JSON.stringify(selectedDCs.map((dc) => dc.dcId)));
    fd.append("dcRemarks", JSON.stringify(
      selectedDCs.reduce((acc, dc) => {
        acc[dc.dcId] = dc.billingRemarks || "";
        return acc;
      }, {}),
    ));

    if (attachedFile) fd.append("attachedDoc", attachedFile);
    else if (mode === "edit" && !existingFileUrl) fd.append("clearAttachedDoc", "true");
    return fd;
  };

  const validate = () => {
    if (!selectedDCs.length) { toast.error("Attach at least one Delivery Challan"); return false; }
    if (!Number(computed.taxableAmount)) { toast.error("Enter at least one freight charge"); return false; }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!projectCode) { toast.error("Please select a project first"); return; }
    if (!validate()) return;

    let toastId;
    try {
      toastId = toast.loading(mode === "create" ? "Creating Bill..." : "Updating Bill...");
      const res = await apiRequest({
        url:    mode === "create" ? LB.CREATE : `${LB.UPDATE}/${lbId}`,
        method: mode === "create" ? "POST"   : "PUT",
        data:   buildPayload(),
      });
      toast.dismiss(toastId);
      toast.success(mode === "create" ? "Bill created" : "Bill updated");

      if (mode === "create") {
        const newId = res?.data?.lbId || res?.data?.id || res?.data?.[0]?.id;
        if (newId) router.push(`/logistics/bill-register/${newId}`);
        return;
      }

      const saved = res?.data || res?.data?.[0] || {};
      if (saved.lbNo) setValue("lbNo", saved.lbNo);
      const newUrl = saved.attachedDoc ?? existingFileUrl;
      setExistingFileUrl(newUrl);
      setInitialFileUrl(newUrl);
      setAttachedFile(null);
      setFileResetKey((k) => k + 1);
      if (saved.uuid && onUuid) onUuid(saved.uuid);

      setInitialFormData(getValues());
      setInitialDCs([...selectedDCs]);
      setIsEditing(false);
      setAllowSubmit(true);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to save Bill");
    }
  };

  const handleFinalSubmit = async () => {
    if (!lbId) { toast.error("Save as draft first"); return; }
    let toastId;
    try {
      toastId = toast.loading("Submitting Bill...");
      await apiRequest({ url: `${LB.SUBMIT}/${lbId}`, method: "POST" });
      toast.dismiss(toastId);
      toast.success("Bill submitted for approval");
      setIsSubmitted(true);
      setIsEditing(false);
      setAllowSubmit(false);
      onAfterSubmit?.();
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err?.message || "Failed to submit");
    }
  };

  const handleEdit = () => {
    if (isSubmitting || isViewMode || isSubmitted) return;
    if (isEditing) {
      if (initialFormData) reset(initialFormData);
      setSelectedDCs([...initialDCs]);
      setAttachedFile(null);
      setExistingFileUrl(initialFileUrl);
      setFileResetKey((k) => k + 1);
      setIsEditing(false);
      setAllowSubmit(true);
      return;
    }
    setIsEditing(true);
    setAllowSubmit(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#F3EEE4]/40 min-h-full">
      <div className="flex flex-col lg:flex-row gap-3 items-start">
        {sidebarOpen && (
          <div className="w-full lg:w-[400px] lg:shrink-0 flex flex-col gap-3">
            <LBBasicSection
              form={form}
              disabled={disabled}
              vendors={vendors}
              attachedFile={attachedFile}
              existingFileUrl={existingFileUrl}
              onFileChange={setAttachedFile}
              onFileClear={() => setExistingFileUrl("")}
              fileResetKey={fileResetKey}
            />
            <LBChargesSection form={form} disabled={disabled} computed={computed} />
          </div>
        )}

        <div className="hidden lg:flex flex-col items-center self-stretch">
          <div className="flex-1 w-px bg-sky-300" />
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className={`flex items-center justify-center w-5 h-10 rounded border transition my-1 ${
              sidebarOpen ? "bg-sky-100 border-sky-300 text-sky-700" : "bg-[#144664] border-[#144664] text-white"
            }`}
          >
            {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 w-px bg-sky-300" />
        </div>

        <div className="flex-1 min-w-0">
          <LBChallanTable
            selectedDCs={selectedDCs}
            availableDCs={availableDCs}
            onAdd={handleAddDC}
            onRemove={handleRemoveDC}
            onRemarkChange={handleRemarkChange}
            disabled={disabled}
          />
        </div>
      </div>

      {!isViewMode && (
        <div className="flex justify-end gap-2 mt-4 border-t border-gray-200 pt-3">
          {((mode === "create" && isEditing) ||
            (mode === "edit"   && isEditing && !isSubmitted)) && (
            <SaveDraftButton
              onClick={() => handleSubmit(handleSaveDraft)()}
              loading={isSubmitting}
              disabled={isSubmitting}
              requireConfirmation
            />
          )}
          <SaveButton
            onClick={handleFinalSubmit}
            loading={isSubmitting}
            disabled={
              !allowSubmit || isEditing || isSubmitted || isSubmitting || mode === "create"
            }
            requireConfirmation
            confirmationTitle="Submit Logistics Bill?"
            confirmationMessage="Once approved, this will post to Finance."
          >
            Submit
          </SaveButton>
          {mode === "edit" && !isSubmitted && (
            <EditButton onClick={handleEdit} disabled={isSubmitting}>
              {isEditing ? "Cancel" : "Edit"}
            </EditButton>
          )}
          {mode === "edit" && !isEditing && !isSubmitted && (
            <DeleteRequestButton
              moduleCode="LB"
              recordId={Number(lbId)}
              onDeleted={() => router.back()}
            />
          )}
        </div>
      )}
    </div>
  );
}
