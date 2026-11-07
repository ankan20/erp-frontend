"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SearchSection from "@/components/common/SearchSection";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPageActions } from "@/components/common/PageActionButtons";
import PageHeader from "@/components/layout/PageHeader";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { TYPE_LABEL } from "@/components/contact-dairy/NatureOfServiceSelect";

const TABS = [
  { key: "creditor", label: "Sundry Creditor", type: "creditor" },
  { key: "debtor",   label: "Sundry Debtor",   type: "debtor"   },
];

export default function Page() {
  const router = useRouter();
  const canEdit = isMasterEditable();

  const actions = getPageActions({ router });

  const [activeTab, setActiveTab] = useState("creditor");

  // per-tab state
  const [tabData, setTabData] = useState({ creditor: [], debtor: [] });
  const [tabFiltered, setTabFiltered] = useState({ creditor: [], debtor: [] });
  const [loading, setLoading] = useState({ creditor: true, debtor: true });

  const fetchTab = async (type) => {
    try {
      const res = await apiRequest({
        url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER,
        method: "GET",
        params: { type },
      });

      const ledgers = res.data || [];
      const formatted = ledgers.map((p, index) => {
        const types = Array.isArray(p.supplierTypes) ? p.supplierTypes : [];
        const categoryDisplay = types.length
          ? types.map((t) => TYPE_LABEL[t] || t).join(", ")
          : p.categoryName || "—";
        return {
          ledgerId: p.ledgerId,
          sl: index + 1,
          ledgerCode: p.ledgerCode,
          ledgerName: p.ledgerName,
          categoryName: type === "debtor" ? (p.categoryName || "—") : categoryDisplay,
          whatsappNumber: p.whatsappNumber,
          siteCodes:       p.siteCodes        || "—",
          billingAddress:  p.corporateAddress || "—",
        };
      });

      setTabData((prev) => ({ ...prev, [type]: formatted }));
      setTabFiltered((prev) => ({ ...prev, [type]: formatted }));
    } catch (err) {
      toast.error(err.message || "Failed to fetch ledgers.");
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  useEffect(() => {
    fetchTab("creditor");
    fetchTab("debtor");
  }, []);

  const handleSearch = ({ search }) => {
    const source = tabData[activeTab];
    if (!search) {
      setTabFiltered((prev) => ({ ...prev, [activeTab]: source }));
      return;
    }
    const filtered = source.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(search.toLowerCase()),
      ),
    );
    setTabFiltered((prev) => ({ ...prev, [activeTab]: filtered }));
  };

  const creditorColumns = [
    { header: "Sl. no",          accessor: "sl" },
    { header: "Ledger Code",     accessor: "ledgerCode" },
    { header: "Party Name",      accessor: "ledgerName" },
    { header: "Category",        accessor: "categoryName" },
    { header: "Mobile",          accessor: "whatsappNumber" },
    { header: "Billing Address", accessor: "billingAddress" },
  ];

  const debtorColumns = [
    { header: "Sl. no",          accessor: "sl" },
    { header: "GL Code",         accessor: "ledgerCode" },
    { header: "Customer Name",   accessor: "ledgerName" },
    { header: "Site Codes",      accessor: "siteCodes" },
    { header: "Billing Address", accessor: "billingAddress" },
  ];

  const isLoading = loading[activeTab];

  return (
    <>
      <HeaderWrapper header={<PageHeader actions={actions} />}>
        <div className="p-3">

          {/* ── Tabs ── */}
          <div className="flex border-b border-[#b8c7da] mb-3">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2 text-[13px] font-semibold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#1c3a5e] text-[#1c3a5e]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Search + New button ── */}
          <SearchSection
            onSearch={handleSearch}
            actions={
              canEdit
                ? [
                    {
                      label: `+ New ${activeTab === "debtor" ? "Debtor" : "Ledger"}`,
                      onClick: () => router.push("/master/ledger-code/new"),
                    },
                  ]
                : []
            }
          />

          {/* ── Table ── */}
          {isLoading ? (
            <div className="flex justify-center items-center h-[200px]">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : (
            <DataTable
              columns={activeTab === "debtor" ? debtorColumns : creditorColumns}
              data={tabFiltered[activeTab]}
              onRowClick={(row) => router.push(`/master/ledger-code/${row.ledgerId}`)}
            />
          )}

        </div>
      </HeaderWrapper>
    </>
  );
}
