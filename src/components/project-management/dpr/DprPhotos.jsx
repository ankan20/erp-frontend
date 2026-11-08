"use client";

// Photos of one site day: upload (drag & drop), gallery, and a photo viewer
// with what the AI saw, location/time checks and edit/delete.

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Camera, CheckCircle2, Clock, ImagePlus, Loader2, MapPin, RefreshCw, ShieldAlert, Trash2, Upload, X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { SEVERITY_STYLE, shrinkImage, timeOf } from "@/lib/dpr";

const DPR = API_ENDPOINTS.PROJECT.DPR;

const Badge = ({ className = "", children, title }) => (
  <span title={title} className={`inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[10.5px] font-medium border ${className}`}>
    {children}
  </span>
);

/** Small trust badges: where and when the photo was taken. */
export function PhotoChecks({ p }) {
  return (
    <div className="flex flex-wrap gap-1">
      {p.source === "camera" ? (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200" title="Taken with the ERP app camera">
          <Camera size={11} /> App camera
        </Badge>
      ) : (
        <Badge className="bg-gray-50 text-gray-600 border-gray-200" title="Uploaded from a computer or gallery">
          <Upload size={11} /> Uploaded
        </Badge>
      )}
      {p.isMockLocation && (
        <Badge className={SEVERITY_STYLE.high} title="The phone reported a fake-GPS app">
          <ShieldAlert size={11} /> Fake GPS
        </Badge>
      )}
      {p.onSite === true && (
        <Badge className="bg-green-50 text-green-700 border-green-200" title={`${p.distanceM} m from the site`}>
          <MapPin size={11} /> On site
        </Badge>
      )}
      {p.onSite === false && (
        <Badge className={SEVERITY_STYLE.medium} title={`${p.distanceM} m from the site`}>
          <MapPin size={11} /> Off-site ({p.distanceM >= 1000 ? `${(p.distanceM / 1000).toFixed(1)} km` : `${p.distanceM} m`})
        </Badge>
      )}
      {!p.timeVerified && (
        <Badge
          className="bg-gray-50 text-gray-600 border-gray-200"
          title={p.timeSource === "exif" ? "Time read from the photo file" : "Time the photo was uploaded"}
        >
          <Clock size={11} /> {p.timeSource === "exif" ? "Time from photo" : "Upload time"}
        </Badge>
      )}
    </div>
  );
}

function AiLine({ p }) {
  if (p.aiStatus === "pending" || p.aiStatus === "working")
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-500">
        <Loader2 size={11} className="animate-spin" /> AI is reading…
      </span>
    );
  if (p.aiStatus === "failed") return <span className="text-[11px] text-red-600">AI could not read it</span>;
  if (p.aiStatus === "skipped") return <span className="text-[11px] text-gray-400">AI off</span>;
  const ai = p.ai || {};
  if (ai.is_site_photo === false) return <span className="text-[11px] text-gray-500">Not a site photo</span>;
  return <span className="text-[11.5px] text-gray-800 line-clamp-2">{ai.activity || "—"}</span>;
}

export function PhotoGrid({ photos, onOpen }) {
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
      {photos.map((p) => {
        const issues = p.ai?.safety_issues || [];
        const worst = issues.find((s) => s.severity === "high") || issues.find((s) => s.severity === "medium") || issues[0];
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onOpen(p)}
            className="text-left rounded-md border border-gray-200 bg-white overflow-hidden hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="relative aspect-[4/3] bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl || p.fileUrl} alt={p.caption || "Site photo"} className="w-full h-full object-cover" loading="lazy" />
              <span className="absolute left-1 top-1 rounded bg-black/60 text-white text-[10.5px] px-1.5">{timeOf(p.takenAt)}</span>
              {worst && (
                <span className={`absolute right-1 top-1 rounded border px-1 text-[10px] font-semibold ${SEVERITY_STYLE[worst.severity]}`}>
                  <AlertTriangle size={10} className="inline -mt-0.5" /> {worst.severity}
                </span>
              )}
            </div>
            <div className="p-1.5 space-y-1">
              <AiLine p={p} />
              <div className="text-[10.5px] text-gray-500 truncate">
                {[p.subLocation, p.uploadedBy].filter(Boolean).join(" · ")}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function PhotoUploader({ projectCode, locations, onUploaded }) {
  const inputRef = useRef(null);
  const [subLocation, setSubLocation] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (fileList) => {
    const files = [...fileList].filter((f) => f.type?.startsWith("image/"));
    if (!files.length) return toast.error("Pick photos (JPG or PNG)");
    if (files.length > 30) return toast.error("Up to 30 photos at a time");
    setBusy(true);
    const id = toast.loading(`Uploading ${files.length} photo(s)…`);
    try {
      const fd = new FormData();
      fd.append("projectCode", projectCode);
      const ready = await Promise.all(files.map((f) => shrinkImage(f)));
      ready.forEach((f) => fd.append("photos", f));
      fd.append("meta", JSON.stringify(ready.map(() => ({ source: "upload", subLocation, caption }))));
      const res = await apiRequest({ url: DPR.PHOTOS, method: "POST", data: fd });
      const skipped = res?.data?.skipped || [];
      toast.success(res?.message || "Photos saved", { id, description: skipped.length ? skipped.map((s) => `${s.file}: ${s.reason}`).join("\n") : undefined });
      setCaption("");
      onUploaded?.();
    } catch (e) {
      toast.error(e.message || "Upload failed", { id });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) upload(e.dataTransfer.files); }}
      className={`rounded-lg border-2 border-dashed p-3 transition ${drag ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"}`}
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          list="dpr-locations"
          value={subLocation}
          onChange={(e) => setSubLocation(e.target.value)}
          placeholder="Location on site (e.g. Block C, 2nd floor)"
          className="flex-1 min-w-0 h-9 rounded-md border border-gray-300 px-2.5 text-sm outline-none focus:border-blue-400"
        />
        <datalist id="dpr-locations">
          {locations.map((l) => <option key={l} value={l} />)}
        </datalist>
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Note (optional)"
          maxLength={500}
          className="flex-1 min-w-0 h-9 rounded-md border border-gray-300 px-2.5 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-9 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#2563EB] px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Add photos
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-gray-500">
        Drop photos here or click Add photos. The location and note apply to this batch. Photos taken with the ERP app
        carry verified time and GPS; uploads use the date saved in the photo when it has one.
      </p>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
    </div>
  );
}

