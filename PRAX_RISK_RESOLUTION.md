# PRAX ERP — Critical Accounting & Integration Risk Resolution

> **Date:** 2026-11-10
> **Scope:** Code-verified business rules, Dr/Cr posting examples, model corrections, implementation sequence, reconciliation plan
> **Constraint:** No code changes, no schema changes, no commits — research deliverable only

---

## Table of Contents

1. [Risk 1: Payment Voucher vs Bill Payment Receipt](#risk-1)
2. [Risk 2: Sale Receipt vs Sale Receipt Billing](#risk-2)
3. [Risk 3: Debit Note and Credit Note](#risk-3)
4. [Risk 4: Vendor Advances Tracking](#risk-4)
5. [Risk 5: Customer Accounting Identity](#risk-5)
6. [Risk 6: GST Input/Output Account Treatment](#risk-6)
7. [Risk 7: Cost Centre and Project Dimensions](#risk-7)
8. [Risk 8: Posting Lifecycle](#risk-8)
9. [Risk 9: Opening Balances from Legacy Records](#risk-9)
10. [Risk 10: Bank/Cash and Petty Cash Account Identification](#risk-10)
11. [Atomicity, Duplicate Prevention, and Consistency](#atomicity)
12. [Unresolved Business Decisions](#decisions)
13. [Model Corrections Required](#corrections)
14. [Safe Implementation Sequence](#sequence)
15. [Reconciliation and Testing Plan](#testing)

---

<a id="risk-1"></a>
## Risk 1: Payment Voucher vs Bill Payment Receipt — Business Purpose

### Verified Business Rules (from code)

**Payment Voucher (PV)** — `paymentVoucher.py`, `payment_voucher/service.py`
- Direct payment to a vendor against **CC codes** (cost-centre accounts), NOT against specific purchase bills.
- Master has: `vendor_id`, `payment_mode` (Cash/Bank), `cash_ac_id`/`bank_ac_id` (FK → `bank_cash`), `total_invoice_amount`, `gst_amount`.
- Items have: `cc_code_id` (FK → `cc_code`), `cc_code` (string), `booked_amount`, `current_amount`.
- **No `purchase_bill_id` FK** — PV cannot reference a specific purchase bill.
- `_MODULE = "payment"` (shares workflow module code with BPR).

**Bill Payment Receipt (BPR)** — `billPaymentReceipt.py`, `bill_payment/service.py`
- Two distinct modes controlled by `payment_type`:
  - **`"bill"`** — Payment against specific PurchaseBill line items via `pb_item_id` FK on BPR items. Uses `purchase_bill_id` FK on master. Service uses `_paid_item_map` and `_paid_gst_map` to track what's been paid.
  - **`"voucher"`** — Payment against specific JournalEntry lines via `je_line_id` FK on BPR items. Uses `journal_entry_id` FK on master. Service uses `_paid_je_line_map`.
- Master also has: `vendor_id`, `payment_mode`, `cash_ac_id`/`bank_ac_id`, `total_invoice_amount`, `gst_amount`.
- `_MODULE = "payment"` (same as PV).

### Correct Dr/Cr Posting Rules

**Payment Voucher (PV) — Approved:**
```
Dr  CC-Code Account (expense/asset)     ₹ item.current_amount  (per item)
Dr  GST Input (IGST/CGST/SGST)          ₹ gst_amount           (if any)
    Cr  Bank/Cash Account                ₹ total_invoice_amount
    Cr  Vendor (Sundry Creditor)         ₹ total_invoice_amount  (sub-ledger)
```
> Note: PV reduces the bank and creates an expense in the CC code. The vendor sub-ledger posting depends on whether this is treated as an advance or a direct expense — see Risk 4.

**BPR type="bill" — Approved:**
```
Dr  Vendor (Sundry Creditor)             ₹ total_invoice_amount  (clears payable)
Dr  GST Input (IGST/CGST/SGST)          ₹ gst_paid              (if any)
    Cr  Bank/Cash Account                ₹ total_invoice_amount
```
> The purchase bill already created the expense (Dr CC-code, Cr Vendor). BPR settles the payable by debiting vendor and crediting bank.

**BPR type="voucher" — Approved:**
```
Dr  JE Line Account (as per JE)         ₹ per-line amount
    Cr  Bank/Cash Account                ₹ total_invoice_amount
```
> Pays against specific journal entry lines. The JE already booked the accounting; BPR-voucher settles the cash side.

### Key Risk: Shared `_MODULE = "payment"`
Both PV and BPR share `_MODULE = "payment"` for workflow purposes. The accounting ledger posting code must distinguish them by model type, not module code. The posting function should check `isinstance(document, PaymentVoucherMaster)` vs `isinstance(document, BillPaymentReceiptMaster)`.

---

<a id="risk-2"></a>
## Risk 2: Sale Receipt vs Sale Receipt Billing — Parent/Child

### Verified Business Rules (from code)

**SaleReceiptMaster** — `saleReceipt.py`
- **Parent/header** record — groups one or more billing allocations.
- Has: `payment_mode`, `cash_ac_id`/`bank_ac_id` (FK → `bank_cash`), `total_amount`, `entry_date`.
- **NO `workflow_status`** — no approval workflow. All records are treated as valid/active.
- Service (`sale_receipt/service.py`) is simple CRUD with no approve/reject/reback.

**SaleReceiptBillingMaster** — `saleReceiptBilling.py`
- **Child** record — individual billing allocation under a receipt.
- Has: `receipt_id` (FK → `sale_receipt_master`), `total_invoice_amount`, `gst_amount`.
- **HAS `workflow_status`** (Draft → Pending → Approved).
- **Does NOT have** its own `bank_ac_id`/`cash_ac_id` — inherits payment details from parent SaleReceiptMaster.
- Has its own GST lines (`SaleReceiptGst`).

### Correct Dr/Cr Posting Rules

**Post on SaleReceiptBilling approval (not SaleReceipt creation):**
```
Dr  Bank/Cash Account                    ₹ billing.total_invoice_amount  (from parent's bank_ac_id)
    Cr  Customer/Sundry Debtor           ₹ billing.total_invoice_amount  (reduces receivable)
    Cr  GST Output (IGST/CGST/SGST)     ₹ gst_amount                   (if collected on receipt)
```

### Key Risk: Payment Account Inheritance
The bank/cash account for posting comes from the **parent** SaleReceiptMaster, not the child. The posting function must traverse `billing.receipt` → `receipt.bank_ac_id` / `receipt.cash_ac_id`. If the parent is deleted or changed after billing approval, the posting loses its payment reference. **Decision needed**: should SaleReceiptBillingMaster store its own copy of `bank_ac_id`/`cash_ac_id` at creation time?

---

<a id="risk-3"></a>
## Risk 3: Debit Note and Credit Note — Exact Business Meanings

### Verified Business Rules (from code)

**Debit Note (DN)** — `debitNote.py`
- Linked to **purchase side** via `brr_id` FK (Bill Receive Register).
- Has: `vendor_id`, `gst_amount`, `total_amount`, items with `cc_code` (string).
- GST lines: `DebitNoteGst` with `gst_type` (IGST/CGST/SGST), `gst_amount`, `is_selected`.
- **Business meaning**: Issued TO a vendor to reduce the amount payable (e.g., goods returned, overcharge correction). Debits the vendor account (reduces what we owe them).

**Credit Note (CN)** — `creditNote.py`
- Linked to **sale side** via `sale_bill_id` FK.
- Has: `vendor_id`, `gst_amount`, `total_amount`, items with `cc_code` (string).
- GST lines: `CreditNoteGst` with `gst_type` (IGST/CGST/SGST), `gst_amount`, `is_selected`.
- **Business meaning**: Issued TO a customer to reduce the amount receivable (e.g., sales return, discount). Credits the customer account (reduces what they owe us).

### Correct Dr/Cr Posting Rules

**Debit Note — Approved:**
```
Dr  Vendor (Sundry Creditor)             ₹ total_amount    (reduces payable to vendor)
    Cr  CC-Code Account (expense reversal)  ₹ item amounts  (per item)
    Cr  GST Input Reversal               ₹ gst_amount      (reverses input credit)
```

**Credit Note — Approved:**
```
Dr  Sales Return / CC-Code Account       ₹ item amounts    (per item)
Dr  GST Output Reversal                  ₹ gst_amount      (reverses output liability)
    Cr  Customer (Sundry Debtor)         ₹ total_amount    (reduces receivable)
```

### Key Risk: `vendor_id` on CreditNote
CreditNote has `vendor_id` but it represents a **customer** in this context (issued to reduce customer receivable). The Vendor model's `is_debtor` flag distinguishes: `is_debtor=True` → customer/debtor, `is_debtor=False` → vendor/creditor. The posting code must check `is_debtor` to determine the correct sub-ledger account type.

### Key Risk: CC Code as String (No FK)
Both DN and CN items store `cc_code` as a **plain string**, not an FK to `cc_code` table. The posting code must look up the CCCode record by string value. If the string doesn't match any CC code, posting must fail with a clear error — never silently skip.

---

<a id="risk-4"></a>
## Risk 4: Vendor Advances Tracking

### Verified Finding: No Explicit Advance Mechanism

**Code evidence**: Searched all models and services — there is **no** `advance_amount`, `advance`, `prepaid`, or `unadjusted` field or concept anywhere in the codebase. The word "advance" does not appear in any finance model or service.

**Current implicit behavior**:
- Payment Voucher pays at CC-code level without referencing a purchase bill.
- If a PV is created and approved BEFORE a purchase bill exists, it is effectively a **vendor advance** — money paid without a matching liability.
- There is no mechanism to later "adjust" a PV against a subsequently created purchase bill.

### Accounting Treatment for the Centralised Ledger

**Option A (Recommended — Minimal Change):**
Treat PV as a direct expense posting (Dr CC-code, Cr Bank). No advance tracking. If the business later gets an invoice for an already-paid PV, they create a journal entry to reverse the CC-code expense and recognize the proper purchase bill.

**Option B (Full Advance Tracking — Requires Decision):**
Create a new "Vendor Advances" account (e.g., `CAAP` already exists as "Advance Against Purchase" in BS). PV postings would:
```
Dr  CAAP (Advance Against Purchase)     ₹ amount
    Cr  Bank/Cash Account               ₹ amount
```
When the purchase bill arrives and BPR is created:
```
Dr  Vendor (Sundry Creditor)            ₹ amount
    Cr  CAAP (adjust advance)           ₹ amount
```

> **DECISION REQUIRED**: Does a Payment Voucher represent (a) a direct expense, or (b) an advance payment to a vendor? This determines whether PV posts to the CC-code expense directly or to the CAAP advance account. See [Unresolved Decisions](#decisions).

---

<a id="risk-5"></a>
## Risk 5: Customer Accounting Identity

### Verified Finding: No Dedicated Customer Model

**Code evidence** — `journalEntry.py:204`, `vendor.py:64-66`:
- JournalEntryLine has `account_type` with three options: `"CC"`, `"Vendor"`, `"Customer"`.
- When `account_type = "Customer"`, the identity is stored as `customer_ref` — a **free-text string**, not a FK to any table.
- The Vendor model has `is_debtor = db.Column(db.Boolean, default=False)` — vendors with `is_debtor=True` are treated as debtors/customers in some contexts.
- SaleBillMaster has **no** `customer_id` or `customer_ref` field — it doesn't track who the customer is.
- SaleReceiptMaster also has **no** customer identifier.

**Current sundry debtors calculation** — `balance_sheet/service.py:321-349`:
```python
CASD = approved_sale_bill_totals - sale_receipt_totals
```
This is a **global aggregate** — no per-customer breakdown is possible. All customers are lumped into one CASD number.

### Risks for the Centralised Ledger

1. **No customer sub-ledger possible** without a customer master. Customer-specific receivable tracking requires knowing WHO owes us money.
2. **JE lines with `account_type="Customer"`** store customer identity as free text (`customer_ref`) — no way to aggregate or validate.
3. **Credit Notes** use `vendor_id` for the customer party, relying on `is_debtor=True` to distinguish.

### Recommendation

For the accounting ledger, customer postings should use:
- `party_type = "Vendor"` with `party_id` pointing to the Vendor record where `is_debtor=True` (for Sale Bill, Sale Receipt, Credit Note).
- `party_type = "Customer"` with `party_ref` (string) for JE lines that use `customer_ref` (backward compatibility for existing data).

> **DECISION REQUIRED**: Should a proper `Customer` model be created, or continue using Vendor with `is_debtor=True`? See [Unresolved Decisions](#decisions).

---

<a id="risk-6"></a>
## Risk 6: GST Input/Output Account Treatment

### Verified Business Rules (from code)

**GST is NOT tracked via CC codes or the chart of accounts.** It is tracked via **separate GST sub-tables** on each source document:

| Module | GST Model | Fields |
|--------|-----------|--------|
| SaleBill | `SaleBillGst` | `gst_type` (IGST/CGST/SGST), `gst_amount`, `is_selected` |
| PurchaseBill | `PurchaseBillGst` | same pattern |
| BillPaymentReceipt | `BillPaymentReceiptGst` | same + `current_amount` |
| SaleReceiptBilling | `SaleReceiptGst` | same |
| DebitNote | `DebitNoteGst` | same |
| CreditNote | `CreditNoteGst` | same |
| PaymentVoucher | *(master-level `gst_amount` only, no GST sub-table)* | |

**Current GST calculation** — `balance_sheet/service.py:262-318`:
```python
GST Output = SUM(SaleBillGst.gst_amount WHERE is_selected AND approved)
GST Input  = SUM(BillPaymentReceiptGst.current_amount WHERE approved)
Net GST Payable = Output - Input
```

**Critical findings:**
1. GST Output comes from **SaleBill** GST lines (when `is_selected=True`).
2. GST Input comes from **BillPaymentReceipt** GST lines (paid GST, not booked GST).
3. Purchase Bill GST (`PurchaseBillGst`) is **not used** in the BS calculation — only the paid portion via BPR counts.
4. DebitNote GST and CreditNote GST are **not included** in the BS GST calculation — this is a gap.
5. SaleReceiptBilling GST is **not included** — another gap.
6. PaymentVoucher has only a master-level `gst_amount`, no breakdown by type — cannot split into IGST/CGST/SGST.

### Correct GST Posting Rules for the Centralised Ledger

The accounting ledger needs **six virtual/system accounts** for GST (not CC codes):

| Account | Type | Posted By |
|---------|------|-----------|
| `GST_OUTPUT_IGST` | Liability | SaleBill approval |
| `GST_OUTPUT_CGST` | Liability | SaleBill approval |
| `GST_OUTPUT_SGST` | Liability | SaleBill approval |
| `GST_INPUT_IGST` | Asset | PurchaseBill approval (booked) or BPR approval (paid) |
| `GST_INPUT_CGST` | Asset | PurchaseBill approval (booked) or BPR approval (paid) |
| `GST_INPUT_SGST` | Asset | PurchaseBill approval (booked) or BPR approval (paid) |

**SaleBill — Approved:**
```
Dr  Customer/Sundry Debtor              ₹ total_invoice_amount
    Cr  Revenue/CC-Code Account          ₹ basic_amount          (per item)
    Cr  GST_OUTPUT_IGST                  ₹ igst_amount
    Cr  GST_OUTPUT_CGST                  ₹ cgst_amount
    Cr  GST_OUTPUT_SGST                  ₹ sgst_amount
```

**PurchaseBill — Approved:**
```
Dr  CC-Code Account (expense/asset)     ₹ basic_amount          (per item)
Dr  GST_INPUT_IGST                      ₹ igst_amount
Dr  GST_INPUT_CGST                      ₹ cgst_amount
Dr  GST_INPUT_SGST                      ₹ sgst_amount
    Cr  Vendor (Sundry Creditor)         ₹ total_invoice_amount
```

> **DECISION REQUIRED**: Should GST input be recognized at PurchaseBill approval (accrual) or BPR approval (cash basis)? The current BS uses cash basis (BPR). See [Unresolved Decisions](#decisions).

---

<a id="risk-7"></a>
## Risk 7: Cost Centre and Project Dimensions

### Verified Business Rules (from code)

**Project dimension**: Every financial transaction master has `project_code` FK to `projects.project_code`. This is verified on all 10 finance modules:
- PurchaseBill, SaleBill, PaymentVoucher, BillPaymentReceipt, JournalEntry, ContraEntry, SaleReceipt, SaleReceiptBilling, DebitNote, CreditNote — **all have `project_code`**.

**CC Code dimension**: Available on **line items** of most modules:
- JournalEntryLine: `cc_id` FK → `cc_code.id`
- PaymentVoucherItem: `cc_code_id` FK → `cc_code.id` + `cc_code` (string)
- PurchaseBillItem: `cc_code` (string only — **NO FK**)
- SaleBillItem: `cc_code` (string only — **NO FK**)
- DebitNoteItem: `cc_code` (string only — **NO FK**)
- CreditNoteItem: `cc_code` (string only — **NO FK**)
- BillPaymentReceiptItem: inherits from PB item or JE line (no own cc_code)
- ContraEntryLine: `account_id` FK → `bank_cash.id` (not cc_code — bank-to-bank)
- SaleReceiptBillingItem: unknown — not checked

### Risks for the Centralised Ledger

1. **String-only CC codes** on PB/SB/DN/CN items — posting code must resolve by string lookup to `cc_code.id`. Invalid strings must cause posting failure.
2. **BPR items have no CC code** — they reference PB items or JE lines. The posting code must traverse to the referenced item to find the CC code.
3. **Contra entries have no CC code** — they're bank-to-bank transfers. The posting code uses `account_id` → BankCash directly.

### Accounting Ledger Line Design

Each `accounting_ledger_line` should carry:
```
project_code     — always available from master
cc_code_id       — FK to cc_code (resolved from string or FK)
bank_cash_id     — FK to bank_cash (for bank/cash legs)
party_type       — "Vendor" | "Customer" | null
party_id         — FK to vendors (for vendor/customer sub-ledger)
gst_account_code — string (for GST system accounts)
```

At least one of `cc_code_id`, `bank_cash_id`, `party_id`, or `gst_account_code` must be populated for every line.

---

<a id="risk-8"></a>
## Risk 8: Posting Lifecycle (Draft → Pending → Approved → Reback/Cancel)

### Verified Business Rules (from code) — ALL modules checked

**Workflow states:** `Draft` → `Pending_L1` → `Pending_L2` → ... → `Approved`

**Reback rule (verified across ALL modules):**
```python
if not master.workflow_status.startswith("Pending"):
    return error("... is not pending ...")
```
- Reback is **ONLY allowed from `Pending_*` status**.
- Once `workflow_status = "Approved"`, a document **cannot be rebacked**.
- This was verified for: PurchaseBill, SaleBill, PaymentVoucher, BillPaymentReceipt, SaleReceiptBilling, ContraEntry, DebitNote, CreditNote, JournalEntry.

**Implication for the accounting ledger:**
- **Auto-posting should trigger on final approval** (`workflow_status = "Approved"`).
- **Reversal entries are NOT needed for reback** — reback only happens before approval, so no accounting entry exists to reverse.
- **Cancellation**: Documents use `status = "Active"` / `"Deleted"`. The BS and P&L reports filter on `status == "Active"`. If a document is marked deleted AFTER approval, the accounting entry must be reversed. However, the current code does **not** appear to have a "cancel approved document" flow — `status = "Deleted"` is typically set during pre-approval deletion.

> **DECISION REQUIRED**: Can an approved document ever be cancelled/deleted? If yes, the posting system needs a reversal mechanism. If no (current behavior), auto-posting is a safe one-way operation. See [Unresolved Decisions](#decisions).

### Posting Design: One-Way with Idempotency Guard

```python
def post_document(document):
    # Idempotency: check if already posted
    existing = AccountingLedger.query.filter_by(
        source_type=document.__class__.__tablename__,
        source_id=document.id,
        is_reversal=False
    ).first()
    if existing:
        return existing  # already posted, no duplicate

    ledger = AccountingLedger(
        source_type=document.__class__.__tablename__,
        source_id=document.id,
        posting_date=document.final_approved_at or datetime.utcnow(),
        project_code=document.project_code,
    )
    # ... generate lines based on document type ...
    db.session.add(ledger)
    # DO NOT commit here — let the caller's transaction include this
```

---

<a id="risk-9"></a>
## Risk 9: Opening Balances from Legacy Records

### Current State Analysis

There is **no** `OpeningBalance` model, `FinancialYear` model, or year-closing mechanism in the codebase.

**Current report approach — all reports are "since inception":**
- `_journal_balance()` sums ALL approved JE lines for given CC codes, optionally filtered by date range.
- `_all_bank_balances()` sums ALL approved PV/BPR records.
- `_sundry_debtors()` sums ALL approved SaleBills minus ALL SaleReceipts.
- `_gst_output_net()` sums ALL approved SaleBill GST minus BPR GST.

There is no concept of "bring forward from previous year" — everything is recalculated from scratch.

### Strategy for the Centralised Ledger

**Phase 1 — No Opening Balance Needed:**
When the accounting ledger goes live, retroactively post ALL existing approved documents. This creates a complete ledger from inception, matching the current report behavior exactly.

**Phase 2 — Year-End Closing (Future):**
1. Create `FinancialYear` model with `start_date`, `end_date`, `is_closed` flag.
2. Year-end process:
   - Calculate closing balances for all accounts as of `end_date`.
   - Create an `OpeningBalance` snapshot: one row per account with its balance.
   - Mark the year as closed.
3. New-year reports read opening balance + current-year ledger entries.

**Retroactive Posting Strategy:**
```
For each module in [PurchaseBill, SaleBill, PV, BPR, JE, CE, SRB, DN, CN]:
    For each document WHERE workflow_status = "Approved" AND status = "Active":
        post_document(document)  # idempotency guard prevents duplicates
```

This must be run as a **one-time migration script**, not during normal operation. Estimated document count should be assessed before running.

---

<a id="risk-10"></a>
## Risk 10: Bank/Cash and Petty Cash Account Identification

### Verified Business Rules (from code)

**BankCash model** — `bankCash.py`:
- `type`: `"Bank"` or `"Cash"`
- `bank_code`: unique identifier (e.g., "SBI_001")
- `bank_name`: display name
- `group_id`, `sub_group_id`: FK to category groups (BS classification)
- **NO stored balance column** — balance is derived from transactions.
- `status`: "Active" / "Deleted"

**How each module identifies the bank/cash account:**

| Module | Bank Field | Cash Field | Mode Field |
|--------|-----------|------------|------------|
| PaymentVoucher | `bank_ac_id` FK | `cash_ac_id` FK | `payment_mode` (Cash/Bank) |
| BillPaymentReceipt | `bank_ac_id` FK | `cash_ac_id` FK | `payment_mode` |
| SaleReceipt | `bank_ac_id` FK | `cash_ac_id` FK | `payment_mode` |
| SaleReceiptBilling | *(inherits from parent SaleReceipt)* | | |
| ContraEntry | Lines use `account_id` FK → `bank_cash` | | `dr_cr` per line |
| PettyCashDocketVoucher | `bank_cash_id` FK | *(implied by `mode_of_payment`)* | `mode_of_payment` |
| JournalEntry | *(no direct bank ref)* | | |
| PurchaseBill | *(no bank/cash — creates liability only)* | | |
| SaleBill | `bank_ac_id` FK | | |

**Bank balance calculation** — `balance_sheet/service.py:181-240`:
```python
Bank Balance = SUM(BPR.total_invoice_amount WHERE bank mode) - SUM(PV.total_invoice_amount WHERE bank mode)
```
- **Does NOT include** SaleReceipt bank payments (gap!)
- **Does NOT include** ContraEntry transfers (gap!)
- **Does NOT include** PettyCash with bank_cash_id (gap!)

**Cash balance calculation** — `balance_sheet/service.py:243-259`:
```python
Cash = SUM(PettyCashDocketVoucher.total_amount WHERE mode="Cash" AND approved)
```
- Only counts petty cash outflows. Does NOT track cash receipts.

### Risks for the Centralised Ledger

The accounting ledger **eliminates all these gaps** because every approved document posts Dr/Cr entries to the bank/cash account. The bank balance becomes:
```
Bank balance = SUM(all Dr entries to bank account) - SUM(all Cr entries to bank account)
```
This automatically includes PV, BPR, SaleReceipt, ContraEntry, PettyCash — everything.

### Posting Rules for Bank/Cash

**Bank payment out (PV, BPR):**
```
Cr  BankCash[bank_ac_id]               ₹ total_invoice_amount
```

**Bank receipt in (SaleReceipt via SRB):**
```
Dr  BankCash[receipt.bank_ac_id]       ₹ billing.total_invoice_amount
```

**Cash payment (PettyCashDocketVoucher):**
```
Cr  BankCash[bank_cash_id] or System Cash Account    ₹ total_amount
```

**Contra Entry (bank-to-bank transfer):**
```
Dr  BankCash[line.account_id WHERE dr_cr="Dr"]  ₹ debit_amount
    Cr  BankCash[line.account_id WHERE dr_cr="Cr"]  ₹ credit_amount
```

---

<a id="atomicity"></a>
## Atomicity, Duplicate Prevention, and Consistency

### Atomicity — Can posting be atomic with approval?

**Verified**: All approve functions follow this pattern (`purchase_bill/service.py:961-1001`):
```python
def approve_purchase_bill(bill_id, approved_by, comments=None):
    try:
        bill = PurchaseBillMaster.query.get(bill_id)
        # ... validation ...
        bill.workflow_status = "Approved"
        bill.locked = True
        db.session.commit()
        # ... WhatsApp notification (in try/except, non-critical) ...
```

**The `db.session.commit()` is a single transaction.** To make posting atomic:
1. **Replace `db.session.commit()` with `db.session.flush()`** before calling `post_document()`.
2. Call `post_document(bill)` which adds ledger records to the same session.
3. Call `db.session.commit()` once — both the status change AND the ledger records are committed together.
4. If posting fails, the entire transaction rolls back — the document stays in Pending status.

```python
# Modified approve pattern:
bill.workflow_status = "Approved"
bill.locked = True
db.session.flush()  # write to DB within transaction, get IDs

ledger = post_document(bill)  # adds to same session
db.session.commit()  # atomic: approval + posting
```

**Risk**: The WhatsApp notification code runs AFTER commit. This is fine — notifications are non-critical and already wrapped in try/except.

### Duplicate Prevention

**Two-layer protection:**

1. **Database constraint**: Unique constraint on `(source_type, source_id, is_reversal=False)` on the `accounting_ledger` table. This prevents any race condition from creating duplicate postings.

2. **Application check**: `post_document()` queries for existing ledger entry before creating. This provides a fast in-app check and a clear error message.

```sql
CREATE UNIQUE INDEX uq_ledger_source
    ON accounting_ledger (source_type, source_id)
    WHERE is_reversal = FALSE;
```

### Consistency — Failed postings cannot leave documents inconsistent

Because approval and posting are in the **same database transaction**:
- If posting fails → transaction rolls back → document stays Pending → user can retry approval.
- If approval succeeds but posting code has a bug → transaction rolls back → document stays Pending → bug is visible immediately.
- If database crashes mid-commit → PostgreSQL rolls back the uncommitted transaction → consistent state.

**The only risk**: If someone manually changes `workflow_status` to "Approved" without going through the approve function (direct DB edit), no posting occurs. The reconciliation tool (see Testing Plan) catches this by comparing approved documents against existing ledger entries.

---

<a id="decisions"></a>
## Unresolved Business Decisions Requiring Your Approval

### Decision 1: Payment Voucher Accounting Treatment
**Question**: Does a Payment Voucher represent:
- **(a) Direct expense** — Dr CC-code, Cr Bank. Simple. No advance tracking.
- **(b) Vendor advance** — Dr CAAP (Advance Against Purchase), Cr Bank. Requires adjustment entries when purchase bill arrives.

**My recommendation**: Option (a) for Phase 1. The current system has no advance reconciliation mechanism. Introducing it would require a new adjustment workflow. It can be added in Phase 2 if needed.

### Decision 2: Customer Identity Model
**Question**: How should customers be identified?
- **(a) Continue using Vendor with `is_debtor=True`** — Minimal change. Customer = Vendor record with is_debtor flag. Works for current scale.
- **(b) Create a separate `Customer` model** — Clean separation. Enables customer-specific features (credit limit, payment terms, customer-specific reporting). More work.

**My recommendation**: Option (a) for Phase 1. The Vendor model already has all needed fields (name, GSTIN, PAN, address, bank details). Add a comment/doc clarifying that `is_debtor=True` vendors are customers. The accounting ledger uses `party_type="Vendor"` + `party_id` regardless.

### Decision 3: GST Input Recognition Timing
**Question**: When should GST input credit be recognized?
- **(a) At PurchaseBill approval** — Accrual basis. GST input is booked when the bill is approved, regardless of payment.
- **(b) At BPR approval** — Cash basis. GST input is booked only when payment is made. This is the current BS behavior.

**My recommendation**: Option (a) — accrual basis is the correct accounting treatment under Indian GST law (input credit is available when the invoice is received and goods/services are received, not when payment is made). The current BS calculation using BPR is technically incorrect for GST reporting but may reflect a cash-flow tracking preference.

### Decision 4: Cancellation of Approved Documents
**Question**: Can an approved document ever be cancelled?
- **(a) No** — Once approved, it stays forever. Corrections are made via DN/CN/JE. This is the current behavior.
- **(b) Yes, with reversal** — Approved documents can be cancelled, which auto-posts a reversal entry.

**My recommendation**: Option (a). The existing workflow has no cancel-after-approval mechanism, and DN/CN/JE already provide the correction path. Adding cancellation introduces complexity (what if the reversal affects downstream documents?).

### Decision 5: SaleReceiptBilling Bank Account Storage
**Question**: Should SaleReceiptBillingMaster store its own copy of `bank_ac_id`/`cash_ac_id`?
- **(a) No** — Continue inheriting from parent. Simpler, but fragile if parent changes.
- **(b) Yes** — Copy at creation time. More robust for posting.

**My recommendation**: Option (b). At SRB creation time, copy the parent's bank/cash fields. This makes each billing record self-contained for posting purposes and prevents data integrity issues if the parent receipt is modified.

---

<a id="corrections"></a>
## Model Corrections Required in Target Architecture

Based on this investigation, the following corrections are needed in the `accounting_ledger_lines` model proposed in `PRAX_TARGET_ACCOUNTING_ARCHITECTURE.md`:

### 1. Add GST System Account Support
The original design assumed GST would be tracked via CC codes. It should use dedicated system account identifiers:
```python
gst_account_code = db.Column(db.String(20), nullable=True)
# Values: GST_OUTPUT_IGST, GST_OUTPUT_CGST, GST_OUTPUT_SGST,
#         GST_INPUT_IGST, GST_INPUT_CGST, GST_INPUT_SGST
```

### 2. Add Party Tracking Fields
```python
party_type = db.Column(db.String(20), nullable=True)  # "Vendor" | "Customer"
party_id   = db.Column(db.Integer, nullable=True)      # FK to vendors.id
party_ref  = db.Column(db.String(200), nullable=True)  # for JE customer_ref fallback
```

### 3. Add Bank/Cash Reference
```python
bank_cash_id = db.Column(db.Integer, db.ForeignKey("bank_cash.id"), nullable=True)
```

### 4. Revised `accounting_ledger_lines` Model
```python
class AccountingLedgerLine(db.Model):
    __tablename__ = "accounting_ledger_lines"

    id         = db.Column(db.Integer, primary_key=True)
    ledger_id  = db.Column(db.Integer, db.ForeignKey("accounting_ledger.id"), nullable=False)
    sl_no      = db.Column(db.Integer, nullable=False)

    # What account is affected
    account_type     = db.Column(db.String(20), nullable=False)
    # Values: "CC" | "BankCash" | "Party" | "GST"

    cc_code_id       = db.Column(db.Integer, db.ForeignKey("cc_code.id"), nullable=True)
    bank_cash_id     = db.Column(db.Integer, db.ForeignKey("bank_cash.id"), nullable=True)
    party_type       = db.Column(db.String(20), nullable=True)   # "Vendor" | "Customer"
    party_id         = db.Column(db.Integer, nullable=True)      # vendors.id
    gst_account_code = db.Column(db.String(20), nullable=True)   # GST_OUTPUT_IGST etc.

    # Dr/Cr
    dr_cr          = db.Column(db.String(3), nullable=False)  # "Dr" | "Cr"
    amount         = db.Column(db.Numeric(15, 2), nullable=False)

    # Dimensions
    project_code   = db.Column(db.String(50), db.ForeignKey("projects.project_code"), nullable=False)

    # Narration
    narration      = db.Column(db.Text, nullable=True)
```

### 5. Revised `accounting_ledger` Model (Unchanged from original, with one addition)
```python
class AccountingLedger(db.Model):
    __tablename__ = "accounting_ledger"

    id           = db.Column(db.Integer, primary_key=True)
    voucher_no   = db.Column(db.String(50), nullable=False)  # auto-generated "AL-0001"
    posting_date = db.Column(db.Date, nullable=False)

    source_type  = db.Column(db.String(50), nullable=False)  # table name of source
    source_id    = db.Column(db.Integer, nullable=False)      # PK of source record
    is_reversal  = db.Column(db.Boolean, default=False)

    project_code = db.Column(db.String(50), db.ForeignKey("projects.project_code"), nullable=False)
    narration    = db.Column(db.Text, nullable=True)

    total_debit  = db.Column(db.Numeric(15, 2), nullable=False)
    total_credit = db.Column(db.Numeric(15, 2), nullable=False)

    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    created_by   = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    lines = db.relationship("AccountingLedgerLine", backref="ledger",
                            cascade="all,delete-orphan", order_by="AccountingLedgerLine.sl_no")

    __table_args__ = (
        db.Index("uq_ledger_source", "source_type", "source_id",
                 unique=True, postgresql_where=db.text("is_reversal = FALSE")),
    )
```

---

<a id="sequence"></a>
## Safe Implementation Sequence

All steps preserve existing modules and their workflows. No existing code is modified until the accounting ledger infrastructure is proven.

### Phase 1: Foundation (No existing code changes)

**Step 1.1 — Create Models** (requires schema approval)
- Create `accounting_ledger` table
- Create `accounting_ledger_lines` table
- Add unique partial index for duplicate prevention
- Run migration

**Step 1.2 — Create Posting Engine**
- `post_document(document)` — generic dispatcher
- Module-specific posting functions: `_post_purchase_bill()`, `_post_sale_bill()`, `_post_payment_voucher()`, `_post_bill_payment_receipt()`, `_post_journal_entry()`, `_post_contra_entry()`, `_post_sale_receipt_billing()`, `_post_debit_note()`, `_post_credit_note()`, `_post_petty_cash_docket_voucher()`
- Each function generates the correct Dr/Cr lines for its document type
- All functions include idempotency check

**Step 1.3 — Create Reconciliation Report**
- API endpoint that compares approved documents vs ledger entries
- Lists: documents with no ledger entry, ledger entries with no document, Dr/Cr mismatches
- This is the primary testing/validation tool

### Phase 2: Retroactive Posting (No existing code changes)

**Step 2.1 — Retroactive Migration Script**
- One-time script that posts ALL existing approved documents
- Runs in batches (100 at a time) with progress logging
- Idempotency ensures safety on re-run
- **Must be run in a maintenance window**

**Step 2.2 — Reconciliation Verification**
- Run reconciliation report
- Compare ledger totals against current BS/P&L numbers
- Investigate and fix any discrepancies
- **Do not proceed to Phase 3 until totals match**

### Phase 3: Live Posting (Minimal existing code changes)

**Step 3.1 — Integrate with Approve Functions**
- Modify each module's `approve_*()` function:
  - Replace `db.session.commit()` with `db.session.flush()`
  - Call `post_document(document)`
  - Call `db.session.commit()`
- This is the **only change to existing code**
- Test each module individually

**Step 3.2 — Verify Live Posting**
- Approve new documents in each module
- Verify ledger entries are created
- Run reconciliation report to confirm no gaps

### Phase 4: New Reports (Additive, no changes to existing reports)

**Step 4.1 — Ledger Query Service**
- Account-wise ledger (all Dr/Cr for a given account)
- Trial Balance (sum of all accounts, Dr vs Cr totals)
- Sub-ledger reports (vendor-wise, bank-wise)

**Step 4.2 — New BS/P&L from Ledger**
- Create NEW endpoints that calculate BS/P&L from the accounting ledger
- Run in parallel with existing BS/P&L endpoints
- Compare outputs — they must match

**Step 4.3 — Switchover** (when confident)
- Replace existing BS/P&L endpoints with ledger-based versions
- Deprecate old calculation functions

### Phase 5: Financial Year and Opening Balances (Future)

**Step 5.1 — FinancialYear Model**
**Step 5.2 — Year-End Closing Process**
**Step 5.3 — Opening Balance Calculation**

---

<a id="testing"></a>
## Reconciliation and Testing Plan

### Pre-Launch Reconciliation

**Test 1 — Document Coverage:**
```sql
-- For each source_type, count approved docs vs ledger entries
SELECT 'purchase_bill_master' AS source, COUNT(*) AS approved
FROM purchase_bill_master
WHERE workflow_status = 'Approved' AND status = 'Active'
UNION ALL
SELECT source_type, COUNT(*)
FROM accounting_ledger
WHERE source_type = 'purchase_bill_master' AND is_reversal = FALSE;
-- Repeat for all 10 modules
```
**Expected**: Counts must match for each module.

**Test 2 — Balance Verification (CC Code accounts):**
For each CC code used in the current BS/P&L:
```
Current: _journal_balance(["CLSC"]) → X
Ledger:  SUM(credit) - SUM(debit) WHERE cc_code = "CLSC" → Y
X must equal Y
```

**Test 3 — Bank Balance Verification:**
For each active BankCash account:
```
Current: _all_bank_balances() → bank_total
Ledger:  SUM(debit) - SUM(credit) WHERE bank_cash_id = bank.id → ledger_total
Values should match (may differ if current calc has gaps — document any differences)
```

**Test 4 — GST Balance Verification:**
```
Current: _gst_output_net() → {igst_output, cgst_output, ...}
Ledger:  SUM WHERE gst_account_code = 'GST_OUTPUT_IGST' → ledger_igst_output
```

**Test 5 — Sundry Debtors:**
```
Current: _sundry_debtors() → CASD
Ledger:  SUM(debit) - SUM(credit) WHERE party_type = 'Customer' → ledger_CASD
```

**Test 6 — Dr/Cr Balance Check:**
```sql
-- Every ledger entry must be balanced
SELECT id, total_debit, total_credit
FROM accounting_ledger
WHERE total_debit != total_credit;
-- Must return zero rows
```

### Known Discrepancies to Expect

1. **Bank balance will differ** — current calc uses only PV/BPR, not SaleReceipt or ContraEntry. The ledger-based balance is MORE CORRECT.
2. **Cash balance will differ** — current calc sums PettyCash outflows only. The ledger captures all cash movements.
3. **GST may differ** — current calc excludes DN/CN GST adjustments. The ledger includes them.
4. **CC-code based values should match exactly** — both current and ledger read from the same approved JE data (for Phase 1, before live posting changes the source).

### Ongoing Reconciliation (Post-Launch)

Run nightly:
1. Compare count of approved documents per module vs ledger entries
2. Verify total_debit == total_credit for all ledger entries
3. Alert on any document approved in the last 24 hours without a matching ledger entry

---

## Summary of Complete Posting Rules

| Module | Trigger | Dr | Cr |
|--------|---------|----|----|
| **PurchaseBill** | Approval | CC-codes (per item) + GST Input | Vendor (payable) |
| **SaleBill** | Approval | Customer (receivable) | CC-codes (revenue) + GST Output |
| **PaymentVoucher** | Approval | CC-codes (per item) + GST Input | Bank/Cash |
| **BPR (bill)** | Approval | Vendor (settles payable) | Bank/Cash |
| **BPR (voucher)** | Approval | JE-line accounts | Bank/Cash |
| **JournalEntry** | Approval | Per JE line (dr_cr="Dr") | Per JE line (dr_cr="Cr") |
| **ContraEntry** | Approval | Bank(Dr lines) | Bank(Cr lines) |
| **SaleReceiptBilling** | Approval | Bank/Cash (from parent) | Customer (reduces receivable) |
| **DebitNote** | Approval | Vendor (reduces payable) | CC-codes + GST Input reversal |
| **CreditNote** | Approval | CC-codes (sales return) + GST Output reversal | Customer (reduces receivable) |
| **PettyCashDocketVoucher** | Approval | CC-codes (expenses) | Cash account |

---

*End of Risk Resolution Document*
