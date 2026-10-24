/**
 * TermsSection — self-contained Terms & Conditions section.
 *
 * ## Basic usage
 * ```jsx
 * <TermsSection
 *   terms={form.watch("terms") || []}
 *   onChange={(v) => form.setValue("terms", v)}
 *   module="Order"
 *   subModule={form.watch("categoryCode")}
 *   disabled={disabled}
 * />
 * ```
 *
 * ## Props
 * - `terms`     {Array}    Controlled value — current terms array from parent form.
 * - `onChange`  {Function} Called with the new terms array whenever data changes.
 * - `module`    {string}   Static module name passed to the selection modal (e.g. "Order").
 * - `subModule` {string}   Dynamic sub-module, typically from a category field; triggers re-fetch.
 * - `disabled`  {boolean}  Hides edit controls (Add button, reorder, delete, description edit).
 * - `title`     {string}   Section header text. Default: "Terms & Condition".
 *
 * ## Extension points
 * - To add extra action buttons in the header: wrap this component and render them above/below.
 * - To customise tab order or labels: fork the `tabs` array inside this file.
 * - To render additional columns: add them to the <thead> and pass them via TermRow's `extraCells`
 *   render prop (add the prop when needed — the slot is left open in the table layout).
 * - The modal (`TermsSelectionModal`) accepts `module`/`subModule` for API filtering; these flow
 *   through unchanged, so changing the props here controls what the modal fetches.
 */

"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import TermsSelectionModal from "@/components/common/TermsSelectionModal";
import { pointPrefix } from "@/helper/termsHelpers";
import { useColumnResize } from "@/hooks/useColumnResize";

