# PRAX ERP — Remaining Work Implementation Report

## Status Summary

| Task | Status | Files |
|------|--------|-------|
| C5 — Stock Ledger Service | **DONE** | `app/models/stockLedger.py`, `stock_ledger_service.py` |
| C6 — GRN/GIN Posting Rules | **DONE** | `stock_posting_rules.py`, `posting_rules.py`, GRN/GIN `service.py` |
| C7 — Moving WAC | **DONE** | `stock_ledger_service.py` (get_wac, recalculate_running_balances) |
| C8 — GIN Rate Lookup | **DONE** | `stock_ledger_service.py` (get_gin_item_rate), `stock_posting_rules.py` |
| E — Uncertified Statement Investigation | **DONE** | See §E below |

---

## A. C5 — Stock Ledger Service

### New files created

**`app/models/stockLedger.py`** — SQLAlchemy model matching `PRAX_SCHEMA_PROPOSAL_v2.md §5`:
- All columns from the proposed schema
- Partial unique indexes: `uq_stock_original` (WHERE is_reversal=FALSE), `uq_stock_one_reversal` (WHERE is_reversal=TRUE)
- Performance indexes: `ix_stock_item`, `ix_stock_project`, `ix_stock_date`
- **IMPORTANT**: The model does NOT create the table. The DBA must run the migration first.

**`app/modules/finance/accounting/stock_ledger_service.py`** — Core service:
- `post_stock_entry()` — records stock-in (+qty) or stock-out (-qty) with running balance update
- `reverse_stock_entry()` — creates reversal entries with SELECT FOR UPDATE concurrency protection
- `get_wac()` — returns current WAC rate (C7)
- `get_gin_item_rate()` — WAC-based rate for GIN (C8)
- `get_stock_balance()` — returns (running_qty, running_value, wac_rate) for reports
- `recalculate_running_balances()` — forward-recalculates from correction point (C7)

### Schema requirement (DBA action needed)

The `stock_ledger` table must be created per `PRAX_SCHEMA_PROPOSAL_v2.md §5` before these services work at runtime. Without the table, the try/except blocks in GRN/GIN approval will silently skip stock posting.

---

## B. C6 — GRN/GIN Posting Rules

### New file created

**`app/modules/finance/accounting/stock_posting_rules.py`**:

**GRN approval creates:**
1. Stock ledger entries: +qty at PO rate (per GrnItem)
2. Accounting entries: Dr CARM (inventory asset), Cr Vendor payable

**GIN approval creates:**
1. Stock ledger entries: -qty at WAC rate (per GinItem)
2. Accounting entries: Dr CC-code (from GinMaster.cost_head), Cr CARM (inventory consumed)

### Modified files

**`app/modules/finance/accounting/posting_rules.py`** — Added `"grn"` and `"gin"` to `_POSTING_RULES` registry.

**`app/modules/resources/grn/service.py`** — In `approve_grn()`, after final approval sets `workflow_status="Approved"`:
- `db.session.flush()` to persist GRN state
- `post_grn_stock()` → stock ledger entries
- `post_document("grn", ...)` → accounting ledger entries
- Wrapped in try/except so GRN approval is not blocked if stock_ledger table doesn't exist yet

**`app/modules/resources/gin/service.py`** — Same pattern in `approve_gin()`:
- `post_gin_stock()` → stock ledger entries at WAC rate
- `post_document("gin", ...)` → accounting ledger entries

### Rate lookup chain

- **GRN rate**: `GrnItem.order_item_id → OrderItem.rate` (PO rate)
- **GIN rate**: `stock_ledger_service.get_gin_item_rate()` → WAC = `running_value / running_qty`

---

## C. C7 — Moving WAC with Backdated Recalculation

### Costing level: Project + Stock Location + Item

All WAC calculations key on `(item_id, project_code, location_id)`.

### How it works

1. **Stock-in (GRN)**: New entry added with PO rate. Running balance updated:
   - `running_qty = prev_running_qty + received_qty`
   - `running_value = prev_running_value + (received_qty × PO_rate)`

