"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import SaveDraftButton from "@/components/common/SaveDraftButton";
import EditButton      from "@/components/common/EditButton";
import PMSection       from "@/components/project-management/common/PMSection";
import PMFormRow       from "@/components/project-management/common/PMFormRow";
import PMDateInput     from "@/components/project-management/common/PMDateInput";
import PMTextarea      from "@/components/project-management/common/PMTextarea";
import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getInputClass }   from "@/lib/formStyles";
import { useColumnResize } from "@/hooks/useColumnResize";

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtNum = (val) => {
  const n = Number(val);
  if (!n || isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_LINE = {
  ogSaleOrderId:                  null,
  ogSaleOrderNo:                  "",
  orderTitle:                     "",
  orderNo:                        "",
  claimAmount:                    0,
  certifiedAmount:                0,
  difference:                     0,
  overBillingCalculationMistake:  "",
  certifiedHoldAmendmentPending:  "",
  nonBoqItemsRate:                "",
  holdWork:                       "",
  remarks:                        "",
};

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function UncertainAllocationForm({ mode = "create", uaId, onAfterSubmit }) {
  const { tableRef }  = useColumnResize();
  const isViewMode    = mode === "view" || mode === "approver";
  const router        = useRouter();
  const projectCode   = getLocalStorage("projectInfo")?.projectCode || "";

  const [isEditing,   setIsEditing]   = useState(mode === "create");
  const [isLoading,   setIsLoading]   = useState(false);
  const [isSubmitting,setIsSubmitting]= useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // header fields
  const [uaDate,   setUaDate]   = useState(today());
  const [remarks,  setRemarks]  = useState("");
  const [status,   setStatus]   = useState("Draft");
  const [locked,   setLocked]   = useState(false);
  const [uaNo,     setUaNo]     = useState("");

  // lines
  const [lines, setLines] = useState([]);

  // sale order lookup options
  const [saleOrders, setSaleOrders] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ── load sale order lookup ─────────────────────────────────────────────────
  const loadSaleOrders = useCallback(async () => {
    if (!projectCode) return;
    setLookupLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.SALE_ORDER_LOOKUP}?projectCode=${projectCode}`,
        method: "GET",
      });
      setSaleOrders(res.data || []);
    } catch {
      toast.error("Failed to load sale orders");
    } finally {
      setLookupLoading(false);
    }
  }, [projectCode]);

  // ── load existing record ───────────────────────────────────────────────────
  const loadDetails = useCallback(async () => {
    if (!uaId) return;
    setIsLoading(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.GET_BY_ID}${uaId}`,
        method: "GET",
      });
      const d = res.data;
      if (!d) return;
      setUaNo(d.uaNo || "");
      setUaDate(d.uaDate || today());
      setRemarks(d.remarks || "");
      setStatus(d.workflowStatus || "Draft");
      setLocked(!!d.locked);
      setIsSubmitted(d.workflowStatus !== "Draft" && d.workflowStatus !== "Reback");
      setLines(
        (d.lines || []).map((l) => ({
          ogSaleOrderId:                 l.ogSaleOrderId,
          ogSaleOrderNo:                 l.ogSaleOrderNo  || "",
          orderTitle:                    l.orderTitle     || "",
          orderNo:                       l.orderNo        || "",
          claimAmount:                   l.claimAmount    ?? 0,
          certifiedAmount:               l.certifiedAmount ?? 0,
          difference:                    l.difference     ?? 0,
          overBillingCalculationMistake: l.overBillingCalculationMistake ?? "",
          certifiedHoldAmendmentPending: l.certifiedHoldAmendmentPending ?? "",
          nonBoqItemsRate:               l.nonBoqItemsRate               ?? "",
          holdWork:                      l.holdWork                      ?? "",
          remarks:                       l.remarks || "",
        })),
      );
    } catch {
      toast.error("Failed to load details");
    } finally {
      setIsLoading(false);
    }
  }, [uaId]);

  useEffect(() => {
    if (mode === "create") {
      loadSaleOrders();
    } else {
      loadDetails();
    }
  }, [mode, loadDetails, loadSaleOrders]);

  // When entering edit mode from view, re-fetch fresh lookup values
  const handleEdit = () => {
    setIsEditing(true);
    loadSaleOrders();
  };

  // ── add a sale order row ───────────────────────────────────────────────────
  const addRow = (so) => {
    if (!so) return;
    if (lines.some((l) => l.ogSaleOrderId === so.ogSaleOrderId)) {
      toast.warning("This sale order is already added");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        ...EMPTY_LINE,
        ogSaleOrderId:  so.ogSaleOrderId,
        ogSaleOrderNo:  so.ogSaleOrderNo,
        orderTitle:     so.orderTitle,
        orderNo:        so.orderNo || "",
        claimAmount:    so.claimAmount     ?? 0,
        certifiedAmount:so.certifiedAmount ?? 0,
        difference:     so.difference      ?? 0,
      },
    ]);
  };

  const removeRow = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const updateLine = (idx, field, value) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  };

  // ── balance check per line ─────────────────────────────────────────────────
  const lineBalance = (l) => {
    const sum =
      Number(l.overBillingCalculationMistake || 0) +
      Number(l.certifiedHoldAmendmentPending || 0) +
      Number(l.nonBoqItemsRate               || 0) +
      Number(l.holdWork                      || 0);
    return { sum, ok: Math.abs(sum - Number(l.difference)) < 0.01 };
  };

  // ── save (draft) ───────────────────────────────────────────────────────────
  const buildPayload = () => ({
    projectCode,
    uaDate,
    remarks,
    lines: lines.map((l) => ({
      ogSaleOrderId:                 l.ogSaleOrderId,
      overBillingCalculationMistake: Number(l.overBillingCalculationMistake) || 0,
      certifiedHoldAmendmentPending: Number(l.certifiedHoldAmendmentPending) || 0,
      nonBoqItemsRate:               Number(l.nonBoqItemsRate)               || 0,
      holdWork:                      Number(l.holdWork)                      || 0,
      remarks:                       l.remarks || null,
    })),
  });

  const handleSave = async () => {
    if (!uaDate)          { toast.error("Date is required"); return; }
    if (lines.length < 1) { toast.error("Add at least one sale order"); return; }

    // warn if any line is unbalanced
    const unbalanced = lines.filter((l) => !lineBalance(l).ok);
    if (unbalanced.length > 0) {
      toast.warning(`${unbalanced.length} line(s) have justification totals that don't match the difference. Save anyway?`);
    }

    setIsLoading(true);
    try {
      let res;
      if (mode === "create") {
        res = await apiRequest({
          url:    API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.CREATE,
          method: "POST",
          data:   buildPayload(),
        });
      } else {
        const { projectCode: _pc, ...editPayload } = buildPayload();
        res = await apiRequest({
          url:    `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.UPDATE}${uaId}`,
          method: "PUT",
          data:   editPayload,
        });
      }
      toast.success(res.message || "Saved successfully");
      if (mode === "create") {
        router.push(`/project-management/customer-billing/uncertified-statement/${res.data?.uaId}`);
      } else {
        setIsEditing(false);
        loadDetails();
      }
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setIsLoading(false);
    }
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest({
        url:    `${API_ENDPOINTS.PROJECT.UNCERTAIN_ALLOCATION.SUBMIT}${uaId}`,
        method: "POST",
      });
      toast.success(res.message || "Submitted successfully");
      setIsSubmitted(true);
      setLocked(true);
      setStatus(res.data?.workflowStatus || "Pending_L1");
      onAfterSubmit?.();
    } catch (err) {
      toast.error(err?.message || "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── selected sale order options (not yet added) ────────────────────────────
  const availableOrders = saleOrders.filter(
    (so) => !lines.some((l) => l.ogSaleOrderId === so.ogSaleOrderId),
  );

  // ── totals ─────────────────────────────────────────────────────────────────
  const totalClaim      = lines.reduce((s, l) => s + Number(l.claimAmount     || 0), 0);
  const totalCertified  = lines.reduce((s, l) => s + Number(l.certifiedAmount || 0), 0);
  const totalDifference = lines.reduce((s, l) => s + Number(l.difference      || 0), 0);

  // ── canEdit ────────────────────────────────────────────────────────────────
  const canEdit = !locked && (status === "Draft" || status === "Reback");
  const canSubmit = canEdit && !isEditing && lines.length > 0 && uaId;

  if (isLoading && mode !== "create") {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* ── Header Info ──────────────────────────────────────────────────── */}
      <PMSection title="Uncertified Statement">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          {uaNo && (
            <PMFormRow label="UA No" labelWidth="sm:w-[80px] sm:min-w-[80px]">
              <div className="text-sm font-semibold py-1">{uaNo}</div>
            </PMFormRow>
          )}
          <PMFormRow label="Date" required={isEditing} labelWidth="sm:w-[80px] sm:min-w-[80px]">
            <PMDateInput
              value={uaDate}
              onChange={(e) => setUaDate(e.target.value)}
              disabled={!isEditing}
            />
          </PMFormRow>
          {uaNo && (
            <PMFormRow label="Status" labelWidth="sm:w-[80px] sm:min-w-[80px]">
              <div className="text-sm font-semibold py-1">{status}</div>
            </PMFormRow>
          )}
        </div>
        <PMFormRow label="Remarks" labelWidth="sm:w-[80px] sm:min-w-[80px]">
          <PMTextarea
            value={remarks}
            onChange={setRemarks}
            disabled={!isEditing}
            rows={2}
          />
        </PMFormRow>
      </PMSection>

      {/* ── Add Sale Order row (edit mode only) ──────────────────────────── */}
      {isEditing && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Add Sale Order:</label>
          {lookupLoading ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <select
              className={getInputClass(false) + " max-w-xs text-sm"}
              onChange={(e) => {
                const so = availableOrders.find((o) => String(o.ogSaleOrderId) === e.target.value);
                if (so) { addRow(so); e.target.value = ""; }
              }}
              defaultValue=""
            >
              <option value="" disabled>-- Select sale order --</option>
              {availableOrders.map((so) => (
                <option key={so.ogSaleOrderId} value={so.ogSaleOrderId}>
                  {so.ogSaleOrderNo} — {so.orderTitle}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Lines Table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto border rounded-md">
        <table ref={tableRef} className="w-full text-xs border-collapse">
          <thead>
            {/* ── Group header row ── */}
            <tr className="bg-muted/60">
              <th rowSpan={2} className="border px-2 py-1.5 text-left font-semibold whitespace-nowrap w-[50px]">Sl</th>
              <th rowSpan={2} className="border px-2 py-1.5 text-left font-semibold whitespace-nowrap min-w-[120px]">Sale Order No</th>
              <th rowSpan={2} className="border px-2 py-1.5 text-left font-semibold min-w-[180px]">Title</th>
              <th colSpan={3} className="border px-2 py-1.5 text-center font-semibold bg-muted/80">
                Certification Statement
              </th>
              <th
                colSpan={5}
                className="border px-2 py-1.5 text-center font-semibold"
                style={{ background: "rgba(59,130,246,0.12)" }}
              >
                Uncertified Statement
              </th>
              {isEditing && <th rowSpan={2} className="border px-2 py-1.5 w-[40px]"></th>}
            </tr>
            {/* ── Sub-header row ── */}
            <tr className="bg-muted/40">
              <th className="border px-2 py-1 text-right font-medium whitespace-nowrap w-[120px]">Claim</th>
              <th className="border px-2 py-1 text-right font-medium whitespace-nowrap w-[120px]">Certified</th>
              <th className="border px-2 py-1 text-right font-medium whitespace-nowrap w-[120px]">Difference</th>
              {/* light red — Over Billing */}
              <th
                className="border px-2 py-1 text-center font-medium whitespace-nowrap w-[130px]"
                style={{ background: "rgba(239,68,68,0.12)" }}
              >
                Over Billing / Calc Mistake
              </th>
              {/* light blue — rest */}
              <th
                className="border px-2 py-1 text-center font-medium whitespace-nowrap w-[130px]"
                style={{ background: "rgba(59,130,246,0.10)" }}
              >
                Certified Hold Amnd Pending
              </th>
              <th
                className="border px-2 py-1 text-center font-medium whitespace-nowrap w-[120px]"
                style={{ background: "rgba(59,130,246,0.10)" }}
              >
                Non BOQ Items Rate
              </th>
              <th
                className="border px-2 py-1 text-center font-medium whitespace-nowrap w-[120px]"
                style={{ background: "rgba(59,130,246,0.10)" }}
              >
                Hold Work Unsatisfactory
              </th>
              <th
                className="border px-2 py-1 text-center font-medium whitespace-nowrap w-[120px]"
                style={{ background: "rgba(59,130,246,0.10)" }}
              >
                Remarks
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={isEditing ? 12 : 11} className="border px-3 py-4 text-center text-muted-foreground">
                  No sale orders added yet.
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => {
                const { ok } = lineBalance(l);
                return (
                  <tr key={l.ogSaleOrderId ?? idx} className={!ok && isEditing ? "bg-yellow-50/40 dark:bg-yellow-900/10" : ""}>
                    <td className="border px-2 py-1 text-center">{idx + 1}</td>
                    <td className="border px-2 py-1 whitespace-nowrap">{l.ogSaleOrderNo}</td>
                    <td className="border px-2 py-1">{l.orderTitle}</td>
                    {/* Certification Statement — read-only */}
                    <td className="border px-2 py-1 text-right bg-muted/20">{fmtNum(l.claimAmount)}</td>
                    <td className="border px-2 py-1 text-right bg-muted/20">{fmtNum(l.certifiedAmount)}</td>
                    <td className="border px-2 py-1 text-right bg-muted/20">{fmtNum(l.difference)}</td>
                    {/* Over Billing — light red */}
                    <td
                      className="border px-1 py-1"
                      style={{ background: "rgba(239,68,68,0.07)" }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={l.overBillingCalculationMistake}
                          onChange={(e) => updateLine(idx, "overBillingCalculationMistake", e.target.value)}
                          className={getInputClass(false) + " w-full text-xs py-0.5 text-right"}
                        />
                      ) : (
                        <span className="block text-right">{fmtNum(l.overBillingCalculationMistake)}</span>
                      )}
                    </td>
                    {/* light blue fields */}
                    <td
                      className="border px-1 py-1"
                      style={{ background: "rgba(59,130,246,0.06)" }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={l.certifiedHoldAmendmentPending}
                          onChange={(e) => updateLine(idx, "certifiedHoldAmendmentPending", e.target.value)}
                          className={getInputClass(false) + " w-full text-xs py-0.5 text-right"}
                        />
                      ) : (
                        <span className="block text-right">{fmtNum(l.certifiedHoldAmendmentPending)}</span>
                      )}
                    </td>
                    <td
                      className="border px-1 py-1"
                      style={{ background: "rgba(59,130,246,0.06)" }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={l.nonBoqItemsRate}
                          onChange={(e) => updateLine(idx, "nonBoqItemsRate", e.target.value)}
                          className={getInputClass(false) + " w-full text-xs py-0.5 text-right"}
                        />
                      ) : (
                        <span className="block text-right">{fmtNum(l.nonBoqItemsRate)}</span>
                      )}
                    </td>
                    <td
                      className="border px-1 py-1"
                      style={{ background: "rgba(59,130,246,0.06)" }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={l.holdWork}
                          onChange={(e) => updateLine(idx, "holdWork", e.target.value)}
                          className={getInputClass(false) + " w-full text-xs py-0.5 text-right"}
                        />
                      ) : (
                        <span className="block text-right">{fmtNum(l.holdWork)}</span>
                      )}
                    </td>
                    <td
                      className="border px-1 py-1"
                      style={{ background: "rgba(59,130,246,0.06)" }}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={l.remarks}
                          onChange={(e) => updateLine(idx, "remarks", e.target.value)}
                          className={getInputClass(false) + " w-full text-xs py-0.5"}
                        />
                      ) : (
                        <span>{l.remarks}</span>
                      )}
                    </td>
                    {isEditing && (
                      <td className="border px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-destructive hover:text-destructive/70 font-bold leading-none"
                          title="Remove row"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
            {/* ── Totals row ── */}
            {lines.length > 0 && (
              <tr className="bg-muted/60 font-semibold">
                <td colSpan={3} className="border px-2 py-1.5 text-right">Total</td>
                <td className="border px-2 py-1.5 text-right">{fmtNum(totalClaim)}</td>
                <td className="border px-2 py-1.5 text-right">{fmtNum(totalCertified)}</td>
                <td className="border px-2 py-1.5 text-right">{fmtNum(totalDifference)}</td>
                <td className="border px-2 py-1.5" colSpan={isEditing ? 6 : 5}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Balance warnings ─────────────────────────────────────────────── */}
      {isEditing && lines.some((l) => !lineBalance(l).ok) && (
        <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700">
          ⚠ Some lines have justification fields that don&apos;t sum to the difference. Please verify before submitting.
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {isEditing ? (
          <>
            <SaveDraftButton onClick={handleSave} loading={isLoading} />
          </>
        ) : (
          canEdit && (
            <EditButton onClick={handleEdit} />
          )
        )}
        {canSubmit && !isEditing && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="animate-spin w-3.5 h-3.5" />}
            Submit for Approval
          </button>
        )}
      </div>
    </div>
  );
}
