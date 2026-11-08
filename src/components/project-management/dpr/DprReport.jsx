"use client";

// The day's report: write it with AI, edit it, submit it for approval.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Send, Sparkles, Trash2, Save } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { SEVERITY_STYLE, STATUS_STYLE } from "@/lib/dpr";

const DPR = API_ENDPOINTS.PROJECT.DPR;

const Section = ({ title, children, right }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <h3 className="text-[12.5px] font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const fieldCls = "rounded border border-gray-300 px-2 py-1 text-[13px] outline-none focus:border-blue-400 disabled:bg-gray-50";
const inputCls = `w-full ${fieldCls}`;

const toDraft = (r) => ({
  summary: r?.summary || "",
  remarks: r?.remarks || "",
  weather: r?.weather || "",
  work_done: (r?.content?.work_done || []).map((w) => ({ ...w })),
  issues: [...(r?.content?.issues || [])],
  manpowerTotal: r?.content?.manpower?.total ?? r?.manpowerTotal ?? "",
});

export default function DprReport({ projectCode, date, report, photos, canEdit, onChanged, onOpenPhoto }) {
  const [draft, setDraft] = useState(() => toDraft(report));
  const [busy, setBusy] = useState(null);

  const editable = canEdit && report && ["Draft", "Reback"].includes(report.workflowStatus);
  const canGenerate = canEdit && (!report || ["Draft", "Reback", "Rejected"].includes(report.workflowStatus));
  const waiting = photos.filter((p) => p.aiStatus === "pending" || p.aiStatus === "working").length;
  const photoById = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, p])), [photos]);
  const dirty = report && JSON.stringify(draft) !== JSON.stringify(toDraft(report));

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const generate = async () => {
    if (report?.edited && !window.confirm("Write the report again with AI? Your edits will be replaced.")) return;
    setBusy("gen");
    const id = toast.loading("AI is writing the report…");
    try {
      const res = await apiRequest({ url: DPR.GENERATE, method: "POST", data: { projectCode, date } });
      toast.success(res?.message || "Report written", { id });
      onChanged?.();
    } catch (e) {
      toast.error(e.message || "Could not write the report", { id });
    } finally {
      setBusy(null);
    }
  };

  const save = async (quiet = false) => {
    setBusy("save");
    try {
      const mp = { ...(report.content?.manpower || {}), total: Number(draft.manpowerTotal) || 0 };
      await apiRequest({
        url: `${DPR.UPDATE}/${report.id}`,
        method: "PUT",
        data: {
          summary: draft.summary,
          remarks: draft.remarks,
          weather: draft.weather,
          content: {
            work_done: draft.work_done.filter((w) => (w.area || w.description || "").trim()),
            issues: draft.issues.map((s) => s.trim()).filter(Boolean),
            manpower: mp,
          },
        },
      });
      if (!quiet) toast.success("Report saved");
      return true;
    } catch (e) {
      toast.error(e.message || "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (dirty && !(await save(true))) return;
    if (!window.confirm("Submit this report for approval? It can't be changed after that.")) return;
    setBusy("submit");
    try {
      const res = await apiRequest({ url: `${DPR.SUBMIT}/${report.id}`, method: "POST" });
      toast.success(res?.message || "Submitted");
      onChanged?.(true);
    } catch (e) {
      toast.error(e.message || "Could not submit");
    } finally {
      setBusy(null);
    }
  };

  const PhotoRefs = ({ ids }) =>
    ids?.length ? (
      <span className="inline-flex gap-1 ml-1 align-middle">
        {ids.slice(0, 5).map((id) =>
          photoById[id] ? (
            <button key={id} type="button" onClick={() => onOpenPhoto(photoById[id])} title="Open photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoById[id].thumbUrl} alt="" className="w-7 h-7 rounded object-cover border border-gray-200" />
            </button>
          ) : null,
        )}
      </span>
    ) : null;

  if (!report) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-center space-y-3">
        <Sparkles className="mx-auto text-[#2563EB]" />
        <p className="text-sm text-gray-700">
          No report for this day yet. Add the day&apos;s photos, then let AI write the report from them and the site
          records. It is also written automatically every evening.
        </p>
        {canGenerate && (
          <button
            type="button"
            onClick={generate}
            disabled={!!busy || (!photos.length) || waiting > 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#2563EB] px-4 h-9 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "gen" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Write report with AI
          </button>
        )}
        {waiting > 0 && <p className="text-[11.5px] text-gray-500">Waiting for AI to read {waiting} photo(s)…</p>}
      </div>
    );
  }

  const c = report.content || {};
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{report.dprNo}</span>
          <span className={`rounded px-2 py-[1px] text-[11.5px] font-medium ${STATUS_STYLE(report.workflowStatus)}`}>
            {report.workflowStatus.replace("_", " ")}
          </span>
          {report.edited && <span className="text-[11px] text-gray-500">edited</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canGenerate && (
            <button
              type="button"
              onClick={generate}
              disabled={!!busy || waiting > 0}
              title={waiting ? "Wait for AI to finish reading the photos" : "Write the report again from the latest photos"}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 h-8 text-[12.5px] disabled:opacity-50"
            >
              {busy === "gen" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Rewrite with AI
            </button>
          )}
          {editable && (
            <>
              <button
                type="button"
                onClick={async () => (await save()) && onChanged?.()}
                disabled={!dirty || !!busy}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 h-8 text-[12.5px] disabled:opacity-50"
              >
                {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-3 h-8 text-[12.5px] font-medium text-white disabled:opacity-50"
              >
                {busy === "submit" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit
              </button>
            </>
          )}
        </div>
      </div>

      <Section title="Summary">
        {editable ? (
          <textarea rows={3} value={draft.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} />
        ) : (
          <p className="text-[13.5px] text-gray-900 whitespace-pre-line">{report.summary}</p>
        )}
      </Section>

      <Section
        title="Work done"
        right={editable && (
          <button type="button" onClick={() => set("work_done", [...draft.work_done, { area: "", description: "", photo_ids: [] }])}
            className="inline-flex items-center gap-0.5 text-[12px] text-blue-600"><Plus size={13} /> Add</button>
        )}
      >
        {(editable ? draft.work_done : c.work_done || []).length === 0 && <p className="text-[12.5px] text-gray-400">—</p>}
        <div className="space-y-1.5">
          {(editable ? draft.work_done : c.work_done || []).map((w, i) =>
            editable ? (
              <div key={i} className="flex gap-1.5 items-start">
                <input value={w.area} placeholder="Area" onChange={(e) => set("work_done", draft.work_done.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))}
                  className={`${fieldCls} w-[32%] shrink-0 min-w-0`} />
                <textarea rows={1} value={w.description} placeholder="What was done"
                  onChange={(e) => set("work_done", draft.work_done.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  className={`${fieldCls} flex-1 min-w-0 resize-y`} />
                <button type="button" onClick={() => set("work_done", draft.work_done.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div key={i} className="text-[13px]">
                <b className="text-gray-900">{w.area}</b>
                <span className="text-gray-700"> — {w.description}</span>
                <PhotoRefs ids={w.photo_ids} />
              </div>
            ),
          )}
        </div>
      </Section>

      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Manpower">
          <div className="text-[13px] space-y-0.5">
            <div>
              Total:{" "}
              {editable ? (
                <input type="number" min={0} value={draft.manpowerTotal} onChange={(e) => set("manpowerTotal", e.target.value)}
                  className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-[13px]" />
              ) : (
                <b>{c.manpower?.total ?? report.manpowerTotal ?? "—"}</b>
              )}
            </div>
            {(c.manpower?.by_category || []).map((m) => (
              <div key={m.category} className="text-gray-700">{m.category}: {m.count}</div>
            ))}
            {c.manpower?.note && <div className="text-[11.5px] text-gray-500">{c.manpower.note}</div>}
          </div>
        </Section>
        <Section title="Weather">
          {editable ? (
            <input value={draft.weather} onChange={(e) => set("weather", e.target.value)} className={inputCls} />
          ) : (
            <p className="text-[13px]">{report.weather || "—"}</p>
          )}
        </Section>
      </div>

      {(c.machinery?.length > 0 || c.materials?.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Section title="Machinery">
            {(c.machinery || []).map((m, i) => (
              <div key={i} className="text-[13px]"><b>{m.name}</b>{m.note ? <span className="text-gray-600"> — {m.note}</span> : null}</div>
            ))}
            {!c.machinery?.length && <p className="text-[12.5px] text-gray-400">—</p>}
          </Section>
          <Section title="Materials">
            {(c.materials || []).map((m, i) => (
              <div key={i} className="text-[13px]">
                <b>{m.item}</b> {m.quantity && m.quantity !== "-" ? <span>· {m.quantity}</span> : null}
                {m.note ? <span className="text-gray-600"> — {m.note}</span> : null}
              </div>
            ))}
            {!c.materials?.length && <p className="text-[12.5px] text-gray-400">—</p>}
          </Section>
        </div>
      )}

      <Section
        title="Issues & hindrances"
        right={editable && (
          <button type="button" onClick={() => set("issues", [...draft.issues, ""])} className="inline-flex items-center gap-0.5 text-[12px] text-blue-600">
            <Plus size={13} /> Add
          </button>
        )}
      >
        {(editable ? draft.issues : c.issues || []).length === 0 && <p className="text-[12.5px] text-gray-400">None</p>}
        {(editable ? draft.issues : c.issues || []).map((s, i) =>
          editable ? (
            <div key={i} className="flex gap-1.5">
              <input value={s} onChange={(e) => set("issues", draft.issues.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
              <button type="button" onClick={() => set("issues", draft.issues.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div key={i} className="text-[13px]">• {s}</div>
          ),
        )}
      </Section>

      <Section title="Safety">
        {!(c.safety || []).length && <p className="text-[12.5px] text-gray-400">No safety issues seen in photos</p>}
        <div className="space-y-1">
          {(c.safety || []).map((s, i) => (
            <div key={i} className={`rounded border px-2 py-1 text-[12.5px] ${SEVERITY_STYLE[s.severity] || SEVERITY_STYLE.low}`}>
              <b className="uppercase text-[10.5px] mr-1">{s.severity}</b> {s.issue}
              <PhotoRefs ids={s.photo_ids} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Engineer's remarks">
        {editable ? (
          <textarea rows={2} value={draft.remarks} placeholder="Anything to add (plan for tomorrow, requirements…)"
            onChange={(e) => set("remarks", e.target.value)} className={inputCls} />
        ) : (
          <p className="text-[13px] whitespace-pre-line">{report.remarks || "—"}</p>
        )}
      </Section>

      <p className="text-[10.5px] text-gray-400">
        Written by AI ({report.generatedBy === "auto" ? "evening auto-draft" : "on request"}) from the day&apos;s photos and site
        records — check it before submitting.
      </p>
    </div>
  );
}
