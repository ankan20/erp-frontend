"use client";

import { useState } from "react";
import { useColumnResize } from "./useColumnResize";
import { getLocalStorage } from "@/lib/localStorage";

/**
 * Combines column resize (drag-handle on right edge) with drag-to-reorder columns.
 *
 * Usage:
 *   const { columnOrder, tableRef, getThProps } = useResizableTable({
 *     columns:    COLS,          // array of { id, ... }
 *     storageKey: "myTableName", // unique key per table
 *   });
 *
 *   <table ref={tableRef}>
 *     <thead>
 *       <tr>
 *         {columnOrder.map(id => {
 *           const col = COLS.find(c => c.id === id);
 *           return <th key={id} {...getThProps(id)} className={col.thClass}>...</th>;
 *         })}
 *       </tr>
 *     </thead>
 *   </table>
 *
 * getThProps(colId) returns: { draggable, onDragStart, onDragOver, onDrop, onDragEnd, title, className }
 * The className adds drag-visual classes; merge your own class on top if needed.
 * Use getDragClass(colId, extraClass) to produce the final th className instead.
 */
export function useResizableTable({ columns, storageKey }) {
  const { tableRef } = useColumnResize();

  const colIds = columns.map((c) => c.id);
  const lsKey  = `colOrder_${storageKey}_${getLocalStorage("userName") || "default"}`;

  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(lsKey) || "null");
      if (
        Array.isArray(saved) &&
        saved.length === colIds.length &&
        colIds.every((id) => saved.includes(id))
      ) return saved;
    } catch {}
    return [...colIds];
  });

  const [dragColId, setDragColId] = useState(null);
  const [overColId, setOverColId] = useState(null);

  const reorder = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    const next = [...columnOrder];
    const from = next.indexOf(fromId);
    const to   = next.indexOf(toId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    setColumnOrder(next);
    try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
  };

  /**
   * Returns HTML5 drag event props for a <th>.
   * Spread onto the <th> element.
   */
  const getDragHandlers = (colId) => ({
    draggable:   true,
    onDragStart: () => setDragColId(colId),
    onDragOver:  (e) => { e.preventDefault(); setOverColId(colId); },
    onDrop:      (e) => { e.preventDefault(); reorder(dragColId, colId); setDragColId(null); setOverColId(null); },
    onDragEnd:   () => { setDragColId(null); setOverColId(null); },
  });

  /**
   * Returns drag visual CSS classes for a <th>.
   * Pass your own base classes as `extraClass`.
   */
  const getDragClass = (colId, extraClass = "") => {
    const isDragging = dragColId === colId;
    const isOver     = overColId === colId && dragColId !== colId;
    return [
      extraClass,
      "select-none cursor-grab active:cursor-grabbing",
      isDragging ? "opacity-40"               : "",
      isOver     ? "!border-l-4 border-l-yellow-300" : "",
    ].filter(Boolean).join(" ");
  };

  /**
   * Convenience: combines getDragHandlers + getDragClass + title.
   * Spread onto a <th> as: <th {...getThProps(id, col.thClass)}>
   */
  const getThProps = (colId, extraClass = "") => ({
    ...getDragHandlers(colId),
    className: getDragClass(colId, extraClass),
    title:     "Drag to reorder · Drag edge to resize",
  });

  return {
    columnOrder,
    tableRef,
    getDragHandlers,
    getDragClass,
    getThProps,
  };
}
