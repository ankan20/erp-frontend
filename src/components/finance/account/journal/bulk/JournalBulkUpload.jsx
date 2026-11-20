"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, FileText, Download, CheckCircle2, AlertCircle, ChevronRight,
  RefreshCw, Trash2, Plus, Loader2, Send, ExternalLink, Pencil, X,
} from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import { COLUMNS, downloadJournalTemplate, downloadErrorReport, parseJournalFile } from "./journalBulkFile";

const EP = API_ENDPOINTS.FINANCE.JOURNAL_ENTRY;
let _k = 0;
const newKey = () => `v${Date.now().toString(36)}${(_k++).toString(36)}`;

// strip server-only fields before re-sending rows
const cleanRow = (r) => {
  const o = {};
  ["rowNo", ...COLUMNS.map((c) => c.key)].forEach((k) => { o[k] = r[k] ?? ""; });
  return o;
};

// guess which cell an error message belongs to (for red highlighting)
const errorFields = (errs = []) => {
  const f = new Set();
  errs.forEach((e) => {
    const s = e.toLowerCase();
    if (s.includes("date")) f.add("date");
    if (s.startsWith("debit") || s.includes("debit amount") || s.includes("debit column") || s.includes("either debit")) f.add("debit");
    if (s.startsWith("credit") || s.includes("credit amount") || s.includes("credit column") || s.includes("either debit")) f.add("credit");
    if (s.includes("dr/cr")) f.add("drCr");
    if (s.includes("account type") || s.includes("customer")) f.add("accountType");
    if (s.includes("code") || s.includes("ledger") || s.includes("account '") || s.includes("not found") || s.includes("account code")) f.add("accountCode");
  });
  return f;
};

const withKeys = (vs) => (vs || []).map((v) => ({ ...v, _key: newKey(), _dirty: false }));

// ══════════════════════════════════════════════════════════════════════════════

