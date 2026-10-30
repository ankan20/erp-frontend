"use client";

/**
 * Delete Requests — Notification Centre
 *
 * Shows all delete request notifications sent via WhatsApp.
 * Two tabs:
 *   "All Notifications"  — every WA notification sent (manager's view)
 *   "My Requests"        — requests raised by the current logged-in user
 */

import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { Loader2, Bell, RefreshCw, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["ALL", "PENDING", "COMPLETED", "CANCELLED"];

const STATUS_CONFIG = {
  PENDING:   { label: "Pending",   color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  COMPLETED: { label: "Completed", color: "bg-green-100  text-green-700  border-green-300"  },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100   text-gray-500   border-gray-300"   },
};

const MODULE_LABELS = {
  INDENT: "Indent", ENQUIRY: "Enquiry", ORDER: "Purchase Order",
  PW_ORDER: "PW Order", GRN: "GRN", SRN: "SRN", GIN: "GIN",
  DC: "Delivery Challan", DLR: "Daily Labour Report",
  BVS: "Vendor Billing GRN", BSS: "Vendor Billing SRN",
  BRR: "Bill Receive Register", BRG: "BRR Billing GRN",
  BRS: "BRR Billing SRN", BRB: "BRR Billing",
  PURCHASE_BILL: "Purchase Bill", BILL_PAYMENT: "Bill Payment",
  PURCHASE_VOUCHER: "Purchase Voucher", PAYMENT_VOUCHER: "Payment Voucher",
  SALE_BILL: "Sale Bill", SALE_RECEIPT_BILLING: "Sale Receipt Billing",
  JOURNAL_ENTRY: "Journal Entry", CONTRA_ENTRY: "Contra Entry",
  CREDIT_NOTE: "Credit Note", DEBIT_NOTE: "Debit Note",
  PETTY_CASH_BUDGET: "Petty Cash Budget", PETTY_CASH_VOUCHER: "Petty Cash Voucher",
  OG_SALE_ORDER: "OG Sale Order", BILLING: "Custom Billing",
  UNCERTAIN_ALLOC: "Uncertain Allocation", BATCHING_PLANT: "Batching Plant",
  BBS_REGISTER: "BBS Register", HINDRANCE_REGISTER: "Hindrance Register",
  SALE_RECEIPT: "Sale Receipt", DRAWING_REGISTER: "Drawing Register",
  CONCRETE_REGISTRY: "Concrete Registry",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600 border-gray-300" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function NotificationCard({ item }) {
  const blockedModules = Array.isArray(item.blocked_by_modules) ? item.blocked_by_modules : [];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-semibold text-gray-800 text-sm">
            {item.module_display_name || MODULE_LABELS[item.module_code] || item.module_code}
            <span className="ml-2 text-gray-400 font-mono text-xs">{item.record_no}</span>
          </p>
          {item.project_code && (
            <p className="text-xs text-gray-400 mt-0.5">Project: {item.project_code}</p>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.reason && (
        <p className="text-xs text-gray-500 italic mb-2">"{item.reason}"</p>
      )}

      {blockedModules.length > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          <span className="font-medium">Blocked by:</span>{" "}
          {blockedModules.map((m) => MODULE_LABELS[m] || m).join(", ")}
        </div>
      )}

      {item.blocked_by_docs && (
        <p className="text-xs text-gray-400 mb-2 break-words">
          Docs: {item.blocked_by_docs}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          {item.requested_by_name && (
            <span>by <strong>{item.requested_by_name}</strong></span>
          )}
          {item.requested_at && (
            <span>· {new Date(item.requested_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
          )}
        </div>
        {item.wa_sent && (
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 className="h-3 w-3" />
            WA Sent
          </span>
        )}
      </div>

      {item.completed_at && (
        <p className="text-xs text-green-600 mt-1">
          Completed: {new Date(item.completed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default function DeleteRequestsPage() {
  const [activeTab, setActiveTab]     = useState("all");  // "all" | "mine"
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [data, setData]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [loading, setLoading]         = useState(false);

  const perPage = 20;

  const fetchData = useCallback(async (tab, status, pg) => {
    setLoading(true);
    try {
      const params = {
        page:     pg,
        per_page: perPage,
      };
      if (status !== "ALL") params.status = status;

      const url = tab === "mine"
        ? API_ENDPOINTS.DELETE_MANAGER.MY_REQUESTS
        : API_ENDPOINTS.DELETE_MANAGER.NOTIFICATIONS;

      const res = await apiRequest({ url, method: "GET", params });
      const payload = res?.data || res || {};

      setData(payload.results   || []);
      setTotal(payload.total    || 0);
      setPages(payload.pages    || 1);
    } catch (err) {
      toast.error(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchData(activeTab, statusFilter, 1);
  }, [activeTab, statusFilter, fetchData]);

  useEffect(() => {
    fetchData(activeTab, statusFilter, page);
  }, [page]);   // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleRefresh = () => {
    fetchData(activeTab, statusFilter, page);
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Delete Requests</h1>
            <p className="text-xs text-gray-500">Notification centre for cascading delete requests</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit mb-5 shadow-sm">
        {[
          { key: "all",  label: "All Notifications" },
          { key: "mine", label: "My Requests"        },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              statusFilter === s
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <p className="text-xs text-gray-400 mb-4">
        {loading ? "Loading..." : `${total} record${total !== 1 ? "s" : ""} found`}
      </p>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bell className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No notifications found</p>
          <p className="text-xs mt-1">
            {statusFilter !== "ALL" ? `No ${statusFilter.toLowerCase()} requests.` : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-1.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-1.5 rounded-md border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
