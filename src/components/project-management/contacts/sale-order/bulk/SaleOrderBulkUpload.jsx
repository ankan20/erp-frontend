"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, AlertTriangle, ChevronRight,
  RefreshCw, Trash2, Plus, Loader2, Send, ExternalLink, Pencil, X,
} from "lucide-react";
import { EdoxMark } from "@/components/common/EdoxLoader";

import { apiRequest }      from "@/lib/apiClient";
import { API_ENDPOINTS }   from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";
import { formatAmount }    from "@/helper/numberFormatter";
import {
  ORDER_COLUMNS, ITEM_COLUMNS, downloadSaleOrderTemplate, downloadErrorReport, parseSaleOrderFile,
} from "./saleOrderBulkFile";

const EP = API_ENDPOINTS.PROJECT.OG_SALE_ORDER;
const DETAIL_PATH = "/project-management/contacts/sale-order";

let _k = 0;
const newKey = () => `o${Date.now().toString(36)}${(_k++).toString(36)}`;

const isoToDmy = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s).split("-").reverse().join("-") : s ?? "");
const num = (v) => Number(String(v ?? "").replace(/[,₹%]/g, "")) || 0;
const lineAmt = (i) => num(i.qty) * num(i.rate);
const lineGst = (i) => (lineAmt(i) * num(i.gstPercent)) / 100;

// server order → screen order (dates shown as DD-MM-YYYY, keys for React)
const prep = (o) => ({
  ...o,
  soDate: isoToDmy(o.soDate),
  orderValidity: isoToDmy(o.orderValidity),
  items: (o.items || []).map((i) => ({ ...i, _key: newKey() })),
  _key: newKey(),
  _dirty: false,
});
const prepAll = (list) => (list || []).map(prep);
const prepItems = (list) => (list || []).map((i) => ({ ...i, _key: newKey() }));

const orderPayload = (o) => {
  const p = { rowNo: o.rowNo };
  ORDER_COLUMNS.forEach(({ key }) => { p[key] = o[key] ?? ""; });
  return p;
};
const itemPayload = (i, soRef) => {
  const p = { rowNo: i.rowNo };
  ITEM_COLUMNS.forEach(({ key }) => { p[key] = i[key] ?? ""; });
  if (soRef !== undefined) p.soRef = soRef;
  return p;
};
const buildPayload = (orders, orphans = []) => ({
  orders: orders.map(orderPayload),
  items: [
    ...orders.flatMap((o) => (o.items || []).map((i) => itemPayload(i, o.soRef))),
    ...orphans.map((i) => itemPayload(i)),
  ],
});

const isDraftish = (s) => s === "Draft" || s === "Failed";

// ══════════════════════════════════════════════════════════════════════════════

