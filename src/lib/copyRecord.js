"use client";

// "Copy" — start a new entry pre-filled from an existing one.
//
// Detail page  /a/b/123   → Copy button → /a/b/new?copy=123
// Create page  /a/b/new   → "Copy from…" → pick an earlier entry → same as above
// The create form reads ?copy=123 (useCopySource), loads record 123 the same
// way the edit screen does, clears what must be unique (document number,
// status, attachments, saved row ids) and stays in create mode, so the user
// can change anything and Save creates a brand-new record.

import { useEffect, useState, useSyncExternalStore } from "react";
import { apiRequest } from "@/lib/apiClient";
import { toast } from "sonner";
import { getPageAccess } from "@/helper/getPageAccess";
import { isMasterEditable } from "@/helper/getMasterAccess";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

const COPY_EVENT = "erp:copy-source";

// Base path of each module that supports Copy → how to check "can add".
// (The /new page checks access again; this only hides the button.)
const page = (pageCode) => () => getPageAccess({ pageCode, pageType: "ADD" }).allowed;
const master = () => isMasterEditable();

export const COPYABLE = {
  "/master/asset-code": master,
  "/master/bank-cash": master,
  "/master/cc-code": master,
  "/master/item-code": master,
  "/master/ledger-code": master,
  "/master/terms-condition": master,
  "/master/unit": master,


  "/finance-management/account/contra": page("contra"),
  "/finance-management/account/credit-note": page("credit_note"),
  "/finance-management/account/debit-note": page("debit_note"),
  "/finance-management/account/journal": page("journal"),
  "/finance-management/account/payment": page("payment"),
  "/finance-management/account/petty-cash/budget": page("petty_cash"),
  "/finance-management/account/petty-cash/expenses-docket": page("petty_cash"),
  "/finance-management/account/purchases/bill": page("purchases"),
  "/finance-management/account/receipt": page("receipt"),
  "/finance-management/account/receipt-billing": page("receipt"),
  "/finance-management/account/sale": page("sale"),

  "/logistics/delivery-challan": page("delivery_challan"),

  "/project-management/contacts/budget": page("budget_master"),
  "/project-management/contacts/extra-work": page("extra_work"),
  "/project-management/contacts/sale-order": page("sale_order"),
  "/project-management/customer-billing/sale-bill-certified": page("sale_certified_bill"),
  "/project-management/customer-billing/sale-bill-claim": page("sale_claim_bill"),
  "/project-management/register/bbs": page("bbs_register"),
  "/project-management/register/concrete": page("concrete_register"),
  "/project-management/register/drawing": page("drawing_register"),
  "/project-management/register/hindrance": page("hindrance_register"),

  "/resource-management/contact-dairy/materials": page("contact_dairy_materials"),
  "/resource-management/contact-dairy/plant-machinery": page("contact_dairy_plant_machinery"),
  "/resource-management/contact-dairy/work-force": page("contact_dairy_work_force"),
  "/resource-management/material/gin": page("goods_issue_note"),
  "/resource-management/material/grn": page("goods_received_note"),
  "/resource-management/procurement/indent": page("indent"),
  "/resource-management/procurement/order/material-order": page("order"),
  "/resource-management/procurement/order/service-order": page("order"),
  "/resource-management/services/manpower/dlr": page("dlr"),
  "/resource-management/services/plant-machinery/batching-plant": page("batching_plant"),
  "/resource-management/services/plant-machinery/log-sheet/log-book": page("log_sheet"),
  "/resource-management/services/plant-machinery/log-sheet/log-entry": page("log_sheet"),
  "/resource-management/services/plant-machinery/pm-inventory/pm-id": page("pm_inventory"),
  "/resource-management/services/plant-machinery/pm-inventory/service-data/service-history": page("pm_inventory"),
  "/resource-management/services/plant-machinery/pm-inventory/service-data/service-schedule": page("pm_inventory"),
  "/resource-management/services/srn": page("goods_received_note"),
  "/resource-management/sub-contractor-billing/bill-receive-register": page("bill_receive_register"),
};

