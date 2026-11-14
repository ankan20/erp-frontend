"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, RefreshCw, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import SearchableSelect from "@/components/common/SearchableSelect";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { useResizableTable } from "@/hooks/useResizableTable";
import { useColumnResize } from "@/hooks/useColumnResize";
import { useRouter } from "next/navigation";

// ── helpers ──────────────────────────────────────────────────────

const DAY_ABBR = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MON_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseLocalDate(iso) {
  return new Date(iso + "T00:00:00");
}

function fmt2(val) {
  const n = parseFloat(val) || 0;
  return n === 0 ? "" : n.toFixed(2);
}

function fmtHrCell(val) {
  if (!val || val === 0) return "";
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

function fmtAmt(val) {
  if (!val || val === 0) return "";
  return val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMonthYear(isoDate) {
  if (!isoDate) return "";
  const d = parseLocalDate(isoDate);
  return `${MON_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

function currentMonthRange() {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to:   `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

function FilterLabel({ children }) {
  return (
    <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[13px] leading-5 rounded-sm whitespace-nowrap shrink-0">
      {children}
    </div>
  );
}

// ── flat-list columns ──────────────────────────────────────────

const FLAT_COLS = [
  { key: "dlrNo",          label: "DLR No",      className: "w-[90px]" },
  { key: "dlrDate",        label: "Date",         className: "w-[90px]" },
  { key: "projectCode",    label: "Project",      className: "w-[80px]" },
  { key: "supplierName",   label: "Supplier",     className: "min-w-[140px]" },
  { key: "fullName",       label: "Name",         className: "min-w-[140px]" },
  { key: "category",       label: "Category",     className: "min-w-[100px]" },
  { key: "startTime",      label: "Start",        className: "w-[70px]" },
  { key: "finishTime",     label: "Finish",       className: "w-[70px]" },
  { key: "workingHour",    label: "Working Hr",   align: "right", className: "w-[85px]" },
  { key: "bonusHour",      label: "Bonus Hr",     align: "right", className: "w-[75px]" },
  { key: "totalWorkingHr", label: "Total Hr",     align: "right", className: "w-[75px]" },
  { key: "mes",            label: "MES",          align: "right", className: "w-[65px]" },
  { key: "supl",           label: "SUPL",         align: "right", className: "w-[65px]" },
];

// ── flat list table ────────────────────────────────────────────

function DlrTable({ cols, rows }) {
  const colDefs = cols.map((c) => ({ ...c, id: c.key }));
  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns: colDefs,
    storageKey: "dlr_flat",
  });
  const ordered = columnOrder.map((id) => colDefs.find((c) => c.id === id)).filter(Boolean);

  if (!rows.length)
    return <div className="text-center text-gray-400 text-[13px] py-10">No records found</div>;

  return (
    <div className="border border-[#9e9e9e] overflow-x-auto">
      <div className="max-h-[608px] overflow-y-auto">
        <table ref={tableRef} className="w-full min-w-max table-fixed border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#144664]">
              {ordered.map((col) => (
                <th key={col.id} {...getThProps(col.id,
                  `px-3 py-2 text-left font-semibold border border-[#2e5a72] text-white whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`,
                )}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff] transition-colors`}>
                {ordered.map((col) => (
                  <td key={col.key} className={`px-3 py-1.5 border border-[#e6e4e4] ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.className || ""}`}>
                    {row[col.key] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── pivot attendance table ─────────────────────────────────────

function PivotTable({ workerRows, dates, dailyPresent, amountPerDay, grandRow, supplierName, projectCode, fromDate }) {
  const { tableRef } = useColumnResize();
  const hasRate = workerRows.some((r) => r.rate > 0);

  // header info
  const companyInfo = getLocalStorage("companyInfo") || {};
  const companyName = companyInfo.companyName || companyInfo.company_name || "";
  const companyAddr = companyInfo.address || "";
  const monthYear   = fmtMonthYear(fromDate);
  const reportTitle = supplierName
    ? `${supplierName.toUpperCase()} - SUMMARY - ${monthYear}`
    : `SUMMARY - ${monthYear}`;

  if (!workerRows.length)
    return <div className="text-center text-gray-400 text-[13px] py-10">No records found for the selected filters and date range.</div>;

  return (
    <div className="border border-[#9e9e9e] overflow-x-auto pr-[6px]">
      {/* report header */}
      {(companyName || supplierName) && (
        <div className="bg-white border-b border-[#9e9e9e] text-center px-4 py-2 print:block">
          {companyName && <div className="text-[13px] font-bold tracking-wide">{companyName}</div>}
          {companyAddr && <div className="text-[11px] text-gray-600">{companyAddr}</div>}
          <div className="flex justify-between items-center mt-1 text-[12px] font-semibold">
            <span>{reportTitle}</span>
            <span>Site : {projectCode || "—"}</span>
          </div>
        </div>
      )}

      <div className="max-h-[640px] overflow-y-auto">
        <table ref={tableRef} className="w-full min-w-max border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            {/* row 1 — group headers; date cols span both rows */}
            <tr>
              <th rowSpan={2} className="px-1 py-1 text-center font-bold border border-[#2e5a72] bg-[#144664] text-white w-[36px] whitespace-nowrap">SL<br/>NO</th>
              <th rowSpan={2} className="px-2 py-1 text-left   font-bold border border-[#2e5a72] bg-[#144664] text-white w-[160px]">NAME</th>
              <th rowSpan={2} className="px-2 py-1 text-left   font-bold border border-[#2e5a72] bg-[#144664] text-white w-[110px] whitespace-nowrap">DESIG.</th>
              {dates.map((d) => {
                const dt    = parseLocalDate(d);
                const isSun = dt.getDay() === 0;
                return (
                  <th key={d} rowSpan={2}
                    className={`px-0 py-0.5 text-center font-bold border border-[#2e5a72] text-white w-[36px] leading-tight text-[9.5px] ${isSun ? "bg-[#c0392b]" : "bg-[#144664]"}`}>
                    <span className="block">{DAY_ABBR[dt.getDay()]}</span>
                    <span className="block">{dt.getDate()}-{MON_ABBR[dt.getMonth()]}</span>
                  </th>
                );
              })}
              {/* TOTAL group: 4 sub-cols */}
              <th colSpan={4} className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1a5276] text-white text-[10px]">TOTAL</th>
              {hasRate && <th rowSpan={2} className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#145a32] text-white w-[72px] text-[9px]">RATE<br/>/HR</th>}
              {hasRate && <th colSpan={3} className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1b2631] text-white text-[10px]">AMOUNT</th>}
            </tr>
            {/* row 2 — TOTAL and AMOUNT sub-headers (date cols already rowSpan=2) */}
            <tr>
              <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1a5276] text-white w-[66px] text-[9px]">TOTAL<br/>HOURS</th>
              <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1a5276] text-white w-[52px] text-[9px]">MAN<br/>DAY&apos;S</th>
              <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1a5276] text-white w-[62px] text-[9px]">MES<br/>(Hrs)</th>
              <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1a5276] text-white w-[66px] text-[9px]">SUPL<br/>(Hrs)</th>
              {hasRate && <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1b2631] text-white w-[80px] text-[9px]">MES</th>}
              {hasRate && <th className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1b2631] text-white w-[80px] text-[9px]">SUPL</th>}
              {hasRate && <th data-col-resize-last="true" className="px-1 py-0.5 text-center font-bold border border-[#2e5a72] bg-[#1b2631] text-white w-[90px] text-[9px]">TOTAL</th>}
            </tr>
          </thead>
          <tbody>
            {workerRows.map((row, i) => (
              <tr key={i} className={`border-b border-[#e0e0e0] ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f4ff] transition-colors`}>
                <td className="px-1 py-0.5 text-center border border-[#e0e0e0] tabular-nums">{row.sl}</td>
                <td className="px-2 py-0.5 border border-[#e0e0e0] font-medium overflow-hidden">{row.name}</td>
                <td className="px-2 py-0.5 border border-[#e0e0e0] text-gray-600 text-[10px] overflow-hidden whitespace-nowrap">{row.category}</td>
                {dates.map((d) => {
                  const val   = row.hours[d];
                  const isAbs = !val || val === 0;
                  const isSun = parseLocalDate(d).getDay() === 0;
                  return (
                    <td key={d}
                      className={`px-0 py-0.5 text-center border border-[#e0e0e0] tabular-nums text-[10px] font-semibold
                        ${isAbs ? "bg-[#fde8e8] text-[#c0392b]" : isSun ? "bg-[#fff3f3]" : ""}`}>
                      {isAbs ? "A" : fmtHrCell(val)}
                    </td>
                  );
                })}
                <td className="px-1 py-0.5 text-right border border-[#e0e0e0] font-bold tabular-nums bg-[#eaf4fb]">{fmtHrCell(row.totalHr)}</td>
                <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#eaf4fb]">{row.manDays || ""}</td>
                <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#eaf4fb]">{fmtHrCell(row.mes)}</td>
                <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#eaf4fb]">{fmtHrCell(row.supl)}</td>
                {hasRate && <>
                  <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#eafaf1]">{row.rate > 0 ? row.rate.toFixed(2) : ""}</td>
                  <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#f0f9f0]">{fmtAmt(row.amtMes)}</td>
                  <td className="px-1 py-0.5 text-right border border-[#e0e0e0] tabular-nums bg-[#f0f9f0]">{fmtAmt(row.amtSupl)}</td>
                  <td className="px-1 py-0.5 text-right border border-[#e0e0e0] font-bold tabular-nums bg-[#f0f9f0]">{fmtAmt(row.amtTotal)}</td>
                </>}
              </tr>
            ))}

            {/* TOTAL row — date cols show count of workers present */}
            <tr className="bg-[#144664] text-white font-bold text-[10.5px]">
              <td colSpan={3} className="px-2 py-1 border border-[#2e5a72] text-center font-bold">TOTAL</td>
              {dates.map((d) => (
                <td key={d} className="px-0 py-1 border border-[#2e5a72] text-center tabular-nums text-[9.5px]">
                  {dailyPresent[d] || ""}
                </td>
              ))}
              <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtHrCell(grandRow.totalHr)}</td>
              <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{grandRow.manDays || ""}</td>
              <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtHrCell(grandRow.mes)}</td>
              <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtHrCell(grandRow.supl)}</td>
              {hasRate && <>
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtAmt(grandRow.amtMes)}</td>
                <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtAmt(grandRow.amtSupl)}</td>
                <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtAmt(grandRow.amtTotal)}</td>
              </>}
            </tr>

            {/* AMOUNT PER DAY row — per-date sum of (hours × rate) */}
            {hasRate && (
              <tr className="bg-[#2e4057] text-white text-[10px]">
                <td colSpan={3} className="px-2 py-1 border border-[#2e5a72] font-bold text-[10px]">AMOUNT PER DAY</td>
                {dates.map((d) => (
                  <td key={d} className="px-0 py-1 border border-[#2e5a72] text-center tabular-nums text-[9px]">
                    {amountPerDay[d] ? amountPerDay[d].toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                  </td>
                ))}
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72]" />
                <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtAmt(grandRow.amtMes)}</td>
                <td className="px-1 py-1 border border-[#2e5a72] text-right tabular-nums">{fmtAmt(grandRow.amtSupl)}</td>
                <td className="px-1 py-1 border border-[#2e5a72] font-bold text-right tabular-nums">
                  {fmtAmt(grandRow.amtTotal)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Excel export ───────────────────────────────────────────────

function exportFlatExcel(rows, supplierName, projectCode) {
  const XLSX = require("xlsx");
  const headers = ["DLR No","Date","Project","Supplier","Name","Category","Start","Finish","Working Hr","Bonus Hr","Total Hr","MES","SUPL"];
  const data = rows.map((r) => [
    r.dlrNo, r.dlrDate, r.projectCode, r.supplierName, r.fullName, r.category,
    r.startTime, r.finishTime,
    parseFloat(r.workingHour)||0, parseFloat(r.bonusHour)||0,
    parseFloat(r.totalWorkingHr)||0, parseFloat(r.mes)||0, parseFloat(r.supl)||0,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map((_, i) => ({ wch: i < 4 ? 18 : i < 6 ? 20 : 10 }));
  XLSX.utils.book_append_sheet(wb, ws, "DLR Report");
  XLSX.writeFile(wb, `DLR_Report_${supplierName || projectCode || "All"}.xlsx`);
}

function exportPivotExcel(workerRows, dates, dailyPresent, amountPerDay, grandRow, supplierName, projectCode, fromDate, toDate) {
  const XLSX = require("xlsx");
  const hasRate = workerRows.some((r) => r.rate > 0);
  const companyInfo = getLocalStorage("companyInfo") || {};
  const companyName = companyInfo.companyName || companyInfo.company_name || "";
  const companyAddr = companyInfo.address || "";
  const monthYear   = fmtMonthYear(fromDate);
  const reportTitle = supplierName ? `${supplierName.toUpperCase()} - SUMMARY - ${monthYear}` : `SUMMARY - ${monthYear}`;

  const dateHeaders = dates.map((d) => {
    const dt = parseLocalDate(d);
    return `${DAY_ABBR[dt.getDay()]}\n${dt.getDate()}-${MON_ABBR[dt.getMonth()]}`;
  });

  const rateHeader = hasRate ? ["Rate / Hr"] : [];
  const amtHeaders = hasRate ? ["MES Amount","SUPL Amount","Total Amount"] : [];

  const headerRow = ["SL NO","NAME","DESIGNATION",...dateHeaders,"Total Working Hours","Man Day's","MES (Hrs)","SUPL (Hrs)",...rateHeader,...amtHeaders];

  const dataRows = workerRows.map((r) => {
    const row = [r.sl, r.name, r.category,
      ...dates.map((d) => (!r.hours[d] || r.hours[d] === 0 ? "A" : r.hours[d])),
      r.totalHr || "", r.manDays || "", r.mes || "", r.supl || "",
    ];
    if (hasRate) row.push(r.rate > 0 ? r.rate : "");
    if (hasRate) row.push(r.amtMes  > 0 ? r.amtMes  : "");
    if (hasRate) row.push(r.amtSupl > 0 ? r.amtSupl : "");
    if (hasRate) row.push(r.amtTotal > 0 ? r.amtTotal : "");
    return row;
  });

  const totalRow = ["","TOTAL","",
    ...dates.map((d) => dailyPresent[d] || ""),
    grandRow.totalHr || "", grandRow.manDays || "", grandRow.mes || "", grandRow.supl || "",
  ];
  if (hasRate) {
    totalRow.push("");
    totalRow.push(grandRow.amtMes  > 0 ? grandRow.amtMes  : "");
    totalRow.push(grandRow.amtSupl > 0 ? grandRow.amtSupl : "");
    totalRow.push(grandRow.amtTotal > 0 ? grandRow.amtTotal : "");
  }

  const amtPerDayRow = ["","AMOUNT PER DAY","",
    ...dates.map((d) => amountPerDay[d] || ""),
    "", "", "", "",
  ];
  if (hasRate) {
    amtPerDayRow.push("");
    amtPerDayRow.push(grandRow.amtMes  > 0 ? grandRow.amtMes  : "");
    amtPerDayRow.push(grandRow.amtSupl > 0 ? grandRow.amtSupl : "");
    amtPerDayRow.push(grandRow.amtTotal > 0 ? grandRow.amtTotal : "");
  }

  const rows = [];
  if (companyName) rows.push([companyName]);
  if (companyAddr) rows.push([companyAddr]);
  rows.push([reportTitle, ...Array(headerRow.length - 2).fill(""), `Site : ${projectCode || ""}`]);
  rows.push([]);
  rows.push(headerRow);
  rows.push(...dataRows);
  rows.push(totalRow);
  if (hasRate) rows.push(amtPerDayRow);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const headerRowIdx = rows.findIndex((r) => r[0] === "SL NO");
  ws["!cols"] = [
    { wch: 5 }, { wch: 22 }, { wch: 14 },
    ...dates.map(() => ({ wch: 7 })),
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    ...(hasRate ? [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }] : []),
  ];
  XLSX.utils.book_append_sheet(wb, ws, "DLR Attendance");
  XLSX.writeFile(wb, `DLR_Attendance_${supplierName || "All"}_${fromDate}_${toDate}.xlsx`);
}

// ── main page ──────────────────────────────────────────────────

export default function DlrReportPage() {
  const access  = getPageAccess({ pageCode: "dlr", pageType: "LIST" });
  const router  = useRouter();
  const actions = usePageActions({ router });

  const { from: defFrom, to: defTo } = currentMonthRange();

  // stable — read once on mount, never reassigned
  const [initialProject] = useState(() => getLocalStorage("projectInfo")?.projectCode || "");

  const [supplierList, setSupplierList] = useState([]);
  const [projectList,  setProjectList]  = useState([]);
  const [supplierId,   setSupplierId]   = useState("");
  const [projectCode,  setProjectCode]  = useState(initialProject);
  const [fromDate,     setFromDate]     = useState(defFrom);
  const [toDate,       setToDate]       = useState(defTo);

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!initialProject) return;
    apiRequest({ url: `${API_ENDPOINTS.SUPPLIER.LIST}?projectCode=${encodeURIComponent(initialProject)}&hasLedger=true`, method: "GET" })
      .then((res) => {
        const list = (Array.isArray(res?.data) ? res.data : []).map((s) => ({
          ...s,
          displayName: s.supplierCode ? `${s.supplierName} (${s.supplierCode})` : s.supplierName,
        }));
        setSupplierList(list);
      })
      .catch(() => {});
  }, [initialProject]);

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjectList(res?.data || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(async () => {
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("From date cannot be after To date");
      return;
    }
    setLoading(true);
    setFetched(false);
    try {
      const params = new URLSearchParams();
      if (supplierId) params.set("supplier_id", supplierId);
      if (projectCode) {
        params.set("project_code", projectCode);
      } else if (projectList.length > 0) {
        const allCodes = projectList.map((p) => p.projectCode).filter(Boolean).join(",");
        if (allCodes) params.set("project_code", allCodes);
      }
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date",   toDate);
      const qs  = params.toString();
      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.MANPOWER.DLR.REPORT}${qs ? `?${qs}` : ""}`,
        method: "GET",
      });
      setRawData(Array.isArray(res?.data) ? res.data : []);
      setFetched(true);
    } catch (err) {
      setRawData([]);
      toast.error(err?.message || "Failed to fetch DLR report");
    } finally {
      setLoading(false);
    }
  }, [supplierId, projectCode, fromDate, toDate, projectList]);

  const handleReset = () => {
    setSupplierId("");
    setProjectCode(initialProject);
    setFromDate(defFrom);
    setToDate(defTo);
    setRawData([]);
    setFetched(false);
  };

  const isPivot = !!(fromDate && toDate);

  // ── flat rows ──────────────────────────────────────────────
  const flatRows = useMemo(() => {
    if (isPivot) return [];
    return rawData.map((r) => ({
      ...r,
      workingHour:    fmt2(r.workingHour),
      bonusHour:      fmt2(r.bonusHour),
      totalWorkingHr: fmt2(r.totalWorkingHr),
      mes:            fmt2(r.mes),
      supl:           fmt2(r.supl),
    }));
  }, [rawData, isPivot]);

  // ── pivot data ─────────────────────────────────────────────
  const pivotData = useMemo(() => {
    if (!isPivot) return { workerRows: [], dates: [], dailyPresent: {}, amountPerDay: {}, grandRow: {} };

    // All dates in selected range
    const dateArr = [];
    const cur = new Date(fromDate + "T00:00:00");
    const end = new Date(toDate + "T00:00:00");
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dateArr.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    // Group by worker
    const workerMap = new Map();
    rawData.forEach((r) => {
      const wKey = r.manId || `${r.fullName}__${r.category}`;
      if (!workerMap.has(wKey)) {
        workerMap.set(wKey, {
          name:     r.fullName || "",
          category: r.category || "",
          rate:     parseFloat(r.ratePerHr || 0),
          hours:    {},
          mes:      0,
          supl:     0,
        });
      }
      const w   = workerMap.get(wKey);
      const thr = parseFloat(r.totalWorkingHr || 0);
      w.hours[r.dlrDate] = (w.hours[r.dlrDate] || 0) + thr;
      w.mes  += parseFloat(r.mes  || 0);
      w.supl += parseFloat(r.supl || 0);
      if (parseFloat(r.ratePerHr || 0) > w.rate) w.rate = parseFloat(r.ratePerHr);
    });

    // daily aggregates
    const dailyPresent = {};
    const amountPerDay = {};

    let grandTotalHr   = 0;
    let grandManDays   = 0;
    let grandMes       = 0;
    let grandSupl      = 0;
    let grandAmtMes    = 0;
    let grandAmtSupl   = 0;
    let grandAmtTotal  = 0;
    let grandAmtPerDay = 0;

    const workerRows = [];
    let sl = 1;

    workerMap.forEach(({ name, category, rate, hours, mes, supl }) => {
      let totalHr = 0;
      let manDays = 0;
      let workerAmtPerDay = 0;

      dateArr.forEach((d) => {
        const hr = hours[d] || 0;
        if (hr > 0) {
          totalHr += hr;
          manDays += 1;
          dailyPresent[d] = (dailyPresent[d] || 0) + 1;
          const dayAmt = +(hr * rate).toFixed(2);
          amountPerDay[d]  = (amountPerDay[d]  || 0) + dayAmt;
          workerAmtPerDay += dayAmt;
        }
      });

      const mesRnd   = +(mes.toFixed(2));
      const suplRnd  = +(supl.toFixed(2));
      const amtMes   = rate > 0 ? +(mesRnd  * rate).toFixed(2) : 0;
      const amtSupl  = rate > 0 ? +(suplRnd * rate).toFixed(2) : 0;
      const amtTotal = rate > 0 ? +(totalHr * rate).toFixed(2) : 0;
      workerAmtPerDay = +(workerAmtPerDay.toFixed(2));

      grandTotalHr   += totalHr;
      grandManDays   += manDays;
      grandMes       += mesRnd;
      grandSupl      += suplRnd;
      grandAmtMes    += amtMes;
      grandAmtSupl   += amtSupl;
      grandAmtTotal  += amtTotal;
      grandAmtPerDay += workerAmtPerDay;

      workerRows.push({
        sl,
        name,
        category,
        hours,
        rate,
        totalHr: totalHr > 0 ? +(+totalHr.toFixed(2)) : 0,
        manDays,
        mes: mesRnd,
        supl: suplRnd,
        amtMes,
        amtSupl,
        amtTotal,
      });
      sl++;
    });

    const grandRow = {
      totalHr:           +(+grandTotalHr.toFixed(2)),
      manDays:           grandManDays,
      mes:               +(grandMes.toFixed(2)),
      supl:              +(grandSupl.toFixed(2)),
      amtMes:            +(grandAmtMes.toFixed(2)),
      amtSupl:           +(grandAmtSupl.toFixed(2)),
      amtTotal:          +(grandAmtTotal.toFixed(2)),
      amountPerDayTotal: +(grandAmtPerDay.toFixed(2)),
    };

    return { workerRows, dates: dateArr, dailyPresent, amountPerDay, grandRow };
  }, [rawData, isPivot, fromDate, toDate]);

  const selectedSupplier = supplierList.find((s) => String(s.supplierId) === String(supplierId));
  const supplierLabel    = selectedSupplier?.supplierName || "";

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <FilterLabel>Supplier</FilterLabel>
            <div className="w-[220px]">
              <SearchableSelect
                options={supplierList}
                value={supplierId}
                onChange={(val) => setSupplierId(val)}
                labelKey="displayName"
                valueKey="supplierId"
                placeholder="All Suppliers"
                clearLabel="— All Suppliers —"
                searchKeys={["supplierName","supplierCode"]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>Project</FilterLabel>
            <div className="w-[220px]">
              <SearchableSelect
                options={projectList}
                value={projectCode}
                onChange={(val) => setProjectCode(val)}
                labelKey={["projectCode","projectName"]}
                labelSeparator=" : "
                valueKey="projectCode"
                placeholder="All Projects"
                clearLabel="— All Projects —"
                searchKeys={["projectCode","projectName"]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input type="date" value={fromDate} max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input type="date" value={toDate} min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm" />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleFetch} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>
            {fetched && (
              <>
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors">
                  <RefreshCw size={13} /> Reset
                </button>
                <button
                  onClick={() => isPivot
                    ? exportPivotExcel(
                        pivotData.workerRows, pivotData.dates,
                        pivotData.dailyPresent, pivotData.amountPerDay,
                        pivotData.grandRow, supplierLabel, projectCode, fromDate, toDate,
                      )
                    : exportFlatExcel(rawData, supplierLabel, projectCode)
                  }
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#2d7a2d] text-[#2d7a2d] text-[13px] rounded-sm hover:bg-green-50 transition-colors">
                  <FileSpreadsheet size={13} /> Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* hint */}
        {fetched && !isPivot && (
          <p className="text-[12px] text-gray-400 italic">
            Showing flat list. Set both From and To dates for the attendance pivot view.
          </p>
        )}

        {/* table */}
        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="animate-spin w-6 h-6 text-[#144664]" />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Choose filters and press Fetch to view the DLR Report
          </div>
        ) : isPivot ? (
          <PivotTable
            workerRows={pivotData.workerRows}
            dates={pivotData.dates}
            dailyPresent={pivotData.dailyPresent}
            amountPerDay={pivotData.amountPerDay}
            grandRow={pivotData.grandRow}
            supplierName={supplierLabel}
            projectCode={projectCode}
            fromDate={fromDate}
          />
        ) : (
          <DlrTable cols={FLAT_COLS} rows={flatRows} />
        )}
      </div>
    </HeaderWrapper>
  );
}
