# PRAX ERP — Deletion & Cancellation Safeguards Resolution

**Date**: 2026-11-11  
**Baseline**: All code changes from prior sessions + deletion_guard + cancellation_service  
**Constraint**: No migrations, no schema changes, no commits, no push

---

## 1. GRN/GIN Cancellation

### Current state

- GRN and GIN have `locked` field and `workflow_status`
- Deletion guard (`check_posted_before_delete`) is integrated into both `delete_grn` and `delete_gin`
- GRN/GIN are registered in `_SOURCE_TYPE_MAP` as `"grn"` and `"gin"`
- **No posting rules exist for GRN/GIN yet** — they are not in `_POSTING_RULES` registry
- **No stock_ledger table exists yet** — proposed in PRAX_SCHEMA_PROPOSAL_v2.md §5

### What this means today

Since GRN/GIN don't have posting rules, no accounting entries are created on approval. The deletion guard checks the `accounting_ledger` table — it returns `can_delete=True` because nothing is posted. Combined with the existing `locked` check, the behaviour is:
- Draft GRN/GIN → physical deletion allowed (existing behaviour preserved)
- Locked GRN/GIN → physical deletion blocked by `locked` check (existing behaviour)
- Once posting rules are added → physical deletion blocked by `check_posted_before_delete`

### When stock_ledger is implemented — full cancellation plan

GRN/GIN cancellation must reverse **both** stock quantity and financial valuation:

1. **Stock reversal**: A new `stock_ledger` entry with `is_reversal=True`, `reversed_stock_entry_id` pointing to the original. For GRN reversal: negative quantity at same rate. For GIN reversal: positive quantity restoring the issued amount. The original entry is never modified or deleted.

2. **Accounting reversal**: The existing `reverse_posting()` handles this. GRN posting rule (future): Dr Inventory Asset, Cr Goods-in-Transit → Reversal: Dr GIT, Cr Inventory Asset. GIN posting rule (future): Dr Consumption Expense, Cr Inventory Asset → Reversal: Dr Inventory Asset, Cr Consumption Expense.

3. **Rate lookup**: `GrnItem.order_item_id` → `OrderItem.rate` (Numeric 17,4) provides the unit rate from the purchase order. Stock ledger `amount = current_received_qty × rate`.

4. **Report correctness**: Both original and reversal entries remain in the stock ledger. Reports sum all entries — reversal nets to zero, producing correct current balances without modifying history.

### Schema required for GRN/GIN cancellation (awaiting approval)

The `stock_ledger` table from PRAX_SCHEMA_PROPOSAL_v2.md §5 needs two additional columns:
```sql
is_reversal              BOOLEAN DEFAULT FALSE,
reversed_stock_entry_id  INTEGER REFERENCES stock_ledger(id),
```

---

## 2. Stock Ledger Uniqueness and Reversals

### Partial unique index for originals

The previous `UNIQUE(source_type, source_id, source_line_id)` applied to ALL rows including reversals — this would block reversal entries for the same source line. **Corrected** to a partial unique index:

```sql
CREATE UNIQUE INDEX uq_stock_original
    ON stock_ledger(source_type, source_id, source_line_id)
    WHERE is_reversal = FALSE;
```

This prevents duplicate original entries while allowing reversal entries for the same source.

### One-reversal-per-original at DB level

```sql
CREATE UNIQUE INDEX uq_stock_one_reversal
    ON stock_ledger(reversed_stock_entry_id)
    WHERE is_reversal = TRUE AND reversed_stock_entry_id IS NOT NULL;
```

