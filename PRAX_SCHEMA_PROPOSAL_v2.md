# PRAX ERP — Corrected & Improved Accounting Schema Proposal v2

**Status**: PENDING APPROVAL — no migration files will be created until you approve.

---

## Current State (3 tables already in code, not yet migrated)

| Table | Purpose | Status |
|---|---|---|
| `financial_year` | FY config (fy_code, start/end date, locked, current) | In `accounting.py`, all code uses it |
| `accounting_ledger` | Posting headers (source traceability, balanced Dr=Cr) | In `accounting.py`, all code uses it |
| `accounting_ledger_lines` | Posting line items (account, Dr/Cr, amount, GST, narration) | In `accounting.py`, all code uses it |

## What the current schema already covers well

- Source document traceability (`source_type` + `source_id`)
- Idempotent posting (partial unique index `WHERE is_reversal = FALSE` on `source_type, source_id`)
- One-reversal-per-original (partial unique index on `reversed_posting_id WHERE is_reversal = TRUE`)
- Reversal chain (`is_reversal`, `reversed_posting_id`)
- Balanced entry enforcement (`CHECK total_debit = total_credit`)
- Positive-only line amounts (`CHECK amount > 0`)
- Multi-project support (`project_code` FK to `projects`)
- Financial year linkage (`financial_year_id` FK)
- Account polymorphism (CC / Vendor / BankCash via `account_type` + FKs)
- GST dimensions (`gst_type`, `gst_rate` on lines)
- Source line traceability (`source_line_id` on lines)
- Audit info (`created_by`, `created_at`)
- Cost centre dimensions (`cost_centre_code`, `cc_id`)

## Proposed Improvements

### 1. `financial_year` table — overlap prevention + audit columns

```sql
ALTER TABLE financial_year
    ADD COLUMN updated_by INTEGER REFERENCES users(id),
    ADD COLUMN updated_at TIMESTAMP;

-- Prevent overlapping date ranges (requires btree_gist extension)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE financial_year
    ADD CONSTRAINT no_fy_overlap
    EXCLUDE USING gist (
        daterange(start_date, end_date, '[]') WITH &&
    );
```

**Why**: `updated_by`/`updated_at` for lock/unlock audit. The exclusion constraint prevents overlapping date ranges which would cause ambiguous FY resolution in `_resolve_fy()`.

**Single-company scope**: This constraint covers the current single-company setup. If multi-company is added later, the constraint becomes `EXCLUDE USING gist (company_id WITH =, daterange(...) WITH &&)` — a straightforward ALTER at that time. No `company_id` column is added now to avoid unused columns.

**`btree_gist` extension**: Required. This is a built-in PostgreSQL extension (ships with all standard installs, including managed services like RDS/Cloud SQL). It is not a third-party dependency. `CREATE EXTENSION IF NOT EXISTS btree_gist;` needs to be run once by a superuser or a user with CREATE privilege.

### 2. `accounting_ledger` table — add audit columns

```sql
ALTER TABLE accounting_ledger
    ADD COLUMN company_id        INTEGER REFERENCES companies(id),
    ADD COLUMN updated_by        INTEGER REFERENCES users(id),
    ADD COLUMN updated_at        TIMESTAMP,
    ADD COLUMN posted_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- One-reversal-per-original enforcement at DB level
CREATE UNIQUE INDEX uq_ledger_one_reversal
    ON accounting_ledger(reversed_posting_id)
    WHERE is_reversal = TRUE AND reversed_posting_id IS NOT NULL;

-- Performance indexes
CREATE INDEX ix_ledger_posting_date   ON accounting_ledger(posting_date);
CREATE INDEX ix_ledger_source         ON accounting_ledger(source_type, source_id);
CREATE INDEX ix_ledger_project        ON accounting_ledger(project_code);
CREATE INDEX ix_ledger_fy             ON accounting_ledger(financial_year_id);
CREATE INDEX ix_ledger_created_by     ON accounting_ledger(created_by);
```

**Why**:
- `company_id` for multi-company
- `posted_at` separates "when did the posting engine run" from `posting_date` (the document date)
- Explicit indexes for the query patterns in `ledger_service.py`