export default function JournalBulkUpload() {
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";
  const clientName  = getLocalStorage("projectInfo")?.clientName  || "";

  const [step,       setStep]       = useState("upload");   // upload | review
  const [fileName,   setFileName]   = useState("");
  const [busy,       setBusy]       = useState("");         // "" | parsing | validating | importing | submitting | template
  const [busyKey,    setBusyKey]    = useState(null);       // voucher key being re-checked / imported
  const [vouchers,   setVouchers]   = useState([]);         // pending (not yet imported)
  const [created,    setCreated]    = useState([]);         // imported drafts
  const [tab,        setTab]        = useState("fix");      // fix | ready | imported
  const [open,       setOpen]       = useState({});         // key → expanded
  const [dragOver,   setDragOver]   = useState(false);
  const [ccList,     setCcList]     = useState([]);
  const [ledgerList, setLedgerList] = useState([]);
  const fileRef = useRef(null);

  // ── masters (for template reference sheets + account suggestions) ─────────
  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?projectCode=${projectCode}`, method: "GET" })
      .then((r) => setCcList(Array.isArray(r?.data) ? r.data : [])).catch(() => {});
    apiRequest({ url: API_ENDPOINTS.MASTER.GET_ALL_LEDGER, method: "GET" })
      .then((r) => setLedgerList(Array.isArray(r?.data) ? r.data : [])).catch(() => {});
  }, [projectCode]);

  // warn before leaving with un-imported rows
  useEffect(() => {
    if (!vouchers.length) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [vouchers.length]);

  // tab membership only changes after a server check, so cards never jump while being edited
  const fixList   = useMemo(() => vouchers.filter((v) => !v.valid), [vouchers]);
  const readyList = useMemo(() => vouchers.filter((v) => v.valid), [vouchers]);
  const readyAmt  = readyList.reduce((s, v) => s + Number(v.totalDebit || 0), 0);

  // ── server calls ──────────────────────────────────────────────────────────
  const callValidate = (rows) =>
    apiRequest({ url: EP.BULK_VALIDATE, method: "POST", data: { projectCode, rows: rows.map(cleanRow) } })
      .then((r) => r.data);

  const callImport = (rows) =>
    apiRequest({ url: EP.BULK_IMPORT, method: "POST", data: { projectCode, rows: rows.map(cleanRow) } })
      .then((r) => ({ ...r.data, message: r.message }));

  // ── 1. file → parse → validate ────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    if (!projectCode) { toast.error("Select a project first"); return; }
    try {
      setBusy("parsing");
      const { rows, skippedExamples } = await parseJournalFile(file);
      setBusy("validating");
      const data = await callValidate(rows);
      const vs = withKeys(data.vouchers);
      setVouchers(vs);
      setCreated([]);
      setFileName(file.name);
      setStep("review");
      const bad = vs.filter((v) => !v.valid);
      setTab(bad.length ? "fix" : "ready");
      setOpen(bad.length && bad.length <= 5 ? Object.fromEntries(bad.map((v) => [v._key, true])) : {});
      toast.success(
        `${rows.length} rows read → ${vs.length} vouchers (${vs.length - bad.length} ready${bad.length ? `, ${bad.length} need correction` : ""})` +
        (skippedExamples ? `. ${skippedExamples} example rows ignored.` : ""),
      );
    } catch (e) {
      toast.error(e?.message || "Could not read the file");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── 2. re-check (one / all) ───────────────────────────────────────────────
  const recheck = async (keys) => {
    const target = vouchers.filter((v) => keys.includes(v._key));
    if (!target.length) return;
    const rows = target.flatMap((v) => v.rows);
    if (!rows.length) { setVouchers((p) => p.filter((v) => !keys.includes(v._key))); return; }
    try {
      setBusyKey(keys.length === 1 ? keys[0] : "__all");
      const data = await callValidate(rows);
      const fresh = withKeys(data.vouchers);
      setVouchers((prev) => {
        const idx = prev.findIndex((v) => keys.includes(v._key));
        const rest = prev.filter((v) => !keys.includes(v._key));
        rest.splice(Math.max(idx, 0), 0, ...fresh);
        return rest;
      });
      setOpen((p) => {
        const n = { ...p };
        fresh.forEach((v) => { if (!v.valid) n[v._key] = true; });
        return n;
      });
      const ok = fresh.filter((v) => v.valid).length;
      if (ok === fresh.length) toast.success(fresh.length === 1 ? "Looks good — voucher is ready" : `All ${ok} vouchers are ready`);
      else toast.warning(`${ok} ready, ${fresh.length - ok} still need correction`);
    } catch (e) {
      toast.error(e?.message || "Validation failed");
    } finally { setBusyKey(null); }
  };

  // ── 3. import (one / all ready) ───────────────────────────────────────────
  const importVouchers = async (keys) => {
    const target = vouchers.filter((v) => keys.includes(v._key));
    if (!target.length) return;
    try {
      if (keys.length === 1) setBusyKey(keys[0]); else setBusy("importing");
      const data = await callImport(target.flatMap((v) => v.rows));
      const failed = withKeys(data.failed);
      setCreated((p) => [...p, ...(data.created || []).map((c) => ({ ...c, status: "Draft" }))]);
      setVouchers((prev) => {
        const idx = prev.findIndex((v) => keys.includes(v._key));
        const rest = prev.filter((v) => !keys.includes(v._key));
        rest.splice(Math.max(idx, 0), 0, ...failed);
        return rest;
      });
      setOpen((p) => { const n = { ...p }; failed.forEach((v) => { n[v._key] = true; }); return n; });
      const nC = data.created?.length || 0;
      if (nC && !failed.length) toast.success(data.message);
      else if (nC) toast.warning(data.message);
      else toast.error("Nothing imported — please correct the errors shown");
      if (nC && vouchers.length - target.length + failed.length === 0) setTab("imported");
    } catch (e) {
      toast.error(e?.message || "Import failed");
    } finally { setBusy(""); setBusyKey(null); }
  };

  // ── 4. submit imported drafts for approval ────────────────────────────────
  const submitAll = async () => {
    const drafts = created.filter((c) => c.status === "Draft" || c.status === "Failed");
    if (!drafts.length) return;
    setBusy("submitting");
    let ok = 0, bad = 0;
    for (const c of drafts) {
      try {
        const r = await apiRequest({ url: `${EP.SUBMIT}${c.id}`, method: "POST" });
        ok++;
        setCreated((p) => p.map((x) => (x.id === c.id ? { ...x, status: r?.data?.workflowStatus || "Submitted", err: null } : x)));
      } catch (e) {
        bad++;
        setCreated((p) => p.map((x) => (x.id === c.id ? { ...x, status: "Failed", err: e?.message } : x)));
      }
    }
    setBusy("");
    if (bad) toast.warning(`${ok} submitted, ${bad} failed`); else toast.success(`${ok} journal entries submitted for approval`);
  };

  // ── editing helpers ───────────────────────────────────────────────────────
  const patchVoucher = useCallback((key, fn) => {
    setVouchers((prev) => prev.map((v) => (v._key === key ? { ...fn(v), _dirty: true } : v)));
  }, []);

  const setCell = (key, i, field, value) =>
    patchVoucher(key, (v) => ({
      ...v,
      rows: v.rows.map((r, j) => {
        if (j !== i) return r;
        const n = { ...r, [field]: value };
        if (field === "accountCode" || field === "accountType") n.accountName = null;
        return n;
      }),
    }));

  const setAll = (key, field, value) =>
    patchVoucher(key, (v) => ({ ...v, [field === "voucherRef" ? "voucherRef" : "_hdrDate"]: value, rows: v.rows.map((r) => ({ ...r, [field]: value })) }));

  const addRow = (key) =>
    patchVoucher(key, (v) => {
      const last = v.rows[v.rows.length - 1] || {};
      return { ...v, rows: [...v.rows, { rowNo: "new", voucherRef: last.voucherRef ?? v.voucherRef, date: last.date ?? "", drCr: "Cr", accountType: "Vendor", accountCode: "", debit: "", credit: "", remarks: "", errors: [] }] };
    });

  const delRow = (key, i) => patchVoucher(key, (v) => ({ ...v, rows: v.rows.filter((_, j) => j !== i) }));

  const discard = (key) => setVouchers((p) => p.filter((v) => v._key !== key));

  const reset = () => {
    if (vouchers.length && !window.confirm(`${vouchers.length} voucher(s) are not imported yet. Discard them and upload a new file?`)) return;
    setVouchers([]); setCreated([]); setStep("upload"); setFileName(""); setOpen({});
  };

  const getTemplate = async (format) => {
    try { setBusy("template"); await downloadJournalTemplate({ format, ccList, ledgerList, projectCode }); }
    catch { toast.error("Could not create template"); }
    finally { setBusy(""); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const datalists = (
    <>
      <datalist id="jb-cc">{ccList.map((c) => <option key={c.ccId} value={c.ccCode}>{c.ccName}</option>)}</datalist>
      <datalist id="jb-led">{ledgerList.map((l) => <option key={l.ledgerId} value={l.ledgerCode}>{l.ledgerName}</option>)}</datalist>
    </>
  );

  if (step === "upload") {
    const loading = busy === "parsing" || busy === "validating";
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-800">Bulk upload journal entries</h1>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Create many journal vouchers at once from an Excel or CSV file. Everything is checked before saving. Nothing is posted until approval.
          </p>
        </div>

        {/* steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            ["1", "Download template", "It includes this project's CC codes and ledgers for reference"],
            ["2", "Fill one row per Dr / Cr line", "Same Voucher Ref = one voucher. Debit must equal Credit"],
            ["3", "Upload & review", "Ready vouchers save as Draft. Fix the rest right here"],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-2.5 rounded-lg border bg-white p-3">
              <span className="flex-none w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[12px] font-semibold flex items-center justify-center">{n}</span>
              <div>
                <div className="text-[12.5px] font-medium text-gray-800">{t}</div>
                <div className="text-[11.5px] text-gray-500 leading-snug">{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* template */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
          <span className="text-[12.5px] text-gray-700 mr-auto">Start with the template:</span>
          <button type="button" onClick={() => getTemplate("xlsx")} disabled={busy === "template"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-green-600 text-green-700 text-[12.5px] font-medium hover:bg-green-50 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel template (.xlsx)
          </button>
          <button type="button" onClick={() => getTemplate("csv")} disabled={busy === "template"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-gray-700 text-[12.5px] font-medium hover:bg-gray-50 disabled:opacity-50">
            <FileText className="w-4 h-4" /> CSV template
          </button>
        </div>

        {/* dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => !loading && fileRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
          className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition
            ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"}`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,text/csv" className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])} />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <EdoxMark size={40} />
              <div className="text-[13px]">{busy === "parsing" ? "Reading file…" : "Checking every row…"}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-blue-600" />
              <div className="text-[13.5px] font-medium text-gray-800">Drop your file here, or click to browse</div>
              <div className="text-[11.5px] text-gray-500">.xlsx, .xls or .csv · up to 5000 rows</div>
            </div>
          )}
        </div>

        {/* format at a glance */}
        <div className="rounded-lg border bg-white">
          <div className="px-3 py-2 border-b text-[12px] font-medium text-gray-700">Format at a glance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>{COLUMNS.map((c) => <th key={c.key} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{c.header}</th>)}</tr>
              </thead>
              <tbody className="text-gray-700 tabular-nums">
                {[
                  ["1", "15-11-2026", "Dr", "CC",       "CC0012",  "5,000",  "",       "Site expenses"],
                  ["1", "15-11-2026", "Dr", "CC",       "CC0015",  "3,000",  "",       ""],
                  ["1", "15-11-2026", "Cr", "Vendor",   "LED0045", "",       "8,000",  ""],
                  ["2", "16-11-2026", "Dr", "Vendor",   "LED0101", "12,000", "",       "Client adjustment"],
                  ["2", "16-11-2026", "Cr", "Customer", "(blank)", "",       "12,000", ""],
                ].map((r, i) => (
                  <tr key={i} className={`border-t ${r[0] === "2" ? "bg-amber-50/40" : ""}`}>
                    {r.map((c, j) => <td key={j} className={`px-2 py-1 whitespace-nowrap ${j >= 5 && j <= 6 ? "text-right" : ""} ${c === "(blank)" ? "text-gray-400 italic" : ""}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t text-[11.5px] text-gray-500 space-y-0.5">
            <div>• <b>Account Type</b>: CC, Vendor (any ledger) or Customer. For Customer, leave the code blank and the project client{clientName ? ` (${clientName})` : ""} is used.</div>
            <div>• Dr and Cr lines can use any account type, and a voucher may have several Cr lines.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────
  const list = tab === "fix" ? fixList : tab === "ready" ? readyList : [];
  const draftsLeft = created.filter((c) => c.status === "Draft" || c.status === "Failed").length;

  return (
    <div className="p-3 space-y-3">
      {datalists}

      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-green-700" />
        <span className="text-[13px] font-medium text-gray-800 truncate max-w-[280px]" title={fileName}>{fileName}</span>
        <button type="button" onClick={reset} className="text-[12px] text-blue-600 hover:underline ml-1">Upload another file</button>
        <div className="ml-auto flex flex-wrap gap-2">
          {fixList.length > 0 && (
            <button type="button" onClick={() => downloadErrorReport(fixList)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50"
              title="Download only the vouchers that need correction, with an Errors column. Fix them in Excel and upload that file.">
              <Download className="w-4 h-4" /> Download corrections
            </button>
          )}
          {vouchers.length > 0 && (
            <button type="button" onClick={() => recheck(vouchers.map((v) => v._key))} disabled={!!busyKey || !!busy}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${busyKey === "__all" ? "animate-spin" : ""}`} /> Re-check all
            </button>
          )}
          <button type="button" onClick={() => importVouchers(readyList.map((v) => v._key))}
            disabled={!readyList.length || !!busy || !!busyKey}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
            {busy === "importing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Import {readyList.length} ready voucher{readyList.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Need correction" value={fixList.length} tone={fixList.length ? "red" : "gray"} />
        <Stat label="Ready to import" value={readyList.length} sub={readyList.length ? `₹ ${formatAmount(readyAmt)}` : ""} tone="green" />
        <Stat label="Imported as Draft" value={created.length} sub={created.length ? `₹ ${formatAmount(created.reduce((s, c) => s + Number(c.amount || 0), 0))}` : ""} tone="blue" />
        <Stat label="Total lines pending" value={vouchers.reduce((s, v) => s + v.rows.length, 0)} tone="gray" />
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b">
        {[
          ["fix", "Need correction", fixList.length, "text-red-600"],
          ["ready", "Ready", readyList.length, "text-green-700"],
          ["imported", "Imported", created.length, "text-blue-700"],
        ].map(([k, l, n, c]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-3 py-1.5 text-[12.5px] -mb-px border-b-2 ${tab === k ? "border-blue-600 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {l} <span className={`ml-1 ${n ? c : "text-gray-400"}`}>({n})</span>
          </button>
        ))}
        {tab !== "imported" && list.length > 1 && (
          <button type="button" className="ml-auto text-[12px] text-gray-500 hover:text-gray-700 px-2"
            onClick={() => {
              const allOpen = list.every((v) => open[v._key]);
              setOpen((p) => ({ ...p, ...Object.fromEntries(list.map((v) => [v._key, !allOpen])) }));
            }}>
            {list.every((v) => open[v._key]) ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {tab === "fix" && fixList.length > 0 && (
        <div className="text-[12px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Fix the cells marked in red, then click <b>Re-check</b> or <b>Import</b> on a voucher, or <b>Re-check all</b> above.
          To fix them in Excel instead, use <b>Download corrections</b>, edit the file and upload it again. Only those vouchers will be in it.
        </div>
      )}

      {tab !== "imported" && (
        list.length === 0 ? (
          <Empty tab={tab} hasCreated={created.length > 0} onGo={() => setTab(tab === "fix" ? (readyList.length ? "ready" : "imported") : "fix")} />
        ) : (
          <div className="space-y-2">
            {list.map((v) => (
              <VoucherCard
                key={v._key} v={v} expanded={!!open[v._key]} busy={busyKey === v._key} disabled={!!busy || (busyKey && busyKey !== v._key)}
                clientName={clientName}
                onToggle={() => setOpen((p) => ({ ...p, [v._key]: !p[v._key] }))}
                onCell={(i, f, val) => setCell(v._key, i, f, val)}
                onAll={(f, val) => setAll(v._key, f, val)}
                onAddRow={() => addRow(v._key)}
                onDelRow={(i) => delRow(v._key, i)}
                onRecheck={() => recheck([v._key])}
                onImport={() => importVouchers([v._key])}
                onDiscard={() => discard(v._key)}
              />
            ))}
          </div>
        )
      )}

      {tab === "imported" && (
        created.length === 0 ? (
          <Empty tab="imported" onGo={() => setTab(readyList.length ? "ready" : "fix")} />
        ) : (
          <div className="rounded-lg border bg-white">
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <span className="text-[12.5px] text-gray-700">These are saved as <b>Draft</b>. Submit them for approval now, or open each one to review it first.</span>
              <button type="button" onClick={submitAll} disabled={!draftsLeft || busy === "submitting"}
                className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
                {busy === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit {draftsLeft || ""} for approval
              </button>
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Your Ref</th>
                  <th className="px-3 py-1.5 text-left font-medium">Voucher No</th>
                  <th className="px-3 py-1.5 text-left font-medium">Date</th>
                  <th className="px-3 py-1.5 text-right font-medium">Lines</th>
                  <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                  <th className="px-3 py-1.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {created.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-1.5 text-gray-600">{c.voucherRef}</td>
                    <td className="px-3 py-1.5">
                      <a href={`/finance-management/account/journal/${c.id}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                        {c.voucherNo} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-3 py-1.5">{c.date ? c.date.split("-").reverse().join("-") : ""}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.lineCount}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(c.amount)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[11.5px] px-1.5 py-0.5 rounded ${c.status === "Draft" ? "bg-gray-100 text-gray-700" : c.status === "Failed" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
                        title={c.err || ""}>
                        {c.status}{c.err ? `: ${c.err}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════

function Stat({ label, value, sub, tone }) {
  const c = { red: "text-red-600", green: "text-green-700", blue: "text-blue-700", gray: "text-gray-800" }[tone];
  return (
    <div className="rounded-lg border bg-white px-3 py-2">
      <div className="text-[11.5px] text-gray-500">{label}</div>
      <div className={`text-[18px] font-semibold tabular-nums leading-tight ${c}`}>{value}</div>
      {sub ? <div className="text-[11.5px] text-gray-500 tabular-nums">{sub}</div> : null}
    </div>
  );
}

function Empty({ tab, hasCreated, onGo }) {
  const msg = {
    fix:      ["No errors", hasCreated ? "Everything that needed fixing is done." : "Every voucher passed the checks.", "View ready vouchers"],
    ready:    ["Nothing ready yet", "Fix the vouchers in Need correction and they will show up here.", "Go to Need correction"],
    imported: ["Nothing imported yet", "Import the ready vouchers to create Draft journal entries.", "View ready vouchers"],
  }[tab];
  return (
    <div className="rounded-lg border border-dashed bg-white py-10 text-center">
      <CheckCircle2 className="w-7 h-7 mx-auto text-gray-300" />
      <div className="mt-2 text-[13px] font-medium text-gray-700">{msg[0]}</div>
      <div className="text-[12px] text-gray-500">{msg[1]}</div>
      <button type="button" onClick={onGo} className="mt-2 text-[12px] text-blue-600 hover:underline">{msg[2]}</button>
    </div>
  );
}

function VoucherCard({ v, expanded, busy, disabled, clientName, onToggle, onCell, onAll, onAddRow, onDelRow, onRecheck, onImport, onDiscard }) {
  const rowErrCount = v.rows.filter((r) => r.errors?.length).length;
  const errCount = rowErrCount + (v.errors?.length || 0);
  const drSum = v.rows.reduce((s, r) => s + (String(r.drCr).toLowerCase().startsWith("d") ? Number(String(r.debit).replace(/,/g, "")) || 0 : 0), 0);
  const crSum = v.rows.reduce((s, r) => s + (String(r.drCr).toLowerCase().startsWith("c") ? Number(String(r.credit).replace(/,/g, "")) || 0 : 0), 0);
  const diff = Math.round((drSum - crSum) * 100) / 100;
  const hdrDate = v._hdrDate ?? v.rows[0]?.date ?? "";

  const badge = v._dirty
    ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Edited, re-check</span>
    : v.valid
      ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>
      : <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errCount} issue{errCount === 1 ? "" : "s"}</span>;

  const cell = "h-[28px] w-full text-[12.5px] px-1.5 border rounded outline-none focus:ring-1 focus:ring-blue-300 bg-white";
  const bad = "border-red-400 bg-red-50";
  const ok = "border-gray-200";

  return (
    <div className={`rounded-lg border bg-white ${!v.valid && !v._dirty ? "border-red-200" : ""}`}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-left" aria-expanded={expanded}>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <span className="text-[12.5px] text-gray-500">Ref</span>
          <span className="text-[13px] font-medium text-gray-800">{v.voucherRef || <i className="text-red-500">missing</i>}</span>
        </button>
        <span className="text-[12px] text-gray-500">{hdrDate || "no date"}</span>
        <span className="text-[12px] text-gray-500">{v.rows.length} line{v.rows.length === 1 ? "" : "s"}</span>
        <span className="text-[12px] tabular-nums text-gray-700">Dr {formatAmount(drSum)} · Cr {formatAmount(crSum)}</span>
        {diff !== 0 && <span className="text-[11.5px] tabular-nums text-red-600">diff {formatAmount(Math.abs(diff))}</span>}
        {badge}
        <div className="ml-auto flex items-center gap-1.5">
          {!expanded && !v.valid && (
            <button type="button" onClick={onToggle} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[12px] text-gray-700 hover:bg-gray-50">
              <Pencil className="w-3.5 h-3.5" /> Fix
            </button>
          )}
          <button type="button" onClick={onRecheck} disabled={disabled || busy}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} /> Re-check
          </button>
          <button type="button" onClick={onImport} disabled={disabled || busy}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 text-white text-[12px] hover:bg-blue-700 disabled:opacity-40"
            title="Validate and save this voucher as Draft">
            <CheckCircle2 className="w-3.5 h-3.5" /> Import
          </button>
          <button type="button" onClick={() => { if (window.confirm("Remove this voucher from the upload?")) onDiscard(); }} disabled={disabled || busy}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Remove from upload">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* voucher-level errors */}
      {v.errors?.length > 0 && (
        <div className="px-3 pb-2 -mt-0.5 space-y-0.5">
          {v.errors.map((e, i) => (
            <div key={i} className="text-[12px] text-red-600 flex items-start gap-1"><AlertCircle className="w-3.5 h-3.5 mt-[1px] flex-none" />{e}</div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* voucher header fields */}
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-[11.5px] text-gray-500">
              Voucher Ref
              <input className={`${cell} ${ok} mt-0.5 w-32 block`} value={v.voucherRef ?? ""} onChange={(e) => onAll("voucherRef", e.target.value)} />
            </label>
            <label className="text-[11.5px] text-gray-500">
              Date (DD-MM-YYYY), applies to all lines
              <input className={`${cell} mt-0.5 w-36 block ${v.rows.some((r) => errorFields(r.errors).has("date")) || v.errors?.some((e) => e.includes("Date")) ? bad : ok}`}
                value={hdrDate} placeholder="15-11-2026" onChange={(e) => onAll("date", e.target.value)} />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[860px]">
              <thead className="text-gray-500">
                <tr>
                  <th className="w-12 text-left font-medium px-1 py-1">Row</th>
                  <th className="w-20 text-left font-medium px-1">Dr/Cr</th>
                  <th className="w-28 text-left font-medium px-1">Account Type</th>
                  <th className="w-36 text-left font-medium px-1">Account Code</th>
                  <th className="text-left font-medium px-1">Account Name</th>
                  <th className="w-28 text-right font-medium px-1">Debit</th>
                  <th className="w-28 text-right font-medium px-1">Credit</th>
                  <th className="w-48 text-left font-medium px-1">Remarks</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {v.rows.map((r, i) => {
                  const ef = errorFields(r.errors);
                  const t = String(r.accountType || "").toLowerCase();
                  const isCust = t.startsWith("cust") || t === "client";
                  const isDr = String(r.drCr).toLowerCase().startsWith("d");
                  const isCr = String(r.drCr).toLowerCase().startsWith("c");
                  return [
                    <tr key={`r${i}`} className="align-middle">
                      <td className="px-1 py-0.5 text-gray-400 tabular-nums" title="Row number in your file">{r.rowNo}</td>
                      <td className="px-1 py-0.5">
                        <select className={`${cell} ${ef.has("drCr") ? bad : ok}`} value={isDr ? "Dr" : isCr ? "Cr" : r.drCr || ""}
                          onChange={(e) => onCell(i, "drCr", e.target.value)}>
                          {!isDr && !isCr && <option value={r.drCr || ""}>{r.drCr || "—"}</option>}
                          <option value="Dr">Dr</option><option value="Cr">Cr</option>
                        </select>
                      </td>
                      <td className="px-1 py-0.5">
                        <select className={`${cell} ${ef.has("accountType") ? bad : ok}`}
                          value={["CC", "Vendor", "Customer"].includes(r.accountType) ? r.accountType : r.accountType || ""}
                          onChange={(e) => onCell(i, "accountType", e.target.value)}>
                          {!["CC", "Vendor", "Customer"].includes(r.accountType) && <option value={r.accountType || ""}>{r.accountType || "Auto-detect"}</option>}
                          <option value="CC">CC</option><option value="Vendor">Vendor</option><option value="Customer">Customer</option>
                        </select>
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} ${ef.has("accountCode") ? bad : ok} ${isCust ? "bg-gray-50 text-gray-400" : ""}`}
                          value={isCust ? "" : r.accountCode ?? ""} disabled={isCust} placeholder={isCust ? "client" : "code"}
                          list={r.accountType === "CC" ? "jb-cc" : r.accountType === "Vendor" ? "jb-led" : undefined}
                          onChange={(e) => onCell(i, "accountCode", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5 text-gray-600 truncate max-w-[220px]" title={r.accountName || ""}>
                        {isCust ? (clientName || r.accountName || "") : r.accountName ||<span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} text-right tabular-nums ${ef.has("debit") ? bad : ok} ${isCr ? "bg-gray-50" : ""}`}
                          value={r.debit === 0 ? "" : r.debit ?? ""} inputMode="decimal"
                          onChange={(e) => onCell(i, "debit", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} text-right tabular-nums ${ef.has("credit") ? bad : ok} ${isDr ? "bg-gray-50" : ""}`}
                          value={r.credit === 0 ? "" : r.credit ?? ""} inputMode="decimal"
                          onChange={(e) => onCell(i, "credit", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} ${ok}`} value={r.remarks ?? ""} onChange={(e) => onCell(i, "remarks", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5">
                        <button type="button" onClick={() => onDelRow(i)} className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete line">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>,
                    r.errors?.length ? (
                      <tr key={`e${i}`}>
                        <td />
                        <td colSpan={8} className="px-1 pb-1.5 text-[11.5px] text-red-600">{r.errors.join(" · ")}</td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={onAddRow} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add line
          </button>
        </div>
      )}
    </div>
  );
}
