"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import {
  misTaskApi, TASK_PRIORITIES, TASK_STATUSES, currentProject,
} from "@/lib/misTasks";

const EMPTY = {
  title: "", description: "", priority: "Medium", status: "To Do",
  projectCode: "", ownerUserId: "", startDate: "", dueDate: "",
  estimatedHours: "", actualHours: "", tags: "",
};

const inputCls =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50";

function Field({ label, required, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Create / edit a task.
 *   task      — existing task to edit (null = create)
 *   access    — { isSuperAdmin, canEditOthers } from /mis/tasks/access
 *   defaults  — prefill for create (e.g. { ownerUserId })
 */
export default function TaskFormDialog({ open, onClose, task = null, access = {}, defaults = {}, onSaved }) {
  const isEdit = !!task;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [projects, setProjects] = useState([]);

  const canAssign = !!(access.isSuperAdmin || access.canEditOthers);

  // reset whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        ...EMPTY,
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "Medium",
        status: task.status || "To Do",
        projectCode: task.projectCode || "",
        ownerUserId: task.ownerUserId ? String(task.ownerUserId) : "",
        startDate: task.startDate || "",
        dueDate: task.dueDate || "",
        estimatedHours: task.estimatedHours ?? "",
        actualHours: task.actualHours ?? "",
        tags: (task.tags || []).join(", "),
      });
    } else {
      const cp = currentProject();
      setForm({ ...EMPTY, projectCode: cp?.code || "", ...defaults,
        ownerUserId: defaults.ownerUserId ? String(defaults.ownerUserId) : "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  // project options: company + current project (+ every project for super admin)
  useEffect(() => {
    if (!open) return;
    const cp = currentProject();
    const base = [{ value: "", label: "Company (no project)" }];
    if (cp) base.push({ value: cp.code, label: `${cp.code} : ${cp.name}` });
    if (task?.projectCode && task.projectCode !== cp?.code) {
      base.push({ value: task.projectCode, label: `${task.projectCode} : ${task.projectName || ""}` });
    }
    setProjects(base);
    if (!access.isSuperAdmin) return;
    apiRequest({ url: API_ENDPOINTS.SETTINGS?.GET_ALL_PROJECTS || "/setting/project-list" })
      .then((r) => {
        const list = (r?.data || []).map((p) => ({ value: p.projectCode, label: `${p.projectCode} : ${p.projectName || ""}` }));
        const seen = new Set();
        setProjects([...base, ...list].filter((o) => (seen.has(o.value) ? false : seen.add(o.value))));
      })
      .catch(() => {});
  }, [open, access.isSuperAdmin, task]);

  // assignee options follow the chosen project
  useEffect(() => {
    if (!open || !canAssign) return;
    let alive = true;
    setUsersLoading(true);
    misTaskApi.assignable(form.projectCode || undefined)
      .then((r) => alive && setUsers((r?.data || []).map((u) => ({
        value: String(u.id), label: u.empCode ? `${u.name} (${u.empCode})` : u.name,
      }))))
      .catch(() => alive && setUsers([]))
      .finally(() => alive && setUsersLoading(false));
    return () => { alive = false; };
  }, [open, canAssign, form.projectCode]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const dateError = useMemo(
    () => form.startDate && form.dueDate && form.dueDate < form.startDate ? "Due date is before start date" : "",
    [form.startDate, form.dueDate],
  );

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (dateError) return toast.error(dateError);
    const payload = {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      projectCode: form.projectCode || null,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      estimatedHours: form.estimatedHours === "" ? null : Number(form.estimatedHours),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    if (canAssign && form.ownerUserId) payload.ownerUserId = Number(form.ownerUserId);
    if (isEdit) {
      payload.status = form.status;
      payload.actualHours = form.actualHours === "" ? null : Number(form.actualHours);
    }
    setSaving(true);
    try {
      const r = isEdit ? await misTaskApi.update(task.id, payload) : await misTaskApi.create(payload);
      toast.success(isEdit ? "Task updated" : "Task created");
      onSaved?.(r?.data);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Could not save task");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9995] flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog" data-state="open"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-2xl my-8 flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">
            {isEdit ? `Edit Task · ${task.taskCode}` : "New Task"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Title" required className="sm:col-span-2">
            <input autoFocus maxLength={200} value={form.title} onChange={set("title")} className={inputCls}
              placeholder="What needs to be done?" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea rows={3} value={form.description} onChange={set("description")} className={inputCls} />
          </Field>

          <Field label="Priority">
            <select value={form.priority} onChange={set("priority")} className={inputCls}>
              {TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          {isEdit ? (
            <Field label="Status">
              <select value={form.status} onChange={set("status")} className={inputCls}>
                {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label="Project">
            <SearchableSelect options={projects} value={form.projectCode}
              onChange={(v) => setForm((f) => ({ ...f, projectCode: v ?? "" }))} placeholder="Company (no project)" />
          </Field>
          {canAssign ? (
            <Field label="Assign to">
              <SearchableSelect options={users} value={form.ownerUserId} loading={usersLoading} clearLabel="Myself"
                onChange={(v) => setForm((f) => ({ ...f, ownerUserId: v ?? "" }))} placeholder="Myself" />
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label="Start date">
            <input type="date" value={form.startDate} onChange={set("startDate")} className={inputCls} />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.dueDate} onChange={set("dueDate")} className={inputCls} />
            {dateError && <span className="text-[11px] text-red-600">{dateError}</span>}
          </Field>

          <Field label="Estimated hours">
            <input type="number" min="0" step="0.25" value={form.estimatedHours} onChange={set("estimatedHours")} className={inputCls} />
          </Field>
          {isEdit ? (
            <Field label="Actual hours">
              <input type="number" min="0" step="0.25" value={form.actualHours} onChange={set("actualHours")} className={inputCls} />
            </Field>
          ) : <div className="hidden sm:block" />}

          <Field label="Tags (comma separated)" className="sm:col-span-2">
            <input value={form.tags} onChange={set("tags")} className={inputCls} placeholder="e.g. billing, site visit" />
          </Field>
          {canAssign && form.ownerUserId && !isEdit && (
            <p className="sm:col-span-2 text-[11px] text-gray-500">
              The assignee gets a WhatsApp message with the task details.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50">Cancel</button>
          <button type="submit" data-shortcut="submit" disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
