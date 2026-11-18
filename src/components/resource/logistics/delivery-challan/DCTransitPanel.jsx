"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Truck, Package, PackageCheck, Clock, Upload, CheckCircle2, Eye } from "lucide-react";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import StatusStepper          from "@/components/logistics/common/StatusStepper";
import LogisticsStatusBadge   from "@/components/logistics/common/LogisticsStatusBadge";

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;

const TRANSIT_STEPS = [
  { key: "Pending_Dispatch", label: "Pending Dispatch", icon: Clock         },
  { key: "Dispatched",       label: "Dispatched",       icon: Truck         },
  { key: "In_Transit",       label: "In Transit",       icon: Package       },
  { key: "Delivered",        label: "Delivered",        icon: PackageCheck  },
];

export default function DCTransitPanel({
  dcId,
  workflowStatus,
  transitStatus,
  podStatus,
  podFile,
  canUpdate = true,     // gated by delivery_challan.DISPATCH permission
  onChange,             // (patch) => void — parent can resync
}) {
  const fileRef = useRef(null);
  const [transit,  setTransit]  = useState(transitStatus || "Pending_Dispatch");
  const [pod,      setPod]      = useState({ status: podStatus || "Awaited", file: podFile || "" });
  const [busy,     setBusy]     = useState(false);

  // Nothing to control until the DC is actually Approved
  if (workflowStatus !== "Approved") {
    return (
      <div className="border border-gray-200 bg-gray-50 rounded-sm p-3 text-[12px] text-gray-500">
        Transit tracking will activate once this Delivery Challan is approved.
      </div>
    );
  }

  const handleStep = async (newKey) => {
    if (!canUpdate) { toast.error("You don't have permission to update transit status"); return; }
    if (newKey === transit) return;
    setBusy(true);
    try {
      await apiRequest({
        url: `${DC.UPDATE_TRANSIT_STATUS}/${dcId}`,
        method: "POST",
        data: { transitStatus: newKey },
      });
      setTransit(newKey);
      onChange?.({ transitStatus: newKey });
      toast.success(`Marked ${newKey.replace(/_/g, " ")}`);
    } catch (err) {
      toast.error(err?.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const handlePodUpload = async (file) => {
    if (!file) return;
    if (!canUpdate) { toast.error("No permission to upload POD"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("podFile", file);
      const r = await apiRequest({
        url: `${DC.UPLOAD_POD}/${dcId}`,
        method: "POST",
        data: fd,
      });
      const next = {
        status: "Uploaded",
        file: r?.data?.podFile || "",
      };
      setPod(next);
      setTransit("Delivered");
      onChange?.({ podFile: next.file, podStatus: "Uploaded", transitStatus: "Delivered" });
      toast.success("POD uploaded");
    } catch (err) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      await apiRequest({ url: `${DC.VERIFY_POD}/${dcId}`, method: "POST" });
      setPod((p) => ({ ...p, status: "Verified" }));
      onChange?.({ podStatus: "Verified" });
      toast.success("POD verified");
    } catch (err) {
      toast.error(err?.message || "Failed to verify");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 bg-white rounded-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-[11px] uppercase tracking-wide font-semibold text-gray-600">
          Dispatch & Delivery
        </span>
        <div className="flex items-center gap-2">
          <LogisticsStatusBadge status={transit} />
          <LogisticsStatusBadge status={pod.status} />
        </div>
      </div>

      <div className="p-4">
        <StatusStepper
          steps={TRANSIT_STEPS}
          current={transit}
          onStepClick={canUpdate ? handleStep : undefined}
        />
      </div>

      {/* POD section */}
      <div className="border-t border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="text-[12px] font-medium text-gray-700">Proof of Delivery</div>

        {pod.file && (
          <a
            href={pod.file}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-[#144664] hover:underline"
          >
            <Eye className="w-3.5 h-3.5" /> View uploaded POD
          </a>
        )}

        {canUpdate && pod.status !== "Verified" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handlePodUpload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-sm border border-[#144664] text-[#144664] hover:bg-[#144664]/5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {pod.file ? "Replace POD" : "Upload POD"}
            </button>
          </>
        )}

        {canUpdate && pod.status === "Uploaded" && (
          <button
            type="button"
            disabled={busy}
            onClick={handleVerify}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Verify POD
          </button>
        )}
      </div>
    </div>
  );
}
