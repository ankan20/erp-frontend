// One place that knows each workflow module's name and detail page.
// Keys are the backend workflow module codes (MODULE_MAP in workflow/service.py).
// To support a new module: add it here and to APPROVAL_PING_MODULES in the
// backend's approval_ping_service.py.
//
//   getRecordRoute("order", 12)                  → "/resource-management/procurement/order/material-order/12"
//   detectModuleFromPath("/logistics/delivery-challan/4") → "delivery_challan"
//   moduleLabel("goods_received_note")           → "GRN"

export const MODULES = {
  indent:                { label: "Indent",                 base: "/resource-management/procurement/indent" },
  order:                 { label: "Material Order",         base: "/resource-management/procurement/order/material-order" },
  pw_order:              { label: "Service Order",          base: "/resource-management/procurement/order/service-order" },
  goods_received_note:   { label: "GRN",                    base: "/resource-management/material/grn" },
  goods_issue_note:      { label: "GIN",                    base: "/resource-management/material/gin" },
  service_received_note: { label: "SRN",                    base: "/resource-management/services/srn" },
  delivery_challan:      { label: "Delivery Challan",       base: "/logistics/delivery-challan" },
  concrete_registry:     { label: "Concrete Register",      base: "/project-management/register/concrete" },
  drawing_register:      { label: "Drawing Register",       base: "/project-management/register/drawing" },
  bill_receive_register: { label: "Bill Receive Register",  base: "/resource-management/sub-contractor-billing/bill-receive-register" },
  log_sheet:             { label: "Log Sheet",              base: "/resource-management/services/plant-machinery/log-sheet/log-book" },
};

export const MODULE_OPTIONS = Object.entries(MODULES).map(([value, m]) => ({ value, label: m.label }));

export const moduleLabel = (code) => MODULES[code]?.label || code || "";

export const getRecordRoute = (code, id) => {
  const m = MODULES[code];
  return m && id != null ? `${m.base}/${id}` : null;
};

// Longest matching base wins, so ".../order/service-order" isn't mistaken for ".../order"
export function detectModuleFromPath(pathname = "") {
  let best = null;
  for (const [code, m] of Object.entries(MODULES)) {
    if ((pathname === m.base || pathname.startsWith(`${m.base}/`)) && (!best || m.base.length > MODULES[best].base.length)) {
      best = code;
    }
  }
  return best;
}
