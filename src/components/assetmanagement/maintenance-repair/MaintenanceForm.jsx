"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageSearch, Plus, Trash2, Clock3, FileText, User2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";

import {
  FieldRow, TextInput, SelectInput, DateInput, DateDisplay, TextArea,
  AmountField, NumberInput, SectionCard, FormGrid, AmStatusBadge,
} from "../shared/AmFormHelpers";
import { validateDateFields } from "@/lib/dateUtils";
import { formatAmount } from "@/helper/numberFormatter";
import { AM_EMPLOYEES, AM_VENDORS } from "../shared/mockAssets";
import AssetPickerModal from "../site-allocation-transfer/components/AssetPickerModal";
import { MOCK_MAINTENANCE, MAINTENANCE_TYPES, PRIORITY_LEVELS } from "./mockData";

const PRIORITY_COLORS = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-600" };
const ACTION_DOT = { Reported: "bg-orange-500", Escalated: "bg-red-500", Scheduled: "bg-blue-500", Started: "bg-amber-500", Completed: "bg-green-500", Closed: "bg-gray-400" };

function Timeline({ activities = [] }) {
  if (!activities.length) return <div className="flex items-center justify-center py-8 text-gray-400 gap-2"><Clock3 className="w-5 h-5" /><span className="text-sm">No history</span></div>;
  return (
    <div className="space-y-0">
      {activities.map((a, i) => (
        <div key={i} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full ${ACTION_DOT[a.action] || "bg-gray-400"} flex items-center justify-center shrink-0 z-10`}>
              <FileText className="w-3 h-3 text-white" />
            </div>
            {i < activities.length - 1 && <div className="w-[2px] flex-1 min-h-[14px] my-1 bg-gray-200" />}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="rounded-lg border border-[#e8eef5] bg-[#f7f9fc] px-3 py-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded text-white ${ACTION_DOT[a.action] || "bg-gray-400"}`}>{a.action}</span><span className="flex items-center gap-1 text-[12px] text-gray-700"><User2 className="w-3 h-3 text-gray-400" />{a.by}</span></div>
                <span className="text-[11px] text-gray-400">{new Date(a.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>
              {a.note && <p className="mt-1 text-[12px] text-gray-500 italic">{a.note}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const EMPTY = {
  type: "preventive", priority: "medium",
  assetId: "", assetName: "", assetCategory: "",
  reportedDate: new Date().toISOString().split("T")[0],
  scheduledDate: "", startDate: "", completionDate: "",
  reportedBy: "", vendorId: "", vendorName: "", technician: "",
  issue: "", workDone: "", nextServiceDue: "",
  labourCost: "", partsCost: "", totalCost: "",
};

export default function MaintenanceForm({ mode = "create", docId }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [loading, setLoading] = useState(mode !== "create");
  const [saving, setSaving] = useState(false);
  const [assetModal, setAssetModal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [spareParts, setSpareParts] = useState([]);
  const [closeConfirm, setCloseConfirm] = useState(false);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (mode === "create") return;
    setLoading(true);
    setTimeout(() => {
      const found = MOCK_MAINTENANCE.find((r) => String(r.id) === String(docId));
      if (found) { setRecord(found); setForm({ ...found }); setSpareParts(found.spareParts || []); }
      else { toast.error("Record not found"); router.push("/asset-management/maintenance-repair"); }
      setLoading(false);
    }, 400);
  }, [mode, docId]);

  // Auto-calc total
  useEffect(() => {
    const parts = spareParts.reduce((s, p) => s + (parseFloat(p.cost) || 0), 0);
    const labour = parseFloat(form.labourCost) || 0;
    setForm((p) => ({ ...p, partsCost: parts, totalCost: (parts + labour).toFixed(2) }));
  }, [spareParts, form.labourCost]);

  const addPart = () => setSpareParts((p) => [...p, { item: "", qty: 1, unit: "No", cost: 0 }]);
  const removePart = (i) => setSpareParts((p) => p.filter((_, idx) => idx !== i));
  const updatePart = (i, k, v) => setSpareParts((p) => p.map((part, idx) => idx === i ? { ...part, [k]: v } : part));

  const handleSave = () => {
    if (!form.assetId) { toast.error("Select an asset"); return; }
    if (!form.issue)   { toast.error("Describe the issue"); return; }
    const dateErrors = validateDateFields({
      reportedDate:   { value: form.reportedDate,   label: "Reported Date" },
      scheduledDate:  { value: form.scheduledDate,  label: "Scheduled Date" },
      completionDate: { value: form.completionDate, label: "Completion Date" },
    });
    if (Object.keys(dateErrors).length) { toast.error(Object.values(dateErrors)[0]); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(mode === "create" ? "Maintenance request created!" : "Updated!");
      setIsEditing(false);
      if (mode === "create") router.push("/asset-management/maintenance-repair");
    }, 700);
  };

  if (loading) return <div className="flex items-center justify-center h-52"><Loader2 className="animate-spin w-6 h-6 text-gray-400" /></div>;

  const statusActions = record && (
    <div className="flex gap-2 flex-wrap">
      {record.status === "reported" && <button onClick={() => { toast.success("Scheduled"); }} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">Schedule Work</button>}
      {record.status === "scheduled" && <button onClick={() => { toast.success("Marked In Progress"); }} className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 cursor-pointer">Mark Started</button>}
      {record.status === "in_progress" && <button onClick={() => { setIsEditing(true); toast.info("Fill work done details and save to complete"); }} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Complete & Return to Service</button>}
      {record.status === "completed" && <button onClick={() => setCloseConfirm(true)} className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer">Close</button>}
    </div>
  );

  return (
    <div className="p-4 space-y-4 pb-10">
      {mode !== "create" && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex border-b gap-1">
            {["details", "timeline"].map((t) => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === t ? "border-[#144664] text-[#144664]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t === "timeline" ? "Activity Timeline" : "Details"}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {record && <AmStatusBadge status={record.status} />}
            {record && form.priority && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_COLORS[form.priority]}`}>{form.priority}</span>}
            {activeTab === "details" && statusActions}
            {activeTab === "details" && ["reported", "scheduled"].includes(record?.status) && (
              isEditing
                ? <><button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button><SaveButton onClick={handleSave} loading={saving} disabled={false} /></>
                : <EditButton onClick={() => setIsEditing(true)} />
            )}
          </div>
        </div>
      )}

      {activeTab === "timeline" && mode !== "create" && (
        <div className="max-w-xl"><Timeline activities={record?.activities || []} /></div>
      )}

      {(activeTab === "details" || mode === "create") && (
        <>
          <SectionCard title="Request Details">
            <FormGrid cols={3}>
              <FieldRow label="Doc No"><TextInput value={record?.docNo || "Auto-generated"} readOnly /></FieldRow>
              <FieldRow label="Maintenance Type" required><SelectInput value={form.type} onChange={set("type")} options={MAINTENANCE_TYPES} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Priority" required><SelectInput value={form.priority} onChange={set("priority")} options={PRIORITY_LEVELS} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Reported Date" required><DateInput value={form.reportedDate} onChange={set("reportedDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Scheduled Date"><DateInput value={form.scheduledDate} onChange={set("scheduledDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Reported By"><SelectInput value={form.reportedBy} onChange={set("reportedBy")} options={AM_EMPLOYEES.map((e) => e.name)} disabled={!isEditing} /></FieldRow>
            </FormGrid>
          </SectionCard>

          <SectionCard title="Asset Information"
            action={mode === "create" && <button onClick={() => setAssetModal(true)} className="flex items-center gap-1 px-3 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 cursor-pointer"><PackageSearch size={13} /> Select</button>}
          >
            <FormGrid cols={3}>
              <FieldRow label="Asset ID" required>
                <div className="flex gap-2">
                  <TextInput value={form.assetId} readOnly placeholder="Select asset" />
                  {isEditing && <button onClick={() => setAssetModal(true)} className="shrink-0 px-2 py-1 border rounded text-gray-500 hover:bg-gray-100 cursor-pointer"><PackageSearch size={14} /></button>}
                </div>
              </FieldRow>
              <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
              <FieldRow label="Category"><TextInput value={form.assetCategory || form.category || ""} readOnly /></FieldRow>
            </FormGrid>
            <div className="mt-4">
              <FieldRow label="Issue Description / Symptom" required>
                <TextArea value={form.issue} onChange={set("issue")} disabled={!isEditing} placeholder="Describe the problem or work required in detail..." rows={4} />
              </FieldRow>
            </div>
          </SectionCard>

          <SectionCard title="Vendor / Technician Assignment">
            <FormGrid cols={3}>
              <FieldRow label="Vendor">
                <SelectInput value={form.vendorId} onChange={(v) => { set("vendorId")(v); set("vendorName")(AM_VENDORS.find((x) => x.id === v)?.name || ""); }} options={AM_VENDORS.map((v) => ({ value: v.id, label: v.name }))} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="Technician Name"><TextInput value={form.technician} onChange={set("technician")} disabled={!isEditing} placeholder="Technician name" /></FieldRow>
              <FieldRow label="Start Date"><DateInput value={form.startDate} onChange={set("startDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Completion Date"><DateInput value={form.completionDate} onChange={set("completionDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Next Service Due"><DateInput value={form.nextServiceDue} onChange={set("nextServiceDue")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Downtime (Hours)"><NumberInput value={form.downtimeHours} onChange={set("downtimeHours")} disabled={!isEditing} placeholder="0" min="0" /></FieldRow>
            </FormGrid>
          </SectionCard>

          {/* Spare Parts */}
          <SectionCard title="Spare Parts & Costs"
            action={isEditing && <button onClick={addPart} className="flex items-center gap-1 px-3 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 cursor-pointer"><Plus size={13} /> Add Part</button>}
          >
            {spareParts.length === 0 && !isEditing && <p className="text-sm text-gray-400">No spare parts recorded</p>}
            {spareParts.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full min-w-max text-sm border border-gray-200 rounded">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="px-3 py-1.5 text-left border-b">Item</th>
                      <th className="px-3 py-1.5 text-center border-b w-16">Qty</th>
                      <th className="px-3 py-1.5 text-center border-b w-16">Unit</th>
                      <th className="px-3 py-1.5 text-right border-b w-28">Cost (₹)</th>
                      {isEditing && <th className="px-2 py-1.5 text-center border-b w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {spareParts.map((p, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-[#f9f9f9]" : "bg-white"}>
                        <td className="px-3 py-1">
                          {isEditing ? <input value={p.item} onChange={(e) => updatePart(i, "item", e.target.value)} className="w-full border-b border-gray-200 bg-transparent outline-none text-sm focus:border-blue-400" /> : p.item}
                        </td>
                        <td className="px-3 py-1 text-center">
                          {isEditing ? <input type="number" value={p.qty} onChange={(e) => updatePart(i, "qty", e.target.value)} className="w-full text-center border-b border-gray-200 bg-transparent outline-none text-sm" /> : p.qty}
                        </td>
                        <td className="px-3 py-1 text-center">{p.unit}</td>
                        <td className="px-3 py-1 text-right">
                          {isEditing ? <input type="number" value={p.cost} onChange={(e) => updatePart(i, "cost", e.target.value)} className="w-full text-right border-b border-gray-200 bg-transparent outline-none text-sm" /> : <span className="text-sm">₹ {formatAmount(p.cost)}</span>}
                        </td>
                        {isEditing && <td className="px-2 py-1 text-center"><button onClick={() => removePart(i)} className="text-red-400 hover:text-red-600 cursor-pointer"><Trash2 size={13} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              <FieldRow label="Labour Cost (₹)"><AmountField value={form.labourCost} onChange={set("labourCost")} disabled={!isEditing} placeholder="0.00" /></FieldRow>
              <FieldRow label="Parts Cost (₹)"><AmountField value={form.partsCost || 0} readOnly /></FieldRow>
              <FieldRow label="Total Cost (₹)"><AmountField value={form.totalCost || 0} readOnly /></FieldRow>
            </div>
          </SectionCard>

          {(mode !== "create" && record?.status === "completed") || isEditing ? (
            <SectionCard title="Work Done Summary">
              <FieldRow label="Work Performed">
                <TextArea value={form.workDone} onChange={set("workDone")} disabled={!isEditing} placeholder="Describe the actual work performed, parts replaced, observations..." rows={4} />
              </FieldRow>
            </SectionCard>
          ) : null}

          {mode === "create" && (
            <div className="flex justify-end gap-3 pt-2">
              <EditButton onClick={() => router.push("/asset-management/maintenance-repair")}>Cancel</EditButton>
              <SaveButton onClick={handleSave} loading={saving} disabled={false} />
            </div>
          )}
        </>
      )}

      <AssetPickerModal open={assetModal} onClose={() => setAssetModal(false)}
        onSelect={(a) => setForm((p) => ({ ...p, assetId: a.assetId, assetName: a.assetName, assetCategory: a.category }))} />

      <Dialog open={closeConfirm} onOpenChange={setCloseConfirm}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Close Maintenance Record</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">Closing this record will archive it. Confirm?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setCloseConfirm(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { setCloseConfirm(false); toast.success("Record closed"); }} className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer">Close Record</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
