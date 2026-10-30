"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import {
  FieldRow, TextInput, SelectInput, DateInput, DateDisplay, TextArea,
  AmountField, NumberInput, SectionCard, FormGrid, AmStatusBadge,
} from "@/components/assetmanagement/shared/AmFormHelpers";
import { validateDateFields } from "@/lib/dateUtils";
import { formatAmount } from "@/helper/numberFormatter";
import {
  calcDepreciationSchedule, getDepreciationSummary,
  DISPOSAL_TYPES, MOCK_DISPOSALS, createDisposalRecord,
} from "./mockData";
import { AM_EMPLOYEES } from "../shared/mockAssets";

const TABS = ["details", "schedule", "timeline"];

// ─── Disposal form view ───────────────────────────────────────────────────────
function DisposalDetails({ rec, onAction, canEdit }) {
  const isEditable = canEdit && ["under_review"].includes(rec.status);
  const [form, setForm] = useState({ ...rec });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Disposal Request">
        <FormGrid>
          <FieldRow label="Doc No"><TextInput value={form.docNo} readOnly /></FieldRow>
          <FieldRow label="Asset ID"><TextInput value={form.assetId} readOnly /></FieldRow>
          <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
          <FieldRow label="Category"><TextInput value={form.category} readOnly /></FieldRow>
          <FieldRow label="Purchase Value (₹)"><AmountField value={form.purchaseValue} readOnly /></FieldRow>
          <FieldRow label="Net Book Value (₹)"><AmountField value={form.bookValue} readOnly /></FieldRow>
          <FieldRow label="Disposal Type" required>
            <SelectInput value={form.disposalType} onChange={f("disposalType")} options={DISPOSAL_TYPES} disabled={!isEditable} />
          </FieldRow>
          <FieldRow label="Request Date"><DateInput value={form.requestDate} onChange={f("requestDate")} disabled={!isEditable} /></FieldRow>
          {["sale", "exchange"].includes(form.disposalType) && (
            <>
              <FieldRow label="Buyer / Party Name"><TextInput value={form.buyerName} onChange={f("buyerName")} disabled={!isEditable} /></FieldRow>
              <FieldRow label="Sale Proceeds (₹)"><AmountField value={form.saleProceeds} onChange={f("saleProceeds")} disabled={!isEditable} /></FieldRow>
            </>
          )}
          <FieldRow label="Requested By"><TextInput value={form.requestedBy} readOnly /></FieldRow>
          <FieldRow label="Approved By"><TextInput value={form.approvedBy || "—"} readOnly /></FieldRow>
          <FieldRow label="Approval Date"><DateDisplay value={form.approvalDate} /></FieldRow>
          <FieldRow label="Disposal Date"><DateDisplay value={form.disposalDate} /></FieldRow>
          <FieldRow label="Status">
            <div className="pt-1"><AmStatusBadge status={form.status} /></div>
          </FieldRow>
        </FormGrid>
        <div className="mt-3">
          <FieldRow label="Reason / Justification" required>
            <TextArea value={form.reason} onChange={f("reason")} rows={3} disabled={!isEditable} />
          </FieldRow>
        </div>
      </SectionCard>

      {canEdit && rec.status === "under_review" && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onAction("approve", form)}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700">
            Approve Disposal
          </button>
          <button onClick={() => onAction("reject", form)}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">
            Reject
          </button>
        </div>
      )}
      {canEdit && rec.status === "approved" && (
        <button onClick={() => onAction("complete", form)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 self-start">
          Mark Disposed
        </button>
      )}
    </div>
  );
}

