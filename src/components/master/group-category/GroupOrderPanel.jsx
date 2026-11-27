"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, GripVertical, ChevronDown, ChevronRight, Save } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function toAlpha(n) {
  // 0 → A, 1 → B, 25 → Z, 26 → AA
  let s = "";
  let i = n + 1;
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

function buildLabel(groupIdx, subIdx, subSubIdx) {
  const a = toAlpha(groupIdx);
  if (subIdx === undefined) return a;
  if (subSubIdx === undefined) return `${a}.${subIdx + 1}`;
  return `${a}.${subIdx + 1}.${subSubIdx + 1}`;
}

function move(arr, fromIdx, toIdx) {
  const next = [...arr];
  const [item] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, item);
  return next;
}

const HEAD_UNDER_ORDER = ["Profit & Loss", "Balance Sheet"];

// parentKey for children map:
//   top-level sub-groups under a group  → `g_${groupId}`
//   nested sub-groups under a sub-group → `sg_${subGroupId}`
function parentKey(sub) {
  return sub.parentId ? `sg_${sub.parentId}` : `g_${sub.groupId}`;
}

// ─── drag context ────────────────────────────────────────────────────────────

// We track drag state in refs (not state) so renders during drag stay cheap.
// scope = the parentKey / headUnder string that restricts valid drop targets
const useDragOrder = (setDirty) => {
  const dragRef = useRef(null); // { scope, idx }
  const [dragOverScope, setDragOverScope] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const onDragStart = useCallback((scope, idx) => {
    dragRef.current = { scope, idx };
  }, []);

  const onDragOver = useCallback(
    (e, scope, idx) => {
      e.preventDefault();
      if (dragRef.current?.scope !== scope) return; // different sibling group
      setDragOverScope(scope);
      setDragOverIdx(idx);
    },
    []
  );

  const onDrop = useCallback(
    (scope, idx, setter) => {
      const from = dragRef.current;
      if (!from || from.scope !== scope || from.idx === idx) {
        setDragOverScope(null);
        setDragOverIdx(null);
        return;
      }
      setter((prev) => move(prev, from.idx, idx));
      setDirty(true);
      dragRef.current = null;
      setDragOverScope(null);
      setDragOverIdx(null);
    },
    [setDirty]
  );

  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragOverScope(null);
    setDragOverIdx(null);
  }, []);

  return { onDragStart, onDragOver, onDrop, onDragEnd, dragOverScope, dragOverIdx };
};

// ─── single row ─────────────────────────────────────────────────────────────

