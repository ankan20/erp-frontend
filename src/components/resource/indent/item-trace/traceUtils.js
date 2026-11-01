import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";

// Existing detail pages for each document type. Types without a detail
// page (e.g. Enquiry) are intentionally absent → no "View" action.
const DOC_ROUTES = {
  INDENT: (id) => `/resource-management/procurement/indent/${id}`,
  ORDER: (id) => `/resource-management/procurement/order/material-order/${id}`,
  GRN: (id) => `/resource-management/material/grn/${id}`,
  GIN: (id) => `/resource-management/material/gin/${id}`,
  DC: (id) => `/logistics/delivery-challan/${id}`,
  BRR: (id) => `/resource-management/sub-contractor-billing/bill-receive-register/${id}`,
  BRB: (id) => `/resource-management/sub-contractor-billing/e-reconcile-bill/${id}`,
  PURCHASE_BILL: (id) => `/finance-management/account/purchases/bill/${id}`,
  BILL_PAYMENT: (id) => `/finance-management/account/payment/${id}?type=bill`,
};

export const getDocRoute = (docType, docId) =>
  docId && DOC_ROUTES[docType] ? DOC_ROUTES[docType](docId) : null;

export const fmtQty = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  return formatQtyDisplay(v) || "0";
};

export const fmtAmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  return formatAmount(v) || "0.00";
};

export const fmtDate = (d) => (d ? getfmtDisplaydate(d) : "—");

export const fmtPercent = (v) =>
  v === null || v === undefined ? "—" : `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

export const formatWorkflowStatus = (s) => {
  if (!s) return "—";
  const m = s.match(/^Pending_L(\d+)$/i);
  return m ? `Pending L${m[1]}` : s.replace(/_/g, " ");
};

// Same palette HistoryTimelineSheet uses for workflow states.
export const statusClass = (s) => {
  if (s === "Approved") return "bg-green-100 text-green-700 border-green-200";
  if (s === "Rejected") return "bg-red-100 text-red-700 border-red-200";
  if (s === "Reback") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (s === "Draft") return "bg-gray-100 text-gray-600 border-gray-200";
  if (s) return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
};

export const isRejected = (s) => s === "Rejected";
