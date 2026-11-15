"use client";

import { useState } from "react";
import { Calendar, GripVertical, User } from "lucide-react";
import {
  BOARD_COLUMNS, STATUS_DOT, PRIORITY_STYLE, PRIORITY_STRIPE, fmtDate,
} from "@/lib/misTasks";

/**
 * Kanban board by status. Drag a card to another column to change its status.
 *   canMove(task) — false = card is not draggable (no edit right)
 *   onMove(task, status)
 */
export default function TaskBoard({ tasks = [], onOpen, onMove, canMove = () => true, showOwner = false }) {
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const byCol = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, []]));
  tasks.forEach((t) => { if (byCol[t.status]) byCol[t.status].push(t); });

  const drop = (col) => (e) => {
    e.preventDefault();
    setOverCol(null);
    const id = Number(e.dataTransfer.getData("text/task-id") || dragId);
    setDragId(null);
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== col) onMove?.(task, col);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {BOARD_COLUMNS.map((col) => (
        <section
          key={col}
          onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverCol(col); } }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
          onDrop={drop(col)}
          className={`rounded-xl border bg-gray-50/80 flex flex-col min-h-[240px] transition-colors
            ${overCol === col ? "border-blue-400 bg-blue-50/60" : "border-gray-200"}`}
          aria-label={`${col} column`}
        >
          <header className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[col]}`} /> {col}
            </span>
            <span className="text-[11px] font-semibold text-gray-500 bg-white border border-gray-200 rounded-full px-2">
              {byCol[col].length}
            </span>
          </header>

          <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-330px)]">
            {byCol[col].length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-6">Drop tasks here</p>
            )}
            {byCol[col].map((t) => {
              const movable = canMove(t);
              return (
                <article
                  key={t.id}
                  draggable={movable}
                  onDragStart={(e) => { e.dataTransfer.setData("text/task-id", String(t.id)); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => onOpen?.(t)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen?.(t)}
                  tabIndex={0}
                  className={`group bg-white rounded-lg border border-gray-200 border-l-4 ${PRIORITY_STRIPE[t.priority]} p-2.5 shadow-sm
                    hover:shadow-md hover:border-gray-300 cursor-pointer transition ${dragId === t.id ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-1.5">
                    {movable && <GripVertical size={14} className="mt-0.5 text-gray-300 group-hover:text-gray-400 shrink-0 cursor-grab" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-gray-400">{t.taskCode}</p>
                      <p className="text-sm font-medium text-gray-800 leading-snug break-words">{t.title}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                    {t.dueDate && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1
                        ${t.isOverdue ? "bg-red-50 text-red-600 border-red-200 font-semibold" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        <Calendar size={10} /> {fmtDate(t.dueDate)}
                      </span>
                    )}
                    {t.projectCode && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-100">{t.projectCode}</span>
                    )}
                  </div>
                  {showOwner && (
                    <p className="mt-1.5 text-[11px] text-gray-500 inline-flex items-center gap-1"><User size={11} /> {t.ownerName}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
