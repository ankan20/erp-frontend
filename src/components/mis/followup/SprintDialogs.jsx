"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MisModal, Field, inputCls, btnPrimary, btnSecondary } from "@/components/mis/MisModal";
import { sprintApi, SPRINT_TYPES } from "@/lib/misFollowups";
import { todayISO } from "@/lib/misTasks";

/** Monday–Sunday / 1st–last day preview (the server applies the same rule). */
function windowFor(type, startISO) {
  if (!startISO) return null;
  const [y, m, d] = startISO.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  let s, e;
  if (type === "Monthly") {
    s = new Date(Date.UTC(y, m - 1, 1));
    e = new Date(Date.UTC(y, m, 0));
  } else {
    const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
    s = new Date(start.getTime() - dow * 86400000);
    e = new Date(s.getTime() + 6 * 86400000);
  }
  const f = (x) => x.toISOString().slice(0, 10);
  return { start: f(s), end: f(e) };
}

export function SprintFormDialog({ open, onClose, projectCode, projectLabel, sprint = null, onSaved }) {
  const isEdit = !!sprint;
  const [form, setForm] = useState({ sprintType: "Weekly", startDate: todayISO(), endDate: "", name: "", goal: "", start: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(sprint
      ? { sprintType: sprint.sprintType, startDate: sprint.startDate, endDate: sprint.endDate, name: sprint.name, goal: sprint.goal || "", start: false }
      : { sprintType: "Weekly", startDate: todayISO(), endDate: "", name: "", goal: "", start: true });
  }, [open, sprint]);

  const preview = useMemo(() => (!isEdit && !form.endDate ? windowFor(form.sprintType, form.startDate) : null),
    [isEdit, form.endDate, form.sprintType, form.startDate]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      const r = isEdit
        ? await sprintApi.update(sprint.id, { name: form.name, goal: form.goal, startDate: form.startDate, endDate: form.endDate })
        : await sprintApi.create({
          projectCode: projectCode && projectCode !== "company" ? projectCode : null,
          sprintType: form.sprintType, startDate: form.startDate, endDate: form.endDate || null,
          name: form.name || null, goal: form.goal || null, start: form.start,
        });
      toast.success(isEdit ? "Sprint updated" : "Sprint created");
      onSaved?.(r?.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not save sprint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MisModal open={open} onClose={onClose} onSubmit={submit} title={isEdit ? `Edit sprint · ${sprint.name}` : "New Sprint"}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>
          {saving && <Loader2 size={14} className="animate-spin" />}{isEdit ? "Save" : "Create sprint"}
        </button>
      </>}>
      <p className="text-xs text-gray-500">Project: <b className="text-gray-700">{projectLabel || "Company"}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <div className="flex rounded-md border border-gray-300 overflow-hidden" role="radiogroup" aria-label="Sprint type">
            {SPRINT_TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={form.sprintType === t} disabled={isEdit}
                onClick={() => setForm((f) => ({ ...f, sprintType: t }))}
                className={`flex-1 py-2 text-sm ${form.sprintType === t ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"} disabled:opacity-60`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={set("name")} maxLength={120} className={inputCls} placeholder="Auto (e.g. Week 47)" />
        </Field>
        <Field label="Start" required>
          <input type="date" value={form.startDate} onChange={set("startDate")} className={inputCls} required />
        </Field>
        <Field label="End">
          <input type="date" value={form.endDate} onChange={set("endDate")} className={inputCls} placeholder="auto" />
        </Field>
      </div>
      {preview && (
        <p className="text-[11px] text-gray-500">
          Leave End empty → {form.sprintType === "Weekly" ? "Monday to Sunday" : "whole month"}: <b>{preview.start}</b> to <b>{preview.end}</b>
        </p>
      )}
      <Field label="Sprint goal">
        <textarea rows={2} value={form.goal} onChange={set("goal")} className={inputCls} placeholder="What should be finished by the end?" />
      </Field>
      {!isEdit && (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.start} onChange={set("start")} className="accent-blue-600" /> Start it now
        </label>
      )}
    </MisModal>
  );
}

export function CloseSprintDialog({ open, onClose, sprint, otherSprints = [], onClosed }) {
  const [moveTo, setMoveTo] = useState("backlog");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setMoveTo("backlog"); }, [open]);
  if (!sprint) return null;
  const open_ = (sprint.agendaCount ?? 0) - (sprint.doneCount ?? 0);
  const targets = otherSprints.filter((s) => s.id !== sprint.id && s.status !== "Closed");

  const submit = async () => {
    setSaving(true);
    try {
      const r = await sprintApi.close(sprint.id, moveTo);
      toast.success(`Sprint closed · ${r?.data?.movedCount ?? 0} item(s) moved`);
      onClosed?.(r?.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not close sprint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MisModal open={open} onClose={onClose} onSubmit={submit} title={`Close ${sprint.name}`}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>
          {saving && <Loader2 size={14} className="animate-spin" />}Close sprint
        </button>
      </>}>
      <p className="text-sm text-gray-700">
        {sprint.doneCount ?? 0} of {sprint.agendaCount ?? 0} done.{" "}
        {open_ > 0 ? <>Where should the <b>{open_} unfinished</b> item(s) go?</> : "Everything is finished."}
      </p>
      {open_ > 0 && (
        <Field label="Move unfinished to">
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={inputCls}>
            <option value="backlog">Backlog</option>
            {targets.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}
          </select>
        </Field>
      )}
    </MisModal>
  );
}