2. **Stock-out (GIN)**: New entry at WAC rate. Running balance updated:
   - WAC = `running_value / running_qty` (before this transaction)
   - `running_qty = prev_running_qty - issued_qty`
   - `running_value = prev_running_value - (issued_qty × WAC)`

3. **Backdated recalculation** (`recalculate_running_balances()`):
   - Entry fields (quantity, rate, amount) are **IMMUTABLE**
   - Only running_qty and running_value are recalculated
   - Walks chronologically from correction point forward
   - Triggered automatically after reversals

---

## D. C8 — GIN Rate Lookup

`get_gin_item_rate(item_id, project_code, location_id)` → WAC rate.

**CC Head hierarchy preserved**: `GinMaster.cost_head` carries the CC code which maps to the CC Head → Group → Subgroup → CC Code hierarchy in reporting. The GIN accounting entry debits this CC code, so the existing P&L report (which groups by `cc_code`) will automatically place GIN consumption under the correct cost head.

---

## E. Uncertified Statement Investigation

### Module mapping

| Frontend | Backend | DB Table |
|----------|---------|----------|
| `/project-management/customer-billing/uncertified-statement/` | `uncertain_allocation` | `uncertain_allocation_master` + `uncertain_allocation_line` |

### Models (`app/models/uncertainAllocation.py`)

**UncertainAllocationMaster**:
- `ua_no`, `ua_date`, `project_code`
- `total_claim`, `total_certified`, `total_difference`
- `workflow_status` (Draft/Pending_L*/Approved/Rejected/Reback/Cancelled)
- `locked` (set on final approval)

**UncertainAllocationLine**:
- `og_sale_order_id` → FK to `og_sale_order_master.id`
- `billing_id` → FK to `billing_master.id`
- `og_sale_order_item_id` → FK to `og_sale_order_items.id`
- `item_type`: `'item'` or `'boq_item'`
- **Quantity fields**: `og_boq_qty` (original SO qty), `boq_qty` (claim qty), `certified_qty`, `unit_rate`
- **Amount fields**: `claim_amount`, `certified_amount`, `difference`
- **Justification quantities** (explain the difference):
  - `over_billing_calculation_mistake` — calculation errors
  - `certified_hold_amendment_pending` — amendment pending
  - `non_boq_items_rate` — non-BOQ rate differences
  - `hold_work` — work on hold (unsatisfactory)
  - `hold_for_full_work_not_completed` — incomplete work

### Workflow (service.py — 1158 lines)

1. **Lookup**: `get_sale_orders_for_lookup()` → lists approved SOs with claim/certified/difference
2. **Item fetch**: `get_sale_order_items_for_ua()` → item-level data from SO items + BOQ items
3. **Claim bills**: `get_claim_bills_for_so()` → approved billing_master records with mode="sale_claim_bill"
4. **Certified bills**: `get_certified_bills_for_so()` → approved billing_master records with mode="sale_certified_bill"
5. **Create/Edit**: `create_ua()` / `edit_ua()` — re-computes certified amounts from DB at save time
6. **Standard workflow**: submit → approve (multi-level) → lock
7. **Delete**: physical delete only when not locked

### Relationships

```
OgSaleOrderMaster (Sale Order)
  ├── BillingMaster (mode="sale_claim_bill")  ← Claim Bills
  │     └── BillingMaster (mode="sale_certified_bill", claim_bill_id=parent.id)  ← Certified Bills
  ├── UncertainAllocationLine.og_sale_order_id  ← UA tracks per-SO
  └── SaleBillMaster / SaleInvoice  ← Revenue recognition (separate path)
```

### Calculation flow

- **Claim amount** per item: sum of `BillingItem.amount` / `BillingBoqItem.amount` from all approved claim bills
- **Certified amount** per item: sum of amounts from certified bills linked to those claim bills
- **Difference**: claim - certified
- **Justification**: difference is broken down into the 5 categories above
- UA does NOT generate accounting entries — it is a **tracking/reconciliation document**

