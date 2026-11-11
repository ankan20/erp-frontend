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
  const access = getPageAccess({ pageCode: "profit_loss", pageType: "LIST" });
  const router = useRouter();

  if (!access.allowed) return <PageNotAvailable />;

  return (
    <HeaderWrapper header={<PageHeader />}>
      <div className="p-4 space-y-6">
        <div>
          <h1 className="text-lg font-bold text-[#1a1a4e]">Central Accounting</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Unified accounting ledger reports powered by the central posting engine
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-[13px] font-semibold text-[#5a5aaa] uppercase tracking-wide mb-2">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className="flex items-start gap-3 p-3 border border-[#d0d0e0] rounded-md bg-white hover:bg-[#f5f5ff] hover:border-[#8888cc] transition-colors text-left group"
                  >
                    <div className="mt-0.5 p-1.5 rounded bg-[#eeeef8] group-hover:bg-[#ddddf8] transition-colors">
                      <Icon size={16} className="text-[#5a5aaa]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#1a1a4e]">{item.label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{item.desc}</div>
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
