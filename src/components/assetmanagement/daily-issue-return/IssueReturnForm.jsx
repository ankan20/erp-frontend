"use client";

import { useState } from "react";
import { toast } from "sonner";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import {
  FieldRow, TextInput, SelectInput, DateInput, DateDisplay, TextArea,
  QtyField, SectionCard, FormGrid, AmStatusBadge,
} from "@/components/assetmanagement/shared/AmFormHelpers";
import { validateDateFields } from "@/lib/dateUtils";
import { MOCK_ISSUES, CONDITION_OPTIONS, createIssueRecord } from "./mockData";
import { AM_EMPLOYEES, AM_DEPARTMENTS, isOverdue } from "../shared/mockAssets";
import AssetPickerModal from "../site-allocation-transfer/components/AssetPickerModal";

// ─── Return acknowledgment modal ──────────────────────────────────────────────
function ReturnModal({ rec, onClose, onConfirm }) {
  const [form, setForm] = useState({
    actualReturn: new Date().toISOString().slice(0, 10),
    conditionAtReturn: "good",
    returnedQty: rec.batchQty || 1,
    returnNote: "",
  });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4">
        <h3 className="text-base font-semibold text-gray-800">Acknowledge Return</h3>
        <FieldRow label="Actual Return Date" required>
          <DateInput value={form.actualReturn} onChange={f("actualReturn")} />
        </FieldRow>
        <FieldRow label="Condition at Return" required>
          <SelectInput value={form.conditionAtReturn} onChange={f("conditionAtReturn")} options={CONDITION_OPTIONS} />
        </FieldRow>
        {rec.isBatch && (
          <FieldRow label={`Returned Qty (of ${rec.batchQty})`} required>
            <QtyField value={form.returnedQty} onChange={f("returnedQty")} />
          </FieldRow>
        )}
        <FieldRow label="Notes">
          <TextArea value={form.returnNote} onChange={f("returnNote")} rows={2}
            placeholder="Any damage, loss, or observations..." />
        </FieldRow>
        <div className="flex justify-end gap-2 mt-2">
          <EditButton onClick={onClose}>Cancel</EditButton>
          <SaveButton onClick={() => onConfirm(form)} disabled={false}>Confirm Return</SaveButton>
        </div>
      </div>
    </div>
  );
}

// ─── Overdue badge ─────────────────────────────────────────────────────────────
function OverdueBadge({ expectedDate }) {
  if (!isOverdue(expectedDate)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded px-2 py-0.5">
      ⚠ Overdue
    </span>
  );
}

