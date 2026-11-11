# PRAX ERP — Target Accounting Architecture

**Phase 2 Design Document — No Implementation**
**Date:** 2026-11-10
**Based on:** Phase 1 Audit Report (PRAX_ERP_ACCOUNTING_AUDIT_FINAL.md)

---

## Table of Contents

1. [Design Decision: Why a Separate Accounting Ledger](#1-design-decision)
2. [Existing Components We Can Reuse](#2-reusable-components)
3. [Missing Accounting Capabilities](#3-missing-capabilities)
4. [New Models Required](#4-new-models)
5. [Accounting Data Flow](#5-accounting-data-flow)
6. [Posting Rules for Every Transaction Type](#6-posting-rules)
7. [Ledger Calculation Rules](#7-ledger-rules)
8. [Trial Balance Calculation Rules](#8-trial-balance-rules)
9. [Profit & Loss Calculation Rules](#9-pl-rules)
10. [Balance Sheet Calculation Rules](#10-bs-rules)
11. [Project, Party, Cost Centre and Financial Year Traceability](#11-traceability)
12. [Opening Balance and Historical Data Strategy](#12-opening-balances)
13. [Reconciliation Checks and Validation Rules](#13-reconciliation)
14. [Implementation Phases](#14-implementation-phases)
15. [Decisions That Require Your Approval](#15-decisions)

---

## 1. Design Decision: Why a Separate Accounting Ledger

### The three options evaluated

**Option A: Extend existing `JournalEntryLine` as the universal ledger.**
Rejected. JournalEntryLine is tied to JournalEntryMaster which has its own workflow (Draft → Approved), project_code (mandatory), entry_mode, remarks, and manual approval chain. Forcing auto-posted entries from Purchase Bills, Sale Bills, etc. through this model would:
- Require faking workflow_status = "Approved" (bypassing the real approval chain)
- Conflate manual journal entries with system-generated postings
- Make JournalEntryMaster's list/search/approval pages show hundreds of auto-generated entries mixed with manual ones
- Break the existing Bill Payment Receipt flow which references `journal_entry_id` and `je_line_id` for manual JE lines
- JournalEntryMaster is project-scoped and the voucher_no generation assumes manual entry modes (JV/JB/JA)

**Option B: Introduce a separate `accounting_ledger` / `accounting_ledger_line` table pair.**
**Recommended.** A new centralised accounting layer that:
- Receives posted entries from ALL modules including Journal Entry
- Stores only the accounting impact, never the operational document
- Each line is Dr or Cr with full traceability (source_type, source_id, voucher_no)
- All reports (Ledger, Trial Balance, P&L, Balance Sheet) read from this single source
- Manual Journal Entries also post here when approved — they become just another source module
- Existing operational modules and workflows remain untouched

**Option C: Journal entries as source of truth + summary tables.**
Rejected for the same reasons as Option A, plus summary tables introduce synchronisation complexity.

### Why Option B is simplest and most reliable

1. **Clean separation:** Operational documents keep their workflows. Accounting layer stores only posted Dr/Cr facts.
2. **Single source of truth:** Every report reads from the same table. No more dual data paths.
3. **No workflow bypass:** Auto-posting writes directly to the accounting layer when the source document reaches "Approved" status. No fake JE workflow.
4. **Traceability:** Every accounting line traces back to its source document via `source_type` + `source_id`.
5. **Reversibility:** Corrections and cancellations post reverse entries, never delete existing rows.
6. **Existing JE still works:** Manual journal entries post to the accounting layer when approved, just like any other module. The existing JE workflow, approval chain, and Bill Payment Receipt linkage remain intact.

---

## 2. Existing Components We Can Reuse

### Keep as-is (no changes)

| Component | Why |
|-----------|-----|
| All operational models (PurchaseBillMaster, SaleBillMaster, PaymentVoucherMaster, BillPaymentReceiptMaster, ContraEntryMaster, DebitNoteMaster, CreditNoteMaster, SaleReceiptMaster, SaleReceiptBillingMaster, PettyCashDocketVoucher) | These remain the business documents. Their workflows, approval chains, and UI stay unchanged. |
| JournalEntryMaster + JournalEntryLine | Stays as the manual journal entry module. When approved, its lines post to the accounting layer. |
| CCCode + GroupMaster + SubGroupMaster + CategoryMaster | The existing chart of accounts hierarchy is sound. GroupMaster.head_under ("Profit & Loss" / "Balance Sheet") is the correct classification mechanism. |
| Vendor model | Continues as party master (creditors and debtors). |
| BankCash model | Continues as bank/cash account master. The accounting layer will give it accurate balances. |
| Workflow module | All existing approval workflows stay. Auto-posting hooks into the "Approved" transition. |
| BillPaymentReceiptItem.je_line_id | **Preserve this existing linkage.** Bill Payment already references JE lines for payment tracking. In the new architecture, the JE still posts to the accounting layer, and BPR also posts separately. The `je_line_id` remains for the existing operational flow (finding which JE lines a BPR pays against). |

### Modify (add auto-posting hooks only)

| Component | Change |
|-----------|--------|
| Each module's `approve_*` function | Add a call to `post_to_accounting_ledger()` after setting workflow_status = "Approved". This is a one-line function call added to each service. |
| Each module's `reback_*` function | If the document had been approved and posted, post a reversal. (In current code, reback sets status back to "Draft" — we must check if re-approval would double-post.) |

---

## 3. Missing Accounting Capabilities

| Capability | Status | Required For |
|------------|--------|-------------|
| Centralised accounting ledger table | Does not exist | All reports |
| Auto-posting from operational modules | Does not exist | Correct accounting |
| Financial Year model | Does not exist | Period reporting, opening balances |
| Opening Balance mechanism | Does not exist | Correct period balances |
| Trial Balance report | Does not exist | Verification, audit |
| Actual P&L (from posted entries) | Does not exist (current P&L uses budgets) | Correct profitability |
| Bank/cash balance from accounting entries | Does not exist (current BS uses PV/BPR directly) | Correct bank balances |
| Reversal/cancellation posting | Does not exist | Corrections without deletion |
| Account type for BankCash in JE lines | `JournalEntryLine` supports CC/Vendor/Customer but not BankCash | Bank/cash entries in accounting |

---

## 4. New Models Required

### 4.1 `AccountingLedger` (header)

```
Table: accounting_ledger

id                  INTEGER PK
posting_date        DATE NOT NULL              -- the business date of the transaction
financial_year_id   INTEGER FK → financial_year.id  (nullable initially for migration)
source_type         VARCHAR(50) NOT NULL       -- 'purchase_bill', 'sale_bill', 'payment_voucher',
                                               -- 'bill_payment', 'sale_receipt', 'sale_receipt_billing',
                                               -- 'contra_entry', 'debit_note', 'credit_note',
                                               -- 'journal_entry', 'petty_cash_docket', 'opening_balance'
source_id           INTEGER NOT NULL           -- PK of the source document's master table
voucher_no          VARCHAR(100) NOT NULL      -- the source document's voucher/receipt/bill number
project_code        VARCHAR(50) FK → projects  (nullable — some entries may be non-project)
remarks             TEXT
is_reversal         BOOLEAN DEFAULT FALSE      -- TRUE for reback/cancellation reversal entries
reversed_posting_id INTEGER FK → accounting_ledger.id  (the posting being reversed)
total_debit         NUMERIC(14,2) DEFAULT 0
total_credit        NUMERIC(14,2) DEFAULT 0

-- Audit
created_by          INTEGER FK → users.id
created_at          DATETIME
```

**Key design choices:**
- `source_type` + `source_id` gives full traceability to the original document
- `is_reversal` + `reversed_posting_id` handles corrections without deleting rows
- `posting_date` is the business date (from the source document), not the system timestamp
- One `accounting_ledger` row per approved source document (or per reversal)
- `total_debit` and `total_credit` must always be equal (balanced entry)

### 4.2 `AccountingLedgerLine` (line items)

```
Table: accounting_ledger_lines

id                  INTEGER PK
posting_id          INTEGER FK → accounting_ledger.id  NOT NULL
sl_no               INTEGER NOT NULL

-- Account identification (exactly ONE of these must be set)
account_type        VARCHAR(20) NOT NULL       -- 'CC', 'Vendor', 'BankCash'
cc_id               INTEGER FK → cc_codes.id   (when account_type = 'CC')
vendor_id           INTEGER FK → vendors.id    (when account_type = 'Vendor')
bank_cash_id        INTEGER FK → bank_cash.id  (when account_type = 'BankCash')

-- Dr/Cr
dr_cr               VARCHAR(2) NOT NULL        -- 'Dr' or 'Cr'
amount              NUMERIC(14,2) NOT NULL     -- always positive

-- Dimensions
project_code        VARCHAR(50) FK → projects  (nullable)
cost_centre_code    VARCHAR(50)                -- snapshot of cc_code for reporting (nullable)

-- GST (when applicable)
gst_type            VARCHAR(10)                -- 'IGST', 'CGST', 'SGST' or NULL
gst_rate            NUMERIC(5,2)               -- rate percentage or NULL

-- Source line traceability
source_line_id      INTEGER                    -- PK of the source document's line/item/gst row (optional)

created_at          DATETIME
```

**Key design choices:**
- `account_type` now includes 'BankCash' (the existing JournalEntryLine only has CC/Vendor/Customer)
- Single `amount` column (always positive) + `dr_cr` field, instead of separate debit_amount/credit_amount. This is cleaner and prevents the ambiguity of both being non-zero.
- `cost_centre_code` is a snapshot string for query convenience (the canonical reference is `cc_id`). This follows the existing denormalization pattern but the FK gives referential integrity.
- `gst_type` and `gst_rate` allow GST tracking at the accounting level without joining back to source GST tables.
- No `customer_ref` field. In PRAX, customers are projects (project_code). If a true customer master is needed later, add it then.

### 4.3 `FinancialYear`

```
Table: financial_year

id              INTEGER PK
fy_code         VARCHAR(10) UNIQUE NOT NULL     -- e.g. '2526' for April 2025 - March 2026
start_date      DATE NOT NULL
end_date        DATE NOT NULL
is_locked       BOOLEAN DEFAULT FALSE
is_current      BOOLEAN DEFAULT FALSE

created_by      INTEGER FK → users.id
created_at      DATETIME
```

### 4.4 `OpeningBalance`

```
Table: opening_balance

id                  INTEGER PK
financial_year_id   INTEGER FK → financial_year.id  NOT NULL
account_type        VARCHAR(20) NOT NULL       -- 'CC', 'Vendor', 'BankCash'
cc_id               INTEGER FK → cc_codes.id
vendor_id           INTEGER FK → vendors.id
bank_cash_id        INTEGER FK → bank_cash.id
project_code        VARCHAR(50) FK → projects  (nullable)

dr_cr               VARCHAR(2) NOT NULL        -- 'Dr' or 'Cr'
amount              NUMERIC(14,2) NOT NULL

remarks             TEXT
created_by          INTEGER FK → users.id
created_at          DATETIME
updated_at          DATETIME
```

**Opening balances are posted to the accounting ledger** as `source_type = 'opening_balance'` when the financial year is activated. They are not queried separately — the ledger is the single source. The `opening_balance` table is the input form / staging area.

---

## 5. Accounting Data Flow

### Current Flow (broken)

```
Purchase Bill ──→ (nothing) ──→ Balance Sheet queries JournalEntryLine (misses PB)
Sale Bill     ──→ (nothing) ──→ Balance Sheet queries SaleBillMaster directly (special calc)
Payment VCR   ──→ (nothing) ──→ Balance Sheet queries PaymentVoucherMaster directly
Bill Payment  ──→ (nothing) ──→ Balance Sheet queries BillPaymentReceiptMaster directly
Contra Entry  ──→ (nothing) ──→ (invisible to Balance Sheet)
Journal Entry ──→ JournalEntryLine ──→ Balance Sheet queries JournalEntryLine
```

### Target Flow (unified)

```
                                ┌──────────────────────────┐
Purchase Bill ─── on_approve ──→│                          │
Sale Bill     ─── on_approve ──→│                          │
Payment VCR   ─── on_approve ──→│   accounting_ledger      │──→ Ledger Report
Bill Payment  ─── on_approve ──→│   accounting_ledger_lines │──→ Trial Balance
Sale Receipt  ─── on_create  ──→│                          │──→ P&L
Sale Rcpt Billing on_approve ──→│                          │──→ Balance Sheet
Contra Entry  ─── on_approve ──→│                          │──→ Vendor Ledger
Debit Note    ─── on_approve ──→│                          │──→ My Ledger (Project)
Credit Note   ─── on_approve ──→│                          │──→ Bank/Cash Ledger
Journal Entry ─── on_approve ──→│                          │
Petty Cash DV ─── on_approve ──→│                          │
Opening Bal   ─── on_activate ─→│                          │
                                └──────────────────────────┘
```

### Auto-Posting Trigger

Each module's existing `approve_*()` function in its service.py file gets a single function call added at the end of a successful approval:

```python
# In purchase_bill/service.py, after setting workflow_status = "Approved":
from app.modules.finance.accounting import post_document
post_document(source_type="purchase_bill", source_id=bill.id, user_id=approved_by)
```

The `post_document()` function:
1. Checks if this document is already posted (prevents double posting)
2. Calls the posting rules function for that source_type
3. Creates one `AccountingLedger` row + balanced `AccountingLedgerLine` rows
4. Validates total_debit == total_credit before commit

### Reversal on Reback

When a document is rebacked (sent back from Approved to Draft):
1. Check if it has been posted to accounting_ledger
2. If yes, create a reversal posting: `is_reversal = True`, `reversed_posting_id = original_posting.id`
3. The reversal has identical lines but with Dr/Cr swapped
4. The original posting remains (audit trail preserved)

### Preventing Double Posting

The `post_document()` function queries:
```sql
SELECT id FROM accounting_ledger
WHERE source_type = :type AND source_id = :id AND is_reversal = FALSE
```
If a non-reversed posting already exists, it skips posting. This prevents:
- Double posting on re-approval after reback (because the original was reversed)
- Double posting on any duplicate call

---

## 6. Posting Rules for Every Transaction Type

### 6.1 Purchase Bill (on approval)

Records a vendor liability for goods/services received.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | CC Code (per item) — Expense/Asset | Dr | basic_amount per item | One line per PurchaseBillItem, using item's cc_code |
| 2 | CC Code (GST Input) — e.g. IGST/CGST/SGST input | Dr | gst_amount per GST row | One line per PurchaseBillGst row |
| 3 | Vendor (vendor_id) — Accounts Payable | Cr | total_invoice_amount | Single Cr line for the vendor |

**Example:** Purchase Bill for ₹100,000 basic + ₹18,000 IGST from Vendor A, items under CC code DRMR:
- Dr DRMR ₹100,000 (expense)
- Dr GST Input IGST ₹18,000
- Cr Vendor A ₹118,000

**CC Code for GST:** *Decision required — see Section 15.* We need a CC code (or set of CC codes) for GST Input (IGST, CGST, SGST). These may already exist in the cc_codes table or may need to be created. The audit found GST types are currently hardcoded strings, not CC codes.

### 6.2 Payment Voucher (on approval)

Records payment made to a vendor, reducing vendor liability and bank/cash balance.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | Vendor (vendor_id) — Accounts Payable | Dr | total_invoice_amount | Reduces what we owe |
| 2 | BankCash (bank_ac_id or cash_ac_id) | Cr | total_invoice_amount | Money goes out |

**Note:** If the Payment Voucher has GST (TDS deduction etc.), additional Dr/Cr lines for GST. Check if PV GST items represent TDS or other deductions — *this needs verification against actual usage*.

### 6.3 Bill Payment Receipt (on approval)

This is similar to Payment Voucher — it records payment against purchase bill JE lines. In the new architecture:

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | Vendor (vendor_id) — Accounts Payable | Dr | total_invoice_amount | Reduces payable |
| 2 | BankCash (bank_ac_id or cash_ac_id) | Cr | total_invoice_amount | Money goes out |

**Deduplication with Payment Voucher:** *Decision required — see Section 15.* Currently both Payment Voucher and Bill Payment Receipt exist as separate modules. Both represent vendor payments. In the accounting layer, both reduce vendor payable and bank/cash balance. We must ensure the same payment is not recorded in both modules. The existing code suggests PV is for direct payments and BPR is for payments against specific JE lines — clarify the business distinction.

### 6.4 Sale Bill (on approval)

Records a customer receivable for invoiced goods/services.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | CC Code — Sundry Debtors (CASD or per-project debtor code) | Dr | total_invoice_amount | Or a dedicated Receivable CC per project |
| 2 | CC Code (per item) — Income/Revenue | Cr | basic_amount per item | One line per SaleBillItem |
| 3 | CC Code (GST Output) — IGST/CGST/SGST output | Cr | gst_amount per GST row | One line per SaleBillGst row |

**Example:** Sale Bill for ₹500,000 basic + ₹90,000 GST:
- Dr CASD ₹590,000 (receivable)
- Cr CRIN ₹500,000 (income)
- Cr GST Output ₹90,000

### 6.5 Sale Receipt (on creation — no workflow)

Records receipt of payment from customer, reducing receivable and increasing bank/cash.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | BankCash (bank_ac_id or cash_ac_id) | Dr | total_amount | Money comes in |
| 2 | CC Code — Sundry Debtors (CASD) | Cr | total_amount | Reduces receivable |

**Note:** SaleReceiptMaster has no workflow_status. Posting triggers on creation. *Decision required — should Sale Receipt have a workflow?*

### 6.6 Sale Receipt Billing (on approval)

This is a more detailed sale receipt against specific certified bills. Same accounting treatment as Sale Receipt:

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | BankCash (bank_ac_id or cash_ac_id) | Dr | total_invoice_amount | Money comes in |
| 2 | CC Code — Sundry Debtors (CASD) | Cr | total_invoice_amount | Reduces receivable |

**Deduplication with Sale Receipt:** *Decision required — see Section 15.* SaleReceiptBillingMaster has `receipt` FK back to SaleReceiptMaster. Is the same money recorded in both? If Sale Receipt is the parent and Sale Receipt Billing is a child allocation, only the parent should post to the accounting layer (or only the children if the parent is just a grouping header).

### 6.7 Contra Entry (on approval)

Records transfer between bank/cash accounts. No vendor or CC code involved.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | BankCash (Dr side account_id) | Dr | amount | Destination account |
| 2 | BankCash (Cr side account_id) | Cr | amount | Source account |

Uses the existing `ContraEntryLine` rows which already have `dr_cr` and `account_id`.

### 6.8 Debit Note (on approval)

Reduces what we owe a vendor (return of goods, price adjustment, etc.).

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | Vendor (vendor_id) | Dr | total_amount | Reduces payable |
| 2 | CC Code (per item) — Expense reversal | Cr | basic amount per item | Returns expense |
| 3 | CC Code (GST Input reversal) | Cr | gst_amount per GST row | Reverses GST input |

### 6.9 Credit Note (on approval)

Increases what we owe a vendor (additional liability, error correction).

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | CC Code (per item) — Expense | Dr | basic amount per item | Additional expense |
| 2 | CC Code (GST Input) | Dr | gst_amount per GST row | Additional GST |
| 3 | Vendor (vendor_id) | Cr | total_amount | Increases payable |

**Note:** In PRAX, CreditNote has `sale_bill_id` (not purchase_bill_id), and DebitNote has `brr_id`. This suggests:
- Debit Note = raised against a vendor (reduces payable) — linked to BRR/Purchase side
- Credit Note = raised against a customer sale (reduces receivable?) — linked to Sale Bill

*Decision required:* The Cr/Dr treatment above assumes the standard accounting definition. But if PRAX uses Credit Note as "credit to vendor" (increasing payable), the treatment reverses. **The audit shows Vendor Ledger treats Credit Note as Credit (increases payable) and Debit Note as Debit (reduces payable).** So the rules above are correct as stated.

### 6.10 Journal Entry (on approval)

Manual journal entries post their lines directly to the accounting layer.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| — | Per JournalEntryLine | Dr or Cr | debit_amount or credit_amount | One accounting line per JE line |

Account mapping from JournalEntryLine:
- `account_type = 'CC'` → `cc_id` maps to accounting line `account_type = 'CC'`, `cc_id`
- `account_type = 'Vendor'` → `vendor_id` maps to accounting line `account_type = 'Vendor'`, `vendor_id`
- `account_type = 'Customer'` → This is a free-text field. *Decision required:* Map to a default "Sundry Debtors" CC code, or introduce a customer account type?

### 6.11 Petty Cash Docket Voucher (on approval)

Records petty cash expenditure.

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| 1 | CC Code (per item) — Expense | Dr | amount per item | From docket voucher details |
| 2 | BankCash (cash account or bank account) | Cr | total_amount | Petty cash out |

The cash/bank account is determined by `mode_of_payment`. The specific account comes from the linked Petty Cash Budget's bank/cash reference, or needs to be on the docket voucher itself.

*Decision required:* The docket voucher currently does not have a `bank_ac_id` or `cash_ac_id`. It has `mode_of_payment` ("Cash" or "Bank") but no specific account reference. We either need to add this field, or use a default petty cash account.

### 6.12 Opening Balance (on financial year activation)

| # | Account | Dr/Cr | Amount | Notes |
|---|---------|-------|--------|-------|
| — | Per OpeningBalance row | Dr or Cr | amount | One accounting line per opening balance entry |

The counter-entry is a dedicated "Opening Balance Equity" CC code that absorbs the difference, ensuring the opening entry is always balanced.

### 6.13 Advance Payment (vendor advance before purchase bill)

If a Payment Voucher or Bill Payment is made before the corresponding Purchase Bill exists, it should be treated as:

| # | Account | Dr/Cr | Amount |
|---|---------|-------|--------|
| 1 | CC Code — Advance to Vendors (e.g. CAAV) | Dr | amount |
| 2 | BankCash | Cr | amount |

When the Purchase Bill is later approved and the advance is adjusted:

| # | Account | Dr/Cr | Amount |
|---|---------|-------|--------|
| 1 | Vendor | Dr | advance amount |
| 2 | CC Code — Advance to Vendors | Cr | advance amount |

*Decision required:* Does PRAX currently track advance payments separately? The audit found `caav` (Advance to Vendors) is referenced but undefined in the Balance Sheet. How should advances be identified — by a flag on the Payment Voucher, or by the absence of a linked Purchase Bill?

### 6.14 Handling Partial Payments and Multi-Bill Payments

**Partial payment:** A Payment Voucher pays part of a Purchase Bill. The PV amount < PB total. The posting rule is the same — Dr Vendor, Cr Bank for the PV amount. The vendor's balance in the ledger naturally shows the remaining payable.

**Multi-bill payment:** A single Payment Voucher pays multiple Purchase Bills. Each PV item references a different PB (or JE line). The posting creates one balanced entry: Dr Vendor (total), Cr Bank (total). The vendor is the same, so it aggregates.

**Multiple partial payments:** Several PVs against one PB. Each PV posts independently. The vendor ledger shows each payment, and the running balance reduces correctly.

No special handling is needed — the accounting layer naturally supports these cases because each approved document posts its own balanced entry.

---

## 7. Ledger Calculation Rules

### General Ledger (any account)

```
Opening Balance (from opening_balance posting for the financial year)
+ All Dr postings in the period
- All Cr postings in the period
= Closing Balance
```

**Query:**
```sql
SELECT
  all.dr_cr,
  SUM(all.amount) as total
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
WHERE all.{account_type_column} = :account_id
  AND al.posting_date BETWEEN :from_date AND :to_date
GROUP BY all.dr_cr
```

### Vendor Ledger

Same as general ledger, filtered by `account_type = 'Vendor'` and `vendor_id = :id`.

- Opening balance: Sum of all vendor postings before `from_date`
- Transactions: Each posting with voucher_no, posting_date, source_type, Dr/Cr, amount
- Running balance: Cr (we owe) - Dr (we paid) = net payable
- Closing balance: Opening + Cr - Dr

### My Ledger (Project Ledger)

Same as general ledger, filtered by `project_code = :project_code`. Shows all accounts with activity in that project.

### Bank/Cash Ledger

Filtered by `account_type = 'BankCash'` and `bank_cash_id = :id`.

- Opening balance + Dr (deposits/receipts) - Cr (payments) = Closing balance

### Cost Centre Ledger

Filtered by `account_type = 'CC'` and `cc_id = :id`. Shows all postings to a specific CC code.

### Drill-down

Every ledger entry links back to the source document via `accounting_ledger.source_type` + `accounting_ledger.source_id`. The frontend can provide a "View Document" link for each entry.

---

## 8. Trial Balance Calculation Rules

**Source:** `accounting_ledger_lines` grouped by account.

```sql
SELECT
  all.account_type,
  all.cc_id, all.vendor_id, all.bank_cash_id,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as total_debit,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as total_credit
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
WHERE al.posting_date BETWEEN :from_date AND :to_date
GROUP BY all.account_type, all.cc_id, all.vendor_id, all.bank_cash_id
```

**Presentation:**

| Account | Opening Dr | Opening Cr | Period Dr | Period Cr | Closing Dr | Closing Cr |
|---------|-----------|-----------|----------|----------|-----------|-----------|
| ... | ... | ... | ... | ... | ... | ... |
| **Total** | **X** | **X** | **Y** | **Y** | **Z** | **Z** |

**Validation:** Total Dr MUST equal Total Cr at every level (opening, period, closing). If not, there is a posting error.

**Account grouping:** Group by GroupMaster.head_under to show P&L accounts and BS accounts separately.

---

## 9. Profit & Loss Calculation Rules

### Source: Accounting ledger, NOT budgets

The P&L report must use **actually posted** income and expense entries, not budget estimates.

**Income accounts:** All CC codes where `GroupMaster.head_under = 'Profit & Loss'` and the group is classified as income (e.g., the existing sale codes CRIN, CRHL, CRAP, etc.).

**Expense accounts:** All CC codes where `GroupMaster.head_under = 'Profit & Loss'` and the group is classified as expense (e.g., DRCW, DRMC, IRDC, etc.).

```
Income  = SUM(Cr amounts) - SUM(Dr amounts) for income CC codes in period
Expense = SUM(Dr amounts) - SUM(Cr amounts) for expense CC codes in period
Net P&L = Income - Expense
```

**Query:**
```sql
SELECT
  cc.cc_code,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as dr,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as cr
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
JOIN cc_codes cc ON all.cc_id = cc.id
JOIN group_master gm ON cc.group_id = gm.id
WHERE gm.head_under = 'Profit & Loss'
  AND al.posting_date BETWEEN :from_date AND :to_date
GROUP BY cc.cc_code
```

**Project-wise P&L:** Filter by `al.project_code` or `all.project_code`.

**Cost Centre-wise P&L:** Already grouped by CC code.

**The existing 50 hardcoded CC codes** in the P&L config can remain as the display layout (which codes to show in which section), but the actual amounts come from the accounting ledger instead of from budgets/sale orders.

**Budget comparison columns** (order, workDone, etc.) can remain as additional informational columns, clearly labeled as "Budget" vs "Actual". The "Actual" column comes from the accounting ledger.

---

## 10. Balance Sheet Calculation Rules

### Source: Accounting ledger + Opening balances

All Balance Sheet values come from the accounting ledger. No more special-case calculations.

**Assets = Liabilities + Equity** must be verified.

**Account classification:** `GroupMaster.head_under = 'Balance Sheet'` for all BS accounts. The group's sub-groups determine the BS section (Fixed Assets, Current Assets, Current Liabilities, etc.).

```sql
-- For each BS CC code:
SELECT
  cc.cc_code,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as dr,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as cr
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
JOIN cc_codes cc ON all.cc_id = cc.id
JOIN group_master gm ON cc.group_id = gm.id
WHERE gm.head_under = 'Balance Sheet'
  AND al.posting_date <= :to_date
GROUP BY cc.cc_code
```

**For Vendor/Party balances** (Sundry Creditors / Sundry Debtors):
```sql
SELECT
  all.vendor_id,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as dr,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as cr
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
WHERE all.account_type = 'Vendor'
  AND al.posting_date <= :to_date
GROUP BY all.vendor_id
```
- Vendors with net Cr balance = Sundry Creditors (liability)
- Vendors with net Dr balance = Sundry Debtors (asset) — or advance to vendor

**For Bank/Cash balances:**
```sql
SELECT
  all.bank_cash_id,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as dr,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as cr
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
WHERE all.account_type = 'BankCash'
  AND al.posting_date <= :to_date
GROUP BY all.bank_cash_id
```
- Dr - Cr = bank/cash balance (always should be positive in normal operation)

**GST balances:**
```sql
SELECT
  all.gst_type,
  SUM(CASE WHEN all.dr_cr = 'Dr' THEN all.amount ELSE 0 END) as input_gst,
  SUM(CASE WHEN all.dr_cr = 'Cr' THEN all.amount ELSE 0 END) as output_gst
FROM accounting_ledger_lines all
JOIN accounting_ledger al ON all.posting_id = al.id
WHERE all.gst_type IS NOT NULL
  AND al.posting_date <= :to_date
GROUP BY all.gst_type
```
- Net GST = Output (Cr) - Input (Dr). Positive = GST Payable (liability). Negative = Input Credit (asset).

**Current year P&L:**
The Balance Sheet includes "Reserves & Surplus" which contains the current year's P&L result. This is calculated by running the P&L query for the current financial year and adding the net result to Equity.

**No more hardcoded bank names, LON3 splits, or special calculations.** Every value comes from the same accounting ledger query pattern.

---

## 11. Project, Party, Cost Centre and Financial Year Traceability

### Project Traceability

- `accounting_ledger.project_code` and `accounting_ledger_lines.project_code` both carry the project
- Every report can be filtered by project
- Project-wise P&L and BS are just filters on the same queries

### Party (Vendor/Customer) Traceability

- `accounting_ledger_lines.vendor_id` identifies the party
- Vendor Ledger is a filtered view of the accounting ledger
- Vendor-wise Sundry Creditors/Debtors in BS are grouped vendor balances

### Cost Centre Traceability

- `accounting_ledger_lines.cc_id` with FK to `cc_codes.id` gives the cost centre
- `cost_centre_code` (snapshot string) allows efficient queries without joining cc_codes
- CC-wise P&L and BS are grouped views

### Financial Year Traceability

- `accounting_ledger.financial_year_id` FK to `financial_year.id`
- FY-wise reporting by filtering on `financial_year_id`
- Opening balances are FY-specific
- FY lock prevents postings to locked years

### Voucher-Level Traceability

- `accounting_ledger.source_type` + `source_id` + `voucher_no` trace to the exact source document
- `accounting_ledger_lines.source_line_id` traces to the exact line item in the source
- The frontend can render a clickable link: "PB-00123" → opens Purchase Bill #123

---

## 12. Opening Balance and Historical Data Strategy

### Problem

Existing approved transactions (Purchase Bills, Sale Bills, Payments, etc.) have no accounting entries in the system. We need to establish correct balances without:
- Retroactively auto-posting all historical documents (risky, could create incorrect entries)
- Losing the historical data
- Creating duplicate accounting for future transactions

### Recommended Strategy: Clean-Cut Migration

**Step 1: Choose a cut-over date** (e.g., April 1 of the next financial year, or a specific month-end).

**Step 2: Calculate opening balances** as of the cut-over date from existing data:
- **Vendor balances:** From existing vendor ledger logic (PB - BPR + CN - DN per vendor)
- **Bank balances:** From existing BS logic (BPR received - PV paid per bank)
- **CC code balances:** From existing JE lines (for codes that have JE activity)
- **GST balances:** From existing BS GST calculation
- **Sundry Debtors:** From existing BS CASD logic (SB total - SR total)
- **Cash balance:** Actual cash count (manual entry)

**Step 3: Enter opening balances** using the OpeningBalance table, one row per account with a non-zero balance.

**Step 4: Post opening balances** to the accounting ledger as `source_type = 'opening_balance'`. The entry is balanced using a "Retained Earnings / Opening Balance Equity" CC code.

**Step 5: From the cut-over date forward**, all new approvals auto-post to the accounting ledger. The old reports can remain available (marked as "Legacy" in the UI) for reference.

### Alternative: Backfill Historical Postings

For each previously approved document (PB, SB, PV, BPR, CV, DN, CN, JE):
1. Query all approved documents with `final_approved_at < cutover_date`
2. Run the posting rules to generate accounting entries
3. Set `posting_date` to the document's original date
4. Mark these as `source_type = '{module}_backfill'` for audit trail

**Risk:** This is safe ONLY if we can guarantee no document has been rebacked/re-approved after initial approval. If any have, we'd need to trace the full lifecycle.

**Recommendation:** Use the clean-cut approach for go-live. Offer backfill as an optional Phase 3 feature for historical reporting.

### Preventing Duplicate Postings During Transition

- The `post_document()` function always checks for existing non-reversed postings before creating new ones
- During the transition period, documents approved before the cut-over date should NOT be re-posted when their approve function runs (they were already captured in opening balances)
- Add a check: if `document.final_approved_at < cutover_date`, skip auto-posting

---

## 13. Reconciliation Checks and Validation Rules

### At Posting Time

1. **Balanced entry check:** `SUM(Dr amounts) == SUM(Cr amounts)` for every `accounting_ledger` posting. Reject unbalanced entries.
2. **No-duplicate check:** Query for existing non-reversed posting with same `source_type` + `source_id`.
3. **Financial year check:** If the FY for `posting_date` is locked, reject the posting.
4. **Account existence check:** Verify `cc_id`, `vendor_id`, or `bank_cash_id` references a valid, active master record.

### Periodic Reconciliation

5. **Trial Balance check:** Run monthly. Total Dr must equal Total Cr. Any imbalance indicates a posting bug.
6. **Vendor balance reconciliation:** Compare vendor balances from the accounting ledger with the existing vendor ledger calculation. Differences indicate missing postings.
7. **Bank balance reconciliation:** Compare bank balances from the accounting ledger with actual bank statements (manual process).
8. **Inter-module reconciliation:**
   - Count of approved Purchase Bills = Count of PB postings in accounting_ledger
   - Same for all other modules
   - Flag any approved document without a corresponding posting

### System Integrity Checks

9. **Orphan check:** Any `accounting_ledger` row whose `source_type` + `source_id` doesn't match an existing document.
10. **Reversal integrity:** Every reversal (`is_reversal = TRUE`) must have a valid `reversed_posting_id`. Every reversed posting must have a corresponding reversal.
11. **CC code referential integrity:** All `cc_id` values in accounting lines must reference active CC codes.

---

## 14. Implementation Phases

### Phase 1: Foundation (Minimal Viable Accounting)

**Goal:** Establish the accounting layer and get the first module posting.

1. **Create new models:** `FinancialYear`, `AccountingLedger`, `AccountingLedgerLine`, `OpeningBalance`
2. **Create posting engine:** `app/modules/finance/accounting/` with `post_document()`, `reverse_posting()`, and posting rule functions
3. **Create GST CC codes** (if they don't exist): Input IGST, Input CGST, Input SGST, Output IGST, Output CGST, Output SGST
4. **Hook Journal Entry approval** → auto-post to accounting layer (start with JE because it's the simplest — its lines are already Dr/Cr balanced)
5. **Create Trial Balance report** reading from accounting_ledger_lines
6. **Create basic General Ledger report** reading from accounting_ledger_lines

**No existing reports change in Phase 1.** The new reports run alongside the old ones.

### Phase 2: Core Transaction Posting

**Goal:** All major financial documents post to the accounting layer.

7. **Hook Purchase Bill approval** → auto-post
8. **Hook Payment Voucher approval** → auto-post
9. **Hook Bill Payment Receipt approval** → auto-post
10. **Hook Sale Bill approval** → auto-post
11. **Hook Sale Receipt creation** → auto-post
12. **Hook Sale Receipt Billing approval** → auto-post
13. **Hook Contra Entry approval** → auto-post
14. **Hook Debit Note approval** → auto-post
15. **Hook Credit Note approval** → auto-post
16. **Hook Petty Cash Docket Voucher approval** → auto-post
17. **Implement reversal on reback** for all hooked modules
18. **Build reconciliation dashboard** (approved document count vs posting count)

### Phase 3: Report Migration

**Goal:** Switch financial reports to use the accounting layer.

19. **New P&L report** (Actual from accounting layer + Budget columns for comparison)
20. **New Balance Sheet** (all values from accounting layer)
21. **New Vendor Ledger** (from accounting layer)
22. **New My Ledger** (from accounting layer)
23. **New Bank/Cash Ledger** (from accounting layer)
24. **Financial Year management UI** (create FY, lock FY)
25. **Opening Balance entry UI**

### Phase 4: Historical Data and Polish

26. **Opening balance calculation tool** (calculates balances from existing data as of cut-over date)
27. **Historical backfill tool** (optional — posts historical approved documents)
28. **Deprecate old report endpoints** (keep accessible but marked "Legacy")
29. **GST report preparation** (GSTR-1/3B from accounting ledger GST data)

---

## 15. Decisions That Require Your Approval

### Decision 1: GST CC Codes

The accounting layer needs CC codes for GST accounts. Options:

**A.** Create 6 new CC codes: `GSTI_IGST`, `GSTI_CGST`, `GSTI_SGST` (input), `GSTO_IGST`, `GSTO_CGST`, `GSTO_SGST` (output), classified under a "GST" Balance Sheet group.

**B.** Use the existing `gst_type` column on `accounting_ledger_lines` to track GST without dedicated CC codes. GST balances are queried by `gst_type` filter, not by CC code.

**Recommendation:** Option B is simpler. We already have `gst_type` and `gst_rate` on the accounting line. GST is fundamentally a tax attribute, not an account. The Balance Sheet can show GST balances by querying `WHERE gst_type IS NOT NULL`.

### Decision 2: Payment Voucher vs Bill Payment Receipt

Both represent vendor payments. What is the business distinction?

**Current understanding from the code:**
- Payment Voucher = payment based on CC code allocation (does not reference specific JE lines)
- Bill Payment Receipt = payment against specific JE lines created for a vendor purchase

**Question:** Should both continue to exist as separate posting sources? Or should one be deprecated?

**My recommendation:** Keep both. They serve different business workflows. Both post the same accounting treatment (Dr Vendor, Cr Bank).

### Decision 3: Sale Receipt Posting

SaleReceiptMaster has no `workflow_status`. It is created directly (no approval workflow).

**Options:**
- A. Post on creation (current behavior — it's live immediately)
- B. Add workflow to Sale Receipt (requires schema + UI changes)

**Recommendation:** Option A for now. Post on creation. Add workflow later if needed.

**Sub-question:** SaleReceiptBillingMaster is a child of SaleReceiptMaster and HAS workflow. Should only the child post (to avoid double-counting)?

If both parent and child represent the same money, only the child (Sale Receipt Billing) should post, since it has workflow approval. The parent (Sale Receipt) is just a payment grouping header.

**I need your confirmation:** Does the Sale Receipt total_amount represent the same money that is allocated across its Sale Receipt Billing children? If yes, only the children should post.

### Decision 4: Petty Cash Docket Voucher Cash/Bank Account

The docket voucher has `mode_of_payment` ("Cash" or "Bank") but no `bank_ac_id` or `cash_ac_id`. For the accounting posting, we need to know WHICH bank/cash account.

**Options:**
- A. Add `bank_ac_id` / `cash_ac_id` to PettyCashDocketVoucher model (schema change)
- B. Use the linked Petty Cash Budget's bank/cash reference
- C. Use a system-wide default petty cash account

**Recommendation:** Option A is cleanest. It's a nullable FK, backward compatible. But this requires a schema change — your approval needed.

### Decision 5: Journal Entry Customer Lines

JournalEntryLine supports `account_type = 'Customer'` with a free-text `customer_ref` field. This cannot be posted to the accounting layer because there's no customer master to reference.

**Options:**
- A. Map customer lines to a default "Sundry Debtors" CC code (CASD or a new one)
- B. Skip customer lines in auto-posting (they remain only in the JE module)
- C. Create a Customer master table (significant new feature)

**Recommendation:** Option A for now. Map to CASD with `customer_ref` stored in a remarks/description field on the accounting line.

### Decision 6: Cut-Over Date

When should the accounting layer become the source of truth?

**Recommendation:** Start of the next financial year (April 1). This gives a clean FY boundary for opening balances.

### Decision 7: Advance Payment Tracking

How should advance payments (payment before purchase bill) be identified and tracked?

**Options:**
- A. A flag on Payment Voucher / Bill Payment (`is_advance = True`)
- B. A separate advance payment module
- C. Detect automatically: if a payment has no linked purchase bill, treat it as advance

**Recommendation:** Option C with a dedicated "Advance to Vendors" CC code (CAAV). When a PV has no purchase bill reference, Dr CAAV instead of Dr Vendor. When the PB is later approved and paid, the advance is adjusted via a manual JE.

**Question for you:** How does PRAX currently handle vendor advances? Is there an existing workflow?

### Decision 8: Reback from Approved State

When a document is rebacked from "Approved" back to "Draft":
- The accounting posting must be reversed
- If the document is then edited and re-approved, it gets a new posting

**Question:** Can an approved document currently be rebacked in PRAX? The audit shows Reback exists in the workflow, but is it used on already-approved documents, or only on pending ones?

If Reback only applies to Pending (not yet approved) documents, then reversal logic is not needed in Phase 1.

---

## Summary

This architecture introduces a **centralised accounting ledger** (`accounting_ledger` + `accounting_ledger_lines`) that:

1. **Receives balanced Dr/Cr entries** from every financial module when documents are approved
2. **Stores only the accounting impact** — source documents and their workflows remain unchanged
3. **Provides a single source of truth** for all financial reports (Ledger, Trial Balance, P&L, Balance Sheet)
4. **Supports full traceability** from any accounting entry back to its source document
5. **Handles reversals** for corrections without deleting data
6. **Supports financial years** with opening/closing balance carry-forward
7. **Eliminates hardcoded special calculations** — every balance comes from the same query pattern
8. **Prevents duplicate postings** through idempotent posting checks

The existing JournalEntryLine is **not extended or replaced** — it remains as the manual journal entry module's storage. Journal entries post to the accounting layer like any other module.

No code, schema, or data changes have been made. All changes require your explicit approval.

---

*End of Target Architecture Document*