// "Copy from…" on a create page: where to list the earlier entries.
//   url: list endpoint · project: add ?projectCode · id: row id field
//   params: extra query · uniq: keep one row per this field
//   detail: full-record URL (for the item details in the hover panel)
const E = API_ENDPOINTS;
export const PICK_LISTS = {
  "/master/asset-code": { detail: (id) => `${E.MASTER.GET_ASSET_BY_ID}/${id}`, url: E.MASTER.GET_ALL_ASSET, id: "assetId" },
  "/master/bank-cash": { detail: (id) => `${E.MASTER.BANK_CASH.GET_BY_ID}/${id}`, url: E.MASTER.BANK_CASH.LIST, id: "id" },
  "/master/cc-code": { detail: (id) => `${E.MASTER.GET_CC_CODE_BY_ID}/${id}`, url: E.MASTER.GET_ALL_CC_CODE, id: "ccId" },
  "/master/item-code": { detail: (id) => `${E.MASTER.GET_ITEM_BY_ID}/${id}`, url: E.MASTER.GET_ALL_ITEM, id: "itemId" },
  "/master/ledger-code": { detail: (id) => `${E.MASTER.GET_LEDGER_BY_ID}/${id}`, url: E.MASTER.GET_ALL_LEDGER, id: "ledgerId" },
  "/master/terms-condition": { detail: (id) => `${E.MASTER.TERM.GET_BY_ID}/${id}`, url: E.MASTER.TERM.LIST, id: "termId" },
  "/master/unit": { detail: (id) => `${E.MASTER.GET_UNIT_BY_ID}/${id}`, url: E.MASTER.GET_ALL_UNIT, id: "unitId" },

  "/finance-management/account/contra": { detail: (id) => `${E.FINANCE.CONTRA_ENTRY.GET_BY_ID}${id}`, url: E.FINANCE.CONTRA_ENTRY.LIST, project: true },
  "/finance-management/account/credit-note": { detail: (id) => `${E.FINANCE.CREDIT_NOTE.GET_BY_ID}${id}`, url: E.FINANCE.CREDIT_NOTE.LIST, project: true },
  "/finance-management/account/debit-note": { detail: (id) => `${E.FINANCE.DEBIT_NOTE.GET_BY_ID}${id}`, url: E.FINANCE.DEBIT_NOTE.LIST, project: true },
  "/finance-management/account/journal": { detail: (id) => `${E.FINANCE.JOURNAL_ENTRY.GET_BY_ID}${id}`, url: E.FINANCE.JOURNAL_ENTRY.LIST, project: true },
  "/finance-management/account/payment": { detail: (id) => `${E.FINANCE.BILL_PAYMENT.GET_BY_ID}${id}`, url: E.FINANCE.BILL_PAYMENT.LIST, project: true },
  "/finance-management/account/petty-cash/budget": { detail: (id) => `${E.FINANCE.PETTY_CASH.BUDGET.GET_BY_ID}${id}`, url: E.FINANCE.PETTY_CASH.BUDGET.LIST, project: true },
  "/finance-management/account/petty-cash/expenses-docket": { detail: (id) => `${E.FINANCE.PETTY_CASH.DOCKET_VOUCHER.GET_BY_ID}${id}`, url: E.FINANCE.PETTY_CASH.DOCKET_VOUCHER.LIST, project: true },
  "/finance-management/account/purchases/bill": { detail: (id) => `${E.FINANCE.PURCHASE_BILL.GET_BY_ID}${id}`, url: E.FINANCE.PURCHASE_BILL.LIST, project: true },
  "/finance-management/account/receipt": { detail: (id) => `${E.FINANCE.SALE_RECEIPT.GET_BY_ID}${id}`, url: E.FINANCE.SALE_RECEIPT.LIST, project: true },
  "/finance-management/account/sale": { detail: (id) => `${E.FINANCE.SALE_BILL.GET_BY_ID}${id}`, url: E.FINANCE.SALE_BILL.LIST, project: true },

  "/logistics/delivery-challan": { detail: (id) => `${E.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.GET_BY_ID}/${id}`, url: E.RESOURCE.MATERIAL_MANAGEMENT.LOGISTICS.DC.LIST, project: true },

  "/project-management/contacts/budget": { detail: (id) => `${E.PROJECT.BUDGET_MASTER.GET_BY_ID}${id}`, url: E.PROJECT.BUDGET_MASTER.LIST, project: true },
  "/project-management/contacts/extra-work": { detail: (id) => `${E.PROJECT.EXTRA_WORK.GET_BY_ID}${id}`, url: E.PROJECT.EXTRA_WORK.LIST, project: true },
  "/project-management/contacts/sale-order": { detail: (id) => `${E.PROJECT.OG_SALE_ORDER.GET_BY_ID}${id}`, url: E.PROJECT.OG_SALE_ORDER.LIST, project: true },
  "/project-management/customer-billing/sale-bill-certified": { detail: (id) => `${E.PROJECT.SALE_CERTIFIED_BILL.GET_BY_ID}${id}`, url: E.PROJECT.SALE_CERTIFIED_BILL.LIST, project: true, params: { mode: "sale_certified_bill" } },
  "/project-management/customer-billing/sale-bill-claim": { detail: (id) => `${E.PROJECT.SALE_CLAIM_BILL.GET_BY_ID}${id}`, url: E.PROJECT.SALE_CLAIM_BILL.LIST, project: true, params: { mode: "sale_claim_bill" } },
  "/project-management/register/bbs": { detail: (id) => `${E.PROJECT.REGISTER.BBS_REGISTER.GET_BY_ID}/${id}`, url: E.PROJECT.REGISTER.BBS_REGISTER.LIST, project: true },
  "/project-management/register/concrete": { detail: (id) => `${E.PROJECT.REGISTER.CONCRETE.GET_DETAILS_BY_ID}/${id}`, url: E.PROJECT.REGISTER.CONCRETE.GET_ALL_CONCRETE, project: true },
  "/project-management/register/drawing": { detail: (id) => `${E.PROJECT.REGISTER.DRAWING_REGISTER.GET_DRAWING_REGISTER_BY_ID}/${id}`, url: E.PROJECT.REGISTER.DRAWING_REGISTER.GET_ALL_DRAWING_REGISTER, project: true },
  "/project-management/register/hindrance": { detail: (id) => `${E.PROJECT.REGISTER.HINDRANCE_REGISTER.GET_BY_ID}/${id}`, url: E.PROJECT.REGISTER.HINDRANCE_REGISTER.LIST, project: true },

  "/resource-management/contact-dairy/materials": { detail: (id) => `${E.SUPPLIER.GET_BY_ID}/${id}`, url: E.SUPPLIER.LIST, id: "supplierId", params: { supplierType: "materials" } },
  "/resource-management/contact-dairy/plant-machinery": { detail: (id) => `${E.SUPPLIER.GET_BY_ID}/${id}`, url: E.SUPPLIER.LIST, id: "supplierId", params: { supplierType: "plant_machinery" } },
  "/resource-management/contact-dairy/work-force": { detail: (id) => `${E.SUPPLIER.GET_BY_ID}/${id}`, url: E.SUPPLIER.LIST, id: "supplierId", params: { supplierType: "work_force" } },
  "/resource-management/material/gin": { detail: (id) => `${E.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_GIN_BY_ID}/${id}`, url: E.RESOURCE.MATERIAL_MANAGEMENT.GIN.GET_ALL_GIN, project: true },
  "/resource-management/material/grn": { detail: (id) => `${E.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_GRN_BY_ID}/${id}`, url: E.RESOURCE.MATERIAL_MANAGEMENT.GRN.GET_ALL_GRN, project: true },
  "/resource-management/procurement/indent": { detail: (id) => `${E.RESOURCE.PROCUREMENT.INDENT.GET_INDENT_BY_ID}${id}`, url: E.RESOURCE.PROCUREMENT.INDENT.GET_ALL_INDENT, project: true },
  "/resource-management/procurement/order/material-order": { detail: (id) => `${E.RESOURCE.PROCUREMENT.ORDER.GET_ORDER_BY_ID}/${id}`, url: E.RESOURCE.PROCUREMENT.ORDER.GET_ALL_ORDER, project: true },
  "/resource-management/procurement/order/service-order": { detail: (id) => `${E.RESOURCE.PROCUREMENT.ORDER.PROJECT_WORK.GET_ORDER_BY_ID}/${id}`, url: E.RESOURCE.PROCUREMENT.ORDER.PROJECT_WORK.GET_ALL_ORDER, project: true },
  "/resource-management/services/manpower/dlr": { detail: (id) => `${E.RESOURCE.MANPOWER.DLR.GET_BY_ID}/${id}`, url: E.RESOURCE.MANPOWER.DLR.LIST },
  "/resource-management/services/plant-machinery/batching-plant": { detail: (id) => `${E.RESOURCE.BATCHING_PLANT.DETAILS}/${id}`, url: E.RESOURCE.BATCHING_PLANT.LIST, project: true },
  "/resource-management/services/plant-machinery/log-sheet/log-book": { detail: (id) => `${E.RESOURCE.MACHINERY.LOG_BOOK.DETAILS}/${id}`, url: E.RESOURCE.MACHINERY.LOG_ENTRY.LIST, project: true, id: "logBookId", uniq: "logBookId" },
  "/resource-management/services/plant-machinery/log-sheet/log-entry": { detail: (id) => `${E.RESOURCE.MACHINERY.LOG_ENTRY.DETAILS}/${id}`, url: E.RESOURCE.MACHINERY.LOG_ENTRY.LIST, project: true, id: "entryId" },
  "/resource-management/services/plant-machinery/pm-inventory/pm-id": { detail: (id) => `${E.RESOURCE.MACHINERY.PM_ID.GET_BY_ID}${id}`, url: E.RESOURCE.MACHINERY.PM_ID.LIST },
  "/resource-management/services/plant-machinery/pm-inventory/service-data/service-history": { detail: (id) => `${E.RESOURCE.MACHINERY.SERVICE_HISTORY.GET_BY_ID}${id}`, url: E.RESOURCE.MACHINERY.SERVICE_HISTORY.LIST },
  "/resource-management/services/plant-machinery/pm-inventory/service-data/service-schedule": { detail: (id) => `${E.RESOURCE.MACHINERY.SERVICE_SCHEDULE.GET_BY_ID}${id}`, url: E.RESOURCE.MACHINERY.SERVICE_SCHEDULE.LIST },
  "/resource-management/services/srn": { detail: (id) => `${E.RESOURCE.MATERIAL_MANAGEMENT.SRN.GET_SRN_BY_ID}/${id}`, url: E.RESOURCE.MATERIAL_MANAGEMENT.SRN.GET_ALL_SRN, project: true },
  "/resource-management/sub-contractor-billing/bill-receive-register": { detail: (id) => `${E.RESOURCE.BILL_RECEIVE_REGISTER.DETAILS}/${id}`, url: E.RESOURCE.BILL_RECEIVE_REGISTER.LIST, project: true, id: "id", alt: "brrId" },
};

