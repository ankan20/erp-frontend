"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  Coins,
  GitFork,
  LayoutGrid,
  ListTree,
  Link2,
  Loader2,
  RefreshCw,
  Rows3,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import ItemTraceModal from "@/components/resource/indent/item-trace/ItemTraceModal";
import WorkbenchSearch, { rememberTrace } from "./WorkbenchSearch";
import FlowTree from "./FlowTree";
import LifecycleMap from "./LifecycleMap";
import DocumentInspector from "./DocumentInspector";
import ReconciliationPanel from "./ReconciliationPanel";
import FinancialsPanel from "./FinancialsPanel";
import ExceptionsPanel, { countExceptions } from "./ExceptionsPanel";
import TimelinePanel from "./TimelinePanel";
import DocIcon from "./DocIcon";
import { LINK_KIND, MODE_HELP, STAGE_STYLE, relatedKeys } from "./wbUtils";
import SmartGuide from "@/components/common/smart-guide/SmartGuide";
import { HINTS, TOUR, getNextStep } from "./guideContent";

const TYPES_WITH_IDS = /^[A-Z_]+$/;

function Skeleton() {
  const b = "animate-pulse rounded bg-gray-200/80";
  return (
    <div className="space-y-3 p-3" aria-busy="true">
      <div className={`${b} h-14`} />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${b} h-8 w-28`} />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_360px] gap-3">
        <div className="space-y-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`${b} h-8`} style={{ marginLeft: (i % 4) * 20 }} />
          ))}
        </div>
        <div className={`${b} h-[320px]`} />
      </div>
    </div>
  );
}

function Intro() {
  const steps = [
    ["Find", "Search any document number (Indent, Order, Service Order, GRN, SRN, GIN, DC, BRR, BRB, Purchase Bill, Payment) or an item code / name."],
    ["Trace", "See where it came from and what followed, item by item. Switch to Full Flow to include sibling branches."],
    ["Drill down", "Inspect any document, open it, or re-trace from it. Reconcile quantities and money, and review exceptions."],
  ];
  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="text-center">
        <GitFork className="mx-auto h-10 w-10 text-[#2f6f9f]" />
        <h2 className="mt-2 text-[18px] font-semibold text-[#144664]">Traceability Workbench</h2>
        <p className="mt-1 text-[13px] text-gray-600">
          Follow any procurement document through its complete lifecycle — requisition, ordering, receipt, issue,
          supplier billing, accounts and payment.
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3" data-guide="intro-steps">
        {steps.map(([t, d], i) => (
          <div key={t} className="rounded-lg border border-[#b5c7d8] bg-[#f3f7ff] p-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#144664]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#144664] text-[11px] text-white">{i + 1}</span>
              {t}
            </div>
            <p className="mt-1 text-[12px] text-gray-600">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-gray-200 bg-white p-3 text-[12px] text-gray-600" data-guide="intro-links">
        <div className="mb-1.5 font-semibold text-gray-700">How links are shown</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {Object.values(LINK_KIND).map((k) => (
            <div key={k.label} className="flex items-start gap-2">
              <span className={`mt-[1px] shrink-0 rounded border px-1.5 text-[10px] font-semibold ${k.cls}`}>{k.label}</span>
              <span>{k.help}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TraceabilityWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const qType = (params.get("type") || "").toUpperCase();
  const qId = Number(params.get("id")) || null;
  const qMode = (params.get("mode") || "LINEAGE").toUpperCase() === "FULL" ? "FULL" : "LINEAGE";

  const [ctx, setCtx] = useState(null);
  const [ctxError, setCtxError] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [focusBranch, setFocusBranch] = useState(true);
  const [tab, setTab] = useState("flow");
  const [trail, setTrail] = useState([]);
  const [trackRow, setTrackRow] = useState(null);
  const [searchState, setSearchState] = useState({});

  // ── context (projects + searchable document types) ─────────────
  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.MASTER.TRACEABILITY.CONTEXT })
      .then((res) => setCtx(res?.data || null))
      .catch((e) => setCtxError(e?.message || "Failed to load workbench"));
  }, []);

  const navigate = useCallback(
    (type, id, mode = qMode) => {
      router.push(`${pathname}?type=${type}&id=${id}&mode=${mode}`);
    },
    [router, pathname, qMode],
  );

  // ── load the flow whenever the URL changes (deep-linkable) ─────
  const load = useCallback(async () => {
    if (!qType || !qId || !TYPES_WITH_IDS.test(qType)) {
      setFlow(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest({
        url: API_ENDPOINTS.MASTER.TRACEABILITY.FLOW,
        params: { type: qType, id: qId, mode: qMode },
      });
      const data = res?.data;
      setFlow(data);
      setSelectedKey(data?.start?.key || null);
      const start = data?.nodes?.find((n) => n.isStart);
      if (start) {
        const label = qType === "INDENT_ITEM" && data.start.item
          ? `${start.docNo} · ${data.start.item.itemName || data.start.item.itemCode}`
          : start.docNo;
        setTrail((t) => {
          const entry = { type: qType, id: qId, label, typeLabel: qType === "INDENT_ITEM" ? "Indent Item" : start.typeLabel };
          const idx = t.findIndex((x) => x.type === qType && x.id === qId);
          return idx >= 0 ? t.slice(0, idx + 1) : [...t, entry].slice(-8);
        });
        rememberTrace({
          docType: qType, docId: qId, docNo: start.docNo, typeLabel: qType === "INDENT_ITEM" ? "Indent Item" : start.typeLabel,
          date: start.date, status: start.status, projectCode: start.projectCode, party: start.party, stage: start.stage,
          itemName: data.start.item?.itemName, itemCode: data.start.item?.itemCode, qty: data.start.item?.qty, unit: data.start.item?.unit,
        });
      }
    } catch (e) {
      setFlow(null);
      setError(e?.message || "Failed to trace document");
    } finally {
      setLoading(false);
    }
  }, [qType, qId, qMode]);

  useEffect(() => {
    load();
  }, [load]);

  const nodesByKey = useMemo(() => Object.fromEntries((flow?.nodes || []).map((n) => [n.key, n])), [flow]);
  const selected = selectedKey ? nodesByKey[selectedKey] : null;
  const related = useMemo(
    () => (focusBranch && selectedKey && flow ? relatedKeys(selectedKey, flow.edges) : null),
    [focusBranch, selectedKey, flow],
  );
  const counts = countExceptions(flow?.exceptions);
  const stageCounts = useMemo(() => {
    const c = {};
    for (const n of flow?.nodes || []) c[n.stage] = (c[n.stage] || 0) + 1;
    return c;
  }, [flow]);

  const selectDoc = (key) => {
    if (!nodesByKey[key]) {
      toast.info("That document is not part of this view.");
      return;
    }
    setSelectedKey(key);
    if (tab !== "flow" && tab !== "map") setTab("flow");
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy link"),
    );
  };

  if (ctxError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-gray-600">
        <AlertCircle className="h-8 w-8 text-red-400" /> {ctxError}
      </div>
    );
  }

  const startNode = flow?.nodes?.find((n) => n.isStart);
  const noAccess = ctx && !ctx.isGlobal && !ctx.projects.length;

  // what the Smart Guide reads to decide the next step
  const guideContext = {
    ready: !!ctx,
    ctxError,
    noAccess,
    isGlobal: !!ctx?.isGlobal,
    loading,
    error,
    hasFlow: !!flow,
    mode: qMode,
    tab,
    projectCode,
    search: searchState,
    start: startNode ? { docNo: startNode.docNo, typeLabel: startNode.typeLabel } : null,
    selected: selected
      ? { docNo: selected.docNo, typeLabel: selected.typeLabel, isStart: !!selected.isStart, restricted: !!selected.restricted }
      : null,
    counts,
    nodeCount: flow?.nodes?.length || 0,
    trailLength: trail.length,
  };
  const guideActions = {
    setTab,
    switchMode: (m) => qType && qId && navigate(qType, qId, m),
    focusSearch: () => document.querySelector('[data-guide="search-input"]')?.focus(),
  };

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        {/* ── search bar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <WorkbenchSearch
            docTypes={ctx?.docTypes || []}
            projectCode={projectCode}
            onPick={(r) => navigate(r.docType, r.docId, qMode)}
            onStateChange={setSearchState}
          />
          <select
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
            className="h-[36px] min-w-[180px] rounded-sm border border-[#6f7f8f] bg-white px-2 text-[13px] outline-none"
            aria-label="Project"
            data-guide="project"
          >
            <option value="">{ctx?.isGlobal ? "All projects" : "All my projects"}</option>
            {(ctx?.projects || []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
                {p.name ? ` · ${p.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* ── drill-down trail ───────────────────────────────────── */}
        {trail.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 text-[12px]" data-guide="trail">
            <span className="text-gray-500">Trail:</span>
            {trail.map((t, i) => (
              <span key={`${t.type}:${t.id}`} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                <button
                  type="button"
                  disabled={t.type === qType && t.id === qId}
                  onClick={() => navigate(t.type, t.id)}
                  className={`rounded px-1.5 py-0.5 ${t.type === qType && t.id === qId ? "bg-[#144664] font-semibold text-white" : "text-[#144664] hover:bg-[#e8f2ff]"}`}
                  title={t.typeLabel}
                >
                  {t.label}
                </button>
              </span>
            ))}
          </div>
        )}

        {noAccess ? (
          <div className="py-16 text-center text-[13px] text-gray-600">
            You are not assigned to any project, so there are no documents you can trace.
          </div>
        ) : loading ? (
          <Skeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="max-w-md text-sm text-gray-600">{error}</p>
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-sm border border-[#6d9dc5] bg-[#9fc5e8] px-4 py-1 text-sm font-medium hover:brightness-95">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : !flow ? (
          <Intro />
        ) : (
          <>
            {/* ── trace summary ──────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[#b5c7d8] bg-[#e8f2ff] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2" data-guide="summary">
                {startNode && (
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${STAGE_STYLE[startNode.stage].dot}`}>
                    <DocIcon node={startNode} className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-600">Tracing {flow.start.requestedType === "INDENT_ITEM" ? "indent item" : startNode?.typeLabel}</div>
                  <div className="truncate text-[15px] font-bold text-[#144664]">
                    {startNode?.docNo}
                    {flow.start.item && <span className="font-medium text-gray-700"> · {flow.start.item.itemName || flow.start.item.itemCode}</span>}
                  </div>
                </div>
              </div>

              <div className="inline-flex overflow-hidden rounded-md border border-[#6d9dc5] text-[12px]" data-guide="mode">
                {["LINEAGE", "FULL"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    title={MODE_HELP[m]}
                    onClick={() => m !== qMode && navigate(qType, qId, m)}
                    className={`px-3 py-1 font-medium ${m === qMode ? "bg-[#144664] text-white" : "bg-white text-[#144664] hover:bg-[#f0f6ff]"}`}
                  >
                    {m === "LINEAGE" ? "Document Lineage" : "Full Flow"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1" data-guide="stages">
                {flow.stages.map((s) =>
                  stageCounts[s.key] ? (
                    <span key={s.key} className={`rounded border px-1.5 py-[1px] text-[10.5px] font-semibold ${STAGE_STYLE[s.key].chip}`}>
                      {s.label} {stageCounts[s.key]}
                    </span>
                  ) : null,
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="inline-flex items-center gap-2" data-guide="badges">
                  {counts.error === 0 && counts.warning === 0 && (
                    <span className="rounded-full bg-emerald-600 px-2 text-[11px] font-semibold text-white">No issues</span>
                  )}
                {counts.error > 0 && <span className="rounded-full bg-red-500 px-2 text-[11px] font-semibold text-white">{counts.error} mismatch</span>}
                {counts.warning > 0 && <span className="rounded-full bg-amber-500 px-2 text-[11px] font-semibold text-white">{counts.warning} pending</span>}
                </span>
                <button type="button" data-guide="copy-link" onClick={copyLink} className="inline-flex items-center gap-1 rounded border border-[#6d9dc5] bg-white px-2 py-0.5 text-[11.5px] text-[#144664] hover:bg-[#f0f6ff]" title="Copy a link to this trace">
                  <Link2 className="h-3.5 w-3.5" /> Link
                </button>
              </div>
            </div>
            <p className="-mt-1 text-[11px] text-gray-500">{MODE_HELP[qMode]}</p>

            {/* ── main area ─────────────────────────────────────── */}
            <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0">
                <Tabs value={tab} onValueChange={setTab}>
                  <div className="flex flex-wrap items-center gap-2">
                    <TabsList className="h-9">
                      <TabsTrigger value="flow" data-guide="tab-flow" className="px-3"><ListTree /> Document Flow</TabsTrigger>
                      <TabsTrigger value="map" data-guide="tab-map" className="px-3"><LayoutGrid /> Lifecycle Map</TabsTrigger>
                      <TabsTrigger value="qty" data-guide="tab-qty" className="px-3"><Scale /> Quantities</TabsTrigger>
                      <TabsTrigger value="fin" data-guide="tab-fin" className="px-3"><Coins /> Financials</TabsTrigger>
                      <TabsTrigger value="exc" data-guide="tab-exc" className="px-3">
                        <TriangleAlert /> Exceptions
                        {counts.error + counts.warning > 0 && (
                          <span className={`rounded-full px-1.5 text-[10px] font-semibold text-white ${counts.error ? "bg-red-500" : "bg-amber-500"}`}>
                            {counts.error + counts.warning}
                          </span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="time" data-guide="tab-time" className="px-3"><Rows3 /> Timeline</TabsTrigger>
                    </TabsList>
                    {(tab === "flow" || tab === "map") && (
                      <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-gray-700" data-guide="highlight">
                        <input type="checkbox" checked={focusBranch} onChange={(e) => setFocusBranch(e.target.checked)} />
                        Highlight branch of selected document
                      </label>
                    )}
                  </div>

                  <TabsContent value="flow" className="mt-2" data-guide="flow-tree">
                    <FlowTree nodes={flow.nodes} edges={flow.edges} selectedKey={selectedKey} related={related} onSelect={setSelectedKey} />
                  </TabsContent>
                  <TabsContent value="map" className="mt-2" data-guide="lifecycle-map">
                    <LifecycleMap stages={flow.stages} nodes={flow.nodes} selectedKey={selectedKey} related={related} onSelect={setSelectedKey} />
                  </TabsContent>
                  <TabsContent value="qty" className="mt-2" data-guide="qty-panel">
                    <ReconciliationPanel recon={flow.reconciliation} onDoc={selectDoc} />
                  </TabsContent>
                  <TabsContent value="fin" className="mt-2" data-guide="fin-panel">
                    <FinancialsPanel fin={flow.financials} onDoc={selectDoc} />
                  </TabsContent>
                  <TabsContent value="exc" className="mt-2" data-guide="exc-panel">
                    <ExceptionsPanel exceptions={flow.exceptions} onDoc={selectDoc} />
                  </TabsContent>
                  <TabsContent value="time" className="mt-2" data-guide="time-panel">
                    <TimelinePanel nodes={flow.nodes} stages={flow.stages} onDoc={selectDoc} />
                  </TabsContent>
                </Tabs>
              </div>

              <aside data-guide="inspector" className="min-h-[420px] overflow-hidden rounded-lg border border-[#b5c7d8] bg-white xl:sticky xl:top-2 xl:max-h-[calc(100vh-200px)]">
                {loading ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                ) : (
                  <DocumentInspector
                    node={selected}
                    edges={flow.edges}
                    nodesByKey={nodesByKey}
                    onSelect={setSelectedKey}
                    isStart={!!selected?.isStart && qType !== "INDENT_ITEM"}
                    onTraceFrom={(type, id) => navigate(type, id)}
                    onTrackItem={(l) => setTrackRow({ indentItemId: l.lineId, itemName: l.itemName, itemCode: l.itemCode, unit: l.unit })}
                  />
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      <SmartGuide
        id="traceability-workbench"
        hints={HINTS}
        tour={TOUR}
        nextStep={getNextStep}
        context={guideContext}
        actions={guideActions}
      />

      <ItemTraceModal
        open={!!trackRow}
        onClose={() => setTrackRow(null)}
        indentItemId={trackRow?.indentItemId}
        fallbackItem={trackRow}
      />
    </TooltipProvider>
  );
}
