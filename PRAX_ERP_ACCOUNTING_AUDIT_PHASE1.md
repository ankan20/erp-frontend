# PRAX ERP — Phase 1: Complete Accounting Architecture Audit

**Date:** 2026-11-10  
**Scope:** Research-only investigation of the entire PRAX ERP accounting architecture  
**Status:** No code modifications made

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Master Data Architecture](#2-master-data-architecture)
3. [Cost Centre (CC) Code Architecture](#3-cost-centre-cc-code-architecture)
4. [Chart of Accounts & Ledger Architecture](#4-chart-of-accounts--ledger-architecture)
5. [Journal Entry System — The Accounting Core](#5-journal-entry-system--the-accounting-core)
6. [Transaction Module Inventory](#6-transaction-module-inventory)
7. [Transaction-to-Accounting Lifecycle](#7-transaction-to-accounting-lifecycle)
8. [Financial Report Architecture](#8-financial-report-architecture)
9. [GST Accounting](#9-gst-accounting)
10. [Opening Balances & Financial Year](#10-opening-balances--financial-year)
11. [Data Integrity Analysis](#11-data-integrity-analysis)
12. [CC Code Reference Consistency](#12-cc-code-reference-consistency)
13. [Workflow & Approval Engine](#13-workflow--approval-engine)
14. [Petty Cash Subsystem](#14-petty-cash-subsystem)
15. [Resource Management & Procurement Chain](#15-resource-management--procurement-chain)
16. [Project Management & Billing Chain](#16-project-management--billing-chain)
17. [Bank & Cash Management](#17-bank--cash-management)
18. [Identified Architectural Gaps](#18-identified-architectural-gaps)
19. [Risk Assessment](#19-risk-assessment)
20. [Recommendations Summary](#20-recommendations-summary)

---

## 1. Executive Summary

PRAX ERP is a project-centric construction/infrastructure ERP with a Flask/SQLAlchemy backend and a Next.js 16 / React frontend. The accounting architecture has several **critical design characteristics** that diverge from standard double-entry bookkeeping systems:

### Key Findings

1. **Journal entries are manually created only** — no transaction module (Purchase Bill, Sale Bill, Bill Payment, etc.) automatically posts to the general journal. Journal entries exist as a standalone module.

2. **Financial reports use DUAL data sources** — the Balance Sheet reads from journal entries (for CC-code-based line items) AND from raw source documents (for bank balances, sundry debtors, GST). The P&L report reads from **budget estimates**, not actuals.

3. **No Trial Balance exists** — there is no trial balance report or computation anywhere in the codebase.

4. **No Financial Year model** — there is no financial year configuration, year-end closing, or opening balance mechanism.

5. **CC codes are predominantly stored as denormalized strings** — only 5 out of ~20 transaction tables use proper foreign keys to the `cc_codes` table. The rest store `cc_code` and `cc_name` as plain strings.

6. **The Vendor model doubles as the ledger/account master** — vendors and ledger accounts share the same table (`vendors`), distinguished only by `is_debtor` boolean. There are no balance columns; balances are computed on-the-fly from source documents.

7. **P&L is budget-based, not actual-based** — the profit & loss report sums sale order amounts as income and budget CC-code estimates as expenses, not actual journal entries or purchase bill totals as actuals.

---

## 2. Master Data Architecture

### 2.1 Group → SubGroup → CC Code Hierarchy

| Model | Table | Key Fields | Purpose |
|-------|-------|-----------|---------|
| `GroupMaster` | `group_master` | `group_name` (unique), `head_under` ("Profit & Loss" \| "Balance Sheet") | Top-level classification |
| `SubGroupMaster` | `sub_group_master` | `fixed_code` (unique), `sub_group_name`, `group_id` (FK→group_master), `parent_id` (FK→self), `level` (0-2) | Tree hierarchy, max 3 levels |
| `CategoryMaster` | `category_master` | `fixed_code` (unique, e.g. "RAW_MATERIAL"), `category_name` | Cross-cutting category for items/vendors/CC codes |

**File:** `erp_backend/app/models/category_group.py`

### 2.2 CC Code Master

| Field | Type | Notes |
|-------|------|-------|
| `cc_code` | String(50), unique | Primary business identifier |
| `cc_name` | String(200) | Display name |
| `group_id` | FK→group_master | Balance Sheet classification |
| `category_code` | FK→category_master | Category classification |
| `sub_group_id` | FK→sub_group_master, nullable | Sub-group classification |
| `is_non_ledger` | Boolean, nullable | True=Non-Ledger, False=Ledger Head, None=not set |
| `pl_linked` | Boolean, default False | Whether CC also falls under P&L |
| `pl_group_id` | FK→group_master, nullable | P&L group (when pl_linked=True) |
| `pl_sub_group_id` | FK→sub_group_master, nullable | P&L sub-group |

**File:** `erp_backend/app/models/cc_code.py`  
**Key insight:** A CC code can be **dual-classified** — under Balance Sheet via `group_id`/`sub_group_id` AND under P&L via `pl_group_id`/`pl_sub_group_id` when `pl_linked=True`.

### 2.3 Vendor / Ledger Master

| Field | Type | Notes |
|-------|------|-------|
| `ledger_code` | String, unique | Ledger account identifier |
| `ledger_name` | String | Display name |
| `is_debtor` | Boolean | True=Debtor/Customer, False=Creditor/Vendor |
| `category_code` | FK→category_master | Category |
| `pan`, `gstin`, `state_code`, `state_name` | Strings | Tax identity |
| `supplier_types` | JSON | Multi-value classification |

**File:** `erp_backend/app/models/vendor.py`  
**Critical:** There are **NO balance columns** (`opening_balance`, `debit_balance`, `credit_balance` do not exist). Balances are computed from source documents.

### 2.4 Bank & Cash Master

| Field | Type | Notes |
|-------|------|-------|
| `type` | String | "Bank" or "Cash" |
| `bank_code` | String, unique | Account identifier |
| `group_id` | FK→group_master | Balance Sheet group |
| `sub_group_id` | FK→sub_group_master | Balance Sheet sub-group |

**File:** `erp_backend/app/models/bankCash.py`  
**Note:** No running balance stored. Balance Sheet computes bank balances from PaymentVoucher (outflows) and BillPaymentReceipt (inflows).

### 2.5 Item Master

| Field | Type | Notes |
|-------|------|-------|
| `item_code` | String(50), unique | Item identifier |
| `cc_code_id` | FK→cc_codes.id | **Proper FK** — maps item to its CC code |
| `category_code` | FK→category_master | Category |
| `unit_id` | FK→units.id | UOM |
| `hsn_sac` | String(50) | HSN/SAC for GST |
| `gst_percentage` | Numeric(5,2) | Default GST rate |

**File:** `erp_backend/app/models/item.py`

### 2.6 Unit Master

Self-referencing hierarchy with `parent_unit_id` and `parent_unit_multiply_factor` for unit conversions.

**File:** `erp_backend/app/models/unit.py`

### 2.7 Company

Basic company info (name, PAN, GSTIN). **No financial year configuration.**

**File:** `erp_backend/app/models/companies.py`

---

## 3. Cost Centre (CC) Code Architecture

### 3.1 Classification Mechanism

```
GroupMaster (head_under: "P&L" | "Balance Sheet")
  └── SubGroupMaster (level 0)
        └── SubGroupMaster (level 1)
              └── SubGroupMaster (level 2)
                    └── CCCode (via group_id + sub_group_id)
```

A single CCCode can appear in **both** P&L and Balance Sheet reports via:
- Primary: `group_id` → determines head_under (usually "Balance Sheet")
- Secondary: `pl_linked=True` + `pl_group_id` + `pl_sub_group_id` → adds P&L classification

### 3.2 CC Code Reference Patterns Across Models

**Models with proper FK to `cc_codes.id`:**

| Model | Field | Table |
|-------|-------|-------|
| `JournalEntryLine` | `cc_id` | `journal_entry_lines` |
| `PaymentVoucherItem` | `cc_code_id` | `payment_voucher_items` |
| `Item` | `cc_code_id` | `items` |
| `Asset` | `cc_code_id` | `assets` |
| `BudgetItemCCCode` | `cc_code_id` | `budget_item_cc_codes` |

**Models with denormalized string cc_code/cc_name (NO FK):**

| Model | Table |
|-------|-------|
| `PurchaseBillItem` | `purchase_bill_items` |
| `PurchaseBillGst` | `purchase_bill_gst` |
| `SaleBillItem` | `sale_bill_items` |
| `SaleBillGst` | `sale_bill_gst` |
| `BillPaymentReceiptItem` | `bill_payment_receipt_items` |
| `BillPaymentReceiptGst` | `bill_payment_receipt_gst` |
| `CreditNoteItem` | `credit_note_items` |
| `CreditNoteGst` | `credit_note_gst` |
| `DebitNoteItem` | `debit_note_items` |
| `DebitNoteGst` | `debit_note_gst` |
| `PaymentVoucherGst` | `payment_voucher_gst` |
| `PettyCashBudgetDetail` | `petty_cash_budget_details` |
| `PettyCashDocketVoucherDetail` | `petty_cash_docket_voucher_details` |
| `PettyCashJournalLine` | `petty_cash_journal_lines` |
| `SaleReceiptBillingItem` | `sale_receipt_billing_items` |
| `SaleReceiptBillingGst` | `sale_receipt_billing_gst` |

**Models with `cost_head` string (loose CC reference):**

| Model | Table |
|-------|-------|
| `OrderMaster` | `order_master` |
| `GrnMaster` | `grn_master` |
| `SrnMaster` | `srn_master` |
| `GinMaster` | `gin_master` |
| `BrsMaster` | `brr_service_master` |
| `BrgMaster` | `brr_grn_master` |
| `BssMaster` | `brr_srn_master` |
| `BvsMaster` | `brr_vs_master` |
| `ProjectWorkOrderMaster` | `pw_order_master` |

**`Employee` model** has `cost_centre` string field — completely unlinked.

### 3.3 Hardcoded CC Codes

The P&L report (`profit_loss/service.py`) hardcodes 50 CC codes:
```python
_ALL_CODES = [
    "CRIN", "CRHL", "CRAP", "UCAP", "WIPS", "INOC",
    "DRCW", "DRMC", "DRFD", "DRMH", "DRUS", "DRMR", "DRLC", "DRLS", "DRMS",
    "IRDC", "IRAD", "IRLE", "IRFS", "IRMR", "IRLU", "IRMT", "IRPS", "IRSD",
    "IRIM", "IRIL", "IRFM", "IRTT", "IRLH", "IRLM", "IRLT",
    "IOFM", "IOHR", "IOME", "IOMS", "IOMB", "IOSS", "IOVR", "IOTV",
    "IOCR", "CRBC", "CRBD", "CRCC", "CRDR", "CRES", "CRIC", "CRIP", "CRLC", "CRPF", "CRIT",
]
```

The Balance Sheet (`balance_sheet/service.py`) hardcodes ~40 CC codes:
```python
# Liability codes: DIR1, DIR2, LON3, LON1, LON2, USLO, NBFC, NCDT, NCTL, NCTP,
#                  CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM
# Asset codes:     CARM, CAHL, CAAP, CAUM, CAWP, CART, CAAE, CAOP,
#                  CACI, CATS, CAOA, APNM, ASRV, AOFG, AELE, AMEG, ALGH,
#                  AINF, ASCF, ASHT, AEIT, AETT, ACAB, NCIV, NCTA, LTLA, NCCA
```

These codes must exist in the `cc_codes` table for journal entries to produce balance sheet values.

---

## 4. Chart of Accounts & Ledger Architecture

### 4.1 Account Types in Journal Entries

The system recognizes three account types in `JournalEntryLine.account_type`:

| Type | FK Field | Description |
|------|----------|-------------|
| `"CC"` | `cc_id` → `cc_codes.id` | Cost Centre account |
| `"Vendor"` | `vendor_id` → `vendors.id` | Vendor/Ledger account |
| `"Customer"` | `customer_ref` (String, no FK) | Free-text customer reference |

**Implication:** There is no unified chart of accounts. CC codes, Vendors, and Customers are separate namespaces joined only at the journal entry line level.

### 4.2 No Traditional General Ledger

There is no `GeneralLedger` or `AccountMaster` table. Instead:
- **CC codes** serve as expense/asset/liability accounts
- **Vendors** serve as creditor/debtor accounts
- **BankCash** entries serve as bank/cash accounts
- **Customer references** are free-text strings with no master

### 4.3 Ledger Reports

Two ledger report implementations exist:

**My Ledger** (`my_ledger/service.py`):
- Aggregates Sale Bills, Sale Receipts, Purchase Bills, Bill Payments, Debit Notes, Credit Notes
- Shows per-project or all-project view
- **Does NOT read from journal entries** — reads directly from source documents
- Running balance: Debit (income/receivable) positive, Credit (expense/payable) negative

**Vendor Ledger** (`vendor_ledger/service.py`):
- Aggregates Purchase Bills, Bill Payments, Debit Notes, Credit Notes for a specific vendor
- **Does NOT read from journal entries** — reads directly from source documents
- Running balance: Credit (we owe vendor) positive, Debit (we paid) negative

---

## 5. Journal Entry System — The Accounting Core

### 5.1 Model Structure

**File:** `erp_backend/app/models/journalEntry.py`

**JournalEntryMaster:**
| Field | Type | Notes |
|-------|------|-------|
| `voucher_no` | String, unique | Auto-generated: JV##### / JB##### / JA##### |
| `journal_uuid` | String(36), unique | UUID for external access |
| `entry_date` | Date | Always `date.today()` at creation |
| `project_code` | FK→projects | Project scope |
| `entry_mode` | String | "new_voucher" \| "bulk_docket" \| "adjustment" |
| `ref_bill_type` | String | "sale_bill" \| "purchase_bill" \| "receipt_billing" |
| `ref_bill_id` | Integer | FK-like reference to source bill |
| `total_debit` | Numeric | Sum of all debit amounts |
| `total_credit` | Numeric | Sum of all credit amounts |
| `workflow_status` | String | "Draft" → "Pending_L{n}" → "Approved" \| "Rejected" \| "Reback" |

**JournalEntryLine:**
| Field | Type | Notes |
|-------|------|-------|
| `journal_id` | FK→journal_entry_master | Parent |
| `sl_no` | Integer | Line sequence |
| `account_type` | String | "CC" \| "Vendor" \| "Customer" |
| `dr_cr` | String | "Dr" \| "Cr" |
| `cc_id` | FK→cc_codes.id, nullable | CC account (when account_type="CC") |
| `vendor_id` | FK→vendors.id, nullable | Vendor account (when account_type="Vendor") |
| `customer_ref` | String, nullable | Free-text customer (when account_type="Customer") |
| `debit_amount` | Numeric | Debit amount (0 if Cr line) |
| `credit_amount` | Numeric | Credit amount (0 if Dr line) |

### 5.2 Journal Entry Creation Logic

**File:** `erp_backend/app/modules/finance/journal_entry/service.py`

- `create_journal_entry()` — Manual creation only. Validates: at least 1 line, total_debit == total_credit (when Cr lines exist).
- `entry_date` is always set to `date.today()` — the user cannot pick a different date.
- For `bulk_docket` mode, approved petty cash dockets are linked via `PettyCashJournalVoucher.linked_journal_id`.
- For `adjustment` mode, a `ref_bill_type`/`ref_bill_id` links to the source bill.

### 5.3 No Automatic Journal Posting

**Critical finding:** No transaction module (Purchase Bill, Sale Bill, Bill Payment, Sale Receipt, Credit Note, Debit Note, Contra Entry, Payment Voucher) automatically creates journal entries when approved. The journal entry module is entirely standalone.

The only automated link is:
- **Bulk Docket mode** — approved petty cash dockets can be selected and journalized into a single JE
- **Adjustment mode** — references a sale/purchase/receipt bill for adjustment entries

### 5.4 Entry Modes

| Prefix | Mode | Purpose |
|--------|------|---------|
| `JV` | `new_voucher` | Standard manual journal entry |
| `JB` | `bulk_docket` | Aggregates approved petty cash dockets |
| `JA` | `adjustment` | Bill-linked adjustment entry |

---

## 6. Transaction Module Inventory

### 6.1 Purchase Side

| Module | Model | Table | Journal Link | CC Reference |
|--------|-------|-------|-------------|--------------|
| Purchase Bill | `PurchaseBillMaster` + `PurchaseBillItem` + `PurchaseBillGst` | `purchase_bill_master` / `_items` / `_gst` | None | String cc_code/cc_name |
| Bill Payment | `BillPaymentReceiptMaster` + `_Item` + `_Gst` | `bill_payment_receipt_*` | `journal_entry_id` FK (for JE-type payments) | String cc_code/cc_name |
| Debit Note | `DebitNoteMaster` + `DebitNoteItem` + `DebitNoteGst` | `debit_note_*` | None | String cc_code/cc_name |
| Payment Voucher | `PaymentVoucherMaster` + `_Item` + `_Gst` | `payment_voucher_*` | None | **FK cc_code_id** on items, strings on GST |

### 6.2 Sale Side

| Module | Model | Table | Journal Link | CC Reference |
|--------|-------|-------|-------------|--------------|
| Sale Bill | `SaleBillMaster` + `SaleBillItem` + `SaleBillGst` + `SaleBillSource` | `sale_bill_*` | None | String cc_code/cc_name |
| Sale Receipt | `SaleReceiptMaster` | `sale_receipt_master` | None | None |
| Sale Receipt Billing | `SaleReceiptBillingMaster` + `_Item` + `_Gst` | `sale_receipt_billing_*` | None | String cc_code/cc_name |
| Credit Note | `CreditNoteMaster` + `CreditNoteItem` + `CreditNoteGst` | `credit_note_*` | None | String cc_code/cc_name |

### 6.3 Other Finance

| Module | Model | Table | Journal Link | CC Reference |
|--------|-------|-------|-------------|--------------|
| Contra Entry | `ContraEntryMaster` + `ContraEntryLine` | `contra_entry_*` | None | None (bank→bank transfers only) |
| Petty Cash Budget | `PettyCashBudgetMaster` + `_Detail` | `petty_cash_budget_*` | None | String cc_code/cc_name |
| Petty Cash Docket | `PettyCashDocketVoucher` + `_Detail` | `petty_cash_docket_*` | None | String cc_code/cc_name |
| Petty Cash Journal | `PettyCashJournalVoucher` + `_Line` | `petty_cash_journal_*` | `linked_journal_id` FK | String cc_code/cc_name |

### 6.4 Resource Management

| Module | Model | CC Reference |
|--------|-------|-------------|
| Order (Purchase) | `OrderMaster` + `OrderItem` | `cost_head` string on master |
| GRN | `GrnMaster` + `GrnItem` | `cost_head` string on master |
| SRN | `SrnMaster` + `SrnItem` | `cost_head` string on master |
| GIN | `GinMaster` + `GinItem` | `cost_head` + `cost_factor` strings on master |
| Indent | `IndentMaster` + `IndentItem` | None |
| BRR | `BrrMaster` | None |

### 6.5 Project Management / Billing

| Module | Model | CC Reference |
|--------|-------|-------------|
| OG Sale Order | `OgSaleOrderMaster` + items + BOQ items | None |
| Billing (Certified) | `BillingMaster` + `BillingItem` + `BillingBoqItem` | None |
| Budget | `BudgetMaster` + `BudgetItem` + `BudgetItemCCCode` | **FK cc_code_id** on BudgetItemCCCode |

---

## 7. Transaction-to-Accounting Lifecycle

### 7.1 Current Flow (No Auto-Posting)

```
Transaction Created → Draft
         ↓
    Submitted → Pending_L1 → ... → Approved
         ↓
    (Transaction complete — NO journal entry created)
```

The only path from a transaction to the general journal is:

1. **Manual Journal Entry** — A user manually creates a JV/JA entry referencing accounts
2. **Bulk Docket** — A user selects approved petty cash dockets to journalize into a JB entry
3. **Bill Payment + JE reference** — Bill Payments can reference a `journal_entry_id` (pre-existing JE, not auto-created)

### 7.2 Implications

- **Purchase Bills** are approved but never hit the journal. The vendor ledger computes balances directly from `purchase_bill_master` rows.
- **Sale Bills** are approved but never hit the journal. The my_ledger report reads directly from `sale_bill_master` rows.
- **Bill Payments** reference a pre-existing journal entry (if `payment_type="voucher"`) but do not create one.
- **The Balance Sheet** bypasses this gap by reading some values from journal entries and others from raw source documents.
- **The P&L** bypasses this gap entirely by reading from budgets, not actuals.

### 7.3 Bill Payment → Journal Entry Reference

The Bill Payment module (`bill_payment/service.py`) has the most complex JE integration:
- `payment_type="voucher"` links to a pre-existing `journal_entry_id`
- The JE picker finds approved JEs with Cr lines for the selected vendor
- Bill Payment items have `je_line_id` FK to `journal_entry_lines`
- Bill Payment items also have `pb_item_id` FK to `purchase_bill_items` (for `payment_type="bill"`)

---

## 8. Financial Report Architecture

### 8.1 Profit & Loss Report

**File:** `erp_backend/app/modules/finance/profit_loss/service.py`

**Data Sources:**
- **Income (CRIN):** Sum of `OgSaleOrderMaster.total_amount` where workflow_status="Approved" — this is **sale order value, not invoiced/billed amount**
- **Expenses:** Sum of `BudgetItemCCCode.cc_total` grouped by cc_code from approved `BudgetMaster` records — this is **budgeted cost, not actual expense**
- **Overhead:** Aggregated from `BudgetMaster.overhead_data` JSON column
- **Booked column:** Sum of `PurchaseBillItem.basic_amount` grouped by cc_code — this is the only actual figure

**Critical Assessment:**
- The P&L shows **estimated/budgeted** figures, not actual accounting figures
- Income = sale order value (not invoiced, not received)
- Expenses = budget estimates (not purchase bills, not payments)
- Only the "booked" column shows actual purchase bill amounts
- "workDone", "stock", "actual" columns are hardcoded to `None`
- This is effectively a **budget vs. actual** report, not a traditional P&L

### 8.2 Balance Sheet

**File:** `erp_backend/app/modules/finance/balance_sheet/service.py`

**Data Sources — Mixed:**

| Line Item | Data Source | Type |
|-----------|-----------|------|
| Director capital (DIR1, DIR2) | Journal entries (CC code net balance) | Journal |
| Company reserves (CRSF) | Computed P&L net (budget-based) | Budget |
| Long-term borrowings (LON1-3, USLO, NBFC) | Journal entries | Journal |
| Non-current liabilities (NCDT, NCTL, NCTP) | Journal entries | Journal |
| Current liabilities (CLDT, CLSC, CLTB, etc.) | Journal entries | Journal |
| GST Payable (CLGP) | Sale Bill GST (output) − Bill Payment Receipt GST (input) | Source docs |
| Fixed assets (APNM, ASRV, etc.) | Journal entries (debit sum) | Journal |
| Non-current assets (NCIV, NCTA, etc.) | Journal entries (debit sum) | Journal |
| Closing stock (CARM, CAHL, etc.) | Journal entries (debit sum) | Journal |
| Sundry debtors (CASD) | Sale Bill totals − Sale Receipt totals | Source docs |
| Bank balances (CABA) | Payment Voucher outflows − Bill Payment Receipt inflows | Source docs |
| Cash in hand (CACH) | Petty Cash Docket Voucher totals (Cash mode) | Source docs |
| GST excess input | Negative of GST payable calculation | Source docs |

**Critical Assessment:**
- The Balance Sheet mixes journal-entry-based values with direct source-document calculations
- If a purchase bill is approved but no corresponding journal entry exists, the balance sheet won't reflect its liability (except indirectly via sundry creditors if that's tracked via journal entries)
- Bank balances are NOT from journal entries — they're computed from PaymentVoucher and BillPaymentReceipt transaction totals
- The CRSF (reserves/surplus) line embeds the entire budget-based P&L calculation

### 8.3 My Ledger

**File:** `erp_backend/app/modules/finance/my_ledger/service.py`

- Aggregates 6 document types per project: Sale Bills, Sale Receipts, Purchase Bills, Bill Payments, Debit Notes, Credit Notes
- **No journal entry data** — purely source-document-based
- Running balance with Dr/Cr type
- All-projects mode does 6 bulk queries then groups in Python

### 8.4 Vendor Ledger

**File:** `erp_backend/app/modules/finance/vendor_ledger/service.py`

- Aggregates 4 document types per vendor: Purchase Bills, Bill Payments, Debit Notes, Credit Notes
- **No journal entry data** — purely source-document-based
- Running balance showing outstanding payable (Cr = we owe, Dr = we paid)

### 8.5 Missing Reports

- **Trial Balance** — Does not exist
- **General Ledger** — Does not exist (only My Ledger and Vendor Ledger which are source-doc-based)
- **Cash Flow Statement** — Does not exist
- **Day Book / Journal Register** — The journal entry list is the closest analog
- **CC-wise expense report** — Does not exist as a standalone report (partially in P&L)

---

## 9. GST Accounting

### 9.1 GST Data Model

Every financial transaction with GST has a separate GST lines table:

| Transaction | GST Table | Fields |
|------------|-----------|--------|
| Purchase Bill | `purchase_bill_gst` | `gst_type`, `cc_code/cc_name` (string), `percent`, `gst_amount`, `is_selected` |
| Sale Bill | `sale_bill_gst` | `gst_type`, `cc_code/cc_name` (string), `percent`, `gst_amount`, `is_selected` |
| Bill Payment Receipt | `bill_payment_receipt_gst` | `gst_type`, `cc_code/cc_name` (string), `booked_amount`, `current_amount` |
| Payment Voucher | `payment_voucher_gst` | `gst_type`, `cc_code/cc_name` (string), `percent`, `gst_amount`, `is_selected` |
| Credit Note | `credit_note_gst` | Same pattern |
| Debit Note | `debit_note_gst` | Same pattern |
| Sale Receipt Billing | `sale_receipt_billing_gst` | `booked_amount`, `received_amount`, `balance_amount`, `current_amount` |

### 9.2 GST Types

All GST tables use `gst_type` string: "IGST", "CGST", "SGST"

### 9.3 GST in Financial Reports

- **Balance Sheet GST Payable:** Output GST (from sale_bill_gst where is_selected=True) minus Input GST (from bill_payment_receipt_gst current_amount)
- **No separate GST return/reconciliation module**
- **No GSTR-1/GSTR-3B preparation functionality**

### 9.4 GST Gaps

- `purchase_bill_gst` has `is_selected` flag — not all GST lines are counted
- Input credit comes from `bill_payment_receipt_gst.current_amount`, not from `purchase_bill_gst.gst_amount`
- This means input GST is only recognized when the bill is **paid**, not when the purchase bill is booked

---

## 10. Opening Balances & Financial Year

### 10.1 Financial Year — NOT IMPLEMENTED

There is no:
- Financial year model/table
- Year-start/year-end configuration
- Year-end closing process
- Year-opening balance generation

### 10.2 Opening Balances — PARTIALLY IMPLEMENTED

- `ContraEntryLine.opening_balance` exists — but only for bank reconciliation within contra entries
- No general opening balance mechanism for ledger accounts
- No ability to set opening balances for CC codes, vendors, or bank accounts
- All calculations are cumulative from the first record with no period boundary

### 10.3 Date Filtering

All report services accept optional `fromDate`/`toDate` parameters, which serve as the only mechanism for period-specific reporting. Without a financial year model, there's no enforcement of standard fiscal periods.

---

## 11. Data Integrity Analysis

### 11.1 FK Integrity Risks

| Risk | Description | Severity |
|------|-------------|----------|
| String CC codes may not match cc_codes table | Denormalized cc_code strings in ~15 tables can drift from cc_codes master | HIGH |
| Customer references are free-text | JournalEntryLine.customer_ref has no FK — no validation against any master | MEDIUM |
| cost_head strings on resource modules have no FK | OrderMaster.cost_head, GrnMaster.cost_head, etc. are unvalidated strings | MEDIUM |
| Employee.cost_centre is unlinked | No FK to cc_codes or any master | LOW |

### 11.2 Orphan Risk

- If a CC code is renamed in `cc_codes` table, all denormalized string references become stale
- If a vendor is deleted, journal entry lines with that `vendor_id` FK would cascade based on DB constraints (currently no ON DELETE specified — defaults to RESTRICT)

### 11.3 Debit = Credit Enforcement

- `create_journal_entry()` validates `total_debit == total_credit` only when Cr lines are present
- If only Dr lines exist (no Cr), the entry is accepted without balancing — this allows single-sided entries
- The Balance Sheet reports a `difference` field (assets − liabilities) that exposes imbalance

### 11.4 Workflow Status Dependencies

- P&L and Balance Sheet only count `workflow_status="Approved"` records
- Vendor Ledger and My Ledger only count `workflow_status="Approved"` records
- A rejected or reback document is excluded from all calculations
- Journal entries additionally filter `status="Active"` (rejected entries have status="Inactive")

---

## 12. CC Code Reference Consistency

### 12.1 The Core Problem

The system has **two parallel CC code reference systems**:

1. **FK-based** (cc_id → cc_codes.id): Used in JournalEntryLine, PaymentVoucherItem, Item, Asset, BudgetItemCCCode
2. **String-based** (cc_code + cc_name as plain strings): Used in all other ~15 transaction tables

This means:
- The Balance Sheet (which reads from journal entries using FK joins) sees one set of CC data
- Transaction modules store CC as strings that could contain typos, old names, or non-existent codes
- There is no mechanism to validate that a string cc_code in a PurchaseBillItem actually exists in the cc_codes table

### 12.2 P&L CC Code Matching

The P&L report uses `BudgetItemCCCode.cc_code` (string snapshot column, not the FK) for grouping, doing `.strip().upper()` normalization. If the snapshot string diverges from the cc_codes.cc_code value, grouping breaks.

The "booked" column uses `PurchaseBillItem.cc_code` (string, no FK) — same risk.

---

## 13. Workflow & Approval Engine

### 13.1 Workflow Module

**File:** `erp_backend/app/modules/work_flow/` (referenced by all financial services)

Standard workflow states: `Draft` → `Pending_L{n}` → `Approved` | `Rejected` | `Reback`

Key functions:
- `is_creator(project_code, module, user_id)` — Authorization check
- `get_first_approver(project_code, module)` — Level routing
- `get_next_approver(project_code, module, current_level)` — Next level
- `is_current_approver(project_code, module, level, user_id)` — Approval check
- `create_history(...)` — Audit trail

### 13.2 Module Codes

| Module | Code | Voucher Prefix |
|--------|------|---------------|
| Journal Entry | `journal` | JV/JB/JA |
| Contra Entry | `contra` | CV |
| Petty Cash Journal | `journal_voucher` | JVP |
| Purchase Bill | — | PB |
| Sale Bill | — | SB |
| Bill Payment | — | BPR |
| Credit Note | — | CN |
| Debit Note | — | DN |

### 13.3 Locking

All master tables have a `locked` boolean:
- Set to `True` when submitted (Pending state)
- Set to `True` when approved
- Set to `False` only on Reback (sent back for correction)
- Prevents edits during approval pipeline

---

## 14. Petty Cash Subsystem

### 14.1 Three-Stage Flow

```
Petty Cash Budget → Petty Cash Docket Voucher → Petty Cash Journal Voucher
```

1. **Budget** (`PettyCashBudgetMaster`): Defines budget per CC code for a period
2. **Docket Voucher** (`PettyCashDocketVoucher`): Actual petty cash spending against budget
3. **Journal Voucher** (`PettyCashJournalVoucher`): Aggregation step — journals docket expenses

### 14.2 Journal Link

- `PettyCashJournalVoucher.linked_journal_id` FK → `journal_entry_master.id`
- When a JE is created in `bulk_docket` mode, selected approved dockets are linked
- The petty cash journal voucher lines store CC as **denormalized strings**, not FK

### 14.3 Cash Balance Impact

The Balance Sheet calculates "Cash in hand" from:
```python
PettyCashDocketVoucher.total_amount WHERE mode_of_payment="Cash" AND workflow_status="Approved"
```
This is the **total spent via cash petty cash**, not a running cash balance.

---

## 15. Resource Management & Procurement Chain

### 15.1 Procurement Flow

```
Indent → Order (Purchase) → GRN (Goods Received) → BRR (Bill Received Register) → Purchase Bill
                          → GIN (Goods Issue Note)
```

For project work / services:
```
Project Work Order → SRN (Service Received) → BRR → Purchase Bill
```

### 15.2 Key Models

| Model | Table | Links |
|-------|-------|-------|
| `IndentMaster` + `IndentItem` | `indent_master/items` | category_code FK |
| `OrderMaster` + `OrderItem` | `order_master/items` | vendor_id FK, item_code FK→items |
| `GrnMaster` + `GrnItem` | `grn_master/items` | order_id FK, item_code FK→items |
| `SrnMaster` + `SrnItem` | `srn_master/items` | pw_order_item FK |
| `GinMaster` + `GinItem` | `gin_master/items` | order_item_id FK |
| `BrrMaster` | `brr_master` | vendor_id FK, order_id FK |

### 15.3 Financial Impact

- **None of these create journal entries**
- GRN quantities update `OrderItem.used_qty` and `balance_qty`
- BRR links to Purchase Bill creation (Purchase Bill has `brr_id` FK)
- The P&L doesn't directly use GRN/GIN data
- The Balance Sheet uses journal entries tagged with CC code "CARM" for raw materials stock

---

## 16. Project Management & Billing Chain

### 16.1 Sale/Billing Flow

```
OG Sale Order → Budget → Billing (Certified Bill) → Sale Bill → Sale Receipt → Sale Receipt Billing
```

### 16.2 Key Models

| Model | Purpose | Financial Link |
|-------|---------|---------------|
| `OgSaleOrderMaster` + items + BOQ items | Customer sale orders | P&L income source |
| `BudgetMaster` + `BudgetItem` + `BudgetItemCCCode` | Cost estimation per SO | P&L expense source |
| `BillingMaster` + `BillingItem` + `BillingBoqItem` | Certified bills (claims) | Links to Sale Bill |
| `SaleBillMaster` + items + GST + sources | Invoices | My Ledger, Balance Sheet debtors |
| `SaleReceiptMaster` | Receipt header | Balance Sheet debtors deduction |
| `SaleReceiptBillingMaster` + items + GST | Receipt per certified bill | My Ledger |

### 16.3 Budget → P&L Connection

The P&L report reads budget data in two ways:
1. `BudgetItemCCCode.cc_total` — Per CC code per budget item (direct expenses)
2. `BudgetMaster.overhead_data` — JSON column with project/employee overhead estimates

Both are **estimates**, not actuals. The budget records are snapshots of sale order item costs.

---

## 17. Bank & Cash Management

### 17.1 Contra Entry

**File:** `erp_backend/app/models/contraEntry.py`

- `ContraEntryLine.account_id` FK→bank_cash — bank/cash account
- `opening_balance`, `debit_amount`, `credit_amount`, `closing_balance` per line
- Used for inter-bank/cash transfers only
- **Does NOT create journal entries**

### 17.2 Balance Sheet Bank Balances

Calculated in `balance_sheet/service.py`:
```python
bank_balance = received_in (BillPaymentReceiptMaster where bank mode)
             - paid_out (PaymentVoucherMaster where bank mode)
```

This is the net of vendor payments received (via bill payment) minus vendor payments made (via payment voucher), filtered to bank mode. **This does NOT include:**
- Contra entry transfers
- Sale receipt bank deposits
- Any other cash flow

### 17.3 Cash Balance

```python
cash = SUM(PettyCashDocketVoucher.total_amount WHERE mode_of_payment="Cash")
```

This is **total petty cash spending**, not a cash balance. A true cash balance would need opening balance + receipts − payments.

---

## 18. Identified Architectural Gaps

### 18.1 CRITICAL Gaps

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No automatic journal posting** | Transactions are approved but never reach the general journal; balance sheet items that depend on journal entries will be zero unless manual JEs are created |
| 2 | **P&L shows budgets, not actuals** | The P&L report shows estimated costs from budget, not actual expenses from purchase bills or payments |
| 3 | **No Trial Balance** | Cannot verify that total debits equal total credits across all accounts |
| 4 | **No Financial Year / Period Close** | All calculations are cumulative from inception; no ability to close a year, carry forward balances, or compare year-over-year |
| 5 | **Dual data sources in Balance Sheet** | Some items from journal entries, others from source docs; if journals are incomplete, the balance sheet is internally inconsistent |
| 6 | **Bank balance calculation incomplete** | Only tracks PaymentVoucher outflows and BillPaymentReceipt inflows — misses contra transfers, sale receipts, and other bank activity |

### 18.2 HIGH-Severity Gaps

| # | Gap | Impact |
|---|-----|--------|
| 7 | **CC code string denormalization** | ~15 tables store CC as strings without FK; renames/deletions in cc_codes won't propagate |
| 8 | **No opening balances** | Cannot set starting balances for accounts at system go-live or year-start |
| 9 | **Cash balance is spending total, not balance** | Balance Sheet "Cash in hand" shows total petty cash spent via cash, not actual cash position |
| 10 | **Single-sided journal entries allowed** | JEs with only Dr lines (no Cr) pass validation, violating double-entry principle |
| 11 | **JE entry_date always today** | Cannot backdate journal entries; adjustment entries for past periods use today's date |

### 18.3 MEDIUM-Severity Gaps

| # | Gap | Impact |
|---|-----|--------|
| 12 | **Customer references are free-text** | JE customer lines can't be reconciled against any master |
| 13 | **No unified chart of accounts** | CC codes, vendors, bank accounts are separate namespaces with no unified view |
| 14 | **Hardcoded CC codes in reports** | P&L and Balance Sheet hardcode ~90 CC code strings; adding new codes requires code changes |
| 15 | **No GST return preparation** | GST data exists but no GSTR-1/3B compilation |
| 16 | **My Ledger and Vendor Ledger bypass journal** | These ledger reports read from source docs, not the journal — creating parallel truth sources |
| 17 | **No audit trail for amount changes** | Only workflow state changes are tracked via history; amount modifications within Draft/Reback leave no trail |

---

## 19. Risk Assessment

### 19.1 Financial Reporting Risk: HIGH

The P&L and Balance Sheet reports currently produce meaningful numbers only under specific conditions:
- P&L requires up-to-date budgets that mirror actual costs
- Balance Sheet requires manual journal entries for all CC-based line items
- Balance Sheet bank balances only reflect vendor payment flows
- Any transaction without a corresponding manual JE is invisible to the balance sheet for affected line items

### 19.2 Data Integrity Risk: MEDIUM-HIGH

- String CC codes can't be validated against the master
- No mechanism prevents CC code drift across 15+ tables
- Free-text customer references in journal entries have no traceability
- Single-sided journal entries can introduce imbalance

### 19.3 Compliance Risk: MEDIUM

- No trial balance for audit verification
- No financial year closing for statutory reporting
- GST input credit recognized at payment time, not invoice time (may not align with GST rules)
- No GSTR preparation functionality

### 19.4 Operational Risk: LOW-MEDIUM

- Manual journal entry creation is error-prone and labor-intensive
- Hardcoded CC codes in reports require developer intervention to modify
- No opening balance mechanism makes system migration/go-live complex

---

## 20. Recommendations Summary

### Phase 2 Priority (Architectural)

1. **Implement automatic journal posting** — Each approved transaction should auto-create balanced journal entries
2. **Build actual P&L** — Derive income from sale bills (invoiced) and expenses from purchase bills (booked), not budgets
3. **Implement Trial Balance** — Aggregate all journal entry lines by account, showing debit/credit totals and net balance
4. **Add Financial Year model** — Year config with opening balance generation and year-end close

### Phase 2 Priority (Data Integrity)

5. **Migrate CC code strings to FKs** — At minimum, add cc_code_id FK to PurchaseBillItem, SaleBillItem, and other frequently queried tables
6. **Fix single-sided JE validation** — Require total_debit == total_credit for all entries
7. **Allow custom entry_date on JEs** — Accept user-provided dates (with validation) instead of forcing today()

### Phase 2 Priority (Reporting)

8. **Fix Balance Sheet bank balances** — Include all bank-impacting transactions (contra entries, sale receipts)
9. **Fix cash balance** — Track actual cash position (opening + receipts − payments)
10. **Dynamic CC code mapping in reports** — Read CC codes from database configuration instead of hardcoding in Python

### Phase 3 (Compliance & Operations)

11. **GST return preparation** — Compile GSTR-1/3B from existing GST data
12. **Opening balance entry mechanism** — Allow initial balance setup for all account types
13. **General Ledger report** — Unified view across CC, Vendor, and Bank accounts
14. **Unified Chart of Accounts** — Single account master linking CC codes, vendors, and bank accounts

---

*End of Phase 1 Audit Report*