**Removed**: `idempotency_key` — the partial unique index `(source_type, source_id) WHERE is_reversal = FALSE` already provides idempotent posting. A timestamp-based key would not be deterministic across retries.

### 3. `accounting_ledger_lines` table — add dimensions + customer ref

```sql
ALTER TABLE accounting_ledger_lines
    ADD COLUMN customer_id    INTEGER REFERENCES vendors(id),
    ADD COLUMN group_id       INTEGER REFERENCES group_master(id),
    ADD COLUMN sub_group_id   INTEGER REFERENCES sub_group_master(id);

-- Performance indexes
CREATE INDEX ix_lines_posting    ON accounting_ledger_lines(posting_id);
CREATE INDEX ix_lines_cc         ON accounting_ledger_lines(cc_id) WHERE cc_id IS NOT NULL;
CREATE INDEX ix_lines_vendor     ON accounting_ledger_lines(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX ix_lines_bank       ON accounting_ledger_lines(bank_cash_id) WHERE bank_cash_id IS NOT NULL;
CREATE INDEX ix_lines_customer   ON accounting_ledger_lines(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX ix_lines_gst        ON accounting_ledger_lines(gst_type) WHERE gst_type IS NOT NULL;
CREATE INDEX ix_lines_acct_type  ON accounting_ledger_lines(account_type, dr_cr);
```

**Why**:
- `customer_id` eliminates the current join chain `SaleBill → SaleOrder → debtor_id` when querying customer ledger — the posting rule denormalizes it at write time
- `group_id` / `sub_group_id` — denormalized from CCCode to avoid N+1 queries in trial balance and P&L. Updated at posting time from the CC code's group.
- Partial indexes match the WHERE clauses in `ledger_service.py`

### 4. New table: `chart_of_accounts` (OPTIONAL — for proper COA)

```sql
CREATE TABLE chart_of_accounts (
    id           SERIAL PRIMARY KEY,
    company_id   INTEGER REFERENCES companies(id),
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    account_type VARCHAR(20) NOT NULL,  -- 'Asset', 'Liability', 'Income', 'Expense', 'Equity'
    parent_id    INTEGER REFERENCES chart_of_accounts(id),
    is_group     BOOLEAN DEFAULT FALSE,
    head_under   VARCHAR(50),  -- 'Profit & Loss', 'Balance Sheet'
    
    -- Links to existing master tables
    cc_id        INTEGER REFERENCES cc_codes(id),
    vendor_id    INTEGER REFERENCES vendors(id),
    bank_cash_id INTEGER REFERENCES bank_cash(id),
    
    is_active    BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(company_id, account_code)
);
```

**Why**: Currently the "chart of accounts" is implicitly composed of cc_codes + vendors + bank_cash. This table would provide:
- Unified account numbering
- Hierarchical grouping
- Explicit account type classification
- Proper display ordering for financial statements

**HOWEVER**: This is a LARGE change. The existing system works without it using GroupMaster + CCCode.group_id + head_under. **I recommend deferring this to Phase 2** unless you want it now.

### 5. New table: `stock_ledger` (REQUIRED for inventory accounting)

```sql
CREATE TABLE stock_ledger (
    id              SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    financial_year_id INTEGER REFERENCES financial_year(id),
    
    source_type     VARCHAR(50) NOT NULL,  -- 'grn', 'gin', 'opening_stock'
    source_id       INTEGER NOT NULL,
    source_line_id  INTEGER,               -- GrnItem.id or GinItem.id
    
    item_id         INTEGER NOT NULL,      -- links to indent_items or order_items
    item_code       VARCHAR(100),
    item_description TEXT,
    
    project_code    VARCHAR(50) REFERENCES projects(project_code),
    location_id     INTEGER,               -- warehouse/store location
    
    quantity        NUMERIC(14, 3) NOT NULL,  -- positive=in, negative=out
    rate            NUMERIC(14, 2) NOT NULL,  -- unit rate from PO
    amount          NUMERIC(14, 2) NOT NULL,  -- quantity × rate
    
    valuation_method VARCHAR(20) DEFAULT 'WEIGHTED_AVG',  -- 'WEIGHTED_AVG' recommended
    
    running_qty     NUMERIC(14, 3),  -- running balance qty
    running_value   NUMERIC(14, 2),  -- running balance value
    
    -- Reversal support (same pattern as accounting_ledger)
    is_reversal              BOOLEAN DEFAULT FALSE,
    reversed_stock_entry_id  INTEGER REFERENCES stock_ledger(id),
    
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
);

-- Partial unique index: one original entry per source line
CREATE UNIQUE INDEX uq_stock_original
    ON stock_ledger(source_type, source_id, source_line_id)
    WHERE is_reversal = FALSE;

-- Partial unique index: at most one reversal per original entry
CREATE UNIQUE INDEX uq_stock_one_reversal
    ON stock_ledger(reversed_stock_entry_id)
    WHERE is_reversal = TRUE AND reversed_stock_entry_id IS NOT NULL;

CREATE INDEX ix_stock_item     ON stock_ledger(item_id, transaction_date);
CREATE INDEX ix_stock_project  ON stock_ledger(project_code);
CREATE INDEX ix_stock_date     ON stock_ledger(transaction_date);
```

