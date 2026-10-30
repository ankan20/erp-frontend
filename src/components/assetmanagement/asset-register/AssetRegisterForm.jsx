"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageSearch, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

import SaveButton from "@/components/common/SaveButton";
import EditButton from "@/components/common/EditButton";
import { getLocalStorage } from "@/lib/localStorage";

import GRNSelectModal from "./components/GRNSelectModal";
import BatchAssetTable from "./components/BatchAssetTable";
import AssetActivityTimeline from "./components/AssetActivityTimeline";
import AssetStatusBadge from "./components/AssetStatusBadge";
import {
  MOCK_ASSETS,
  ASSET_CATEGORIES,
  DEPRECIATION_METHODS,
  MOCK_LOCATIONS,
  MOCK_COST_CENTERS,
  MOCK_USERS,
  ASSET_STATUSES,
  generateAssetId,
  generateBatchSubIds,
} from "./mockData";
import {
  TextInput, SelectInput, DateInput, DateDisplay,
  TextArea, AmountField, NumberInput, QtyField,
} from "@/components/assetmanagement/shared/AmFormHelpers";
import { validateDateFields } from "@/lib/dateUtils";

// ─── Field row helper (side-label layout for this form) ───────────────────────
function FieldRow({ label, children, required }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <label className="shrink-0 sm:w-[180px] text-[13px] font-medium text-gray-600 sm:pt-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SectionTitle({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[13px] font-semibold text-white bg-[#144664] px-3 py-1.5 rounded">{title}</h3>
      {children}
    </div>
  );
}

