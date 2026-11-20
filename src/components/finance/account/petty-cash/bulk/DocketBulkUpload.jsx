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
import { COLUMNS, HEADER_KEYS, downloadDocketTemplate, downloadErrorReport, parseDocketFile } from "./docketBulkFile";

const EP = API_ENDPOINTS.FINANCE.PETTY_CASH.DOCKET_VOUCHER;
const DETAIL_PATH = "/finance-management/account/petty-cash/expenses-docket";

let _k = 0;
const newKey = () => `d${Date.now().toString(36)}${(_k++).toString(36)}`;

// strip server-only fields before re-sending rows
const cleanRow = (r) => {
  const o = {};
  ["rowNo", ...COLUMNS.map((c) => c.key)].forEach((k) => { o[k] = r[k] ?? ""; });
  return o;
};

const withKeys = (ds) => (ds || []).map((d) => ({ ...d, _key: newKey(), _dirty: false }));

const isCashMode = (m) => String(m || "").toLowerCase().startsWith("cash");

// which line cell an error message belongs to (for red highlighting)
const lineErrorFields = (errs = []) => {
  const f = new Set();
  errs.forEach((e) => {
    const s = e.toLowerCase();
    if (s.includes("cc")) f.add("ccCode");
    if (s.includes("amount")) f.add("amount");
    if (s.includes("description")) f.add("description");
  });
  return f;
};

// ══════════════════════════════════════════════════════════════════════════════

