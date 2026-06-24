"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { getPageActions } from "@/components/common/PageActionButtons";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

const BC = API_ENDPOINTS.MASTER.BANK_CASH;

export default function Page() {
  const router = useRouter();
  const canEdit = isMasterEditable();
  const actions = getPageActions({ router });

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchList = async () => {
      try {
        const res = await apiRequest({ url: BC.LIST, method: "GET" });
        const list = (res.data || []).map((item, index) => ({
          id:                   item.id,
          sl:                   index + 1,
          type:                 item.type,
          bankCode:             item.bankCode,
          bankHolderName:       item.bankHolderName,
          bankAcNumber:         item.bankAcNumber   || "—",
          bankName:             item.bankName       || "—",
          branchName:           item.branchName     || "—",
          ifscCode:             item.ifscCode       || "—",
          branchManagerName:    item.branchManagerName    || "—",
          branchManagerContact: item.branchManagerContact || "—",
          status:               item.status,
        }));
        setData(list);
        setFilteredData(list);
      } catch (err) {
        toast.error(err.message || "Failed to fetch bank/cash list");
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, []);

  const handleSearch = ({ search }) => {
    if (!search) { setFilteredData(data); return; }
    setFilteredData(
      data.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search.toLowerCase())
        )
      )
    );
  };

  const columns = [
    { header: "Sl. No",                accessor: "sl" },
    { header: "Type",                  accessor: "type" },
    { header: "Bank Code",             accessor: "bankCode" },
    { header: "Bank Holder Name",      accessor: "bankHolderName" },
    { header: "A/c Number",            accessor: "bankAcNumber" },
    { header: "Bank Name",             accessor: "bankName" },
    { header: "Branch Name",           accessor: "branchName" },
    { header: "IFSC Code",             accessor: "ifscCode" },
    { header: "Branch Manager",        accessor: "branchManagerName" },
    { header: "Manager Contact",       accessor: "branchManagerContact" },
    { header: "Status",                accessor: "status" },
  ];

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
          actions={
            canEdit
              ? [{ label: "+ New Bank/Cash", onClick: () => router.push("/master/bank-cash/new") }]
              : []
          }
        />
        <DataTable
          columns={columns}
          data={filteredData}
          onRowClick={(row) => router.push(`/master/bank-cash/${row.id}`)}
        />
      </div>
    </HeaderWrapper>
  );
}
