// Keyboard shortcuts — the single list of every shortcut in the ERP.
//
// The shortcut engine (components/shortcuts/ShortcutProvider.jsx), the quick
// help sheet and the guide page (/shortcuts) all read this file, so a key
// changed here changes everywhere.
//
// keys     : one or more key combinations. "Ctrl" also means "Cmd" on a Mac.
// target   : the `data-shortcut` name(s) of the button this shortcut presses,
//            first one found wins. The button's own disabled state and
//            confirmation dialog are respected — a shortcut never does more
//            than a mouse click on that button would.
// typing   : false = ignored while the cursor is inside a text box.
// nearest  : true = when the page has several such buttons, press the one in
//            the section the cursor is in, and leave the cursor where it is.
// example  : shown on the guide page.

export const SHORTCUT_GROUPS = [
  { id: "global", title: "Everywhere", note: "Work on every page." },
  { id: "list", title: "List pages", note: "Pages that show a table of records (Indent list, Order list…)." },
  { id: "form", title: "Create / edit forms", note: "While filling a new entry or editing a draft." },
  { id: "record", title: "Opened record", note: "While viewing a saved record (detail page)." },
  { id: "approval", title: "Approval", note: "On a record that is waiting for your approval." },
  { id: "dialog", title: "Pop-ups and confirmations", note: "Whenever a pop-up window is open." },
  {
    id: "deep",
    title: "360 view (vendor / ledger / item)",
    note: "The page that opens from “/v name” or “/i name” in the search box.",
  },
];

