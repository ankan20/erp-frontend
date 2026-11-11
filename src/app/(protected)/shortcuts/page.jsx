"use client";

// Keyboard Shortcuts guide.
// Everything on this page is built from config/shortcuts.config.js and
// config/tcode.config.js, so it always matches what the keys really do.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { getPageActions } from "@/components/common/PageActionButtons";
import Kbd from "@/components/shortcuts/Kbd";
import { useShortcuts } from "@/components/shortcuts/ShortcutProvider";
import { SHORTCUT_GROUPS, SHORTCUTS, DOC_PREFIXES, MASTER_PREFIXES } from "@/config/shortcuts.config";
import { getShortcutPages } from "@/lib/shortcuts";

const SECTIONS = [
  ["start", "Start here"],
  ["all", "All shortcuts"],
  ["codes", "Page codes"],
  ["search", "Search box"],
  ["deep", "Deep search (360 view)"],
  ["examples", "Step-by-step examples"],
  ["notes", "Good to know"],
];

// Worked examples: every step is one key press.
const EXAMPLES = [
  {
    title: "Create an Indent and submit it — without the mouse",
    steps: [
      [["N"], "then", ["I"], ["N"], "The new Indent form opens (N = new, IN = Indent)."],
      [["Tab"], "Move from field to field and fill the form."],
      [["Ctrl+S"], "“Save Draft?” appears."],
      [["Ctrl+Enter"], "Draft is saved. The Indent now has a number."],
      [["Ctrl+Enter"], "“Submit Indent?” appears."],
      [["Ctrl+Enter"], "Indent is submitted for approval."],
    ],
  },
  {
    title: "Approve a record that is waiting for you",
    steps: [
      [["Ctrl+K"], "Search box opens. Type the document number, e.g. PO-0042, and press Enter."],
      [["Alt+A"], "Approval pop-up opens with Approve already selected."],
      [["1"], "Picks the first ready-made comment (“Verified and approved”)."],
      [["Ctrl+Enter"], "The pop-up asks you to confirm."],
      [["Ctrl+Enter"], "Approved."],
    ],
    note: "Use Alt+B to send back (Reback) or Alt+X to reject. The steps after that are the same.",
  },
  {
    title: "Check what you owe a vendor and open his last bill",
    steps: [
      [["Ctrl+K"], "Search box opens. Type /v sharma"],
      [["Enter"], "The 360 view of Sharma Traders opens."],
      [["1"], "Ledger tab: total billed, total paid and the balance."],
      [["→"], "Next tab. Keep pressing until Purchase Bills (or press its number)."],
      [["↓"], "First (newest) bill is highlighted."],
      [["Enter"], "That purchase bill opens. Alt+← returns to the vendor."],
    ],
  },
  {
    title: "Find a record in a list and open it",
    steps: [
      [["G"], "then", ["G"], ["R"], "GRN list opens (G = go, GR = GRN)."],
      [["/"], "Cursor jumps to the Contain Search box. Type “cement” and press Enter."],
      [["↓"], "First row is highlighted. Press ↓ again to move down."],
      [["Enter"], "The highlighted GRN opens."],
      [["Alt+L"], "Back to the GRN list."],
    ],
  },
  {
    title: "Edit a draft and save it again",
    steps: [
      [["F2"], "Fields become editable."],
      [["Tab"], "Go to the field and change it."],
      [["Ctrl+S"], "“Save Draft?” appears."],
      [["Ctrl+Enter"], "Saved."],
    ],
  },
  {
    title: "Jump with a T-code",
    steps: [
      [["Ctrl+/"], "Cursor jumps to the T. Code box at the top."],
      [["S"], ["L"], ["0"], ["2"], "Type SL02 and press Enter → new Sale Bill. (SL01 = Sale Bill list.)"],
    ],
  },
];