/* ─── TermRow ─────────────────────────────────────────────── */
function TermRow({ term, idx, total, disabled, onMove, onDelete, onUpdateGroup }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <tr className="align-top">
      {/* Sl No + reorder */}
      <td className="border px-1 py-1 text-center align-middle w-[70px]">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[12px] font-medium text-gray-600">{idx + 1}</span>
          {!disabled && (
            <div className="flex gap-0.5">
              <button type="button" onClick={() => onMove(idx, -1)} disabled={idx === 0}
                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                <ChevronUp size={12} />
              </button>
              <button type="button" onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                <ChevronDown size={12} />
              </button>
            </div>
          )}
        </div>
      </td>

      {/* Type badge */}
      <td className="border px-2 py-1 w-[100px] align-middle">
        <span className={`text-[11px] px-1.5 py-0.5 rounded-sm font-medium ${
          term.termType === "Special_Terms"
            ? "bg-amber-100 text-amber-700"
            : "bg-sky-100 text-sky-700"
        }`}>
          {term.termType === "Special_Terms" ? "Special" : "General"}
        </span>
      </td>

      {/* Term groups */}
      <td className="border px-2 py-2">
        {(term.termGroups || []).map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3 pt-2 border-t border-gray-100" : ""}>
            <p className="text-[12px] font-semibold text-gray-800 mb-1">
              {gi + 1}. {group.title}
            </p>
            <div className="mb-1.5">
              <ExpandableTextArea
                value={group.description}
                onChange={(v) => onUpdateGroup(term.sourceTermId ?? term.termId, gi, "description", v)}
                disabled={disabled}
                placeholder="Description…"
                title={group.title || "Term Description"}
                rows={2}
                maxInlineRows={3}
                modalRows={10}
                className="w-full"
              />
            </div>
            {group.points?.length > 0 && (
              <div className="pl-3 flex flex-col gap-0.5">
                {group.points.map((pt, pi) => (
                  <span key={pi} className="flex gap-2 text-[12px] text-gray-600">
                    <span className={`shrink-0 font-mono text-gray-400 ${group.pointStyle === "bullet" ? "text-[16px] leading-[18px]" : ""}`}>
                      {pointPrefix(group.pointStyle, pi)}
                    </span>
                    {pt.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </td>

      {/* Delete */}
      {!disabled && (
        <td className="border px-2 py-1 text-center align-middle w-[80px]">
          {confirmDelete ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-red-500 font-medium">Remove?</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => onDelete(term.sourceTermId ?? term.termId)}
                  className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded-sm hover:bg-red-600">
                  Yes
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded-sm hover:bg-gray-100">
                  No
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="text-red-400 hover:text-red-600 transition">
              <Trash2 size={14} />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

/* ─── TermsSection ────────────────────────────────────────── */
export default function TermsSection({
  terms = [],
  onChange,
  module = "Order",
  subModule = "",
  disabled = false,
  title = "Terms & Condition",
}) {
  const [activeTab, setActiveTab] = useState("Special_Terms");
  const [openModal, setOpenModal] = useState(false);
  const { tableRef } = useColumnResize();

  const generalTerms = terms.filter((t) => t.termType !== "Special_Terms");
  const specialTerms = terms.filter((t) => t.termType === "Special_Terms");
  const activeTerms  = activeTab === "General_Terms" ? generalTerms : specialTerms;

  const handleMove = (idx, dir) => {
    const list = [...activeTerms];
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    const other = terms.filter((t) =>
      activeTab === "General_Terms" ? t.termType === "Special_Terms" : t.termType !== "Special_Terms"
    );
    onChange(activeTab === "General_Terms" ? [...list, ...other] : [...other, ...list]);
  };

  const handleDelete = (sourceTermId) => {
    onChange(terms.filter((t) => String(t.sourceTermId ?? t.termId) !== String(sourceTermId)));
  };

  const handleUpdateGroup = (sourceTermId, groupIdx, field, value) => {
    onChange(
      terms.map((t) =>
        String(t.sourceTermId ?? t.termId) === String(sourceTermId)
          ? { ...t, termGroups: (t.termGroups || []).map((g, gi) => gi === groupIdx ? { ...g, [field]: value } : g) }
          : t
      )
    );
  };

  const handleConfirm = (selected) => {
    const existing = Object.fromEntries(terms.map((t) => [String(t.sourceTermId ?? t.termId), t]));
    const merged = selected.map((t) => {
      const key = String(t.sourceTermId ?? t.termId);
      return existing[key] ? { ...existing[key], termGroups: t.termGroups } : t;
    });
    onChange(merged);
  };

  const tabs = [
    { key: "Special_Terms", label: "Special Terms", count: specialTerms.length },
    { key: "General_Terms", label: "General Terms", count: generalTerms.length },
  ];

  return (
    <div className="bg-white w-full">
      <div className="border border-gray-300">
        {/* Header */}
        <div className="w-full bg-[#F5EFCF] border-b border-gray-300 px-4 py-1.5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-black">{title}</h2>
          {/* Add Terms button lives here — parent does NOT need to manage modal state */}
          {!disabled && (
            <button
              type="button"
              onClick={() => setOpenModal(true)}
              className="h-[30px] min-w-[120px] px-3 bg-[#9F96F2] border border-[#5D58A5] rounded-md text-black text-sm font-medium flex items-center justify-center hover:opacity-90 transition"
            >
              + Add T&amp;C
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-300 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-sky-500 text-sky-600 bg-sky-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              {tab.label}
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                activeTab === tab.key ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-500"
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Table — overflow-x-auto for mobile */}
        <div className="overflow-x-auto">
          <div className="overflow-y-auto max-h-[620px]">
            <table ref={tableRef} className="w-full border-collapse min-w-[420px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#D3D3D3]">
                  <th className="border px-2 py-1 text-sm w-[70px]">Sl No.</th>
                  <th className="border px-2 py-1 text-sm w-[100px]">Type</th>
                  <th className="border px-2 py-1 text-sm">Term Groups</th>
                  {!disabled && <th className="border px-2 py-1 text-sm w-[80px]">Action</th>}
                </tr>
              </thead>
              <tbody>
                {!activeTerms.length && (
                  <tr>
                    <td colSpan={disabled ? 3 : 4} className="h-[120px] text-center text-sm text-gray-400">
                      No {activeTab === "General_Terms" ? "General" : "Special"} Terms Added
                    </td>
                  </tr>
                )}
                {activeTerms.map((term, idx) => (
                  <TermRow
                    key={term.sourceTermId ?? term.termId}
                    term={term}
                    idx={idx}
                    total={activeTerms.length}
                    disabled={disabled}
                    onMove={handleMove}
                    onDelete={handleDelete}
                    onUpdateGroup={handleUpdateGroup}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal — state fully internal */}
      <TermsSelectionModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={handleConfirm}
        selectedTerms={terms}
        module={module}
        subModule={subModule}
        disabled={disabled}
      />
    </div>
  );
}
