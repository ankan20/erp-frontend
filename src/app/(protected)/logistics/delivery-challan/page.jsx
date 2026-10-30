"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { useDeletePendingIds } from "@/hooks/useDeletePendingIds";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageActions } from "@/components/common/PageActionButtons";
import { getPageAccess } from "@/helper/getPageAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getFormatCategoryName } from "@/helper/getFormatCategoryName";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({ pageCode: "delivery_challan", pageType: "LIST" });

  const [data,         setData]         = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [projectCode,  setProjectCode]  = useState("");

  useEffect(() => {
    const projectInfo = getLocalStorage("projectInfo") || {};
    setProjectCode(projectInfo?.projectCode || "");
  }, []);

  useEffect(() => {
    if (!projectCode || !access.allowed) return;

    const fetchList = async () => {
      try {
        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.LIST}?projectCode=${projectCode}`,
          method: "GET",
        });

        const list = res.data || [];

        const formatted = list.map((r, index) => ({
          id:                 r.id,
          sl:                 index + 1,
          dcNo:               r.dcNo               || "",
          challanDate:        r.challanDate         || "",
          orderType:          getFormatCategoryName(r.orderType) || "",
          orderNo:            r.orderNo             || "",
          fromName:           r.fromName            || "",
          toProjectCode:      r.toProjectCode       || "",
          toProjectName:      r.toProjectName       || "",
          purposeForDelivery: getFormatCategoryName(r.purposeForDelivery) || "",
          noOfItems:          r.noOfItems           ?? "",
          ewayBillNumber:     r.ewayBillNumber      || "",
          workflowStatus:     r.workflowStatus      || "",
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch {
        toast.error("Failed to fetch Delivery Challan list");
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.challanDate) return false;
        const d = new Date(item.challanDate);
        d.setHours(0, 0, 0, 0);
        if (from) {
          const f = new Date(from);
          f.setHours(0, 0, 0, 0);
          if (d < f) return false;
        }
        if (to) {
          const t = new Date(to);
          t.setHours(0, 0, 0, 0);
          if (d > t) return false;
        }
        return true;
      });
    }

    setFilteredData(filtered);
  };

  const columns = [
    { header: "Sl. No",             accessor: "sl"                 },
    { header: "DC No",              accessor: "dcNo"               },
    { header: "Challan Date",       accessor: "challanDate"        },
    { header: "Order Type",         accessor: "orderType"          },
    { header: "Order No",           accessor: "orderNo"            },
    { header: "From",               accessor: "fromName"           },
    { header: "To Project Code",    accessor: "toProjectCode"      },
    { header: "To Project Name",    accessor: "toProjectName"      },
    { header: "Purpose",            accessor: "purposeForDelivery" },
    { header: "No. of Items",       accessor: "noOfItems"          },
    { header: "Eway Bill No",       accessor: "ewayBillNumber"     },
    { header: "Status",             accessor: "workflowStatus"     },
  ];

  const actions = getPageActions({ router });

  const pendingDeleteIds = useDeletePendingIds("DC", access.allowed);

  if (!access.allowed) return <PageNotAvailable />;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3">
        <SearchSection
          onSearch={handleSearch}
          showDateRange={true}
          actions={
            access.canAdd
              ? [
                  {
                    label: "+ New DC",
                    onClick: () =>
                      router.push("/logistics/delivery-challan/new"),
                  },
                ]
              : []
          }
        />

        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => {
            if (access.canOpenDetails) {
              router.push(`/logistics/delivery-challan/${row.id}`);
            }
          }}
        pendingDeleteIds={pendingDeleteIds}
        />
      </div>
    </HeaderWrapper>
  );
}