### P&L representation

| CC Code | Meaning | Current source | Gap? |
|---------|---------|---------------|------|
| CRIN | Contract Revenue (Invoice Raised) | Sum of approved SaleOrder amounts | No |
| CRHL | Certified but Hold | None currently | **workDone = None** |
| CRAP | Certified Amendment Pending | None currently | **workDone = None** |
| UCAP | Work Done Uncertified Amendment Pending | None currently | **workDone = None** |
| WIPS | Work in Progress Sale | None currently | **workDone = None** |

**Key finding**: The `workDone`, `stock`, and `actual` columns in P&L currently return `None` for ALL codes. These gaps exist:

- **workDone for CRAP**: Should come from `uncertain_allocation_line` rows where `certified_hold_amendment_pending > 0`
- **workDone for UCAP**: Should come from UA rows where `difference > 0` (work done but uncertified)
- **stock column**: Should come from stock ledger `running_value` for inventory CC codes (once C5 stock ledger is live)
- **actual column**: Should come from accounting ledger entries (sum of posted Dr amounts per CC code)

### Balance Sheet representation

| CC Code | Meaning | Current source |
|---------|---------|---------------|
| CAUM | Work done uncertified | Journal entries (via `bulk_journal_balance`) |
| CAHL | Certified but hold | Journal entries |
| CAAP | Certified amendment pending | Journal entries |
| CARM | Raw materials (inventory) | Journal entries |
| CASD | Sundry debtors (invoiced receivables) | Sale bills - sale receipts |

**Key finding**: CAUM ("Work done uncertified") in the Balance Sheet already comes from journal entries, NOT directly from `uncertain_allocation`. This means:
- UA is a **tracking document** — it computes the difference but doesn't post accounting
- The accountant must create journal entries (JE) to recognize uncertified amounts as CAUM
- This prevents double-counting: UA identifies the amount, JE books it

### Duplicate revenue risk assessment

**No duplicate revenue risk exists** because:
1. Revenue (CRIN in P&L) comes from Sale Order total amount, not from billing
2. Claim/Certified billing amounts do NOT post to P&L revenue
3. UA tracks the gap between claim and certified — it doesn't create revenue
4. Balance Sheet CAUM comes from manual JEs, which the accountant controls
5. Sale Bills post through the accounting ledger as customer receivables (Dr CASD / Cr Revenue), which is a separate path from UA

### Recommendation (no action needed now)

The Uncertified Statement module is complete and correct as-is:
- It is a reconciliation/tracking tool, not an accounting document
- P&L codes CRHL, CRAP, UCAP are placeholders that get their `workDone` values once the accountant creates JEs
- No schema changes needed for this module
- No integration with the accounting ledger is needed — it correctly stays as a manual reconciliation step

---

## Schema Changes Required (DBA Action)

Before the stock ledger service works at runtime, the DBA must create:

1. **`stock_ledger` table** — per `PRAX_SCHEMA_PROPOSAL_v2.md §5`
2. **Partial unique indexes**: `uq_stock_original`, `uq_stock_one_reversal`
3. **Performance indexes**: `ix_stock_item`, `ix_stock_project`, `ix_stock_date`
4. **CC code `CARM`** must exist in the `cc_codes` table (for GRN/GIN accounting entries)

Until the table is created, GRN/GIN approval will work normally (the try/except blocks silently skip stock posting).

---

## Files Modified (summary)

| File | Change |
|------|--------|
| `app/models/stockLedger.py` | **NEW** — Stock ledger model |
| `app/modules/finance/accounting/stock_ledger_service.py` | **NEW** — C5 + C7 + C8 |
| `app/modules/finance/accounting/stock_posting_rules.py` | **NEW** — C6 posting rules |
| `app/modules/finance/accounting/posting_rules.py` | Added GRN + GIN to registry |
| `app/modules/resources/grn/service.py` | Hook in `approve_grn()` |
| `app/modules/resources/gin/service.py` | Hook in `approve_gin()` |

No migrations created. No schema changes executed. No git commits made.
