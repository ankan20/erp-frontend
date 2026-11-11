# Phase 1: Complete ERP Accounting Architecture Audit Report

**Date:** 2026-11-10
**Scope:** Research-only audit of PRAX ERP backend and frontend accounting architecture
**Status:** COMPLETE

---

## Executive Summary

The PRAX ERP is a **project-based construction ERP** with ~80+ models and ~40+ backend modules. The accounting architecture has a **fundamental design pattern**: operational transactions (procurement, billing, sales) are standalone and do **NOT** auto-generate journal entries. Journal entries are manually created by finance users, and financial reports pull from **different data sources** depending on the report.

### Critical Architectural Findings

1. **No auto-posting**: No module outside `journal_entry/service.py` creates `JournalEntryMaster` records. All journal entries are manual.
2. **Split data sources for financial reports**: P&L pulls from Budgets + Sale Orders. Balance Sheet pulls from Journal Entry Lines. These are disconnected data sources.
3. **No Trial Balance module exists**. No financial year model exists. No opening balance mechanism exists (except `ContraEntryLine.opening_balance` for bank transfers).
4. **Vendor/Ledger dual model**: The `Vendor` table doubles as the ledger master. Vendor ledger is computed dynamically from Purchase Bills, Bill Payments, Debit Notes, and Credit Notes — not from journal entries.
5. **Stock is dynamically computed** from GRN minus GIN — no stored stock balances.
6. **CC Codes are the Chart of Accounts**: Every accounting line item references a CC Code, which belongs to a Group classified as either "Profit & Loss" or "Balance Sheet" via `head_under`.

---

## 1. Master Data Architecture

### 1.1 CC Code (Chart of Accounts)
**Model:** `cc_codes` table, `CCCode` model
- `cc_code` (unique, e.g., "CARM", "DIR1", "CRIN")
- `cc_name` (description)
- `group_id` → `GroupMaster` (Balance Sheet or P&L classification)
- `category_code` → `CategoryMaster` (business category)
- `sub_group_id` → `SubGroupMaster` (optional sub-grouping)
- `is_non_ledger` (Boolean, only for Balance Sheet groups — determines if usable for ledger connections)
- `pl_linked`, `pl_group_id`, `pl_sub_group_id` — optional Profit & Loss linkage for BS-classified codes

**Key insight**: CC Codes sit in a Balance Sheet group (via `group_id`). Some also link to a P&L group via `pl_linked`/`pl_group_id`. The `head_under` field on `GroupMaster` classifies groups as either `"Profit & Loss"` or `"Balance Sheet"`.

### 1.2 Group Master (Account Classification)
**Model:** `group_master` table
- `group_name` (e.g., "Fixed Asset", "Current Liabilities")
- `head_under` — `"Profit & Loss"` or `"Balance Sheet"` (this is the fundamental classification)
- Sub-groups via `SubGroupMaster` with up to 3 nesting levels

### 1.3 Category Master
**Model:** `category_master` table
- `fixed_code` (e.g., "RAW_MATERIAL", "FIXED_ASSET", "ELECTRICAL_VENDOR")
- Business category for items and vendors
- Hardcoded reference: `GroupMaster.group_name == "Fixed Asset"` in indent service for asset filtering

### 1.4 Vendor (doubles as Ledger Master)
**Model:** `vendors` table
- `ledger_code` (auto-generated, unique)
- `ledger_name` (display name)
- `gstin` (GST identification)
- Multi-project via `VendorProject` junction table
- Used as both vendor record AND ledger account reference

### 1.5 Bank/Cash Master
**Model:** `bank_cash` table
- `type` — "Bank" or "Cash"
- `bank_code` (unique identifier)
- Financial details (account number, IFSC, etc.)
- `group_id`, `sub_group_id` — Balance Sheet classification (same pattern as CCCode)
- Multi-project via `BankCashProject` junction table
- **No stored balance** — balance computed from PaymentVoucher and BillPaymentReceipt transactions

### 1.6 Item Master
**Model:** `items` table
- Links to CC code via `cc_code_id` → `CCCode`
- `gst_percentage` — per-item GST rate
- Category via `category_code`

---

## 2. Procurement / Resource Modules

### 2.1 Indent → Order → GRN → Stock Flow