export default function ShortcutsGuidePage() {
  const router = useRouter();
  const { openPalette, openHelp } = useShortcuts();
  const actions = getPageActions({ router });
  // only the pages this user may open
  const pages = useMemo(() => getShortcutPages().filter((p) => p.code), []);
  const [filter, setFilter] = useState("");

  const visiblePages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => `${p.code} ${p.title} ${p.trail}`.toLowerCase().includes(q));
  }, [pages, filter]);

  return (
    <HeaderWrapper header={<PageHeader actions={actions} />}>
      <div>
        <div className="mx-auto max-w-[1100px] p-4 text-[13px] leading-relaxed text-gray-800">
          <h1 className="text-[20px] font-semibold text-[#144664]">Keyboard Shortcuts</h1>
          <p className="mt-1 text-gray-600">
            Work faster without the mouse. Every shortcut presses a button you can already see on the screen, so your
            permissions and all confirmation pop-ups stay exactly the same.
          </p>

          {/* jump links */}
          <nav className="mt-3 flex flex-wrap gap-2">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-sm border border-[#b5c7d8] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#144664] hover:bg-[#f0f6ff]"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* ── START HERE ─────────────────────────────────────────────── */}
          <Section id="start" title="Start here — three things to remember">
            <div className="grid gap-3 md:grid-cols-3">
              <Card
                keys={["Ctrl+K"]}
                title="Search box"
                text="Find any page, start a new entry, or find a document by its number."
                action={{ label: "Try it", onClick: openPalette }}
              />
              <Card
                keys={["G", "N"]}
                title="G / N + page code"
                text="G then I N opens the Indent list. N then I N opens a new Indent. Codes are in the table below."
              />
              <Card
                keys={["?"]}
                title="Forgot a key?"
                text="Press ? (Shift + /) on any page to see the quick list. Hold the mouse on a button to see its key."
                action={{ label: "Show quick list", onClick: openHelp }}
              />
            </div>
            <div className="mt-3 rounded-md border border-[#d8e1ea] bg-[#f6f8fa] px-3 py-2">
              <p className="font-semibold text-[#144664]">How to read the keys</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>
                  <Kbd combo="Ctrl+S" /> — hold <b>Ctrl</b>, press <b>S</b>, release both.
                </li>
                <li>
                  <Kbd combo="G" /> then <Kbd combo="I" /> <Kbd combo="N" /> — press the keys one after another, do
                  not hold them.
                </li>
                <li>
                  Single-letter keys (<Kbd combo="G" />, <Kbd combo="N" />, <Kbd combo="/" />, <Kbd combo="?" />) work
                  only when the cursor is <b>not</b> inside a text box. Click an empty area or press{" "}
                  <Kbd combo="Esc" /> first.
                </li>
                <li>
                  Keys with <b>Ctrl</b>, <b>Alt</b> or <b>F2</b> work everywhere, also while you are typing.
                </li>
              </ul>
            </div>
          </Section>

          {/* ── ALL SHORTCUTS ──────────────────────────────────────────── */}
          <Section id="all" title="All shortcuts">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.id} className="mb-4">
                <h3 className="text-[14px] font-semibold text-[#144664]">{group.title}</h3>
                <p className="mb-1 text-[12px] text-gray-500">{group.note}</p>
                <div className="overflow-x-auto border border-[#9e9e9e]">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead className="bg-[#144664] text-left text-[12px] text-white">
                      <tr>
                        <th className="w-[150px] px-2 py-1 font-semibold">Key</th>
                        <th className="w-[190px] px-2 py-1 font-semibold">Action</th>
                        <th className="px-2 py-1 font-semibold">What it does</th>
                        <th className="w-[300px] px-2 py-1 font-semibold">Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SHORTCUTS.filter((s) => s.group === group.id).map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                          <td className="border border-[#e6e4e4] px-2 py-1.5 align-top">
                            <span className="flex flex-wrap items-center gap-1">
                              {(s.keyLabels || s.keys).map((k, n) => (
                                <span key={k} className="flex items-center gap-1">
                                  {n > 0 && <span className="text-[11px] text-gray-400">or</span>}
                                  <Kbd combo={k} />
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="border border-[#e6e4e4] px-2 py-1.5 align-top font-medium">{s.label}</td>
                          <td className="border border-[#e6e4e4] px-2 py-1.5 align-top">{s.description}</td>
                          <td className="border border-[#e6e4e4] px-2 py-1.5 align-top text-gray-600">{s.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Section>

          {/* ── PAGE CODES ─────────────────────────────────────────────── */}
          <Section id="codes" title="Page codes">
            <p>
              Every page has a two-letter code. Use it three ways — the table shows only the pages you have access to.
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <Kbd combo="G" /> + code → open the list. <Kbd combo="N" /> + code → new entry.
              </li>
              <li>
                T-code box or search box: code + <b>01</b> = list, code + <b>02</b> = new entry (for example{" "}
                <b>IN01</b>, <b>IN02</b>).
              </li>
            </ul>

            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-sm border border-[#5aafc2] bg-[#7fc3d4] px-3 py-0.5 text-[13px]">Find a page</div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="e.g. indent, GRN, sale"
                className="h-6.5 w-65 rounded-sm border border-[#8f8f8f] px-2 text-sm outline-none"
                aria-label="Find a page code"
              />
            </div>

            <div className="mt-2 overflow-x-auto border border-[#9e9e9e]">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-[#144664] text-left text-[12px] text-white">
                  <tr>
                    <th className="w-[70px] px-2 py-1 font-semibold">Code</th>
                    <th className="px-2 py-1 font-semibold">Page</th>
                    <th className="w-[130px] px-2 py-1 font-semibold">Go to list</th>
                    <th className="w-[130px] px-2 py-1 font-semibold">New entry</th>
                    <th className="w-[150px] px-2 py-1 font-semibold">T-code</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePages.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border border-[#e6e4e4] py-4 text-center text-gray-400">
                        No page found
                      </td>
                    </tr>
                  )}
                  {visiblePages.map((p, i) => (
                    <tr key={p.path} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                      <td className="border border-[#e6e4e4] px-2 py-1 font-mono font-bold text-[#b03030]">{p.code}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1">
                        <button
                          type="button"
                          onClick={() => router.push(p.path)}
                          className="cursor-pointer text-left text-blue-600 hover:underline"
                        >
                          {p.title}
                        </button>
                        {p.trail && <span className="ml-2 text-[11.5px] text-gray-500">{p.trail}</span>}
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1">
                        <KeySeq keys={["G", p.code[0], p.code[1]]} />
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1">
                        {p.newPath ? <KeySeq keys={["N", p.code[0], p.code[1]]} /> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="border border-[#e6e4e4] px-2 py-1 font-mono text-[12px]">
                        {p.code}01{p.newPath ? ` / ${p.code}02` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── SEARCH BOX ─────────────────────────────────────────────── */}
          <Section id="search" title="Search box (Ctrl+K)">
            <p>
              One box for everything. Press <Kbd combo="Ctrl+K" />, type, move with <Kbd combo="↑" />{" "}
              <Kbd combo="↓" />, open with <Kbd combo="Enter" />, close with <Kbd combo="Esc" />.
            </p>
            <div className="mt-2 overflow-x-auto border border-[#9e9e9e]">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="bg-[#144664] text-left text-[12px] text-white">
                  <tr>
                    <th className="w-[200px] px-2 py-1 font-semibold">You type</th>
                    <th className="px-2 py-1 font-semibold">You get</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["indent", "Pages with “indent” in the name → Enter opens the Indent list."],
                    ["new indent", "“New Indent” → Enter opens the create form. “create” and “add” work the same."],
                    ["IN01  or  IN02", "T-code: Indent list / new Indent."],
                    ["sharma", "Vendors / ledgers and items with that name, plus documents whose number contains it."],
                    ["/v sharma", "Only vendors / ledgers → Enter opens the 360 view (see Deep search below)."],
                    ["/i cement", "Only items → Enter opens the item 360 view."],
                    ["PO-0042", "Every document whose number contains PO-0042 — orders, GRNs, bills… that you may see."],
                    ["/o PO-0042", "Only Material Orders with that number. See the type codes below."],
                    ["/", "Shows the list of all search codes."],
                  ].map(([typed, result], i) => (
                    <tr key={typed} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 font-mono text-[12.5px] text-[#144664]">{typed}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1.5">{result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-3 text-[14px] font-semibold text-[#144664]">Search codes</h3>
            <p className="text-[12px] text-gray-500">
              Type <b>/</b>, the code, a space, then at least 2 characters. The first {MASTER_PREFIXES.length} open a
              360 view; the rest find a document by its number.
            </p>
            <div className="mt-1 grid grid-cols-1 gap-x-6 rounded-md border border-[#d8e1ea] bg-white px-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...MASTER_PREFIXES, ...DOC_PREFIXES].map((p) => (
                <div key={p.prefix} className="flex items-center gap-2 py-[2px]">
                  <span className="w-10 shrink-0 font-mono font-bold text-[#b03030]">/{p.prefix}</span>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-gray-500">
              Documents are searched by their number. You only see documents of your projects and of the modules you
              have permission for.
            </p>
          </Section>

          {/* ── DEEP SEARCH ────────────────────────────────────────────── */}
          <Section id="deep" title="Deep search — the 360 view">
            <p>
              Find a vendor, ledger, item, asset, project, bank / cash account, cost centre or employee once, and see
              everything about it on one page: its details and one tab for each kind of document.
            </p>
            <div className="mt-3 overflow-x-auto border border-[#9e9e9e]">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-[#144664] text-left text-[12px] text-white">
                  <tr>
                    <th className="w-[70px] px-2 py-1 font-semibold">Code</th>
                    <th className="w-[170px] px-2 py-1 font-semibold">Finds</th>
                    <th className="w-[230px] px-2 py-1 font-semibold">Search by</th>
                    <th className="px-2 py-1 font-semibold">Tabs in the 360 view</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["/v  /l", "Vendor / Ledger", "name, ledger code, GSTIN, PAN, phone", "Ledger, Material Order, Service Order, GRN, SRN, GIN, Delivery Challan, BRR, BRB, Purchase Bill, Debit Note, Credit Note, Bill Payment, Payment Voucher, Journal Entry, Sale Order"],
                    ["/i", "Item", "name, item code, HSN", "Indent, Material Order, Service Order, GRN, SRN, GIN, Delivery Challan — with quantity and rate"],
                    ["/a", "Asset", "asset name, asset code", "Indent, Material Order, GRN, GIN, Delivery Challan — with quantity and rate"],
                    ["/p", "Project", "project name, code, client", "Every kind of document of that project: indents, orders, receipts, bills, payments, sales, journals, petty cash…"],
                    ["/b", "Bank / Cash account", "bank name, holder, code, account number", "Bill Payment, Payment Voucher, Sale Receipt, Sales Invoice, Contra Entry, Petty Cash Voucher"],
                    ["/cc", "Cost Centre", "cost centre name, code", "Purchase Bill, Sales Invoice, Debit Note, Credit Note, Journal Entry — with the amount booked on it"],
                    ["/e", "Employee", "name, employee code, mobile, department", "Payroll, Performance Reviews, Discipline Cases, Onboarding Tasks"],
                  ].map(([code, finds, by, tabs], i) => (
                    <tr key={code} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 align-top font-mono font-bold text-[#b03030]">{code}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 align-top font-medium">{finds}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 align-top text-gray-600">{by}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 align-top">{tabs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 overflow-x-auto border border-[#9e9e9e]">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="bg-[#144664] text-left text-[12px] text-white">
                  <tr>
                    <th className="w-[240px] px-2 py-1 font-semibold">You type in the search box</th>
                    <th className="px-2 py-1 font-semibold">What opens</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["/v sharma", "List of vendors named Sharma → Enter opens the 360 view of the highlighted one."],
                    ["/v 19ABCDE1234F1Z5", "The vendor with that GSTIN."],
                    ["/v sharma > ledger", "The same vendor, directly on the Ledger tab."],
                    ["/v sharma > bills", "Directly on Purchase Bills. Also: > orders, > grn, > payments, > debit note."],
                    ["/l sharma", "Same as /v — a vendor is a ledger."],
                    ["/i cement", "List of items with “cement” → Enter opens the item 360 view."],
                    ["/i cement > orders", "The item, directly on Material Orders (rate history)."],
                    ["/a mixer", "An asset → its indents, orders, GRN and issues."],
                    ["/p tower", "A project you are assigned to → all its documents, one tab per kind."],
                    ["/p tower > purchase bill", "The project, directly on Purchase Bills."],
                    ["/b hdfc", "A bank or cash account → payments, receipts and contra entries through it."],
                    ["/cc site expenses", "A cost centre → bills, notes and journals booked on it, with the amount."],
                    ["/e anita > payroll", "An employee, directly on Payroll (needs HR permission)."],
                  ].map(([typed, result], i) => (
                    <tr key={typed} className={i % 2 === 0 ? "bg-[#f2f2f2]" : "bg-white"}>
                      <td className="border border-[#e6e4e4] px-2 py-1.5 font-mono text-[12.5px] text-[#144664]">{typed}</td>
                      <td className="border border-[#e6e4e4] px-2 py-1.5">{result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-md border border-[#d8e1ea] bg-[#f6f8fa] px-3 py-2">
              <p className="font-semibold text-[#144664]">Inside the 360 view</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>
                  <Kbd combo="←" /> <Kbd combo="→" /> or the tab number (<Kbd combo="1 – 9" />) change the tab.
                </li>
                <li>
                  <Kbd combo="↑" /> <Kbd combo="↓" /> move in the table, <Kbd combo="Enter" /> opens the document,{" "}
                  <Kbd combo="Alt+←" /> comes back.
                </li>
                <li>
                  <b>Permissions:</b> you get a tab only if you have permission for that page, and inside it only the
                  documents of your projects. A tab you may not see is not shown at all. You can find only the
                  projects you are assigned to. Employees need the Employee Master permission, and each employee tab
                  needs its own (Payroll, Performance Appraisal, Onboarding). Vendor bank details and full bank
                  account numbers are shown only to Admin.
                </li>
                <li>The number on each tab is how many documents you can see there.</li>
              </ul>
            </div>
          </Section>

          {/* ── EXAMPLES ───────────────────────────────────────────────── */}
          <Section id="examples" title="Step-by-step examples">
            <div className="grid gap-3 lg:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <div key={ex.title} className="rounded-md border border-[#d8e1ea] bg-white p-3">
                  <h3 className="mb-2 text-[13.5px] font-semibold text-[#144664]">{ex.title}</h3>
                  <ol className="space-y-1.5">
                    {ex.steps.map((step, i) => {
                      const text = step[step.length - 1];
                      const parts = step.slice(0, -1);
                      return (
                        <li key={i} className="flex gap-2">
                          <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#144664] text-[10.5px] font-bold text-white">
                            {i + 1}
                          </span>
                          <span>
                            <span className="mr-1.5 inline-flex flex-wrap items-center gap-1 align-middle">
                              {parts.map((part, n) =>
                                Array.isArray(part) ? (
                                  <Kbd key={n} combo={part[0]} />
                                ) : (
                                  <span key={n} className="text-[11.5px] text-gray-500">{part}</span>
                                ),
                              )}
                            </span>
                            {text}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {ex.note && <p className="mt-2 text-[12px] text-gray-500">{ex.note}</p>}
                </div>
              ))}
            </div>
          </Section>

          {/* ── GOOD TO KNOW ───────────────────────────────────────────── */}
          <Section id="notes" title="Good to know">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>A shortcut never skips a check.</b> It presses the same button as the mouse. If the button is greyed
                out or you do not have permission, the shortcut does nothing and a small message tells you so.
              </li>
              <li>
                <b>Nothing is submitted, approved or deleted with one key.</b> The confirmation pop-up always opens
                first; <Kbd combo="Ctrl+Enter" /> confirms, <Kbd combo="Esc" /> cancels.
              </li>
              <li>
                <b>
                  <Kbd combo="Ctrl+S" /> never opens the browser “Save page” window
                </b>{" "}
                inside the ERP. On a page with nothing to save it simply does nothing.
              </li>
              <li>
                <b>Keys the browser keeps for itself</b> cannot be used by any website: <Kbd combo="Ctrl+N" /> (new
                window), <Kbd combo="Ctrl+T" /> (new tab), <Kbd combo="Ctrl+W" /> (close tab). That is why “new entry”
                is <Kbd combo="Alt+N" /> and <Kbd combo="N" /> + code.
              </li>
              <li>
                <b>Split windows:</b> shortcuts work in the window you last clicked in.
              </li>
              <li>
                <b>Mac:</b> use <b>Cmd</b> in place of Ctrl and <b>Option</b> in place of Alt.
              </li>
            </ul>
          </Section>
        </div>
      </div>
    </HeaderWrapper>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="mt-6 scroll-mt-2">
      <h2 className="mb-2 border-b-2 border-[#144664] pb-1 text-[16px] font-semibold text-[#144664]">{title}</h2>
      {children}
    </section>
  );
}

function Card({ keys, title, text, action }) {
  return (
    <div className="flex flex-col rounded-md border border-[#d8e1ea] bg-white p-3">
      <div className="flex items-center gap-1.5">
        {keys.map((k) => (
          <Kbd key={k} combo={k} />
        ))}
        <span className="ml-1 font-semibold text-[#144664]">{title}</span>
      </div>
      <p className="mt-1.5 flex-1 text-gray-700">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 w-fit cursor-pointer rounded-sm border border-[#4d8ea3] bg-[#7fc3d4] px-3 py-0.5 text-[12.5px] font-medium text-black hover:bg-[#6bb3c6]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function KeySeq({ keys }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Kbd combo={keys[0]} />
      <span className="text-[11px] text-gray-400">then</span>
      <Kbd combo={keys[1]} />
      <Kbd combo={keys[2]} />
    </span>
  );
}