Since `reversed_stock_entry_id` is unique among reversals, each original can have at most one reversal. This is belt-and-suspenders with the application-level check in the stock reversal service (which mirrors `reverse_posting()`'s SELECT FOR UPDATE + post-lock check pattern).

### FK and reversal chain

- `reversed_stock_entry_id INTEGER REFERENCES stock_ledger(id)` — FK to the original entry
- `is_reversal BOOLEAN DEFAULT FALSE` — marks reversal entries
- Original entries: `is_reversal=FALSE`, `reversed_stock_entry_id=NULL`
- Reversal entries: `is_reversal=TRUE`, `reversed_stock_entry_id=<original.id>`

### Concurrency

Same pattern as `reverse_posting()`: `SELECT ... FOR UPDATE` on the original stock entry, then post-lock check for existing reversal before creating. Prevents duplicate reversals under concurrent requests.

## 3. Inventory Valuation

### Rate lookup chain — verified

```
GrnItem.order_item_id → OrderItem.id
                         OrderItem.rate      Numeric(17,4) — unit rate
                         OrderItem.amount    Numeric(14,2) — line total
                         OrderItem.gst_percent / gst_amount
GrnMaster.order_id    → OrderMaster.id (parent PO)
```

### Edge case handling

| Scenario | Handling |
|---|---|
| **Partial GRN** (50 of 100 ordered) | Stock entry records `current_received_qty` × `OrderItem.rate`. Each partial GRN creates its own stock ledger entry. PO's `OrderItem.balance_qty` tracks remaining. |
| **Purchase discount** | `OrderItem.rate` is the negotiated net rate (after discount). This is the rate used for stock valuation — no separate discount handling needed. |
| **Additional costs** (freight, duties) | Booked via separate Purchase Bills with their own CC codes. Not part of GRN valuation. Landed-cost allocation (adjusting inventory cost) is a Phase 2 feature requiring a `cost_adjustment` source type. |
| **Returns** | GRN cancellation creates a reversal stock entry (negative qty, same rate). Accounting reversal nets the financial impact to zero. |
| **PO modification after GRN** | Historical cost principle: GRN stock entry retains the rate at time of receipt. Future GRNs use the new rate. Retroactive correction requires a stock adjustment entry. |

### Valuation method — Weighted Average Cost (WAC)

Recommended for this ERP because:
- Simpler to implement and query (running average, not FIFO queue tracking)
- Suitable for construction/project materials where items are fungible
- `stock_ledger.running_qty` and `stock_ledger.running_value` track the running position
- GIN rate = `running_value / running_qty` at point of issue
- Adjustments are new entries that modify the running position going forward

### WAC Correctness — Single Consistent Approach

**The rule**: Entry fields (`quantity`, `rate`, `amount`) are immutable once written. Running-balance fields (`running_qty`, `running_value`) ARE recalculated forward from the affected point when a mid-period correction (reversal + new entry) is inserted.

**Detailed behavior**:

| Scenario | Handling |
|---|---|
| **Normal GRN** | New entry: `running_qty += quantity`, `running_value += amount`. WAC rate = `running_value / running_qty`. |
| **Normal GIN** | GIN rate = current WAC (`running_value / running_qty`). Entry: `quantity` negative, `rate` = WAC, `amount = quantity × rate`. Running values decrease. |
| **Backdated correction** | Step 1: Create reversal of the original entry (same qty/rate, signs flipped). Step 2: Create new correct entry. Step 3: Recalculate `running_qty` and `running_value` on ALL entries from the correction date forward, in chronological order. The entry's own `quantity`/`rate`/`amount` are never changed — only `running_qty`/`running_value` get updated. |
| **Negative stock** | Application-level validation rejects GIN when `running_qty` would go below zero. The stock ledger does not enforce this at DB level — it is a business rule enforced in the GIN approval service. |
| **Concurrent transactions** | Same item, same moment: serialized via `SELECT ... FOR UPDATE` on the most recent stock_ledger entry for that `(item_id, project_code)`. Second transaction sees the first's running balance. |
| **Multiple locations** | `location_id` scopes WAC calculation. Running balances are per `(item_id, project_code, location_id)`. A GIN at location A uses location A's WAC, independent of location B. |
| **Recalculation consistency** | A single `recalculate_running_balances(item_id, project_code, location_id, from_date)` function re-walks entries chronologically and rewrites `running_qty`/`running_value`. Called only after mid-period corrections, never during normal forward operations. |

**Summary**: "No historical recalculation" means entry fields (`quantity`, `rate`, `amount`) are never modified. "Subsequent running balances must be recalculated" means the running total fields (`running_qty`, `running_value`) are updated forward from the correction point. These are not contradictory — they describe different fields.

---

## 4. Financial-Year Overlap Constraint

### Single-company scope (current)

The system currently operates as single-company. The FY overlap constraint is simplified to:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE financial_year
    ADD CONSTRAINT no_fy_overlap
    EXCLUDE USING gist (
        daterange(start_date, end_date, '[]') WITH &&
    );
```

No `company_id` column or `COALESCE` wrapper needed. This prevents any two financial year records from having overlapping date ranges.

### `btree_gist` extension

This is a built-in PostgreSQL extension that ships with all standard installations (including Amazon RDS, Google Cloud SQL, Azure Database for PostgreSQL). It is not a third-party dependency. Needs to be run once:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```
Requires database owner or superuser privileges (one-time setup).

### Multi-company future

When multi-company is needed, add `company_id` to `financial_year` and change the constraint to:
```sql
EXCLUDE USING gist (company_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
```
This is a straightforward ALTER — no redesign needed.

---

## 5. Reversal and Accounting Integrity

### 5.1 DB-level uniqueness for one-reversal-per-original — NEW

Proposed partial unique index:

```sql
CREATE UNIQUE INDEX uq_ledger_one_reversal
    ON accounting_ledger(reversed_posting_id)
    WHERE is_reversal = TRUE AND reversed_posting_id IS NOT NULL;
```

This is the DB-level enforcement that complements the application-level `SELECT FOR UPDATE` + post-lock check. Even if the application-level check has a bug, the DB will reject a second reversal for the same original posting.

### 5.2 Posting engine validates Dr = Cr — CONFIRMED

`post_document()` at `posting_engine.py:62-69`:
```python
total_dr = sum(Decimal(str(l["amount"])) for l in lines_data if l["dr_cr"] == "Dr")
total_cr = sum(Decimal(str(l["amount"])) for l in lines_data if l["dr_cr"] == "Cr")
if total_dr != total_cr:
    raise PostingError(f"Unbalanced entry ...")
if total_dr == 0:
    raise PostingError(f"Zero-amount entry ...")
```

Two layers of balanced-entry enforcement:
1. **Application**: `post_document()` raises `PostingError` if `total_dr != total_cr` (line 65)
2. **Database**: `CHECK (total_debit = total_credit)` constraint (`ck_ledger_balanced`) on `accounting_ledger`

### 5.3 Balanced reversal entries — CONFIRMED

`reverse_posting()` at `posting_engine.py:114`:
- Reads original posting and all lines
- Creates reversal with `is_reversal=True`, `reversed_posting_id=original.id`
- Swaps every line's Dr↔Cr while preserving amounts
- Original: `total_debit == total_credit` (enforced by CHECK)
- Reversal: swaps `total_debit`/`total_credit` from original → still balanced → passes CHECK

### 5.4 No ORM/bulk deletion paths for accounting records — CONFIRMED

Grep audit of all `db.session.delete()`, `query.delete()`, and `bulk_delete` calls across the codebase:

- **No code path calls `db.session.delete()` on `AccountingLedger` or `AccountingLedgerLine`**
- `AccountingLedger.lines` has `cascade="all,delete-orphan"` at ORM level, but this only fires on `db.session.delete(posting)` — which no code path does
- `delete_manager/service.py` does not reference accounting tables
- All 11 delete functions for source documents are blocked by `check_posted_before_delete()` before reaching any delete call
- `opening_balance_service.delete_opening_balance()` uses reversal, not physical delete
- **JournalEntry has no delete function** — it can only be cancelled via the cancellation service

### 5.5 Duplicate prevention under concurrent requests — CONFIRMED

`reverse_posting()` uses three layers:

1. **Early check** (fast path): `cancellation_service.cancel_posted_document()` calls `is_reversed()` before acquiring lock. Returns 409 immediately if already reversed.
2. **Row lock** (concurrency gate): `SELECT ... FOR UPDATE` on the original posting. Second concurrent request blocks until first commits/rolls back.
3. **Post-lock check**: After acquiring lock, checks for existing reversal. If found, returns `None` (no duplicate created).
4. **DB constraint** (proposed): `uq_ledger_one_reversal` partial unique index — final safety net

### 5.6 Atomic cancellation with rollback — CONFIRMED

`cancel_posted_document()` at `cancellation_service.py:45-75`:
```python
try:
    reversal = reverse_posting(source_type, source_id, user_id)
    if reversal is None:
        return {"message": "... already reversed or not posted."}, 409
    if reason:
        reversal.remarks = f"Cancellation: {reason}"
    _mark_source_cancelled(source_type, source_id, user_id, reason)
    db.session.commit()
    return {...}, 200
except PostingError as e:
    db.session.rollback()
    return {"message": f"Cancellation failed: {str(e)}"}, 500
except Exception as e:
    db.session.rollback()
    return {"message": f"Cancellation failed: {str(e)}"}, 500
```

If ANY step fails (reversal creation, source document update, commit), the entire transaction rolls back — no partial state. The reversal and the source document status update are in the same transaction.

---

## 6. Cancellation Audit — Table Reconciliation

### Source tables vs delete functions vs cancellation scope

| # | Source Table | Has Delete Function | Has Posting Rules | In cancellation_service model_map | Needs audit columns |
|---|---|---|---|---|---|
| 1 | PurchaseBillMaster | ✅ `delete_purchase_bill` | ✅ `purchase_bill` | ✅ | ✅ |
| 2 | PaymentVoucherMaster | ✅ `delete_payment_voucher` | ✅ `payment_voucher` | ✅ | ✅ |
| 3 | BillPaymentReceiptMaster | ✅ `delete_bill_payment` | ✅ `bill_payment` | ✅ | ✅ |
| 4 | SaleBillMaster | ✅ `delete_sale_bill` | ✅ `sale_bill` | ✅ | ✅ |
| 5 | SaleReceiptBillingMaster | ✅ `delete_sale_receipt_billing` | ✅ `sale_receipt_billing` | ✅ | ✅ |
| 6 | JournalEntryMaster | ❌ no delete function | ✅ `journal_entry` | ✅ | ✅ |
| 7 | ContraEntryMaster | ✅ `delete_contra_entry` | ✅ `contra_entry` | ✅ | ✅ |
| 8 | DebitNoteMaster | ✅ `delete_debit_note` | ✅ `debit_note` | ✅ | ✅ |
| 9 | CreditNoteMaster | ✅ `delete_credit_note` | ✅ `credit_note` | ✅ | ✅ |
| 10 | PettyCashDocketVoucher | ✅ `delete_petty_cash_voucher` | ✅ `petty_cash_docket` | ✅ | ✅ |
| 11 | GrnMaster | ✅ `delete_grn` | ❌ (future) | ✅ (added) | ✅ |
| 12 | GinMaster | ✅ `delete_gin` | ❌ (future) | ✅ (added) | ✅ |

### Reconciliation

- **11 delete functions**: All source tables except JournalEntry (which has no delete — can only be cancelled)
- **10 posting rule types**: The 10 financial document types. GRN/GIN posting rules will be added when stock_ledger is implemented.
- **12 entries in `cancellation_service._mark_source_cancelled()` model_map**: All 10 financial + GRN + GIN. Updated this session to include GRN/GIN.
- **12 tables need cancellation audit columns**: All 12 above. Even JournalEntry (no delete) needs them for cancellation tracking. GRN/GIN need them for when stock_ledger cancellation is implemented.

### What was missing and is now fixed

1. `cancellation_service.py` model_map was missing GRN and GIN — **added this session**
2. GRN/GIN were not listed in cancellation audit scope — **corrected to 12 tables**

---

## 7. Deletion Safeguards — All 11 Delete Functions

### Execution order in each function

```
1. doc = Model.query.get(id)           → 404 if not found
2. if doc.locked:                      → 400 "Only draft can be deleted"
3. check_posted_before_delete(Model, id) → 400 if posted to accounting ledger
4. Delete items/lines/master            → physical deletion
5. db.session.commit()
```

### Verification matrix

| Module | Function | `locked` ✓ | Guard ✓ | Model key |
|---|---|---|---|---|
| Purchase Bill | `delete_purchase_bill` | ✅ | ✅ | `PurchaseBillMaster` |
| Payment Voucher | `delete_payment_voucher` | ✅ | ✅ | `PaymentVoucherMaster` |
| Bill Payment | `delete_bill_payment` | ✅ | ✅ | `BillPaymentReceiptMaster` |
| Sale Bill | `delete_sale_bill` | ✅ | ✅ | `SaleBillMaster` |
| Sale Receipt Billing | `delete_sale_receipt_billing` | ✅ | ✅ | `SaleReceiptBillingMaster` |
| Contra Entry | `delete_contra_entry` | ✅ | ✅ | `ContraEntryMaster` |
| Debit Note | `delete_debit_note` | ✅ | ✅ | `DebitNoteMaster` |
| Credit Note | `delete_credit_note` | ✅ | ✅ | `CreditNoteMaster` |
| Petty Cash Voucher | `delete_petty_cash_voucher` | ✅ | ✅ | `PettyCashDocketVoucher` |
| GRN | `delete_grn` | ✅ | ✅ | `GrnMaster` |
| GIN | `delete_gin` | ✅ | ✅ | `GinMaster` |

### Draft deletion — PRESERVED

For draft documents: `locked=False` (passes locked check), no accounting entry exists (passes guard), physical deletion proceeds. **No change to existing behaviour.**

### No cascade-delete of accounting/stock history — CONFIRMED

- **DB level**: All FKs use PostgreSQL default `NO ACTION` (= RESTRICT). No `ON DELETE CASCADE` at DB level anywhere in `accounting_ledger` or `accounting_ledger_lines`.
- **ORM level**: `AccountingLedger.lines` has `cascade="all,delete-orphan"`. This only fires on `db.session.delete(posting)`. No code path calls this on posted entries — all delete functions are blocked by the guard, and `opening_balance_service.delete_opening_balance()` now uses reversal.
- **Stock ledger** (future): Will follow the same pattern — guard blocks physical deletion, cancellation creates reversal entries.

---

## 8. Opening Balances — Reversal Correctness

### Reversal-based deletion — verified

`delete_opening_balance()` now:
1. Validates source_type is `"opening_balance"` and FY is not locked
2. Checks for existing reversal (prevents duplicate) → 409 if found
3. Creates reversal posting with swapped Dr/Cr lines
4. Returns the reversal ID and voucher number

### No duplicate active balances — FIXED

**Issue identified and fixed this session**: The duplicate check in `save_opening_balance()` was finding the original posting even after reversal (it filtered `is_reversal=False` but didn't exclude postings that had been reversed).

**Fix**: Both `list_opening_balances()` and `save_opening_balance()` now exclude postings whose `id` appears in `reversed_posting_id` of any reversal entry. This means:
- After reversal: the original disappears from the listing
- A new opening balance can be created for the same account/FY/project
- No zombie entries blocking new entries

### Report correctness — CONFIRMED

Reports in `ledger_service.py` sum all accounting entries without filtering on `is_reversal`. After reversal:
- **Trial Balance**: Original (Dr 1000) + Reversal (Cr 1000) = net 0. Correct.
- **General Ledger**: Shows both entries with dates/voucher numbers. Users can see the full history.
- **Balance Sheet**: Same as Trial Balance — net zero effect. Correct.
- **Voucher Register**: Shows both entries, with `isReversal` flag for identification.

---

---

# FINAL DELIVERABLE

## 1. Final Mandatory Schema List

| # | Change | Table | SQL | Why |
|---|---|---|---|---|
| M1 | Performance indexes | `accounting_ledger` | `CREATE INDEX ix_ledger_posting_date ON accounting_ledger(posting_date);`<br>`CREATE INDEX ix_ledger_source ON accounting_ledger(source_type, source_id);`<br>`CREATE INDEX ix_ledger_project ON accounting_ledger(project_code);`<br>`CREATE INDEX ix_ledger_fy ON accounting_ledger(financial_year_id);` | Query performance as data grows |
| M2 | Performance indexes | `accounting_ledger_lines` | `CREATE INDEX ix_lines_posting ON accounting_ledger_lines(posting_id);`<br>`CREATE INDEX ix_lines_cc ON accounting_ledger_lines(cc_id) WHERE cc_id IS NOT NULL;`<br>`CREATE INDEX ix_lines_vendor ON accounting_ledger_lines(vendor_id) WHERE vendor_id IS NOT NULL;`<br>`CREATE INDEX ix_lines_bank ON accounting_ledger_lines(bank_cash_id) WHERE bank_cash_id IS NOT NULL;`<br>`CREATE INDEX ix_lines_acct_type ON accounting_ledger_lines(account_type, dr_cr);` | Query performance for report joins |
| M3 | FY overlap prevention | `financial_year` | `CREATE EXTENSION IF NOT EXISTS btree_gist;`<br>`ALTER TABLE financial_year ADD CONSTRAINT no_fy_overlap EXCLUDE USING gist (daterange(start_date, end_date, '[]') WITH &&);` | Prevents overlapping FY date ranges. Single-company scope; add `company_id WITH =` when multi-company is needed. `btree_gist` is a built-in PostgreSQL extension. |
| M4 | FY audit columns | `financial_year` | `ALTER TABLE financial_year ADD COLUMN updated_by INTEGER REFERENCES users(id), ADD COLUMN updated_at TIMESTAMP;` | Audit trail for FY lock/unlock operations |
| M5 | One-reversal-per-original | `accounting_ledger` | `CREATE UNIQUE INDEX uq_ledger_one_reversal ON accounting_ledger(reversed_posting_id) WHERE is_reversal = TRUE AND reversed_posting_id IS NOT NULL;` | DB-level enforcement: at most one reversal per original posting. Belt-and-suspenders with application-level SELECT FOR UPDATE. |
| M6 | Ledger audit columns | `accounting_ledger` | `ALTER TABLE accounting_ledger ADD COLUMN updated_by INTEGER REFERENCES users(id), ADD COLUMN updated_at TIMESTAMP, ADD COLUMN posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;` | `posted_at` separates posting engine run time from document date |
| M7 | Stock ledger table | New `stock_ledger` | Full CREATE TABLE from PRAX_SCHEMA_PROPOSAL_v2.md §5, with:<br>- Partial unique: `uq_stock_original (source_type, source_id, source_line_id) WHERE is_reversal = FALSE`<br>- Partial unique: `uq_stock_one_reversal (reversed_stock_entry_id) WHERE is_reversal = TRUE AND reversed_stock_entry_id IS NOT NULL`<br>- Performance indexes on `(item_id, transaction_date)`, `project_code`, `transaction_date` | Required for inventory accounting, GRN/GIN valuation and cancellation |
| M8 | Cancellation audit columns | 12 source tables | `ALTER TABLE <each> ADD COLUMN cancelled_by INTEGER REFERENCES users(id), ADD COLUMN cancelled_at TIMESTAMP, ADD COLUMN cancellation_reason TEXT;`<br>Tables: PurchaseBillMaster, PaymentVoucherMaster, BillPaymentReceiptMaster, SaleBillMaster, SaleReceiptBillingMaster, JournalEntryMaster, ContraEntryMaster, DebitNoteMaster, CreditNoteMaster, PettyCashDocketVoucher, GrnMaster, GinMaster | Full cancellation audit trail (who/when/why). The cancellation_service already writes these via hasattr checks — adding the columns activates the audit. |

## 2. Optional Future Enhancements

| # | Change | Table | Why | When |
|---|---|---|---|---|
| O1 | `customer_id` denormalization | `accounting_ledger_lines` | Eliminates SaleOrder→OgSaleOrder join chain | When customer reporting needs optimization |
| O2 | `group_id` / `sub_group_id` | `accounting_ledger_lines` | Eliminates N+1 in trial balance and P&L | When report performance needs improvement |
| O3 | `company_id` | `financial_year` + `accounting_ledger` | Multi-company support | When multi-company is required |
| O4 | `chart_of_accounts` table | New table | Unified account numbering, hierarchical grouping | Phase 2 — existing GroupMaster + CCCode works |
| O5 | `opening_balance_detail` table | New table | Richer OB management, carry-forward | Phase 2 — current approach works |
| O6 | Explicit `ON DELETE RESTRICT` on all accounting FKs | All accounting tables | Belt-and-suspenders with application guards | Low priority — PostgreSQL default is already NO ACTION |

### REMOVED from proposal

| # | Change | Reason |
|---|---|---|
| ~~`idempotency_key`~~ | `VARCHAR(200) UNIQUE` on `accounting_ledger` | Not deterministic (timestamp-based). The partial unique index `(source_type, source_id) WHERE is_reversal = FALSE` already provides idempotent posting. Removed. |
| ~~`ON DELETE CASCADE`~~ on `opening_balance_detail.posting_id` | Was in the optional OB detail table proposal | Corrected to default (RESTRICT). All accounting FKs must use RESTRICT. |

## 3. Remaining Code-Only Work (no schema changes needed)

| # | Task | Status | Details |
|---|---|---|---|
| C1 | GRN/GIN `workflow_status != "Draft"` check in delete | ✅ Done | Added to `delete_grn` and `delete_gin` — blocks deletion of Reback/Approved/Cancelled documents even when `locked=False` |
| C2 | `cancellation_service` model_map includes GRN/GIN | ✅ Done | `_mark_source_cancelled()` now covers all 12 source document types |
| C3 | Frontend permission guards on all 19 accounting pages | ✅ Done | All use `getPageAccess({ pageCode: "profit_loss", pageType: "LIST" })` + `PageNotAvailable` |
| C4 | Sidebar permission keys for accounting pages | ✅ Done | All accounting sidebar entries have `permissionKey` in `sidebar.config.js` |
| C5 | Stock ledger service (reversal, WAC calculation) | ❌ Pending | Implement after stock_ledger table is migrated. Follows same SELECT FOR UPDATE + post-lock check pattern as `reverse_posting()`. |
| C6 | GRN/GIN posting rules | ❌ Pending | Implement after stock_ledger + new CC codes ("Inventory Asset", "Consumption Cost") are set up. Register in `posting_rules.py`. |
| C7 | Stock WAC running balance recalculation service | ❌ Pending | `recalculate_running_balances(item_id, project_code, location_id, from_date)` — called after mid-period corrections. Pure computation, no schema dependency beyond stock_ledger existing. |
| C8 | GIN rate lookup from WAC | ❌ Pending | GIN items have no rate; rate = `running_value / running_qty` at point of issue. Implement in GIN approval workflow after stock_ledger exists. |
| C9 | Backend per-route permission decorator for accounting | ❌ Not required | Existing pattern uses `@jwt_required()` only. Backend P&L and Balance Sheet routes follow the same pattern. Frontend guards are the permission enforcement layer. |

## 4. Unresolved Blockers

| # | Blocker | Blocks | Resolution |
|---|---|---|---|
| B1 | Schema approval | M1–M8 migrations | You must approve the mandatory schema list before any migration is created |
| B2 | `btree_gist` extension | M3 (FY overlap) | Needs to be enabled once by a superuser: `CREATE EXTENSION IF NOT EXISTS btree_gist;`. Available on all standard PostgreSQL installs including managed services. |
| B3 | New CC codes for Inventory | C6 (GRN/GIN posting rules) | Need "Inventory Asset" (Balance Sheet) and "Consumption Cost" (P&L) CC codes created in master data before posting rules can reference them |
| B4 | Rate lookup helper | C5, C6 | `GrnItem.order_item_id → OrderItem.rate` chain is verified but the helper function to fetch rate at GRN approval time needs to be written |

**No other blockers.** All code-only work (C1–C4) is complete. Remaining code work (C5–C8) is blocked only by schema approval + migration.

## 5. Exact Permission Mapping for New Accounting Pages

All 19 accounting pages use the **existing** `profit_loss` permission. No new FeaturePage records needed.

| Page | Route | Permission Check | pageCode | pageType |
|---|---|---|---|---|
| Dashboard | `/finance-management/report/accounting` | `getPageAccess({ pageCode: "profit_loss", pageType: "LIST" })` | `profit_loss` | `LIST` |
| General Ledger | `.../accounting/general-ledger` | Same | `profit_loss` | `LIST` |
| Trial Balance | `.../accounting/trial-balance` | Same | `profit_loss` | `LIST` |
| Profit & Loss | `.../accounting/profit-loss` | Same | `profit_loss` | `LIST` |
| Balance Sheet | `.../accounting/balance-sheet` | Same | `profit_loss` | `LIST` |
| Vendor Ledger | `.../accounting/vendor-ledger` | Same | `profit_loss` | `LIST` |
| Customer Ledger | `.../accounting/customer-ledger` | Same | `profit_loss` | `LIST` |
| Bank Ledger | `.../accounting/bank-ledger` | Same | `profit_loss` | `LIST` |
| CC-Code Ledger | `.../accounting/cc-ledger` | Same | `profit_loss` | `LIST` |
| Group Ledger | `.../accounting/group-ledger` | Same | `profit_loss` | `LIST` |
| Day Book | `.../accounting/day-book` | Same | `profit_loss` | `LIST` |
| Voucher Register | `.../accounting/voucher-register` | Same | `profit_loss` | `LIST` |
| Project Summary | `.../accounting/project-summary` | Same | `profit_loss` | `LIST` |
| Outstanding Payables | `.../accounting/outstanding-payables` | Same | `profit_loss` | `LIST` |
| Outstanding Receivables | `.../accounting/outstanding-receivables` | Same | `profit_loss` | `LIST` |
| GST Summary | `.../accounting/gst-summary` | Same | `profit_loss` | `LIST` |
| Financial Year | `.../accounting/financial-year` | Same | `profit_loss` | `LIST` |
| Historical Posting | `.../accounting/historical-posting` | Same | `profit_loss` | `LIST` |
| Opening Balance | `.../accounting/opening-balance` | Same | `profit_loss` | `LIST` |

**Sidebar config** (`sidebar.config.js` lines 622–738): Each accounting page entry has its own `permissionKey` (e.g., `accounting_ledger`, `accounting_trial_balance`). These keys control sidebar visibility. The page-level access check uses `profit_loss` as a unified gate — if a user has the `profit_loss` permission, they can access all accounting report pages. The sidebar `permissionKey` values provide finer-grained sidebar item visibility if separate permissions are added later.

**Backend**: Accounting API routes use `@jwt_required()` only — matching the existing pattern for P&L and Balance Sheet. No per-route permission decorator exists in the codebase; frontend guards are the enforcement layer.

---

## Code Changes Made (All Sessions Combined)

| File | Change | Session |
|---|---|---|
| `posting_engine.py:reverse_posting()` | Added `SELECT ... FOR UPDATE` lock + duplicate reversal check | This session |
| `opening_balance_service.py:list_opening_balances()` | Excludes reversed entries from listing | This session |
| `opening_balance_service.py:save_opening_balance()` | Excludes reversed entries from duplicate check | This session |
| `opening_balance_service.py:delete_opening_balance()` | Uses reversal instead of physical delete | Prior session |
| `cancellation_service.py` | Created. Added GRN/GIN to model_map this session | Prior + this session |
| `deletion_guard.py` | Created with guards + FY protection | Prior session |
| `routes.py` | `POST /cancel` and `GET /cancellation-status` endpoints | Prior session |
| All 11 delete functions | `check_posted_before_delete()` guard integrated | Prior session |
| `delete_grn` | Added `workflow_status != "Draft"` check | This session |
| `delete_gin` | Added `workflow_status != "Draft"` check | This session |
| All 19 accounting frontend pages | Added `getPageAccess` + `PageNotAvailable` guard | This session |
| `PRAX_SCHEMA_PROPOSAL_v2.md` | Updated: removed idempotency_key, fixed FY overlap to single-company, fixed stock_ledger UNIQUE to partial indexes, added one-reversal unique index | This session |
| `PRAX_DELETION_CANCELLATION_RESOLUTION.md` | Updated: all 7 resolution points addressed, final 5-item deliverable produced | This session |