| Module | Creates Journal Entries? | Accounting Impact |
|--------|------------------------|-------------------|
| **Indent** (indent/service.py, ~2045 lines) | NO | Workflow only. CC code summary via Item→CCCode join. Hardcoded `GroupMaster.group_name == "Fixed Asset"` for asset filtering. |
| **Order** (order/service.py) | NO | CC code summary with `get_cc_code_summary()`. Computes GST per item: `gst_amount = (amount * gst_percent) / 100`. Stores amounts on OrderItem. |
| **GRN** (grn/service.py) | NO | Goods received tracking. Validates against remaining balance qty from order. No stock table writes. |
| **GIN** (gin/service.py, ~1270 lines) | NO | Goods issue. Reduces available stock (dynamically computed). |
| **SRN** (srn/service.py, ~1292 lines) | NO | Sales return tracking. Similar pattern to GRN. |
| **DLR** (dlr/service.py, ~697 lines) | NO | Delivery record tracking. |
| **Stock** (stock/service.py, ~358 lines) | NO | **Dynamically computed**: Approved GRN received qty minus Approved GIN issued qty. Grouped by CC code (Item→cc_code_id→CCCode). No stored balances. |

### 2.2 Vendor Billing Flow

| Module | Creates Journal Entries? | Accounting Impact |
|--------|------------------------|-------------------|
| **Vendor Billing GRN** (vendor_billing_grn/service.py) | NO | BVS (Vendor Billing Statement). Tracks billing qty per GRN item. CC summary via Item/Asset→CCCode. |
| **BRR** (bill_receive_register/service.py) | NO | Bill Receive Register. Records vendor bills received. Stores basic_amount, gst_amount, total_amount. No journal impact. |
| **BRR Billing** (brr_billing/service.py) | NO | Billing against BRR. Similar standalone pattern. |

---

## 3. Finance Modules — Core Accounting

### 3.1 Journal Entry (THE Source of Truth for Balance Sheet)
**Model:** `journal_entry_master` + `journal_entry_lines`
**Service:** `finance/journal_entry/service.py`

**This is the ONLY module that creates journal entries in the entire system.**

#### JournalEntryMaster:
- `voucher_no` (auto-generated with mode prefix)
- `entry_date` (defaults to today)
- `entry_mode`: `"new_voucher"` | `"bulk_docket"` | `"adjustment"`
- `ref_bill_type`: `"sale_bill"` | `"purchase_bill"` | `"receipt_billing"` (optional reference)
- `ref_bill_id` (optional)
- `total_debit`, `total_credit` (must balance when Cr lines exist)
- Standard workflow: Draft → Submit → Pending_L{n} → Approved

#### JournalEntryLine:
- `account_type`: `"CC"` | `"Vendor"` | `"Customer"` (determined by which ID is set)
- `dr_cr`: `"Dr"` | `"Cr"`
- `cc_id` → CCCode (for CC-type accounts)
- `vendor_id` → Vendor (for Vendor-type accounts)
- `customer_ref` (string snapshot for Customer-type)
- `debit_amount`, `credit_amount`

**Flow:**
1. User manually creates journal entry with Dr/Cr lines
2. Each line references either a CC Code, Vendor, or Customer
3. Total debit must equal total credit (when Cr lines exist)
4. Goes through approval workflow
5. Only "Approved" + "Active" entries are used in reports

**bulk_docket mode:** Links petty cash docket vouchers to a journal entry via `PettyCashJournalVoucher.linked_journal_id`

### 3.2 Purchase Bill
**Model:** `purchase_bill_master` + `purchase_bill_items` + `purchase_bill_gst`

- Records vendor invoices
- Links to BRR via `brr_id`
- Items have `cc_code` (string, not FK — snapshot)
- GST lines: up to 3 rows (IGST/CGST/SGST) with `is_selected` flag
- **Does NOT create journal entries**
- Used in P&L "booked" column and vendor ledger

### 3.3 Payment Voucher
**Model:** `payment_voucher_master` + `payment_voucher_items` + `payment_voucher_gst`

