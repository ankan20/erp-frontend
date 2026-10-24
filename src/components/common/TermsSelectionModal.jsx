"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Loader2, Check, ChevronUp, ChevronDown,
  Trash2, GripVertical, X, PanelLeftClose, PanelLeftOpen,
  ChevronsDownUp, ChevronsUpDown, Plus,
} from "lucide-react";

import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import { POINT_STYLES } from "@/config/terms.config";
import { fmtUnderscore, groupsMatch, pointPrefix } from "@/helper/termsHelpers";
import { useColumnResize } from "@/hooks/useColumnResize";


const fmt = fmtUnderscore;

const normalizeGroup = (g) => ({
  ...g,
  pointStyle: (!g.pointStyle || g.pointStyle === "numbered") ? "bullet" : g.pointStyle,
});

// When loading from form (existing order terms) — sourceTermId = link to master
const normalizeTerm = (t, i) => ({
  ...t,
  sourceTermId: t.sourceTermId || t.termId, // backward compat
  _sortOrder: i,
  termGroups: (t.termGroups || []).map(normalizeGroup),
});

// When adding a fresh master term (no order-term id yet)
const masterToSelected = (masterTerm, i) => ({
  sourceTermId: masterTerm.termId,
  termType:     masterTerm.termType,
  _sortOrder:   i,
  termGroups:   (masterTerm.termGroups || []).map(normalizeGroup),
});


