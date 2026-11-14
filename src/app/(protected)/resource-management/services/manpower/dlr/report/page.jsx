"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useRouter } from "next/navigation";

// ── helpers ──────────────────────────────────────────────────────

function fmtHr(val) {
  const n = parseFloat(val) || 0;
  return n === 0 ? "" : n.toFixed(2);
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
  { key: "dlrNo",         label: "DLR No",       className: "w-[90px]" },
  { key: "dlrDate",       label: "Date",          className: "w-[90px]" },
  { key: "projectCode",   label: "Project",       className: "w-[80px]" },
  { key: "supplierName",  label: "Supplier",      className: "min-w-[140px]" },
  { key: "fullName",      label: "Name",          className: "min-w-[140px]" },
  { key: "category",      label: "Category",      className: "min-w-[100px]" },
  { key: "startTime",     label: "Start",         className: "w-[70px]" },
  { key: "finishTime",    label: "Finish",        className: "w-[70px]" },
  { key: "workingHour",   label: "Working Hr",    align: "right", className: "w-[85px]" },
  { key: "bonusHour",     label: "Bonus Hr",      align: "right", className: "w-[75px]" },
  { key: "totalWorkingHr",label: "Total Hr",      align: "right", className: "w-[75px]" },
  { key: "mes",           label: "MES",           align: "right", className: "w-[65px]" },
  { key: "supl",          label: "SUPL",          align: "right", className: "w-[65px]" },
];

// ── reusable table ─────────────────────────────────────────────