const canAdd = (base) => {
  try {
    return !!COPYABLE[base]?.();
  } catch {
    return false;
  }
};

/** On a create page (…/new): the module base whose entries can be copied, or null. */
export const getCopyFromBase = (pathname) => {
  if (!pathname) return null;
  const parts = pathname.replace(/\/+$/, "").split("/");
  if (parts.pop() !== "new") return null;
  const base = parts.join("/");
  return PICK_LISTS[base] && canAdd(base) ? base : null;
};

/** Switch the create form to a copy of `id` without leaving the page. */
export const startCopyFrom = (base, id) => {
  window.history.replaceState(window.history.state, "", `${base}/new?copy=${encodeURIComponent(id)}`);
  window.dispatchEvent(new Event(COPY_EVENT));
};

/** Load the earlier entries of a module for the picker: [{ id, title, sub, text }]. */
export const loadPickRows = async (base) => {
  const cfg = PICK_LISTS[base];
  const params = { ...(cfg.params || {}) };
  if (cfg.project) params.projectCode = getLocalStorage("projectInfo")?.projectCode || "";
  const res = await apiRequest({ url: cfg.url, method: "GET", params });
  const raw = res?.data;
  const list = Array.isArray(raw) ? raw : raw?.items || raw?.rows || raw?.list || raw?.data || [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const id = r[cfg.id || "id"] ?? (cfg.alt ? r[cfg.alt] : undefined);
    if (id == null || id === "") continue;
    if (cfg.uniq) {
      if (seen.has(r[cfg.uniq])) continue;
      seen.add(r[cfg.uniq]);
    }
    out.push({ id, ...describeRow(r) });
  }
  return out;
};

