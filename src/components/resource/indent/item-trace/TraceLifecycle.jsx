"use client";

import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  PackageMinus,
  Truck,
  Receipt,
  Landmark,
  Wallet,
} from "lucide-react";
import { AllocatedTag, EmptyNote, Field, StatusBadge, ViewDocLink } from "./TraceBits";
import { fmtAmt, fmtDate, fmtPercent, fmtQty, isRejected } from "./traceUtils";

// ── building blocks ───────────────────────────────────────────────────────────

function StageIcon({ icon: Icon, tone = "bg-[#144664]" }) {
  return (
    <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${tone}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

// One vertical step of the lifecycle with a connector line to the next.
function Step({ icon, tone, title, count, isLast, children }) {
  return (
    <div className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <StageIcon icon={icon} tone={tone} />
        {!isLast && <div className="mt-1 w-[2px] flex-1 bg-[#b5c7d8]" />}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="mb-1.5 flex h-8 items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-800">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-gray-200 px-2 text-[11px] font-semibold text-gray-600">{count}</span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// Table of documents; each row can expand to show its detail fields.
function DocTable({ columns, rows, rowKey, renderDetail, empty, rowMuted }) {
  const [open, setOpen] = useState({});
  if (!rows?.length) return <EmptyNote>{empty}</EmptyNote>;

  return (
    <div className="overflow-x-auto rounded-md border border-[#cfd8e3]">
      <table className="w-full border-collapse text-[12px]">
        <thead className="bg-[#eef3f8] text-gray-600">
          <tr>
            {renderDetail && <th className="w-6" />}
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-2 py-1 font-semibold ${c.align === "right" ? "text-right" : "text-left"}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            const isOpen = !!open[k];
            const muted = rowMuted?.(r);
            return (
              <Fragment key={k}>
                <tr
                  className={`border-t border-[#e3e8ee] ${muted ? "bg-gray-50 text-gray-400" : "bg-white"} ${renderDetail ? "cursor-pointer hover:bg-[#f5f9ff]" : ""}`}
                  onClick={renderDetail ? () => setOpen((p) => ({ ...p, [k]: !p[k] })) : undefined}
                >
                  {renderDetail && (
                    <td className="px-1 text-gray-400">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-2 py-1 ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                    >
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
                {renderDetail && isOpen && (
                  <tr className="bg-[#f8fafc]">
                    <td />
                    <td colSpan={columns.length} className="px-2 py-2">
                      {renderDetail(r)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const DetailGrid = ({ children }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
);

function Section({ icon: Icon, title, tone, children, note }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-600">{title}</span>
        {note}
      </div>
      {children}
    </div>
  );
}

// ── order-level sections ──────────────────────────────────────────────────────

function GrnSection({ order, unit }) {
  return (
    <Section icon={PackageCheck} title="Material Receipt (GRN)" tone="text-emerald-600">
      <DocTable
        rows={order.grns}
        rowKey={(g) => g.grnItemId}
        rowMuted={(g) => isRejected(g.workflowStatus)}
        empty="No GRN recorded against this order line."
        columns={[
          { key: "no", label: "GRN No", render: (g) => <span className="font-medium">{g.grnNo}</span> },
          { key: "dt", label: "Date", render: (g) => fmtDate(g.grnDate) },
          { key: "st", label: "Status", render: (g) => <StatusBadge status={g.workflowStatus} /> },
          { key: "q", label: `Received (${unit || "qty"})`, align: "right", render: (g) => fmtQty(g.receivedQty) },
          { key: "b", label: "Billed", align: "right", render: (g) => fmtQty(g.billedQty) },
          { key: "v", label: "", render: (g) => <ViewDocLink docType="GRN" docId={g.grnId} /> },
        ]}
        renderDetail={(g) => (
          <DetailGrid>
            <Field label="Parent Order">{order.orderNo}</Field>
            <Field label="Challan No">{g.challanNo}</Field>
            <Field label="Party Bill No">{g.partyBillNo}</Field>
            <Field label="Order Rate">₹ {fmtAmt(g.orderRate)}</Field>
            <Field label="Value at Order Rate">₹ {fmtAmt(g.valueAtOrderRate)}</Field>
            <Field label="Store Location">{g.storeLocation}</Field>
            <Field label="Use Location">{g.useLocation}</Field>
            <Field label="BRB Lines">{g.billings?.length || 0}</Field>
          </DetailGrid>
        )}
      />
    </Section>
  );
}

function GinSection({ order, unit }) {
  return (
    <Section icon={PackageMinus} title="Material Issue (GIN)" tone="text-orange-600">
      <DocTable
        rows={order.gins}
        rowKey={(g) => g.ginItemId}
        rowMuted={(g) => isRejected(g.workflowStatus)}
        empty="No issue recorded against this order line."
        columns={[
          { key: "no", label: "GIN No", render: (g) => <span className="font-medium">{g.ginNo}</span> },
          { key: "dt", label: "Date", render: (g) => fmtDate(g.ginDate) },
          { key: "st", label: "Status", render: (g) => <StatusBadge status={g.workflowStatus} /> },
          { key: "q", label: `Issued (${unit || "qty"})`, align: "right", render: (g) => fmtQty(g.issueQty) },
          { key: "v", label: "", render: (g) => <ViewDocLink docType="GIN" docId={g.ginId} /> },
        ]}
        renderDetail={(g) => (
          <DetailGrid>
            <Field label="Parent Order">{order.orderNo}</Field>
            <Field label="Issue Category">{g.issueCategory}</Field>
            <Field label="Issue Slip No">{g.issueSlipNo}</Field>
            <Field label="Handed Over To">{g.handedOverTo}</Field>
            <Field label="Stock Location">{g.stockLocation}</Field>
            <Field label="Used At">{g.usedLocation}</Field>
          </DetailGrid>
        )}
      />
    </Section>
  );
}

function DcSection({ order, unit }) {
  if (!order.dcs?.length) return null;
  return (
    <Section icon={Truck} title="Dispatch / Transfer (DC)" tone="text-sky-600">
      <DocTable
        rows={order.dcs}
        rowKey={(d) => d.dcItemId}
        rowMuted={(d) => isRejected(d.workflowStatus)}
        columns={[
          { key: "no", label: "DC No", render: (d) => <span className="font-medium">{d.dcNo}</span> },
          { key: "dt", label: "Date", render: (d) => fmtDate(d.challanDate) },
          { key: "st", label: "Status", render: (d) => <StatusBadge status={d.workflowStatus} /> },
          { key: "q", label: `Qty (${unit || "qty"})`, align: "right", render: (d) => fmtQty(d.qty) },
          { key: "v", label: "", render: (d) => <ViewDocLink docType="DC" docId={d.dcId} /> },
        ]}
        renderDetail={(d) => (
          <DetailGrid>
            <Field label="Parent Order">{order.orderNo}</Field>
            <Field label="Order Type">{d.orderType?.replace(/_/g, " ")}</Field>
            <Field label="From Project">{d.fromProjectCode}</Field>
            <Field label="To Project">{d.toProjectCode}</Field>
            <Field label="Vehicle No">{d.vehicleNumber}</Field>
            <Field label="Stock Location">{d.stockLocation}</Field>
          </DetailGrid>
        )}
      />
    </Section>
  );
}

function BillingSection({ order, unit }) {
  return (
    <Section
      icon={Receipt}
      title="Supplier Billing (BRB)"
      tone="text-indigo-600"
      note={<span className="text-[10px] font-medium text-emerald-700">Exact item-level</span>}
    >
      <DocTable
        rows={order.billings}
        rowKey={(b) => b.brbItemId}
        rowMuted={(b) => isRejected(b.workflowStatus)}
        empty="No BRB billing recorded against this item's GRNs."
        columns={[
          { key: "no", label: "BRB No", render: (b) => <span className="font-medium">{b.brbNo}</span> },
          { key: "dt", label: "Date", render: (b) => fmtDate(b.brbDate) },
          { key: "st", label: "Status", render: (b) => <StatusBadge status={b.workflowStatus} /> },
          { key: "grn", label: "GRN", render: (b) => b.grnNo },
          { key: "q", label: `Qty (${unit || "qty"})`, align: "right", render: (b) => fmtQty(b.billingQty) },
          { key: "t", label: "Total ₹", align: "right", render: (b) => fmtAmt(b.totalAmount) },
          { key: "v", label: "", render: (b) => <ViewDocLink docType="BRB" docId={b.brbId} /> },
        ]}
        renderDetail={(b) => (
          <DetailGrid>
            <Field label="Parent GRN">{b.grnNo}</Field>
            <Field label="BRR">{b.brrNo}</Field>
            <Field label="Party Bill">{b.partyBillNo ? `${b.partyBillNo} · ${fmtDate(b.partyDate)}` : null}</Field>
            <Field label="Rate">₹ {fmtAmt(b.rate)}</Field>
            <Field label="Taxable Amount">₹ {fmtAmt(b.basicAmount)}</Field>
            <Field label="GST">{`${fmtPercent(b.gstPercent)} · ₹ ${fmtAmt(b.gstAmount)}`}</Field>
            <Field label="Total">₹ {fmtAmt(b.totalAmount)}</Field>
          </DetailGrid>
        )}
      />
    </Section>
  );
}

function PurchaseBillCard({ bill, basis }) {
  const a = bill.allocation;
  const rejected = isRejected(bill.workflowStatus);
  return (
    <div className={`rounded-md border ${rejected ? "border-gray-200 bg-gray-50 opacity-70" : "border-[#d7dce3] bg-white"} p-2`}>
      <div className="flex flex-wrap items-center gap-2">
        <Landmark className="h-3.5 w-3.5 text-purple-600" />
        <span className="text-[12px] font-semibold">{bill.purchaseBillNo}</span>
        <span className="text-[11px] text-gray-500">{fmtDate(bill.processingDate)}</span>
        <StatusBadge status={bill.workflowStatus} />
        <span className="ml-auto" />
        <ViewDocLink docType="PURCHASE_BILL" docId={bill.purchaseBillId} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Field label="Vendor Bill">{bill.vendorBillNo ? `${bill.vendorBillNo} · ${fmtDate(bill.vendorBillDate)}` : null}</Field>
        <Field label="Bill Taxable (all CC)">₹ {fmtAmt(bill.basicAmount)}</Field>
        <Field label="Bill GST (all CC)">
          {Object.keys(bill.gstBreakdown || {}).length
            ? Object.entries(bill.gstBreakdown).map(([k, v]) => `${k} ₹ ${fmtAmt(v)}`).join(" · ")
            : `₹ ${fmtAmt(bill.gstAmount)}`}
        </Field>
        <Field label="Bill Total">₹ {fmtAmt(bill.totalInvoiceAmount)}</Field>
      </div>

      <div className="mt-2 rounded border border-amber-200 bg-amber-50/60 px-2 py-1.5">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-amber-800">
          This item&apos;s share
          {a.available && <AllocatedTag basis={basis} />}
          {a.ccCode && <span className="font-normal text-amber-700">CC {a.ccCode}: ₹ {fmtAmt(a.ccBasic)} + GST ₹ {fmtAmt(a.ccGst)}</span>}
        </div>
        {a.available ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
            <Field label="Share">{(a.share * 100).toFixed(2)}%</Field>
            <Field label="Taxable">≈ ₹ {fmtAmt(a.billBasic)}</Field>
            <Field label="GST">≈ ₹ {fmtAmt(a.billGst)}</Field>
            <Field label="Paid (approved)">≈ ₹ {fmtAmt(a.paidTotal)}</Field>
            <Field label="Outstanding">≈ ₹ {fmtAmt(Math.max((a.billTotal || 0) - (a.paidTotal || 0), 0))}</Field>
          </div>
        ) : (
          <div className="text-[11px] text-amber-800">Not allocable: {a.reason}</div>
        )}
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Payments</span>
        </div>
        <DocTable
          rows={bill.payments}
          rowKey={(p) => p.receiptId}
          rowMuted={(p) => isRejected(p.workflowStatus)}
          empty="No payment recorded against this Purchase Bill."
          columns={[
            { key: "no", label: "Receipt No", render: (p) => <span className="font-medium">{p.receiptNo}</span> },
            { key: "dt", label: "Date", render: (p) => fmtDate(p.paymentDate) },
            { key: "st", label: "Status", render: (p) => <StatusBadge status={p.workflowStatus} /> },
            { key: "tot", label: "Receipt Total ₹", align: "right", render: (p) => fmtAmt(p.receiptTotal) },
            {
              key: "al",
              label: "Item Share ₹",
              align: "right",
              render: (p) => (p.allocatedAmount === null ? "—" : `≈ ${fmtAmt(p.allocatedAmount)}`),
            },
            { key: "v", label: "", render: (p) => <ViewDocLink docType="BILL_PAYMENT" docId={p.receiptId} /> },
          ]}
          renderDetail={(p) => (
            <DetailGrid>
              <Field label="Parent Purchase Bill">{bill.purchaseBillNo}</Field>
              <Field label="Mode">{p.paymentMode}</Field>
              <Field label="UTR / Voucher">{p.utrVoucherNo}</Field>
              <Field label={`Paid on CC ${a.ccCode || ""} (taxable)`}>₹ {fmtAmt(p.ccPaidBasic)}</Field>
              <Field label={`Paid on CC ${a.ccCode || ""} (GST)`}>₹ {fmtAmt(p.ccPaidGst)}</Field>
            </DetailGrid>
          )}
        />
      </div>
    </div>
  );
}

function AccountsSection({ order, basis }) {
  return (
    <Section
      icon={Landmark}
      title="Accounts (BRR → Purchase Bill → Payment)"
      tone="text-purple-600"
      note={<span className="text-[10px] font-medium text-amber-700">CC-level · item values are estimates</span>}
    >
      {!order.brrs?.length ? (
        <EmptyNote>No Bill Receive Register linked through this item&apos;s BRB billing.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {order.brrs.map((brr) => (
            <div key={brr.brrId} className="rounded-md border border-[#cfd8e3] bg-[#fafbfd] p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold">{brr.brrNo}</span>
                <span className="text-[11px] text-gray-500">{fmtDate(brr.brrDate)}</span>
                <StatusBadge status={brr.workflowStatus} />
                <span className="text-[11px] text-gray-600">
                  Party bill {brr.partyBillNo || "—"} · Total ₹ {fmtAmt(brr.totalAmount)}
                </span>
                <span className="ml-auto" />
                <ViewDocLink docType="BRR" docId={brr.brrId} />
              </div>
              <div className="mt-1 text-[11px] text-gray-600">
                Item&apos;s approved BRB taxable under this BRR: <b>₹ {fmtAmt(brr.itemApprovedBrbBasic)}</b>
                {brr.ccApprovedBrbBasic ? <> of ₹ {fmtAmt(brr.ccApprovedBrbBasic)} for its CC code</> : null}
              </div>
              <div className="mt-2 space-y-2">
                {brr.purchaseBills.length ? (
                  brr.purchaseBills.map((b) => <PurchaseBillCard key={b.purchaseBillId} bill={b} basis={basis} />)
                ) : (
                  <EmptyNote>No Purchase Bill has been prepared on this BRR yet.</EmptyNote>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── one order line = one branch ───────────────────────────────────────────────

function OrderBranch({ order, unit, basis, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const rejected = isRejected(order.workflowStatus);

  return (
    <div className={`rounded-lg border ${rejected ? "border-gray-200 bg-gray-50" : "border-[#b5c7d8] bg-white"} shadow-sm`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        <span className={`text-[13px] font-semibold ${rejected ? "text-gray-400 line-through" : "text-[#144664]"}`}>
          {order.orderNo}
        </span>
        <span className="text-[11px] text-gray-500">{fmtDate(order.orderDate)}</span>
        <StatusBadge status={order.workflowStatus} />
        <span className="truncate text-[12px] text-gray-700">{order.partyName || "—"}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded bg-[#e8f0df] px-1.5 py-0.5 font-semibold">Ordered {fmtQty(order.qty)} {unit}</span>
          {!rejected && (
            <>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">Received {fmtQty(order.receivedQty)}</span>
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700">Issued {fmtQty(order.issuedQty)}</span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">Billed {fmtQty(order.billedQty)}</span>
            </>
          )}
          {rejected && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Excluded from totals</span>}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#e3e8ee] px-3 pb-3 pt-2">
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:grid-cols-8">
              <Field label="Rate">₹ {fmtAmt(order.rate)}</Field>
              <Field label="Taxable">₹ {fmtAmt(order.basicAmount)}</Field>
              <Field label="GST">{`${fmtPercent(order.gstPercent)} · ₹ ${fmtAmt(order.gstAmount)}`}</Field>
              <Field label="Total">₹ {fmtAmt(order.totalAmount)}</Field>
              <Field label="Pending Receipt">{fmtQty(order.pendingReceiptQty)} {unit}</Field>
              <Field label="Net Accepted">{fmtQty(order.receivedApprovedQty)} {unit}</Field>
              <Field label="In Stock">{fmtQty(order.stockQty)} {unit}</Field>
              <Field label="Pending Billing">{fmtQty(order.pendingBillingQty)} {unit}</Field>
            </div>
            <ViewDocLink docType="ORDER" docId={order.orderId} label="View Order" />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <GrnSection order={order} unit={unit} />
            <GinSection order={order} unit={unit} />
          </div>
          <DcSection order={order} unit={unit} />
          <BillingSection order={order} unit={unit} />
          <AccountsSection order={order} basis={basis} />
        </div>
      )}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function TraceLifecycle({ data }) {
  const { source, orders, allocationBasis, legacyBilling } = data;
  const unit = source.unit;
  const firstLiveIdx = orders.findIndex((o) => !isRejected(o.workflowStatus));

  return (
    <div className="pt-1">
      <Step icon={ClipboardList} title="Indent Item">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#b5c7d8] bg-[#f3f7ff] px-3 py-2">
          <span className="text-[13px] font-semibold text-[#144664]">{source.indentNo}</span>
          <span className="text-[11px] text-gray-500">{fmtDate(source.indentDate)}</span>
          <StatusBadge status={source.indentStatus} />
          <span className="text-[12px]">
            Qty <b>{fmtQty(source.qty)}</b> {unit}
          </span>
          {source.location && <span className="text-[12px] text-gray-600">Use at {source.location}</span>}
          {source.note && <span className="truncate text-[12px] italic text-gray-500">{source.note}</span>}
        </div>
      </Step>

      <Step icon={ShoppingCart} tone="bg-[#2f6f9f]" title="Material Orders" count={orders.length} isLast>
        {orders.length ? (
          <div className="space-y-2">
            {orders.map((o, i) => (
              <OrderBranch
                key={o.orderItemId}
                order={o}
                unit={unit}
                basis={allocationBasis}
                defaultOpen={orders.length === 1 || i === firstLiveIdx}
              />
            ))}
          </div>
        ) : (
          <EmptyNote>This indent item has not been placed on any material order yet.</EmptyNote>
        )}

        {legacyBilling?.length > 0 && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-[12px] text-gray-600">
            <div className="mb-1 font-semibold">Legacy vendor billing (BVS) — reference only, not counted</div>
            {legacyBilling.map((l) => (
              <div key={`${l.docId}-${l.grnItemId}`}>
                {l.docNo} · {fmtDate(l.docDate)} · {l.workflowStatus} · Qty {fmtQty(l.billingQty)} · ₹ {fmtAmt(l.basicAmount)}
              </div>
            ))}
          </div>
        )}
      </Step>
    </div>
  );
}