function DlrTable({ cols, rows, storageKey }) {
  const colDefs = cols.map((c) => ({ ...c, id: c.key }));
  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns: colDefs,
    storageKey: storageKey || "dlr_report",
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
              {ordered.map((col) => {
                const thProps = getThProps(
                  col.id,
                  `px-3 py-2 text-left font-semibold border border-[#2e5a72] text-white whitespace-nowrap ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`,
                );
                return <th key={col.id} {...thProps}>{col.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[#e0e0e0] ${row._total ? "bg-[#eef4f9] font-semibold" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff] transition-colors`}
              >
                {ordered.map((col) => {
                  const val = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 border border-[#e6e4e4] ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.className || ""}`}
                    >
                      {val ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── pivot table (attendance grid) ─────────────────────────────

function PivotTable({ rows, dates }) {
  const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build pivot cols: Sl, Name, Category, [dates...], Total Hrs, Man Days, OT Hrs
  const pivotCols = useMemo(() => {
    const fixed = [
      { key: "_sl",       label: "Sl",        className: "w-[40px]" },
      { key: "_name",     label: "Name",      className: "min-w-[140px]" },
      { key: "_category", label: "Category",  className: "min-w-[100px]" },
    ];
    const dateCols = dates.map((d) => {
      const dt = new Date(d + "T00:00:00");
      const day = DAY_ABBR[dt.getDay()];
      const dd = String(dt.getDate()).padStart(2, "0");
      return { key: `d_${d}`, label: `${dd}\n${day}`, rawDate: d, className: "w-[55px]", align: "right" };
    });
    const totals = [
      { key: "_totalHr",  label: "Total Hrs",  align: "right", className: "w-[80px]" },
      { key: "_manDays",  label: "Man Days",   align: "right", className: "w-[75px]" },
      { key: "_otHr",     label: "OT Hrs",     align: "right", className: "w-[70px]" },
    ];
    return [...fixed, ...dateCols, ...totals];
  }, [dates]);

  const colDefs = pivotCols.map((c) => ({ ...c, id: c.key }));
  const { columnOrder, tableRef, getThProps } = useResizableTable({
    columns: colDefs,
    storageKey: "dlr_pivot",
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
              {ordered.map((col) => {
                const thProps = getThProps(
                  col.id,
                  `px-3 py-2 text-left font-semibold border border-[#2e5a72] text-white ${col.align === "right" ? "text-right" : ""} ${col.className || ""}`,
                );
                // Split label for date cols (two-line: date\nday)
                const parts = col.label.split("\n");
                return (
                  <th key={col.id} {...thProps}>
                    {parts.length > 1 ? (
                      <span className="flex flex-col items-center leading-tight whitespace-nowrap">
                        <span>{parts[0]}</span>
                        <span className="text-[10px] opacity-80">{parts[1]}</span>
                      </span>
                    ) : (
                      <span className="whitespace-nowrap">{col.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-[#e0e0e0] ${row._total ? "bg-[#eef4f9] font-semibold" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} hover:bg-[#f0f0ff] transition-colors`}
              >
                {ordered.map((col) => {
                  const val = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 border border-[#e6e4e4] ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.className || ""}`}
                    >
                      {val ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Excel export ───────────────────────────────────────────────

function exportFlatExcel(rows, supplierName, projectCode) {
  const XLSX = require("xlsx");
  const headers = ["DLR No", "Date", "Project", "Supplier", "Name", "Category", "Start", "Finish", "Working Hr", "Bonus Hr", "Total Hr", "MES", "SUPL"];
  const data = rows.map((r) => [
    r.dlrNo, r.dlrDate, r.projectCode, r.supplierName, r.fullName, r.category,
    r.startTime, r.finishTime,
    parseFloat(r.workingHour) || 0,
    parseFloat(r.bonusHour) || 0,
    parseFloat(r.totalWorkingHr) || 0,
    parseFloat(r.mes) || 0,
    parseFloat(r.supl) || 0,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map((_, i) => ({ wch: i < 4 ? 18 : i < 6 ? 20 : 10 }));
  XLSX.utils.book_append_sheet(wb, ws, "DLR Report");
  const suffix = supplierName || projectCode || "All";
  XLSX.writeFile(wb, `DLR_Report_${suffix}.xlsx`);
}

function exportPivotExcel(pivotRows, dates, supplierName, fromDate, toDate) {
  const XLSX = require("xlsx");
  const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dateHeaders = dates.map((d) => {
    const dt = new Date(d + "T00:00:00");
    return `${String(dt.getDate()).padStart(2, "0")} ${DAY_ABBR[dt.getDay()]}`;
  });
  const headers = ["Sl", "Name", "Category", ...dateHeaders, "Total Hrs", "Man Days", "OT Hrs"];
  const data = pivotRows.filter((r) => !r._total).map((r) => [
    r._sl, r._name, r._category,
    ...dates.map((d) => r[`d_${d}`] ?? "A"),
    r._totalHr, r._manDays, r._otHr,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = [{ wch: 5 }, { wch: 22 }, { wch: 14 }, ...dates.map(() => ({ wch: 7 })), { wch: 10 }, { wch: 10 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, ws, "DLR Attendance");
  const suffix = supplierName || "All";
  XLSX.writeFile(wb, `DLR_Attendance_${suffix}_${fromDate}_${toDate}.xlsx`);
}

// ── main page ──────────────────────────────────────────────────

export default function DlrReportPage() {
  const access = getPageAccess({ pageCode: "dlr", pageType: "LIST" });
  const router = useRouter();
  const actions = usePageActions({ router });

  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";

  const [supplierList, setSupplierList] = useState([]);
  const [projectList,  setProjectList]  = useState([]);
  const [supplierId,   setSupplierId]   = useState("");
  const [projectCode,  setProjectCode]  = useState(defaultProject);
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");

  const [rawData,  setRawData]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  // load suppliers for current project (matches DLRForm pattern)
  useEffect(() => {
    if (!defaultProject) return;
    const params = `?projectCode=${encodeURIComponent(defaultProject)}&hasLedger=true`;
    apiRequest({ url: `${API_ENDPOINTS.SUPPLIER.LIST}${params}`, method: "GET" })
      .then((res) => {
        const list = (Array.isArray(res?.data) ? res.data : []).map((s) => ({
          ...s,
          displayName: s.supplierCode ? `${s.supplierName} (${s.supplierCode})` : s.supplierName,
        }));
        setSupplierList(list);
      })
      .catch(() => {});
  }, [defaultProject]);

  // load permitted projects
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
      // when a specific project is selected send it; when All Projects, send
      // the comma-joined list of all permitted projects so the backend only
      // returns data the user is authorised to see
      if (projectCode) {
        params.set("project_code", projectCode);
      } else if (projectList.length > 0) {
        const allCodes = projectList.map((p) => p.projectCode).filter(Boolean).join(",");
        if (allCodes) params.set("project_code", allCodes);
      }
      if (fromDate) params.set("from_date", fromDate);
      if (toDate)   params.set("to_date",   toDate);
      const qs = params.toString();
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
  }, [supplierId, projectCode, fromDate, toDate]);

  const handleReset = () => {
    setSupplierId("");
    setProjectCode(defaultProject);
    setFromDate("");
    setToDate("");
    setRawData([]);
    setFetched(false);
  };

  // ── derive mode ────────────────────────────────────────────
  const isPivot = fromDate && toDate;

  // ── flat list rows ─────────────────────────────────────────
  const flatRows = useMemo(() => {
    if (isPivot) return [];
    return rawData.map((r) => ({
      ...r,
      workingHour:    fmtHr(r.workingHour),
      bonusHour:      fmtHr(r.bonusHour),
      totalWorkingHr: fmtHr(r.totalWorkingHr),
      mes:            fmtHr(r.mes),
      supl:           fmtHr(r.supl),
    }));
  }, [rawData, isPivot]);

  // ── pivot rows + dates ─────────────────────────────────────
  const { pivotRows, pivotDates } = useMemo(() => {
    if (!isPivot || !rawData.length) return { pivotRows: [], pivotDates: [] };

    // collect unique dates in range
    const dateSet = new Set();
    rawData.forEach((r) => r.dlrDate && dateSet.add(r.dlrDate));

    // also fill every day in from→to
    if (fromDate && toDate) {
      let cur = new Date(fromDate + "T00:00:00");
      const end = new Date(toDate + "T00:00:00");
      while (cur <= end) {
        dateSet.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }
    const dates = Array.from(dateSet).sort();

    // group by worker key (manId || fullName+category)
    const workerMap = new Map(); // key → { name, category, dateHours:{date:hr} }
    rawData.forEach((r) => {
      const wKey = r.manId || `${r.fullName}__${r.category}`;
      if (!workerMap.has(wKey)) {
        workerMap.set(wKey, { name: r.fullName || "", category: r.category || "", dateHours: {} });
      }
      const w = workerMap.get(wKey);
      const existing = w.dateHours[r.dlrDate] || 0;
      w.dateHours[r.dlrDate] = existing + parseFloat(r.totalWorkingHr || 0);
    });

    const rows = [];
    let sl = 1;
    let grandTotal = 0;
    let grandManDays = 0;
    let grandOT = 0;
    const dateTotals = {};

    workerMap.forEach(({ name, category, dateHours }) => {
      const row = { _sl: sl++, _name: name, _category: category };
      let totalHr = 0;
      dates.forEach((d) => {
        const hr = dateHours[d];
        if (hr != null && hr > 0) {
          row[`d_${d}`] = hr.toFixed(2);
          totalHr += hr;
          dateTotals[d] = (dateTotals[d] || 0) + hr;
        } else {
          row[`d_${d}`] = "A";
        }
      });
      const manDays = +(totalHr / 8).toFixed(2);
      const otHr = +(Math.max(totalHr - dates.length * 8, 0)).toFixed(2);
      row._totalHr = totalHr.toFixed(2);
      row._manDays = manDays;
      row._otHr = otHr > 0 ? otHr.toFixed(2) : "";
      grandTotal += totalHr;
      grandManDays += manDays;
      grandOT += otHr;
      rows.push(row);
    });

    // grand total row
    const totalRow = { _sl: "", _name: "Total", _category: "", _total: true };
    dates.forEach((d) => {
      const t = dateTotals[d];
      totalRow[`d_${d}`] = t ? t.toFixed(2) : "";
    });
    totalRow._totalHr = grandTotal.toFixed(2);
    totalRow._manDays = grandManDays.toFixed(2);
    totalRow._otHr = grandOT > 0 ? grandOT.toFixed(2) : "";
    rows.push(totalRow);

    return { pivotRows: rows, pivotDates: dates };
  }, [rawData, isPivot, fromDate, toDate]);

  const selectedSupplier = supplierList.find((s) => String(s.supplierId) === String(supplierId));
  const supplierLabel = selectedSupplier?.supplierName || "";

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
                searchKeys={["supplierName", "supplierCode"]}
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
                labelKey={["projectCode", "projectName"]}
                labelSeparator=" : "
                valueKey="projectCode"
                placeholder="All Projects"
                clearLabel="— All Projects —"
                searchKeys={["projectCode", "projectName"]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FilterLabel>From</FilterLabel>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterLabel>To</FilterLabel>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-[140px] border border-[#8f8f8f] px-2 text-sm rounded-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1 bg-[#5a5aaa] hover:bg-[#4a4a9a] text-white text-[13px] font-semibold rounded-sm disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Fetch
            </button>

            {fetched && (
              <>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#8f8f8f] text-[13px] rounded-sm hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw size={13} /> Reset
                </button>
                <button
                  onClick={() =>
                    isPivot
                      ? exportPivotExcel(pivotRows, pivotDates, supplierLabel, fromDate, toDate)
                      : exportFlatExcel(rawData, supplierLabel, projectCode)
                  }
                  className="flex items-center gap-1.5 px-3 py-1 border border-[#2d7a2d] text-[#2d7a2d] text-[13px] rounded-sm hover:bg-green-50 transition-colors"
                >
                  <FileSpreadsheet size={13} /> Excel
                </button>
              </>
            )}
          </div>
        </div>

        {/* hint when date range not set */}
        {fetched && !isPivot && (
          <p className="text-[12px] text-gray-400 italic">
            Showing flat list. Set both From and To dates for the attendance pivot view.
          </p>
        )}
        {fetched && isPivot && (
          <p className="text-[12px] text-gray-400 italic">
            Pivot attendance view — each date column shows hours worked or &quot;A&quot; for absent.
          </p>
        )}

        {/* table area */}
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
          <PivotTable rows={pivotRows} dates={pivotDates} />
        ) : (
          <DlrTable cols={FLAT_COLS} rows={flatRows} storageKey="dlr_flat" />
        )}
      </div>
    </HeaderWrapper>
  );
}
