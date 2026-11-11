"use client";

// 360 view of a master record (vendor / ledger or item).
//
// Opened from the search box: "/v sharma" or "/i cement" → Enter.
// Shows the record's details and one tab per kind of document that belongs to
// it. The backend returns only the tabs — and inside them only the projects —
// this user has permission for (see app/modules/search/deep_service.py).
//
// Keys:  ← →  or  1 – 9  switch tab ·  ↑ ↓ Enter  move in the table and open

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Building2, Loader2 } from "lucide-react";
import DataTable from "@/components/common/DataTable";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { docRoute, fmtAmt, fmtDate, fmtQty } from "@/components/master/traceability/wbUtils";
import { isTypingTarget, topDialog } from "@/lib/shortcuts";
import Kbd from "@/components/shortcuts/Kbd";

const VIEW = API_ENDPOINTS.DEEP_SEARCH.VIEW;

// Detail page of a document row. Debit / credit notes are not part of the
// traceability workbench, so their routes are added here.
function documentRoute(row) {
  if (row.docType === "DEBIT_NOTE") return `/finance-management/account/debit-note/${row.docId}`;
  if (row.docType === "CREDIT_NOTE") return `/finance-management/account/credit-note/${row.docId}`;
  return docRoute(row.docType, row.docId, row);
}

// Ledger lines name their document in words
const LEDGER_DOC_TYPES = {
  "Purchase Bill": "PURCHASE_BILL",
  "Bill Payment": "BILL_PAYMENT",
  "Debit Note": "DEBIT_NOTE",
  "Credit Note": "CREDIT_NOTE",
};

// "> bills" typed in the search box → which tab to open
const TAB_WORDS = {
  ledger: "LEDGER", statement: "LEDGER",
  order: "ORDER", orders: "ORDER", po: "ORDER",
  "service order": "PW_ORDER", wo: "PW_ORDER",
  grn: "GRN", srn: "SRN", gin: "GIN", issue: "GIN", issues: "GIN", dc: "DC",
  brr: "BRR", bill: "PURCHASE_BILL", bills: "PURCHASE_BILL",
  payment: "BILL_PAYMENT", payments: "BILL_PAYMENT",
  "debit note": "DEBIT_NOTE", "credit note": "CREDIT_NOTE",
  indent: "INDENT", indents: "INDENT",
};

function pickTab(tabs, wanted) {
  if (!tabs.length) return null;
  const text = (wanted || "").trim().toLowerCase();
  if (text) {
    const byWord = tabs.find((t) => t.key === TAB_WORDS[text]);
    const byName = tabs.find((t) => t.key.toLowerCase() === text || t.label.toLowerCase().includes(text));
    if (byWord || byName) return (byWord || byName).key;
  }
  // first tab that has something in it
  return (tabs.find((t) => t.kind === "ledger" || t.count > 0) || tabs[0]).key;
}

