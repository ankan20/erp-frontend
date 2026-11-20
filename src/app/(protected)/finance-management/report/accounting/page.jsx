"use client";

import { useRouter } from "next/navigation";
import {
  BookOpen, Scale, TrendingUp, Building2, Users, Landmark,
  Grid3X3, Calendar, ClipboardList, AlertCircle, Receipt,
  FileBarChart, FolderTree, Clock, Database, Wallet
} from "lucide-react";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";

const BASE = "/finance-management/report/accounting";

const SECTIONS = [
  {
    title: "Primary Reports",
    items: [
      { label: "General Ledger",  path: `${BASE}/general-ledger`,  icon: BookOpen,     desc: "Complete account-wise ledger with running balance" },
      { label: "Trial Balance",   path: `${BASE}/trial-balance`,   icon: Scale,        desc: "Debit/credit totals by account" },
      { label: "Profit & Loss",   path: `${BASE}/profit-loss`,     icon: TrendingUp,   desc: "Revenue vs expenses statement" },
      { label: "Balance Sheet",   path: `${BASE}/balance-sheet`,   icon: Building2,    desc: "Assets, liabilities & equity" },
    ],
  },
  {
    title: "Subsidiary Ledgers",
    items: [
      { label: "Vendor Ledger",   path: `${BASE}/vendor-ledger`,   icon: Users,        desc: "Creditor-wise transactions" },
      { label: "Customer Ledger", path: `${BASE}/customer-ledger`, icon: Users,        desc: "Debtor-wise transactions" },
      { label: "Bank Ledger",     path: `${BASE}/bank-ledger`,     icon: Landmark,     desc: "Bank account transactions" },
      { label: "CC-Code Ledger",  path: `${BASE}/cc-ledger`,       icon: Grid3X3,      desc: "Cost-centre wise transactions" },
      { label: "Group Ledger",    path: `${BASE}/group-ledger`,    icon: FolderTree,   desc: "Group-wise account summary" },
    ],
  },
  {
    title: "Registers & Books",
    items: [
      { label: "Day Book",           path: `${BASE}/day-book`,           icon: Calendar,      desc: "All postings for a date" },
      { label: "Voucher Register",   path: `${BASE}/voucher-register`,   icon: ClipboardList, desc: "Filterable posting list" },
      { label: "Project Summary",    path: `${BASE}/project-summary`,    icon: FileBarChart,  desc: "Project financial overview" },
    ],
  },
  {
    title: "Outstanding & GST",
    items: [
      { label: "Outstanding Payables",    path: `${BASE}/outstanding-payables`,    icon: AlertCircle, desc: "Net vendor balances" },
      { label: "Outstanding Receivables",  path: `${BASE}/outstanding-receivables`, icon: AlertCircle, desc: "Net customer balances" },
      { label: "GST Summary",             path: `${BASE}/gst-summary`,             icon: Receipt,     desc: "Input/output/net payable" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Financial Year",  path: `${BASE}/financial-year`,  icon: Clock,    desc: "Manage financial years" },
      { label: "Historical Posting",  path: `${BASE}/historical-posting`,  icon: Database, desc: "Post approved documents & view status" },
      { label: "Opening Balance",    path: `${BASE}/opening-balance`,    icon: Wallet,   desc: "Manage opening balances per FY" },
    ],
  },
];

export default function AccountingDashboardPage() {
  const access = getPageAccess({ pageCode: "accounting_dashboard", pageType: "LIST" });
  const router = useRouter();

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader />}>
      <div className="p-3 space-y-4">
        <div className="border-b border-[#d1d5db] pb-3">
          <h1 className="text-[15px] font-bold text-[#144664]">Central Accounting</h1>
          <p className="text-[11.5px] text-[#6b7280] mt-0.5">
            Unified accounting ledger reports powered by the central posting engine
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-[11px] font-semibold text-[#1b2f3a] uppercase tracking-wide mb-2">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className="flex items-start gap-2.5 p-2.5 border border-[#d1d5db] bg-white hover:bg-[#f0f4f8] hover:border-[#1b2f3a]/30 transition-colors text-left group"
                  >
                    <div className="mt-0.5 p-1.5 bg-[#1b2f3a]/8 group-hover:bg-[#1b2f3a]/15 transition-colors">
                      <Icon size={15} className="text-[#1b2f3a]" />
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[#374151] group-hover:text-[#144664] transition-colors">{item.label}</div>
                      <div className="text-[10.5px] text-[#9ca3af] mt-0.5 leading-tight">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </HeaderWrapper>
  );
}
