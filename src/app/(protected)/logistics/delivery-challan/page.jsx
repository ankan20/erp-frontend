"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import SearchSection        from "@/components/common/SearchSection";
import BulkWorkflowTable from "@/components/common/BulkWorkflowTable";
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

const DC = API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC;

const STATUS_FILTERS = ["All", "Draft", "Pending", "Approved", "Rejected"];

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "delivery_challan", pageType: "LIST", defaultToAllowed: true });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const info = getLocalStorage("projectInfo") || {};
    setProjectCode(info?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;
    setLoading(true);
    apiRequest({ url: `${DC.LIST}?projectCode=${projectCode}` })
      .then((res) => {
        const list = (res.data || []).map((r, i) => ({
          createdTs: r.createdTs,
          id:              r.id,
          sl:              i + 1,
          dcNo:            r.dcNo            || "",
          challanDate:     getfmtDisplaydate(r.challanDate),
          _rawDate:        r.challanDate     || "",
          toProjectName:   r.toProjectName   || "",
          transporterName: r.transporterName || "",
          vehicleNo:       r.vehicleNo       || "",
          noOfItems:       r.noOfItems       ?? "",
          workflowStatus:  r.workflowStatus  || "",
        }));
        setData(list);
        setFilteredData(list);
      })
      .catch(() => toast.error("Failed to load Delivery Challan list"))
      .finally(() => setLoading(false));
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { Draft: 0, Pending: 0, Approved: 0, Rejected: 0 };
    data.forEach((r) => { if (r.workflowStatus in c) c[r.workflowStatus]++; });
    return c;
  }, [data]);

  const handleSearch = ({ search, from, to }) => {
    let out = applyStatusFilter(data, statusFilter);
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

  const applyStatusFilter = (list, filter) =>
    filter === "All" ? list : list.filter((r) => r.workflowStatus === filter);

  const handleStatusChip = (s) => {
    setStatusFilter(s);
    setFilteredData(applyStatusFilter(data, s));
  };

  const columns = [
    { header: "Sl. No",      accessor: "sl"              },
    { header: "DC No",       accessor: "dcNo"            },
    { header: "Date",        accessor: "challanDate"     },
    { header: "To Project",  accessor: "toProjectName"   },
    { header: "Transporter", accessor: "transporterName" },
    { header: "Vehicle No",  accessor: "vehicleNo"       },
    { header: "Items",       accessor: "noOfItems",   align: "center" },
    { header: "Status",      accessor: "workflowStatus"  },
  ];

  const actions = getPageActions({ router });
  const pendingDeleteIds = useDeletePendingIds("DC", access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange
          actions={
            access.canAdd
              ? [{ label: "+ New DC", onClick: () => router.push("/logistics/delivery-challan/new") }]
              : []
          }
        />

        {/* Status chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {STATUS_FILTERS.map((s) => {
            const count = s === "All" ? data.length : counts[s] ?? 0;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChip(s)}
                className={`px-2.5 py-0.5 text-[12px] rounded-sm border transition-colors ${
                  active
                    ? "bg-[#144664] text-white border-[#144664]"
                    : "bg-white text-gray-600 border-gray-300 hover:border-[#144664] hover:text-[#144664]"
                }`}
              >
                {s}: {count}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-sm text-gray-400">Loading…</div>
        ) : (
          <BulkWorkflowTable module="dc" canAct={access.canApprove} rowId="id" statusKey="workflowStatus"
            columns={columns}
            data={filteredData}
            onRowClick={(row) => access.canOpenDetails && router.push(`/logistics/delivery-challan/${row.id}`)}
            pendingDeleteIds={pendingDeleteIds}
          />
        )}
      </div>
    </HeaderWrapper>
  );
}
