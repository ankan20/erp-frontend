"use client";

import { useEffect } from "react";
import { CalendarDays, HardHat, Loader2, MapPin, MessageCircle, Phone, User, X } from "lucide-react";
import { addDays, initials, todayStr } from "./shared";

const STATUSES = [
  { v: "Available",   dot: "bg-emerald-500" },
  { v: "Deployed",    dot: "bg-sky-500" },
  { v: "Follow-up",   dot: "bg-amber-500" },
  { v: "Pending",     dot: "bg-orange-500" },
  { v: "Unavailable", dot: "bg-rose-500" },
];

// neutral, shadcn-style inputs
const field =
  "w-full h-9 rounded-lg border border-zinc-200 bg-white text-[13px] text-zinc-900 placeholder:text-zinc-400 " +
  "transition focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";
const chip = (on) =>
  `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition ${
    on ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"}`;

function Label({ children, required, aside }) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <label className="text-[11px] font-medium text-zinc-500">{children}{required && <span className="text-rose-500"> *</span>}</label>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  );
}

function IconInput({ icon: Icon, className = "", ...props }) {
  return (
    <div className="relative">
      <Icon className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input {...props} className={`${field} pl-8 pr-2.5 ${className}`} />
    </div>
  );
}

/** Add / edit a gang member. `children` renders below the form (the "start a conversation" block). */
export default function MemberFormModal({
  open, onClose, isEdit, form, setForm, saving, onSave, skills, saveLabel, wide = false, children,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const name = form.name.trim();

  // "Other" = any trade not in the list; its name is optional free text (blank → saved as "Other")
  const presets = skills.filter((s) => s !== "Other");
  const isOther = !presets.includes(form.skill);
  const otherText = isOther && form.skill !== "Other" ? form.skill || "" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} my-8 rounded-xl bg-white shadow-xl ring-1 ring-zinc-900/10 overflow-hidden flex flex-col transition-[max-width] duration-200`}>

        {/* header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-100">
          <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center text-[13px] font-semibold ring-1 ring-zinc-200">
            {name ? initials(name) : <User className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-900 truncate">{isEdit ? "Edit member" : "Add gang member"}</h2>
            <p className="text-[11px] text-zinc-500 truncate">{[name, form.skill, form.status].filter(Boolean).join(" · ") || "Only the name is required"}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition" title="Close (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <div>
            <Label required>Full name</Label>
            <IconInput icon={User} autoFocus value={form.name} onChange={set("name")} placeholder="e.g. Raju Sharma" />
          </div>

          <div>
            <Label>Trade</Label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((s) => (
                <button key={s} type="button" onClick={() => set("skill")(s)} className={chip(form.skill === s)}>{s}</button>
              ))}
              <button type="button" onClick={() => set("skill")(otherText || "Other")} className={chip(isOther)}>Other</button>
            </div>
            {isOther && (
              <input value={otherText} onChange={(e) => set("skill")(e.target.value.trimStart() || "Other")} maxLength={100}
                placeholder="Which trade? (optional) — e.g. Tile fixer, Crane operator" className={`${field} px-2.5 mt-2`} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mobile</Label>
              <IconInput icon={Phone} type="tel" value={form.mobile || ""} onChange={set("mobile")} placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label aside={form.mobile && form.whatsapp !== form.mobile && (
                <button type="button" onClick={() => set("whatsapp")(form.mobile)} className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-900">same as mobile</button>
              )}>WhatsApp</Label>
              <IconInput icon={MessageCircle} type="tel" value={form.whatsapp || ""} onChange={set("whatsapp")} placeholder="+91 98765 43210" />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s.v} type="button" onClick={() => set("status")(s.v)} className={chip(form.status === s.v)}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.v}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Location</Label>
              <IconInput icon={MapPin} value={form.location || ""} onChange={set("location")} placeholder="Town" />
            </div>
            <div>
              <Label>Current site</Label>
              <IconInput icon={HardHat} value={form.site || ""} onChange={set("site")} placeholder="Site" />
            </div>
            <div>
              <Label aside={
                <span className="flex gap-1.5 text-[10px]">
                  {[["today", 0], ["+3d", 3], ["+7d", 7]].map(([l, n]) => {
                    const d = n ? addDays(n) : todayStr();
                    return <button key={l} type="button" onClick={() => set("followup")(d)}
                      className={form.followup === d ? "text-zinc-900 font-semibold" : "text-zinc-400 hover:text-zinc-700"}>{l}</button>;
                  })}
                </span>
              }>Follow-up</Label>
              <IconInput icon={CalendarDays} type="date" value={form.followup || ""} onChange={set("followup")} className="pr-1.5" />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea value={form.notes || ""} onChange={set("notes")} rows={2} placeholder="Anything worth remembering…"
              className={`${field} h-auto px-2.5 py-2 resize-y min-h-[56px]`} />
          </div>

          {children}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100 bg-zinc-50/60">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-medium text-zinc-600 border border-zinc-200 bg-white hover:bg-zinc-50 transition">Cancel</button>
          <button onClick={onSave} disabled={saving || !name}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 transition flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
