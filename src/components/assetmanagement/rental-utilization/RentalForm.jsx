"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageSearch, Plus, Trash2, Clock3, FileText, User2, BarChart2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";

import {
  FieldRow, TextInput, SelectInput, DateInput, DateDisplay, TextArea,
  AmountField, NumberInput, SectionCard, FormGrid, AmStatusBadge,
} from "../shared/AmFormHelpers";
import { validateDateFields } from "@/lib/dateUtils";
import AssetPickerModal from "../site-allocation-transfer/components/AssetPickerModal";
import { MOCK_RENTALS, RENTAL_DIRECTION, RENTAL_BASIS } from "./mockData";

const ACTION_DOT = { "Agreement Created": "bg-blue-500", "Asset Deployed": "bg-amber-500", "Asset Mobilized": "bg-amber-500", Extended: "bg-purple-500", Returned: "bg-green-500", Overdue: "bg-red-500" };

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
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded text-white ${ACTION_DOT[a.action] || "bg-gray-400"}`}>{a.action}</span>
                  <span className="flex items-center gap-1 text-[12px] text-gray-700"><User2 className="w-3 h-3 text-gray-400" />{a.by}</span>
                </div>
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

function UtilizationTab({ log = [] }) {
  if (!log.length) return <div className="text-sm text-gray-400 text-center py-8">No utilization data recorded yet</div>;
  const totalHours = log.reduce((s, l) => s + (l.hoursWorked || 0), 0);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="border rounded-lg p-3 bg-blue-50">
          <p className="text-xs text-gray-500">Total Months</p>
          <p className="text-xl font-bold text-blue-700">{log.length}</p>
        </div>
        <div className="border rounded-lg p-3 bg-green-50">
          <p className="text-xs text-gray-500">Total Hours Worked</p>
          <p className="text-xl font-bold text-green-700">{totalHours}</p>
        </div>
        <div className="border rounded-lg p-3 bg-amber-50">
          <p className="text-xs text-gray-500">Avg Hours/Month</p>
          <p className="text-xl font-bold text-amber-700">{Math.round(totalHours / log.length)}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded">
          <thead className="bg-[#144664] text-white">
            <tr>
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">Hours Worked</th>
              <th className="px-3 py-2 text-right">Fuel (Ltr)</th>
              <th className="px-3 py-2 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-[#f9f9f9]" : "bg-white"}>
                <td className="px-3 py-1.5">{l.month}</td>
                <td className="px-3 py-1.5 text-right">{l.hoursWorked}</td>
                <td className="px-3 py-1.5 text-right">{l.fuelConsumed || "—"}</td>
                <td className="px-3 py-1.5 text-gray-500">{l.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY = {
  direction: "outgoing",
  assetId: "", assetName: "",
  party: "", partyContact: "",
  startDate: new Date().toISOString().split("T")[0], endDate: "",
  rentalBasis: "monthly", rentalRate: "",
  deposit: "", agreementNo: "",
  operatorIncluded: false, fuelIncluded: false,
  location: "", remarks: "",
};

export default function RentalForm({ mode = "create", docId }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [loading, setLoading]     = useState(mode !== "create");
  const [saving, setSaving]       = useState(false);
  const [assetModal, setAssetModal] = useState(false);
  const [activeTab, setActiveTab]   = useState("details");
  const [record, setRecord]         = useState(null);
  const [form, setForm]             = useState({ ...EMPTY });
  const [returnConfirm, setReturnConfirm] = useState(false);
  const [returnDate, setReturnDate]       = useState(new Date().toISOString().split("T")[0]);
  const [extendConfirm, setExtendConfirm] = useState(false);
  const [newEndDate, setNewEndDate]       = useState("");

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (mode === "create") return;
    setLoading(true);
    setTimeout(() => {
      const found = MOCK_RENTALS.find((r) => String(r.id) === String(docId));
      if (found) { setRecord(found); setForm({ ...found }); }
      else { toast.error("Record not found"); router.push("/asset-management/rental-utilization"); }
      setLoading(false);
    }, 400);
  }, [mode, docId]);

  const calcTotal = () => {
    const days = form.startDate && form.endDate
      ? Math.max(0, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000))
      : 0;
    const rate = parseFloat(form.rentalRate) || 0;
    if (form.rentalBasis === "daily") return { days, total: days * rate };
    if (form.rentalBasis === "monthly") return { days, total: Math.ceil(days / 30) * rate };
    return { days, total: rate };
  };

  const { days, total } = calcTotal();

  const handleSave = () => {
    if (!form.party)     { toast.error("Party name is required"); return; }
    if (!form.startDate) { toast.error("Start date is required"); return; }
    if (!form.endDate)   { toast.error("End date is required"); return; }
    const dateErrors = validateDateFields({
      startDate: { value: form.startDate, label: "Start Date" },
      endDate:   { value: form.endDate,   label: "End Date" },
    });
    if (Object.keys(dateErrors).length) { toast.error(Object.values(dateErrors)[0]); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(mode === "create" ? "Rental agreement created!" : "Updated!");
      setIsEditing(false);
      if (mode === "create") router.push("/asset-management/rental-utilization");
    }, 700);
  };

  if (loading) return <div className="flex items-center justify-center h-52"><Loader2 className="animate-spin w-6 h-6 text-gray-400" /></div>;

  const tabs = ["details", "utilization", "timeline"];

  return (
    <div className="p-4 space-y-4 pb-10">
      {mode !== "create" && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex border-b gap-1">
            {tabs.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === t ? "border-[#144664] text-[#144664]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t === "utilization" ? "Utilization Log" : t === "timeline" ? "Activity Timeline" : "Details"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {record && <AmStatusBadge status={record.status} />}
            {activeTab === "details" && record?.status === "active" && (
              <>
                <button onClick={() => setExtendConfirm(true)} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">Extend Period</button>
                <button onClick={() => setReturnConfirm(true)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Process Return</button>
              </>
            )}
            {activeTab === "details" && record?.status !== "returned" && (
              isEditing
                ? <><button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button><SaveButton onClick={handleSave} loading={saving} disabled={false} /></>
                : <EditButton onClick={() => setIsEditing(true)} />
            )}
          </div>
        </div>
      )}

      {activeTab === "utilization" && mode !== "create" && <UtilizationTab log={record?.utilizationLog || []} />}
      {activeTab === "timeline"    && mode !== "create" && <div className="max-w-xl"><Timeline activities={record?.activities || []} /></div>}

      {(activeTab === "details" || mode === "create") && (
        <>
          <SectionCard title="Rental Agreement">
            <FormGrid cols={3}>
              <FieldRow label="Doc No"><TextInput value={record?.docNo || "Auto-generated"} readOnly /></FieldRow>
              <FieldRow label="Agreement No"><TextInput value={form.agreementNo} onChange={set("agreementNo")} disabled={!isEditing} placeholder="AGR-xxxx" /></FieldRow>
              <FieldRow label="Rental Direction" required>
                <SelectInput value={form.direction} onChange={set("direction")} options={RENTAL_DIRECTION} disabled={!isEditing} />
              </FieldRow>
            </FormGrid>
          </SectionCard>

          <SectionCard title={form.direction === "outgoing" ? "Asset (Being Rented Out)" : "Equipment (Taken on Rent)"}
            action={mode === "create" && form.direction === "outgoing" && <button onClick={() => setAssetModal(true)} className="flex items-center gap-1 px-3 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 cursor-pointer"><PackageSearch size={13} /> Select Asset</button>}
          >
            <FormGrid cols={3}>
              {form.direction === "outgoing" ? (
                <>
                  <FieldRow label="Asset ID">
                    <div className="flex gap-2">
                      <TextInput value={form.assetId} readOnly placeholder="Select asset" />
                      {isEditing && <button onClick={() => setAssetModal(true)} className="shrink-0 px-2 py-1 border rounded text-gray-500 hover:bg-gray-100 cursor-pointer"><PackageSearch size={14} /></button>}
                    </div>
                  </FieldRow>
                  <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
                </>
              ) : (
                <FieldRow label="Equipment Description"><TextInput value={form.assetName} onChange={set("assetName")} disabled={!isEditing} placeholder="Equipment name / description" /></FieldRow>
              )}
              <FieldRow label="Deployment Location"><TextInput value={form.location} onChange={set("location")} disabled={!isEditing} placeholder="Where deployed" /></FieldRow>
            </FormGrid>
          </SectionCard>

          <SectionCard title={form.direction === "outgoing" ? "Client Details" : "Vendor / Owner Details"}>
            <FormGrid cols={3}>
              <FieldRow label={form.direction === "outgoing" ? "Client Name" : "Vendor Name"} required>
                <TextInput value={form.party} onChange={set("party")} disabled={!isEditing} placeholder="Party name" />
              </FieldRow>
              <FieldRow label="Contact No">
                <TextInput value={form.partyContact} onChange={set("partyContact")} disabled={!isEditing} placeholder="10-digit number" />
              </FieldRow>
            </FormGrid>
          </SectionCard>

          <SectionCard title="Period & Rental Terms">
            <FormGrid cols={3}>
              <FieldRow label="Start Date" required><DateInput value={form.startDate} onChange={set("startDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="End Date" required><DateInput value={form.endDate} onChange={set("endDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Actual Return Date">
                <TextInput value={form.actualReturnDate || "—"} readOnly />
              </FieldRow>
              <FieldRow label="Rental Basis"><SelectInput value={form.rentalBasis} onChange={set("rentalBasis")} options={RENTAL_BASIS} disabled={!isEditing} /></FieldRow>
              <FieldRow label={`Rental Rate (₹/${form.rentalBasis})`} required>
                <AmountField value={form.rentalRate} onChange={set("rentalRate")} disabled={!isEditing} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Security Deposit (₹)">
                <AmountField value={form.deposit} onChange={set("deposit")} disabled={!isEditing} placeholder="0.00" />
              </FieldRow>
              <FieldRow label="Rental Period (Days)"><TextInput value={days ? String(days) : "—"} readOnly /></FieldRow>
              <FieldRow label="Estimated Total (₹)"><AmountField value={total || ""} readOnly /></FieldRow>
            </FormGrid>
            <div className="mt-4 flex gap-6">
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${!isEditing ? "pointer-events-none" : ""}`}>
                <input type="checkbox" checked={form.operatorIncluded} onChange={(e) => set("operatorIncluded")(e.target.checked)} disabled={!isEditing} className="accent-[#144664]" />
                Operator Included
              </label>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${!isEditing ? "pointer-events-none" : ""}`}>
                <input type="checkbox" checked={form.fuelIncluded} onChange={(e) => set("fuelIncluded")(e.target.checked)} disabled={!isEditing} className="accent-[#144664]" />
                Fuel Included
              </label>
            </div>
            <div className="mt-4"><FieldRow label="Remarks"><TextArea value={form.remarks} onChange={set("remarks")} disabled={!isEditing} /></FieldRow></div>
          </SectionCard>

          {mode === "create" && (
            <div className="flex justify-end gap-3 pt-2">
              <EditButton onClick={() => router.push("/asset-management/rental-utilization")}>Cancel</EditButton>
              <SaveButton onClick={handleSave} loading={saving} disabled={false} />
            </div>
          )}
        </>
      )}

      <AssetPickerModal open={assetModal} onClose={() => setAssetModal(false)}
        onSelect={(a) => setForm((p) => ({ ...p, assetId: a.assetId, assetName: a.assetName }))} />

      {/* Return modal */}
      <Dialog open={returnConfirm} onOpenChange={setReturnConfirm}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Process Asset Return</DialogTitle>
          <div className="mt-3 space-y-3">
            <div><label className="text-xs font-medium text-gray-500">Actual Return Date</label><input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full border rounded px-3 py-1.5 text-sm mt-1 outline-none focus:border-blue-400" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setReturnConfirm(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { setReturnConfirm(false); toast.success("Asset returned successfully"); }} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Confirm Return</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend modal */}
      <Dialog open={extendConfirm} onOpenChange={setExtendConfirm}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Extend Rental Period</DialogTitle>
          <div className="mt-3 space-y-3">
            <div><label className="text-xs font-medium text-gray-500">Current End Date</label><p className="text-sm font-medium mt-1">{form.endDate || "—"}</p></div>
            <div><label className="text-xs font-medium text-gray-500">New End Date</label><input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={form.endDate} className="w-full border rounded px-3 py-1.5 text-sm mt-1 outline-none focus:border-blue-400" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setExtendConfirm(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { if (!newEndDate) { toast.error("Select new end date"); return; } setExtendConfirm(false); toast.success("Rental period extended"); }} className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer">Extend</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
