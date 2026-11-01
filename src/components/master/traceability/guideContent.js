// Smart Guide content for Master > Traceability Workbench.
// HINTS  → hover tips for elements marked data-guide="key"
// TOUR   → order of the guided tour (missing elements are skipped)
// getNextStep(context, actions) → the "What to do next" advice

const STAGES = ["Find", "Trace", "Drill down"];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const HINTS = {
  // ── search bar ─────────────────────────────────────────────
  "search-type": (c) => ({
    title: "Document type",
    what: "Limits the search to one kind of document.",
    how: [
      "Keep “All documents” if you are not sure.",
      "Pick “Item (indent lines)” to search by item code or item name.",
      "Shortcut: type @ in the search box, e.g. @grn or @order.",
    ],
    next: c?.search?.type
      ? `Now searching only ${c.search.typeLabel}. Type a number in the search box.`
      : "Type a document number or item name in the search box.",
  }),
  "search-input": (c) => {
    const s = c?.search || {};
    if (s.picker) {
      return {
        title: "Choosing a type with @",
        what: "You typed @, so the list now shows document types.",
        how: ["Click a type, or keep typing its short name (e.g. @grn) and press space.", "Then type the number."],
        next: "Pick a type, then type the document number.",
      };
    }
    if (s.term) {
      return {
        title: "Search results",
        what: `Showing matches for “${s.term}”.`,
        how: ["Click a result to trace it.", "Or use ↑ ↓ to move and Enter to open.", "Esc closes the list."],
        next: "The full flow of the chosen document opens below.",
      };
    }
    return {
      title: "Search box",
      what: "Find any procurement document or an item.",
      how: [
        "Type a document number: Indent, Order, Service Order, GRN, SRN, GIN, DC, BRR, BRB, Purchase Bill or Payment.",
        "Or type an item code / item name.",
        "Click the box with nothing typed to see recent traces and suggestions.",
      ],
      next: "Pick a result from the list to start the trace.",
    };
  },
  project: (c) => ({
    title: "Project filter",
    what: "Shows only documents of one project in the search.",
    how: [
      c?.isGlobal ? "“All projects” searches everything." : "“All my projects” searches only projects you are assigned to.",
      "Choose a project to get fewer, more exact results.",
    ],
    next: "Search again – results now follow this project.",
  }),

  // ── first screen ───────────────────────────────────────────
  "intro-steps": {
    title: "How this page works",
    what: "Three steps: Find a document, see its Trace, then Drill down into any document.",
    next: "Start with the search box at the top.",
  },
  "intro-links": {
    title: "Link types",
    what: "Each line in the flow says how two documents are connected – item by item, document level, order level or through the BRR.",
    next: "You will see these labels in the “Link from parent” column.",
  },

  // ── after a trace is loaded ────────────────────────────────
  trail: {
    title: "Trail",
    what: "The documents you traced one after another.",
    how: ["Click any earlier step to go back to it."],
  },
  summary: (c) => ({
    title: "What is being traced",
    what: `The starting document${c?.start?.docNo ? `: ${c.start.docNo}` : ""}. Everything below is linked to it.`,
    next: "Look at the Document Flow and click any row for its details.",
  }),
  mode: (c) => ({
    title: "Lineage or Full Flow",
    what: "Two ways to see the trace.",
    how: [
      "Document Lineage: only where this document came from and what came out of it.",
      "Full Flow: also sibling branches, e.g. other indents on the same order.",
    ],
    next: c?.mode === "FULL" ? "Switch back to Lineage to focus on this document only." : "Try Full Flow to see the whole picture.",
  }),
  stages: {
    title: "Stages in this trace",
    what: "How many documents are in each stage: requisition, ordering, receipt, inventory, billing, accounts, payment.",
  },
  badges: (c) => ({
    title: "Problems found",
    what: `${c?.counts?.error ? plural(c.counts.error, "mismatch") : "No mismatches"} and ${
      c?.counts?.warning ? `${c.counts.warning} pending` : "nothing pending"
    } in this flow.`,
    next: "Open the Exceptions tab to see each one and jump to the document.",
  }),
  "copy-link": {
    title: "Copy link",
    what: "Copies a link to exactly this trace.",
    how: ["Paste it in chat or mail – the other person opens the same view (if they have access)."],
  },

  // ── tabs ───────────────────────────────────────────────────
  "tab-flow": {
    title: "Document Flow",
    what: "A tree of every document: indentation shows what came from what.",
    how: ["Click a row to see it on the right.", "Columns show link type, party, quantity and amount."],
  },
  "tab-map": {
    title: "Lifecycle Map",
    what: "The same documents placed in stage columns, left to right.",
    how: ["Good for seeing quickly which stages are done or missing.", "Click a card to select it."],
  },
  "tab-qty": {
    title: "Quantities",
    what: "Checks quantities across the chain: requested → ordered → received → issued → billed.",
    how: ["Look for “Not Yet Ordered” and “Pending Receipt” to find what is still open."],
  },
  "tab-fin": {
    title: "Financials",
    what: "Money side: bills received (BRR), reconciled (BRB), booked (Purchase Bill) and paid.",
    how: ["Click a document number to select it in the flow."],
  },
  "tab-exc": (c) => ({
    title: "Exceptions",
    what: "Mismatches and pending items the system found in this flow.",
    how: [
      c?.counts?.error || c?.counts?.warning
        ? `Now: ${plural(c.counts.error || 0, "mismatch")}, ${c.counts.warning || 0} pending.`
        : "Now: nothing to check.",
      "Click a document number to jump to it.",
    ],
  }),
  "tab-time": {
    title: "Timeline",
    what: "Every document in date order, oldest first.",
    how: ["Use it to see delays between steps."],
  },
  highlight: {
    title: "Highlight branch",
    what: "When on, only the selected document and its own chain are highlighted; others fade.",
    how: ["Turn off to see every document at full strength."],
  },
  "flow-tree": {
    title: "Document Flow tree",
    what: "Each row is one document. A child row came from the row above it.",
    how: ["Click a row to open its details on the right.", "A lock means you have no access to that document."],
    next: "Use “Open document” or “Trace from here” on the right.",
  },
  "lifecycle-map": {
    title: "Lifecycle Map",
    what: "Documents grouped by stage. Click any card to select it.",
  },
  "qty-panel": {
    title: "Quantity check",
    what: "Line-by-line quantities through the chain. Gaps show what is still pending.",
  },
  "fin-panel": {
    title: "Money check",
    what: "Bills, reconciliation, booking and payment for this flow.",
  },
  "exc-panel": {
    title: "Exception list",
    what: "Each problem with the document it belongs to. Click the number to select that document.",
  },
  "time-panel": {
    title: "Timeline",
    what: "All documents oldest first. Click a document number to select it.",
  },

  // ── inspector (right side) ─────────────────────────────────
  inspector: (c) => ({
    title: "Document details",
    what: c?.selected?.docNo
      ? `Details of ${c.selected.docNo}: summary, where it came from, what it led to, and its lines.`
      : "Details of the selected document.",
    next: c?.selected?.isStart ? "Click another row in the flow to inspect it." : "Use “Trace from here” to make this the new starting point.",
  }),
  "open-doc": {
    title: "Open document",
    what: "Opens this document in its own module in a new tab.",
    how: ["The trace stays open here."],
  },
  "trace-from": {
    title: "Trace from here",
    what: "Makes this document the new starting point of the trace.",
    how: ["The trail at the top lets you come back."],
  },
  "comes-from": { title: "Comes from", what: "Documents this one was created from. Click one to select it." },
  "leads-to": { title: "Leads to", what: "Documents created from this one. Click one to select it." },
  lines: {
    title: "Lines",
    what: "Item lines of this document with quantity, rate, GST and amount.",
    how: ["On indent lines use “Track item” to follow one item through every stage."],
  },
  "trace-item": {
    title: "Trace item flow",
    what: "Starts a new trace for just this indent line, so you see only this item's documents.",
  },
  "track-item": {
    title: "Track item",
    what: "Opens a pop-up that follows just this one item from indent to payment.",
  },
};