// ---- describing list rows (title, subtitle, hover details) ----------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_RE = /^(\d{4}-\d{2}-\d{2})([T ]\d{2}:\d{2})?|^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** "Wed, 04 Nov 2026 00:00:00 GMT" / "2026-11-04" → "04 Nov 2026" (adds the time when there is one). */
export const formatPickDate = (v) => {
  if (typeof v !== "string" || !DATE_RE.test(v.trim())) return null;
  const t = v.trim();
  let y, mo, d, hh = 0, mm = 0;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) {
    [y, mo, d] = [+iso[1], +iso[2] - 1, +iso[3]];
    if (iso[4]) [hh, mm] = [+iso[4], +iso[5]];
  } else {
    const g = new Date(t); // RFC 1123 from the server, in UTC
    if (isNaN(g)) return null;
    [y, mo, d, hh, mm] = [g.getUTCFullYear(), g.getUTCMonth(), g.getUTCDate(), g.getUTCHours(), g.getUTCMinutes()];
  }
  const date = `${String(d).padStart(2, "0")} ${MONTHS[mo]} ${y}`;
  return hh || mm ? `${date}, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : date;
};

const fmtValue = (k, v) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const date = formatPickDate(v);
  if (date) return date;
  if (typeof v === "number" && /amount|value|total|rate|cost|price|basic|gst|qty|quantity/i.test(k))
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  // "Pending_L1" → "Pending L1" for statuses/types; codes like MAT_0012 stay as they are.
  return /status|type|mode|category|frequency/i.test(k) && !/code$/i.test(k) ? String(v).replace(/_/g, " ") : String(v);
};

// "indentPlacedBy" → "Indent Placed By", "gstn" → "GSTN"
const ACRONYMS = { gst: "GST", gstn: "GSTN", gstin: "GSTIN", pan: "PAN", erp: "ERP", uid: "UID", cc: "CC", dc: "DC", grn: "GRN", gin: "GIN", srn: "SRN", brr: "BRR", utr: "UTR", hsn: "HSN", sac: "SAC", no: "No" };
const LABELS = { itemDisplayCode: "Item Code", unitItem: "Unit", itemUnit: "Unit", drCr: "Dr/Cr" };
const labelOf = (k) =>
  LABELS[k] ||
  k
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] || w[0].toUpperCase() + w.slice(1))
    .join(" ");

// Internal fields nobody needs to read.
const HIDDEN = /(^id$|Id$|^_|uuid|Uuid|^sl$|^slNo$|^projectId$|password|token|^createdAt$|^updatedAt$|url$|Url$|File$|file$|attachment|Attachment|scanCopy|^isDeleted$)/;

const pickVal = (r, re, skip = []) => {
  for (const [k, v] of Object.entries(r)) {
    if (skip.includes(k) || v == null || v === "" || typeof v === "object") continue;
    if (re.test(k)) return String(v);
  }
  return "";
};

const describeRow = (r) => {
  const no = pickVal(r, /(^|[a-z])(No|Number|Uid|DocNumber)$|^erp/i, ["mobileNumber", "contactNumber", "whatsappNumber", "vehicleNumber", "driverContactNumber"]);
  const code = pickVal(r, /Code$/i, ["projectCode", "categoryCode"]);
  const name = pickVal(r, /(Name|Title|Description|By)$|^party|^vendor|^debtor|^remarks$/i, ["createdBy", "updatedBy"]);
  const dateRaw = pickVal(r, /Date$/i);
  const date = formatPickDate(dateRaw) || dateRaw;
  const status = pickVal(r, /Status$/i).replace(/_/g, " ");
  const title = no || code || name || `#${r.id ?? ""}`;
  const sub = [name !== title ? name : "", date, status].filter(Boolean).join(" · ");

  // Every readable field, for the hover panel.
  const fields = [];
  for (const [k, v] of Object.entries(r)) {
    if (HIDDEN.test(k) || v == null || v === "" || typeof v === "object") continue;
    fields.push({ label: labelOf(k), value: fmtValue(k, v) });
  }
  // Short summaries of lists inside the row (e.g. items), when the list API sends them.
  for (const [k, v] of Object.entries(r)) {
    if (!Array.isArray(v) || !v.length || typeof v[0] !== "object") continue;
    const names = v
      .map((x) => x?.itemName || x?.name || x?.ccName || x?.description || x?.itemCode)
      .filter(Boolean);
    fields.push({ label: labelOf(k), value: names.length ? `${v.length}: ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}` : `${v.length}` });
  }

  const text = [
    ...Object.values(r).filter((v) => v != null && typeof v !== "object"),
    ...fields.map((f) => f.value),
  ]
    .join(" ")
    .toLowerCase();
  return { title, sub, fields, text };
};