- Records outgoing payments to vendors
- `payment_mode`: "Cash" or "Bank"
- Links to `bank_cash` via `bank_ac_id` or `cash_ac_id`
- Items track `booked_amount` (from purchase bill) and `current_amount` (being paid)
- `cc_code_id` FK → CCCode on items
- **Does NOT create journal entries**
- Used in Balance Sheet bank balance calculation (sum of approved PaymentVoucher amounts = paid out)

### 3.4 Bill Payment Receipt (Vendor Payment)
**Model:** `bill_payment_receipt_master` + items + GST
**Service:** `finance/bill_payment/service.py`

- The actual payment execution against journal entries
- Links to `journal_entry_id` (primary journal voucher being paid)
- Items reference `je_line_id` (specific JournalEntryLine being paid)
- Tracks `booked_amount` vs `current_amount` per CC code line
- GST lines track payment of GST amounts
- **Does NOT create journal entries itself**
- Used in Balance Sheet: bank balance = received_in - paid_out

### 3.5 Sale Bill
**Model:** `sale_bill_master` + `sale_bill_items` + `sale_bill_gst` + `sale_bill_sources`

- Records outgoing invoices to clients
- Links to OG Sale Order and Certified Bills
- Items have `cc_code` (string snapshot), `gst_percent`
- GST lines: IGST/CGST/SGST with `is_selected`
- **Does NOT create journal entries**
- Used in Balance Sheet: Sundry Debtors (CASD) = sale bill total - sale receipt total
- Used in Balance Sheet: GST output calculation

### 3.6 Sale Receipt
**Model:** `sale_receipt_master`

- Records incoming payments from clients
- Used in Balance Sheet: subtracted from sale bill total for Sundry Debtors
- **No workflow_status** — all records count

### 3.7 Sale Receipt Billing
**Model:** `sale_receipt_billing_master`

- Similar to sale receipt but with workflow
- Used in My Ledger for project-level accounting

### 3.8 Contra Entry
**Model:** `contra_entry_master` + `contra_entry_lines`

- Bank-to-bank or bank-to-cash transfers
- Lines reference `bank_cash.id` via `account_id`
- Each line has: `opening_balance`, `debit_amount`, `credit_amount`, `closing_balance`
- `dr_cr`: "Dr" or "Cr"
- Standard workflow
- **Does NOT create journal entries**
- Used in Petty Cash Ledger for cash account balances

### 3.9 Debit Note / Credit Note
(Already documented in prior session)
- Standalone forms with vendor reference
- Cross-reference fields (creditNoteNo on DebitNote, debitNoteNo on CreditNote)
- **Do NOT create journal entries**
- Used in Vendor Ledger calculations

### 3.10 Petty Cash
**Budget** (`petty_cash/budget/service.py`, ~706 lines):
- Budget allocation per project
- Links to bank/cash accounts
- Has approval workflow

**Docket Voucher** (`petty_cash/docket_voucher/service.py`, ~753 lines):
- Small cash expenditure records
- `mode_of_payment`: "Cash" or other
- Can be bulk-linked to journal entries via `bulk_docket` mode
- Used in Balance Sheet: Cash in hand = sum of approved docket voucher totals (Cash mode)

**Ledger** (`petty_cash/ledger/service.py`):
- Computes account balances from docket vouchers and contra entry lines
- Dynamically computed, not stored

---

## 4. Financial Reports Architecture

### 4.1 Profit & Loss (`finance/profit_loss/service.py`)

**Data Sources — THREE separate queries, NOT from journal entries:**

| Section | Source | Query |
|---------|--------|-------|
| **Sales (CRIN)** | `OgSaleOrderMaster` | Sum of `total_amount` where Approved + Active |
| **Expenses (order column)** | `BudgetItemCCCode` + `BudgetMaster.overhead_data` | Grouped by cc_code from approved budgets |
| **Booked (actual column)** | `PurchaseBillItem` | Sum of `basic_amount` grouped by cc_code from approved purchase bills |

**Hardcoded CC codes** (50 total in `_ALL_CODES`):
```
CRIN, CRHL, CRAP, UCAP, WIPS, INOC (Sale codes)
DRCW, DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS (Direct Expenses)
IRDC, IRAD, IRLE, IRFS, IRMR, IRLU, IRMT, IRPS, IRSD (Indirect)
IRIM, IRIL, IRFM, IRTT, IRLH, IRLM, IRLT (Indirect cont.)
IOFM, IOHR, IOME, IOMS, IOMB, IOSS, IOVR, IOTV (Overhead)
IOCR, CRBC, CRBD, CRCC, CRDR, CRES, CRIC, CRIP, CRLC, CRPF, CRIT (Other)
```