export const SHORTCUTS = [
  // ── Everywhere ────────────────────────────────────────────────────────────
  {
    id: "palette",
    group: "global",
    keys: ["Ctrl+K"],
    label: "Search / command box",
    description:
      "Opens one box to find a page, start a new entry, a vendor / ledger, an item, or a document by its number.",
    example: "Press Ctrl+K, type “indent”, press Enter → Indent list opens. Type “new indent” → new Indent form.",
  },
  {
    id: "go",
    group: "global",
    keys: ["G"],
    typing: false,
    label: "Go to a page (G + page code)",
    description: "Press G, then the two-letter page code. A small hint box shows the codes while you type.",
    example: "G then I N → Indent list.  G then G R → GRN list.  G then S L → Sale bills.",
  },
  {
    id: "new",
    group: "global",
    keys: ["N"],
    typing: false,
    label: "New entry (N + page code)",
    description: "Press N, then the two-letter page code, to open the create form of that page.",
    example: "N then I N → new Indent.  N then P R → new Material Order.  N then J E → new Journal.",
  },
  {
    id: "tcode",
    group: "global",
    keys: ["Ctrl+/"],
    label: "Jump to the T-code box",
    description: "Puts the cursor in the T. Code box at the top. Type a code and press Enter.",
    example: "Ctrl+/ then type IN01 and Enter → Indent list.  IN02 → new Indent.",
  },
  {
    id: "help",
    group: "global",
    keys: ["?", "F1"],
    label: "Show shortcut help",
    description: "Opens the quick list of shortcuts. The full guide is on the Keyboard Shortcuts page.",
    example: "Press ? (Shift + /) when the cursor is not in a text box, or F1 anywhere.",
  },
  {
    id: "sidebar",
    group: "global",
    keys: ["Alt+M"],
    target: ["sidebar"],
    label: "Open / close the side menu",
    description: "Expands or collapses the left menu.",
    example: "Alt+M → menu opens. Alt+M again → menu closes.",
  },

  // ── List pages ────────────────────────────────────────────────────────────
  {
    id: "create",
    group: "list",
    keys: ["Alt+N"],
    target: ["create"],
    label: "Create new",
    description: "Presses the Create / New button of the list you are on.",
    example: "On the Indent list press Alt+N → new Indent form opens.",
  },
  {
    id: "search",
    group: "list",
    keys: ["/"],
    typing: false,
    label: "Search in this list",
    description: "Puts the cursor in the “Contain Search” box. Type and press Enter to filter.",
    example: "Press /, type “cement”, press Enter → only rows containing cement stay.",
  },
  {
    id: "rows",
    group: "list",
    keys: ["↑", "↓", "Enter"],
    display: true,
    label: "Move in the table and open a row",
    description: "Arrow keys move the highlighted row. Enter opens the highlighted record.",
    example: "Press ↓ three times, then Enter → the third record opens.",
  },

  // ── Forms ─────────────────────────────────────────────────────────────────
  {
    id: "save",
    group: "form",
    keys: ["Ctrl+S"],
    target: ["draft", "save"],
    label: "Save as draft / Save",
    description: "Presses Save as Draft. On forms without a draft (masters) it presses Save.",
    example: "Fill the Indent form, press Ctrl+S → “Save Draft?” appears, press Ctrl+Enter to confirm.",
  },
  {
    id: "submit",
    group: "form",
    keys: ["Ctrl+Enter"],
    target: ["confirm", "submit", "save", "primary"],
    label: "Submit / confirm",
    description:
      "Presses Submit on the form. If a confirmation pop-up is open, it presses its Continue / Confirm button instead.",
    example: "Open a draft Indent, press Ctrl+Enter → “Submit Indent?” appears, press Ctrl+Enter again → submitted.",
  },
  {
    id: "edit",
    group: "form",
    keys: ["F2"],
    target: ["edit"],
    label: "Edit / cancel edit",
    description: "Presses the Edit button. Press again to cancel editing.",
    example: "Open a draft, press F2 → fields become editable.",
  },

  {
    id: "addRow",
    group: "form",
    keys: ["Alt+I"],
    target: ["add-row"],
    nearest: true,
    label: "Add a row (line item)",
    description:
      "Presses Add Row of the item table you are working in. The cursor stays where it is; press Tab to reach the new row.",
    example: "While filling Indent items press Alt+I → a new empty row is added.",
  },

  // ── Opened record ─────────────────────────────────────────────────────────
  {
    id: "delete",
    group: "record",
    keys: ["Alt+Delete"],
    target: ["delete"],
    label: "Delete / delete request",
    description: "Presses the Delete button. Nothing is deleted until you confirm in the pop-up.",
    example: "Open an Indent, press Alt+Delete → the delete pop-up opens.",
  },
  {
    id: "history",
    group: "record",
    keys: ["Alt+H"],
    target: ["history"],
    label: "View history",
    description: "Opens the approval history / timeline of the record.",
    example: "Open an Order, press Alt+H → history panel opens. Esc closes it.",
  },
  {
    id: "print",
    group: "record",
    keys: ["Ctrl+P"],
    target: ["print"],
    passThrough: true,
    label: "Print",
    description: "Presses the Print button of the record. On pages without it, the browser print opens.",
    example: "Open a Sale Bill, press Ctrl+P → the bill print view opens.",
  },
  {
    id: "download",
    group: "record",
    keys: ["Ctrl+Shift+S"],
    target: ["download"],
    label: "Download",
    description: "Presses the Download button of the record.",
    example: "Open a GRN, press Ctrl+Shift+S → the file downloads.",
  },
  {
    id: "copy",
    group: "record",
    keys: ["Alt+C"],
    target: ["copy", "copy-from"],
    label: "Copy record / copy from",
    description:
      "On a saved record: opens a new entry filled with the same details. On a new form: opens “Copy from…” to pick an earlier record.",
    example: "Open an old Indent, press Alt+C → new Indent with the same items.",
  },
  {
    id: "list",
    group: "record",
    keys: ["Alt+L"],
    target: ["home"],
    label: "Go to the list",
    description: "Goes back to the list page of the current module.",
    example: "Inside an Indent press Alt+L → Indent list.",
  },
  {
    id: "back",
    group: "record",
    keys: ["Alt+ArrowLeft"],
    keyLabels: ["Alt+←"],
    typing: false,
    target: ["back"],
    passThrough: true,
    label: "Go back",
    description: "Goes to the page you came from.",
    example: "Opened a GRN from an Order? Alt+← takes you back to that Order.",
  },

  // ── Approval ──────────────────────────────────────────────────────────────
  {
    id: "approve",
    group: "approval",
    keys: ["Alt+A"],
    approval: "approve",
    label: "Approve",
    description: "Opens the approval pop-up with Approve selected. Nothing is approved until you confirm.",
    example: "Alt+A → press 1 to pick the first comment → Ctrl+Enter → Ctrl+Enter again to confirm.",
  },
  {
    id: "reback",
    group: "approval",
    keys: ["Alt+B"],
    approval: "reback",
    label: "Reback (send back)",
    description: "Opens the approval pop-up with Reback selected.",
    example: "Alt+B → press 2 (“Requires clarification”) → Ctrl+Enter → Ctrl+Enter.",
  },
  {
    id: "reject",
    group: "approval",
    keys: ["Alt+X"],
    approval: "reject",
    label: "Reject",
    description: "Opens the approval pop-up with Reject selected.",
    example: "Alt+X → press 1 → Ctrl+Enter → Ctrl+Enter.",
  },
  {
    id: "option",
    group: "approval",
    keys: ["1 – 9"],
    display: true,
    label: "Pick a ready-made comment",
    description: "In the approval pop-up, number keys choose a comment from the list. The last number is “Other” (type your own).",
    example: "After Alt+A press 1 → “Verified and approved” is selected.",
  },

  // ── Pop-ups ───────────────────────────────────────────────────────────────
  {
    id: "confirm",
    group: "dialog",
    keys: ["Ctrl+Enter"],
    display: true,
    label: "Confirm / Continue",
    description: "Presses the main button of the pop-up (Continue, Confirm, Save).",
    example: "“Save Draft?” pop-up → Ctrl+Enter = Continue.",
  },
  {
    id: "close",
    group: "dialog",
    keys: ["Esc"],
    display: true,
    label: "Close / cancel",
    description: "Closes the pop-up without doing anything.",
    example: "Opened the delete pop-up by mistake? Press Esc.",
  },

  // ── 360 view ──────────────────────────────────────────────────────────────
  {
    id: "deepOpen",
    group: "deep",
    keys: ["Ctrl+K"],
    display: true,
    label: "Find a vendor, ledger or item",
    description: "In the search box type /v and a name (vendor / ledger) or /i and a name (item), then Enter.",
    example: "Ctrl+K → “/v sharma” → Enter → everything about Sharma Traders.",
  },
  {
    id: "deepTabs",
    group: "deep",
    keys: ["←", "→"],
    display: true,
    label: "Previous / next tab",
    description: "Moves between Ledger, Orders, GRN, Bills, Payments…",
    example: "Press → twice to go from Ledger to GRN.",
  },
  {
    id: "deepTabNumber",
    group: "deep",
    keys: ["1 – 9"],
    display: true,
    label: "Jump to a tab by its number",
    description: "Each tab shows a small number. Press that number.",
    example: "Press 1 → Ledger.",
  },
  {
    id: "deepRows",
    group: "deep",
    keys: ["↑", "↓", "Enter"],
    display: true,
    label: "Move in the table and open a document",
    description: "Arrow keys move the highlighted row. Enter opens that document.",
    example: "↓ ↓ Enter → the second order of this vendor opens. Alt+← brings you back.",
  },
];