/** For the current detail page: { href, label } of the copy target, or null. */
export const getCopyTarget = (pathname) => {
  if (!pathname) return null;
  const parts = pathname.replace(/\/+$/, "").split("/");
  const id = parts.pop();
  const base = parts.join("/");
  if (!id || id === "new" || !COPYABLE[base]) return null;
  let allowed = false;
  try {
    allowed = COPYABLE[base]();
  } catch {
    allowed = false;
  }
  return allowed ? { href: `${base}/new?copy=${encodeURIComponent(id)}` } : null;
};

// ---- create-form side ------------------------------------------------------

const subscribe = (cb) => {
  window.addEventListener("popstate", cb);
  window.addEventListener(COPY_EVENT, cb); // "Copy from…" picked a record
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(COPY_EVENT, cb);
  };
};
const readCopy = () => new URLSearchParams(window.location.search).get("copy");

/** The id in ?copy= on a create page (null on the server / when absent). */
export const useCopySource = () => useSyncExternalStore(subscribe, readCopy, () => null);

/**
 * Prepare loaded form values for a copy:
 *  - `keep`  : fields whose current value (e.g. the next doc number preview)
 *              should stay instead of the source record's value
 *  - `clear` : fields to empty (doc number, status, …)
 * Saved row ids (`id`, `*ItemId`, …) inside arrays are removed so the new
 * record never points at the old one's rows.
 */
