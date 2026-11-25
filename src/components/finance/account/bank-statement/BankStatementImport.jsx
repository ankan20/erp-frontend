"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, FileText, Download, CheckCircle2, Loader2,
  RefreshCw, Undo2, ExternalLink, History, Pencil, AlertTriangle, X,
} from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import { apiRequest }    from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { formatAmount }  from "@/helper/numberFormatter";
import { createdOnText } from "@/lib/createdOn";
import { COLUMNS, downloadStatementTemplate, downloadStatementErrors, parseStatementFile } from "./bankStatementFile";

const EP = API_ENDPOINTS.FINANCE.BANK_STATEMENT;
const DOCKET_PATH = "/finance-management/account/petty-cash/expenses-docket";

const dmy = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("-") : "");
const amt = (v) => (v ? formatAmount(v) : "");

const STATUS_STYLE = {
  valid:        "bg-green-50 text-green-700",
  imported:     "bg-blue-50 text-blue-700",
  duplicate:    "bg-gray-100 text-gray-600",
  error:        "bg-red-50 text-red-700",
  Unreconciled: "bg-amber-50 text-amber-800",
  Reserved:     "bg-blue-50 text-blue-700",
  Reconciled:   "bg-green-50 text-green-700",
};
const Badge = ({ s, label }) => (
  <span className={`text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap ${STATUS_STYLE[s] || "bg-gray-100 text-gray-600"}`}>{label || s}</span>
);

// ══════════════════════════════════════════════════════════════════════════════

