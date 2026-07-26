"use client";

import { useMemo } from "react";
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

// ── Cell styles ───────────────────────────────────────────────────────────────

const cellCls    = "border border-gray-300 px-1 py-0.5";
const inputCls   = "h-[28px] text-[12px] border border-gray-300 rounded-sm px-1 w-full";
const calcCls    = `${inputCls} bg-gray-100 cursor-default`;

// ── Main component ────────────────────────────────────────────────────────────

export default function DLRDetailsTable({
  items        = [],
  onItemsChange,
  disabled     = false,
  labourList   = [],
}) {
  // Initialise with one empty row when items is empty
  const rows = items.length > 0 ? items : [emptyRow()];

  // Collect already-selected manIds to prevent duplicates
  const selectedManIds = useMemo(
    () => rows.map((r) => r.manId).filter(Boolean),
    [rows]
  );

  const setRows = (next) => onItemsChange?.(next);

  const addRow = () => {
    const base = rows[0]?.manId === "" && rows.length === 1 ? [] : rows;
    setRows([...base, emptyRow()]);
  };

  const handleCheck = (idx, checked) => {
    const next = rows.map((r, i) =>
      i === idx ? { ...r, _checked: checked } : r
    );
    setRows(next);
  };

  const deleteChecked = () => {
    const next = rows.filter((r) => !r._checked);
    setRows(next.length > 0 ? next : [emptyRow()]);
  };

  const handleChange = (idx, field, value) => {
    setRows(updateRow(rows, idx, { [field]: value }));
  };

  const handleManIdChange = (idx, manId) => {
    const worker = labourList.find((l) => String(l.id) === String(manId));
    setRows(
      updateRow(rows, idx, {
        manId:    manId || "",
        fullName: worker?.fullName || "",
        category: worker?.category || "",
      })
    );
  };

  // Totals row
  const totalWorkingHr    = rows.reduce((s, r) => s + (parseFloat(r.workingHour)    || 0), 0);
  const totalBonusHour    = rows.reduce((s, r) => s + (parseFloat(r.bonusHour)      || 0), 0);
  const totalTotalWorking = rows.reduce((s, r) => s + (parseFloat(r.totalWorkingHr) || 0), 0);

  const anyChecked = rows.some((r) => r._checked);

  return (
    <div className="w-full min-w-0">
      {/* Section label */}
      <div className="bg-[#d8e0d1] border border-[#c7cfbf] px-3 py-1 mb-0">
        <span className="text-[13px] font-semibold text-[#1a3a5c]">DLR DETAILS</span>
      </div>

      {/* Table — horizontal scroll on narrow screens */}
      <div className="overflow-x-auto border border-gray-300 -mx-0">
        <table className="min-w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-[#d9d9d9] font-bold text-gray-800">
              {!disabled && (
                <th className={`${cellCls} w-[30px]`}></th>
              )}
              <th className={`${cellCls} w-[40px] text-center`}>Sl No</th>
              <th className={`${cellCls} min-w-[130px]`}>Man ID</th>
              <th className={`${cellCls} min-w-[130px]`}>Full Name</th>
              <th className={`${cellCls} min-w-[110px]`}>Category</th>
              <th className={`${cellCls} min-w-[90px]`}>Start Time</th>
              <th className={`${cellCls} min-w-[90px]`}>Finish Time</th>
              <th className={`${cellCls} min-w-[80px]`}>Lunch Hr</th>
              <th className={`${cellCls} min-w-[90px]`}>Working Hr</th>
              <th className={`${cellCls} min-w-[80px]`}>Bonus Hr</th>
              <th className={`${cellCls} min-w-[100px]`}>Total Working Hr</th>
              <th className={`${cellCls} min-w-[130px]`}>Job Location</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEven = idx % 2 === 1;
              const rowBg  = isEven ? "bg-[#dce9f8]" : "bg-white";

              // Options for this row: exclude other rows' manIds (but allow own selection)
              const availableOptions = labourList.filter(
                (l) =>
                  !selectedManIds.includes(String(l.id)) ||
                  String(l.id) === String(row.manId)
              );

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

                  {/* Man ID */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.manId || "—"}</span>
                    ) : (
                      <SearchableSelect
                        options={availableOptions}
                        value={String(row.manId || "")}
                        onChange={(val) => handleManIdChange(idx, val)}
                        disabled={disabled}
                        placeholder="Select"
                        labelKey="manId"
                        valueKey="id"
                        searchKeys={["manId", "fullName"]}
                      />
                    )}
                  </td>

                  {/* Full Name — auto-filled */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.fullName || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.fullName || ""}
                        disabled
                        readOnly
                        className={`${calcCls}`}
                        placeholder="[Auto]"
                      />
                    )}
                  </td>

                  {/* Category — auto-filled */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.category || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.category || ""}
                        disabled
                        readOnly
                        className={calcCls}
                        placeholder="[Auto]"
                      />
                    )}
                  </td>

                  {/* Start Time */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.startTime || "—"}</span>
                    ) : (
                      <input
                        type="time"
                        value={row.startTime || ""}
                        onChange={(e) => handleChange(idx, "startTime", e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </td>

                  {/* Finish Time */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.finishTime || "—"}</span>
                    ) : (
                      <input
                        type="time"
                        value={row.finishTime || ""}
                        onChange={(e) => handleChange(idx, "finishTime", e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </td>

                  {/* Lunch Hour */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.lunchHour ?? 0}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.lunchHour ?? 0}
                        onChange={(e) => handleChange(idx, "lunchHour", e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </td>

                  {/* Working Hour — calculated */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.workingHour ?? 0}</span>
                    ) : (
                      <input
                        type="number"
                        value={row.workingHour ?? 0}
                        disabled
                        readOnly
                        className={calcCls}
                      />
                    )}
                  </td>

                  {/* Bonus Hour */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.bonusHour ?? 0}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={row.bonusHour ?? 0}
                        onChange={(e) => handleChange(idx, "bonusHour", e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </td>

                  {/* Total Working Hr — calculated */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.totalWorkingHr ?? 0}</span>
                    ) : (
                      <input
                        type="number"
                        value={row.totalWorkingHr ?? 0}
                        disabled
                        readOnly
                        className={calcCls}
                      />
                    )}
                  </td>

                  {/* Job Location */}
                  <td className={cellCls}>
                    {disabled ? (
                      <span className="px-1">{row.jobLocation || "—"}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.jobLocation || ""}
                        onChange={(e) => handleChange(idx, "jobLocation", e.target.value)}
                        className={inputCls}
                        placeholder="Location"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals row */}
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

      {/* Toolbar — below table, right-aligned */}
      {!disabled && (
        <div className="flex items-center justify-end gap-2 mt-1.5">
          {anyChecked && (
            <button
              type="button"
              onClick={deleteChecked}
              className="px-3 h-[28px] text-[12px] bg-red-100 border border-red-400 rounded-sm text-red-700 hover:bg-red-200 transition-colors"
            >
              Delete Selected
            </button>
          )}
          <button
            type="button"
            onClick={addRow}
            className="px-3 h-[28px] text-[12px] bg-[#7fc3d4] border border-[#4a9fb5] rounded-sm text-black hover:bg-[#6ab8cb] transition-colors"
          >
            + Add Row
          </button>
        </div>
      )}
    </div>
  );
}