// ─── Default empty form ───────────────────────────────────────────────────────
const EMPTY_FORM = {
  assetRegNo: "",
  regDate: new Date().toISOString().split("T")[0],
  grnNo: "",
  grnDate: "",
  partyName: "",
  orderNo: "",
  trackingType: "individual",
  assetId: "",
  assetName: "",
  category: "",
  itemCode: "",
  make: "",
  modelNo: "",
  serialNo: "",
  hsnSac: "",
  unit: "",
  batchQty: "",
  purchaseDate: new Date().toISOString().split("T")[0],
  purchaseValue: "",
  gstAmount: "",
  totalCost: "",
  depreciationMethod: "SLM",
  depreciationRate: "",
  usefulLife: "",
  location: "",
  costCenter: "",
  department: "",
  assignedTo: "",
  custodian: "",
  status: "active",
  remarks: "",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetRegisterForm({ mode = "create", assetId: routeId, onAfterSave }) {
  const isViewMode = mode === "view";
  const router = useRouter();
  const projectInfo = getLocalStorage("projectInfo");
  const projectCode = projectInfo?.projectCode || "";

  const [isEditing, setIsEditing] = useState(mode === "create");
  const [loading, setLoading] = useState(mode !== "create");
  const [saving, setSaving] = useState(false);
  const [grnModalOpen, setGrnModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // for accordion on mobile
  const [batchItems, setBatchItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState("details"); // details | activity

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  // ── Load existing asset (view/edit mode) ──
  useEffect(() => {
    if (mode === "create") return;
    setLoading(true);
    setTimeout(() => {
      const found = MOCK_ASSETS.find((a) => String(a.id) === String(routeId));
      if (found) {
        setForm({
          assetRegNo: found.assetRegNo,
          regDate: found.regDate,
          grnNo: found.grnNo,
          grnDate: found.grnDate,
          partyName: found.partyName,
          orderNo: "",
          trackingType: found.trackingType,
          assetId: found.assetId,
          assetName: found.assetName,
          category: found.category,
          itemCode: found.itemCode,
          make: found.make || "",
          modelNo: found.modelNo || "",
          serialNo: found.serialNo || "",
          hsnSac: found.hsnSac || "",
          unit: found.unit || "",
          batchQty: found.batchQty || "",
          purchaseDate: found.purchaseDate,
          purchaseValue: found.purchaseValue,
          gstAmount: found.gstAmount,
          totalCost: found.totalCost,
          depreciationMethod: found.depreciationMethod || "SLM",
          depreciationRate: found.depreciationRate || "",
          usefulLife: found.usefulLife || "",
          location: found.location || "",
          costCenter: found.costCenter || "",
          department: found.department || "",
          assignedTo: found.assignedTo || "",
          custodian: found.custodian || "",
          status: found.status || "active",
          remarks: "",
        });
        setBatchItems(found.batchItems || []);
        setActivities(found.activities || []);
      } else {
        toast.error("Asset not found");
        router.push("/asset-management/asset-register");
      }
      setLoading(false);
    }, 500);
  }, [mode, routeId]);

  // ── Auto-calc total cost ──
  useEffect(() => {
    const val = parseFloat(form.purchaseValue) || 0;
    const gst = parseFloat(form.gstAmount) || 0;
    if (val || gst) setForm((prev) => ({ ...prev, totalCost: (val + gst).toFixed(2) }));
  }, [form.purchaseValue, form.gstAmount]);

  // ── Auto-generate batch sub-IDs when qty or assetId changes ──
  useEffect(() => {
    if (form.trackingType !== "batch" || !form.assetId) return;
    const qty = parseInt(form.batchQty) || 0;
    if (qty > 0) {
      // preserve existing entries
      const updated = generateBatchSubIds(form.assetId, qty).map((gen, i) => ({
        ...gen,
        ...(batchItems[i] || {}),
        subId: gen.subId,
      }));
      setBatchItems(updated);
    } else {
      setBatchItems([]);
    }
  }, [form.batchQty, form.assetId, form.trackingType]);

  // ── GRN select handler ──
  const handleGRNSelect = ({ grn, item }) => {
    const newAssetId = generateAssetId(item.itemCode.startsWith("MCH") ? "Plant & Machinery" :
      item.itemCode.startsWith("FRN") ? "Furniture & Fixture" :
      item.itemCode.startsWith("IT") ? "IT Equipment" :
      item.itemCode.startsWith("VEH") ? "Vehicle" : "Office Equipment",
      MOCK_ASSETS.length
    );
    setForm((prev) => ({
      ...prev,
      grnNo: grn.grnNo,
      grnDate: grn.grnDate,
      partyName: grn.partyName,
      itemCode: item.itemCode,
      assetName: item.itemName,
      hsnSac: item.hsnSac || "",
      unit: item.unit,
      purchaseValue: item.rate,
      gstAmount: Math.round((item.rate * item.gstPct) / 100),
      totalCost: Math.round(item.rate * (1 + item.gstPct / 100)),
      batchQty: item.qty > 1 ? item.qty : "",
      trackingType: item.qty > 1 ? "batch" : "individual",
      assetId: newAssetId,
      assetRegNo: prev.assetRegNo || `ARN-${new Date().getFullYear()}-${String(MOCK_ASSETS.length + 1).padStart(4, "0")}`,
    }));
  };

  // ── Save handler (mock) ──
  const handleSave = () => {
    if (!form.assetName) { toast.error("Asset Name is required"); return; }
    if (!form.category)  { toast.error("Asset Category is required"); return; }
    if (!form.assetId)   { toast.error("Asset ID is required"); return; }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success(mode === "create" ? "Asset registered successfully!" : "Asset updated successfully!");
      setIsEditing(false);
      if (mode === "create") router.push("/asset-management/asset-register");
      onAfterSave?.();
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6 text-gray-400" />
      </div>
    );
  }

  // ─── TAB BUTTONS (detail view) ────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? "border-[#144664] text-[#144664]"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-10">

      {/* ── Edit / Cancel bar ── */}
      {mode !== "create" && (
        <div className="flex items-center justify-between mb-1">
          <div className="flex border-b gap-1">
            <TabBtn id="details"  label="Asset Details" />
            <TabBtn id="activity" label="Activity Timeline" />
          </div>
          {activeTab === "details" && (
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <EditButton onClick={() => setIsEditing(false)}>Cancel</EditButton>
                  <SaveButton onClick={handleSave} loading={saving} />
                </>
              ) : (
                <EditButton onClick={() => setIsEditing(true)} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && mode !== "create" && (
        <div className="max-w-2xl">
          <AssetActivityTimeline activities={activities} />
        </div>
      )}

      {/* ── Details Tab ── */}
      {(activeTab === "details" || mode === "create") && (
        <>

        {/* ── SECTION: Registration Info ── */}
        <div className="border border-gray-200 rounded-lg p-4">
          <SectionTitle title="Registration Information">
            {mode === "create" && (
              <button
                type="button"
                onClick={() => setGrnModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f4ff] border border-[#b3d4ef] text-[#144664] rounded text-sm font-medium hover:bg-[#d0eaff] cursor-pointer"
              >
                <PackageSearch size={15} />
                Select from GRN
              </button>
            )}
          </SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <FieldRow label="Asset Reg. No">
              <TextInput value={form.assetRegNo} readOnly placeholder="Auto-generated" />
            </FieldRow>
            <FieldRow label="Registration Date" required>
              {isEditing
                ? <DateInput value={form.regDate} onChange={setField("regDate")} />
                : <DateDisplay value={form.regDate} />}
            </FieldRow>
            <FieldRow label="Project Code">
              <TextInput value={projectCode} readOnly />
            </FieldRow>
            <FieldRow label="GRN Reference">
              <div className="flex gap-2">
                <TextInput value={form.grnNo} readOnly placeholder="No GRN linked" />
                {isEditing && (
                  <button
                    onClick={() => setGrnModalOpen(true)}
                    className="shrink-0 px-2 py-1 border border-gray-300 rounded text-gray-500 hover:bg-gray-100 cursor-pointer"
                    title="Change GRN"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            </FieldRow>
            <FieldRow label="GRN Date">
              <DateDisplay value={form.grnDate} />
            </FieldRow>
            <FieldRow label="Party / Supplier">
              <TextInput value={form.partyName} readOnly />
            </FieldRow>
          </div>
        </div>

        {/* ── SECTION: Asset Details ── */}
        <div className="border border-gray-200 rounded-lg p-4">
          <SectionTitle title="Asset Details" />

          {/* Tracking type toggle */}
          <div className="mb-4">
            <FieldRow label="Tracking Type" required>
              <div className="flex gap-3">
                {["individual", "batch"].map((type) => (
                  <label key={type} className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                    form.trackingType === type
                      ? "border-[#144664] bg-[#e8f4ff] text-[#144664]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  } ${!isEditing ? "pointer-events-none" : ""}`}>
                    <input
                      type="radio"
                      value={type}
                      checked={form.trackingType === type}
                      onChange={() => setField("trackingType")(type)}
                      disabled={!isEditing}
                      className="accent-[#144664]"
                    />
                    <span className="text-sm font-medium capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </FieldRow>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <FieldRow label="Generated Asset ID" required>
              <div className="flex gap-2">
                <TextInput value={form.assetId} readOnly={!isEditing} onChange={setField("assetId")} placeholder="Auto-generated" />
                {isEditing && !form.grnNo && (
                  <button
                    onClick={() => setField("assetId")(generateAssetId(form.category, MOCK_ASSETS.length))}
                    className="shrink-0 px-2 py-1 border border-gray-300 rounded text-gray-500 hover:bg-gray-100 cursor-pointer"
                    title="Generate ID"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            </FieldRow>

            <FieldRow label="Asset Category" required>
              <SelectInput
                value={form.category}
                onChange={(v) => {
                  setField("category")(v);
                  if (!form.grnNo) setField("assetId")(generateAssetId(v, MOCK_ASSETS.length));
                }}
                options={ASSET_CATEGORIES}
                disabled={!isEditing}
              />
            </FieldRow>

            <FieldRow label="Asset Name / Description" required>
              <TextInput value={form.assetName} onChange={setField("assetName")} disabled={!isEditing} placeholder="Enter asset name" />
            </FieldRow>

            <FieldRow label="Item Code">
              <TextInput value={form.itemCode} onChange={setField("itemCode")} disabled={!isEditing} placeholder="Item code" />
            </FieldRow>

            <FieldRow label="Make / Brand">
              <TextInput value={form.make} onChange={setField("make")} disabled={!isEditing} placeholder="e.g. JCB, Dell, Godrej" />
            </FieldRow>

            <FieldRow label="Model No">
              <TextInput value={form.modelNo} onChange={setField("modelNo")} disabled={!isEditing} placeholder="Model number" />
            </FieldRow>

            {form.trackingType === "individual" && (
              <FieldRow label="Serial No">
                <TextInput value={form.serialNo} onChange={setField("serialNo")} disabled={!isEditing} placeholder="Serial number" />
              </FieldRow>
            )}

            {form.trackingType === "batch" && (
              <FieldRow label="Batch Quantity" required>
                <QtyField value={form.batchQty} onChange={setField("batchQty")} disabled={!isEditing} placeholder="No. of units" />
              </FieldRow>
            )}

            <FieldRow label="HSN / SAC Code">
              <TextInput value={form.hsnSac} onChange={setField("hsnSac")} disabled={!isEditing} placeholder="HSN code" />
            </FieldRow>

            <FieldRow label="Unit">
              <TextInput value={form.unit} onChange={setField("unit")} disabled={!isEditing} placeholder="e.g. No, Set" />
            </FieldRow>
          </div>

          {/* Batch sub-asset table */}
          {form.trackingType === "batch" && batchItems.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">
                {isEditing ? "Fill in serial numbers and locations for each unit:" : `${batchItems.length} units in this batch:`}
              </p>
              <BatchAssetTable items={batchItems} onChange={setBatchItems} isEditing={isEditing} />
            </div>
          )}
        </div>

        {/* ── SECTION: Financial Details ── */}
        <div className="border border-gray-200 rounded-lg p-4">
          <SectionTitle title="Financial Details" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <FieldRow label="Purchase Date" required>
              {isEditing
                ? <DateInput value={form.purchaseDate} onChange={setField("purchaseDate")} />
                : <DateDisplay value={form.purchaseDate} />}
            </FieldRow>

            <FieldRow label="Purchase Value (₹)" required>
              <AmountField value={form.purchaseValue} onChange={setField("purchaseValue")} disabled={!isEditing} placeholder="0.00" />
            </FieldRow>

            <FieldRow label="GST Amount (₹)">
              <AmountField value={form.gstAmount} onChange={setField("gstAmount")} disabled={!isEditing} placeholder="0.00" />
            </FieldRow>

            <FieldRow label="Total Cost (₹)">
              <AmountField value={form.totalCost} readOnly />
            </FieldRow>

            <FieldRow label="Depreciation Method">
              <SelectInput
                value={form.depreciationMethod}
                onChange={setField("depreciationMethod")}
                options={DEPRECIATION_METHODS}
                disabled={!isEditing}
              />
            </FieldRow>

            {form.depreciationMethod !== "NONE" && (
              <>
                <FieldRow label="Depreciation Rate (%)">
                  <NumberInput value={form.depreciationRate} onChange={setField("depreciationRate")} disabled={!isEditing} placeholder="e.g. 15" />
                </FieldRow>
                <FieldRow label="Useful Life (Years)">
                  <NumberInput value={form.usefulLife} onChange={setField("usefulLife")} disabled={!isEditing} placeholder="e.g. 10" />
                </FieldRow>
              </>
            )}
          </div>
        </div>

        {/* ── SECTION: Location & Assignment ── */}
        <div className="border border-gray-200 rounded-lg p-4">
          <SectionTitle title="Location & Assignment" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <FieldRow label="Current Location">
              <SelectInput
                value={form.location}
                onChange={setField("location")}
                options={MOCK_LOCATIONS}
                disabled={!isEditing}
              />
            </FieldRow>

            <FieldRow label="Cost Center">
              <SelectInput
                value={form.costCenter}
                onChange={setField("costCenter")}
                options={MOCK_COST_CENTERS}
                disabled={!isEditing}
              />
            </FieldRow>

            <FieldRow label="Department">
              <TextInput value={form.department} onChange={setField("department")} disabled={!isEditing} placeholder="Department name" />
            </FieldRow>

            <FieldRow label="Assigned To">
              <SelectInput
                value={form.assignedTo}
                onChange={setField("assignedTo")}
                options={MOCK_USERS}
                disabled={!isEditing}
              />
            </FieldRow>

            <FieldRow label="Asset Custodian">
              <SelectInput
                value={form.custodian}
                onChange={setField("custodian")}
                options={MOCK_USERS}
                disabled={!isEditing}
              />
            </FieldRow>

            <FieldRow label="Asset Status">
              <SelectInput
                value={form.status}
                onChange={setField("status")}
                options={ASSET_STATUSES}
                disabled={!isEditing}
              />
            </FieldRow>
          </div>

          <div className="mt-3">
            <FieldRow label="Remarks">
              <TextArea value={form.remarks} onChange={setField("remarks")} disabled={!isEditing} placeholder="Additional notes..." rows={3} title="Remarks" />
            </FieldRow>
          </div>
        </div>

        {/* ── Save button (create mode) ── */}
        {mode === "create" && (
          <div className="flex justify-end gap-3 pt-2">
            <EditButton onClick={() => router.push("/asset-management/asset-register")}>Cancel</EditButton>
            <SaveButton onClick={handleSave} loading={saving} />
          </div>
        )}

        </>
      )}

      {/* ── GRN Modal ── */}
      <GRNSelectModal
        open={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        onSelect={handleGRNSelect}
      />
    </div>
  );
}
