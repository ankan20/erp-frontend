"use client";

// Issues & Feature Requests: a simple list. Editors add / edit / delete items,
// developers tick them done (comment + pictures), super admin manages who is who
// and the kill switch.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Loader2, X, ImagePlus } from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { refreshIssueTrackerStatus } from "@/lib/issueTrackerStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RichTextEditor, { RICH_CLASS } from "./RichTextEditor";

const EP = API_ENDPOINTS.ISSUE_TRACKER;
const KIND_LABEL = { ISSUE: "Issue", FEATURE: "Feature request" };
const KIND_CLASS = { ISSUE: "bg-red-100 text-red-700", FEATURE: "bg-blue-100 text-blue-700" };

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

const btn = "inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${btn} bg-[#4f86b9] text-white hover:bg-[#3f76a9]`;
const BTN_PLAIN = `${btn} border border-gray-300 bg-white hover:bg-gray-50`;

export default function IssueTracker({ status }) {
  const { enabled, isSuperAdmin, canEdit, isDeveloper } = status;
  const [filter, setFilter] = useState("open");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} new | item
  const [doneFor, setDoneFor] = useState(null); // item whose done dialog is open

  const load = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return apiRequest({ url: EP.ITEMS, params: { status: filter } })
      .then((r) => setItems(r?.data?.items || []))
      .catch((e) => toast.error(e.message || "Could not load the list"))
      .finally(() => setLoading(false));
  }, [enabled, filter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (it) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await apiRequest({ url: `${EP.ITEMS}/${it.id}`, method: "DELETE" });
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-3 space-y-3 max-w-5xl">
      {isSuperAdmin && <AdminPanel enabled={enabled} />}

      {!enabled ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This feature is <b>off</b>. Nobody else can see it. Turn it on above to use the list again.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded border border-gray-300 overflow-hidden text-sm">
              {["open", "done", "all"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setLoading(true); setFilter(f); }}
                  className={`px-3 py-1.5 capitalize cursor-pointer ${filter === f ? "bg-[#4f86b9] text-white" : "bg-white hover:bg-gray-50"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {canEdit && !editing && (
              <button type="button" className={BTN_PRIMARY} onClick={() => setEditing({})}>
                <Plus size={15} /> Add issue / request
              </button>
            )}
          </div>

          {editing && !editing.id && (
            <ItemForm onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6"><Loader2 className="animate-spin" size={16} /> Loading…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500 py-6">Nothing here.</div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className={`rounded border bg-white p-3 flex gap-3 ${it.isDone ? "border-green-300 bg-green-50/40" : "border-gray-200"}`}>
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      aria-label="Done"
                      title={isDeveloper ? (it.isDone ? "Done — click to change" : "Mark done") : "Only developers can tick"}
                      checked={it.isDone}
                      disabled={!isDeveloper}
                      onChange={() => setDoneFor(it)}
                      className="h-5 w-5 accent-green-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {editing?.id === it.id ? (
                      <ItemForm item={it} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">#{it.id}</span>
                          <span className={`px-1.5 py-0.5 rounded ${KIND_CLASS[it.kind]}`}>{KIND_LABEL[it.kind]}</span>
                          <span>by {it.createdByName || "—"} · {fmt(it.createdTs || it.createdAt)}</span>
                          {it.updatedAt && <span>(edited by {it.updatedByName} · {fmt(it.updatedAt)})</span>}
                        </div>
                        <div className={`${RICH_CLASS} ${it.isDone ? "text-gray-500" : ""}`} dangerouslySetInnerHTML={{ __html: it.bodyHtml }} />
                        {it.isDone && <DoneInfo it={it} />}
                      </>
                    )}
                  </div>

                  {canEdit && editing?.id !== it.id && (
                    <div className="flex items-start gap-1">
                      <button type="button" title="Edit" className="p-1.5 rounded hover:bg-gray-100 cursor-pointer" onClick={() => setEditing(it)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" title="Delete" className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer" onClick={() => remove(it)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {doneFor && (
        <DoneDialog item={doneFor} onClose={() => setDoneFor(null)} onSaved={() => { setDoneFor(null); load(); }} />
      )}
    </div>
  );
}

function DoneInfo({ it }) {
  return (
    <div className="mt-2 rounded bg-green-50 border border-green-200 px-2 py-1.5 text-sm space-y-1">
      <div className="text-xs text-green-800">✔ Done by <b>{it.doneByName || "—"}</b> · {fmt(it.doneAt)}</div>
      {it.doneComment && <div className="whitespace-pre-wrap">{it.doneComment}</div>}
      {it.doneImages.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {it.doneImages.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-20 w-20 object-cover rounded border border-gray-200" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemForm({ item, onCancel, onSaved }) {
  const [kind, setKind] = useState(item?.kind || "ISSUE");
  const [html, setHtml] = useState(item?.bodyHtml || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest({
        url: item ? `${EP.ITEMS}/${item.id}` : EP.ITEMS,
        method: item ? "PUT" : "POST",
        data: { kind, bodyHtml: html },
      });
      toast.success(item ? "Saved" : "Added");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-2 space-y-2">
      <div className="flex gap-3 text-sm">
        {Object.entries(KIND_LABEL).map(([k, label]) => (
          <label key={k} className="inline-flex items-center gap-1 cursor-pointer">
            <input type="radio" name={`kind-${item?.id || "new"}`} checked={kind === k} onChange={() => setKind(k)} /> {label}
          </label>
        ))}
      </div>
      <RichTextEditor initialHtml={item?.bodyHtml} onChange={setHtml} placeholder="Describe the issue or the feature…" />
      <div className="flex gap-2 justify-end">
        <button type="button" className={BTN_PLAIN} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" size={14} />} {item ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}

function DoneDialog({ item, onClose, onSaved }) {
  const [comment, setComment] = useState(item.doneComment || "");
  const [keep, setKeep] = useState(item.doneImages || []);
  const [files, setFiles] = useState([]); // [{ file, url }]
  const [busy, setBusy] = useState(false);

  const previews = useRef([]); // object URLs, freed when the dialog closes
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = (list) => {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith("image/"));
    const added = picked.map((file) => ({ file, url: URL.createObjectURL(file) }));
    previews.current.push(...added.map((f) => f.url));
    setFiles((prev) => [...prev, ...added]);
  };

  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("comment", comment);
      fd.append("keepImages", JSON.stringify(keep));
      files.forEach((f) => fd.append("images", f.file));
      await apiRequest({ url: `${EP.ITEMS}/${item.id}/done`, method: "POST", data: fd });
      toast.success("Marked done");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const untick = async () => {
    setBusy(true);
    try {
      await apiRequest({ url: `${EP.ITEMS}/${item.id}/done`, method: "DELETE" });
      toast.success("Marked not done");
      onSaved();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const thumbs = [...keep.map((u) => ({ key: u, url: u, drop: () => setKeep(keep.filter((x) => x !== u)) })),
    ...files.map((f) => ({ key: f.url, url: f.url, drop: () => setFiles(files.filter((x) => x !== f)) }))];

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item.isDone ? "Done — details" : "Mark as done"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className={`${RICH_CLASS} max-h-28 overflow-y-auto rounded bg-gray-50 p-2 text-gray-600`} dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
          <label className="block text-sm">
            <span className="font-medium">Comment</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="What was done (optional)"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#4f86b9]"
            />
          </label>
          <div className="space-y-1">
            <span className="text-sm font-medium">Pictures</span>
            <div className="flex flex-wrap gap-2">
              {thumbs.map((t) => (
                <div key={t.key} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.url} alt="" className="h-20 w-20 object-cover rounded border border-gray-200" />
                  <button type="button" title="Remove" onClick={t.drop}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-white border border-gray-300 p-0.5 cursor-pointer hover:bg-red-50">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {thumbs.length < 6 && (
                <label className="h-20 w-20 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-500 cursor-pointer hover:bg-gray-50">
                  <ImagePlus size={18} /> Add
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400">Up to 6 pictures, 5 MB each.</p>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            {item.isDone && (
              <button type="button" className={`${BTN_PLAIN} text-red-600 mr-auto`} onClick={untick} disabled={busy}>Mark not done</button>
            )}
            <button type="button" className={BTN_PLAIN} onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={save} disabled={busy}>
              {busy && <Loader2 className="animate-spin" size={14} />} {item.isDone ? "Save" : "Mark done"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── super admin: kill switch + who can do what ─────────────────────────────
function AdminPanel({ enabled }) {
  const [open, setOpen] = useState(!enabled);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => apiRequest({ url: EP.MEMBERS })
    .then((r) => { setMembers(r?.data?.members || []); setUsers(r?.data?.users || []); })
    .catch((e) => toast.error(e.message)), []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const toggleFeature = async () => {
    if (enabled && !window.confirm("Turn this feature off for everyone?")) return;
    setBusy(true);
    try {
      await apiRequest({ url: EP.SETTINGS, method: "PUT", data: { enabled: !enabled } });
      toast.success(enabled ? "Turned off" : "Turned on");
      await refreshIssueTrackerStatus();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const save = async (userId, canEdit, isDeveloper) => {
    try {
      await apiRequest({ url: EP.MEMBERS, method: "POST", data: { userId, canEdit, isDeveloper } });
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const removeMember = async (userId) => {
    try {
      await apiRequest({ url: `${EP.MEMBERS}/${userId}`, method: "DELETE" });
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <div className="rounded border border-gray-300 bg-white">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-sm font-semibold">Super admin settings</span>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <span>Feature</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={toggleFeature}
            className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${enabled ? "bg-green-600" : "bg-gray-400"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
          </button>
          <b className={enabled ? "text-green-700" : "text-gray-600"}>{enabled ? "ON" : "OFF"}</b>
        </label>
        <div className="flex-1" />
        <button type="button" className={BTN_PLAIN} onClick={() => setOpen(!open)}>
          {open ? "Hide users" : "Users"}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-200 px-3 py-2 space-y-2">
          <p className="text-xs text-gray-500">
            Only users listed here can open this page. <b>Create / edit list</b> = add, edit, delete items.
            <b> Developer</b> = tick items done. Neither = view only. Super admin can always do everything.
          </p>
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 max-w-sm rounded border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Add a user…</option>
              {users.filter((u) => !memberIds.has(u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.name}{u.empCode ? ` (${u.empCode})` : ""}</option>
              ))}
            </select>
            <button type="button" className={BTN_PRIMARY} disabled={!pick}
              onClick={async () => { await save(Number(pick), false, false); setPick(""); }}>
              <Plus size={15} /> Add
            </button>
          </div>
          {members.length > 0 && (
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-1">User</th>
                  <th className="py-1 text-center">Create / edit list</th>
                  <th className="py-1 text-center">Developer</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-b last:border-b-0">
                    <td className="py-1">{m.name}</td>
                    <td className="py-1 text-center">
                      <input type="checkbox" aria-label={`${m.name} can create / edit`} checked={m.canEdit}
                        onChange={() => save(m.userId, !m.canEdit, m.isDeveloper)} className="h-4 w-4 cursor-pointer" />
                    </td>
                    <td className="py-1 text-center">
                      <input type="checkbox" aria-label={`${m.name} is developer`} checked={m.isDeveloper}
                        onChange={() => save(m.userId, m.canEdit, !m.isDeveloper)} className="h-4 w-4 cursor-pointer" />
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" title="Remove" className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer" onClick={() => removeMember(m.userId)}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