// Shortcut text shown in button tooltips, e.g. shortcutHint("save") → "Ctrl+S"
export const shortcutHint = (id) => {
  const s = SHORTCUTS.find((x) => x.id === id);
  if (!s) return "";
  return (s.keyLabels || s.keys)[0];
};

// Master search inside the command box: "/v sharma" finds vendors / ledgers,
// "/i cement" finds items. Enter opens the 360 view of that record.
// Add "> tab name" to land on a tab: "/v sharma > ledger".
export const MASTER_PREFIXES = [
  { prefix: "v", kind: "vendor", label: "Vendor / Ledger", hint: "name, code, GSTIN, PAN or phone" },
  { prefix: "l", kind: "vendor", label: "Ledger (same as /v)", hint: "name, code, GSTIN, PAN or phone" },
  { prefix: "i", kind: "item", label: "Item", hint: "name, item code or HSN" },
];

// Where the 360 view of a master record lives
export const deepSearchRoute = (kind, id, tab) =>
  `/deep-search/${kind}/${id}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;

// Document-number search inside the command box: "/o PO-12" searches only orders.
// `type` is the document type of the traceability search API.
export const DOC_PREFIXES = [
  { prefix: "n", type: "INDENT", label: "Indent" },
  { prefix: "o", type: "ORDER", label: "Material Order" },
  { prefix: "w", type: "PW_ORDER", label: "Service Order" },
  { prefix: "g", type: "GRN", label: "GRN" },
  { prefix: "gi", type: "GIN", label: "GIN" },
  { prefix: "s", type: "SRN", label: "SRN" },
  { prefix: "dc", type: "DC", label: "Delivery Challan" },
  { prefix: "br", type: "BRR", label: "Bill Receive Register" },
  { prefix: "pb", type: "PURCHASE_BILL", label: "Purchase Bill" },
  { prefix: "pv", type: "BILL_PAYMENT", label: "Bill Payment" },
  { prefix: "so", type: "OG_SALE_ORDER", label: "Sale Order" },
  { prefix: "cl", type: "CLAIM_BILL", label: "Sale Bill - Claim" },
  { prefix: "cf", type: "CERTIFIED_BILL", label: "Sale Bill - Certified" },
  { prefix: "sb", type: "SALE_BILL", label: "Sale Bill" },
  { prefix: "rc", type: "SALE_RECEIPT", label: "Sale Receipt" },
  { prefix: "ct", type: "CONTRA_ENTRY", label: "Contra Entry" },
  { prefix: "pc", type: "PETTY_CASH_VOUCHER", label: "Petty Cash Voucher" },
];