**DRCW** is computed as sum of DE sibling codes (DRMC+DRFD+DRMH+DRUS+DRMR+DRLC+DRLS+DRMS).

**Columns returned:** code, order (budget), workDone (null), booked (purchase bills), stock (null), actual (null)

**Key gap:** `workDone`, `stock`, and `actual` columns are all NULL — not yet implemented.

### 4.2 Balance Sheet (`finance/balance_sheet/service.py`)

**Data Sources — MIXED, primarily from JournalEntryLine:**

| Section | Source |
|---------|--------|
| **Equity (DIR1, DIR2)** | JournalEntryLine (credit - debit balance) |
| **P&L Reserve (CRSF)** | Recomputed P&L net (Sale Orders - Budget Expenses) |
| **Non-current Liabilities** | JournalEntryLine balance for LON1, LON2, LON3, USLO, NBFC, NCDT, NCTL, NCTP |
| **Current Liabilities** | JournalEntryLine balance for CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM |
| **GST Payable (CLGP)** | SaleBillGst (output) - BillPaymentReceiptGst (input) |
| **Fixed Assets** | JournalEntryLine debit sum for APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB |
| **Non-current Assets** | JournalEntryLine debit sum for NCIV, NCTA, LTLA, NCCA |
| **Current Assets (Stock CARM)** | JournalEntryLine debit sum for CARM |
| **Sundry Debtors (CASD)** | SaleBillMaster total - SaleReceiptMaster total |
| **Bank Balances** | BillPaymentReceiptMaster (received) - PaymentVoucherMaster (paid out) per bank |
| **Cash in Hand** | PettyCashDocketVoucher total (Cash mode) |

**Hardcoded CC codes** used in bulk queries:
- Balance codes: DIR1, DIR2, LON3, LON1, LON2, USLO, NBFC, NCDT, NCTL, NCTP, CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM
- Debit-sum codes: CARM, CAHL, CAAP, CAUM, CAWP, CART, CAAE, CAOP, CACI, CATS, CAOA, APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB, NCIV, NCTA, LTLA, NCCA

**Known limitations:**
- LON3 is shared across multiple banks (Kotak JCB, Kotak Venus, ICICI OD) — split tracking not possible without sub-codes
- LON3 Kotak Venus and ICICI OD are hardcoded as 0.0

### 4.3 Trial Balance
**Does NOT exist as a module.** No `trial_balance/` directory. No `TrialBalance` model. No computed trial balance function anywhere in the codebase.

### 4.4 Monthly Summary (`finance/monthly_summary.py`)
- Email report grouping document counts by project
- Covers: Purchase Bills, Sale Bills, Journal Entries, Contra Entries, Credit/Debit Notes, Petty Cash Docket Vouchers, Bill Payment Receipts, Sale Receipts
- Purely presentational — no calculations

---

## 5. Ledger Architecture

### 5.1 Vendor Ledger (`finance/vendor_ledger/service.py`)

**Dynamically computed** from four transaction types:
1. **Purchase Bill** (Approved) → Credit entry (we owe vendor)
2. **Bill Payment Receipt** (Approved) → Debit entry (we paid vendor)
3. **Debit Note** (Approved) → Debit entry (reduces payable)
4. **Credit Note** (Approved) → Credit entry (increases payable)

Running balance: `Credit - Debit` (positive = we owe vendor)
**NOT computed from journal entries.**

### 5.2 My Ledger / Project Ledger (`finance/my_ledger/service.py`)

**Dynamically computed** from six transaction types per project:
1. **Sale Bill** → Debit (we billed client, receivable)
2. **Sale Receipt Billing** → Credit (client paid)
3. **Purchase Bill** → Credit (vendor billed us)
4. **Bill Payment Receipt** → Debit (we paid vendor)
5. **Debit Note** → Debit (reduces payable)
6. **Credit Note** → Credit (increases payable)

**NOT computed from journal entries.**

---

