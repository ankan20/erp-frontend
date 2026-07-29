"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import SearchableSelect from "@/components/common/SearchableSelect";

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcWorkingHour(startTime, finishTime, lunchHour) {
  if (!startTime || !finishTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [fh, fm] = finishTime.split(":").map(Number);
  const diffMin  = fh * 60 + fm - (sh * 60 + sm);
  if (diffMin <= 0) return 0;
  return Math.max(
    0,
    parseFloat((diffMin / 60 - (parseFloat(lunchHour) || 0)).toFixed(2))
  );
}

function updateRow(items, idx, patch) {
  const updated = items.map((r, i) => (i !== idx ? r : { ...r, ...patch }));
  const row = updated[idx];
  const wh  = calcWorkingHour(row.startTime, row.finishTime, row.lunchHour);
  updated[idx] = {
    ...row,
    workingHour:    wh,
    totalWorkingHr: parseFloat((wh + (parseFloat(row.bonusHour) || 0)).toFixed(2)),
  };
  return updated;
}

export const emptyRow = () => ({
  manId:          "",
  fullName:       "",
  category:       "",
  startTime:      "",
  finishTime:     "",
  lunchHour:      0,
  workingHour:    0,
  bonusHour:      0,
  totalWorkingHr: 0,
  jobLocation:    "",
});

// ── Shared styles ─────────────────────────────────────────────────────────────

const cellCls  = "border border-gray-300 px-1 py-0.5";
const inputCls = "h-[28px] text-[12px] border border-gray-300 rounded-sm px-1 w-full";
const calcCls  = `${inputCls} bg-gray-100 cursor-default`;

const MINPUT = "h-[28px] text-[12px] border border-gray-300 rounded-sm px-1 w-full focus:outline-none focus:border-blue-400";
const MCALC  = `${MINPUT} bg-gray-100 cursor-default`;
const MLBL   = "text-[11px] font-medium text-gray-500 mb-0.5 select-none";

const DEFAULT_FIELDS = { startTime: "09:00", finishTime: "17:00", lunchHour: 1, bonusHour: 0, jobLocation: "" };

// ── Mass Entry / Mass Change Modal ────────────────────────────────────────────

function MassModal({ open, onClose, mode, labourList, alreadyInTableIds, checkedRows, locationOptions, onSave }) {
  const [fields,   setFields]   = useState(DEFAULT_FIELDS);
  const [selected, setSelected] = useState([]);

  // Workers shown in modal
  const available = useMemo(() => {
    if (mode === "change") {
      return checkedRows.map((r) => ({ manId: r.manId, fullName: r.fullName, category: r.category }));
    }
    // entry mode: workers from supplier not yet in table
    return labourList.filter((l) => !alreadyInTableIds.includes(l.manId));
  }, [mode, labourList, alreadyInTableIds, checkedRows]);

  // Initialise on open
  useEffect(() => {
    if (!open) return;
    if (mode === "change" && checkedRows.length > 0) {
      const first = checkedRows[0];
      setFields({
        startTime:   first.startTime   || "09:00",
        finishTime:  first.finishTime  || "17:00",
        lunchHour:   first.lunchHour   ?? 1,
        bonusHour:   first.bonusHour   ?? 0,
        jobLocation: first.jobLocation || "",
      });
    } else {
      setFields(DEFAULT_FIELDS);
    }
    // Pre-select all available
    setSelected(available.map((l) => l.manId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const wh      = calcWorkingHour(fields.startTime, fields.finishTime, fields.lunchHour);
  const totalWH = parseFloat((wh + (parseFloat(fields.bonusHour) || 0)).toFixed(2));

  const allSelected  = available.length > 0 && selected.length === available.length;
  const someSelected = selected.length > 0;
  const setField     = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  const toggleAll = () => setSelected(allSelected ? [] : available.map((l) => l.manId));
  const toggleOne = (manId) =>
    setSelected((p) => (p.includes(manId) ? p.filter((x) => x !== manId) : [...p, manId]));

  const handleSave = () => {
    const timeData = {
      startTime:      fields.startTime,
      finishTime:     fields.finishTime,
      lunchHour:      parseFloat(fields.lunchHour) || 0,
      workingHour:    wh,
      bonusHour:      parseFloat(fields.bonusHour) || 0,
      totalWorkingHr: totalWH,
      jobLocation:    fields.jobLocation,
    };

    const chosen = available.filter((l) => selected.includes(l.manId));

    if (mode === "change") {
      onSave(chosen.map((l) => ({ manId: l.manId, ...timeData })), "change");
    } else {
      onSave(
        chosen.map((l) => ({
          manId:    l.manId,
          fullName: l.fullName || "",
          category: l.category || "",
          ...timeData,
        })),
        "entry"
      );
    }
    onClose();
  };

  if (!open) return null;

  const title       = mode === "change" ? "Mass Change" : "Mass Entry";
  const listLabel   = mode === "change" ? "Workers to Update" : "Select Workers to Add";
  const saveLabel   = mode === "change" ? "Apply Changes" : "Add to Table";
  const emptyLabel  = mode === "change"
    ? "No workers selected in the table"
    : "All labourers from this supplier are already in the table";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl lg:max-w-4xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#d8e0d1] rounded-t-lg border-b border-[#c7cfbf] shrink-0">
          <span className="font-semibold text-[#1a3a5c] text-[13px]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition-colors rounded p-0.5 hover:bg-black/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time & Location fields */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            {mode === "change"
              ? "New Time & Location — applied to selected workers"
              : "Common Time & Location — applied to all selected workers"}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-3 gap-y-2">
            <div>
              <div className={MLBL}>Start Time</div>
              <input type="time" value={fields.startTime}
                onChange={(e) => setField("startTime", e.target.value)} className={MINPUT} />
            </div>
            <div>
              <div className={MLBL}>Finish Time</div>
              <input type="time" value={fields.finishTime}
                onChange={(e) => setField("finishTime", e.target.value)} className={MINPUT} />
            </div>
            <div>
              <div className={MLBL}>Lunch Hr</div>
              <input type="number" min="0" step="0.25" value={fields.lunchHour}
                onChange={(e) => setField("lunchHour", e.target.value)} className={MINPUT} />
            </div>
            <div>
              <div className={MLBL}>Working Hr</div>
              <input type="number" value={wh} readOnly disabled className={MCALC} />
            </div>
            <div>
              <div className={MLBL}>Bonus Hr</div>
              <input type="number" min="0" step="0.25" value={fields.bonusHour}
                onChange={(e) => setField("bonusHour", e.target.value)} className={MINPUT} />
            </div>
            <div>
              <div className={MLBL}>Total Working Hr</div>
              <input type="number" value={totalWH} readOnly disabled className={MCALC} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className={MLBL}>Job Location</div>
              <SearchableSelect
                options={locationOptions}
                value={fields.jobLocation}
                onChange={(val) => setField("jobLocation", val || "")}
                placeholder="Select location"
                labelKey="locationName"
                valueKey="locationName"
                searchKeys={["locationName"]}
              />
            </div>
          </div>
        </div>

        {/* Worker list */}
        <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {listLabel}&ensp;
              <span className="normal-case font-normal text-gray-500">
                ({selected.length} of {available.length})
              </span>
            </span>
            {available.length > 0 && (
              <button type="button" onClick={toggleAll}
                className="text-[11px] text-blue-600 hover:underline select-none">
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {available.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-[12px] text-gray-400 border border-dashed border-gray-300 rounded py-8">
              {emptyLabel}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded min-h-0">
              <table className="min-w-full text-[12px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#d9d9d9]">
                    <th className="w-[40px] border-b border-gray-300 px-2 py-1.5 text-center">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">Man ID</th>
                    <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Full Name</th>
                    <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {available.map((l, idx) => {
                    const isChecked = selected.includes(l.manId);
                    return (
                      <tr
                        key={l.manId}
                        onClick={() => toggleOne(l.manId)}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? "bg-[#e4f1fb]" : idx % 2 === 1 ? "bg-gray-50" : "bg-white"
                        } hover:bg-[#d0e9f8]`}
                      >
                        <td className="border-b border-gray-100 px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(l.manId)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1.5">
                          <span className="inline-block bg-[#dde7f2] text-[#1a3a5c] rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold">
                            {l.manId}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-2 py-1.5 font-medium">{l.fullName}</td>
                        <td className="border-b border-gray-100 px-2 py-1.5 text-gray-500">{l.category}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-lg shrink-0">
          <span className="text-[12px] text-gray-500">
            {someSelected
              ? `${selected.length} worker${selected.length !== 1 ? "s" : ""} ${mode === "change" ? "will be updated" : "will be added"}`
              : "No workers selected"}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 h-[30px] text-[12px] border border-gray-300 rounded-sm bg-white hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!someSelected}
              className="px-4 h-[30px] text-[12px] bg-[#6366f1] text-white rounded-sm border border-[#4f46e5] hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DLRDetailsTable({
  items           = [],
  onItemsChange,
  disabled        = false,
  labourList      = [],
  locationOptions = [],
}) {
  const [massOpen, setMassOpen] = useState(false);

  const rows = items.length > 0 ? items : [emptyRow()];

  // Human-readable manIds already in table (used for dedup in modal)
  const selectedManIds = useMemo(
    () => rows.map((r) => r.manId).filter(Boolean),
    [rows]
  );

  const checkedRows = useMemo(() => rows.filter((r) => r._checked), [rows]);
  const anyChecked  = checkedRows.length > 0;

  const setRows = (next) => onItemsChange?.(next);

  const addRow = () => {
    const base = rows[0]?.manId === "" && rows.length === 1 ? [] : rows;
    setRows([...base, emptyRow()]);
  };

  const handleCheck = (idx, checked) =>
    setRows(rows.map((r, i) => (i === idx ? { ...r, _checked: checked } : r)));

  const deleteChecked = () => {
    const next = rows.filter((r) => !r._checked);
    setRows(next.length > 0 ? next : [emptyRow()]);
  };

  const handleChange = (idx, field, value) =>
    setRows(updateRow(rows, idx, { [field]: value }));

  const handleMassave = (updates, mode) => {
    if (mode === "change") {
      const map = new Map(updates.map((u) => [u.manId, u]));
      setRows(
        rows.map((r) => {
          if (!r._checked || !map.has(r.manId)) return { ...r, _checked: false };
          return { ...r, ...map.get(r.manId), _checked: false };
        })
      );
    } else {
      const existingFilled = rows.filter((r) => r.manId);
      setRows([...existingFilled, ...updates]);
    }
  };

  const showMassBtn = labourList.length > 0;
  const massLabel   = anyChecked ? "Mass Change" : "Mass Entry";
  // Add Row only when no supplier loaded (manual free-text entry)
  const showAddRow  = labourList.length === 0;

  // Totals
  const totalWorkingHr    = rows.reduce((s, r) => s + (parseFloat(r.workingHour)    || 0), 0);
  const totalBonusHour    = rows.reduce((s, r) => s + (parseFloat(r.bonusHour)      || 0), 0);
  const totalTotalWorking = rows.reduce((s, r) => s + (parseFloat(r.totalWorkingHr) || 0), 0);

  return (
    <>
      <MassModal
        open={massOpen}
        onClose={() => setMassOpen(false)}
        mode={anyChecked ? "change" : "entry"}
        labourList={labourList}
        alreadyInTableIds={selectedManIds}
        checkedRows={checkedRows}
        locationOptions={locationOptions}
        onSave={handleMassave}
      />

      <div className="w-full min-w-0">
        {/* Section label */}
        <div className="bg-[#d8e0d1] border border-[#c7cfbf] px-3 py-1">
          <span className="text-[13px] font-semibold text-[#1a3a5c]">DLR DETAILS</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-300">
          <table className="min-w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#d9d9d9] font-bold text-gray-800">
                {!disabled && <th className={`${cellCls} w-[30px]`} />}
                <th className={`${cellCls} w-[40px] text-center`}>Sl No</th>
                <th className={`${cellCls} min-w-[100px]`}>Man ID</th>
                <th className={`${cellCls} min-w-[130px]`}>Full Name</th>
                <th className={`${cellCls} min-w-[110px]`}>Category</th>
                <th className={`${cellCls} min-w-[90px]`}>Start Time</th>
                <th className={`${cellCls} min-w-[90px]`}>Finish Time</th>
                <th className={`${cellCls} min-w-[70px]`}>Lunch Hr</th>
                <th className={`${cellCls} min-w-[80px]`}>Working Hr</th>
                <th className={`${cellCls} min-w-[70px]`}>Bonus Hr</th>
                <th className={`${cellCls} min-w-[100px]`}>Total Working Hr</th>
                <th className={`${cellCls} min-w-[130px]`}>Job Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const rowBg = idx % 2 === 1 ? "bg-[#dce9f8]" : "bg-white";
                return (
                  <tr key={idx} className={rowBg}>
                    {!disabled && (
                      <td className={`${cellCls} text-center`}>
                        <input
                          type="checkbox"
                          checked={!!row._checked}
                          onChange={(e) => handleCheck(idx, e.target.checked)}
                          className="cursor-pointer"
                        />
                      </td>
                    )}

                    {/* Sl No */}
                    <td className={`${cellCls} text-center text-gray-500`}>{idx + 1}</td>

                    {/* Man ID — always read-only text; manual text input only when no labour list */}
                    <td className={cellCls}>
                      {!disabled && labourList.length === 0 ? (
                        <input
                          type="text"
                          value={row.manId || ""}
                          onChange={(e) => handleChange(idx, "manId", e.target.value)}
                          className={inputCls}
                          placeholder="Enter ID"
                        />
                      ) : (
                        <span className="px-1 font-mono text-[11px]">{row.manId || "—"}</span>
                      )}
                    </td>

                    {/* Full Name */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.fullName || "—"}</span>
                      ) : (
                        <input type="text" value={row.fullName || ""} disabled readOnly
                          className={calcCls} placeholder="[Auto]" />
                      )}
                    </td>

                    {/* Category */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.category || "—"}</span>
                      ) : (
                        <input type="text" value={row.category || ""} disabled readOnly
                          className={calcCls} placeholder="[Auto]" />
                      )}
                    </td>

                    {/* Start Time */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.startTime || "—"}</span>
                      ) : (
                        <input type="time" value={row.startTime || ""}
                          onChange={(e) => handleChange(idx, "startTime", e.target.value)}
                          className={inputCls} />
                      )}
                    </td>

                    {/* Finish Time */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.finishTime || "—"}</span>
                      ) : (
                        <input type="time" value={row.finishTime || ""}
                          onChange={(e) => handleChange(idx, "finishTime", e.target.value)}
                          className={inputCls} />
                      )}
                    </td>

                    {/* Lunch Hour */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.lunchHour ?? 0}</span>
                      ) : (
                        <input type="number" min="0" step="0.25" value={row.lunchHour ?? 0}
                          onChange={(e) => handleChange(idx, "lunchHour", e.target.value)}
                          className={inputCls} />
                      )}
                    </td>

                    {/* Working Hour — calculated */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.workingHour ?? 0}</span>
                      ) : (
                        <input type="number" value={row.workingHour ?? 0} disabled readOnly className={calcCls} />
                      )}
                    </td>

                    {/* Bonus Hour */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.bonusHour ?? 0}</span>
                      ) : (
                        <input type="number" min="0" step="0.25" value={row.bonusHour ?? 0}
                          onChange={(e) => handleChange(idx, "bonusHour", e.target.value)}
                          className={inputCls} />
                      )}
                    </td>

                    {/* Total Working Hr — calculated */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.totalWorkingHr ?? 0}</span>
                      ) : (
                        <input type="number" value={row.totalWorkingHr ?? 0} disabled readOnly className={calcCls} />
                      )}
                    </td>

                    {/* Job Location */}
                    <td className={cellCls}>
                      {disabled ? (
                        <span className="px-1">{row.jobLocation || "—"}</span>
                      ) : (
                        <SearchableSelect
                          options={locationOptions}
                          value={row.jobLocation || ""}
                          onChange={(val) => handleChange(idx, "jobLocation", val || "")}
                          placeholder="Select"
                          labelKey="locationName"
                          valueKey="locationName"
                          searchKeys={["locationName"]}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals */}
            <tfoot>
              <tr className="bg-gray-200 font-semibold text-[12px]">
                {!disabled && <td className={cellCls} />}
                <td className={cellCls} />
                <td className={`${cellCls} text-right`} colSpan={5}>TOTAL</td>
                <td className={cellCls} />
                <td className={cellCls}>{parseFloat(totalWorkingHr.toFixed(2))}</td>
                <td className={cellCls}>{parseFloat(totalBonusHour.toFixed(2))}</td>
                <td className={cellCls}>{parseFloat(totalTotalWorking.toFixed(2))}</td>
                <td className={cellCls} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Toolbar */}
        {!disabled && (
          <div className="flex items-center justify-between mt-1.5">
            <div>
              {anyChecked && (
                <button
                  type="button"
                  onClick={deleteChecked}
                  className="px-3 h-[28px] text-[12px] bg-red-100 border border-red-400 rounded-sm text-red-700 hover:bg-red-200 transition-colors"
                >
                  Delete Selected
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showMassBtn && (
                <button
                  type="button"
                  onClick={() => setMassOpen(true)}
                  className="flex items-center gap-1.5 px-3 h-[28px] text-[12px] bg-[#6366f1] border border-[#4f46e5] rounded-sm text-white hover:bg-[#4f46e5] transition-colors font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  {massLabel}
                </button>
              )}
              {showAddRow && (
                <button
                  type="button"
                  onClick={addRow}
                  className="px-3 h-[28px] text-[12px] bg-[#7fc3d4] border border-[#4a9fb5] rounded-sm text-black hover:bg-[#6ab8cb] transition-colors"
                >
                  + Add Row
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