function TermGroupView({ group, idx }) {
  return (
    <div className="mb-2">
      <p className="text-[12px] font-semibold text-gray-700 mb-0.5">{idx + 1}. {group.title}</p>
      <p className="text-[12px] text-gray-500 mb-1 pl-3">{group.description}</p>
      {group.points?.length > 0 && (
        <div className="pl-6 flex flex-col gap-0.5">
          {group.points.map((pt, pi) => (
            <span key={pi} className="text-[12px] text-gray-600 flex gap-1.5">
              <span className={`shrink-0 font-mono ${group.pointStyle === "bullet" ? "text-[22px] leading-[20px] text-gray-500" : "text-[11px]"}`}>
                {pointPrefix(group.pointStyle, pi)}
              </span>
              {pt.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PointRow({ pt, pi, total, prefix, highlighted, onUpdate, onMove, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ transition: "box-shadow 0.4s ease" }}
      className={`flex items-start gap-1 rounded-sm ${highlighted ? "shadow-[0_0_0_2px_rgba(56,189,248,0.4)]" : ""}`}>
      <div className="flex flex-col shrink-0 mt-1">
        <button type="button" onClick={() => onMove(-1)} disabled={pi === 0}
          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronUp size={10} /></button>
        <button type="button" onClick={() => onMove(1)} disabled={pi === total - 1}
          className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronDown size={10} /></button>
      </div>
      <span className={`shrink-0 font-mono mt-1.5 ${prefix === "•" ? "text-[22px] leading-[22px] text-gray-500" : "text-[11px] text-gray-400 mt-2"}`}>
        {prefix}
      </span>
      <ExpandableTextArea value={pt.text} onChange={onUpdate} placeholder={`Point ${pi + 1}`}
        title={`Point ${pi + 1}`} rows={1} maxInlineRows={3} modalRows={6} className="flex-1" />
      <div className="shrink-0 mt-1">
        {confirm ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-red-500">Del?</span>
            <button type="button" onClick={onDelete} className="text-[10px] px-1 py-0.5 bg-red-500 text-white rounded-sm hover:bg-red-600">Y</button>
            <button type="button" onClick={() => setConfirm(false)} className="text-[10px] px-1 py-0.5 border border-gray-300 rounded-sm hover:bg-gray-100">N</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="p-0.5 text-red-300 hover:text-red-500 rounded">
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

function TermGroupsEditor({ term, allTerms, onUpdateGroupField, onMoveGroup, onDeactivateGroup, onActivateGroup, onUpdatePoint, onMovePoint, onDeletePoint, onAddPoint }) {
  const [groupConfirm,  setGroupConfirm]  = useState(null);
  const [movedGroupIdx, setMovedGroupIdx] = useState(null);
  const [movedPointKey, setMovedPointKey] = useState(null);
  const [collapsed,     setCollapsed]     = useState(new Set());

  const activeGroups = term.termGroups || [];
  const srcId = term.sourceTermId;

  // Compute inactive groups: master groups NOT in active (by title)
  const masterTerm = allTerms.find((t) => String(t.termId) === String(srcId));
  const inactiveGroups = (masterTerm?.termGroups || []).filter(
    (mg) => !activeGroups.some((ag) => groupsMatch(ag, mg))
  );

  const toggleCollapse = (gi) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(gi) ? n.delete(gi) : n.add(gi); return n; });

  const handleMoveGroup = (gi, dir) => {
    onMoveGroup(srcId, gi, dir);
    const swap = gi + dir;
    setTimeout(() => { setMovedGroupIdx(swap); setTimeout(() => setMovedGroupIdx(null), 600); }, 0);
  };

  const handleMovePoint = (gi, pi, dir) => {
    onMovePoint(srcId, gi, pi, dir);
    const swap = pi + dir;
    setTimeout(() => { setMovedPointKey(`${gi}-${swap}`); setTimeout(() => setMovedPointKey(null), 600); }, 0);
  };

  return (
    <>
      {activeGroups.map((group, gi) => (
        <div key={gi}
          style={{ transition: "box-shadow 0.4s ease, border-color 0.4s ease" }}
          className={`rounded-sm border p-2 ${gi > 0 ? "mt-1" : ""} ${
            movedGroupIdx === gi ? "border-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.3)] bg-sky-50" : "border-gray-200 bg-gray-50"
          }`}>
          {/* Header */}
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5 shrink-0">
              <button type="button" onClick={() => handleMoveGroup(gi, -1)} disabled={gi === 0}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronUp size={11} /></button>
              <button type="button" onClick={() => handleMoveGroup(gi, 1)} disabled={gi === activeGroups.length - 1}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronDown size={11} /></button>
            </div>
            <button type="button" onClick={() => toggleCollapse(gi)} title={collapsed.has(gi) ? "Expand" : "Collapse"}
              className="p-0.5 rounded shrink-0">
              {collapsed.has(gi)
                ? <ChevronsUpDown size={12} className="text-sky-500" />
                : <ChevronsDownUp size={12} className="text-indigo-400" />}
            </button>
            <span className="text-[11px] text-gray-400 shrink-0">{gi + 1}.</span>
            <input value={group.title} onChange={(e) => onUpdateGroupField(srcId, gi, "title", e.target.value)}
              placeholder="Group title"
              className="flex-1 text-[12px] font-semibold border border-gray-200 rounded-sm px-1.5 py-0.5 outline-none focus:border-sky-400 bg-white" />
            {/* Deactivate = remove from active (shows as inactive below) */}
            {groupConfirm === gi ? (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-red-500 font-medium">Remove?</span>
                <button type="button" onClick={() => { onDeactivateGroup(srcId, gi); setGroupConfirm(null); }}
                  className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded-sm hover:bg-red-600">Yes</button>
                <button type="button" onClick={() => setGroupConfirm(null)}
                  className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded-sm hover:bg-gray-100">No</button>
              </div>
            ) : (
              <button type="button" onClick={() => setGroupConfirm(gi)}
                className="p-0.5 text-red-300 hover:text-red-500 rounded shrink-0"><Trash2 size={11} /></button>
            )}
          </div>

          {!collapsed.has(gi) && (
            <div className="mt-1.5">
              <div className="mb-1.5">
                <ExpandableTextArea value={group.description || ""} onChange={(v) => onUpdateGroupField(srcId, gi, "description", v)}
                  placeholder="Description…" title={group.title || "Description"} rows={2} maxInlineRows={3} modalRows={8} className="w-full" />
              </div>
              <div className="flex items-center gap-2 py-1.5 border-b border-gray-200 mb-1.5">
                <span className="text-[11px] text-gray-700 font-semibold shrink-0">Sub-point Style :</span>
                <Select value={group.pointStyle || "bullet"} onValueChange={(v) => onUpdateGroupField(srcId, gi, "pointStyle", v)}>
                  <SelectTrigger className="h-[26px] text-[12px] w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POINT_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(group.points || []).length > 0 && (
                <div className="flex flex-col gap-1 pl-1">
                  {group.points.map((pt, pi) => (
                    <PointRow key={pi} pt={pt} pi={pi} total={group.points.length}
                      prefix={pointPrefix(group.pointStyle, pi)}
                      highlighted={movedPointKey === `${gi}-${pi}`}
                      onUpdate={(v) => onUpdatePoint(srcId, gi, pi, v)}
                      onMove={(dir) => handleMovePoint(gi, pi, dir)}
                      onDelete={() => onDeletePoint(srcId, gi, pi)} />
                  ))}
                </div>
              )}
              <button type="button" onClick={() => onAddPoint(srcId, gi)}
                className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-600 border border-sky-300 rounded-sm px-2 py-0.5 hover:bg-sky-50 transition self-start">
                <Plus size={11} /> Add Point
              </button>
            </div>
          )}
        </div>
      ))}

    </>
  );
}

function RightPanel({ tempSelected, allTerms, moveSelected, removeSelected, updateGroupField, moveGroup, deactivateGroup, activateGroup, updatePoint, movePoint, deletePoint, addPoint }) {
  const [collapsedTerms, setCollapsedTerms] = useState(new Set());

  const toggleTerm = (key) =>
    setCollapsedTerms((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const visible = tempSelected.filter((t) => (t.termGroups || []).length > 0);

  if (visible.length === 0) {
    return <p className="text-[12px] text-gray-400 text-center mt-6">No terms selected yet</p>;
  }

  return (
    <div className="overflow-auto flex-1 p-2 flex flex-col gap-2">
      {tempSelected.map((term, idx) => {
        if ((term.termGroups || []).length === 0) return null;
        const key       = String(term.sourceTermId ?? idx);
        const collapsed = collapsedTerms.has(key);
        return (
          <div key={key} className="border border-gray-200 rounded-sm bg-white">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
              <GripVertical size={12} className="text-gray-300 shrink-0" />
              <span className="text-[11px] font-semibold text-gray-600 shrink-0">#{idx + 1}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium shrink-0 ${
                term.termType === "Special_Terms" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
              }`}>
                {term.termType === "Special_Terms" ? "Special" : "General"}
              </span>
              <span className="text-[11px] text-gray-400 flex-1 truncate pl-1">
                {(term.termGroups || []).map((g) => g.title).join(", ")}
              </span>
              <button type="button" onClick={() => toggleTerm(key)} className="p-0.5 rounded shrink-0">
                {collapsed
                  ? <ChevronsUpDown size={12} className="text-sky-500" />
                  : <ChevronsDownUp size={12} className="text-indigo-400" />}
              </button>
              <button type="button" onClick={() => moveSelected(idx, -1)} disabled={idx === 0}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronUp size={11} /></button>
              <button type="button" onClick={() => moveSelected(idx, 1)} disabled={idx === tempSelected.length - 1}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronDown size={11} /></button>
              <button type="button" onClick={() => removeSelected(term.sourceTermId)}
                className="p-0.5 hover:bg-red-50 text-red-400 rounded"><X size={11} /></button>
            </div>

            {!collapsed && (
              <div className="p-2 flex flex-col gap-2">
                <TermGroupsEditor
                  term={term}
                  allTerms={allTerms}
                  onUpdateGroupField={updateGroupField}
                  onMoveGroup={moveGroup}
                  onDeactivateGroup={deactivateGroup}
                  onActivateGroup={activateGroup}
                  onUpdatePoint={updatePoint}
                  onMovePoint={movePoint}
                  onDeletePoint={deletePoint}
                  onAddPoint={addPoint}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TermsSelectionModal({
  open,
  onClose,
  onConfirm,
  selectedTerms = [],
  module        = "Order",
  subModule     = "",
  disabled      = false,
}) {
  const { tableRef } = useColumnResize();
  const [loading,         setLoading]         = useState(false);
  const [search,          setSearch]          = useState("");
  const [allTerms,        setAllTerms]        = useState([]);
  const [leftCollapsed,   setLeftCollapsed]   = useState(false);
  const [secCollapsed,    setSecCollapsed]    = useState({ Special_Terms: false, General_Terms: false });
  const [tempSelected,    setTempSelected]    = useState([]);

  // ── re-fetch when modal opens or module/subModule changes while open
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        let data;
        
          const params = new URLSearchParams({ module });
          if (subModule) params.append("subModule", subModule);
          const res = await apiRequest({ url: `${API_ENDPOINTS.MASTER.TERM.LIST}?${params}`, method: "GET" });
          data = res.data || [];
        setAllTerms(data);
      } catch { toast.error("Failed to load terms"); }
      finally { setLoading(false); }
    })();
  }, [open, module, subModule]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── reset UI state only when modal first opens
  useEffect(() => {
    if (!open) return;
    setTempSelected(selectedTerms.map((t, i) => normalizeTerm(t, i)));
    setSearch("");
    setSecCollapsed({ Special_Terms: false, General_Terms: false });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const specialTerms = useMemo(() => allTerms.filter((t) => t.termType === "Special_Terms"), [allTerms]);
  const generalTerms = useMemo(() => allTerms.filter((t) => t.termType === "General_Terms"),  [allTerms]);

  const filterList = (list) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((t) =>
      [t.module, t.subModule, ...(t.termGroups || []).map((g) => `${g.title} ${g.description}`)]
        .join(" ").toLowerCase().includes(q)
    );
  };

  const filteredSpecial = useMemo(() => filterList(specialTerms), [specialTerms, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredGeneral = useMemo(() => filterList(generalTerms), [generalTerms, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── selection helpers (keyed by sourceTermId = master termId)
  const findSelected = (masterTermId) =>
    tempSelected.find((t) => String(t.sourceTermId) === String(masterTermId));

  const isGroupActive = (masterTermId, masterGroup) => {
    const sel = findSelected(masterTermId);
    return (sel?.termGroups || []).some((g) => groupsMatch(g, masterGroup));
  };

  const isTermSelected = (masterTermId) => {
    const sel = findSelected(masterTermId);
    return !!(sel?.termGroups || []).length;
  };

  const someGroupActive = (masterTermId) => {
    const sel = findSelected(masterTermId);
    const total = allTerms.find((t) => String(t.termId) === String(masterTermId))?.termGroups?.length || 0;
    const active = (sel?.termGroups || []).length;
    return active > 0 && active < total;
  };

  // Toggle whole term (all groups)
  const toggleTerm = (masterTerm, checked) => {
    const id = String(masterTerm.termId);
    if (checked) {
      setTempSelected((prev) => {
        const existing = prev.find((t) => String(t.sourceTermId) === id);
        if (existing) {
          // Restore all master groups
          return prev.map((t) =>
            String(t.sourceTermId) === id
              ? { ...t, termGroups: (masterTerm.termGroups || []).map(normalizeGroup) }
              : t
          );
        }
        return [...prev, masterToSelected(masterTerm, prev.length)];
      });
    } else {
      setTempSelected((prev) => prev.filter((t) => String(t.sourceTermId) !== id));
    }
  };

  // Toggle individual group inside a term
  const toggleGroup = (masterTerm, group, checked) => {
    const id = String(masterTerm.termId);
    if (checked) {
      setTempSelected((prev) => {
        const existing = prev.find((t) => String(t.sourceTermId) === id);
        if (existing) {
          return prev.map((t) =>
            String(t.sourceTermId) === id
              ? { ...t, termGroups: [...(t.termGroups || []), normalizeGroup(group)] }
              : t
          );
        }
        return [...prev, { sourceTermId: masterTerm.termId, termType: masterTerm.termType, _sortOrder: prev.length, termGroups: [normalizeGroup(group)] }];
      });
    } else {
      setTempSelected((prev) =>
        prev.map((t) => {
          if (String(t.sourceTermId) !== id) return t;
          return { ...t, termGroups: (t.termGroups || []).filter((g) => !groupsMatch(g, group)) };
        }).filter((t) => (t.termGroups || []).length > 0 || String(t.sourceTermId) !== id)
      );
    }
  };

  const toggleAllInList = (list, checked) => {
    if (checked) {
      setTempSelected((prev) => {
        const toAdd = list.filter((t) => !isTermSelected(t.termId));
        return [...prev, ...toAdd.map((t, i) => masterToSelected(t, prev.length + i))];
      });
    } else {
      const ids = new Set(list.map((t) => String(t.termId)));
      setTempSelected((prev) => prev.filter((t) => !ids.has(String(t.sourceTermId))));
    }
  };

  const toggleCollapseSec = (key) =>
    setSecCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── right-panel helpers (keyed by sourceTermId)
  const moveSelected = (idx, dir) =>
    setTempSelected((prev) => {
      const next = [...prev]; const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]; return next;
    });

  const removeSelected = (sourceTermId) =>
    setTempSelected((prev) => prev.filter((t) => String(t.sourceTermId) !== String(sourceTermId)));

  const updateTerm = (sourceTermId, updater) =>
    setTempSelected((prev) => prev.map((t) => String(t.sourceTermId) === String(sourceTermId) ? updater(t) : t));

  const updateGroupField = (sourceTermId, gi, field, value) =>
    updateTerm(sourceTermId, (t) => ({ ...t, termGroups: t.termGroups.map((g, i) => i === gi ? { ...g, [field]: value } : g) }));

  const moveGroup = (sourceTermId, gi, dir) =>
    updateTerm(sourceTermId, (t) => {
      const gs = [...t.termGroups]; const swap = gi + dir;
      if (swap < 0 || swap >= gs.length) return t;
      [gs[gi], gs[swap]] = [gs[swap], gs[gi]]; return { ...t, termGroups: gs };
    });

  // Deactivate = remove from termGroups (shows up in inactive section automatically)
  const deactivateGroup = (sourceTermId, gi) =>
    updateTerm(sourceTermId, (t) => ({ ...t, termGroups: t.termGroups.filter((_, i) => i !== gi) }));

  // Activate = add master group back
  const activateGroup = (sourceTermId, masterGroup) =>
    updateTerm(sourceTermId, (t) => ({ ...t, termGroups: [...(t.termGroups || []), normalizeGroup(masterGroup)] }));

  const updatePoint = (sourceTermId, gi, pi, text) =>
    updateTerm(sourceTermId, (t) => ({
      ...t, termGroups: t.termGroups.map((g, gIdx) =>
        gIdx !== gi ? g : { ...g, points: g.points.map((p, pIdx) => pIdx === pi ? { ...p, text } : p) }
      ),
    }));

  const movePoint = (sourceTermId, gi, pi, dir) =>
    updateTerm(sourceTermId, (t) => ({
      ...t, termGroups: t.termGroups.map((g, gIdx) => {
        if (gIdx !== gi) return g;
        const pts = [...g.points]; const swap = pi + dir;
        if (swap < 0 || swap >= pts.length) return g;
        [pts[pi], pts[swap]] = [pts[swap], pts[pi]]; return { ...g, points: pts };
      }),
    }));

  const deletePoint = (sourceTermId, gi, pi) =>
    updateTerm(sourceTermId, (t) => ({
      ...t, termGroups: t.termGroups.map((g, gIdx) =>
        gIdx !== gi ? g : { ...g, points: g.points.filter((_, i) => i !== pi) }
      ),
    }));

  const addPoint = (sourceTermId, gi) =>
    updateTerm(sourceTermId, (t) => ({
      ...t, termGroups: t.termGroups.map((g, gIdx) =>
        gIdx !== gi ? g : { ...g, points: [...(g.points || []), { text: "" }] }
      ),
    }));

  const handleConfirm = () => {
    onConfirm?.(
      tempSelected
        .filter((t) => (t.termGroups || []).length > 0)
        .map((t, i) => ({ ...t, sortOrder: i }))
    );
    onClose?.();
  };

  const sections = [
    { key: "Special_Terms", label: "Special Terms", list: filteredSpecial, total: specialTerms.length, color: "text-amber-700" },
    { key: "General_Terms", label: "General Terms", list: filteredGeneral, total: generalTerms.length, color: "text-sky-700"   },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="min-w-[95vw] lg:min-w-[1100px] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">

        <DialogHeader className="px-5 py-3 border-b bg-slate-50 shrink-0">
          <DialogTitle className="text-[15px] font-semibold">
            Select Terms &amp; Conditions
            {subModule && <span className="ml-2 text-[12px] font-normal text-gray-400">— {fmt(module)} / {fmt(subModule)}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT ── */}
          <div className={`flex flex-col border-r overflow-hidden transition-all duration-200 ${leftCollapsed ? "w-0 min-w-0" : "flex-1"}`}>
            {/* Search */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-gray-200">
              <div className="relative max-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search terms…"
                  className="pl-9 h-8 w-full border border-gray-300 rounded-sm text-[13px] outline-none px-2" />
              </div>
            </div>

            <div className="overflow-auto flex-1">
              {loading && (
                <div className="h-[120px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}

              {!loading && sections.map((sec, si) => {
                const collapsed  = secCollapsed[sec.key];
                const allChecked = sec.list.length > 0 && sec.list.every((t) => isTermSelected(t.termId));
                const someChecked = sec.list.some((t) => isTermSelected(t.termId));
                return (
                  <div key={sec.key} className={si > 0 ? "border-t border-gray-200" : ""}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                      <Checkbox
                        checked={allChecked}
                        data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                        className={someChecked && !allChecked ? "opacity-60" : ""}
                        onCheckedChange={(v) => toggleAllInList(sec.list, v)}
                      />
                      <span className={`text-[12px] font-semibold flex-1 ${sec.color}`}>
                        {sec.label}
                        <span className="ml-1.5 text-[11px] font-normal text-gray-400">({sec.total})</span>
                      </span>
                      <button type="button" onClick={() => toggleCollapseSec(sec.key)}
                        className="p-0.5 rounded hover:bg-gray-200 text-gray-500 transition shrink-0">
                        {collapsed
                          ? <ChevronsUpDown size={13} className="text-sky-500" />
                          : <ChevronsDownUp size={13} className="text-indigo-400" />}
                      </button>
                    </div>

                    {/* Section table */}
                    {!collapsed && (
                      <table ref={tableRef} className="w-full border-collapse text-[13px]">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border px-2 py-1 w-[52px]"></th>
                            <th className="border px-2 py-1 text-left min-w-[180px]">Groups</th>
                            <th className="border px-2 py-1 text-left">Description / Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!sec.list.length && (
                            <tr><td colSpan={3} className="h-[60px] text-center text-gray-400 text-[12px]">No {sec.label} found</td></tr>
                          )}
                          {sec.list.map((term) => {
                            const allActive  = (term.termGroups || []).length > 0 && (term.termGroups || []).every((g) => isGroupActive(term.termId, g));
                            const someActive = (term.termGroups || []).some((g) => isGroupActive(term.termId, g));
                            return (
                              <tr key={term.termId} className={`align-top ${someActive ? "bg-sky-50" : "hover:bg-gray-50"}`}>
                                <td className="border px-2 py-2 align-top">
                                  <div className="flex justify-center pt-0.5">
                                    <Checkbox
                                      checked={allActive}
                                      data-state={someActive && !allActive ? "indeterminate" : undefined}
                                      className={someActive && !allActive ? "opacity-60" : ""}
                                      onCheckedChange={(v) => toggleTerm(term, v)}
                                    />
                                  </div>
                                </td>
                                <td className="border px-2 py-2">
                                  {(term.termGroups || []).map((g, gi) => {
                                    const active = isGroupActive(term.termId, g);
                                    return (
                                      <div key={gi}
                                        onClick={() => toggleGroup(term, g, !active)}
                                        className={`flex items-center gap-1.5 cursor-pointer select-none rounded-sm px-1 py-0.5 mb-0.5 hover:bg-sky-100/60 ${active ? "text-sky-700" : "text-gray-400"}`}>
                                        <Checkbox checked={active} className="shrink-0 pointer-events-none" />
                                        <span className="text-[12px] font-medium">{gi + 1}. {g.title}</span>
                                      </div>
                                    );
                                  })}
                                </td>
                                <td className="border px-2 py-2">
                                  {(term.termGroups || []).map((g, gi) => <TermGroupView key={gi} group={g} idx={gi} />)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className={`shrink-0 flex flex-col overflow-hidden transition-all duration-200 ${leftCollapsed ? "flex-1" : "w-[480px]"}`}>
            <div className="px-3 py-2 border-b bg-gray-50 shrink-0 flex items-center gap-2">
              <button type="button" onClick={() => setLeftCollapsed((v) => !v)}
                title={leftCollapsed ? "Show selection panel" : "Hide selection panel"}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 transition shrink-0">
                {leftCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
              <span className="text-[12px] font-semibold text-gray-600">
                Selected ({tempSelected.filter((t) => (t.termGroups || []).length > 0).length}) — reorder &amp; edit
              </span>
            </div>

            <RightPanel
              tempSelected={tempSelected}
              allTerms={allTerms}
              moveSelected={moveSelected}
              removeSelected={removeSelected}
              updateGroupField={updateGroupField}
              moveGroup={moveGroup}
              deactivateGroup={deactivateGroup}
              activateGroup={activateGroup}
              updatePoint={updatePoint}
              movePoint={movePoint}
              deletePoint={deletePoint}
              addPoint={addPoint}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3 shrink-0 bg-gray-50">
          <button type="button" onClick={onClose}
            className="h-8 px-4 rounded-sm border border-gray-300 text-[13px] text-gray-700 hover:bg-gray-100 transition">
            Cancel
          </button>
          {!disabled && (
            <button type="button" onClick={handleConfirm}
              className="h-8 px-4 rounded-sm border border-[#d97a2b] bg-[#f4b183] text-black text-[13px] font-medium hover:bg-[#eea36e] transition flex items-center gap-1.5">
              <Check size={13} /> Add Selected ({tempSelected.filter((t) => (t.termGroups || []).length > 0).length})
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