## 6. GST Architecture

### 6.1 Per-Item GST
- `Item.gst_percentage` — stored on the Item master
- Order items compute: `gst_amount = (amount * gst_percent) / 100`
- Split into CGST/SGST/IGST in PDF generation (naive 50/50 CGST/SGST split)

### 6.2 Transaction GST
- Purchase Bill, Payment Voucher, Sale Bill, Bill Payment Receipt all have dedicated GST line tables
- GST lines store: `gst_type` (IGST/CGST/SGST), `percent`, `gst_amount`, `is_selected`
- CC code reference on GST lines (string snapshot, not FK)

### 6.3 GST in Financial Reports
- Balance Sheet computes GST Payable:
  - Output GST = from SaleBillGst (selected, approved)
  - Input GST = from BillPaymentReceiptGst (approved)
  - Net = Output - Input
  - Positive → Current Liability (CLGP)
  - Negative → Current Asset (excess input credit)

### 6.4 Missing GST Features
- No GST return filing module
- No GSTR-1/GSTR-3B computation
- No reverse charge mechanism tracking
- No HSN-wise summary report
- CGST/SGST split in Order PDFs is hardcoded 50/50 — does not consider inter-state (IGST) vs intra-state (CGST+SGST)

---

## 7. CC Code Architecture — Hardcoded vs Configurable

### 7.1 Hardcoded CC Codes

**In P&L service:** 50 codes hardcoded in `_ALL_CODES` list
**In Balance Sheet service:** ~46 codes hardcoded in bulk query calls
**In indent service:** `GroupMaster.group_name == "Fixed Asset"` hardcoded for asset filtering

### 7.2 CC Code Classification Flow
```
GroupMaster (head_under: "Profit & Loss" | "Balance Sheet")
  └── SubGroupMaster (level 0, 1, 2 nesting)
       └── CCCode (cc_code, cc_name)
            ├── group_id → GroupMaster (primary, always BS)
            ├── pl_linked → Boolean
            ├── pl_group_id → GroupMaster (P&L link, optional)
            └── is_non_ledger → Boolean (BS groups only)
```

### 7.3 Inventory CC Codes
- Fixed in code — CARM for raw materials, CAHL/CAAP/CAUM/CAWP for other current assets
- Stock module dynamically computes quantities but Balance Sheet uses journal entry amounts

---

## 8. Data Flow Diagrams

### 8.1 Procurement → Payment Flow
```
Indent → Order → GRN → Stock (computed)
                    ↓
              Vendor Billing (BVS)
                    ↓
              BRR (Bill Received)
                    ↓
            Purchase Bill ──────→ Vendor Ledger
                    ↓                    ↑
         [MANUAL] Journal Entry          │
                    ↓                    │
           Bill Payment Receipt ─────────┘
                    ↓
              Bank Balance (computed)
```

### 8.2 Sales → Receipt Flow
```
OG Sale Order → Budget → P&L (order column)
      ↓
  Certified Bill (Billing)
      ↓
  Sale Bill ──────→ My Ledger / GST Output
      ↓                    ↑
  Sale Receipt ────────────┘
      ↓
  Sundry Debtors (CASD, computed)
```

### 8.3 Journal Entry → Balance Sheet Flow
```
[MANUAL] Journal Entry (with CC Code Dr/Cr lines)
         ↓ (only Approved + Active)
    JournalEntryLine
    ├── CC-type lines → Balance Sheet (equity, liabilities, assets)
    ├── Vendor-type lines → (not used in reports currently)
    └── Customer-type lines → (not used in reports currently)
```

---

## 9. Missing Modules / Gaps

### 9.1 No Financial Year System
- No `financial_year` model or table
- No year-end close process
- No mechanism to carry forward balances
- Date filtering on reports is ad-hoc (fromDate/toDate parameters)

### 9.2 No Trial Balance
- No module computes or displays a trial balance
- Would need to aggregate all CC code balances from JournalEntryLine

### 9.3 No Opening Balances
- No opening balance mechanism except `ContraEntryLine.opening_balance` for bank transfers
- No year-start balance initialization
- Balance Sheet shows all-time accumulated values (no period isolation)

