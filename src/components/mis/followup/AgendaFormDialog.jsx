"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import { MisModal, Field, inputCls, btnPrimary, btnSecondary } from "@/components/mis/MisModal";
import { followupApi, FU_PRIORITIES } from "@/lib/misFollowups";

const EMPTY = {
  title: "", description: "", priority: "Medium", dueDate: "", storyPoints: "",
  sprintId: "", assigneeUserId: "", instruction: "", stepDueDate: "", supervisorUserId: "",
};

/**
 * Create / edit an agenda.
 *   projectCode — board's project ("" / "company" = company level)
 *   sprints     — open sprints of that project [{id, name, status}]
 *   users       — assignable users [{value, label}]
 *   agenda      — existing agenda (edit)
 *   defaultSprintId — preselect when creating from a sprint board
 */
export default function AgendaFormDialog({ open, onClose, projectCode, projectLabel, sprints = [], users = [], agenda = null, defaultSprintId, onSaved }) {
  const isEdit = !!agenda;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(agenda ? {
      ...EMPTY,
      title: agenda.title || "",
      description: agenda.description || "",
      priority: agenda.priority || "Medium",
      dueDate: agenda.dueDate || "",
      storyPoints: agenda.storyPoints ?? "",
      supervisorUserId: agenda.supervisorUserId ? String(agenda.supervisorUserId) : "",
    } : { ...EMPTY, sprintId: defaultSprintId ? String(defaultSprintId) : "" });
  }, [open, agenda, defaultSprintId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e ?? "" }));

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const base = {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      dueDate: form.dueDate || null,
      storyPoints: form.storyPoints === "" ? null : Number(form.storyPoints),
    };
    setSaving(true);
    try {
      let r;
      if (isEdit) {
        if (form.supervisorUserId) base.supervisorUserId = Number(form.supervisorUserId);
        r = await followupApi.update(agenda.id, base);
        toast.success("Follow-up updated");
      } else {
        r = await followupApi.create({
          ...base,
          projectCode: projectCode && projectCode !== "company" ? projectCode : null,
          sprintId: form.sprintId ? Number(form.sprintId) : null,
          assigneeUserId: form.assigneeUserId ? Number(form.assigneeUserId) : null,
          instruction: form.instruction || null,
          stepDueDate: form.stepDueDate || null,
        });
        toast.success(form.assigneeUserId ? "Follow-up created and assigned" : "Follow-up created");
      }
      onSaved?.(r?.data);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const sprintOptions = [
    { value: "", label: "Backlog (no sprint)" },
    ...sprints.filter((s) => s.status !== "Closed").map((s) => ({ value: String(s.id), label: `${s.name} · ${s.status}` })),
  ];

  return (
    <MisModal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      maxWidth="max-w-2xl"
      title={isEdit ? `Edit · ${agenda.fuCode}` : "New Follow-up"}
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        <button type="submit" data-shortcut="submit" disabled={saving} className={btnPrimary}>
          {saving && <Loader2 size={14} className="animate-spin" />}{isEdit ? "Save changes" : "Create"}
        </button>
      </>}
    >
      <p className="text-xs text-gray-500">Project: <b className="text-gray-700">{projectLabel || "Company"}</b></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Agenda" required className="sm:col-span-2">
          <input autoFocus maxLength={200} value={form.title} onChange={set("title")} className={inputCls}
            placeholder="e.g. Get revised drawing approved by client" />
        </Field>
        <Field label="Details" className="sm:col-span-2">
          <textarea rows={3} value={form.description} onChange={set("description")} className={inputCls} />
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={set("priority")} className={inputCls}>
            {FU_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Target date">
          <input type="date" value={form.dueDate} onChange={set("dueDate")} className={inputCls} />
        </Field>
        <Field label="Story points">
          <input type="number" min="0" step="1" value={form.storyPoints} onChange={set("storyPoints")} className={inputCls}
            placeholder="effort, e.g. 1 / 3 / 5" />
        </Field>
        {isEdit ? (
          <Field label="Supervisor">
            <SearchableSelect options={users} value={form.supervisorUserId} onChange={set("supervisorUserId")} placeholder="Supervisor" />
          </Field>
        ) : (
          <Field label="Sprint">
            <SearchableSelect options={sprintOptions} value={form.sprintId} onChange={set("sprintId")} placeholder="Backlog (no sprint)" />
          </Field>
        )}
      </div>

      {!isEdit && (
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-3">
          <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">First step (optional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Assign to">
              <SearchableSelect options={users} value={form.assigneeUserId} clearLabel="Nobody yet"
                onChange={set("assigneeUserId")} placeholder="Nobody yet" />
            </Field>
            <Field label="Step due">
              <input type="date" value={form.stepDueDate} onChange={set("stepDueDate")} className={inputCls} disabled={!form.assigneeUserId} />
            </Field>
            <Field label="Instruction" className="sm:col-span-2">
              <input value={form.instruction} onChange={set("instruction")} className={inputCls} disabled={!form.assigneeUserId}
                placeholder="What should this person do?" />
            </Field>
          </div>
          {form.assigneeUserId && <p className="text-[11px] text-gray-500">They get a WhatsApp message with the details.</p>}
        </div>
      )}
    </MisModal>
  );
}
