"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import SearchSection        from "@/components/common/SearchSection";
import DataTable            from "@/components/common/DataTable";
import HeaderWrapper        from "@/components/layout/HeaderWrapper";
import PageHeader           from "@/components/layout/PageHeader";
import PageNotAvailable     from "@/components/common/PageNotAvailable";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { getLocalStorage }  from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { useDeletePendingIds } from "@/hooks/useDeletePendingIds";

const TR = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.TRANSIT_REQUEST;

const WF_FILTERS      = ["All", "Draft", "Pending", "Approved", "Rejected"];
const TRANSIT_FILTERS = ["All", "Pending_Dispatch", "In_Transit", "Partially_Delivered", "Delivered"];

const TRANSIT_LABEL = {
  Pending_Dispatch:    "Pending Dispatch",
  In_Transit:          "In Transit",
  Partially_Delivered: "Partial Delivery",
  Delivered:           "Delivered",
};

const PRIORITY_CHIP = {
  High:   "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low:    "bg-green-50 text-green-700 border-green-200",
};

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "transit_request", pageType: "LIST", defaultToAllowed: true });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");
  const [tab,          setTab]          = useState("workflow");
  const [wfFilter,     setWfFilter]     = useState("All");
  const [trFilter,     setTrFilter]     = useState("All");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    setLoading(true);
    apiRequest({ url: `${TR.LIST}?projectCode=${projectCode}` })
      .then((res) => {
        const list = (res.data || []).map((r, i) => ({
          id:                  r.id,
          sl:                  i + 1,
          trNo:                r.trNo                || "",
          requestDate:         getfmtDisplaydate(r.requestDate),
          _rawDate:            r.requestDate         || "",
          orderType:           r.orderType           || "",
          route:               `${r.sourceLocation || "—"} → ${r.destinationLocation || "—"}`,
          priority:            r.priority            || "",
          workflowStatus:      r.workflowStatus      || "",
          transitStatus:       r.transitStatus       || "Pending_Dispatch",
        }));
        setData(list);
        setFilteredData(list);
      })
      .catch(() => toast.error("Failed to load Transit Request list"))
      .finally(() => setLoading(false));
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const wfCounts = useMemo(() => {
    const c = { Draft: 0, Pending: 0, Approved: 0, Rejected: 0 };
    data.forEach((r) => { if (r.workflowStatus in c) c[r.workflowStatus]++; });
    return c;
  }, [data]);

  const trCounts = useMemo(() => {
    const c = { Pending_Dispatch: 0, In_Transit: 0, Partially_Delivered: 0, Delivered: 0 };
    data.forEach((r) => { if (r.transitStatus in c) c[r.transitStatus]++; });
    return c;
  }, [data]);

  const applyFilters = (list, wf, tr, tabVal) => {
    let out = list;
    if (tabVal === "workflow" && wf !== "All")     out = out.filter((r) => r.workflowStatus === wf);
    if (tabVal === "transit"  && tr !== "All")     out = out.filter((r) => r.transitStatus  === tr);
    return out;
  };

  const handleSearch = ({ search, from, to }) => {
    let out = applyFilters(data, wfFilter, trFilter, tab);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
    }
    if (from || to) {
      out = out.filter((r) => {
        if (!r._rawDate) return false;
        const d = new Date(r._rawDate); d.setHours(0, 0, 0, 0);
        if (from) { const f = new Date(from); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (to)   { const t = new Date(to);   t.setHours(0, 0, 0, 0); if (d > t) return false; }
        return true;
      });
    }
    setFilteredData(out);
  };

  const switchTab = (t) => {
    setTab(t);
    setFilteredData(applyFilters(data, wfFilter, trFilter, t));
  };

  const handleWfChip = (s) => {
    setWfFilter(s);
    setFilteredData(applyFilters(data, s, trFilter, tab));
  };

  const handleTrChip = (s) => {
    setTrFilter(s);
    setFilteredData(applyFilters(data, wfFilter, s, tab));
  };

  const columns = [
    { header: "Sl. No",      accessor: "sl"           },
    { header: "TR No",       accessor: "trNo"         },
    { header: "Date",        accessor: "requestDate"  },
    { header: "Order Type",  accessor: "orderType"    },
    { header: "Route",       accessor: "route"        },
    {
      header: "Priority",
      accessor: "priority",
      render: (row) => {
        const cls = PRIORITY_CHIP[row.priority] || "bg-gray-50 text-gray-600 border-gray-200";
        return (
          <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
            {row.priority || "—"}
          </span>
        );
      },
    },
    { header: "Workflow",    accessor: "workflowStatus" },
    {
      header: "Transit",
      accessor: "transitStatus",
      render: (row) => (
        <span className="text-[11px] text-gray-600">{TRANSIT_LABEL[row.transitStatus] || row.transitStatus || "—"}</span>
      ),
    },
  ];

  const actions = getPageActions({ router });
  const pendingDeleteIds = useDeletePendingIds("TR", access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ New TR", onClick: () => router.push("/logistics/transit-request/new") }]
              : []
          }
        />

        {/* Minimal tab switcher */}
        <div className="flex gap-0 border-b border-gray-200 mb-3">
          {[
            { key: "workflow", label: "Workflow Status" },
            { key: "transit",  label: "Transit Status"  },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`px-4 py-1.5 text-[13px] font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "border-[#144664] text-[#144664]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {tab === "workflow"
            ? WF_FILTERS.map((s) => {
                const count = s === "All" ? data.length : wfCounts[s] ?? 0;
                const active = wfFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleWfChip(s)}
                    className={`px-2.5 py-0.5 text-[12px] rounded-sm border transition-colors ${
                      active
                        ? "bg-[#144664] text-white border-[#144664]"
                        : "bg-white text-gray-600 border-gray-300 hover:border-[#144664] hover:text-[#144664]"
                    }`}
                  >
                    {s}: {count}
                  </button>
                );
              })
            : TRANSIT_FILTERS.map((s) => {
                const count = s === "All" ? data.filter((r) => r.workflowStatus === "Approved").length : trCounts[s] ?? 0;
                const active = trFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleTrChip(s)}
                    className={`px-2.5 py-0.5 text-[12px] rounded-sm border transition-colors ${
                      active
                        ? "bg-[#144664] text-white border-[#144664]"
                        : "bg-white text-gray-600 border-gray-300 hover:border-[#144664] hover:text-[#144664]"
                    }`}
                  >
                    {s === "All" ? "All" : (TRANSIT_LABEL[s] || s)}: {count}
                  </button>
                );
              })
          }
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-sm text-gray-400">Loading…</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => access.canOpenDetails && router.push(`/logistics/transit-request/${row.id}`)}
            pendingDeleteIds={pendingDeleteIds}
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
