"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, GitBranch, ListOrdered, RefreshCw, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { StatusBadge } from "./TraceBits";
import { fmtDate, fmtPercent } from "./traceUtils";
import TraceSummaryCards from "./TraceSummaryCards";
import TraceLifecycle from "./TraceLifecycle";
import TraceLedgerTab from "./TraceLedgerTab";
import TraceExceptions, { exceptionCounts } from "./TraceExceptions";

function HeaderField({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="truncate text-[12.5px] font-semibold text-gray-800" title={typeof value === "string" ? value : undefined}>
        {value || "—"}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  const block = "animate-pulse rounded-lg bg-gray-200/80";
  return (
    <div className="space-y-4 p-5" aria-busy="true" aria-label="Loading item trace">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`${block} h-[68px]`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${block} h-[56px]`} />
        ))}
      </div>
      <div className={`${block} h-8 w-72`} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
          <div className={`${block} h-[72px] flex-1`} />
        </div>
      ))}
    </div>
  );
}

export default function ItemTraceModal({ open, onClose, indentItemId, fallbackItem }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("lifecycle");

  const load = useCallback(async () => {
    if (!indentItemId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.INDENT.ITEM_TRACE}${indentItemId}`,
        method: "GET",
      });
      setData(res?.data || null);
    } catch (err) {
      setData(null);
      setError(err?.message || "Failed to load item trace");
    } finally {
      setLoading(false);
    }
  }, [indentItemId]);

  useEffect(() => {
    if (!open) return;
    setTab("lifecycle");
    load();
  }, [open, load]);

  const src = data?.source;
  const counts = exceptionCounts(data?.exceptions);
  const flagged = counts.error + counts.warning;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="flex h-[92dvh] w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw] 2xl:max-w-[1500px]">
        <TooltipProvider>
          {/* ── header ─────────────────────────────────────────────── */}
          <div className="shrink-0 border-b bg-[#e8f2ff] py-2.5 pl-5 pr-12">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DialogTitle className="text-[17px] font-semibold text-[#144664]">
                Track Item · {src?.itemName || fallbackItem?.itemName || "Indent Item"}
              </DialogTitle>
              {src?.isAsset && (
                <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  FIXED ASSET
                </span>
              )}
              {src && <StatusBadge status={src.indentStatus} />}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-8">
              <HeaderField label="Item Code" value={src?.itemDisplayCode || src?.itemCode || fallbackItem?.itemCode} />
              <HeaderField
                label="Category / Type"
                value={src ? `${src.itemCategoryName || src.indentCategoryName || "—"} · ${src.itemType}` : null}
              />
              <HeaderField label="Unit" value={src ? `${src.unit || "—"}${src.unitName ? ` (${src.unitName})` : ""}` : fallbackItem?.unit} />
              <HeaderField label="GST Rate" value={src ? fmtPercent(src.gstPercent) : null} />
              <HeaderField label="Indent No" value={src?.indentNo} />
              <HeaderField label="Indent Date" value={src ? fmtDate(src.indentDate) : null} />
              <HeaderField
                label="Project"
                value={src ? `${src.projectCode}${src.projectName ? ` · ${src.projectName}` : ""}` : null}
              />
              <HeaderField label="CC Code" value={src?.ccCode ? `${src.ccCode} · ${src.ccName || ""}` : null} />
            </div>
          </div>

          {/* ── body ───────────────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-red-400" />
                <p className="max-w-md text-sm text-gray-600">{error}</p>
                <button
                  type="button"
                  onClick={load}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[#6d9dc5] bg-[#9fc5e8] px-4 py-1 text-sm font-medium hover:brightness-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : data ? (
              <div className="space-y-4 px-5 py-4">
                <TraceSummaryCards
                  summary={data.summary}
                  unit={src.unit}
                  rules={data.rules}
                  allocationBasis={data.allocationBasis}
                />

                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="h-9">
                    <TabsTrigger value="lifecycle" className="px-3">
                      <GitBranch /> Item Lifecycle
                    </TabsTrigger>
                    <TabsTrigger value="ledger" className="px-3">
                      <ListOrdered /> Transaction Ledger
                      <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600">
                        {data.ledger?.length || 0}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="exceptions" className="px-3">
                      <TriangleAlert /> Pending &amp; Exceptions
                      {flagged > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[10px] font-semibold text-white ${counts.error ? "bg-red-500" : "bg-amber-500"}`}
                        >
                          {flagged}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="lifecycle" className="mt-2">
                    <TraceLifecycle data={data} />
                  </TabsContent>
                  <TabsContent value="ledger" className="mt-2">
                    <TraceLedgerTab ledger={data.ledger} allocationBasis={data.allocationBasis} />
                  </TabsContent>
                  <TabsContent value="exceptions" className="mt-2">
                    <TraceExceptions
                      exceptions={data.exceptions}
                      unavailableMetrics={data.summary?.unavailableMetrics}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            ) : null}
          </div>

          {/* ── footer ─────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-white px-5 py-2.5">
            <span className="text-[11px] text-gray-500">
              Read-only view. Quantities follow the same rules as the source modules.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-[34px] cursor-pointer rounded-md border px-5 text-sm font-medium hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