**Why**: Currently GRN has only `current_received_qty` and GIN has only `issue_qty` — no rate, no amount, no value. Without this table:
- Cannot compute inventory asset value for Balance Sheet
- Cannot compute cost of goods consumed for P&L (consumption cost)
- Cannot do FIFO/weighted average stock valuation
- Cannot show opening/closing stock in financial statements

**How it integrates**:
- Rate is pulled from the linked PurchaseOrder item at GRN time
- GRN creates positive entries (stock in), GIN creates negative entries (stock out)
- Opening stock is a special `source_type = 'opening_stock'`
- The accounting posting rules for GRN/GIN would create corresponding accounting entries:
  - GRN: Dr Inventory Asset (new BS CC code), Cr Goods-in-Transit/GRNI
  - GIN: Dr Consumption Expense (P&L CC code), Cr Inventory Asset

**Current limitation**: This cannot be implemented until GRN/GIN models are extended to carry or reference a rate. The `rate` here comes from `OrderItem.rate` via the GRN's linked purchase order. The schema is ready but the integration needs:
1. A helper to look up rate: `GrnItem → GrnMaster.order_id → OrderItem.rate` for the matching item
2. New CC codes for "Inventory Asset" and "Consumption Cost" 
3. Posting rules for GRN/GIN source types

### 6. New table: `opening_balance_detail` (OPTIONAL enhancement)

The current implementation stores opening balances as regular `accounting_ledger` postings with `source_type = 'opening_balance'`. This works correctly and flows through all reports.

If you want richer opening balance management (e.g., carried-forward from previous FY, auto-computation), an explicit tracking table could be added:

```sql
CREATE TABLE opening_balance_detail (
    id                SERIAL PRIMARY KEY,
    financial_year_id INTEGER NOT NULL REFERENCES financial_year(id),
    posting_id        INTEGER NOT NULL REFERENCES accounting_ledger(id),  -- RESTRICT (default)
    
    account_type      VARCHAR(20) NOT NULL,
    cc_id             INTEGER REFERENCES cc_codes(id),
    vendor_id         INTEGER REFERENCES vendors(id),
    bank_cash_id      INTEGER REFERENCES bank_cash(id),
    
    project_code      VARCHAR(50),
    dr_cr             VARCHAR(2) NOT NULL,
    amount            NUMERIC(14, 2) NOT NULL,
    
    source            VARCHAR(20) DEFAULT 'manual',  -- 'manual', 'carry_forward'
    source_fy_id      INTEGER REFERENCES financial_year(id),  -- if carried forward
    
);

-- Expression-based unique index (PostgreSQL does not support COALESCE in table UNIQUE)
CREATE UNIQUE INDEX uq_ob_detail_account ON opening_balance_detail(
    financial_year_id, account_type,
    COALESCE(cc_id, 0), COALESCE(vendor_id, 0),
    COALESCE(bank_cash_id, 0), COALESCE(project_code, '')
);
```

**Recommendation**: DEFER. The current `accounting_ledger` approach is simpler and works.

---

## 7. Deletion & Cancellation Safeguards (REQUIRED)