### 9.4 P&L ≠ Journal Entries
- P&L pulls from Budgets and Sale Orders, NOT from journal entries
- Balance Sheet pulls CRSF (P&L net) by recomputing the same Budget/Sale Order logic
- This means P&L and Balance Sheet use fundamentally different data sources for the same concepts

### 9.5 Disconnected Vendor Ledger
- Vendor ledger is computed from Purchase Bills + Payments + DN/CN
- This is independent of the journal entry system
- A journal entry with vendor lines does NOT affect the vendor ledger

### 9.6 Bank Balance Computation
- Bank balance = BillPaymentReceipt (in) - PaymentVoucher (out)
- NOT from journal entries
- NOT from a stored running balance
- Contra entries are NOT factored into bank balance computation in Balance Sheet

### 9.7 Cash Balance
- Cash in hand = sum of petty cash docket vouchers (Cash mode)
- NOT from journal entries or contra entries
- Missing: cash payments made via PaymentVoucher (Cash mode)

---

## 10. Data Integrity Observations

### 10.1 CC Code Reference Inconsistency
- JournalEntryLine uses `cc_id` (FK to cc_codes.id) ✓
- PaymentVoucherItem uses both `cc_code_id` (FK) and `cc_code` (string) — redundant
- PurchaseBillItem uses only `cc_code` (string snapshot) — no FK
- SaleBillItem uses only `cc_code` (string snapshot) — no FK
- BudgetItemCCCode uses `cc_code` (string) — no FK

### 10.2 Duplicate ValueError catch
- BRR service `create_brr` has duplicate `except ValueError` blocks (lines 241-246)

### 10.3 GST Split Logic
- Order PDF uses naive 50/50 CGST/SGST split for all items
- Does not determine inter-state vs intra-state based on vendor/project GSTIN comparison

### 10.4 Hardcoded Bank Names
- Balance Sheet has hardcoded bank labels (e.g., "Kotak Mahindra Bank — JCB", "Bajaj Finserv", "L&T Finance")
- LON3 code shared by multiple banks with no distinguishing sub-code

---

## 11. Module Inventory

### Backend Models (~80+ files)
Key accounting models: `journalEntry.py`, `contraEntry.py`, `purchaseBill.py`, `paymentVoucher.py`, `saleBill.py`, `saleReceipt.py`, `saleReceiptBilling.py`, `billPaymentReceipt.py`, `debitNote.py`, `creditNote.py`, `cc_code.py`, `category_group.py`, `vendor.py`, `bankCash.py`, `budget.py`, `pettyCashDocketVoucher.py`, `pettyCashBudget.py`, `journalVoucher.py`

### Backend Modules (~40+ directories)
**Finance:** journal_entry, contra_entry, purchase_bill, sale_bill, sale_receipt, sale_receipt_billing, payment_voucher, bill_payment, vendor_ledger, my_ledger, credit_note, debit_note, petty_cash (budget, docket_voucher, ledger), profit_loss, balance_sheet
**Resources:** indent, order, order_projectwork, grn, gin, srn, dlr, stock, vendor_billing_grn
**Billing:** bill_receive_register, brr_billing
**Project Management:** contract/budget, custom_billing/billing, register, site_report
**Master:** service.py (ledger, CC code, bank/cash, item, unit, category, group masters)

---

## 12. Summary of Key Design Decisions

| Aspect | Current Design | Implication |
|--------|---------------|-------------|
| Journal Entries | Manual only | No auto-posting from purchases, sales, or payments |
| P&L Data Source | Budgets + Sale Orders | Disconnected from actual journal entries |
| Balance Sheet Data Source | Journal Entry Lines + mixed | Multiple data sources, not purely double-entry |
| Vendor Ledger | Purchase Bills + Payments | Independent of journal entries |
| Stock Valuation | Dynamic GRN-GIN | No stored balances, no valuation methods (FIFO/LIFO) |
| Financial Year | None | No period boundaries, no year-end close |
| Trial Balance | None | Not implemented |
| Opening Balances | None (except contra entry bank OB) | No carry-forward mechanism |
| GST | Per-transaction storage | No return filing, no inter/intra-state logic |
| CC Codes in Reports | Hardcoded lists | Adding a new CC code requires code changes to P&L/BS |

---

*End of Phase 1 Audit Report*
