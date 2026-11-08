"use client";

// One site day: photos on the left, the AI-written report on the right,
// and the day's site records (labour, concrete, materials, machinery, hindrances).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { DPR_BASE, isValidDay, longDay, shiftDay, todayIST, useProjectCode } from "@/lib/dpr";
import { PhotoGrid, PhotoUploader, PhotoViewer } from "./DprPhotos";
import DprReport from "./DprReport";

const DPR = API_ENDPOINTS.PROJECT.DPR;

function SiteRecords({ records }) {
  if (!records) return null;
  const blocks = [
    ["Labour (DLR)", records.labour?.map((l) => `${l.category}: ${l.count}`), records.labour_total ? `Total ${records.labour_total}` : null],
    ["Concrete poured", records.concrete?.map((c) => `${c.location || ""} ${c.segment || ""} — ${c.grade || ""}, ${c.volume || ""}`.trim())],
    ["Materials received (GRN)", records.materials_received?.map((m) => `${m.item}: ${m.quantity ?? ""} ${m.unit || ""} (${m.grn_no})`)],
    ["Machinery log", records.machinery_log?.map((m) => `${m.machine || ""} ${m.reg_no ? `(${m.reg_no})` : ""} ${m.start || ""}–${m.finish || ""}`)],
    ["Hindrances", records.hindrances?.map((h) => h.title || h.cause)],
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="text-[12.5px] font-semibold text-gray-700 uppercase tracking-wide mb-2">Site records this day</h3>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
        {blocks.map(([title, lines, extra]) => (
          <div key={title}>
            <div className="text-gray-500">{title}{extra ? ` · ${extra}` : ""}</div>
            {lines?.length ? lines.map((l, i) => <div key={i} className="text-gray-900">{l}</div>) : <div className="text-gray-400">None entered</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DprDayView({ date, canEditPage, onReport, onAfterSubmit }) {
  const router = useRouter();
  const projectCode = useProjectCode();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [openPhotoId, setOpenPhotoId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!projectCode || !isValidDay(date)) return;
    let alive = true;
    apiRequest({ url: `${DPR.DAY}?projectCode=${projectCode}&date=${date}`, method: "GET" })
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setError(null);
        onReport?.(res.data?.report);
      })
      .catch((e) => alive && setError(e.message || "Could not load this day"));
    return () => {
      alive = false;
    };
  }, [projectCode, date, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.SETTINGS.PROJECT_LOCATION.LIST}/${projectCode}`, method: "GET" })
      .then((res) => setLocations([...new Set((res.data || []).map((l) => l.locationName).filter(Boolean))]))
      .catch(() => setLocations([]));
  }, [projectCode]);

  // While the AI is reading photos, refresh every few seconds.
  const waiting = (data?.photos || []).some((p) => p.aiStatus === "pending" || p.aiStatus === "working");
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setReloadKey((k) => k + 1), 5000);
    return () => clearInterval(t);
  }, [waiting]);

  const reload = (submitted) => {
    load();
    if (submitted) onAfterSubmit?.();
  };

  if (!isValidDay(date)) return <p className="p-4 text-sm text-red-600">Wrong date in the address.</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  const canEdit = canEditPage && data.canEdit;
  const locked = data.report && !["Draft", "Reback", "Rejected"].includes(data.report.workflowStatus);
  const photo = data.photos.find((p) => p.id === openPhotoId) || null;
  const isFuture = date > todayIST();

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.push(`${DPR_BASE}/${shiftDay(date, -1)}`)} className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50" aria-label="Previous day">
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-[15px] font-semibold text-gray-900">Daily Progress Report — {longDay(date)}</h2>
        <button type="button" disabled={date >= todayIST()} onClick={() => router.push(`${DPR_BASE}/${shiftDay(date, 1)}`)}
          className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40" aria-label="Next day">
          <ChevronRight size={16} />
        </button>
        <span className="text-[12px] text-gray-500">{data.projectName} · {data.photos.length} photo(s)</span>
        {data.site?.latitude == null && (
          <span className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            Site location not set — add it in Settings › Project Code to mark off-site photos
          </span>
        )}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 items-start">
        <div className="space-y-3">
          {canEdit && !locked && !isFuture && (
            <PhotoUploader projectCode={projectCode} locations={locations} onUploaded={load} />
          )}
          {data.photos.length ? (
            <PhotoGrid photos={data.photos} onOpen={(p) => setOpenPhotoId(p.id)} />
          ) : (
            <p className="text-sm text-gray-500 bg-white rounded-lg border border-gray-200 p-4">
              No photos for this day yet. Site staff can take them with the ERP mobile app (time and GPS stamped) or upload them here.
            </p>
          )}
          <SiteRecords records={data.siteRecords} />
        </div>

        <DprReport
          // Remount the editor only when the saved report itself changes (not on every poll).
          key={JSON.stringify(data.report)}
          projectCode={projectCode}
          date={date}
          report={data.report}
          photos={data.photos}
          canEdit={canEdit}
          onChanged={reload}
          onOpenPhoto={(p) => setOpenPhotoId(p.id)}
        />
      </div>

      {photo && (
        <PhotoViewer
          key={photo.id}
          photo={photo}
          canEdit={canEdit && !locked}
          locations={locations}
          onClose={() => setOpenPhotoId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
