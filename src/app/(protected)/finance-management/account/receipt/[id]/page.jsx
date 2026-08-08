"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter }             from "next/navigation";
import { Loader2, Plus }                    from "lucide-react";
import { toast }                            from "sonner";

import HeaderWrapper     from "@/components/layout/HeaderWrapper";
import PageHeader        from "@/components/layout/PageHeader";
import PageNotAvailable  from "@/components/common/PageNotAvailable";
import DataTable         from "@/components/common/DataTable";
import { getPageActions }   from "@/components/common/PageActionButtons";
import { getPageAccess }    from "@/helper/getPageAccess";
import { apiRequest }       from "@/lib/apiClient";
import { API_ENDPOINTS }    from "@/config/api.config";
import { getLocalStorage }  from "@/lib/localStorage";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { formatAmount }     from "@/helper/numberFormatter";
import SaleReceiptParentForm from "@/components/finance/account/sale/SaleReceiptParentForm";

export default function Page() {
  const router = useRouter();
  const { id } = useParams();
  const access = getPageAccess({ pageCode: "receipt", pageType: "EDIT" });

  const [billings,        setBillings]        = useState([]);
  const [billingsLoading, setBillingsLoading] = useState(true);
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const mapBillings = (list) =>
    (list || []).map((b, i) => ({
      sl:              i + 1,
      _id:             b.id,
      srbNo:           b.srbNo               || "—",
      certifiedBillNo: b.certifiedBillNo     || b.billAbstractNo || "—",
      invoiceNo:       b.invoiceNo           || "—",
      invoiceDate:     b.invoiceDate ? getfmtDisplaydate(b.invoiceDate) : "—",
      basicAmount:     b.basicAmount         != null ? formatAmount(b.basicAmount)         : "—",
      gstAmount:       b.gstAmount           != null ? formatAmount(b.gstAmount)           : "—",
      totalAmount:     b.totalInvoiceAmount  != null ? formatAmount(b.totalInvoiceAmount)  : "—",
      workflowStatus:  b.workflowStatus      || "Draft",
      _raw: b,
    }));

  const fetchBillings = useCallback(async () => {
    if (!id || !projectCode) return;
    setBillingsLoading(true);
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_RECEIPT.GET_BY_ID}${id}`,
        method: "GET",
      });
      setBillings(mapBillings(res.data?.billings));
    } catch {
      toast.error("Failed to load billings");
    } finally {
      setBillingsLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchBillings(); }, [fetchBillings]);

  if (!access.allowed) return <PageNotAvailable />;

  const billingColumns = [
    { header: "Sl.",            accessor: "sl",              width: "45px"  },
    { header: "SRB No",         accessor: "srbNo",           width: "130px" },
    { header: "Certified Bill", accessor: "certifiedBillNo", width: "140px" },
    { header: "Invoice No",     accessor: "invoiceNo",       width: "120px" },
    { header: "Invoice Date",   accessor: "invoiceDate",     width: "105px" },
    { header: "Basic Amt",      accessor: "basicAmount",     width: "105px", align: "right" },
    { header: "GST Amt",        accessor: "gstAmount",       width: "100px", align: "right" },
    { header: "Total Amt",      accessor: "totalAmount",     width: "105px", align: "right" },
    { header: "Status", accessor: "workflowStatus", width: "110px" },
  ];

  return (
    <HeaderWrapper header={<PageHeader actions={getPageActions({ router })} />}>
      <div className="p-4 space-y-5">

        {/* Parent Receipt Form */}
        <div className="border border-gray-200 rounded-sm">
          <div className="bg-[#f0f4fa] px-3 py-2 border-b border-gray-200">
            <h2 className="text-[13px] font-semibold text-[#3b6ea5]">Receipt Details</h2>
          </div>
          <div className="p-3 max-w-[520px]">
            <SaleReceiptParentForm mode="edit" receiptId={id} onSaved={fetchBillings} />
          </div>
        </div>

        {/* Child Billings Table */}
        <div className="border border-gray-200 rounded-sm">
          <div className="bg-[#f0f4fa] px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-[#3b6ea5]">
              Sale Receipt Billings
              {billings.length > 0 && (
                <span className="ml-2 text-[11px] font-normal text-gray-500">({billings.length})</span>
              )}
            </h2>
            {access.canAdd && (
              <button
                type="button"
                onClick={() => router.push(`/finance-management/account/receipt-billing/new?receiptId=${id}`)}
                className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-sm border border-[#3b6ea5] text-[#3b6ea5] hover:bg-[#3b6ea5] hover:text-white transition"
              >
                <Plus size={13} />
                Add Billing
              </button>
            )}
          </div>
          <div className="p-2">
            {billingsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="animate-spin w-5 h-5 text-gray-400" />
              </div>
            ) : (
              <DataTable
                columns={billingColumns}
                data={billings}
                emptyMessage="No billings yet. Click '+ Add Billing' to create one."
                onRowClick={(row) => router.push(`/finance-management/account/receipt-billing/${row._id}`)}
              />
            )}
          </div>
        </div>

      </div>
    </HeaderWrapper>
  );
}