export const forCopy = (values, { keep = [], clear = [], getValues, rowIdKeys = [] } = {}) => {
  const out = { ...values };
  for (const k of clear) out[k] = Array.isArray(out[k]) ? [] : "";
  if (getValues) for (const k of keep) out[k] = getValues(k) ?? "";
  const strip = (row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const r = { ...row };
    delete r.id;
    for (const k of rowIdKeys) r[k] = null;
    return r;
  };
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v) && v.some((x) => x && typeof x === "object")) out[k] = v.map(strip);
  }
  // Order terms: saved term / group / point ids would update the source's rows.
  if (Array.isArray(out.terms)) out.terms = stripSavedIds(out.terms);
  return out;
};

const SAVED_ID_KEYS = ["termId", "groupId", "pointId"];
export const stripSavedIds = (v) => {
  if (Array.isArray(v)) return v.map(stripSavedIds);
  if (!v || typeof v !== "object") return v;
  const r = {};
  for (const [k, x] of Object.entries(v)) if (!SAVED_ID_KEYS.includes(k)) r[k] = stripSavedIds(x);
  return r;
};

export const copyLoadedToast = (label) =>
  toast.info(`Copied from ${label || "the earlier entry"} — change anything you need, then save as new.`, {
    duration: 5000,
  });

/**
 * For create pages whose form gets its record from the page (masters etc.):
 * loads `${urlPrefix}${copyId}` when ?copy= is present.
 * `ready` is false while the copy source is still loading.
 */
