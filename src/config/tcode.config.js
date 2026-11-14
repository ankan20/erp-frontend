// Page codes — one two-letter code per page.
//
// The same code is used in three places:
//   T-code box / command palette :  IN01 = open the Indent list, IN02 = new Indent
//   Keyboard "go to"             :  G then I N  = open the Indent list
//   Keyboard "new"               :  N then I N  = new Indent
//
// To add a page: add one line here. The code must be unique (two letters) and
// the path must be the same `path` used in sidebar.config.js.
// `create: true` means the page has a "<path>/new" screen.
// The shortcut guide page (/shortcuts) lists these automatically.

export const PAGE_CODES = [
  // Dashboard
  { code: "DB", path: "/dashboard", title: "Dashboard" },

  // Settings
  { code: "CD", path: "/settings/company-details" },
  { code: "UP", path: "/settings/user-id-password", create: true },
  { code: "PC", path: "/settings/project-code", create: true },
  { code: "RD", path: "/settings/role-designation" },

  // Master
  { code: "VC", path: "/master/ledger-code", create: true },
  { code: "IC", path: "/master/item-code", create: true },
  { code: "AC", path: "/master/asset-code", create: true },
  { code: "UN", path: "/master/unit", create: true },
  { code: "CC", path: "/master/cc-code", create: true },
  { code: "CG", path: "/master/category-group" },
  { code: "TC", path: "/master/terms-condition", create: true },
  { code: "BC", path: "/master/bank-cash", create: true },
  { code: "TR", path: "/master/traceability-workbench" },
  { code: "MM", path: "/master/contact-dairy/materials" },
  { code: "MW", path: "/master/contact-dairy/work-force" },
  { code: "MP", path: "/master/contact-dairy/plant-machinery" },

  // Resources Management
  { code: "IN", path: "/resource-management/procurement/indent", create: true },
  { code: "EN", path: "/resource-management/procurement/enquiry" },
  { code: "PR", path: "/resource-management/procurement/order/material-order", create: true },
  { code: "WO", path: "/resource-management/procurement/order/service-order", create: true },
  { code: "GR", path: "/resource-management/material/grn", create: true },
  { code: "GI", path: "/resource-management/material/gin", create: true },
  { code: "ST", path: "/resource-management/material/stock-report" },
  { code: "DL", path: "/resource-management/services/manpower/dlr", create: true },
  { code: "LI", path: "/resource-management/services/manpower/labour-id", create: true },
  { code: "PI", path: "/resource-management/services/plant-machinery/pm-inventory" },
  { code: "LS", path: "/resource-management/services/plant-machinery/log-sheet" },
  { code: "BP", path: "/resource-management/services/plant-machinery/batching-plant", create: true },
  { code: "SR", path: "/resource-management/services/srn", create: true },
  { code: "BR", path: "/resource-management/sub-contractor-billing/bill-receive-register", create: true },
  { code: "PQ", path: "/resource-management/sub-contractor-billing/payment-request", create: true },
  { code: "CM", path: "/resource-management/contact-dairy/materials", create: true },
  { code: "CW", path: "/resource-management/contact-dairy/work-force", create: true },
  { code: "CP", path: "/resource-management/contact-dairy/plant-machinery", create: true },

  // Project Management
  { code: "SO", path: "/project-management/contacts/sale-order", create: true },
  { code: "BM", path: "/project-management/contacts/budget", create: true },
  { code: "EW", path: "/project-management/contacts/extra-work", create: true },
  { code: "DP", path: "/project-management/planning/dpr" },
  { code: "DR", path: "/project-management/register/drawing", create: true },
  { code: "BB", path: "/project-management/register/bbs", create: true },
  { code: "CR", path: "/project-management/register/concrete", create: true },
  { code: "HN", path: "/project-management/register/hindrance", create: true },
  { code: "CL", path: "/project-management/customer-billing/sale-bill-claim", create: true },
  { code: "CF", path: "/project-management/customer-billing/sale-bill-certified", create: true },
  { code: "US", path: "/project-management/customer-billing/uncertified-statement", create: true },

  // Asset Management
  { code: "AR", path: "/asset-management/asset-register", create: true },
  { code: "SA", path: "/asset-management/site-allocation", create: true },
  { code: "MR", path: "/asset-management/maintenance-repair", create: true },
  { code: "RU", path: "/asset-management/rental-utilization", create: true },
  { code: "DD", path: "/asset-management/depreciation-disposal" },
  { code: "DI", path: "/asset-management/daily-issue-return", create: true },

  // Logistics
  { code: "DC", path: "/logistics/delivery-challan", create: true },

  // Finance Management
  { code: "SL", path: "/finance-management/account/sale", create: true },
  { code: "PU", path: "/finance-management/account/purchases" },
  { code: "RC", path: "/finance-management/account/receipt", create: true },
  { code: "PY", path: "/finance-management/account/payment", create: true },
  { code: "CT", path: "/finance-management/account/contra", create: true },
  { code: "DN", path: "/finance-management/account/debit-note", create: true },
  { code: "CN", path: "/finance-management/account/credit-note", create: true },
  { code: "JE", path: "/finance-management/account/journal", create: true },
  { code: "PT", path: "/finance-management/account/petty-cash" },
  { code: "LV", path: "/finance-management/account/ledger" },
  { code: "PL", path: "/finance-management/report/pnl" },
  { code: "BS", path: "/finance-management/report/balance-sheet" },

  // HRMS
  { code: "RJ", path: "/hr-management/employee/recruitment" },
  { code: "OL", path: "/hr-management/employee/offer-letter" },
  { code: "AL", path: "/hr-management/employee/appointment-letter" },
  { code: "OB", path: "/hr-management/employee/onboarding" },
  { code: "HR", path: "/hr-management/employee", create: true },
  { code: "PA", path: "/hr-management/admin/payroll" },
  { code: "AP", path: "/hr-management/reports/performance-appraisal" },
  { code: "GT", path: "/hr-management/contact-dairy" },
];

const byCode = Object.fromEntries(PAGE_CODES.map((p) => [p.code, p]));

/** "IN" → { code, path } (or undefined). Case does not matter. */
export const getPageByCode = (code) => byCode[String(code || "").trim().toUpperCase()];

/** "/resource-management/procurement/indent" → "IN" (or undefined). */
const byPath = Object.fromEntries(PAGE_CODES.map((p) => [p.path, p.code]));
export const getCodeForPath = (path) => byPath[path];

/**
 * T-code → { path, isNew }.
 *   IN01 (or just IN) = list page, IN02 = new entry.
 * Returns null when the code is not known.
 */
export function parseTcode(input) {
  const m = /^([a-z]{2})(0[12])?$/i.exec(String(input || "").trim());
  if (!m) return null;
  const page = getPageByCode(m[1]);
  if (!page) return null;
  const isNew = m[2] === "02";
  if (isNew && !page.create) return null; // this page has no "new" screen
  return { code: page.code, path: isNew ? `${page.path}/new` : page.path, listPath: page.path, isNew };
}

// T-code → path map (lower-case keys), kept for the places that read it directly.
export const tcodeConfig = Object.fromEntries(
  PAGE_CODES.flatMap((p) => [
    [`${p.code.toLowerCase()}01`, p.path],
    [p.code.toLowerCase(), p.path],
  ]),
);
