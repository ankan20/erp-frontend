import {
  ClipboardList,
  FileSearch,
  ShoppingCart,
  Wrench,
  PackageCheck,
  ClipboardCheck,
  PackageMinus,
  Truck,
  FileInput,
  Receipt,
  Archive,
  Landmark,
  Wallet,
} from "lucide-react";

export {
  fmtAmt,
  fmtDate,
  fmtQty,
  fmtPercent,
  formatWorkflowStatus,
  statusClass,
  isRejected,
} from "@/components/resource/indent/item-trace/traceUtils";

// Existing detail pages. Types without one (Enquiry, legacy billing) get no link.
export function docRoute(docType, docId, extra = {}) {
  if (!docId) return null;
  switch (docType) {
    case "INDENT":
      return `/resource-management/procurement/indent/${docId}`;
    case "ORDER":
      return `/resource-management/procurement/order/material-order/${docId}`;
    case "PW_ORDER":
      return `/resource-management/procurement/order/service-order/${docId}`;
    case "GRN":
      return `/resource-management/material/grn/${docId}`;
    case "SRN":
      return `/resource-management/services/srn/${docId}`;
    case "GIN":
      return `/resource-management/material/gin/${docId}`;
    case "DC":
      return `/logistics/delivery-challan/${docId}`;
    case "BRR":
      return `/resource-management/sub-contractor-billing/bill-receive-register/${docId}`;
    case "BRB":
      return `/resource-management/sub-contractor-billing/e-reconcile-bill/${docId}?billingType=${
        String(extra.billingType || "GRN").toLowerCase() === "srn" ? "srn" : "grn"
      }`;
    case "PURCHASE_BILL":
      return `/finance-management/account/purchases/bill/${docId}`;
    case "BILL_PAYMENT":
      return `/finance-management/account/payment/${docId}?type=bill`;
    default:
      return null;
  }
}

export const DOC_ICON = {
  INDENT: ClipboardList,
  ENQUIRY: FileSearch,
  ORDER: ShoppingCart,
  PW_ORDER: Wrench,
  GRN: PackageCheck,
  SRN: ClipboardCheck,
  GIN: PackageMinus,
  DC: Truck,
  BRR: FileInput,
  BRB: Receipt,
  BVS: Archive,
  BSS: Archive,
  PURCHASE_BILL: Landmark,
  BILL_PAYMENT: Wallet,
};

// One colour per lifecycle stage (lanes, chips, icons).
export const STAGE_STYLE = {
  REQUISITION: { dot: "bg-[#144664]", chip: "bg-[#e8f2ff] text-[#144664] border-[#b5c7d8]" },
  SOURCING: { dot: "bg-slate-500", chip: "bg-slate-50 text-slate-700 border-slate-200" },
  ORDERING: { dot: "bg-[#2f6f9f]", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  RECEIPT: { dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  INVENTORY: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-800 border-orange-200" },
  BILLING: { dot: "bg-indigo-600", chip: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  ACCOUNTS: { dot: "bg-purple-600", chip: "bg-purple-50 text-purple-800 border-purple-200" },
  PAYMENT: { dot: "bg-teal-600", chip: "bg-teal-50 text-teal-800 border-teal-200" },
};

// How exact a relationship is — shown on every link.
export const LINK_KIND = {
  ITEM: {
    label: "Item link",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    help: "Exact: the child document's lines point at the parent's lines.",
  },
  HEADER: {
    label: "Document link",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
    help: "Exact at document level: the child document points at the parent document.",
  },
  ORDER_LEVEL: {
    label: "Order level",
    cls: "bg-slate-50 text-slate-600 border-slate-200",
    help: "The bill receive register covers the order as a whole, not particular order lines.",
  },
  VIA_BRR: {
    label: "Via BRR (CC level)",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    help: "Purchase Bills are prepared from the BRR's approved billing, summed per cost-centre code. No item-level link exists.",
  },
};

export const MODE_HELP = {
  LINEAGE:
    "Document flow of the selected document only: what it came from and what came out of it, followed line by line.",
  FULL: "Every document connected to this flow, including sibling branches (e.g. other indents on the same order).",
};

/**
 * Turn the flow graph into SAP-style tree rows.
 * A document with several parents is shown fully under its first parent and
 * as a reference row ("also linked here") under the others.
 */
export function buildTreeRows(nodes, edges) {
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));
  const order = Object.fromEntries(nodes.map((n, i) => [n.key, i]));
  const children = {};
  const parents = {};
  for (const e of edges) {
    if (!byKey[e.from] || !byKey[e.to]) continue;
    (children[e.from] ||= []).push(e);
    (parents[e.to] ||= []).push(e);
  }
  for (const k of Object.keys(children)) children[k].sort((a, b) => order[a.to] - order[b.to]);

  const roots = nodes.filter((n) => !parents[n.key]?.length);
  const rows = [];
  const placed = new Set();

  const walk = (key, depth, viaEdge, path) => {
    const node = byKey[key];
    const isRef = placed.has(key);
    rows.push({ id: `${path}/${key}`, node, depth, edge: viaEdge, isRef, hasChildren: !isRef && !!children[key]?.length, path });
    if (isRef) return;
    placed.add(key);
    for (const e of children[key] || []) walk(e.to, depth + 1, e, `${path}/${key}`);
  };
  for (const r of roots) walk(r.key, 0, null, "");
  // anything only reachable through a cycle (should not happen) still gets shown
  for (const n of nodes) if (!placed.has(n.key)) walk(n.key, 0, null, "");
  return { rows, parents, children };
}

/** All keys upstream and downstream of a node (for highlighting a branch). */
export function relatedKeys(key, edges) {
  const up = {};
  const down = {};
  for (const e of edges) {
    (up[e.to] ||= []).push(e.from);
    (down[e.from] ||= []).push(e.to);
  }
  const seen = new Set([key]);
  const go = (k, map) => {
    for (const n of map[k] || []) {
      if (!seen.has(n)) {
        seen.add(n);
        go(n, map);
      }
    }
  };
  go(key, up);
  go(key, down);
  return seen;
}