export default function SaleOrderBulkUpload() {
  const projectCode = getLocalStorage("projectInfo")?.projectCode || "";

  const [step,     setStep]     = useState("upload");   // upload | review
  const [fileName, setFileName] = useState("");
  const [busy,     setBusy]     = useState("");         // "" | parsing | validating | importing | submitting | template
  const [busyKey,  setBusyKey]  = useState(null);
  const [orders,   setOrders]   = useState([]);         // pending (not yet imported)
  const [orphans,  setOrphans]  = useState([]);         // items whose SO Ref is not on the Orders sheet
  const [created,  setCreated]  = useState([]);
  const [tab,      setTab]      = useState("fix");      // fix | ready | imported
  const [open,     setOpen]     = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [debtors,  setDebtors]  = useState([]);
  const [submitAfter, setSubmitAfter] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!projectCode) return;
    apiRequest({ url: `${EP.BULK_REFERENCE}?projectCode=${projectCode}`, method: "GET" })
      .then((r) => setDebtors(r?.data?.debtors || []))
      .catch(() => {});
  }, [projectCode]);

  // warn before leaving with un-imported orders
  useEffect(() => {
    if (!orders.length && !orphans.length) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [orders.length, orphans.length]);

  const debtorByCode = useMemo(
    () => Object.fromEntries(debtors.map((d) => [String(d.code).toUpperCase(), d])),
    [debtors],
  );

  const fixList   = useMemo(() => orders.filter((o) => !o.valid), [orders]);
  const readyList = useMemo(() => orders.filter((o) => o.valid), [orders]);
  const readyAmt  = readyList.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
  const fixCount  = fixList.length + (orphans.length ? 1 : 0);

  // ── server calls ──────────────────────────────────────────────────────────
  const callValidate = (list, orph = []) =>
    apiRequest({ url: EP.BULK_VALIDATE, method: "POST", data: { projectCode, ...buildPayload(list, orph) } })
      .then((r) => r.data);

  const callImport = (list) =>
    apiRequest({ url: EP.BULK_IMPORT, method: "POST", data: { projectCode, submit: submitAfter, ...buildPayload(list) } })
      .then((r) => ({ ...r.data, message: r.message }));

  // ── 1. file → parse → validate ────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    if (!projectCode) { toast.error("Select a project first"); return; }
    try {
      setBusy("parsing");
      const parsed = await parseSaleOrderFile(file);
      setBusy("validating");
      const data = await callValidate(parsed.orders, parsed.items);
      const os = prepAll(data.orders);
      const orph = prepItems(data.orphanItems);
      setOrders(os);
      setOrphans(orph);
      setCreated([]);
      setFileName(file.name);
      setStep("review");
      const bad = os.filter((o) => !o.valid);
      setTab(bad.length || orph.length ? "fix" : "ready");
      setOpen(bad.length && bad.length <= 5 ? Object.fromEntries(bad.map((o) => [o._key, true])) : {});
      toast.success(
        `${os.length} order${os.length === 1 ? "" : "s"} read (${os.length - bad.length} ready` +
        `${bad.length ? `, ${bad.length} need correction` : ""})` +
        (orph.length ? `. ${orph.length} item row(s) have no matching order.` : "") +
        (parsed.skippedExamples ? ` ${parsed.skippedExamples} example rows ignored.` : ""),
      );
    } catch (e) {
      toast.error(e?.message || "Could not read the file");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── 2. re-check: one order, or everything (incl. unmatched items) ─────────
  const recheck = async (keys, withOrphans = false) => {
    const target = orders.filter((o) => keys.includes(o._key));
    if (!target.length && !(withOrphans && orphans.length)) return;
    try {
      setBusyKey(keys.length === 1 && !withOrphans ? keys[0] : "__all");
      if (!target.length) {
        // only unmatched items left: nothing to validate them against
        toast.warning("These item rows still have no matching order. Change their SO Ref or delete them.");
        return;
      }
      const data = await callValidate(target, withOrphans ? orphans : []);
      const fresh = prepAll(data.orders);
      setOrders((prev) => {
        const idx = prev.findIndex((o) => keys.includes(o._key));
        const rest = prev.filter((o) => !keys.includes(o._key));
        rest.splice(Math.max(idx, 0), 0, ...fresh);
        return rest;
      });
      if (withOrphans) setOrphans(prepItems(data.orphanItems));
      setOpen((p) => {
        const n = { ...p };
        fresh.forEach((o) => { if (!o.valid) n[o._key] = true; });
        return n;
      });
      const ok = fresh.filter((o) => o.valid).length;
      const left = (data.orphanItems || []).length;
      if (ok === fresh.length && !left) toast.success(fresh.length === 1 ? "Looks good — order is ready" : `All ${ok} orders are ready`);
      else toast.warning(`${ok} ready, ${fresh.length - ok} still need correction${left ? `, ${left} unmatched item row(s)` : ""}`);
    } catch (e) {
      toast.error(e?.message || "Validation failed");
    } finally { setBusyKey(null); }
  };

  // ── 3. import (one / all ready) ───────────────────────────────────────────
  const importOrders = async (keys) => {
    const target = orders.filter((o) => keys.includes(o._key));
    if (!target.length) return;
    try {
      if (keys.length === 1) setBusyKey(keys[0]); else setBusy("importing");
      const data = await callImport(target);
      const failed = prepAll(data.failed);
      setCreated((p) => [...p, ...(data.created || [])]);
      setOrders((prev) => {
        const idx = prev.findIndex((o) => keys.includes(o._key));
        const rest = prev.filter((o) => !keys.includes(o._key));
        rest.splice(Math.max(idx, 0), 0, ...failed);
        return rest;
      });
      setOpen((p) => { const n = { ...p }; failed.forEach((o) => { n[o._key] = true; }); return n; });
      const nC = data.created?.length || 0;
      const subFail = data.summary?.submitFailed || 0;
      if (nC && !failed.length && !subFail) toast.success(data.message);
      else if (nC) toast.warning(data.message + (subFail ? ` (${subFail} could not be submitted — see Imported)` : ""));
      else toast.error("Nothing imported — please correct the errors shown");
      if (nC && orders.length - target.length + failed.length === 0) setTab("imported");
    } catch (e) {
      toast.error(e?.message || "Import failed");
    } finally { setBusy(""); setBusyKey(null); }
  };

  // ── 4. submit imported drafts (later, from the Imported tab) ──────────────
  const submitDrafts = async () => {
    const drafts = created.filter((c) => isDraftish(c.workflowStatus));
    if (!drafts.length) return;
    setBusy("submitting");
    let ok = 0, bad = 0;
    for (const c of drafts) {
      try {
        const r = await apiRequest({ url: `${EP.SUBMIT}${c.id}`, method: "POST" });
        ok++;
        setCreated((p) => p.map((x) => (x.id === c.id ? { ...x, workflowStatus: r?.data?.workflowStatus || "Submitted", submitError: null } : x)));
      } catch (e) {
        bad++;
        setCreated((p) => p.map((x) => (x.id === c.id ? { ...x, workflowStatus: "Draft", submitError: e?.message || "Submit failed" } : x)));
      }
    }
    setBusy("");
    if (bad) toast.warning(`${ok} submitted, ${bad} failed`); else toast.success(`${ok} sale orders submitted for approval`);
  };

  // ── editing helpers ───────────────────────────────────────────────────────
  const patchOrder = useCallback((key, fn) => {
    setOrders((prev) => prev.map((o) => (o._key === key ? { ...fn(o), _dirty: true } : o)));
  }, []);

  const setField = (key, field, value) => patchOrder(key, (o) => ({ ...o, [field]: value }));

  const setItem = (key, ik, field, value) =>
    patchOrder(key, (o) => ({ ...o, items: o.items.map((i) => (i._key === ik ? { ...i, [field]: value } : i)) }));

  const addItem = (key) =>
    patchOrder(key, (o) => {
      const last = o.items[o.items.length - 1];
      return {
        ...o,
        items: [...o.items, {
          _key: newKey(), rowNo: "new", soRef: o.soRef, itemType: last?.itemType || "BOQ", itemCode: "", itemName: "",
          itemDescription: "", unit: last?.unit || "", qty: "", rate: "", gstPercent: last?.gstPercent ?? "", errors: [], errorFields: [],
        }],
      };
    });

  const delItem = (key, ik) => patchOrder(key, (o) => ({ ...o, items: o.items.filter((i) => i._key !== ik) }));

  const discard = (key) => setOrders((p) => p.filter((o) => o._key !== key));

  const setOrphan = (ik, field, value) => setOrphans((p) => p.map((i) => (i._key === ik ? { ...i, [field]: value, _dirty: true } : i)));
  const delOrphan = (ik) => setOrphans((p) => p.filter((i) => i._key !== ik));

  const reset = () => {
    const n = orders.length + orphans.length;
    if (n && !window.confirm("Some orders are not imported yet. Discard them and upload a new file?")) return;
    setOrders([]); setOrphans([]); setCreated([]); setStep("upload"); setFileName(""); setOpen({});
  };

  const getTemplate = async () => {
    try {
      setBusy("template");
      await downloadSaleOrderTemplate({ debtors, projectCode });
    } catch { toast.error("Could not create template"); }
    finally { setBusy(""); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const datalists = (
    <datalist id="so-debtors">
      {debtors.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
    </datalist>
  );

  if (step === "upload") {
    const loading = busy === "parsing" || busy === "validating";
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div>
          <h1 className="text-[17px] font-semibold text-gray-800">Bulk upload sale orders</h1>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            Create many sale orders at once from one Excel file: orders on one sheet, their items on another.
            Everything is checked before saving, and amounts and GST are calculated for you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            ["1", "Download template", "Excel with an Orders sheet, an Items sheet, and the list of Sundry Debtors"],
            ["2", "Fill orders and items", "One row per order, one row per item. The SO Ref links each item to its order"],
            ["3", "Upload & review", "Ready orders save as Draft (or go for approval). Fix the rest right here"],
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

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
          <span className="text-[12.5px] text-gray-700 mr-auto">
            Start with the template:
            {debtors.length === 0 && (
              <span className="ml-2 text-amber-700">No Sundry Debtor found in the master. Every order needs one.</span>
            )}
          </span>
          <button type="button" onClick={getTemplate} disabled={busy === "template"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-green-600 text-green-700 text-[12.5px] font-medium hover:bg-green-50 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel template (.xlsx)
          </button>
        </div>

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
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])} />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <EdoxMark size={40} />
              <div className="text-[13px]">{busy === "parsing" ? "Reading file…" : "Checking every order and item…"}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-blue-600" />
              <div className="text-[13.5px] font-medium text-gray-800">Drop your file here, or click to browse</div>
              <div className="text-[11.5px] text-gray-500">.xlsx or .xls · up to 1000 orders and 5000 item rows</div>
            </div>
          )}
        </div>

        {/* format at a glance */}
        <div className="rounded-lg border bg-white">
          <div className="px-3 py-2 border-b text-[12px] font-medium text-gray-700">Sheet &quot;Orders&quot; — one row per order</div>
          <GlanceTable cols={ORDER_COLUMNS} rows={[
            ["1", "05-11-2026", "Civil works — Block A", "PO/2026/118", "31-03-2027", "DR00012"],
            ["2", "06-11-2026", "Electrical maintenance", "", "", "DR00031"],
          ]} />
          <div className="px-3 py-2 border-y text-[12px] font-medium text-gray-700">Sheet &quot;Items&quot; — one row per item, same SO Ref as its order</div>
          <GlanceTable cols={ITEM_COLUMNS} rightFrom={6} rows={[
            ["1", "BOQ", "1.1", "Excavation", "Earth work", "Cum", "120", "450", "18"],
            ["1", "BOQ", "1.2", "PCC 1:4:8", "", "Cum", "35", "5,200", "18"],
            ["2", "Non-BOQ", "", "Monthly maintenance", "Nov-2026", "LS", "1", "65,000", "18"],
          ]} />
          <div className="px-3 py-2 border-t text-[11.5px] text-gray-500 space-y-0.5">
            <div>• <b>Debtor Code</b> is the Sundry Debtor&apos;s ledger code (listed on the template&apos;s Debtors sheet).</div>
            <div>• <b>Item Type</b> is BOQ or Non-BOQ. <b>GST %</b> can be any value from 0 to 100; blank means 0.</div>
            <div>• A Customer Order No that already exists in this project is shown as a warning, but the order can still be imported.</div>
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────
  const list = tab === "fix" ? fixList : tab === "ready" ? readyList : [];
  const draftsLeft = created.filter((c) => isDraftish(c.workflowStatus)).length;
  const pendingCount = orders.length;

  return (
    <div className="p-3 space-y-3">
      {datalists}

      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-green-700" />
        <span className="text-[13px] font-medium text-gray-800 truncate max-w-[280px]" title={fileName}>{fileName}</span>
        <button type="button" onClick={reset} className="text-[12px] text-blue-600 hover:underline ml-1">Upload another file</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {(fixList.length > 0 || orphans.length > 0) && (
            <button type="button" onClick={() => downloadErrorReport(fixList, orphans)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50"
              title="Download only the orders that need correction (Orders + Items sheets) with an Errors column. Fix them in Excel and upload that file.">
              <Download className="w-4 h-4" /> Download corrections
            </button>
          )}
          {(pendingCount > 0 || orphans.length > 0) && (
            <button type="button" onClick={() => recheck(orders.map((o) => o._key), true)} disabled={!!busyKey || !!busy}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12.5px] text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${busyKey === "__all" ? "animate-spin" : ""}`} /> Re-check all
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-700 select-none cursor-pointer"
            title="After each order is created, send it for approval (same as clicking Submit). If that fails, it stays as Draft.">
            <input type="checkbox" className="accent-blue-600" checked={submitAfter} onChange={(e) => setSubmitAfter(e.target.checked)} />
            Submit for approval after import
          </label>
          <button type="button" onClick={() => importOrders(readyList.map((o) => o._key))}
            disabled={!readyList.length || !!busy || !!busyKey}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
            {busy === "importing" ? <Loader2 className="w-4 h-4 animate-spin" /> : submitAfter ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            Import {readyList.length} ready order{readyList.length === 1 ? "" : "s"}{submitAfter ? " & submit" : ""}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Need correction" value={fixList.length} sub={orphans.length ? `+ ${orphans.length} unmatched item row${orphans.length === 1 ? "" : "s"}` : ""} tone={fixCount ? "red" : "gray"} />
        <Stat label="Ready to import" value={readyList.length} sub={readyList.length ? `₹ ${formatAmount(readyAmt)}` : ""} tone="green" />
        <Stat label="Imported" value={created.length} sub={created.length ? `₹ ${formatAmount(created.reduce((s, c) => s + Number(c.amount || 0), 0))}` : ""} tone="blue" />
        <Stat label="Item rows pending" value={orders.reduce((s, o) => s + o.items.length, 0) + orphans.length} tone="gray" />
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b">
        {[
          ["fix", "Need correction", fixCount, "text-red-600"],
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
              const allOpen = list.every((o) => open[o._key]);
              setOpen((p) => ({ ...p, ...Object.fromEntries(list.map((o) => [o._key, !allOpen])) }));
            }}>
            {list.every((o) => open[o._key]) ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {tab === "fix" && fixCount > 0 && (
        <div className="text-[12px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Fix the fields marked in red, then click <b>Re-check</b> or <b>Import</b> on an order, or <b>Re-check all</b> above.
          To fix them in Excel instead, use <b>Download corrections</b>, edit the file and upload it again. Only those orders will be in it.
        </div>
      )}

      {tab === "fix" && orphans.length > 0 && (
        <OrphanCard items={orphans} onCell={setOrphan} onDel={delOrphan} />
      )}

      {tab !== "imported" && (
        list.length === 0 ? (
          (tab !== "fix" || !orphans.length) && (
            <Empty tab={tab} hasCreated={created.length > 0} onGo={() => setTab(tab === "fix" ? (readyList.length ? "ready" : "imported") : "fix")} />
          )
        ) : (
          <div className="space-y-2">
            {list.map((o) => (
              <OrderCard
                key={o._key} o={o} expanded={!!open[o._key]} busy={busyKey === o._key} disabled={!!busy || (busyKey && busyKey !== o._key)}
                debtor={debtorByCode[String(o.debtorCode || "").toUpperCase()]} submitAfter={submitAfter}
                onToggle={() => setOpen((p) => ({ ...p, [o._key]: !p[o._key] }))}
                onField={(f, v) => setField(o._key, f, v)}
                onItem={(ik, f, v) => setItem(o._key, ik, f, v)}
                onAddItem={() => addItem(o._key)}
                onDelItem={(ik) => delItem(o._key, ik)}
                onRecheck={() => recheck([o._key])}
                onImport={() => importOrders([o._key])}
                onDiscard={() => discard(o._key)}
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
              <span className="text-[12.5px] text-gray-700">
                {draftsLeft
                  ? <>{draftsLeft} order{draftsLeft === 1 ? " is" : "s are"} saved as <b>Draft</b>. Submit now, or open an order to review it or add attachments first.</>
                  : <>All imported orders are sent for approval.</>}
              </span>
              <button type="button" onClick={submitDrafts} disabled={!draftsLeft || busy === "submitting"}
                className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 disabled:opacity-40">
                {busy === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit {draftsLeft || ""} draft{draftsLeft === 1 ? "" : "s"} for approval
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Your Ref</th>
                    <th className="px-3 py-1.5 text-left font-medium">ERP No</th>
                    <th className="px-3 py-1.5 text-left font-medium">Date</th>
                    <th className="px-3 py-1.5 text-left font-medium">Order Title</th>
                    <th className="px-3 py-1.5 text-left font-medium">Debtor</th>
                    <th className="px-3 py-1.5 text-right font-medium">Items</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {created.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-1.5 text-gray-600">{c.soRef}</td>
                      <td className="px-3 py-1.5">
                        <a href={`${DETAIL_PATH}/${c.id}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium">
                          {c.erpNo} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{isoToDmy(c.soDate)}</td>
                      <td className="px-3 py-1.5 max-w-[260px] truncate" title={c.orderTitle}>{c.orderTitle}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={c.debtorName}>{c.debtorName}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.itemCount}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatAmount(c.amount)}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[11.5px] px-1.5 py-0.5 rounded ${c.submitError ? "bg-red-50 text-red-700" : c.workflowStatus === "Draft" ? "bg-gray-100 text-gray-700" : "bg-green-50 text-green-700"}`}
                          title={c.submitError || ""}>
                          {c.workflowStatus}{c.submitError ? ` — not submitted: ${c.submitError}` : ""}
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

function GlanceTable({ cols, rows, rightFrom = 99 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="bg-gray-50 text-gray-600">
          <tr>{cols.map((c, j) => <th key={c.key} className={`px-2 py-1.5 font-medium whitespace-nowrap ${j >= rightFrom ? "text-right" : "text-left"}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody className="text-gray-700 tabular-nums">
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => <td key={j} className={`px-2 py-1 whitespace-nowrap ${j >= rightFrom ? "text-right" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
    fix:      ["No errors", hasCreated ? "Everything that needed fixing is done." : "Every order passed the checks.", "View ready orders"],
    ready:    ["Nothing ready yet", "Fix the orders in Need correction and they will show up here.", "Go to Need correction"],
    imported: ["Nothing imported yet", "Import the ready orders to create them.", "View ready orders"],
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

const cell = "h-[28px] w-full text-[12.5px] px-1.5 border rounded outline-none focus:ring-1 focus:ring-blue-300 bg-white";
const BAD = "border-red-400 bg-red-50";
const OK = "border-gray-200";

const ORDER_INPUTS = [
  { key: "soRef",         label: "SO Ref",                       w: "w-24" },
  { key: "soDate",        label: "SO Date (DD-MM-YYYY)",         w: "w-32", placeholder: "05-11-2026" },
  { key: "orderTitle",    label: "Order Title",                  w: "w-72" },
  { key: "orderNo",       label: "Customer Order No",            w: "w-40" },
  { key: "orderValidity", label: "Order Validity (DD-MM-YYYY)",  w: "w-40", placeholder: "31-03-2027" },
  { key: "debtorCode",    label: "Debtor Code",                  w: "w-36", list: "so-debtors" },
];

function ItemsTable({ items, showRef, onCell, onDel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px] min-w-[980px]">
        <thead className="text-gray-500">
          <tr>
            <th className="w-12 text-left font-medium px-1 py-1">Row</th>
            {showRef && <th className="w-20 text-left font-medium px-1">SO Ref</th>}
            <th className="w-28 text-left font-medium px-1">Type</th>
            <th className="w-24 text-left font-medium px-1">Item Code</th>
            <th className="min-w-[180px] text-left font-medium px-1">Item Name</th>
            <th className="w-48 text-left font-medium px-1">Description</th>
            <th className="w-16 text-left font-medium px-1">Unit</th>
            <th className="w-20 text-right font-medium px-1">Qty</th>
            <th className="w-24 text-right font-medium px-1">Rate</th>
            <th className="w-16 text-right font-medium px-1">GST %</th>
            <th className="w-28 text-right font-medium px-1">Amount</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const ef = new Set(i.errorFields || []);
            const c = (f, extra = "") => `${cell} ${extra} ${ef.has(f) ? BAD : OK}`;
            const typeVal = ["BOQ", "Non-BOQ"].includes(i.itemType) ? i.itemType : (i.itemType || "");
            return [
              <tr key={i._key} className="align-middle">
                <td className="px-1 py-0.5 text-gray-400 tabular-nums" title="Row number on the Items sheet">{i.rowNo}</td>
                {showRef && (
                  <td className="px-1 py-0.5"><input className={c("soRef")} value={i.soRef ?? ""} onChange={(e) => onCell(i._key, "soRef", e.target.value)} /></td>
                )}
                <td className="px-1 py-0.5">
                  <select className={c("itemType")} value={typeVal} onChange={(e) => onCell(i._key, "itemType", e.target.value)}>
                    {!["BOQ", "Non-BOQ"].includes(typeVal) && <option value={typeVal}>{typeVal || "—"}</option>}
                    <option value="BOQ">BOQ</option>
                    <option value="Non-BOQ">Non-BOQ</option>
                  </select>
                </td>
                <td className="px-1 py-0.5"><input className={c("itemCode")} value={i.itemCode ?? ""} onChange={(e) => onCell(i._key, "itemCode", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("itemName")} value={i.itemName ?? ""} onChange={(e) => onCell(i._key, "itemName", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("itemDescription")} value={i.itemDescription ?? ""} onChange={(e) => onCell(i._key, "itemDescription", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("unit")} value={i.unit ?? ""} onChange={(e) => onCell(i._key, "unit", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("qty", "text-right tabular-nums")} inputMode="decimal" value={i.qty ?? ""} onChange={(e) => onCell(i._key, "qty", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("rate", "text-right tabular-nums")} inputMode="decimal" value={i.rate ?? ""} onChange={(e) => onCell(i._key, "rate", e.target.value)} /></td>
                <td className="px-1 py-0.5"><input className={c("gstPercent", "text-right tabular-nums")} inputMode="decimal" value={i.gstPercent ?? ""} onChange={(e) => onCell(i._key, "gstPercent", e.target.value)} /></td>
                <td className="px-1 py-0.5 text-right tabular-nums text-gray-700" title={`GST ${formatAmount(lineGst(i))}`}>{formatAmount(lineAmt(i))}</td>
                <td className="px-1 py-0.5">
                  <button type="button" onClick={() => onDel(i._key)} className="h-7 w-7 inline-flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="Delete item">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>,
              i.errors?.length ? (
                <tr key={`${i._key}e`}>
                  <td />
                  <td colSpan={showRef ? 11 : 10} className="px-1 pb-1.5 text-[11.5px] text-red-600">{i.errors.join(" · ")}</td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrphanCard({ items, onCell, onDel }) {
  return (
    <div className="rounded-lg border border-red-200 bg-white">
      <div className="px-3 py-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-none" />
        <div className="text-[12.5px] text-gray-700">
          <b>{items.length} item row{items.length === 1 ? "" : "s"} with no matching order.</b>{" "}
          Their SO Ref is not on the Orders sheet. Change the SO Ref to an order&apos;s ref (then <b>Re-check all</b>), or delete them.
        </div>
      </div>
      <div className="border-t px-3 py-2">
        <ItemsTable items={items} showRef onCell={onCell} onDel={onDel} />
      </div>
    </div>
  );
}

function OrderCard({ o, expanded, busy, disabled, debtor, submitAfter, onToggle, onField, onItem, onAddItem, onDelItem, onRecheck, onImport, onDiscard }) {
  const itemErr = o.items.filter((i) => i.errors?.length).length;
  const ownErr = (o.errors || []).filter((e) => !/item rows? needs? correction/.test(e)).length;
  const errCount = ownErr + itemErr;
  const basic = o.items.reduce((s, i) => s + lineAmt(i), 0);
  const gst = o.items.reduce((s, i) => s + lineGst(i), 0);
  const hdrBad = new Set(o._dirty ? [] : o.errorFields || []);
  const debtorName = o.debtorName || debtor?.name;

  const badge = o._dirty
    ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Edited, re-check</span>
    : o.valid
      ? (o.warnings?.length
        ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 inline-flex items-center gap-1" title={o.warnings.join("\n")}><AlertTriangle className="w-3 h-3" />Ready · check warning</span>
        : <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ready</span>)
      : <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errCount || 1} issue{errCount === 1 ? "" : "s"}</span>;

  return (
    <div className={`rounded-lg border bg-white ${!o.valid && !o._dirty ? "border-red-200" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-left" aria-expanded={expanded}>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <span className="text-[12.5px] text-gray-500">Ref</span>
          <span className="text-[13px] font-medium text-gray-800">{o.soRef || <i className="text-red-500">missing</i>}</span>
        </button>
        <span className="text-[12px] text-gray-500">{o.soDate || "no date"}</span>
        <span className="text-[12px] text-gray-800 truncate max-w-[240px]" title={o.orderTitle}>{o.orderTitle || <i className="text-red-500">no title</i>}</span>
        <span className="text-[12px] text-gray-500 truncate max-w-[180px]" title={debtorName || o.debtorCode}>{debtorName || o.debtorCode || <i className="text-red-500">no debtor</i>}</span>
        <span className="text-[12px] text-gray-500">{o.items.length} item{o.items.length === 1 ? "" : "s"}</span>
        <span className="text-[12px] tabular-nums text-gray-800 font-medium" title={`Basic ${formatAmount(basic)} + GST ${formatAmount(gst)}`}>₹ {formatAmount(basic + gst)}</span>
        {badge}
        <div className="ml-auto flex items-center gap-1.5">
          {!expanded && !o.valid && (
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
            title={submitAfter ? "Validate, save and submit this order for approval" : "Validate and save this order as Draft"}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Import
          </button>
          <button type="button" onClick={() => { if (window.confirm("Remove this order from the upload?")) onDiscard(); }} disabled={disabled || busy}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40" title="Remove from upload">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(o.errors?.length > 0 || (!o._dirty && o.warnings?.length > 0)) && (
        <div className="px-3 pb-2 -mt-0.5 space-y-0.5">
          {(o.errors || []).map((e, idx) => (
            <div key={`e${idx}`} className="text-[12px] text-red-600 flex items-start gap-1"><AlertCircle className="w-3.5 h-3.5 mt-[1px] flex-none" />{e}</div>
          ))}
          {!o._dirty && (o.warnings || []).map((w, idx) => (
            <div key={`w${idx}`} className="text-[12px] text-orange-600 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-[1px] flex-none" />{w} (allowed)</div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div className="flex flex-wrap gap-3 items-end">
            {ORDER_INPUTS.map((f) => (
              <label key={f.key} className="text-[11.5px] text-gray-500">
                {f.label}
                <input className={`${cell} mt-0.5 ${f.w} block ${hdrBad.has(f.key) ? BAD : OK}`} value={o[f.key] ?? ""}
                  placeholder={f.placeholder} list={f.list} onChange={(e) => onField(f.key, e.target.value)} />
              </label>
            ))}
            {debtorName && <span className="text-[11.5px] text-gray-500 pb-1.5">{debtorName}</span>}
          </div>

          <ItemsTable items={o.items} onCell={onItem} onDel={onDelItem} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={onAddItem} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
            <span className="ml-auto text-[12px] text-gray-600 tabular-nums">
              Basic {formatAmount(basic)} · GST {formatAmount(gst)} · <b>Total {formatAmount(basic + gst)}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
