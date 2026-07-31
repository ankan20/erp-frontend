"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import DataTable from "@/components/common/DataTable";
import SearchSection from "@/components/common/SearchSection";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

const HISTORY_COLS = [
  { header: "Sl. No",          accessor: "sl" },
  { header: "Machine ID",      accessor: "pmUid" },
  { header: "Machine Name",    accessor: "pmName" },
  { header: "Service Type",    accessor: "serviceType" },
  { header: "Service Date",    accessor: "serviceDate" },
  { header: "Bill Amount",     accessor: "billAmountDisplay" },
  { header: "Party Bill No",   accessor: "partyBillNo" },
  { header: "Service Location",accessor: "serviceLocation" },
  { header: "Job Monitoring By",accessor: "jobMonitoringBy" },
  { header: "Operator Name",   accessor: "operatorName" },
];

const SCHEDULE_COLS = [
  { header: "Sl. No",                accessor: "sl" },
  { header: "Machine ID",            accessor: "pmUid" },
  { header: "Machine Type",          accessor: "machineType" },
  { header: "Service Type",          accessor: "serviceType" },
  { header: "Service Schedule Date", accessor: "serviceDate" },
  { header: "Reading Under",         accessor: "readingUnder" },
  { header: "Expected Expenses",     accessor: "expectedExpensesDisplay" },
  { header: "Job Monitor By",        accessor: "responsiblePerson" },
];

function fmtAmount(v) {
  if (v == null) return "-";
  return Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ServiceDataPage({ canAdd = false }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("history");

  const [historyData, setHistoryData]     = useState([]);
  const [historyFiltered, setHistoryFiltered] = useState([]);
  const [historyLoading, setHistoryLoading]   = useState(true);

  const [scheduleData, setScheduleData]     = useState([]);
  const [scheduleFiltered, setScheduleFiltered] = useState([]);
  const [scheduleLoading, setScheduleLoading]   = useState(true);

  const actions = getPageActions({ router });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.RESOURCE.MACHINERY.SERVICE_HISTORY.LIST, method: "GET" });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((r, i) => ({
          ...r,
          sl:                 i + 1,
          pmUid:              r.pmUid           || "-",
          pmName:             r.pmName          || "-",
          serviceType:        r.serviceType     || "-",
          serviceDate:        getfmtDisplaydate(r.serviceDate),
          billAmountDisplay:  fmtAmount(r.billAmount),
          partyBillNo:        r.partyBillNo     || "-",
          serviceLocation:    r.serviceLocation || "-",
          jobMonitoringBy:    r.jobMonitoringBy || "-",
          operatorName:       r.operatorName    || "-",
        }));
        setHistoryData(formatted);
        setHistoryFiltered(formatted);
      } catch {
        toast.error("Failed to load Service History");
      } finally {
        setHistoryLoading(false);
      }
    };

    const fetchSchedule = async () => {
      try {
        const res = await apiRequest({ url: API_ENDPOINTS.RESOURCE.MACHINERY.SERVICE_SCHEDULE.LIST, method: "GET" });
        const list = Array.isArray(res?.data) ? res.data : [];
        const formatted = list.map((r, i) => ({
          ...r,
          sl:                      i + 1,
          pmUid:                   r.pmUid            || "-",
          machineType:             r.machineType      || "-",
          serviceType:             r.serviceType      || "-",
          serviceDate:             getfmtDisplaydate(r.serviceDate),
          readingUnder:            r.readingUnder     || "-",
          expectedExpensesDisplay: fmtAmount(r.expectedExpenses),
          responsiblePerson:       r.responsiblePerson || "-",
        }));
        setScheduleData(formatted);
        setScheduleFiltered(formatted);
      } catch {
        toast.error("Failed to load Service Schedule");
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchHistory();
    fetchSchedule();
  }, []);

  const handleHistorySearch = ({ search }) => {
    if (!search) { setHistoryFiltered(historyData); return; }
    const q = search.toLowerCase();
    setHistoryFiltered(historyData.filter((r) =>
      [r.pmUid, r.pmName, r.serviceType, r.serviceLocation, r.operatorName].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    ));
  };

  const handleScheduleSearch = ({ search }) => {
    if (!search) { setScheduleFiltered(scheduleData); return; }
    const q = search.toLowerCase();
    setScheduleFiltered(scheduleData.filter((r) =>
      [r.pmUid, r.machineType, r.serviceType, r.responsiblePerson].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    ));
  };

  const addActions = canAdd
    ? activeTab === "history"
      ? [{ label: "+ Service History", onClick: () => router.push("/resource-management/services/plant-machinery/pm-inventory/service-data/service-history/new") }]
      : [{ label: "+ Service Schedule", onClick: () => router.push("/resource-management/services/plant-machinery/pm-inventory/service-data/service-schedule/new") }]
    : [];

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        {/* Tabs */}
        <div className="flex gap-0 mb-3 border-b border-[#9e9e9e]">
          <button
            onClick={() => setActiveTab("history")}
            className={`px-5 py-1.5 text-sm font-medium border-t border-l border-r rounded-t transition-colors
              ${activeTab === "history"
                ? "bg-[#b7cfa5] border-[#9e9e9e] text-gray-800"
                : "bg-[#f0f0f0] border-[#d0d0d0] text-gray-500 hover:bg-[#e4e4e4]"}`}
          >
            Service History
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-5 py-1.5 text-sm font-medium border-t border-l border-r rounded-t transition-colors
              ${activeTab === "schedule"
                ? "bg-[#b7cfa5] border-[#9e9e9e] text-gray-800"
                : "bg-[#f0f0f0] border-[#d0d0d0] text-gray-500 hover:bg-[#e4e4e4]"}`}
          >
            Service Schedule
          </button>
        </div>

        {activeTab === "history" && (
          <>
            <SearchSection onSearch={handleHistorySearch} showDateRange={false} actions={addActions} />
            {historyLoading ? (
              <div className="flex justify-center items-center h-[200px]">
                <Loader2 className="animate-spin w-6 h-6" />
              </div>
            ) : (
              <DataTable
                columns={HISTORY_COLS}
                data={historyFiltered}
                onRowClick={(row) =>
                  router.push(`/resource-management/services/plant-machinery/pm-inventory/service-data/service-history/${row.id}`)
                }
              />
            )}
          </>
        )}

        {activeTab === "schedule" && (
          <>
            <SearchSection onSearch={handleScheduleSearch} showDateRange={false} actions={addActions} />
            {scheduleLoading ? (
              <div className="flex justify-center items-center h-[200px]">
                <Loader2 className="animate-spin w-6 h-6" />
              </div>
            ) : (
              <DataTable
                columns={SCHEDULE_COLS}
                data={scheduleFiltered}
                onRowClick={(row) =>
                  router.push(`/resource-management/services/plant-machinery/pm-inventory/service-data/service-schedule/${row.id}`)
                }
              />
            )}
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