### 7.1 Foreign Key Protection — RESTRICT instead of CASCADE

The following FK constraints must use `ON DELETE RESTRICT` (or no action, which is the PostgreSQL default) to prevent accidental cascading deletion of accounting history:

```sql
-- accounting_ledger_lines.posting_id → accounting_ledger.id
-- Currently: ORM cascade="all,delete-orphan" (SQLAlchemy-level).
-- Database FK default is RESTRICT (no ON DELETE CASCADE), which is correct.
-- The ORM cascade is safe ONLY because we block physical deletion of
-- AccountingLedger records (see deletion_guard.py). The cascade only
-- fires on db.session.delete(posting), which the guard prevents.
-- Recommendation: Keep ORM cascade for dev convenience but add an
-- explicit database-level trigger or CHECK as belt-and-suspenders.

-- accounting_ledger.financial_year_id → financial_year.id
-- Already RESTRICT by default. Plus deletion_guard.check_fy_has_postings()
-- prevents deletion of FY records with posted transactions.

-- accounting_ledger.reversed_posting_id → accounting_ledger.id
-- Already RESTRICT by default. Reversal chain preserved.

-- accounting_ledger.project_code → projects.project_code
-- Already RESTRICT by default. Source references preserved.

-- accounting_ledger_lines.cc_id → cc_codes.id
-- Already RESTRICT by default. Account references preserved.

-- accounting_ledger_lines.vendor_id → vendors.id
-- Already RESTRICT by default. Account references preserved.

-- accounting_ledger_lines.bank_cash_id → bank_cash.id
-- Already RESTRICT by default. Account references preserved.
```

**Key point**: PostgreSQL defaults to `NO ACTION` (equivalent to RESTRICT for our purposes) on all FKs. None of the accounting FKs use `ON DELETE CASCADE` at the database level. The only cascade is at the ORM level (`cascade="all,delete-orphan"` on `AccountingLedger.lines`), which is safe because `deletion_guard.py` blocks physical deletion of posted accounting entries.

### 7.2 Cancellation Audit Columns (PROPOSED — needs approval)

To record full cancellation audit trail on source documents, the following columns are proposed for each source document master table (PurchaseBillMaster, PaymentVoucherMaster, BillPaymentReceiptMaster, SaleBillMaster, SaleReceiptBillingMaster, JournalEntryMaster, ContraEntryMaster, DebitNoteMaster, CreditNoteMaster, PettyCashDocketVoucher):

```sql
-- Add to each source document master table:
ALTER TABLE <table_name>
    ADD COLUMN cancelled_by       INTEGER REFERENCES users(id),
    ADD COLUMN cancelled_at       TIMESTAMP,
    ADD COLUMN cancellation_reason TEXT;
```

**Why**: Currently `workflow_status = 'Cancelled'` marks cancellation, but there's no record of who, when, or why. These columns provide a full audit trail.

**Interim**: The `cancellation_service.py` already writes these columns if they exist (via `hasattr` checks). The service works without them — the accounting reversal posting itself records `created_by` and `created_at`, providing basic audit. These columns are an enhancement for richer per-document audit.

### 7.3 Deletion Behavior Summary

| Document State | Delete Action | Behaviour |
|---|---|---|
| Draft (`locked=False`, no posting) | Physical DELETE | ✅ Allowed — existing behaviour preserved |
| In approval (`locked=True`, may not be posted) | Physical DELETE | ❌ Blocked by existing `locked` check |
| Approved & posted (`locked=True`, has posting) | Physical DELETE | ❌ Blocked by `locked` + `check_posted_before_delete()` |
| Approved & posted | Cancellation via API | ✅ Creates reversal posting, marks `workflow_status='Cancelled'` |
| Already cancelled/reversed | Cancellation again | ❌ Blocked — duplicate reversal prevention |

### 7.4 What was implemented (code-level, no schema changes)

1. **`deletion_guard.py`** — `check_posted_before_delete(model, id)` queries the accounting ledger to block physical deletion of posted documents. Integrated into all 11 delete functions.
2. **`cancellation_service.py`** — `cancel_posted_document(source_type, source_id, user_id, reason)` creates a reversal posting and marks the source document Cancelled.
3. **`opening_balance_service.py`** — `delete_opening_balance()` now creates a reversal instead of physical delete.
4. **`routes.py`** — Two new endpoints: `POST /cancel` and `GET /cancellation-status`.
5. **FY protection** — `check_fy_has_postings(fy_id)` prevents deletion of financial years with posted transactions.