export const useCopyData = (urlPrefix, transform = (d) => d) => {
  const copyId = useCopySource();
  const [state, setState] = useState({ id: null, data: null, done: false });
  useEffect(() => {
    if (!copyId) return;
    let alive = true;
    apiRequest({ url: `${urlPrefix}${copyId}`, method: "GET" })
      .then((res) => {
        const d = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (alive) setState({ id: copyId, data: d ? transform(d) : null, done: true });
        if (d) copyLoadedToast();
      })
      .catch((e) => {
        toast.error(e?.message || "Could not load the entry to copy");
        if (alive) setState({ id: copyId, data: null, done: true });
      });
    return () => {
      alive = false;
    };
  }, [copyId]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = !copyId || (state.id === copyId && state.done);
  return { copyId, data: state.id === copyId ? state.data : null, ready };
};

// ---- full record for the hover panel (item tables etc.) ---------------------

const detailCache = new Map(); // `${base}|${id}` → Promise

// Which columns to show for a line-item table, best first.
// Each group lists field names in order of preference; the first present wins.
const COL_ORDER = [
  ["itemName", "fullName", "ccName", "accountName", "ledgerName", "name"],
  ["itemDescription", "description", "shortDescription"],
  ["itemDisplayCode", "itemCode", "ccCode", "manCode", "code"],
  ["qty", "orderQty", "issueQty", "currentReceivedQty", "claimQty", "certifiedQty", "quantity", "totalWorkingHr"],
  ["unit", "itemUnit", "unitItem"],
  ["rate", "unitRate"],
  ["basicAmount", "amount", "budgetAmount", "debitAmount", "creditAmount", "currentAmount", "totalAmount", "gstAmount", "ccValue"],
  ["gstPercent", "percent"],
  ["location", "storeLocation", "useLocation", "stockLocation", "note", "remarks", "drCr"],
];
const MAX_COLS = 6;
const MAX_ROWS = 25;

const toTable = (key, arr) => {
  const objs = arr.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (!objs.length) return null;
  const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))].filter(
    (k) => !HIDDEN.test(k) && objs.some((o) => o[k] != null && o[k] !== "" && typeof o[k] !== "object"),
  );
  const cols = [];
  for (const group of COL_ORDER) {
    const k = group.find((x) => keys.includes(x) && !cols.includes(x));
    if (k) cols.push(k);
    if (cols.length >= MAX_COLS) break;
  }
  if (!cols.length) cols.push(...keys.slice(0, MAX_COLS));
  if (!cols.length) return null;
  // GST lines etc. often come with every row empty / unselected — skip those rows.
  const rows = objs
    .filter((o) => o.isSelected !== false)
    .filter((o) => cols.some((c) => o[c] != null && o[c] !== "" && o[c] !== 0))
    .map((o) => cols.map((c) => (o[c] == null || o[c] === "" ? "" : fmtValue(c, o[c]))));
  if (!rows.length) return null;
  return { label: labelOf(key), columns: cols.map(labelOf), rows: rows.slice(0, MAX_ROWS), more: Math.max(0, rows.length - MAX_ROWS) };
};

/**
 * Full record for the hover panel: { fields: [{label,value}], tables: [{label, columns, rows, more}] }.
 * Cached per entry; null when the module has no details address.
 */
export const loadPickDetail = (base, id) => {
  const cfg = PICK_LISTS[base];
  if (!cfg?.detail) return Promise.resolve(null);
  const key = `${base}|${id}`;
  if (!detailCache.has(key)) {
    const p = apiRequest({ url: cfg.detail(id), method: "GET" })
      .then((res) => {
        const d = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (!d || typeof d !== "object") return { fields: [], tables: [] };
        const fields = [];
        for (const [k, v] of Object.entries(d)) {
          if (HIDDEN.test(k) || v == null || v === "" || typeof v === "object") continue;
          fields.push({ label: labelOf(k), value: fmtValue(k, v) });
        }
        const tables = [];
        for (const [k, v] of Object.entries(d)) {
          if (!Array.isArray(v) || /^terms$|termGroups|revisions|history|timeline|approv/i.test(k)) continue;
          const t = toTable(k, v);
          if (t) tables.push(t);
        }
        return { fields, tables };
      })
      .catch((e) => {
        detailCache.delete(key); // allow a retry
        throw e;
      });
    detailCache.set(key, p);
  }
  return detailCache.get(key);
};