// ─── Depreciation schedule table ──────────────────────────────────────────────
function ScheduleTable({ schedule, purchaseValue }) {
  if (!schedule || schedule.length === 0)
    return <p className="text-sm text-gray-400 py-6 text-center">No depreciation schedule available for this asset.</p>;

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Year", "Opening Value", "Depreciation", "Acc. Depreciation", "Closing / Net Book Value"].map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium text-gray-600 border-b text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, i) => (
            <tr key={i} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
              <td className="px-4 py-2 font-medium">{row.year}</td>
              <td className="px-4 py-2">₹ {formatAmount(row.openingValue)}</td>
              <td className="px-4 py-2 text-orange-600">₹ {formatAmount(row.depreciation)}</td>
              <td className="px-4 py-2 text-red-500">₹ {formatAmount(row.accDepreciation)}</td>
              <td className="px-4 py-2 font-semibold text-green-700">₹ {formatAmount(row.closingValue)}</td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-semibold">
            <td className="px-4 py-2">Total</td>
            <td className="px-4 py-2">₹ {formatAmount(purchaseValue)}</td>
            <td className="px-4 py-2 text-orange-600">₹ {formatAmount(schedule.reduce((s, r) => s + r.depreciation, 0))}</td>
            <td className="px-4 py-2" />
            <td className="px-4 py-2 text-green-700">₹ {formatAmount(schedule[schedule.length - 1].closingValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
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
          <div className="absolute -left-4 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
          <p className="text-sm font-semibold text-gray-700">{a.action}</p>
          <p className="text-xs text-gray-500">{a.by} · {new Date(a.at).toLocaleString("en-IN")}</p>
          {a.note && <p className="text-xs text-gray-600 mt-0.5 italic">"{a.note}"</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Disposal create form ──────────────────────────────────────────────────────
function DisposalCreateForm({ assetSummary, onSave }) {
  const [form, setForm] = useState({
    assetId: assetSummary?.assetId || "",
    assetName: assetSummary?.assetName || "",
    category: assetSummary?.category || "",
    purchaseValue: assetSummary?.purchaseValue || "",
    bookValue: assetSummary?.netBookValue || "",
    disposalType: "",
    requestDate: new Date().toISOString().slice(0, 10),
    buyerName: "",
    saleProceeds: 0,
    requestedBy: "",
    reason: "",
  });
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.disposalType || !form.reason || !form.requestedBy) {
      toast.error("Disposal type, reason, and requested by are required.");
      return;
    }
    const rec = createDisposalRecord(form);
    toast.success(`Disposal request ${rec.docNo} raised.`);
    onSave?.(rec);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Asset Information">
        <FormGrid>
          <FieldRow label="Asset ID"><TextInput value={form.assetId} readOnly /></FieldRow>
          <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
          <FieldRow label="Category"><TextInput value={form.category} readOnly /></FieldRow>
          <FieldRow label="Purchase Value (₹)"><AmountField value={form.purchaseValue} readOnly /></FieldRow>
          <FieldRow label="Net Book Value (₹)"><AmountField value={form.bookValue} readOnly /></FieldRow>
        </FormGrid>
      </SectionCard>
      <SectionCard title="Disposal Details">
        <FormGrid>
          <FieldRow label="Disposal Type" required>
            <SelectInput value={form.disposalType} onChange={f("disposalType")} options={DISPOSAL_TYPES} />
          </FieldRow>
          <FieldRow label="Request Date">
            <DateInput value={form.requestDate} onChange={f("requestDate")} />
          </FieldRow>
          {["sale", "exchange"].includes(form.disposalType) && (
            <>
              <FieldRow label="Buyer / Party Name">
                <TextInput value={form.buyerName} onChange={f("buyerName")} />
              </FieldRow>
              <FieldRow label="Expected Sale Proceeds (₹)">
                <AmountField value={form.saleProceeds} onChange={f("saleProceeds")} />
              </FieldRow>
            </>
          )}
          <FieldRow label="Requested By" required>
            <SelectInput value={form.requestedBy} onChange={f("requestedBy")}
              options={AM_EMPLOYEES.map((e) => ({ value: e.name, label: e.name }))} />
          </FieldRow>
        </FormGrid>
        <div className="mt-3">
          <FieldRow label="Reason / Justification" required>
            <TextArea value={form.reason} onChange={f("reason")} rows={3}
              placeholder="Describe why the asset is being disposed..." />
          </FieldRow>
        </div>
      </SectionCard>
      <div className="flex gap-2">
        <SaveButton onClick={handleSave} disabled={false}>Submit Disposal Request</SaveButton>
      </div>
    </div>
  );
}

// ─── Main DepreciationForm ────────────────────────────────────────────────────
export default function DepreciationForm({ mode = "view", docId, viewType = "depreciation" }) {
  // viewType: "depreciation" = schedule view; "disposal" = disposal form
  const [activeTab, setActiveTab] = useState("details");
  const [disposalCreated, setDisposalCreated] = useState(null);

  const summaries = useMemo(() => getDepreciationSummary(), []);

  // ── DISPOSAL VIEW/EDIT ──
  if (viewType === "disposal") {
    const existing = MOCK_DISPOSALS.find((d) => String(d.id) === String(docId));
    const rec = disposalCreated || existing;

    if (mode === "create") {
      // Pick asset from summary, default to first undisposed
      const defaultAsset = summaries.find((s) => s.status !== "disposed") || summaries[0];
      return (
        <div className="p-4 flex flex-col gap-4">
          <DisposalCreateForm assetSummary={defaultAsset} onSave={setDisposalCreated} />
        </div>
      );
    }

    if (!rec) return <div className="p-4 text-red-500">Disposal record not found.</div>;

    const handleAction = (action, form) => {
      const now = new Date().toISOString();
      if (action === "approve") {
        rec.status = "approved";
        rec.approvedBy = "Admin";
        rec.approvalDate = now.slice(0, 10);
        rec.activities.push({ action: "Approved", by: "Admin", at: now, note: "Disposal approved" });
        toast.success("Disposal approved.");
      } else if (action === "reject") {
        rec.status = "cancelled";
        rec.activities.push({ action: "Rejected", by: "Admin", at: now, note: "Disposal rejected" });
        toast.info("Disposal rejected.");
      } else if (action === "complete") {
        rec.status = "disposed";
        rec.disposalDate = now.slice(0, 10);
        rec.activities.push({ action: "Disposed", by: "Admin", at: now, note: "Asset marked disposed" });
        toast.success("Asset marked as disposed.");
      }
      setDisposalCreated({ ...rec });
    };

    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">{rec.docNo}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{rec.assetName} · {rec.category}</p>
          </div>
          <AmStatusBadge status={rec.status} />
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
          <DisposalDetails rec={rec} onAction={handleAction} canEdit={mode !== "view"} />
        )}
        {activeTab === "timeline" && <Timeline activities={rec.activities} />}
      </div>
    );
  }

  // ── DEPRECIATION SCHEDULE VIEW ──
  const asset = summaries.find((s) => String(s.id) === String(docId)) || summaries[0];

  if (!asset) return <div className="p-4 text-red-500">Asset not found.</div>;

  const depLoss = asset.purchaseValue - asset.netBookValue;

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Purchase Value", val: `₹ ${formatAmount(asset.purchaseValue)}`, color: "text-gray-700" },
          { label: "Acc. Depreciation", val: `₹ ${formatAmount(asset.accDepreciation)}`, color: "text-orange-600" },
          { label: "Net Book Value", val: `₹ ${formatAmount(asset.netBookValue)}`, color: "text-green-700 font-semibold" },
          { label: "Method / Rate", val: `${asset.depreciationMethod} · ${asset.depreciationRate}%`, color: "text-gray-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-0.5">{c.label}</p>
            <p className={`text-sm ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {["details", "schedule", "timeline"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors
              ${activeTab === t ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === "details" && (
        <SectionCard title="Asset Depreciation Info">
          <FormGrid>
            <FieldRow label="Asset ID"><TextInput value={asset.assetId} readOnly /></FieldRow>
            <FieldRow label="Asset Name"><TextInput value={asset.assetName} readOnly /></FieldRow>
            <FieldRow label="Category"><TextInput value={asset.category} readOnly /></FieldRow>
            <FieldRow label="Purchase Date"><TextInput value={asset.purchaseDate} readOnly /></FieldRow>
            <FieldRow label="Purchase Value (₹)"><AmountField value={asset.purchaseValue} readOnly /></FieldRow>
            <FieldRow label="Useful Life (yrs)"><NumberInput value={asset.usefulLife} readOnly /></FieldRow>
            <FieldRow label="Method"><TextInput value={asset.depreciationMethod} readOnly /></FieldRow>
            <FieldRow label="Rate (%)"><NumberInput value={asset.depreciationRate} readOnly /></FieldRow>
            <FieldRow label="Current Year Dep."><AmountField value={asset.currentYearDep} readOnly /></FieldRow>
            <FieldRow label="Acc. Depreciation"><AmountField value={asset.accDepreciation} readOnly /></FieldRow>
            <FieldRow label="Net Book Value"><AmountField value={asset.netBookValue} readOnly /></FieldRow>
            <FieldRow label="Status">
              <div className="pt-1"><AmStatusBadge status={asset.status} /></div>
            </FieldRow>
          </FormGrid>
        </SectionCard>
      )}

      {activeTab === "schedule" && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-700">Full Depreciation Schedule</h3>
          <ScheduleTable schedule={asset.schedule} purchaseValue={asset.purchaseValue} />
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="py-2 text-sm text-gray-500 text-center">
          Depreciation audit trail will be available after backend integration.
        </div>
      )}
    </div>
  );
}