export default function DeepSearchView({ kind, id, initialTab }) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [chosenTab, setChosenTab] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest({ url: `${VIEW}/${kind}/${id}` })
      .then((res) => !cancelled && setState({ loading: false, error: "", data: res?.data }))
      .catch((err) => !cancelled && setState({ loading: false, error: err?.message || "Could not load this record", data: null }));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const tabs = useMemo(() => state.data?.tabs || [], [state.data]);
  const activeKey = chosenTab && tabs.some((t) => t.key === chosenTab) ? chosenTab : pickTab(tabs, initialTab);
  const activeTab = tabs.find((t) => t.key === activeKey);

  // ← → and 1 – 9 switch tabs
  useEffect(() => {
    if (!tabs.length) return;
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isTypingTarget(e.target) || topDialog()) return;
      const index = tabs.findIndex((t) => t.key === activeKey);
      let next = -1;
      if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (/^Digit[1-9]$/.test(e.code)) next = Number(e.code.slice(5)) - 1;
      if (next < 0 || next >= tabs.length) return;
      e.preventDefault();
      setChosenTab(tabs[next].key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tabs, activeKey]);

  if (state.loading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (state.error || !state.data?.profile) {
    return <p className="p-6 text-center text-sm text-gray-500">{state.error || "Record not found"}</p>;
  }

  const { profile } = state.data;
  const openDocument = (row) => {
    const href = documentRoute(row);
    if (href) router.push(href);
  };

  return (
    <div className="p-3">
      <Profile kind={kind} profile={profile} />

      {tabs.length === 0 ? (
        <p className="mt-4 rounded-md border border-[#d8e1ea] bg-white px-4 py-6 text-center text-[13px] text-gray-500">
          You do not have permission to see the documents of this record.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-1 border-b-2 border-[#144664]" role="tablist">
            {tabs.map((tab, i) => {
              const selected = tab.key === activeKey;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  title={i < 9 ? `Shortcut: ${i + 1}` : undefined}
                  onClick={() => setChosenTab(tab.key)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1 text-[12.5px] font-medium ${
                    selected
                      ? "border-[#144664] bg-[#144664] text-white"
                      : tab.kind === "documents" && !tab.count
                        ? "border-[#d8e1ea] bg-[#f6f8fa] text-gray-400 hover:bg-[#eef4fa]"
                        : "border-[#b5c7d8] bg-white text-[#144664] hover:bg-[#eef4fa]"
                  }`}
                >
                  {i < 9 && <span className={`font-mono text-[10px] ${selected ? "text-white/70" : "text-gray-400"}`}>{i + 1}</span>}
                  {tab.label}
                  {tab.kind === "documents" && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] ${
                        selected ? "bg-white/20 text-white" : "bg-[#e8f2ff] text-[#144664]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            {activeTab?.kind === "ledger" ? (
              <LedgerTab key="ledger" vendorId={id} onOpen={openDocument} />
            ) : activeTab ? (
              <DocumentsTab key={activeTab.key} kind={kind} id={id} tab={activeTab} onOpen={openDocument} />
            ) : null}
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-gray-500">
            <span className="flex items-center gap-1"><Kbd combo="←" /><Kbd combo="→" /> or <Kbd combo="1 – 9" /> change tab</span>
            <span className="flex items-center gap-1"><Kbd combo="↑" /><Kbd combo="↓" /> move in the table</span>
            <span className="flex items-center gap-1"><Kbd combo="Enter" /> open the document</span>
            <span>You see only the projects and document types you have permission for.</span>
          </p>
        </>
      )}
    </div>
  );
}

// ── profile ──────────────────────────────────────────────────────────────────

function Profile({ kind, profile }) {
  const isVendor = kind === "vendor";
  const Icon = isVendor ? Building2 : Boxes;
  const fields = isVendor
    ? [
        ["Type", profile.type],
        ["GSTIN", profile.gstin],
        ["PAN", profile.pan],
        ["State", profile.state],
        ["Contact", [profile.contactPerson, profile.contactNumber].filter(Boolean).join(" · ")],
        ["Email", profile.email],
        ["Address", profile.registeredAddress],
        ["Bank", [profile.bankName, profile.branchName].filter(Boolean).join(", ")],
        ["Account No", profile.bankAccountNumber],
        ["IFSC", profile.ifscCode],
      ]
    : [
        ["Unit", profile.unit],
        ["Category", profile.categoryCode],
        ["HSN / SAC", profile.hsnSac],
        ["GST %", profile.gstPercentage != null ? `${profile.gstPercentage}%` : ""],
        ["Description", profile.description],
      ];

  return (
    <div className="rounded-md border border-[#c4d1df] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#d8e1ea] bg-[#eef4fa] px-3 py-2">
        <Icon className="h-5 w-5 text-[#144664]" />
        <h1 className="text-[16px] font-semibold text-[#144664]">{profile.name}</h1>
        <span className="rounded-sm border border-[#b5c7d8] bg-white px-1.5 py-0.5 font-mono text-[12px] text-[#b03030]">
          {profile.code}
        </span>
        {profile.status && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              String(profile.status).toLowerCase() === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {profile.status}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 px-3 py-2 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
        {fields
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-[82px] shrink-0 text-gray-500">{label}</dt>
              <dd className="min-w-0 break-words font-medium text-gray-900">{value}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

// ── documents of one tab ─────────────────────────────────────────────────────

function DocumentsTab({ kind, id, tab, onOpen }) {
  const [state, setState] = useState({ loading: true, error: "", rows: [], hasMore: false });

  useEffect(() => {
    let cancelled = false;
    apiRequest({ url: `${VIEW}/${kind}/${id}/docs`, params: { type: tab.key } })
      .then((res) => {
        if (cancelled) return;
        const rows = (res?.data?.rows || []).map((r, i) => ({
          ...r,
          sl: i + 1,
          dateText: fmtDate(r.date),
          amountText: r.amount == null ? "-" : fmtAmt(r.amount),
          qtyText: r.qty == null ? "-" : fmtQty(r.qty),
          rateText: r.rate == null ? "-" : fmtAmt(r.rate),
        }));
        setState({ loading: false, error: "", rows, hasMore: !!res?.data?.hasMore });
      })
      .catch((err) => !cancelled && setState({ loading: false, error: err?.message || "Could not load", rows: [], hasMore: false }));
    return () => {
      cancelled = true;
    };
  }, [kind, id, tab.key]);

  const columns = useMemo(() => {
    const cols = [
      { header: "Sl. no", accessor: "sl" },
      { header: `${tab.label} No`, accessor: "docNo" },
      { header: "Date", accessor: "dateText" },
      { header: "Project", accessor: "projectCode" },
      { header: "Status", accessor: "status" },
    ];
    if (kind === "item") {
      cols.push({ header: "Qty", accessor: "qtyText", align: "right" });
      if (state.rows.some((r) => r.rate != null)) cols.push({ header: "Rate", accessor: "rateText", align: "right" });
    }
    if (state.rows.some((r) => r.amount != null)) {
      cols.push({ header: kind === "item" ? "Document Amount" : "Amount", accessor: "amountText", align: "right" });
    }
    return cols;
  }, [kind, tab.label, state.rows]);

  if (state.loading) return <TabLoading />;
  if (state.error) return <TabMessage text={state.error} />;

  return (
    <>
      <DataTable
        columns={columns}
        data={state.rows}
        onRowClick={onOpen}
        storageKey={`deep-search:${kind}:${tab.key}`}
      />
      {state.hasMore && (
        <p className="mt-1 text-[12px] text-gray-500">
          Showing the newest {state.rows.length} of {tab.count}. Open the {tab.label} list page to see older ones.
        </p>
      )}
    </>
  );
}

// ── vendor ledger ────────────────────────────────────────────────────────────

function LedgerTab({ vendorId, onOpen }) {
  const [range, setRange] = useState({ from: "", to: "" });
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (applied.from) params.fromDate = applied.from;
    if (applied.to) params.toDate = applied.to;
    apiRequest({ url: `${VIEW}/vendor/${vendorId}/ledger`, params })
      .then((res) => !cancelled && setState({ loading: false, error: "", data: res?.data }))
      .catch((err) => !cancelled && setState({ loading: false, error: err?.message || "Could not load the ledger", data: null }));
    return () => {
      cancelled = true;
    };
  }, [vendorId, applied]);

  const apply = (next) => {
    setState((s) => ({ ...s, loading: true }));
    setApplied(next);
  };

  const rows = useMemo(
    () =>
      (state.data?.entries || []).map((e, i) => ({
        ...e,
        sl: i + 1,
        // the document type key the routes use ("Purchase Bill" → PURCHASE_BILL)
        docType: LEDGER_DOC_TYPES[e.docType],
        typeLabel: e.docType,
        dateText: fmtDate(e.date),
        debitText: e.debit ? fmtAmt(e.debit) : "-",
        creditText: e.credit ? fmtAmt(e.credit) : "-",
        balanceText: `${fmtAmt(e.balance)} ${e.balanceType}`,
      })),
    [state.data],
  );

  const columns = [
    { header: "Sl. no", accessor: "sl" },
    { header: "Doc No", accessor: "docNo" },
    { header: "Date", accessor: "dateText" },
    { header: "Type", accessor: "typeLabel" },
    { header: "Particular", accessor: "particular" },
    { header: "Project", accessor: "projectCode" },
    { header: "Debit", accessor: "debitText", align: "right" },
    { header: "Credit", accessor: "creditText", align: "right" },
    { header: "Balance", accessor: "balanceText", align: "right" },
  ];

  const summary = state.data?.summary;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
        <div className="rounded-sm border border-[#5aafc2] bg-[#7fc3d4] px-3 py-0.5">From</div>
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className="h-6.5 w-35 rounded-sm border border-[#8f8f8f] px-2 text-sm"
          aria-label="From date"
        />
        <div className="rounded-sm border border-[#5aafc2] bg-[#7fc3d4] px-3 py-0.5">To</div>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className="h-6.5 w-35 rounded-sm border border-[#8f8f8f] px-2 text-sm"
          aria-label="To date"
        />
        <button
          type="button"
          onClick={() => apply(range)}
          className="h-7 cursor-pointer rounded-sm border border-[#4d8ea3] bg-[#7fc3d4] px-4 text-black hover:bg-[#6bb3c6]"
        >
          Show
        </button>
        {(applied.from || applied.to) && (
          <button
            type="button"
            onClick={() => {
              setRange({ from: "", to: "" });
              apply({ from: "", to: "" });
            }}
            className="h-7 cursor-pointer rounded-sm border border-[#d9a0a0] bg-[#f5e4e4] px-3 text-[#b03030] hover:bg-[#fad4d4]"
          >
            Clear
          </button>
        )}
      </div>

      {state.loading ? (
        <TabLoading />
      ) : state.error ? (
        <TabMessage text={state.error} />
      ) : (
        <>
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Tile label="Total debit (paid / reduced)" value={fmtAmt(summary.totalDebit)} />
            <Tile label="Total credit (billed)" value={fmtAmt(summary.totalCredit)} />
            <Tile
              label={summary.balanceType === "Cr" ? "Balance — we owe (Cr)" : "Balance — advance paid (Dr)"}
              value={fmtAmt(summary.closingBalance)}
              strong
            />
          </div>
          <DataTable columns={columns} data={rows} onRowClick={onOpen} storageKey="deep-search:vendor:LEDGER" />
          <p className="mt-1 text-[12px] text-gray-500">
            Approved purchase bills, bill payments, debit notes and credit notes
            {state.data.allProjects ? " of all projects." : " of the projects you have Ledger View permission for."}
          </p>
        </>
      )}
    </>
  );
}

function Tile({ label, value, strong = false }) {
  return (
    <div className={`rounded-md border px-3 py-1.5 ${strong ? "border-[#144664] bg-[#eef4fa]" : "border-[#d8e1ea] bg-white"}`}>
      <div className="text-[11.5px] text-gray-500">{label}</div>
      <div className="text-[16px] font-semibold text-[#144664]">{value}</div>
    </div>
  );
}

const TabLoading = () => (
  <div className="flex h-[160px] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin" />
  </div>
);

const TabMessage = ({ text }) => (
  <p className="rounded-md border border-[#d8e1ea] bg-white px-4 py-6 text-center text-[13px] text-gray-500">{text}</p>
);
