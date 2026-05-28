"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageAccess } from "@/helper/getPageAccess";
import PageNotAvailable from "@/components/common/PageNotAvailable";

export default function Page() {
  const router = useRouter();
  const access = getPageAccess({
    pageCode: "indent",
    pageType: "LIST",
  });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  //  INITIAL LOAD
  useEffect(() => {
    const fetchIndents = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.RESOURCE.INDENT.GET_ALL_INDENT,
          method: "GET",
        });

        const indents = res.data || [];

        const formatted = indents.map((p, index) => ({
          id: p.id,
          sl: index + 1,
          indentNo: p.indentNo,
          date: p.createdAt,
          categoryCode: p.categoryCode,
          priority: p.priority,
          indentStatus: p.indentStatus,
          orderStatus:
            p.orderStatus === "ongoing"
              ? "Ongoing"
              : p.orderStatus === "hold"
                ? "Hold"
                : p.orderStatus === "completed"
                  ? "Completed"
                  : p.orderStatus,
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error("Failed to fetch indents");
      } finally {
        setLoading(false);
      }
    };

    fetchIndents();
  }, []);

  // SEARCH HANDLER
  const handleSearch = ({ search, from, to }) => {
    let filtered = [...data];

    // TEXT SEARCH
    if (search) {
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase()),
        ),
      );
    }

    // DATE FILTER
    if (from || to) {
      filtered = filtered.filter((item) => {
        if (!item.date) return false;

        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        // FROM DATE
        if (from) {
          const fromDate = new Date(from);
          fromDate.setHours(0, 0, 0, 0);

          if (itemDate < fromDate) {
            return false;
          }
        }

        // TO DATE
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(0, 0, 0, 0);

          if (itemDate > toDate) {
            return false;
          }
        }

        return true;
      });
    }

    setFilteredData(filtered);
  };

  //  TABLE COLUMNS
  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "Indent No", accessor: "indentNo" },
    { header: "Date", accessor: "date" },
    { header: "Category", accessor: "categoryCode" },
    { header: "Priority", accessor: "priority" },
    { header: "Indent Status", accessor: "indentStatus" },
    { header: "Order Status", accessor: "orderStatus" },
  ];
  const actions = getPageActions({
    router,
  });

  if (!access.allowed) {
    return <PageNotAvailable />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-3 ">
          {/*  SEARCH SECTION */}
          <SearchSection
            onSearch={handleSearch}
            showDateRange={true}
            actions={
              access.canAdd
                ? [
                    {
                      label: "+ New Indent",
                      onClick: () =>
                        router.push(
                          "/resource-management/procurement/indent/new",
                        ),
                    },
                  ]
                : []
            }
          />

          {/*  TABLE */}
          <DataTable
            columns={columns}
            data={filteredData}
            onRowClick={(row) => {
              router.push(`/resource-management/procurement/indent/${row.id}`);
            }}
          />
        </div>
      </HeaderWrapper>
    </>
  );
}