function OrderRow({
  label,
  name,
  code,
  idx,
  total,
  scope,
  depth,
  hasKids,
  isOpen,
  onToggle,
  drag,
  onMoveUp,
  onMoveDown,
  setter,
}) {
  const isDragOver = drag.dragOverScope === scope && drag.dragOverIdx === idx;

  return (
    <div
      draggable
      onDragStart={() => drag.onDragStart(scope, idx)}
      onDragOver={(e) => drag.onDragOver(e, scope, idx)}
      onDrop={() => drag.onDrop(scope, idx, setter)}
      onDragEnd={drag.onDragEnd}
      onClick={hasKids ? onToggle : undefined}
      className={[
        "flex items-center gap-2 px-2 py-[6px] rounded-md select-none transition-colors cursor-grab active:cursor-grabbing",
        hasKids ? "hover:cursor-pointer" : "",
        isDragOver
          ? "bg-blue-100 border border-blue-400"
          : depth === 0
          ? "hover:bg-[#f0f7ff]"
          : "hover:bg-gray-50",
      ].join(" ")}
      style={{ paddingLeft: `${8 + depth * 20}px` }}
    >
      {/* grip */}
      <span className="text-gray-300 shrink-0">
        <GripVertical size={14} />
      </span>

      {/* expand chevron or spacer */}
      <span className="shrink-0 w-4 flex justify-center text-gray-400">
        {hasKids
          ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
          : null}
      </span>

      {/* label badge */}
      <span
        className={[
          "shrink-0 font-mono text-[11px] px-1.5 py-0.5 rounded",
          depth === 0
            ? "bg-[#1c3a5e] text-white font-bold"
            : depth === 1
            ? "bg-[#d6e6f2] text-[#1c3a5e] font-semibold"
            : "bg-gray-100 text-gray-500",
        ].join(" ")}
      >
        {label}
      </span>

      {/* name */}
      <span className={`flex-1 min-w-0 truncate text-sm ${depth === 0 ? "font-semibold text-gray-800" : "text-gray-700"}`}>
        {name}
      </span>

      {/* code */}
      {code && (
        <span className="shrink-0 font-mono text-[10px] text-gray-400 hidden sm:block">{code}</span>
      )}

      {/* arrows — stop propagation so clicks don't toggle expand */}
      <span
        className="shrink-0 flex gap-0.5"
        onDragStart={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={idx === 0}
          onClick={onMoveUp}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Move up"
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          disabled={idx === total - 1}
          onClick={onMoveDown}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Move down"
        >
          <ArrowDown size={12} />
        </button>
      </span>
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function GroupOrderPanel() {
  const [groups, setGroups] = useState([]); // flat, sorted
  const [childMap, setChildMap] = useState({}); // { scope: [sub, ...] }
  const [loading, setLoading] = useState(true);
  const [isDirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(new Set()); // "g_ID" or "sg_ID"

  const drag = useDragOrder(setDirty);

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [gRes, sgRes] = await Promise.all([
        apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_GROUP }),
        apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP }),
      ]);
      const rawGroups = (gRes?.data || []).slice().sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.groupId - b.groupId
      );
      setGroups(rawGroups);

      const rawSubs = sgRes?.data || [];
      const map = {};
      rawSubs.forEach((s) => {
        const key = parentKey(s);
        if (!map[key]) map[key] = [];
        map[key].push(s);
      });
      // sort each bucket by sortOrder
      Object.keys(map).forEach((k) => {
        map[k].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.subGroupId - b.subGroupId);
      });
      setChildMap(map);

      // auto-expand all top-level sub-groups that have children
      const initExpanded = new Set();
      rawGroups.forEach((g) => {
        const key = `g_${g.groupId}`;
        (map[key] || []).forEach((sg) => {
          if (map[`sg_${sg.subGroupId}`]?.length) initExpanded.add(`sg_${sg.subGroupId}`);
        });
      });
      setExpanded(initExpanded);
      setDirty(false);
    } catch {
      toast.error("Failed to load group order data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving order...");
    try {
      // Build group payloads with new sort_order = index * 10
      const groupPayload = groups.map((g, i) => ({ groupId: g.groupId, sortOrder: i * 10 }));

      // Build sub-group payloads per scope
      const sgPayload = [];
      Object.entries(childMap).forEach(([, subs]) => {
        subs.forEach((s, i) => {
          sgPayload.push({ subGroupId: s.subGroupId, sortOrder: i * 10 });
        });
      });

      await apiRequest({
        url: API_ENDPOINTS.MASTER.REORDER_GROUPS,
        method: "PATCH",
        data: groupPayload,
      });
      await apiRequest({
        url: API_ENDPOINTS.MASTER.REORDER_SUB_GROUPS,
        method: "PATCH",
        data: sgPayload,
      });

      toast.success("Order saved", { id: toastId });
      setDirty(false);
    } catch {
      toast.error("Failed to save order", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ── move helpers for groups (flat array, all headUnder mixed) ─────────────
  // scope is either `h_${headUnder}` for BS groups or `pl_${plSection}` for P&L groups
  const moveGroupInScope = (scopeKey, fromIdx, toIdx) => {
    setGroups((prev) => {
      let scopedItems, rest;
      if (scopeKey.startsWith("pl_")) {
        const plSec = scopeKey.slice(3); // "Income" or "Expense"
        scopedItems = prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === plSec);
        rest = prev.filter((g) => !(g.headUnder === "Profit & Loss" && g.plSection === plSec));
      } else {
        const headUnder = scopeKey.slice(2);
        scopedItems = prev.filter((g) => g.headUnder === headUnder);
        rest = prev.filter((g) => g.headUnder !== headUnder);
      }
      const reordered = move(scopedItems, fromIdx, toIdx);
      // Rebuild preserving HEAD_UNDER_ORDER; P&L groups keep Income then Expense order
      const plIncome = scopeKey === "pl_Income" ? reordered : prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === "Income");
      const plExpense = scopeKey === "pl_Expense" ? reordered : prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === "Expense");
      const plUnclassified = prev.filter((g) => g.headUnder === "Profit & Loss" && !g.plSection);
      const bsGroups = scopeKey.startsWith("h_") ? reordered : prev.filter((g) => g.headUnder === "Balance Sheet");
      const others = rest.filter((g) => g.headUnder !== "Profit & Loss" && g.headUnder !== "Balance Sheet");
      return [...plIncome, ...plExpense, ...plUnclassified, ...bsGroups, ...others];
    });
    setDirty(true);
  };

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const allExpandableKeys = useCallback(() => {
    const keys = new Set();
    groups.forEach((g) => {
      const gKey = `g_${g.groupId}`;
      if (childMap[gKey]?.length) {
        keys.add(gKey);
        (childMap[gKey] || []).forEach((sg) => {
          const sgKey = `sg_${sg.subGroupId}`;
          if (childMap[sgKey]?.length) keys.add(sgKey);
        });
      }
    });
    return keys;
  }, [groups, childMap]);

  const expandAll = () => setExpanded(allExpandableKeys());
  const collapseAll = () => setExpanded(new Set());

  // ── render sub-group tree recursively ────────────────────────────────────
  const renderSubs = (scopeKey, groupIdx, subPath = []) => {
    const subs = childMap[scopeKey] || [];
    if (!subs.length) return null;

    const setSubs = (updater) => {
      setChildMap((prev) => {
        const next = { ...prev };
        next[scopeKey] = typeof updater === "function" ? updater(prev[scopeKey] || []) : updater;
        return next;
      });
      setDirty(true);
    };

    return subs.map((sub, subIdx) => {
      const kidKey = `sg_${sub.subGroupId}`;
      const hasKids = !!(childMap[kidKey]?.length);
      const isOpen = expanded.has(kidKey);
      const label = buildLabel(groupIdx, ...subPath, subIdx);

      return (
        <div key={sub.subGroupId}>
          <OrderRow
            label={label}
            name={sub.subGroupName}
            code={sub.subGroupCode}
            idx={subIdx}
            total={subs.length}
            scope={scopeKey}
            depth={subPath.length + 1}
            hasKids={hasKids}
            isOpen={isOpen}
            onToggle={() => toggleExpand(kidKey)}
            drag={{
              ...drag,
              onDragStart: (_, i) => drag.onDragStart(scopeKey, i),
              onDragOver: (e, _, i) => drag.onDragOver(e, scopeKey, i),
              onDrop: (_, i) => drag.onDrop(scopeKey, i, setSubs),
            }}
            onMoveUp={() => setSubs((prev) => move(prev, subIdx, subIdx - 1))}
            onMoveDown={() => setSubs((prev) => move(prev, subIdx, subIdx + 1))}
            setter={setSubs}
          />
          {isOpen && renderSubs(kidKey, groupIdx, [...subPath, subIdx])}
        </div>
      );
    });
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Loading order…
      </div>
    );
  }

  const headUnders = Array.from(
    new Set([...HEAD_UNDER_ORDER, ...groups.map((g) => g.headUnder)])
  ).filter((h) => groups.some((g) => g.headUnder === h));

  return (
    <div className="space-y-1">
      {/* toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">
            Click a row to expand · drag or use arrows to reorder.
          </p>
          <span className="text-gray-200">|</span>
          <button
            type="button"
            onClick={expandAll}
            className="text-xs text-[#1c3a5e] hover:underline cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs text-[#1c3a5e] hover:underline cursor-pointer"
          >
            Collapse All
          </button>
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#f6c85f] hover:bg-[#e8b84d] text-[#1c3a5e] font-semibold text-sm px-4 py-1.5 rounded shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Order"}
          </button>
        )}
      </div>

      {headUnders.map((headUnder) => {
        const headGroups = groups.filter((g) => g.headUnder === headUnder);

        // ── for P&L, render Income / Expense / Unclassified subsections ──────
        if (headUnder === "Profit & Loss") {
          const plSections = [
            { key: "Income", label: "Income", color: "#166534", bg: "#dcfce7", border: "#86efac" },
            { key: "Expense", label: "Expenses", color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
          ];
          const unclassified = headGroups.filter((g) => !g.plSection);

          return (
            <div key={headUnder} className="mb-5">
              {/* P&L top header */}
              <div className="flex items-center gap-2 mb-3 px-2">
                <div className="h-px flex-1 bg-[#c5dbed]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#1c3a5e] px-2 py-1 bg-[#e8f4fd] rounded border border-[#c5dbed]">
                  {headUnder}
                </span>
                <div className="h-px flex-1 bg-[#c5dbed]" />
              </div>

              {plSections.map(({ key: plSec, label, color, bg, border }) => {
                const sectionGroups = headGroups.filter((g) => g.plSection === plSec);
                const scopeKey = `pl_${plSec}`;

                const setGroupsForSection = (updater) => {
                  setGroups((prev) => {
                    const inScope = prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === plSec);
                    const others = prev.filter((g) => !(g.headUnder === "Profit & Loss" && g.plSection === plSec));
                    const updated = typeof updater === "function" ? updater(inScope) : updater;
                    const plIncome = plSec === "Income" ? updated : prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === "Income");
                    const plExpense = plSec === "Expense" ? updated : prev.filter((g) => g.headUnder === "Profit & Loss" && g.plSection === "Expense");
                    const plUnclassified = prev.filter((g) => g.headUnder === "Profit & Loss" && !g.plSection);
                    return [
                      ...plIncome, ...plExpense, ...plUnclassified,
                      ...others.filter((g) => g.headUnder !== "Profit & Loss"),
                    ];
                  });
                  setDirty(true);
                };

                return (
                  <div key={plSec} className="mb-3">
                    {/* P&L subsection header */}
                    <div
                      className="flex items-center gap-2 mb-1 px-3 py-1.5 rounded-t"
                      style={{ background: bg, borderLeft: `3px solid ${border}` }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
                        {label}
                      </span>
                      {sectionGroups.length === 0 && (
                        <span className="text-[10px] text-gray-400 italic ml-1">(no groups)</span>
                      )}
                    </div>

                    <div className="pl-2 border-l-2" style={{ borderColor: border }}>
                      {sectionGroups.map((group, gIdx) => {
                        const gKey = `g_${group.groupId}`;
                        const hasKids = !!(childMap[gKey]?.length);
                        const isOpen = expanded.has(gKey);

                        return (
                          <div key={group.groupId}>
                            <OrderRow
                              label={toAlpha(gIdx)}
                              name={group.groupName}
                              code={null}
                              idx={gIdx}
                              total={sectionGroups.length}
                              scope={scopeKey}
                              depth={0}
                              hasKids={hasKids}
                              isOpen={isOpen}
                              onToggle={() => toggleExpand(gKey)}
                              drag={{
                                ...drag,
                                onDragStart: (_, i) => drag.onDragStart(scopeKey, i),
                                onDragOver: (e, _, i) => drag.onDragOver(e, scopeKey, i),
                                onDrop: (_, i) => drag.onDrop(scopeKey, i, setGroupsForSection),
                              }}
                              onMoveUp={() => moveGroupInScope(scopeKey, gIdx, gIdx - 1)}
                              onMoveDown={() => moveGroupInScope(scopeKey, gIdx, gIdx + 1)}
                              setter={setGroupsForSection}
                            />
                            {isOpen && renderSubs(gKey, gIdx)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Unclassified P&L groups warning */}
              {unclassified.length > 0 && (
                <div className="mb-2 mt-1 px-3 py-2 bg-amber-50 border border-amber-300 rounded text-xs text-amber-700">
                  <span className="font-semibold">⚠ Unclassified groups</span> — the following groups have no P&amp;L Section set. Edit them in the Manage tab to assign Income or Expense:
                  <span className="ml-1 font-mono">{unclassified.map((g) => g.groupName).join(", ")}</span>
                </div>
              )}
            </div>
          );
        }

        // ── Balance Sheet and other heads — flat list ─────────────────────────
        const scopeKey = `h_${headUnder}`;
        return (
          <div key={headUnder} className="mb-5">
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="h-px flex-1 bg-[#c5dbed]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#1c3a5e] px-2 py-1 bg-[#e8f4fd] rounded border border-[#c5dbed]">
                {headUnder}
              </span>
              <div className="h-px flex-1 bg-[#c5dbed]" />
            </div>

            {headGroups.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No groups under {headUnder}</p>
            ) : (
              headGroups.map((group, gIdx) => {
                const gKey = `g_${group.groupId}`;
                const hasKids = !!(childMap[gKey]?.length);
                const isOpen = expanded.has(gKey);

                const setGroupsForHead = (updater) => {
                  setGroups((prev) => {
                    const inHead = prev.filter((g) => g.headUnder === headUnder);
                    const others = prev.filter((g) => g.headUnder !== headUnder);
                    const updated = typeof updater === "function" ? updater(inHead) : updater;
                    const result = [];
                    HEAD_UNDER_ORDER.forEach((h) => {
                      result.push(...(h === headUnder ? updated : others.filter((g) => g.headUnder === h)));
                    });
                    others.filter((g) => !HEAD_UNDER_ORDER.includes(g.headUnder)).forEach((g) => result.push(g));
                    return result;
                  });
                  setDirty(true);
                };

                return (
                  <div key={group.groupId}>
                    <OrderRow
                      label={toAlpha(gIdx)}
                      name={group.groupName}
                      code={null}
                      idx={gIdx}
                      total={headGroups.length}
                      scope={scopeKey}
                      depth={0}
                      hasKids={hasKids}
                      isOpen={isOpen}
                      onToggle={() => toggleExpand(gKey)}
                      drag={{
                        ...drag,
                        onDragStart: (_, i) => drag.onDragStart(scopeKey, i),
                        onDragOver: (e, _, i) => drag.onDragOver(e, scopeKey, i),
                        onDrop: (_, i) => drag.onDrop(scopeKey, i, setGroupsForHead),
                      }}
                      onMoveUp={() => moveGroupInScope(scopeKey, gIdx, gIdx - 1)}
                      onMoveDown={() => moveGroupInScope(scopeKey, gIdx, gIdx + 1)}
                      setter={setGroupsForHead}
                    />
                    {isOpen && renderSubs(gKey, gIdx)}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
