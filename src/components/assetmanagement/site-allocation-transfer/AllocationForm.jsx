"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageSearch, Clock3, FileText, User2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { validateDateFields } from "@/lib/dateUtils";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

import {
  FieldRow, TextInput, SelectInput, DateInput, DateDisplay, TextArea,
  SectionCard, FormGrid, AmStatusBadge,
} from "../shared/AmFormHelpers";
import { AM_LOCATIONS, AM_EMPLOYEES, AM_DEPARTMENTS } from "../shared/mockAssets";
import AssetPickerModal from "./components/AssetPickerModal";
import {
  MOCK_ALLOCATIONS, ALLOCATION_TYPES, TRANSFER_REASONS, createAllocationRecord,
} from "./mockData";

function formatDt(s) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

const ACTION_DOT = { Created: "bg-blue-500", Approved: "bg-green-500", Rejected: "bg-red-500", Dispatched: "bg-amber-500", Received: "bg-emerald-500" };

function Timeline({ activities = [] }) {
  if (!activities.length) return <div className="flex items-center justify-center py-8 text-gray-400 gap-2"><Clock3 className="w-5 h-5" /><span className="text-sm">No history yet</span></div>;
  return (
    <div className="space-y-0">
      {activities.map((a, i) => (
        <div key={i} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full ${ACTION_DOT[a.action] || "bg-gray-400"} flex items-center justify-center shrink-0 z-10 shadow-sm`}>
              <FileText className="w-3 h-3 text-white" />
            </div>
            {i < activities.length - 1 && <div className="w-[2px] flex-1 min-h-[16px] my-1 bg-gray-200" />}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="rounded-lg border border-[#e8eef5] bg-[#f7f9fc] px-3 py-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded text-white ${ACTION_DOT[a.action] || "bg-gray-400"}`}>{a.action}</span>
                  <span className="flex items-center gap-1 text-[12px] text-gray-700"><User2 className="w-3 h-3 text-gray-400" />{a.by}</span>
                </div>
                <span className="text-[11px] text-gray-400">{formatDt(a.at)}</span>
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
  txnDate: new Date().toISOString().split("T")[0],
  type: "allocation",
  assetId: "", assetName: "", assetCategory: "", currentLocation: "", currentCustodian: "",
  fromLocation: "", toLocation: "",
  fromCustodian: "", toCustodian: "",
  department: "", reason: "",
  requestedBy: "", dispatchDate: "", receiptDate: "",
  remarks: "",
};

export default function AllocationForm({ mode = "create", docId }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(mode === "create");
  const [loading, setLoading] = useState(mode !== "create");
  const [saving, setSaving] = useState(false);
  const [assetModal, setAssetModal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (mode === "create") return;
    setLoading(true);
    setTimeout(() => {
      const found = MOCK_ALLOCATIONS.find((r) => String(r.id) === String(docId));
      if (found) {
        setRecord(found);
        setForm({
          txnDate: found.txnDate, type: found.type,
          assetId: found.assetId, assetName: found.assetName,
          assetCategory: "", currentLocation: found.fromLocation, currentCustodian: found.fromCustodian,
          fromLocation: found.fromLocation, toLocation: found.toLocation,
          fromCustodian: found.fromCustodian, toCustodian: found.toCustodian,
          department: found.department, reason: found.reason,
          requestedBy: found.requestedBy, dispatchDate: found.dispatchDate || "",
          receiptDate: found.receiptDate || "", remarks: found.remarks || "",
        });
      } else { toast.error("Record not found"); router.push("/asset-management/site-allocation"); }
      setLoading(false);
    }, 400);
  }, [mode, docId]);

  const handleAssetSelect = (asset) => {
    setForm((p) => ({
      ...p,
      assetId: asset.assetId, assetName: asset.assetName,
      assetCategory: asset.category,
      currentLocation: asset.location, fromLocation: asset.location,
      currentCustodian: asset.custodian, fromCustodian: asset.custodian,
    }));
  };

  const handleSave = () => {
    if (!form.assetId) { toast.error("Select an asset"); return; }
    if (!form.toLocation) { toast.error("To Location is required"); return; }
    const dateErrors = validateDateFields({
      txnDate:      { value: form.txnDate,      label: "Transaction Date" },
      dispatchDate: { value: form.dispatchDate, label: "Dispatch Date" },
    });
    if (Object.keys(dateErrors).length) { toast.error(Object.values(dateErrors)[0]); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(mode === "create" ? "Request created successfully!" : "Record updated!");
      setIsEditing(false);
      if (mode === "create") router.push("/asset-management/site-allocation");
    }, 700);
  };

  const handleAction = (action, note) => {
    toast.success(`${action} successfully`);
    // In real implementation: API call + state update
  };

  if (loading) return <div className="flex items-center justify-center h-52"><Loader2 className="animate-spin w-6 h-6 text-gray-400" /></div>;

  const statusActions = record && (
    <div className="flex items-center gap-2 flex-wrap">
      {record.status === "pending" && (
        <>
          <button onClick={() => setConfirmApprove(true)} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Approve</button>
          <button onClick={() => setConfirmReject(true)} className="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer">Reject</button>
        </>
      )}
      {record.status === "approved" && (
        <button onClick={() => setConfirmDispatch(true)} className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 cursor-pointer">Mark Dispatched</button>
      )}
      {record.status === "in_transit" && (
        <button onClick={() => setConfirmReceive(true)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer">Acknowledge Receipt</button>
      )}
    </div>
  );

  return (
    <div className="p-4 space-y-4 pb-10">
      {/* Tabs + actions */}
      {mode !== "create" && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex border-b gap-1">
            {["details", "timeline"].map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${activeTab === t ? "border-[#144664] text-[#144664]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t === "timeline" ? "Activity Timeline" : "Details"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {record && <AmStatusBadge status={record.status} />}
            {activeTab === "details" && statusActions}
            {activeTab === "details" && (record?.status === "pending" || record?.status === "draft") && (
              isEditing
                ? <><button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button><SaveButton onClick={handleSave} loading={saving} /></>
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
          {/* Registration Info */}
          <SectionCard title="Request Information"
            action={mode === "create" && (
              <button onClick={() => setAssetModal(true)} className="flex items-center gap-1.5 px-3 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 cursor-pointer">
                <PackageSearch size={13} /> Select Asset
              </button>
            )}
          >
            <FormGrid cols={3}>
              <FieldRow label="Doc No"><TextInput value={record?.docNo || "Auto-generated"} readOnly /></FieldRow>
              <FieldRow label="Date" required><DateInput value={form.txnDate} onChange={set("txnDate")} disabled={!isEditing} /></FieldRow>
              <FieldRow label="Transaction Type" required>
                <SelectInput value={form.type} onChange={set("type")} options={ALLOCATION_TYPES} disabled={!isEditing} />
              </FieldRow>
            </FormGrid>
          </SectionCard>

          {/* Asset */}
          <SectionCard title="Asset Information">
            <FormGrid cols={3}>
              <FieldRow label="Asset ID" required>
                <div className="flex gap-2">
                  <TextInput value={form.assetId} readOnly placeholder="Select asset" />
                  {isEditing && <button onClick={() => setAssetModal(true)} className="shrink-0 px-2 py-1 border rounded text-gray-500 hover:bg-gray-100 cursor-pointer"><PackageSearch size={14} /></button>}
                </div>
              </FieldRow>
              <FieldRow label="Asset Name"><TextInput value={form.assetName} readOnly /></FieldRow>
              <FieldRow label="Category"><TextInput value={form.assetCategory} readOnly /></FieldRow>
              <FieldRow label="Current Location"><TextInput value={form.currentLocation} readOnly /></FieldRow>
              <FieldRow label="Current Custodian"><TextInput value={form.currentCustodian} readOnly /></FieldRow>
            </FormGrid>
          </SectionCard>

          {/* Movement */}
          <SectionCard title="Movement Details">
            <FormGrid cols={3}>
              <FieldRow label="From Location"><TextInput value={form.fromLocation} readOnly /></FieldRow>
              <FieldRow label="To Location" required>
                <SelectInput value={form.toLocation} onChange={set("toLocation")} options={AM_LOCATIONS} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="From Custodian"><TextInput value={form.fromCustodian} readOnly /></FieldRow>
              <FieldRow label="To Custodian (Receiver)">
                <SelectInput value={form.toCustodian} onChange={set("toCustodian")} options={AM_EMPLOYEES.map((e) => e.name)} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="Department">
                <SelectInput value={form.department} onChange={set("department")} options={AM_DEPARTMENTS} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="Reason for Transfer" required>
                <SelectInput value={form.reason} onChange={set("reason")} options={TRANSFER_REASONS} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="Requested By">
                <SelectInput value={form.requestedBy} onChange={set("requestedBy")} options={AM_EMPLOYEES.map((e) => e.name)} disabled={!isEditing} />
              </FieldRow>
              <FieldRow label="Expected Dispatch Date">
                <DateInput value={form.dispatchDate} onChange={set("dispatchDate")} disabled={!isEditing} />
              </FieldRow>
            </FormGrid>
            <div className="mt-4">
              <FieldRow label="Remarks"><TextArea value={form.remarks} onChange={set("remarks")} disabled={!isEditing} /></FieldRow>
            </div>
          </SectionCard>

          {/* Receipt info (view mode) */}
          {mode !== "create" && record?.receiptDate && (
            <SectionCard title="Receipt Acknowledgment">
              <FormGrid cols={3}>
                <FieldRow label="Receipt Date"><DateDisplay value={record.receiptDate} /></FieldRow>
                <FieldRow label="Received By"><TextInput value={record.toCustodian} readOnly /></FieldRow>
              </FormGrid>
            </SectionCard>
          )}

          {mode === "create" && (
            <div className="flex justify-end gap-3 pt-2">
              <EditButton onClick={() => router.push("/asset-management/site-allocation")}>Cancel</EditButton>
              <SaveButton onClick={handleSave} loading={saving} />
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AssetPickerModal open={assetModal} onClose={() => setAssetModal(false)} onSelect={handleAssetSelect} />

      {/* Approve confirm */}
      <Dialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Approve Request</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">Are you sure you want to approve this allocation/transfer request?</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setConfirmApprove(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { handleAction("Approved"); setConfirmApprove(false); toast.success("Request approved"); }} className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">Approve</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispatch confirm */}
      <Dialog open={confirmDispatch} onOpenChange={setConfirmDispatch}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Mark as Dispatched</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">Confirm that the asset has been dispatched to the destination.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setConfirmDispatch(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { handleAction("Dispatched"); setConfirmDispatch(false); toast.success("Marked as dispatched"); }} className="px-4 py-2 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 cursor-pointer">Confirm</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receive confirm */}
      <Dialog open={confirmReceive} onOpenChange={setConfirmReceive}>
        <DialogContent className="sm:max-w-[400px] p-5">
          <DialogTitle>Acknowledge Receipt</DialogTitle>
          <p className="text-sm text-gray-600 mt-2">Confirm that the asset has been received at the destination in good condition.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setConfirmReceive(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { handleAction("Received"); setConfirmReceive(false); toast.success("Receipt acknowledged"); }} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer">Acknowledge</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={confirmReject} onOpenChange={setConfirmReject}>
        <DialogContent className="sm:max-w-[420px] p-5">
          <DialogTitle>Reject Request</DialogTitle>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-600">Please provide a reason for rejection:</p>
            <TextArea value={rejectReason} onChange={setRejectReason} rows={3} placeholder="Reason for rejection..." title="Rejection Reason" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setConfirmReject(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100 cursor-pointer">Cancel</button>
            <button onClick={() => { if (!rejectReason.trim()) { toast.error("Enter rejection reason"); return; } handleAction("Rejected", rejectReason); setConfirmReject(false); setRejectReason(""); }} className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer">Reject</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