export const TOUR = [
  { target: "search-type", title: "1. Choose what to search" },
  { target: "search-input", title: "2. Type a number or item" },
  { target: "project", title: "3. Narrow to a project (optional)" },
  { target: "intro-steps", title: "How the page works" },
  { target: "summary", title: "What is being traced" },
  { target: "mode", title: "Lineage or Full Flow" },
  { target: "badges", title: "Problems found" },
  { target: "tab-flow", title: "The tabs" },
  { target: "flow-tree", title: "Click any document" },
  { target: "inspector", title: "Details on the right" },
  { target: "tab-exc", title: "Check exceptions" },
  { target: "copy-link", title: "Share this trace" },
];

/** The single most useful next action for the current page state. */
export function getNextStep(c, actions = {}) {
  if (!c) return null;
  const s = c.search || {};
  const counts = c.counts || {};
  const problemTips = [];
  if (c.hasFlow && (counts.error || counts.warning) && c.tab !== "exc") {
    problemTips.push({
      tone: counts.error ? "error" : "warn",
      text: `${counts.error ? plural(counts.error, "mismatch") : ""}${counts.error && counts.warning ? " and " : ""}${
        counts.warning ? `${counts.warning} pending` : ""
      } found in this flow.`,
      action: actions.setTab && { label: "Check", run: () => actions.setTab("exc") },
    });
  }

  if (c.ctxError) return { stages: STAGES, stage: 0, tone: "error", title: "Page could not load", body: "Reload the page. If it keeps failing, check your login or network." };
  if (!c.ready) return { stages: STAGES, stage: 0, title: "Loading…", body: "Getting your projects and document types." };
  if (c.noAccess)
    return { stages: STAGES, stage: 0, tone: "warn", title: "No project assigned", body: "You are not assigned to any project, so there is nothing to trace. Ask your admin to add you to a project." };

  // ── step 1: find ──
  if (!c.hasFlow && !c.loading) {
    if (c.error)
      return {
        stages: STAGES, stage: 0, tone: "error",
        title: "Trace failed",
        body: `${c.error} Click Retry, or search for another document.`,
        target: "search-input",
      };
    if (s.picker)
      return {
        stages: STAGES, stage: 0,
        title: "Pick a document type",
        body: "Click a type in the list, or finish its short name (e.g. @grn) and press space. Then type the number.",
        target: "search-input",
      };
    if (s.term && s.loading)
      return { stages: STAGES, stage: 0, title: "Searching…", body: `Looking for “${s.term}” in ${s.typeLabel || "all documents"}.` };
    if (s.term && s.results === 0 && s.recent === 0)
      return {
        stages: STAGES, stage: 0, tone: "warn",
        title: "No match found",
        body: "Check the number. Or set the type to “All documents” and the project to “All”, then try again.",
        target: s.type ? "search-type" : c.projectCode ? "project" : "search-input",
      };
    if (s.term)
      return {
        stages: STAGES, stage: 0,
        title: `Choose a result (${s.results + s.recent})`,
        body: "Click the document you want, or use ↑ ↓ and press Enter.",
        target: "search-input",
      };
    if (s.open)
      return {
        stages: STAGES, stage: 0,
        title: "Type a number or pick from the list",
        body: "Recent traces and suggestions are shown. Type a document number or item name to search.",
        target: "search-input",
      };
    return {
      stages: STAGES, stage: 0,
      title: "Find a document",
      body: "Click the search box and type a document number (e.g. GRN or Order no.) or an item code / name.",
      target: "search-input",
      action: actions.focusSearch && { label: "Start typing", run: actions.focusSearch },
      tips: [
        { text: "Not sure of the type? Keep “All documents”. Type @ to choose a type quickly.", target: "search-type" },
        c.projectCode ? { text: `Searching only project ${c.projectCode}.`, target: "project" } : { text: "Choose a project to get fewer results (optional).", target: "project" },
      ],
    };
  }

  if (c.loading) return { stages: STAGES, stage: 1, title: "Building the trace…", body: "Collecting every linked document. This takes a moment." };

  // ── step 2 / 3: trace + drill down ──
  const sel = c.selected || {};
  const tips = [...problemTips];

  if (c.tab === "qty")
    return { stages: STAGES, stage: 2, title: "Checking quantities", body: "Follow each line from requested to billed. “Not Yet Ordered” and “Pending Receipt” show what is still open.", target: "qty-panel", tips };
  if (c.tab === "fin")
    return { stages: STAGES, stage: 2, title: "Checking money", body: "See what was billed, reconciled, booked and paid. Click a document number to select it.", target: "fin-panel", tips };
  if (c.tab === "exc")
    return counts.error || counts.warning
      ? { stages: STAGES, stage: 2, tone: counts.error ? "error" : "warn", title: "Review each exception", body: "Read the problem, then click its document number to jump to that document and fix it in its module.", target: "exc-panel" }
      : { stages: STAGES, stage: 2, tone: "ok", title: "No exceptions", body: "Quantities and links look fine in this flow.", action: actions.setTab && { label: "Back to flow", run: () => actions.setTab("flow") } };
  if (c.tab === "time")
    return { stages: STAGES, stage: 2, title: "Reading the timeline", body: "Documents oldest first – look for long gaps between steps.", target: "time-panel", tips };

  if (sel.docNo && !sel.isStart) {
    if (sel.restricted)
      return { stages: STAGES, stage: 2, tone: "warn", title: `${sel.docNo} is restricted`, body: "You do not have access to this document's project or module. Only its place in the flow is shown.", target: "inspector", tips };
    return {
      stages: STAGES, stage: 2,
      title: `Inspecting ${sel.docNo}`,
      body: `See its ${sel.typeLabel || "document"} details on the right. “Open document” opens it in its module; “Trace from here” starts a new trace from it.`,
      target: "trace-from",
      tips: [
        ...tips,
        { text: "Click another row in the flow to compare.", target: c.tab === "map" ? "lifecycle-map" : "flow-tree" },
      ],
    };
  }

  // trace loaded, start document selected
  if (c.mode === "LINEAGE" && c.nodeCount <= 1)
    tips.push({ text: "Only one document here. Try Full Flow to include related branches.", action: actions.switchMode && { label: "Full Flow", run: () => actions.switchMode("FULL") } });
  else if (c.mode === "LINEAGE")
    tips.push({ text: "Want sibling branches too (other indents on the same order)? Switch to Full Flow.", target: "mode" });
  tips.push({ text: "Check quantities and money in the Quantities and Financials tabs.", target: "tab-qty" });

  return {
    stages: STAGES, stage: 1,
    title: `Trace of ${c.start?.docNo || "document"} is ready`,
    body: `${plural(c.nodeCount || 0, "document")} linked. Click any row in the ${c.tab === "map" ? "Lifecycle Map" : "Document Flow"} to see its details on the right.`,
    target: c.tab === "map" ? "lifecycle-map" : "flow-tree",
    tips,
  };
}
