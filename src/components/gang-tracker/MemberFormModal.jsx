"use client";

import { useEffect } from "react";
import { CalendarDays, HardHat, Loader2, MapPin, MessageCircle, Phone, StickyNote, User, X } from "lucide-react";
import { addDays, initials, todayStr } from "./shared";

const STATUSES = [
  { v: "Available",   dot: "bg-emerald-500", on: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  { v: "Deployed",    dot: "bg-blue-500",    on: "bg-blue-50 border-blue-300 text-blue-700" },
  { v: "Follow-up",   dot: "bg-amber-500",   on: "bg-amber-50 border-amber-300 text-amber-700" },
  { v: "Pending",     dot: "bg-orange-500",  on: "bg-orange-50 border-orange-300 text-orange-700" },
  { v: "Unavailable", dot: "bg-red-400",     on: "bg-red-50 border-red-300 text-red-700" },
];

const field =
  "w-full h-10 rounded-xl border border-gray-200 bg-gray-50/70 text-[13px] text-gray-800 placeholder:text-gray-400 " +
  "transition focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function Label({ children, required, hint }) {
  return (
    <label className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
      {children}{required && <span className="text-rose-500">*</span>}
      {hint && <span className="ml-auto font-normal text-gray-400">{hint}</span>}
    </label>
  );
}

function IconInput({ icon: Icon, className = "", ...props }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input {...props} className={`${field} pl-9 pr-3 ${className}`} />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">{title}</h3>
        <span className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
      </div>
      {children}
    </section>
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
  const skillList = form.skill && !skills.includes(form.skill) ? [...skills, form.skill] : skills;
  const name = form.name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-xl"} my-6 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col transition-[max-width] duration-200`}>

        {/* header with live avatar */}
        <div className="relative bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_85%_-20%,white,transparent_45%)]" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/30 flex items-center justify-center text-lg font-bold backdrop-blur">
              {name ? initials(name) : <User className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight truncate">
                {isEdit ? `Edit ${name || "member"}` : name || "New gang member"}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                {[form.skill, form.status].filter(Boolean).join(" · ") || "Only the name is required"}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/15 hover:text-white transition" title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <Section title="Who">
            <div>
              <Label required>Full name</Label>
              <IconInput icon={User} autoFocus value={form.name} onChange={set("name")} placeholder="e.g. Raju Sharma" />
            </div>
            <div>
              <Label>Skill / trade</Label>
              <div className="flex flex-wrap gap-1.5">
                {skillList.map((s) => (
                  <button key={s} type="button" onClick={() => set("skill")(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      form.skill === s ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200"
                        : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Mobile</Label>
                <IconInput icon={Phone} type="tel" value={form.mobile} onChange={set("mobile")} placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label hint={form.mobile && form.whatsapp !== form.mobile && (
                  <button type="button" onClick={() => set("whatsapp")(form.mobile)} className="text-blue-600 hover:underline">Same as mobile</button>
                )}>WhatsApp</Label>
                <IconInput icon={MessageCircle} type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+91 98765 43210" />
              </div>
            </div>
          </Section>

          <Section title="Work & availability">
            <div>
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button key={s.v} type="button" onClick={() => set("status")(s.v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      form.status === s.v ? `${s.on} ring-2 ring-offset-1 ring-current/20` : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.v}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Location</Label>
                <IconInput icon={MapPin} value={form.location} onChange={set("location")} placeholder="Town, State" />
              </div>
              <div>
                <Label>Current site</Label>
                <IconInput icon={HardHat} value={form.site} onChange={set("site")} placeholder="Site / project name" />
              </div>
            </div>
            <div>
              <Label>Follow-up date</Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48"><IconInput icon={CalendarDays} type="date" value={form.followup} onChange={set("followup")} /></div>
                {[["Today", 0], ["+3 days", 3], ["+1 week", 7]].map(([l, n]) => {
                  const d = n ? addDays(n) : todayStr();
                  return (
                    <button key={l} type="button" onClick={() => set("followup")(d)}
                      className={`px-2.5 py-1 rounded-full text-[11px] border transition ${form.followup === d ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{l}</button>
                  );
                })}
                {form.followup && <button type="button" onClick={() => set("followup")("")} className="text-[11px] text-gray-400 hover:text-gray-600">Clear</button>}
              </div>
            </div>
          </Section>

          <Section title="Notes">
            <div className="relative">
              <StickyNote className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Anything worth remembering about this person…"
                className={`${field} h-auto pl-9 pr-3 py-2.5 resize-y min-h-[84px]`} />
            </div>
          </Section>

          {children}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/80">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Cancel</button>
          <button onClick={onSave} disabled={saving || !name}
            className="h-10 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-200 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:shadow-none transition flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