export default function BankStatementImport({ canImport = false }) {
  const [tab,       setTab]       = useState("upload");     // upload | transactions | history
  const [accounts,  setAccounts]  = useState([]);
  const [accountId, setAccountId] = useState("");
  const [loadingAc, setLoadingAc] = useState(true);

  useEffect(() => {
    apiRequest({ url: EP.ACCOUNTS, method: "GET" })
      .then((r) => {
        const list = Array.isArray(r?.data) ? r.data : [];
        setAccounts(list);
        const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("account") : null;
        const pick = list.find((a) => String(a.id) === fromUrl || a.bankCode === fromUrl) || (list.length === 1 ? list[0] : null);
        if (pick) setAccountId(String(pick.id));
      })
      .catch(() => toast.error("Could not load bank accounts"))
      .finally(() => setLoadingAc(false));
  }, []);

  const account = accounts.find((a) => String(a.id) === String(accountId)) || null;

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-800">Bank Statements</h1>
          <p className="text-[12.5px] text-gray-500">Import bank statements per account, then link DR lines to petty cash expense dockets of the same site.</p>
        </div>
        <label className="ml-auto text-[11.5px] text-gray-500">
          Bank account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={loadingAc}
            className="block mt-0.5 h-8 min-w-[260px] text-[12.5px] px-2 border border-gray-300 rounded bg-white">
            <option value="">{loadingAc ? "Loading…" : accounts.length ? "Select bank account…" : "No bank account available"}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.bankCode} — {a.name || a.bankName}{a.accountNo ? ` (${a.accountNo})` : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {account && (
        <div className="text-[11.5px] text-gray-500 -mt-1">
          Sites linked to {account.bankCode}: {account.sites.length ? account.sites.join(", ") : <span className="text-amber-700">none. Link projects in Master &gt; Bank/Cash first</span>}
        </div>
      )}

      <div className="flex gap-1 border-b">
        {[["upload", "Upload statement"], ["transactions", "Transactions"], ["history", "Import history"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-[12.5px] -mb-px border-b-2 ${tab === k ? "border-blue-600 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "upload" && <UploadTab account={account} canImport={canImport && !!account?.canImport} />}
      {tab === "transactions" && <TransactionsTab account={account} canEdit={canImport && !!account?.canImport} />}
      {tab === "history" && <HistoryTab account={account} canImport={canImport} />}
    </div>
  );
}

// ── UPLOAD ───────────────────────────────────────────────────────────────────

function UploadTab({ account, canImport }) {
  const [busy,     setBusy]     = useState("");     // parsing | validating | importing | template
  const [fileName, setFileName] = useState("");
  const [rows,     setRows]     = useState(null);   // raw parsed rows (resent on import)
  const [result,   setResult]   = useState(null);   // { summary, rows }
  const [done,     setDone]     = useState(null);   // import result summary
  const [filter,   setFilter]   = useState("all");
  const [dragOver, setDragOver] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => { setRows(null); setResult(null); setDone(null); setFileName(""); setWarnings([]); }, [account?.id]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!account) { toast.error("Select the bank account first"); return; }
    try {
      setBusy("parsing");
      const parsed = await parseStatementFile(file);
      setBusy("validating");
      const r = await apiRequest({ url: EP.VALIDATE, method: "POST", data: { bankAccountId: account.id, rows: parsed.rows } });
      setRows(parsed.rows);
      setWarnings(parsed.warnings || []);
      setResult(r.data);
      setDone(null);
      setFileName(file.name);
      const s = r.data.summary;
      setFilter(s.error ? "error" : "all");
      toast.success(`${s.totalRows} rows read: ${s.valid} ready, ${s.duplicate} duplicate, ${s.error} with errors`);
    } catch (e) {
      toast.error(e?.message || "Could not read the file");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doImport = async () => {
    const s = result.summary;
    if (!window.confirm(
      `Import ${s.valid} transaction(s) into ${account.bankCode}?\n` +
      `${s.duplicate} duplicate(s) will be skipped and ${s.error} row(s) with errors will not be imported.`)) return;
    try {
      setBusy("importing");
      const r = await apiRequest({ url: EP.IMPORT, method: "POST", data: { bankAccountId: account.id, fileName, rows } });
      setResult({ summary: r.data.summary, rows: r.data.rows });
      setDone(r.data.batch);
      toast.success(r.message);
    } catch (e) {
      toast.error(e?.message || "Import failed");
    } finally { setBusy(""); }
  };

  const getTemplate = async (format) => {
    try { setBusy("template"); await downloadStatementTemplate({ format, account }); }
    catch { toast.error("Could not create template"); }
    finally { setBusy(""); }
  };

  const shown = useMemo(
    () => (result?.rows || []).filter((r) => filter === "all" || r.status === filter),
    [result, filter],
  );

  const loading = busy === "parsing" || busy === "validating";

  if (!result) {
    return (
      <div className="max-w-4xl space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
          <span className="text-[12.5px] text-gray-700 mr-auto">Template with this account&apos;s sites:</span>
          <button type="button" onClick={() => getTemplate("xlsx")} disabled={busy === "template"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-green-600 text-green-700 text-[12.5px] font-medium hover:bg-green-50 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel template
          </button>
          <button type="button" onClick={() => getTemplate("csv")} disabled={busy === "template"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-gray-700 text-[12.5px] font-medium hover:bg-gray-50 disabled:opacity-50">
            <FileText className="w-4 h-4" /> CSV template
          </button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => !loading && account && fileRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && account) fileRef.current?.click(); }}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition ${account ? "cursor-pointer" : "cursor-not-allowed opacity-60"}
            ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"}`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <EdoxMark size={40} />
              <div className="text-[13px]">{busy === "parsing" ? "Reading file…" : "Checking rows, sites and duplicates…"}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-blue-600" />
              <div className="text-[13.5px] font-medium text-gray-800">
                {account ? `Drop the ${account.bankCode} statement here, or click to browse` : "Select a bank account above first"}
              </div>
              <div className="text-[11.5px] text-gray-500">.xlsx, .xls or .csv · up to 10,000 rows · nothing is saved until you confirm</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white">
          <div className="px-3 py-2 border-b text-[12px] font-medium text-gray-700">Statement format</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-gray-600"><tr>{COLUMNS.map((c) => <th key={c.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{c.header}</th>)}</tr></thead>
              <tbody className="text-gray-700 tabular-nums">
                {[
                  ["01-11-2026", "S.MAITY", "ICICI912", "2,700", "", "3,00,000", "UPI", "DR", "SSML", ""],
                  ["02-11-2026", "ICICI912", "TECHNO ELECTRIC", "", "30,000", "3,30,000", "CHEQUE", "CR", "BDAR", "000123"],
                ].map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap">{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t text-[11.5px] text-gray-500 space-y-0.5">
            <div>• <b>DATE</b> is required. DR = outgoing payment, CR = incoming receipt. Fill only one of them.</div>
            <div>• <b>SITE</b> = project code linked to this account. Blank SITE lines are stored but never offered to petty cash.</div>
            <div>• Lines already imported earlier are skipped automatically.</div>
          </div>
        </div>
      </div>
    );
  }

  const s = result.summary;
  const bad = (result.rows || []).filter((r) => r.status !== "valid" && r.status !== "imported");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-green-700" />
        <span className="text-[13px] font-medium text-gray-800 truncate max-w-[280px]" title={fileName}>{fileName}</span>
        <span className="text-[12px] text-gray-500">→ {account?.bankCode}</span>
        <button type="button" onClick={() => { setResult(null); setRows(null); setDone(null); }} className="text-[12px] text-blue-600 hover:underline ml-1">
          Upload another file
        </button>
        <div className="ml-auto flex gap-2">
          {bad.length > 0 && (
            <button type="button" onClick={() => downloadStatementErrors(bad, fileName)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50">
              <Download className="w-4 h-4" /> Error report ({bad.length})
            </button>
          )}
          {!done && (
            <button type="button" onClick={doImport} disabled={!s.valid || !!busy || !canImport}
              title={canImport ? "" : "You need Bank Statement edit permission for this account"}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
              {busy === "importing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Import {s.valid} transaction{s.valid === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 space-y-0.5">
          {warnings.map((w, i) => <div key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-px" />{w}</div>)}
        </div>
      )}

      {done && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Imported <b>{done.imported}</b>, skipped <b>{done.skipped}</b> duplicate(s), failed <b>{done.failed}</b>. Period {dmy(done.fromDate)} to {dmy(done.toDate)}.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label={done ? "Imported" : "Ready to import"} value={done ? done.imported : s.valid} tone="green" />
        <Stat label="Duplicates (skipped)" value={s.duplicate} tone="gray" />
        <Stat label="Errors (not imported)" value={s.error} tone={s.error ? "red" : "gray"} />
        <Stat label="Total DR / CR" value={`${formatAmount(s.totalDebit)} / ${formatAmount(s.totalCredit)}`} small tone="gray" />
        <Stat label="Period" value={s.fromDate ? `${dmy(s.fromDate)} → ${dmy(s.toDate)}` : "—"} small tone="gray"
          sub={s.noSite ? `${s.noSite} line(s) without SITE` : ""} />
      </div>

      <div className="flex gap-1 text-[12px]">
        {[["all", "All", s.totalRows], ["valid", done ? "Imported" : "Ready", done ? done.imported : s.valid], ["duplicate", "Duplicate", s.duplicate], ["error", "Errors", s.error]].map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setFilter(done && k === "valid" ? "imported" : k)}
            className={`px-2.5 py-1 rounded-full border ${(filter === k || (k === "valid" && filter === "imported")) ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            {l} ({n})
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-[12px] min-w-[1100px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium w-12">Row</th>
              <th className="px-2 py-1.5 text-left font-medium">Status</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 font-medium whitespace-nowrap ${["dr", "cr", "balance"].includes(c.key) ? "text-right" : "text-left"}`}>{c.header}</th>
              ))}
              <th className="px-2 py-1.5 text-left font-medium">Problem</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 1000).map((r) => (
              <tr key={`${r.rowNo}`} className={`border-t align-top ${r.status === "error" ? "bg-red-50/40" : ""}`}>
                <td className="px-2 py-1 text-gray-400 tabular-nums">{r.rowNo}</td>
                <td className="px-2 py-1"><Badge s={r.status} />{r.isUpi ? <span className="ml-1 text-[10.5px] text-purple-700">UPI</span> : null}</td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={`px-2 py-1 whitespace-nowrap ${["dr", "cr", "balance"].includes(c.key) ? "text-right tabular-nums" : ""} ${c.key === "desc" ? "max-w-[220px] truncate" : ""}`} title={String(r[c.key] ?? "")}>
                    {String(r[c.key] ?? "")}
                  </td>
                ))}
                <td className="px-2 py-1 text-red-600 text-[11.5px]">{(r.errors || []).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > 1000 && <div className="px-3 py-2 text-[11.5px] text-gray-500 border-t">Showing the first 1,000 of {shown.length} rows.</div>}
        {!shown.length && <div className="px-3 py-6 text-center text-[12px] text-gray-500">No rows in this filter.</div>}
      </div>
    </div>
  );
}

// ── TRANSACTIONS ─────────────────────────────────────────────────────────────

function TransactionsTab({ account, canEdit }) {
  const [f, setF] = useState({ site: "", type: "", status: "", fromDate: "", toDate: "", search: "" });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [res, setRes] = useState({ key: null, list: [], total: 0 });   // key = query that produced it
  const [hist, setHist] = useState(null);
  const [openDesc, setOpenDesc] = useState(null);   // row id whose full description is shown
  const [edit, setEdit] = useState(null);           // { txn, site, saving }
  const size = 50;

  const query = useMemo(() => {
    if (!account) return null;
    const q = new URLSearchParams({ bankAccountId: account.id, page, pageSize: size });
    Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, v); });
    return q.toString();
  }, [account, f, page]);
  const reqKey = query ? `${query}#${reload}` : null;
  const loading = !!reqKey && res.key !== reqKey;
  const data = res.key === reqKey ? res : { list: res.list, total: res.total };

  useEffect(() => {
    if (!reqKey) return;
    let alive = true;
    apiRequest({ url: `${EP.TRANSACTIONS}?${query}`, method: "GET" })
      .then((r) => { if (alive) setRes({ key: reqKey, ...(r.data || { list: [], total: 0 }) }); })
      .catch((e) => { if (alive) { setRes({ key: reqKey, list: [], total: 0 }); toast.error(e?.message || "Could not load transactions"); } });
    return () => { alive = false; };
  }, [query, reqKey]);
  const load = () => setReload((n) => n + 1);

  const openHistory = (id) =>
    apiRequest({ url: `${EP.TXN_HISTORY}${id}/history`, method: "GET" })
      .then((r) => setHist(r.data)).catch((e) => toast.error(e?.message || "Could not load history"));

  if (!account) return <div className="text-[12.5px] text-gray-500 py-8 text-center">Select a bank account above.</div>;
  const saveSite = () => {
    setEdit((e) => ({ ...e, saving: true }));
    apiRequest({ url: `${EP.TXN_HISTORY}${edit.txn.id}/site`, method: "PUT", data: { site: edit.site } })
      .then((r) => {
        toast.success(r?.message || "Site updated");
        setRes((p) => ({ ...p, list: p.list.map((x) => (x.id === edit.txn.id ? { ...x, ...r.data } : x)) }));
        setEdit(null);
      })
      .catch((e) => { toast.error(e?.message || "Could not update site"); setEdit((x) => x && { ...x, saving: false }); });
  };
  const set = (k, v) => { setPage(1); setF((p) => ({ ...p, [k]: v })); };
  const inp = "h-8 text-[12.5px] px-2 border border-gray-300 rounded bg-white";
  const pages = Math.max(1, Math.ceil((data.total || 0) / size));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <select className={inp} value={f.site} onChange={(e) => set("site", e.target.value)}>
          <option value="">All sites</option>
          {account.sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={inp} value={f.type} onChange={(e) => set("type", e.target.value)}>
          <option value="">DR + CR</option><option value="DR">DR (outgoing)</option><option value="CR">CR (incoming)</option>
        </select>
        <select className={inp} value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">Any status</option><option>Unreconciled</option><option>Reserved</option><option>Reconciled</option>
        </select>
        <input type="date" className={inp} value={f.fromDate} onChange={(e) => set("fromDate", e.target.value)} />
        <input type="date" className={inp} value={f.toDate} onChange={(e) => set("toDate", e.target.value)} />
        <input className={`${inp} w-56`} placeholder="Search desc / party / ref" value={f.search} onChange={(e) => set("search", e.target.value)} />
        <button type="button" onClick={load} className="h-8 px-2.5 rounded-md border text-gray-600 hover:bg-gray-50" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="ml-auto text-[12px] text-gray-500">{data.total || 0} transactions</span>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-[12px] min-w-[1100px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {["Date", "BY-DR", "TO-CR", "DR", "CR", "Balance", "Desc", "Site", "Status", "Docket", "Created On", ""].map((h, i) => (
                <th key={i} className={`px-2 py-1.5 font-medium whitespace-nowrap ${["DR", "CR", "Balance"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.list.map((t) => {
              const st = t.status === "Reconciled" ? "Reconciled" : t.reserved ? "Reserved" : "Unreconciled";
              return (
                <tr key={t.id} className="border-t">
                  <td className="px-2 py-1 whitespace-nowrap">{dmy(t.date)}</td>
                  <td className="px-2 py-1 max-w-[150px] truncate" title={t.byDr || ""}>{t.byDr}</td>
                  <td className="px-2 py-1 max-w-[150px] truncate" title={t.toCr || ""}>{t.toCr}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-red-700">{amt(t.dr)}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-green-700">{amt(t.cr)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{t.balance != null ? formatAmount(t.balance) : ""}</td>
                  <td className={`px-2 py-1 max-w-[260px] cursor-pointer ${openDesc === t.id ? "whitespace-normal break-all" : "truncate"}`}
                    title={openDesc === t.id ? "Click to collapse" : `${t.desc || ""}\n(click to show full text)`}
                    onClick={() => setOpenDesc((id) => (id === t.id ? null : t.id))}>
                    {t.isUpi && <span className="mr-1 text-[10.5px] text-purple-700">UPI</span>}{t.desc}
                    {openDesc === t.id && t.refNo ? <div className="text-gray-500">Ref {t.refNo}</div> : null}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {t.site || <span className="text-amber-600" title="No site: this line is not offered to petty cash dockets">—</span>}
                    {canEdit && !t.linkedDocketId && t.status !== "Reconciled" && (
                      <button type="button" onClick={() => setEdit({ txn: t, site: t.site || "", saving: false })}
                        className="ml-1.5 align-middle text-gray-400 hover:text-blue-600" title="Edit site">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1"><Badge s={st} /></td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {t.linkedDocketId ? (
                      <a href={`${DOCKET_PATH}/${t.linkedDocketId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        {t.linkedDocketNo || `#${t.linkedDocketId}`} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">{createdOnText(t)}</td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => openHistory(t.id)} className="text-gray-400 hover:text-gray-700" title="Audit trail">
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.list.length && <div className="px-3 py-6 text-center text-[12px] text-gray-500">{loading ? "Loading…" : "No transactions."}</div>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12px]">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded disabled:opacity-40">Prev</button>
          <span>Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded disabled:opacity-40">Next</button>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => !edit.saving && setEdit(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center">
              <div className="text-[14px] font-semibold text-gray-800">Edit site</div>
              <button type="button" onClick={() => setEdit(null)} className="ml-auto text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-[12px] text-gray-600 space-y-0.5">
              <div><b>{dmy(edit.txn.date)}</b> · {edit.txn.type} {formatAmount(edit.txn.amount)} · {edit.txn.byDr || "—"} → {edit.txn.toCr || "—"}</div>
              <div className="break-all text-gray-500">{edit.txn.desc}</div>
            </div>
            <label className="block text-[12px] text-gray-700">
              Site (project linked to {account.bankCode})
              <select className={`${inp} w-full mt-1`} value={edit.site} onChange={(e) => setEdit((x) => ({ ...x, site: e.target.value }))}>
                <option value="">(No site: not used for petty cash)</option>
                {account.sites.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <div className="text-[11.5px] text-gray-500">The change is recorded in the audit trail. Only DR lines with a site can be picked in a petty cash docket.</div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} disabled={edit.saving} className="h-8 px-3 rounded-md border text-[12.5px]">Cancel</button>
              <button type="button" onClick={saveSite} disabled={edit.saving || (edit.site || "") === (edit.txn.site || "")}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
                {edit.saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {hist && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setHist(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-semibold text-gray-800">Audit trail</div>
            <div className="text-[12px] text-gray-600 break-all">
              {dmy(hist.transaction.date)} · {hist.transaction.type} {formatAmount(hist.transaction.amount)} · {hist.transaction.desc}
            </div>
            <div className="text-[12px] text-gray-500">Imported by {hist.importedBy || "—"} on {hist.importedAt}</div>
            <ul className="text-[12px] space-y-1 max-h-[300px] overflow-auto">
              {hist.history.length === 0 && <li className="text-gray-400">No link activity yet.</li>}
              {hist.history.map((h, i) => (
                <li key={i} className="border-t pt-1">
                  <b>{h.action}</b> {h.docketNo ? `· ${h.docketNo}` : h.docketId ? `· docket #${h.docketId}` : ""} {h.note ? `· ${h.note}` : ""}
                  <div className="text-gray-500">{h.by || "system"} · {h.at}</div>
                </li>
              ))}
            </ul>
            <div className="text-right"><button type="button" onClick={() => setHist(null)} className="h-8 px-3 rounded-md border text-[12.5px]">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── IMPORT HISTORY ───────────────────────────────────────────────────────────

function HistoryTab({ account, canImport }) {
  const [reload, setReload] = useState(0);
  const [res, setRes] = useState({ key: null, list: [] });
  const reqKey = `${account?.id || "all"}#${reload}`;
  const loading = res.key !== reqKey;
  const list = res.list;

  useEffect(() => {
    let alive = true;
    const q = account ? `?bankAccountId=${account.id}` : "";
    apiRequest({ url: `${EP.BATCHES}${q}`, method: "GET" })
      .then((r) => { if (alive) setRes({ key: reqKey, list: Array.isArray(r?.data) ? r.data : [] }); })
      .catch((e) => { if (alive) { setRes({ key: reqKey, list: [] }); toast.error(e?.message || "Could not load history"); } });
    return () => { alive = false; };
  }, [account, reqKey]);
  const load = () => setReload((n) => n + 1);

  const revert = async (b) => {
    if (!window.confirm(`Undo import "${b.fileName || b.id}"? Its ${b.imported} transaction(s) will be removed.`)) return;
    try {
      const r = await apiRequest({ url: `${EP.REVERT}${b.id}/revert`, method: "POST" });
      toast.success(r.message);
      load();
    } catch (e) { toast.error(e?.message || "Could not revert"); }
  };

  return (
    <div className="rounded-lg border bg-white overflow-x-auto">
      <table className="w-full text-[12px] min-w-[960px]">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {["Uploaded", "By", "Account", "File", "Period", "Imported", "Skipped", "Failed", "DR / CR", "Linked", "Status", ""].map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id} className="border-t">
              <td className="px-2 py-1 whitespace-nowrap">{createdOnText(b)}</td>
              <td className="px-2 py-1">{b.createdBy}</td>
              <td className="px-2 py-1">{b.bankCode}</td>
              <td className="px-2 py-1 max-w-[180px] truncate" title={b.fileName || ""}>{b.fileName}</td>
              <td className="px-2 py-1 whitespace-nowrap">{dmy(b.fromDate)} → {dmy(b.toDate)}</td>
              <td className="px-2 py-1 tabular-nums text-green-700">{b.imported}</td>
              <td className="px-2 py-1 tabular-nums text-gray-500">{b.skipped}</td>
              <td className="px-2 py-1 tabular-nums text-red-600">{b.failed}</td>
              <td className="px-2 py-1 tabular-nums whitespace-nowrap">{formatAmount(b.totalDebit)} / {formatAmount(b.totalCredit)}</td>
              <td className="px-2 py-1 tabular-nums">{b.linkedCount}</td>
              <td className="px-2 py-1"><Badge s={b.status === "Active" ? "imported" : "duplicate"} label={b.status} /></td>
              <td className="px-2 py-1">
                {canImport && b.status === "Active" && (
                  <button type="button" onClick={() => revert(b)} disabled={b.linkedCount > 0}
                    title={b.linkedCount ? "Some lines are linked to dockets — unlink them first" : "Undo this import"}
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && <div className="px-3 py-6 text-center text-[12px] text-gray-500">{loading ? "Loading…" : "No imports yet."}</div>}
    </div>
  );
}

function Stat({ label, value, sub, tone, small }) {
  const c = { red: "text-red-600", green: "text-green-700", blue: "text-blue-700", gray: "text-gray-800" }[tone];
  return (
    <div className="rounded-lg border bg-white px-3 py-2">
      <div className="text-[11.5px] text-gray-500">{label}</div>
      <div className={`${small ? "text-[13px]" : "text-[18px]"} font-semibold tabular-nums leading-tight ${c}`}>{value}</div>
      {sub ? <div className="text-[11.5px] text-amber-700">{sub}</div> : null}
    </div>
  );
}
