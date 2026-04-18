"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";

export default function Page() {
  const router = useRouter();

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  //  DUMMY DATA (replace with API later)
  const dummyData = [
    {
      sl: 1,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9007011223",
      whatsapp: "9007011223",
      status: "Active",
    },
    {
      sl: 2,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9007011223",
      whatsapp: "9007011223",
      status: "Active",
    },
    {
      sl: 3,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9007011223",
      whatsapp: "9007011223",
      status: "Active",
    },
    {
      sl: 4,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9007011223",
      whatsapp: "9007011223",
      status: "Active",
    },
    {
      sl: 4,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9007011223",
      whatsapp: "9007011223",
      status: "Active",
    },
    {
      sl: 4,
      username: "Biswajit Dinda",
      category: "Super Admin",
      email: "biswajit.dinda@dishaanhitech.com",
      mobile: "9832661429",
      whatsapp: "9007011223",
      status: "Active",
    },

  ];

  //  INITIAL LOAD (API PLACEHOLDER)
  useEffect(() => {
    //  TODO: Replace with API call
    // fetch("/api/users")
    //   .then(res => res.json())
    //   .then(data => {
    //     setData(data);
    //     setFilteredData(data);
    //   });

    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // ✅ SEARCH HANDLER
  const handleSearch = ({ search }) => {
    //  TODO: Replace with API search call
    // fetch(`/api/users?search=${search}`)

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

  //  TABLE COLUMNS
  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "User Name", accessor: "username" },
    { header: "User Category", accessor: "category" },
    { header: "Email", accessor: "email" },
    { header: "Mobile", accessor: "mobile" },
    { header: "WhatsApp", accessor: "whatsapp" },
    { header: "Status", accessor: "status" },
  ];

  return (
    <div className="p-3">

      {/*  SEARCH SECTION */}
      <SearchSection
        onSearch={handleSearch}
        actions={[
          {
            label: "+ Add User",
            onClick: () => router.push("/settings/users/new"),
          },
          
        ]}
      />

      {/*  TABLE */}
      <DataTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) => {
          router.push(`/settings/users/${row.sl}`);
        }}
      />
    </div>
  );
}