// ─── Activity timeline ────────────────────────────────────────────────────────
function Timeline({ activities }) {
  if (!activities?.length)
    return <p className="text-sm text-gray-400 py-6 text-center">No activity yet.</p>;
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
      {activities.map((a, i) => (
        <div key={i} className="relative mb-5">
          <div className={`absolute -left-4 w-3 h-3 rounded-full border-2 border-white
            ${a.action === "Overdue" ? "bg-red-500" : a.action.includes("Return") ? "bg-green-500" : "bg-blue-500"}`} />
          <p className="text-sm font-semibold text-gray-700">{a.action}</p>
          <p className="text-xs text-gray-500">{a.by} · {new Date(a.at).toLocaleString("en-IN")}</p>
          {a.note && <p className="text-xs text-gray-600 mt-0.5 italic">"{a.note}"</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────
function IssueCreateForm({ onSave }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({
    assetId: "", assetName: "", category: "", isBatch: false, batchQty: 1,
    issuedTo: "", department: "",
    issueDate: new Date().toISOString().slice(0, 10),
    expectedReturn: "",
    conditionAtIssue: "good",
    purpose: "", issuedBy: "",
  });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAssetSelect = (asset) => {
    setForm((p) => ({
      ...p,
      assetId: asset.assetId,
      assetName: asset.assetName,
      category: asset.category,
      isBatch: !!asset.isBatch,
      batchQty: asset.batchQty || 1,
    }));
    setPickerOpen(false);
  };

  const handleSave = () => {
    if (!form.assetId || !form.issuedTo || !form.expectedReturn || !form.issuedBy) {
      toast.error("Asset, issued to, expected return date, and issued by are required.");
      return;
    }
    const dateErrors = validateDateFields({
      issueDate:      { value: form.issueDate,      label: "Issue Date" },
      expectedReturn: { value: form.expectedReturn, label: "Expected Return Date" },
    });
    if (Object.keys(dateErrors).length) { toast.error(Object.values(dateErrors)[0]); return; }
    const rec = createIssueRecord(form);
    toast.success(`Issue record ${rec.docNo} created.`);
    onSave?.(rec);
  };

  return (
    <div className="flex flex-col gap-4">
      <AssetPickerModal
        open={pickerOpen}
        excludeStatuses={["disposed", "in_maintenance", "inactive", "issued"]}
        onSelect={handleAssetSelect}
        onClose={() => setPickerOpen(false)}
      />
      <SectionCard title="Asset Selection">
        <FormGrid>
          <FieldRow label="Asset ID">
            <div className="flex gap-2">
              <TextInput value={form.assetId} readOnly placeholder="Select asset..." />
              <button onClick={() => setPickerOpen(true)}
                className="px-3 py-1.5 text-sm bg-blue-50 border border-blue-200 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap">
                Pick Asset
              </button>
            </div>
          </FieldRow>
          <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
          <FieldRow label="Category"><TextInput value={form.category} readOnly /></FieldRow>
          {form.isBatch && (
            <FieldRow label="Issue Qty"><QtyField value={form.batchQty} onChange={f("batchQty")} /></FieldRow>
          )}
        </FormGrid>
      </SectionCard>

      <SectionCard title="Issue Details">
        <FormGrid>
          <FieldRow label="Issued To (Employee / Team)" required>
            <TextInput value={form.issuedTo} onChange={f("issuedTo")} placeholder="Name or team..." />
          </FieldRow>
          <FieldRow label="Department">
            <SelectInput value={form.department} onChange={f("department")}
              options={AM_DEPARTMENTS?.map((d) => ({ value: d, label: d })) || []} />
          </FieldRow>
          <FieldRow label="Issue Date" required>
            <DateInput value={form.issueDate} onChange={f("issueDate")} />
          </FieldRow>
          <FieldRow label="Expected Return Date" required>
            <DateInput value={form.expectedReturn} onChange={f("expectedReturn")} min={form.issueDate} />
          </FieldRow>
          <FieldRow label="Condition at Issue" required>
            <SelectInput value={form.conditionAtIssue} onChange={f("conditionAtIssue")} options={CONDITION_OPTIONS} />
          </FieldRow>
          <FieldRow label="Issued By" required>
            <SelectInput value={form.issuedBy} onChange={f("issuedBy")}
              options={AM_EMPLOYEES.map((e) => ({ value: e.name, label: e.name }))} />
          </FieldRow>
        </FormGrid>
        <div className="mt-3">
          <FieldRow label="Purpose / Remarks">
            <TextArea value={form.purpose} onChange={f("purpose")} rows={2}
              placeholder="Purpose of issue..." />
          </FieldRow>
        </div>
      </SectionCard>

      <div className="flex gap-2">
        <SaveButton onClick={handleSave} disabled={false}>Issue Asset</SaveButton>
      </div>
    </div>
  );
}

// ─── Detail view ──────────────────────────────────────────────────────────────
function IssueDetailView({ rec, onReturn }) {
  const canReturn = ["issued", "overdue"].includes(rec.status);
  const isPartial = rec.isBatch && rec.returnedQty > 0 && rec.returnedQty < rec.batchQty;

  return (
    <div className="flex flex-col gap-4">
      {/* Overdue alert */}
      {rec.status === "overdue" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <span className="text-red-500 text-lg">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Asset Overdue</p>
            <p className="text-xs text-red-600">Expected return was {rec.expectedReturn}. Please follow up with {rec.issuedTo}.</p>
          </div>
        </div>
      )}

      <SectionCard title="Issue Information">
        <FormGrid>
          <FieldRow label="Doc No"><TextInput value={rec.docNo} readOnly /></FieldRow>
          <FieldRow label="Asset ID"><TextInput value={rec.assetId} readOnly /></FieldRow>
          <FieldRow label="Asset Name"><TextInput value={rec.assetName} readOnly /></FieldRow>
          <FieldRow label="Category"><TextInput value={rec.category} readOnly /></FieldRow>
          {rec.isBatch && <FieldRow label="Issued Qty"><QtyField value={rec.batchQty} readOnly /></FieldRow>}
          <FieldRow label="Issued To"><TextInput value={rec.issuedTo} readOnly /></FieldRow>
          <FieldRow label="Department"><TextInput value={rec.department || "—"} readOnly /></FieldRow>
          <FieldRow label="Issue Date"><DateDisplay value={rec.issueDate} /></FieldRow>
          <FieldRow label="Expected Return"><DateDisplay value={rec.expectedReturn} /></FieldRow>
          <FieldRow label="Condition at Issue"><TextInput value={rec.conditionAtIssue} readOnly /></FieldRow>
          <FieldRow label="Issued By"><TextInput value={rec.issuedBy} readOnly /></FieldRow>
        </FormGrid>
        <div className="mt-3">
          <FieldRow label="Purpose"><TextArea value={rec.purpose || "—"} rows={2} readOnly /></FieldRow>
        </div>
      </SectionCard>

      {(rec.actualReturn || rec.returnedQty > 0) && (
        <SectionCard title="Return Information">
          <FormGrid>
            <FieldRow label="Actual Return Date"><DateDisplay value={rec.actualReturn} /></FieldRow>
            <FieldRow label="Condition at Return"><TextInput value={rec.conditionAtReturn || "—"} readOnly /></FieldRow>
            {rec.isBatch && (
              <>
                <FieldRow label="Returned Qty"><QtyField value={rec.returnedQty} readOnly /></FieldRow>
                <FieldRow label="Outstanding Qty"><QtyField value={rec.batchQty - rec.returnedQty} readOnly /></FieldRow>
              </>
            )}
            <FieldRow label="Received By"><TextInput value={rec.receivedBy || "—"} readOnly /></FieldRow>
          </FormGrid>
        </SectionCard>
      )}

      {canReturn && (
        <div className="flex gap-2">
          <button onClick={onReturn}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
            {isPartial ? "Record Further Return" : "Acknowledge Return"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main IssueReturnForm ─────────────────────────────────────────────────────
export default function IssueReturnForm({ mode = "view", docId }) {
  const [activeTab, setActiveTab] = useState("details");
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [localRec, setLocalRec] = useState(null);

  if (mode === "create") {
    return (
      <div className="p-4 flex flex-col gap-4">
        <IssueCreateForm onSave={setLocalRec} />
        {localRec && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-700">Issue record {localRec.docNo} created successfully.</p>
            <p className="text-xs text-gray-600 mt-1">Asset: {localRec.assetName} → {localRec.issuedTo}</p>
          </div>
        )}
      </div>
    );
  }

  const baseRec = MOCK_ISSUES.find((r) => String(r.id) === String(docId));
  const rec = localRec || baseRec;

  if (!rec) return <div className="p-4 text-red-500">Issue record not found.</div>;

  const handleReturnConfirm = (returnData) => {
    const allReturned = !rec.isBatch || returnData.returnedQty >= rec.batchQty;
    const isLostOrDamaged = ["lost", "damaged"].includes(returnData.conditionAtReturn);

    const newStatus = isLostOrDamaged
      ? returnData.conditionAtReturn
      : allReturned ? "returned" : "partial_returned";

    const updated = {
      ...rec,
      actualReturn: returnData.actualReturn,
      conditionAtReturn: returnData.conditionAtReturn,
      returnedQty: returnData.returnedQty,
      receivedBy: "Admin",
      status: newStatus,
      activities: [
        ...rec.activities,
        {
          action: allReturned ? "Returned" : "Partial Return",
          by: "Admin",
          at: new Date().toISOString(),
          note: returnData.returnNote || `${returnData.conditionAtReturn} condition`,
        },
      ],
    };
    setLocalRec(updated);
    setReturnModalOpen(false);
    toast.success(allReturned ? "Asset return acknowledged." : `Partial return recorded (${returnData.returnedQty}/${rec.batchQty}).`);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {returnModalOpen && (
        <ReturnModal rec={rec} onClose={() => setReturnModalOpen(false)} onConfirm={handleReturnConfirm} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{rec.docNo}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{rec.assetName} → {rec.issuedTo}</p>
        </div>
        <div className="flex items-center gap-2">
          <OverdueBadge expectedDate={rec.expectedReturn} />
          <AmStatusBadge status={rec.status} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {["details", "timeline"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors
              ${activeTab === t ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <IssueDetailView rec={rec} onReturn={() => setReturnModalOpen(true)} />
      )}
      {activeTab === "timeline" && <Timeline activities={rec.activities} />}
    </div>
  );
}
