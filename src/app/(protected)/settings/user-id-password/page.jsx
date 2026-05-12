"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { roleMap } from "@/config/role.config";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import HeaderWrapper from "@/components/layout/HeaderWrapper";

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiRequest({
          url: API_ENDPOINTS.SETTINGS.GET_ALL_USERS,
          method: "GET",
        });

        // adjust based on your backend response
        const users = res.data || [];

        // map API → table format
        const formatted = users.map((item, index) => ({
          id:item.id,
          sl:  index + 1,
          username: item.userName,
          category: roleMap[item.role] || item.role, // or map if needed
          email: item.email,
          mobile: item.mobile,
          whatsapp: item.whatsapp,
          status: item.status ? "ACTIVE" : "SUSPENDED",
        }));

        setData(formatted);
        setFilteredData(formatted);
      } catch (err) {
        toast.error("Failed to fetch users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // ✅ SEARCH HANDLER
  const handleSearch = ({ search }) => {
    //  TODO: Replace with API search call

    if (!search) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase())
      )
    );

    setFilteredData(filtered);
  };

  const actions = getPageActions({
      
      onHome: () => router.push("/dashboard"),
      onBack: () => router.back(),
      
    });

  //  TABLE COLUMNS
  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "User Name", accessor: "username" },
    { header: "User Category", accessor: "category" },
    { header: "Email", accessor: "email" },
    { header: "Mobile", accessor: "mobile" },
    { header: "WhatsApp", accessor: "whatsapp" },
    { header: "Status", accessor: "status" ,width:"85px"},
  ];

  // LOADER 
  if (loading) {
    return (
      <div className="flex justify-center items-center h-75">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  return (
    <>
        <HeaderWrapper
      header={<PageHeader actions={actions} />}
    >
              <div className="p-3">

      {/*  SEARCH SECTION */}
      <SearchSection
        onSearch={handleSearch}
        actions={[
          {
            label: "+ Add User",
            onClick: () => router.push("/settings/user-id-password/new"),
          },
        ]}
      />

      {/*  TABLE */}
      <DataTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) => {
          router.push(`/settings/user-id-password/${row.id}`);
        }}
      />
    </div>
    </HeaderWrapper>
    </>
    
  );
}