"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt } from "@/components/print/printStyles";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function fmtAmt(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function InfoRow({ label, value, wide }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 ${wide ? "w-[180px] min-w-[180px]" : "w-[150px] min-w-[150px]"}`}>
        {label}
      </span>
      <span className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.valueText} ${WEIGHT.normal} text-gray-900 flex-1`}>{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="mt-4 mb-1.5 border-b border-gray-300 pb-0.5">
      <span className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-800 uppercase tracking-wide`}>
        {children}
      </span>
    </div>
  );
}

/* ─── Excel download ───────────────────────────────────────────────────────── */

function downloadExcel(d) {
  const XLSX = require("xlsx");
  const rows = [
    ["BILL RECEIVE REGISTER (BRR)"],
    [],
    ["BRR No",             d.brrNo,          "", "BRR Date",          fmt.date(d.brrDate)],
    ["Project Code",       d.projectCode,    "", "Order No",          d.orderNo || "—"],
    ["Order Category",     d.orderCategory || "—", "", "Order Date",  fmt.date(d.orderDate)],
    [],
    ["Party Name",         d.partyName,      "", "Party GSTIN",       d.partyGstn || "—"],
    ["Party Bill No",      d.partyBillNo,    "", "Party Bill Date",   fmt.date(d.partyDate)],
    [],
    ["Received Category",  d.receivedCategory || "—"],
    ["Submitted By Name",  d.submittedByName  || "—", "", "Submission Date", fmt.date(d.submissionDate)],
    ["Received Through",   d.receivedThrough  || "—"],
    ["Received Reference", d.receivedReference|| "—"],
    [],
    ["Basic Amount",       d.basicAmount],
    ["GST Amount",         d.gstAmount],
    ["Total Amount",       d.totalAmount],
    [],
    ["Workflow Status",    d.workflowStatus],
    ["Created By",         d.createdBy || "—",  "", "Created At",  d.createdAt || "—"],
    ["Approved By",        d.approvedBy || "—", "", "Approved At", d.finalApprovedAt || "—"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 4 }, { wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "BRR");
  XLSX.writeFile(wb, `BRR_${d.brrNo || "print"}.xlsx`);
}

/* ─── Main page ────────────────────────────────────────────────────────────── */

export default function BRRPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.BILL_RECEIVE_REGISTER.GET_BY_UUID}/${uuid}` })
      .then((res) => { setData(res?.data ?? null); })
      .catch((err) => { setError(err?.message || "Failed to load BRR"); })
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Loading…
      </div>
    );
  }
  if (error || !data) return <PrintErrorPage message={error || "BRR not found"} />;

  return (
    <>
      <PrintTopBar
        title={`BRR — ${data.brrNo}`}
        onDownloadPDF={() => window.print()}
        onDownloadExcel={() => downloadExcel(data)}
      />

      {/* ── Print body ──────────────────────────────────────────────────────── */}
      <div
        id="brr-print-body"
        className="max-w-[860px] mx-auto px-8 py-6 bg-white text-gray-900 print:px-4 print:py-2"
      >
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} text-gray-900 uppercase tracking-widest`}>
            Bill Receive Register
          </h1>
          <p className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-500 mt-0.5`}>
            {data.projectCode}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex justify-end mb-3">
          <span className={`px-3 py-0.5 rounded-full text-[11px] font-semibold border ${
            data.workflowStatus === "Approved"
              ? "bg-green-50 border-green-400 text-green-700"
              : data.workflowStatus === "Rejected"
              ? "bg-red-50 border-red-400 text-red-700"
              : "bg-yellow-50 border-yellow-400 text-yellow-700"
          }`}>
            {data.workflowStatus}
          </span>
        </div>

        {/* ── Section 1: BRR & Order info ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <SectionTitle>BRR Details</SectionTitle>
            <InfoRow label="BRR No"       value={data.brrNo} />
            <InfoRow label="BRR Date"     value={fmt.date(data.brrDate)} />
            <InfoRow label="Project Code" value={data.projectCode} />
          </div>
          <div>
            <SectionTitle>Order Details</SectionTitle>
            <InfoRow label="Order No"       value={data.orderNo} />
            <InfoRow label="Order Date"     value={fmt.date(data.orderDate)} />
            <InfoRow label="Order Category" value={data.orderCategory} />
          </div>
        </div>

        {/* ── Section 2: Party info ────────────────────────────────────────── */}
        <SectionTitle>Party / Vendor</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="Party Name"     value={data.partyName} />
            <InfoRow label="Party Address"  value={data.partyAddress} />
            <InfoRow label="Party GSTIN"    value={data.partyGstn} />
          </div>
          <div>
            <InfoRow label="Party Bill No"   value={data.partyBillNo} />
            <InfoRow label="Party Bill Date" value={fmt.date(data.partyDate)} />
          </div>
        </div>

        {/* ── Section 3: Receipt details ───────────────────────────────────── */}
        <SectionTitle>Receipt Information</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="Received Category"  value={data.receivedCategory} wide />
            <InfoRow label="Submitted By"       value={data.submittedByName}  wide />
            <InfoRow label="Submission Date"    value={fmt.date(data.submissionDate)} wide />
          </div>
          <div>
            <InfoRow label="Received Through"   value={data.receivedThrough}   wide />
            <InfoRow label="Received Reference" value={data.receivedReference} wide />
          </div>
        </div>

        {/* ── Section 4: Financials ────────────────────────────────────────── */}
        <SectionTitle>Financial Summary</SectionTitle>
        <div className="mt-1 border border-gray-300 rounded-sm overflow-hidden w-fit min-w-[300px]">
          <table className="text-[13px] w-full border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-4 py-1.5 text-gray-700 font-medium w-[180px]">Basic Amount</td>
                <td className="px-4 py-1.5 text-right tabular-nums">₹ {fmtAmt(data.basicAmount)}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-4 py-1.5 text-gray-700 font-medium">GST Amount</td>
                <td className="px-4 py-1.5 text-right tabular-nums">₹ {fmtAmt(data.gstAmount)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-1.5 text-gray-900 font-bold">Total Amount</td>
                <td className="px-4 py-1.5 text-right tabular-nums font-bold text-gray-900">
                  ₹ {fmtAmt(data.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Section 5: Signatures ────────────────────────────────────────── */}
        <SectionTitle>Audit Trail</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="Created By"  value={data.createdBy}  wide />
            <InfoRow label="Created At"  value={data.createdAt}  wide />
          </div>
          <div>
            <InfoRow label="Approved By" value={data.approvedBy}      wide />
            <InfoRow label="Approved At" value={data.finalApprovedAt} wide />
          </div>
        </div>

        {/* ── Signature boxes ──────────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-3 gap-6 print:mt-12">
          {["Prepared By", "Checked By", "Authorised By"].map((label) => (
            <div key={label} className="border-t border-gray-400 pt-1">
              <p className={`${SIZE.labelText} text-gray-600 text-center`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #brr-print-body { max-width: 100%; }
        }
      `}</style>
    </>
  );
}