export function PhotoViewer({ photo, canEdit, locations, onClose, onChanged }) {
  const [caption, setCaption] = useState(photo?.caption || "");
  const [subLocation, setSubLocation] = useState(photo?.subLocation || "");
  const [busy, setBusy] = useState(null);
  if (!photo) return null;
  const ai = photo.ai || {};
  const dirty = caption !== (photo.caption || "") || subLocation !== (photo.subLocation || "");

  const call = async (key, req, done) => {
    setBusy(key);
    try {
      const res = await apiRequest(req);
      toast.success(res?.message || "Done");
      done?.(res);
      onChanged?.();
    } catch (e) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden" showCloseButton={false}>
        <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] max-h-[90vh]">
          <div className="bg-black flex items-center justify-center min-h-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.fileUrl} alt={photo.caption || "Site photo"} className="max-h-[90vh] w-full object-contain" />
          </div>
          <div className="p-4 overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="text-base">{ai.activity || "Site photo"}</DialogTitle>
                <DialogDescription className="text-xs">
                  {photo.takenAt} · {photo.uploadedBy || "—"}
                </DialogDescription>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <PhotoChecks p={photo} />

            {photo.aiStatus === "done" && ai.is_site_photo !== false && (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12.5px]">
                {ai.stage && (<><dt className="text-gray-500">Stage</dt><dd>{ai.stage}</dd></>)}
                <dt className="text-gray-500">Workers seen</dt><dd>{ai.workers_visible ?? 0}</dd>
                {!!ai.machinery?.length && (<><dt className="text-gray-500">Machinery</dt><dd>{ai.machinery.join(", ")}</dd></>)}
                {!!ai.materials?.length && (<><dt className="text-gray-500">Materials</dt><dd>{ai.materials.join(", ")}</dd></>)}
                {ai.weather && (<><dt className="text-gray-500">Weather</dt><dd>{ai.weather}</dd></>)}
                {ai.notes && (<><dt className="text-gray-500">Note</dt><dd>{ai.notes}</dd></>)}
              </dl>
            )}
            {!!ai.safety_issues?.length && (
              <div className="space-y-1">
                <div className="text-[12px] font-semibold text-gray-700">Safety</div>
                {ai.safety_issues.map((s, i) => (
                  <div key={i} className={`rounded border px-2 py-1 text-[12px] ${SEVERITY_STYLE[s.severity]}`}>
                    <b className="uppercase text-[10.5px] mr-1">{s.severity}</b> {s.issue}
                  </div>
                ))}
              </div>
            )}
            {photo.aiStatus === "failed" && <p className="text-[12px] text-red-600">{photo.aiError}</p>}
            {photo.aiStatus === "done" && (
              <p className="text-[10.5px] text-gray-400">AI reading — check before relying on counts.</p>
            )}

            {photo.latitude != null && (
              <a
                className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
                href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={12} /> {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                {photo.accuracyM ? ` (±${Math.round(photo.accuracyM)} m)` : ""}
              </a>
            )}

            <div className="space-y-2 pt-1 border-t border-gray-100">
              <label className="block text-[11.5px] text-gray-500">
                Location on site
                <input
                  list="dpr-locations-view"
                  value={subLocation}
                  disabled={!canEdit}
                  onChange={(e) => setSubLocation(e.target.value)}
                  className="mt-0.5 w-full h-8 rounded border border-gray-300 px-2 text-[13px] text-gray-900 disabled:bg-gray-50"
                />
                <datalist id="dpr-locations-view">
                  {locations.map((l) => <option key={l} value={l} />)}
                </datalist>
              </label>
              <label className="block text-[11.5px] text-gray-500">
                Note
                <textarea
                  value={caption}
                  disabled={!canEdit}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-[13px] text-gray-900 disabled:bg-gray-50"
                />
              </label>
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!dirty || !!busy}
                  onClick={() => call("save", { url: `${DPR.PHOTOS}/${photo.id}`, method: "PUT", data: { caption, subLocation } })}
                  className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-3 h-8 text-[12.5px] font-medium text-white disabled:opacity-50"
                >
                  {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Save
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => call("ai", { url: `${DPR.REANALYSE}/${photo.id}/reanalyse`, method: "POST" })}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 h-8 text-[12.5px] disabled:opacity-50"
                >
                  {busy === "ai" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Read again
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    if (window.confirm("Delete this photo?"))
                      call("del", { url: `${DPR.PHOTOS}/${photo.id}`, method: "DELETE" }, onClose);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 text-red-600 px-3 h-8 text-[12.5px] disabled:opacity-50"
                >
                  {busy === "del" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
