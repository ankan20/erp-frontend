"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { getPageAccess } from "@/helper/getPageAccess";
import { usePageActions } from "@/components/common/PageActionButtons";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount } from "@/helper/numberFormatter";

import AccountingFilterBar from "@/components/finance/report/accounting/AccountingFilterBar";
import AccountingTable from "@/components/finance/report/accounting/AccountingTable";
import useAccountingFetch from "@/components/finance/report/accounting/useAccountingFetch";
import { exportPDF, exportExcel } from "@/components/finance/report/accounting/exportAccounting";

const COLUMNS = [
  { key: "customerCode", label: "Customer Code" },
  { key: "customerName", label: "Customer Name", className: "min-w-[200px]" },
  { key: "balance", label: "Outstanding", type: "amount", align: "right" },
];

export default function OutstandingReceivablesPage() {
  const access = getPageAccess({ pageCode: "accounting_outstanding_receivables", pageType: "LIST" });
  const router = useRouter();
  const {
    projectCode, setProjectCode, fromDate, setFromDate, toDate, setToDate,
    data, loading, fetched, projectList, handleFetch, handleReset,
  } = useAccountingFetch(API_ENDPOINTS.FINANCE.ACCOUNTING.OUTSTANDING_RECEIVABLES);

  const period = fromDate && toDate ? `${fromDate} to ${toDate}` : "";

  const onPDF = useCallback(() => {
    if (!data?.rows) return;
    const bodyRows = data.rows.map((c) => [
      c.ledgerCode || "", c.ledgerName || "", formatAmount(c.outstanding || 0),
    ]);
    bodyRows.push(["", "GRAND TOTAL", formatAmount(data.total || 0)]);
    exportPDF({
      title: "Outstanding Receivables",
      period, project: projectCode || "All",
      filename: "outstanding_receivables",
      head: [["Customer Code", "Customer Name", "Outstanding"]],
      body: bodyRows,
      columnStyles: { 2: { halign: "right" } },
      amountColumns: [2],
    });
  }, [data, period, projectCode]);

  const onExcel = useCallback(() => {
    if (!data?.rows) return;
    const excelRows = data.rows.map((c) => [
      c.ledgerCode || "", c.ledgerName || "", c.outstanding || 0,
    ]);
    excelRows.push(["", "GRAND TOTAL", data.total || 0]);
    exportExcel({
      title: "Outstanding Receivables",
      period, project: projectCode || "All",
      filename: "outstanding_receivables",
      sheetName: "Receivables",
      headers: ["Customer Code", "Customer Name", "Outstanding"],
      rows: excelRows,
      colWidths: [15, 35, 18],
    });
  }, [data, period, projectCode]);

  const { rows, footerRow } = useMemo(() => {
    if (!data?.rows) return { rows: [], footerRow: null };
    const rows = data.rows.map((c, i) => ({
      _key: i,
      customerCode: c.ledgerCode || "",
      customerName: c.ledgerName || "",
      balance: c.outstanding,
    }));
    const footerRow = data.total != null ? {
      customerCode: "", customerName: "GRAND TOTAL", balance: data.total,
    } : null;
    return { rows, footerRow };
  }, [data]);

  const actions = usePageActions({ router });


  if (!access.allowed) return <PageNotAvailable />;
  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div className="p-3 space-y-3">
        <AccountingFilterBar
          projectList={projectList}
          projectCode={projectCode}
          setProjectCode={setProjectCode}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          loading={loading}
          fetched={fetched}
          onFetch={handleFetch}
          onReset={handleReset}
          onPDF={onPDF}
          onExcel={onExcel}
        />

        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
            <EdoxMark size={32} />
          </div>
        ) : !fetched ? (
          <div className="flex flex-col items-center justify-center h-[280px] text-gray-400 text-[13px] gap-1">
            <Search size={22} className="opacity-40" />
            Press Fetch to view Outstanding Receivables
          </div>
        ) : (
          <>
            {data?.total != null && (
              <div className="flex gap-3 text-[12px]">
                <span className="px-3 py-1 bg-[#e8f4e8] rounded border border-[#b0d4b0] font-semibold">
                  Total Receivable: {formatAmount(Math.abs(data.total))}
                </span>
              </div>
            )}
            <AccountingTable columns={COLUMNS} rows={rows} footerRow={footerRow} emptyMessage="No outstanding receivables" />
          </>
        )}
      </div>
    </HeaderWrapper>
  );
}