export default function DocketBulkUpload() {
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [step,     setStep]     = useState("upload");   // upload | review
  const [fileName, setFileName] = useState("");
  const [busy,     setBusy]     = useState("");         // "" | parsing | validating | importing | submitting | template
  const [busyKey,  setBusyKey]  = useState(null);
  const [dockets,  setDockets]  = useState([]);         // pending (not yet imported)
  const [created,  setCreated]  = useState([]);         // imported drafts
  const [tab,      setTab]      = useState("fix");      // fix | ready | imported
  const [open,     setOpen]     = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [ref,      setRef]      = useState({ budgets: [], accounts: [] });
  const [ccList,   setCcList]   = useState([]);         // all CC codes (non-budget CCs are allowed)
  const fileRef = useRef(null);

  // ── reference data: approved budgets (per-CC balance) + project accounts ──
  const loadReference = useCallback(() => {
    if (!projectCode) return Promise.resolve();
    return apiRequest({ url: `${EP.BULK_REFERENCE}?projectCode=${projectCode}`, method: "GET" })
      .then((r) => setRef({ budgets: r?.data?.budgets || [], accounts: r?.data?.accounts || [] }))
      .catch(() => {});
  }, [projectCode]);

  useEffect(() => { loadReference(); }, [loadReference]);

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${API_ENDPOINTS.MASTER.GET_ALL_CC_CODE}?projectCode=${projectCode}`, method: "GET" })
      .then((r) => setCcList(Array.isArray(r?.data) ? r.data : [])).catch(() => {});
  }, [projectCode]);

  // warn before leaving with un-imported rows
  useEffect(() => {
    if (!dockets.length) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dockets.length]);

  const budgetByNo = useMemo(
    () => Object.fromEntries(ref.budgets.map((b) => [String(b.budgetNo).toUpperCase(), b])),
    [ref.budgets],
  );

  const ccByCode = useMemo(
    () => Object.fromEntries(ccList.map((c) => [String(c.ccCode).toUpperCase(), c.ccName])),
    [ccList],
  );

  const fixList   = useMemo(() => dockets.filter((d) => !d.valid), [dockets]);
  const readyList = useMemo(() => dockets.filter((d) => d.valid), [dockets]);
  const readyAmt  = readyList.reduce((s, d) => s + Number(d.totalAmount || 0), 0);

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
      const { rows, skippedExamples } = await parseDocketFile(file);
      setBusy("validating");
      const data = await callValidate(rows);
      const ds = withKeys(data.dockets);
      setDockets(ds);
      setCreated([]);
      setFileName(file.name);
      setStep("review");
      const bad = ds.filter((d) => !d.valid);
      setTab(bad.length ? "fix" : "ready");
      setOpen(bad.length && bad.length <= 5 ? Object.fromEntries(bad.map((d) => [d._key, true])) : {});
      toast.success(
        `${rows.length} rows read → ${ds.length} dockets (${ds.length - bad.length} ready${bad.length ? `, ${bad.length} need correction` : ""})` +
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
  // Budget balance is cumulative across dockets, so a re-check of one docket is
  // validated on its own against what is already saved in the system.
  const recheck = async (keys) => {
    const target = dockets.filter((d) => keys.includes(d._key));
    if (!target.length) return;
    const rows = target.flatMap((d) => d.rows);
    if (!rows.length) { setDockets((p) => p.filter((d) => !keys.includes(d._key))); return; }
    try {
      setBusyKey(keys.length === 1 ? keys[0] : "__all");
      const data = await callValidate(rows);
      const fresh = withKeys(data.dockets);
      setDockets((prev) => {
        const idx = prev.findIndex((d) => keys.includes(d._key));
        const rest = prev.filter((d) => !keys.includes(d._key));
        rest.splice(Math.max(idx, 0), 0, ...fresh);
        return rest;
      });
      setOpen((p) => {
        const n = { ...p };
        fresh.forEach((d) => { if (!d.valid) n[d._key] = true; });
        return n;
      });
      const ok = fresh.filter((d) => d.valid).length;
      if (ok === fresh.length) toast.success(fresh.length === 1 ? "Looks good — docket is ready" : `All ${ok} dockets are ready`);
      else toast.warning(`${ok} ready, ${fresh.length - ok} still need correction`);
    } catch (e) {
      toast.error(e?.message || "Validation failed");
    } finally { setBusyKey(null); }
  };

  // ── 3. import (one / all ready) ───────────────────────────────────────────
  const importDockets = async (keys) => {
    const target = dockets.filter((d) => keys.includes(d._key));
    if (!target.length) return;
    try {
      if (keys.length === 1) setBusyKey(keys[0]); else setBusy("importing");
      const data = await callImport(target.flatMap((d) => d.rows));
      const failed = withKeys(data.failed);
      setCreated((p) => [...p, ...(data.created || []).map((c) => ({ ...c, status: "Draft" }))]);
      setDockets((prev) => {
        const idx = prev.findIndex((d) => keys.includes(d._key));
        const rest = prev.filter((d) => !keys.includes(d._key));
        rest.splice(Math.max(idx, 0), 0, ...failed);
        return rest;
      });
      setOpen((p) => { const n = { ...p }; failed.forEach((d) => { n[d._key] = true; }); return n; });
      const nC = data.created?.length || 0;
      if (nC && !failed.length) toast.success(data.message);
      else if (nC) toast.warning(data.message);
      else toast.error("Nothing imported — please correct the errors shown");
      if (nC && dockets.length - target.length + failed.length === 0) setTab("imported");
      if (nC) loadReference();   // budget balances changed
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
    if (bad) toast.warning(`${ok} submitted, ${bad} failed`); else toast.success(`${ok} expense dockets submitted for approval`);
  };

  // ── editing helpers ───────────────────────────────────────────────────────
  const patchDocket = useCallback((key, fn) => {
    setDockets((prev) => prev.map((d) => (d._key === key ? { ...fn(d), _dirty: true } : d)));
  }, []);

  const setCell = (key, i, field, value) =>
    patchDocket(key, (d) => ({
      ...d,
      rows: d.rows.map((r, j) => {
        if (j !== i) return r;
        const n = { ...r, [field]: value };
        if (field === "ccCode") n.ccName = null;
        return n;
      }),
    }));

  // docket-level field → written on every row (server requires them identical)
  const setHeader = (key, field, value) =>
    patchDocket(key, (d) => ({
      ...d,
      _hdr: { ...(d._hdr || {}), [field]: value },
      ...(field === "docketRef" ? { docketRef: value } : {}),
      rows: d.rows.map((r) => ({ ...r, [field]: value })),
    }));

  const addRow = (key) =>
    patchDocket(key, (d) => {
      const last = d.rows[d.rows.length - 1] || {};
      const base = { rowNo: "new", docketRef: last.docketRef ?? d.docketRef };
      HEADER_KEYS.forEach((k) => { base[k] = last[k] ?? ""; });
      return { ...d, rows: [...d.rows, { ...base, ccCode: "", ccName: null, description: "", amount: "", errors: [] }] };
    });

  const delRow = (key, i) => patchDocket(key, (d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }));

  const discard = (key) => setDockets((p) => p.filter((d) => d._key !== key));

  const reset = () => {
    if (dockets.length && !window.confirm(`${dockets.length} docket(s) are not imported yet. Discard them and upload a new file?`)) return;
    setDockets([]); setCreated([]); setStep("upload"); setFileName(""); setOpen({});
  };

  const getTemplate = async (format) => {
    try {
      setBusy("template");
      await downloadDocketTemplate({ format, budgets: ref.budgets, accounts: ref.accounts, ccList, projectCode });
    } catch { toast.error("Could not create template"); }
    finally { setBusy(""); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const datalists = (
    <>
      <datalist id="db-budget">{ref.budgets.map((b) => <option key={b.id} value={b.budgetNo}>{`${b.fromDate || ""} → ${b.toDate || ""}`}</option>)}</datalist>
      <datalist id="db-acc-cash">{ref.accounts.filter((a) => a.type === "CASH").map((a) => <option key={a.id} value={a.bankCode}>{a.name}</option>)}</datalist>
      <datalist id="db-acc-bank">{ref.accounts.filter((a) => a.type === "BANK").map((a) => <option key={a.id} value={a.bankCode}>{a.name}</option>)}</datalist>
      {/* budget CCs first (with balance), then every other CC — non-budget CCs are allowed */}
      <datalist id="db-cc-all">{ccList.map((c) => <option key={c.ccCode} value={c.ccCode}>{c.ccName}</option>)}</datalist>
      {ref.budgets.map((b) => {
        const inB = new Set((b.rows || []).map((r) => String(r.ccCode).toUpperCase()));
        return (
          <datalist key={b.id} id={`db-cc-${b.id}`}>
            {(b.rows || []).map((r) => <option key={r.ccCode} value={r.ccCode}>{`${r.ccName || ""} · bal ${formatAmount(r.remaining)}`}</option>)}
            {ccList.filter((c) => !inB.has(String(c.ccCode).toUpperCase()))
              .map((c) => <option key={c.ccCode} value={c.ccCode}>{`${c.ccName || ""} · not in budget`}</option>)}
          </datalist>
        );
      })}
    </>
  );

  if (step === "upload") {
    const loading = busy === "parsing" || busy === "validating";
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-800">Bulk upload expense dockets</h1>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Create many petty cash expense dockets at once from an Excel or CSV file, each against an approved budget.
            Everything is checked before saving, including budget balance per CC.
          </p>
        </div>

        {/* steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            ["1", "Download template", "It includes this project's approved budgets with balance per CC, and cash/bank accounts"],
            ["2", "Fill one row per CC expense", "Same Docket Ref = one docket. Budget CCs must stay within balance; other CCs are allowed"],
            ["3", "Upload & review", "Ready dockets save as Draft. Fix the rest right here"],
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
          <span className="text-[12.5px] text-gray-700 mr-auto">
            Start with the template:
            {ref.budgets.length === 0 && (
              <span className="ml-2 text-amber-700">No approved petty cash budget found for this project. Dockets need one.</span>
            )}
          </span>
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
              <div className="text-[13px]">{busy === "parsing" ? "Reading file…" : "Checking every row against the budget…"}</div>
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
                  ["1", "15-11-2026", "PB00012", "Ramesh Kumar", "Bank/UPI", "HDFC-SITE", "UTR8812", "CC0012", "Tea & snacks",     "1,200"],
                  ["1", "15-11-2026", "PB00012", "Ramesh Kumar", "Bank/UPI", "HDFC-SITE", "UTR8812", "CC0031", "Local conveyance", "800"],
                  ["2", "16-11-2026", "PB00012", "Suresh Das",   "Cash",     "CASH-SITE", "",        "CC0012", "Stationery",       "450"],
                ].map((r, i) => (
                  <tr key={i} className={`border-t ${r[0] === "2" ? "bg-amber-50/40" : ""}`}>
                    {r.map((c, j) => <td key={j} className={`px-2 py-1 whitespace-nowrap ${j === 9 ? "text-right" : ""}`}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t text-[11.5px] text-gray-500 space-y-0.5">
            <div>• <b>Budget No</b> must be an Approved budget of this project. Any CC code can be used: CCs in the budget must fit their balance, CCs not in the budget are allowed.</div>
            <div>• <b>Payment Mode</b>: Cash (one line per docket, cash account) or Bank/UPI (bank account). Account Code can be blank if the project has only one account of that type.</div>
            <div>• Date, Budget No, Expenses By, Payment Mode, Account Code and Transaction ID are the same on every row of a docket.</div>
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
              title="Download only the dockets that need correction, with an Errors column. Fix them in Excel and upload that file.">
              <Download className="w-4 h-4" /> Download corrections
            </button>
          )}
          {dockets.length > 0 && (
            <button type="button" onClick={() => recheck(dockets.map((d) => d._key))} disabled={!!busyKey || !!busy}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${busyKey === "__all" ? "animate-spin" : ""}`} /> Re-check all
            </button>
          )}
          <button type="button" onClick={() => importDockets(readyList.map((d) => d._key))}
            disabled={!readyList.length || !!busy || !!busyKey}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
            {busy === "importing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Import {readyList.length} ready docket{readyList.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Need correction" value={fixList.length} tone={fixList.length ? "red" : "gray"} />
        <Stat label="Ready to import" value={readyList.length} sub={readyList.length ? `₹ ${formatAmount(readyAmt)}` : ""} tone="green" />
        <Stat label="Imported as Draft" value={created.length} sub={created.length ? `₹ ${formatAmount(created.reduce((s, c) => s + Number(c.amount || 0), 0))}` : ""} tone="blue" />
        <Stat label="Total lines pending" value={dockets.reduce((s, d) => s + d.rows.length, 0)} tone="gray" />
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
              const allOpen = list.every((d) => open[d._key]);
              setOpen((p) => ({ ...p, ...Object.fromEntries(list.map((d) => [d._key, !allOpen])) }));
            }}>
            {list.every((d) => open[d._key]) ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {tab === "fix" && fixList.length > 0 && (
        <div className="text-[12px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Fix the fields marked in red, then click <b>Re-check</b> or <b>Import</b> on a docket, or <b>Re-check all</b> above.
          To fix them in Excel instead, use <b>Download corrections</b>, edit the file and upload it again. Only those dockets will be in it.
        </div>
      )}

      {tab !== "imported" && (
        list.length === 0 ? (
          <Empty tab={tab} hasCreated={created.length > 0} onGo={() => setTab(tab === "fix" ? (readyList.length ? "ready" : "imported") : "fix")} />
        ) : (
          <div className="space-y-2">
            {list.map((d) => (
              <DocketCard
                key={d._key} d={d} expanded={!!open[d._key]} busy={busyKey === d._key} disabled={!!busy || (busyKey && busyKey !== d._key)}
                ccName={(code) => ccByCode[String(code || "").toUpperCase()]}
                budget={budgetByNo[String(d._hdr?.budgetNo ?? d.rows[0]?.budgetNo ?? d.budgetNo ?? "").toUpperCase()]}
                onToggle={() => setOpen((p) => ({ ...p, [d._key]: !p[d._key] }))}
                onCell={(i, f, val) => setCell(d._key, i, f, val)}
                onHeader={(f, val) => setHeader(d._key, f, val)}
                onAddRow={() => addRow(d._key)}
                onDelRow={(i) => delRow(d._key, i)}
                onRecheck={() => recheck([d._key])}
                onImport={() => importDockets([d._key])}
                onDiscard={() => discard(d._key)}
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
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b">
              <span className="text-[12.5px] text-gray-700">These are saved as <b>Draft</b>. Submit them for approval now, or open each one to review it or attach bills first.</span>
              <button type="button" onClick={submitAll} disabled={!draftsLeft || busy === "submitting"}
                className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
                {busy === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit {draftsLeft || ""} for approval
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Your Ref</th>
                    <th className="px-3 py-1.5 text-left font-medium">Docket No</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Budget</th>
                    <th className="px-3 py-1.5 text-left font-medium">Expenses By</th>
                    <th className="px-3 py-1.5 text-right font-medium">Lines</th>
                    <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-1.5 text-gray-600">{c.docketRef}</td>
                      <td className="px-3 py-1.5">
                        <a href={`${DETAIL_PATH}/${c.id}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                          {c.voucherNo} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-3 py-1.5">{c.date ? c.date.split("-").reverse().join("-") : ""}</td>
                      <td className="px-3 py-1.5">{c.budgetNo}</td>
                      <td className="px-3 py-1.5">{c.expensesBy}</td>
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
    fix:      ["No errors", hasCreated ? "Everything that needed fixing is done." : "Every docket passed the checks.", "View ready dockets"],
    ready:    ["Nothing ready yet", "Fix the dockets in Need correction and they will show up here.", "Go to Need correction"],
    imported: ["Nothing imported yet", "Import the ready dockets to create Draft expense dockets.", "View ready dockets"],
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

const HEADER_INPUTS = [
  { key: "date",          label: "Date (DD-MM-YYYY)", w: "w-32", placeholder: "15-11-2026" },
  { key: "budgetNo",      label: "Budget No",         w: "w-32", list: "db-budget" },
  { key: "expensesBy",    label: "Expenses By",       w: "w-44" },
  { key: "paymentMode",   label: "Payment Mode",      w: "w-28", select: ["Cash", "Bank/UPI"] },
  { key: "accountCode",   label: "Account Code",      w: "w-36" },
  { key: "transactionId", label: "Transaction ID",    w: "w-36" },
];

function DocketCard({ d, expanded, busy, disabled, budget, ccName, onToggle, onCell, onHeader, onAddRow, onDelRow, onRecheck, onImport, onDiscard }) {
  const rowErrCount = d.rows.filter((r) => r.errors?.length).length;
  const errCount = rowErrCount + (d.errors?.length || 0);
  const total = d.rows.reduce((s, r) => s + (Number(String(r.amount).replace(/,/g, "")) || 0), 0);
  const hv = (k) => d._hdr?.[k] ?? d.rows[0]?.[k] ?? "";
  const hdrBad = new Set(d._dirty ? [] : d.errorFields || []);
  const budgetLines = Object.fromEntries((budget?.rows || []).map((r) => [String(r.ccCode).toUpperCase(), r]));
  const cash = isCashMode(hv("paymentMode"));

  const badge = d._dirty
    ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Edited, re-check</span>
    : d.valid
      ? (d.warnings?.length
        ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 inline-flex items-center gap-1" title={d.warnings.join("\n")}><CheckCircle2 className="w-3 h-3" />Ready · over budget</span>
        : <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>)
      : <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errCount} issue{errCount === 1 ? "" : "s"}</span>;

  const cell = "h-[28px] w-full text-[12.5px] px-1.5 border rounded outline-none focus:ring-1 focus:ring-blue-300 bg-white";
  const bad = "border-red-400 bg-red-50";
  const ok = "border-gray-200";

  return (
    <div className={`rounded-lg border bg-white ${!d.valid && !d._dirty ? "border-red-200" : ""}`}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-left" aria-expanded={expanded}>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <span className="text-[12.5px] text-gray-500">Ref</span>
          <span className="text-[13px] font-medium text-gray-800">{d.docketRef || <i className="text-red-500">missing</i>}</span>
        </button>
        <span className="text-[12px] text-gray-500">{hv("date") || "no date"}</span>
        <span className="text-[12px] text-gray-700">{hv("budgetNo") || <i className="text-red-500">no budget</i>}</span>
        <span className="text-[12px] text-gray-500 truncate max-w-[160px]" title={hv("expensesBy")}>{hv("expensesBy")}</span>
        <span className="text-[12px] text-gray-500">{hv("paymentMode")}{d.accountCode ? ` · ${d.accountCode}` : ""}</span>
        <span className="text-[12px] text-gray-500">{d.rows.length} line{d.rows.length === 1 ? "" : "s"}</span>
        <span className="text-[12px] tabular-nums text-gray-800 font-medium">₹ {formatAmount(total)}</span>
        {badge}
        <div className="ml-auto flex items-center gap-1.5">
          {!expanded && !d.valid && (
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
            title="Validate and save this docket as Draft">
            <CheckCircle2 className="w-3.5 h-3.5" /> Import
          </button>
          <button type="button" onClick={() => { if (window.confirm("Remove this docket from the upload?")) onDiscard(); }} disabled={disabled || busy}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Remove from upload">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* docket-level errors */}
      {d.errors?.length > 0 && (
        <div className="px-3 pb-2 -mt-0.5 space-y-0.5">
          {d.errors.map((e, i) => (
            <div key={i} className="text-[12px] text-red-600 flex items-start gap-1"><AlertCircle className="w-3.5 h-3.5 mt-[1px] flex-none" />{e}</div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* docket header fields (apply to every line) */}
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-[11.5px] text-gray-500">
              Docket Ref
              <input className={`${cell} ${ok} mt-0.5 w-24 block`} value={d.docketRef ?? ""} onChange={(e) => onHeader("docketRef", e.target.value)} />
            </label>
            {HEADER_INPUTS.map((f) => {
              const cls = `${cell} mt-0.5 ${f.w} block ${hdrBad.has(f.key) ? bad : ok}`;
              return (
                <label key={f.key} className="text-[11.5px] text-gray-500">
                  {f.label}
                  {f.select ? (
                    <select className={cls} value={f.select.includes(hv(f.key)) ? hv(f.key) : isCashMode(hv(f.key)) ? "Cash" : hv(f.key) ? hv(f.key) : ""}
                      onChange={(e) => onHeader(f.key, e.target.value)}>
                      {!f.select.includes(hv(f.key)) && !isCashMode(hv(f.key)) && <option value={hv(f.key)}>{hv(f.key) || "—"}</option>}
                      {f.select.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className={cls} value={hv(f.key)} placeholder={f.placeholder}
                      list={f.key === "accountCode" ? (cash ? "db-acc-cash" : "db-acc-bank") : f.list}
                      onChange={(e) => onHeader(f.key, e.target.value)} />
                  )}
                </label>
              );
            })}
          </div>
          {budget && (
            <div className="text-[11.5px] text-gray-500">
              Budget {budget.budgetNo}{budget.fromDate ? ` · ${budget.fromDate.split("-").reverse().join("-")} to ${(budget.toDate || "").split("-").reverse().join("-")}` : ""} · {budget.rows?.length || 0} CC lines
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[820px]">
              <thead className="text-gray-500">
                <tr>
                  <th className="w-12 text-left font-medium px-1 py-1">Row</th>
                  <th className="w-36 text-left font-medium px-1">CC Code</th>
                  <th className="text-left font-medium px-1">CC Name</th>
                  <th className="w-56 text-left font-medium px-1">Budget balance</th>
                  <th className="w-56 text-left font-medium px-1">Description</th>
                  <th className="w-28 text-right font-medium px-1">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r, i) => {
                  const ef = lineErrorFields(r.errors);
                  const bl = budgetLines[String(r.ccCode || "").toUpperCase()];
                  return [
                    <tr key={`r${i}`} className="align-middle">
                      <td className="px-1 py-0.5 text-gray-400 tabular-nums" title="Row number in your file">{r.rowNo}</td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} ${ef.has("ccCode") ? bad : ok}`} value={r.ccCode ?? ""} placeholder="CC code"
                          list={budget ? `db-cc-${budget.id}` : "db-cc-all"}
                          onChange={(e) => onCell(i, "ccCode", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5 text-gray-600 truncate max-w-[220px]" title={r.ccName || bl?.ccName || ""}>
                        {r.ccName || bl?.ccName || ccName(r.ccCode) || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-1 py-0.5 text-[11.5px] tabular-nums whitespace-nowrap">
                        {bl ? (
                          <span className="text-gray-500">
                            {formatAmount(bl.budgetAmount)} · used {formatAmount(bl.usedAmount)} ·{" "}
                            <span className={bl.remaining <= 0 ? "text-red-600" : "text-green-700"}>bal {formatAmount(bl.remaining)}</span>
                          </span>
                        ) : budget && r.ccCode ? (
                          <span className="text-orange-600" title="Allowed — this CC is not part of the budget, so no balance check">Not in budget (allowed)</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} ${ef.has("description") ? bad : ok}`} value={r.description ?? ""} onChange={(e) => onCell(i, "description", e.target.value)} />
                      </td>
                      <td className="px-1 py-0.5">
                        <input className={`${cell} text-right tabular-nums ${ef.has("amount") ? bad : ok}`}
                          value={r.amount ?? ""} inputMode="decimal"
                          onChange={(e) => onCell(i, "amount", e.target.value)} />
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
                        <td colSpan={6} className="px-1 pb-1.5 text-[11.5px] text-red-600">{r.errors.join(" · ")}</td>
                      </tr>
                    ) : null,
                    !d._dirty && r.warnings?.length ? (
                      <tr key={`w${i}`}>
                        <td />
                        <td colSpan={6} className="px-1 pb-1.5 text-[11.5px] text-orange-600">{r.warnings.join(" · ")} (allowed)</td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
          {!cash && (
            <button type="button" onClick={onAddRow} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add line
            </button>
          )}
        </div>
      )}
    </div>
  );
}