### 7.5 Safeguards NOT requiring schema changes

These are enforced purely in application code:

- ✅ Draft documents can still be physically deleted (existing behaviour)
- ✅ Locked/approved documents cannot be deleted (existing `locked` check)
- ✅ Posted documents cannot be deleted even if `locked` were bypassed (new `check_posted_before_delete`)
- ✅ Cancellation creates reversal posting (opposite Dr/Cr, linked to original)
- ✅ Duplicate reversal prevention (checks for existing reversal before creating)
- ✅ Source document marked `Cancelled` (if `workflow_status` field exists)
- ✅ Opening balance "deletion" now creates reversal, not physical delete
- ✅ FY with posted transactions cannot be deleted
- ✅ All FK relationships use RESTRICT at database level (PostgreSQL default)

### 7.6 Safeguards that DO require schema changes (awaiting approval)

| Change | Why | Urgency |
|---|---|---|
| `cancelled_by`, `cancelled_at`, `cancellation_reason` on 12 source tables | Full cancellation audit trail | MEDIUM — works without, but audit is incomplete |
| `uq_ledger_one_reversal` unique index on `accounting_ledger` | DB-level one-reversal-per-original | HIGH — belt-and-suspenders with application-level check |
| Explicit `ON DELETE RESTRICT` on `accounting_ledger_lines.posting_id` FK | Belt-and-suspenders with the ORM guard | LOW — PostgreSQL default is already RESTRICT |
| `stock_ledger` table (from §5) with partial unique indexes | Inventory accounting + cancellation | HIGH when stock_ledger is implemented |

---

## Summary of Required vs Optional Changes

| Change | Priority | Blocked By |
|---|---|---|
| Performance indexes on `accounting_ledger` + `accounting_ledger_lines` | **HIGH** — needed as data grows | Nothing — can add anytime |
| `uq_ledger_one_reversal` partial unique index | **HIGH** — DB-level one-reversal-per-original | Nothing |
| FY date-range overlap prevention (exclusion constraint) | **HIGH** — prevents ambiguous FY resolution | `btree_gist` extension (built-in) |
| `stock_ledger` table (with partial unique indexes + reversal support) | **HIGH for inventory** — required for inventory accounting + cancellation | Rate lookup from PO, new CC codes |
| Cancellation audit columns on 12 source tables | **MEDIUM** — full cancellation audit trail | Nothing — 3 columns per table |
| `customer_id` on `accounting_ledger_lines` | **MEDIUM** — eliminates join chain | Nothing |
| `group_id` / `sub_group_id` on `accounting_ledger_lines` | **MEDIUM** — eliminates N+1 in reports | Nothing |
| `company_id` on `financial_year` + `accounting_ledger` | **LOW** — only if multi-company | Multi-company requirement |
| `chart_of_accounts` table | **LOW** — existing GroupMaster + CCCode works | Phase 2 decision |
| `opening_balance_detail` table | **LOW** — current approach works | Nothing |
| Explicit `ON DELETE RESTRICT` on accounting FKs | **LOW** — PostgreSQL default already provides this | Nothing |

---

## What I Need From You

1. **Approve the indexes** (items marked HIGH priority) — they're additive and safe
2. **Decide on `customer_id` and `group_id`/`sub_group_id` denormalization** — simplifies queries but needs backfill
3. **Decide on `stock_ledger`** — required for inventory accounting, but also requires rate-lookup logic
4. **Defer or approve `chart_of_accounts`** — major structural change, recommend Phase 2
5. **Confirm multi-company scope** — do FY and ledger need `company_id`?
6. **Approve cancellation audit columns** — `cancelled_by`, `cancelled_at`, `cancellation_reason` on the 10 source document tables. The cancellation service works without them (the reversal posting itself is the audit record) but these provide richer per-document traceability.

Once approved, I will create the migration file(s) with the exact SQL above.
