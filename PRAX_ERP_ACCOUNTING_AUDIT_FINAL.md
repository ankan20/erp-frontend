# PRAX ERP — Complete Accounting Architecture and Dependency Audit

**Phase 1: Research-Only Report**
**Date:** 2026-11-10
**Status:** No code modifications made. No database changes. No migrations. No refactoring.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Module Map — Every Module in the System](#2-module-map)
3. [Finance Module Dependency Map](#3-finance-module-dependency-map)
4. [CC Code Architecture Audit](#4-cc-code-architecture-audit)
5. [Hardcoded CC Codes and Accounting Values](#5-hardcoded-cc-codes-and-accounting-values)
6. [Journal Entry System — The Accounting Source of Truth](#6-journal-entry-system)
7. [Ledger Architecture](#7-ledger-architecture)
8. [Trial Balance](#8-trial-balance)
9. [P&L Report Architecture](#9-pl-report-architecture)
10. [Balance Sheet Architecture](#10-balance-sheet-architecture)
11. [GST Accounting](#11-gst-accounting)
12. [Opening Balances and Financial Year](#12-opening-balances-and-financial-year)
13. [Contra Entry (Bank Transfer) Architecture](#13-contra-entry)
14. [BankCash Model and Balance Sheet Integration](#14-bankcash-model)
15. [Vendor (Ledger) Model](#15-vendor-ledger-model)
16. [Budget Model and CC Code Junction](#16-budget-model)
17. [Workflow Architecture](#17-workflow-architecture)
18. [Petty Cash Subsystem](#18-petty-cash-subsystem)
19. [Procurement & Sales Lifecycle](#19-procurement-sales-lifecycle)
20. [API Endpoint Map](#20-api-endpoint-map)
21. [Data Integrity and Accounting Consistency Issues](#21-data-integrity-issues)
22. [Risk Assessment](#22-risk-assessment)
23. [Recommended Target Architecture (Phase 2 Roadmap)](#23-recommendations)
24. [Appendices](#appendices)

---

## 1. Executive Summary

PRAX ERP is a **project-centric construction/infrastructure ERP** with a Flask/SQLAlchemy backend and a Next.js 16 / React frontend. The accounting architecture has several **critical design characteristics** that diverge from standard double-entry bookkeeping systems:

### Key Findings

1. **Journal entries are manually created only** — No transaction module (Purchase Bill, Sale Bill, Bill Payment, etc.) auto-posts to the general journal. Journal entries exist as a standalone module. This is the single most impactful architectural gap.

2. **Financial reports use DUAL data sources** — The Balance Sheet reads from journal entries (for CC-code-based line items) AND from raw source documents (for bank balances, sundry debtors, GST). The P&L report reads from **budget estimates**, not actuals.

3. **No Trial Balance exists** — There is no trial balance report or computation anywhere in the codebase.

4. **No Financial Year model** — There is no financial year configuration, year-end closing, or opening balance mechanism.

5. **CC codes are predominantly stored as denormalized strings** — Only 5 out of ~20 transaction tables use proper foreign keys to the `cc_codes` table. The rest store `cc_code` and `cc_name` as plain strings (snapshots at transaction time).

6. **The Vendor model doubles as the ledger/account master** — Vendors and ledger accounts share the same table (`vendors`), distinguished by `type` ("creditor" | "debtor"). No balance columns exist; balances are computed on-the-fly from source documents.

7. **P&L is budget-based, not actual-based** — The profit & loss report sums sale order amounts as income and budget CC-code estimates as expenses. Three columns (`workDone`, `stock`, `actual`) return `None` — not implemented.

8. **~80 CC codes hardcoded in reports** — P&L hardcodes 50 CC codes; Balance Sheet hardcodes ~30. Adding new codes requires code changes.

9. **Balance Sheet has an undefined variable bug** — `caav` (Advance to Vendors, code CAAV) at line 688 of `balance_sheet/service.py` is never assigned; will cause NameError if that code path executes.

10. **Stock is dynamically computed** — from GRN received minus GIN issued. No stored stock balances.

---

## 2. Module Map — Every Module in the System

### Finance Modules (Backend: `app/modules/finance/`)

| Module | Backend Service | Frontend Route | Doc Prefix |
|---|---|---|---|
| Sale Bill | `sale_bill/service.py` | `/finance-management/account/sale-bill` | `{FY}DH{seq}{projCode}` |
| Purchase Bill | `purchase_bill/service.py` | `/finance-management/account/purchase-bill` | — |
| Payment Voucher | `payment_voucher/service.py` | `/finance-management/account/payment-voucher` | `PV{seq}` |
| Bill Payment Receipt | `bill_payment/service.py` | `/finance-management/account/bill-payment` | — |
| Sale Receipt | `sale_receipt/service.py` | `/finance-management/account/sale-receipt` | — |
| Sale Receipt Billing | `sale_receipt_billing/service.py` | `/finance-management/account/sale-receipt-billing` | `SRB{seq}` |
| Debit Note | `debit_note/service.py` | `/finance-management/account/debit-note` | `DN{seq}` |
| Credit Note | `credit_note/service.py` | `/finance-management/account/credit-note` | `CN{seq}` |
| Contra Entry | `contra_entry/service.py` | `/finance-management/account/contra-entry` | `CV{seq}` |
| Journal Entry | `journal_entry/service.py` | `/finance-management/account/journal-entry` | `JV/JB/JA{seq}` |
| Journal Voucher (Petty Cash) | `journal_entry/journal_voucher/service.py` | `/finance-management/account/journal-vouchering` | `BV{seq}` |
| Petty Cash Budget | `petty_cash/budget/service.py` | `/finance-management/account/petty-cash-budget` | — |
| Petty Cash Docket Voucher | `petty_cash/docket_voucher/service.py` | `/finance-management/account/docket-voucher` | — |
| Petty Cash Ledger | `petty_cash/ledger/service.py` | `/finance-management/account/petty-cash-ledger` | — |
| My Ledger | `my_ledger/service.py` | `/finance-management/account/ledger` (tab 1) | — |
| Vendor Ledger | `vendor_ledger/service.py` | `/finance-management/account/ledger` (tab 2) | — |
| Profit & Loss | `profit_loss/service.py` | `/finance-management/report/pnl` | — |
| Balance Sheet | `balance_sheet/service.py` | `/finance-management/report/balance-sheet` | — |

### Billing Modules (Backend: `app/modules/billing/`)

| Module | Backend Path |
|---|---|
| Bill Receive Register (BRR) | `bill_receive_register/` |
| BRR Billing (BRB) | `brr_billing/` |
| BRR Billing GRN | `brr_billing_grn/` |
| BRR Billing SRN | `brr_billing_srn/` |

### Resource Modules (Backend: `app/modules/resources/`)

Indent, Order, Order ProjectWork, GIN, GRN, SRN, DC, Stock, DLR, Batching Plant, Machinery Mgmt, Vendor Billing GRN/SRN, Manpower

### Project Management Modules (Backend: `app/modules/project_mgmt/`)

OG Sale Order, Budget, Custom Billing (Sale Claim Bill, Certified Bill, Extra Work), Uncertain Allocation, Registers (Concrete, Drawing, Hindrance, BBS), Site Report, Daily Progress Report

### Master Data Modules (Backend: `app/modules/master/`)

Group Master, Category Master, Sub Group Master, CC Code, Ledger (Vendor), Item, Asset, Unit, Term, Bank/Cash

### Other Modules

HR, Auth, Communication, Company, Search, Settings, Workflow, Traceability, AI, Delete Manager

---

## 3. Finance Module Dependency Map

### Procurement to Accounting Flow

```
Indent → Order → GRN/SRN → BRR → BRR Billing (BRB)
                                         |
                                 Purchase Bill  (items from BRR)
                                         |
                                 Payment Voucher  (references Purchase Bill)
                                         |
                                 Bill Payment Receipt  (references Purchase Bill items)
```

### Sales to Accounting Flow

```
OG Sale Order → Budget (links CC codes)
      |
Custom Billing (Sale Claim → Certified Bill)
      |
Sale Bill  (items from Certified Bills)
      |
Sale Receipt → Sale Receipt Billing (collections)
```

### Cross-Module Dependencies

| Source Module | Dependent Module | Relationship |
|---|---|---|
| BRR | Purchase Bill | PB items pulled from approved BRR items |
| Purchase Bill | Payment Voucher | PV references PB for vendor payments |
| Purchase Bill | Bill Payment Receipt | BPR pays against PB items, tracks GST |
| Certified Bill | Sale Bill | SB items from approved certified bills |
| Sale Bill | Sale Receipt Billing | SRB collects against sale invoices |
| OG Sale Order | Budget | Budget links sale order items to CC codes |
| OG Sale Order | P&L Report | Sale total from approved OG Sale Orders |
| Budget | P&L Report | Expense totals from BudgetItemCCCode + overhead_data JSON |
| Purchase Bill | P&L Report | "Booked" column from PurchaseBillItem.basic_amount |
| Journal Entry | Balance Sheet | All BS values derived from JournalEntryLine Dr/Cr sums |
| Sale Bill GST | Balance Sheet | GST payable = output (Sale Bill GST) - input (Bill Payment GST) |
| Payment Voucher | Balance Sheet | Bank balance = received (BPR) - paid (PV) per BankCash |
| Petty Cash Docket | Balance Sheet | Cash balance from approved docket vouchers (Cash mode) |
| Sale Bill | My Ledger | Debit entries |
| Sale Receipt Billing | My Ledger | Debit entries |
| Purchase Bill | My Ledger | Credit entries |
| Bill Payment Receipt | My Ledger | Credit entries |
| Debit Note | My/Vendor Ledger | Debit entries |
| Credit Note | My/Vendor Ledger | Credit entries |
| Petty Cash Docket | Journal Voucher | Docket details become JV lines |
| Journal Voucher | Journal Entry | Bulk docket mode (JB prefix) |

### Which Modules Create Journal Entries?

**NONE, except the Journal Entry module itself.** Every other module listed above operates independently. This is the fundamental architectural gap.

| Module | Creates Journal Entries? |
|--------|------------------------|
| Purchase Bill | NO |
| Sale Bill | NO |
| Payment Voucher | NO |
| Bill Payment Receipt | NO |
| Sale Receipt / Billing | NO |
| Contra Entry | NO |
| Debit Note | NO |
| Credit Note | NO |
| Petty Cash Docket | NO |
| Indent / Order / GRN / GIN | NO |

---

## 4. CC Code Architecture Audit

### Master Model: `app/models/cc_code.py` table `cc_codes`

| Field | Type | Notes |
|-------|------|-------|
| `id` | PK | Auto-increment |
| `cc_code` | String(50), unique | Primary business identifier (e.g., "CARM", "DIR1") |
| `cc_name` | String(200) | Display name |
| `group_id` | FK→group_master | Balance Sheet classification (required) |
| `category_code` | FK→category_master | Business category (required) |
| `sub_group_id` | FK→sub_group_master, nullable | Sub-group classification |
| `is_non_ledger` | Boolean, nullable | True=Non-Ledger, False=Ledger Head |
| `pl_linked` | Boolean, default False | Whether CC also falls under P&L |
| `pl_group_id` | FK→group_master, nullable | P&L group (when pl_linked=True) |
| `pl_sub_group_id` | FK→sub_group_master, nullable | P&L sub-group |

**Key Design:** `head_under` is COMMENTED OUT on CCCode model (line 80). The P&L vs Balance Sheet classification is derived from `GroupMaster.head_under` ("Profit & Loss" or "Balance Sheet"). A CC code can be **dual-classified** under BS via `group_id` AND P&L via `pl_group_id`.

### GroupMaster: `app/models/category_group.py`

- `group_name` (unique, e.g., "Fixed Asset", "Current Liabilities")
- `head_under`: "Profit & Loss" or "Balance Sheet" — the fundamental classification
- Sub-groups via `SubGroupMaster` with up to 3 nesting levels (`level`: 0-2)
- `fixed_code` (unique) on SubGroupMaster

### CC Code Storage Across Models

**Normalized (FK to cc_codes.id):**
- `JournalEntryLine.cc_id`
- `PaymentVoucherMaster.cc_code_id`
- `AssetMaster.cc_code_id`
- `ItemMaster.cc_code_id`
- `BudgetItemCCCode.cc_code_id`

**Denormalized (cc_code + cc_name string snapshots, NO FK):**
- `JournalVoucherLine` (PettyCashJournalLine): `cc_code`, `cc_name`
- `PurchaseBillItem/Gst`: `cc_code`, `cc_name`
- `SaleBillItem/Gst`: `cc_code`, `cc_name`
- `BillPaymentItem/Gst`: `cc_code`, `cc_name`
- `SaleReceiptBillingItem/Gst`: `cc_code`, `cc_name`
- `PaymentVoucherGst`: `cc_code`, `cc_name`
- `CreditNoteItem/Gst`: `cc_code`, `cc_name`
- `DebitNoteItem/Gst`: `cc_code`, `cc_name`
- `PettyCashBudgetItem`: `cc_code`, `cc_name`
- `PettyCashDocketItem`: `cc_code`, `cc_name`
- `BudgetItemCCCode`: `cc_code`, `cc_name` (has BOTH FK and string)

**Impact:** Only ~5 tables use FK. ~15 tables use denormalized strings. CC code renames in the master won't propagate to existing documents. However, this may be intentional — snapshots preserve the value at transaction time (audit correctness). The Balance Sheet works because it queries JournalEntryLine which uses FK.

---

## 5. Hardcoded CC Codes and Accounting Values

### P&L Report — Frontend: `src/config/profitLoss.config.js`

50 leaf CC codes hardcoded in display order:

| Section | Codes |
|---------|-------|
| A — SALE (6) | CRIN, CRHL, CRAP, UCAP, WIPS, INOC |
| B.1 — Direct Expenses (9) | DRCW, DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS |
| B.2.1 — Project Overhead (16) | IRDC, IRAD, IRLE, IRFS, IRMR, IRLU, IRMT, IRPS, IRSD, IRIM, IRIL, IRFM, IRTT, IRLH, IRLM, IRLT |
| B.2.2 — Employee Overhead (8) | IOFM, IOHR, IOME, IOMS, IOMB, IOSS, IOVR, IOTV |
| B.2.3 — Office Overhead (11) | IOCR, CRBC, CRBD, CRCC, CRDR, CRES, CRIC, CRIP, CRLC, CRPF, CRIT |

### P&L Report — Backend: `profit_loss/service.py`

Same 50 codes hardcoded in `_ALL_CODES` list (lines 22-29). Sale codes in `_SALE_CODES` set (line 31). DE sibling codes in `_DE_SIBLING_CODES` set (line 7): DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS. DRCW is derived as sum of all DE siblings.

**Data sources per P&L column:**
| Column | Source |
|--------|--------|
| `order` (Sale) | `OgSaleOrderMaster.total_amount` (approved, active) |
| `order` (Expenses) | `BudgetItemCCCode.cc_total` + `BudgetMaster.overhead_data` JSON |
| `booked` | `PurchaseBillItem.basic_amount` by cc_code (approved PBs) |
| `workDone` | **NOT IMPLEMENTED** (returns `None`) |
| `stock` | **NOT IMPLEMENTED** (returns `None`) |
| `actual` | **NOT IMPLEMENTED** (returns `None`) |

### Balance Sheet — Backend: `balance_sheet/service.py`

**Hardcoded CC codes (lines 452-462):**

| Category | Codes |
|----------|-------|
| Equity | DIR1, DIR2 |
| Loans | LON1, LON2, LON3, USLO, NBFC |
| Non-current Liabilities | NCDT, NCTL, NCTP |
| Current Liabilities | CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM |
| Fixed Assets | APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB |
| Non-current Assets | NCIV, NCTA, LTLA, NCCA |
| Closing Stock | CARM, CAHL, CAAP, CAUM, CAWP |
| Advances/Other Current | CART, CAAE, CAOP, CACI, CATS, CAOA |

**Special computations (NOT from CC codes):**
- CRSF (Company Reserves & Surplus Fund) = P&L net, computed inline
- CASD (Sundry Debtors) = sale bill totals - sale receipt totals
- CLGP (GST Payable) = output GST (SaleBillGst) - input GST (BillPaymentReceiptGst)
- Bank balances = received (BPR) - paid (PV) per BankCash
- Cash = sum of approved petty cash docket vouchers (Cash mode)

**Hardcoded bank/loan names in BS response:**
- "Kotak Mahindra Bank -- JCB", "Kotak Mahindra Bank -- Venus" (LON3 split, lines 577-578)
- "Bajaj Finserv" (LON1), "L&T Finance" (LON2)
- "ICICI Bank OD A/c" (LON3 split, line 594)
- `lon3_kotak_venus` and `lon3_icici_od` are **hardcoded to 0.0** because LON3 shared code can't be split

### Hardcoded GST Types

All GST sub-tables use string column `gst_type` with values "IGST", "CGST", "SGST" — string constants, not from a master.

Frontend hardcoded in `BillwiseBreakdownTable.jsx` (lines 30-32):
- IGST → ccCode: "IGST", ccName: "Output-IGST", fraction: 1
- CGST → ccCode: "CGST", ccName: "Output-CGST", fraction: 0.5
- SGST → ccCode: "SGST", ccName: "Output-SGST", fraction: 0.5

### Sale Bill Number — Financial Year Logic

`sale_bill/service.py` lines 45-50: FY runs April-March. Prefix = `"{fy_start last 2 digits}{fy_end last 2 digits}DH"`. "DH" = "Dishaan Hi-tech" — hardcoded company identifier.

---

## 6. Journal Entry System — The Accounting Source of Truth

### Model: `app/models/journalEntry.py`

**JournalEntryMaster:**
- `voucher_no` (String 50, auto-generated with mode prefix)
- `journal_uuid` (UUID for public access)
- `entry_date` (Date — **defaults to today, cannot be backdated**)
- `project_code` FK to projects
- `entry_mode`: "new_voucher" (JV) | "bulk_docket" (JB) | "adjustment" (JA)
- `ref_bill_type` / `ref_bill_id`: optional link to sale_bill / purchase_bill / receipt_billing
- `total_debit`, `total_credit` (Numeric 14,2)
- Full workflow: Draft → Pending_L{n} → Approved / Reback / Rejected
- `locked` flag prevents edits when submitted/approved

**JournalEntryLine:**
- `account_type`: "CC" | "Vendor" | "Customer"
- `dr_cr`: "Dr" | "Cr"
- `cc_id` FK to cc_codes.id (for CC type)
- `vendor_id` FK to vendors.id (for Vendor type)
- `customer_ref` (String — client name snapshot for Customer type, **free-text, no FK**)
- `debit_amount`, `credit_amount` (Numeric 14,2)

**Validation:**
- Total debit must equal total credit (when Cr lines exist)
- **Single Dr-only entries are allowed** (no balancing required when no Cr lines) — violates double-entry principle

**Three entry modes:**

| Mode | Prefix | Purpose |
|------|--------|---------|
| `new_voucher` | JV | Manual journal voucher |
| `bulk_docket` | JB | Consolidates petty cash journal vouchers |
| `adjustment` | JA | Adjustment linked to ref bill (sale_bill/purchase_bill/receipt_billing) |

**Bulk docket mode:**
- Links to `PettyCashJournalVoucher` records via `linked_journal_id`
- Marks vouchers as consumed when journal entry is created

**Where Journal Entries Are Consumed:**

| Consumer | How | What It Reads |
|----------|-----|--------------|
| Balance Sheet | `_bulk_journal_balance`, `_bulk_journal_debit_sum` | Approved JE lines by CC code |
| Bill Payment (voucher type) | `_paid_je_line_map` | Approved JE Dr lines for payment tracking |
| Monthly Summary | Simple count/list | All JE records in period |

**No other module creates, reads, or depends on journal entries for its own operations.**

**Date handling note:** The JE service has its own `_fmt_date` that returns `"%Y-%m-%d %H:%M"` for datetime objects, not the shared `fmt_date` from `app/utils/date_utils.py` which returns `"%Y-%m-%d"`.

---

## 7. Ledger Architecture

### My Ledger (`my_ledger/service.py`, 428 lines)

**Endpoint:** GET `/api/my-ledger`

Aggregates 6 document types per project, all must be `workflow_status == "Approved"`:

| Document | Dr/Cr | Amount Source |
|----------|-------|--------------|
| Sale Bill | Debit | `total_invoice_amount` |
| Sale Receipt Billing | Debit | `total_invoice_amount` |
| Purchase Bill | Credit | `total_invoice_amount` |
| Bill Payment Receipt | Credit | `total_invoice_amount` |
| Debit Note | Debit | `total_amount` |
| Credit Note | Credit | `total_amount` |

**Two modes:** Single project or all-projects (batched query optimization).
**Running balance:** Debit = income/receivable (+), Credit = expense/payable (-).

**Not included:** Payment Vouchers, Journal Entries, Contra Entries, Sale Receipts (simple).

### Vendor Ledger (`vendor_ledger/service.py`, 191 lines)

**Endpoint:** GET `/api/vendor-ledger`

Aggregates 4 document types per vendor, all `workflow_status == "Approved"`:

| Document | Dr/Cr | Amount Source |
|----------|-------|--------------|
| Purchase Bill | Credit | `total_invoice_amount` |
| Bill Payment Receipt | Debit | `total_invoice_amount` |
| Debit Note | Debit | `total_amount` |
| Credit Note | Credit | `total_amount` |

**Running balance:** Credit = we owe vendor (+), Debit = we paid (-). Opposite convention to My Ledger.

**Critical observation:** Neither ledger pulls from JournalEntry. They are purely transaction-document-based, independent of the double-entry journal system. A journal adjustment entry won't appear in any ledger view.

---

## 8. Trial Balance

**NOT IMPLEMENTED.** No trial balance module, service, route, or frontend page exists anywhere in the codebase.

The system has:
- P&L (computed from budgets + sale orders + purchase bills)
- Balance Sheet (computed from journal entries + special aggregations)
- No trial balance that reconciles between them
- No automated check that total debits = total credits across the entire system

---

## 9. P&L Report Architecture

### Backend: `profit_loss/service.py` → `get_pl_report()`

**THREE separate query sources, NOT from journal entries:**

| Column | Source | Query |
|--------|--------|-------|
| `order` (Sale) | `OgSaleOrderMaster.total_amount` | Approved + Active, sum by date range |
| `order` (Expenses) | `BudgetItemCCCode.cc_total` + `BudgetMaster.overhead_data` JSON | Approved + Active budgets |
| `booked` | `PurchaseBillItem.basic_amount` | Approved purchase bills grouped by cc_code |
| `workDone` | **NOT IMPLEMENTED** | Returns `None` for all rows |
| `stock` | **NOT IMPLEMENTED** | Returns `None` for all rows |
| `actual` | **NOT IMPLEMENTED** | Returns `None` for all rows |

### Frontend: `src/config/profitLoss.config.js`

- 5 value columns defined: order, workDone, booked, stock, actual
- ColumnPicker lets user toggle visibility
- Layout is hardcoded by business requirement (comment in config file)
- Section totals and percentages computed on client
- Color coding: sale = green, expense = red, result = blue

**Critical issue:** P&L is NOT derived from Journal Entries. It queries OG Sale Orders (for revenue) and Budgets (for expenses). This is a completely parallel data path from the Balance Sheet, which IS journal-entry-based.

---

## 10. Balance Sheet Architecture

### Backend: `balance_sheet/service.py` → `get_balance_sheet()` (732 lines)

The most complex report. Combines data from multiple independent sources:

**Equity & Liabilities:**
- A: Capital Account = shareholders fund (DIR1+DIR2 from JE) + CRSF (P&L net recomputed inline)
- B: Non-current Liabilities = long-term borrowings (LON1-3, USLO, NBFC from JE) + NCDT + NCTL + NCTP
- C: Current Liabilities = CLDT + CLSC + CLTB + CLTP + other (CLFP, CLCP, CLOP, CLCM from JE) + GST payable (special calc)

**Assets:**
- A: Non-current Assets = fixed assets (12 codes from JE) + NCIV + NCTA + LTLA + NCCA
- B: Current Assets = closing stock (5 codes from JE) + CASD (sundry debtors, special calc) + advances (from JE) + GST excess input + banks (special calc) + cash (special calc)

| Data Source | Helper Function | What It Provides |
|-------------|----------------|------------------|
| JournalEntryLine | `_bulk_journal_balance()` | Credit - debit (liabilities/equity) |
| JournalEntryLine | `_bulk_journal_debit_sum()` | Sum of debits (assets) |
| P&L computation | `_pl_net()` | CRSF (Company Reserves & Surplus) |
| Sale Bills - Sale Receipts | `_sundry_debtors()` | CASD (Sundry Debtors) |
| Sale Bill GST - BPR GST | `_gst_output_net()` | CLGP (GST Payable) / GST excess input |
| PaymentVouchers & BillPayments | `_all_bank_balances()` | Per-bank-account balances |
| Petty Cash Docket Vouchers | `_cash_balance()` | Cash in hand |

**Balance validation:** Returns `difference = total_assets - total_equity_liability` (should be 0 when balanced).

**BUG:** `caav` variable at line 688 references CAAV (Advance to Vendors) but is never defined in the function. This will cause a `NameError` if the CALA section code path executes.

**LON3 issue:** LON3 is shared across multiple accounts (Kotak JCB, Kotak Venus, ICICI OD) but the code cannot distinguish between them. `lon3_kotak_venus` and `lon3_icici_od` are hardcoded to `0.0`.

---

## 11. GST Accounting

### Storage Pattern

Every financial document with GST has a child table with rows for each GST type:

| Document | GST Table | Direction |
|----------|-----------|-----------|
| Purchase Bill | `PurchaseBillGst` | Input |
| Sale Bill | `SaleBillGst` | Output |
| Payment Voucher | `PaymentVoucherGst` | Input (payment) |
| Bill Payment Receipt | `BillPaymentReceiptGst` | Input (payment) |
| Sale Receipt Billing | `SaleReceiptBillingGst` | — |
| Debit Note | `DebitNoteGst` | Adjustment |
| Credit Note | `CreditNoteGst` | Adjustment |

GST row fields: `gst_type` ("IGST"/"CGST"/"SGST" — string constant), `gst_rate`, `gst_amount`, `basic_amount`, `is_selected` (Boolean on SaleBillGst), `cc_code`/`cc_name` (denormalized snapshots).

### GST in Balance Sheet

Output GST = sum of `SaleBillGst.gst_amount` where `is_selected = True` (approved)
Input GST = sum of `BillPaymentReceiptGst.current_amount` (approved)
Net = Output - Input

- Positive → GST Payable (liability, code CLGP)
- Negative → GST Excess Input Credit (asset side)

**Issue:** Input GST comes from Bill Payment Receipts (when payment is made), not from Purchase Bills (when liability is incurred). This means GST input credit is recognized at payment time, not invoice time — may not align with GST rules.

### GST in Frontend

- IGST is mutually exclusive with CGST+SGST (enforced in frontend)
- Print pages use hardcoded split logic: IGST → full amount; else split gstAmount / 2 for CGST and SGST
- No GSTR-1/3B preparation functionality exists

---

## 12. Opening Balances and Financial Year

### Opening Balance — NOT IMPLEMENTED

**Only found in Contra Entry:** `ContraEntryLine.opening_balance` and `.closing_balance` — per-line computed values for bank transfers, NOT system-wide opening balances.

**No opening balance mechanism exists for:**
- CC Codes
- Bank/Cash accounts
- Vendor accounts
- General ledger
- Journal entries

The Balance Sheet has no opening balance carry-forward. All values are computed from the full transaction history filtered by date range. There is no concept of "closing balance of previous FY becomes opening balance of new FY."

### Financial Year — NOT IMPLEMENTED

**Only reference:** `sale_bill/service.py` → `_fy_prefix()` which derives FY from invoice_date (Apr-Mar cycle) for sale bill numbering.

**No financial year model/table exists.** No FY close, FY lock, or period-based accounting restrictions.

---

## 13. Contra Entry (Bank Transfer) Architecture

### Model: `app/models/contraEntry.py`

- `ContraEntryMaster`: voucher_no (CV prefix), entry_date, project_code, total_amount
- `ContraEntryLine`: dr_cr, `account_id` FK→bank_cash.id, opening_balance, debit_amount, credit_amount, closing_balance

**Transfer types tracked:** Bank to Cash, Cash to Bank, Bank to Bank, Cash to Cash (summary computed in list endpoint).

**NOT connected to Journal Entry system.** Contra entries are standalone — they don't create JournalEntryLines. This means bank transfers are NOT reflected in the Balance Sheet's journal-based calculations. Contra entries are invisible to the journal-based BS calculation.

---

## 14. BankCash Model and Balance Sheet Integration

### Model: `app/models/bankCash.py`

- `type`: "Bank" or "Cash"
- `bank_code` (unique), `bank_name`, account details
- `group_id` FK→group_master (Balance Sheet classification)
- `sub_group_id` FK→sub_group_master
- Links to projects via `BankCashProject` junction table
- **No stored balance column** — balance computed dynamically

### Balance Sheet Bank Balance Computation

```
bank_balance = received (BillPaymentReceiptMaster per bank)
             - paid (PaymentVoucherMaster per bank)
```

**NOT from journal entries.** This is a separate computation path. Bank balances ignore:
- Contra entries (bank transfers)
- Direct journal entries involving bank accounts
- Sale receipt bank deposits
- Opening balances
- Any other cash flow

### Cash Balance Computation

```
cash = SUM(PettyCashDocketVoucher.total_amount WHERE mode_of_payment="Cash")
```

This is **total petty cash spending**, not a cash balance. A true cash balance would need opening balance + receipts - payments.

---

## 15. Vendor (Ledger) Model

### Model: `app/models/vendor.py`

The Vendor model serves as the "Ledger" master in PRAX. Key fields:
- `ledger_code` (auto-generated, unique), `ledger_name`
- `type`: "creditor" | "debtor"
- `gstin`, `pan`, `state_code`, `state_name`
- `category_code` FK→category_master
- `is_supplier` (Boolean) — links to SupplierMaster
- Multi-project via `VendorProject` junction table

**No balance columns exist** (`opening_balance`, `debit_balance`, `credit_balance` are absent). Balances are computed on-the-fly from source documents (Purchase Bills, Bill Payments, Debit/Credit Notes).

The "Ledger" in PRAX is synonymous with "Vendor/Party." There is no separate general ledger / chart of accounts for non-CC, non-vendor accounts.

---

## 16. Budget Model and CC Code Junction

### Model: `app/models/budget.py`

**BudgetMaster:** project_code, budget_date, linked to OG Sale Order items, `overhead_data` (JSON)
**BudgetItem:** Line item linked to OG Sale Order items
**BudgetItemCCCode:** Junction table linking BudgetItem to CC codes:
- `cc_code_id` FK→cc_codes.id
- `cc_code`, `cc_name` (denormalized snapshots — BOTH FK and string)
- `cc_total` (Numeric) — the budgeted amount for this CC code

**Overhead data** stored as JSON in `BudgetMaster.overhead_data`:
```json
{
  "projectOverhead": [{"ccCode": "IRDC", "estimatedCost": 50000}, ...],
  "employeeOverhead": [{"ccCode": "IOFM", "estimatedCost": 30000}, ...]
}
```

This is a hybrid approach — direct expenses use the junction table, overhead expenses use a JSON column. Both are **estimates**, not actuals. The budget records are snapshots of sale order item costs.

---

## 17. Workflow Architecture

All finance modules share a common workflow via `app/modules/work_flow/`:

**States:** Draft → Pending_L{n} → Approved / Reback / Rejected
- Reback: returns to Draft, unlocks for editing
- Approved: locks the record
- Rejected: locks and sets status to Inactive

**Module codes for workflow registration:**

| Module | Workflow Code | Voucher Prefix |
|--------|--------------|----------------|
| Journal Entry | `journal` | JV/JB/JA |
| Contra Entry | `contra` | CV |
| Journal Voucher (Petty Cash) | `petty_cash` | BV |
| Sale Bill | `sale` | SB |
| Purchase Bill | `purchase` | PB |
| Payment Voucher | `pv_payment` | PV |
| Bill Payment | `payment` | BPR |
| Credit Note | `credit_note` | CN |
| Debit Note | `debit_note` | DN |

**Locking:** All master tables have a `locked` boolean. Set to True when submitted/approved. Set to False only on Reback. Prevents edits during approval pipeline.

**Note:** Bill Payment and Payment Voucher share the workflow module "payment" — same approvers for both document types.

---

## 18. Petty Cash Subsystem

### Three-Stage Flow

```
Petty Cash Budget (approved)
    ↓ (budget reference)
Petty Cash Docket Voucher (approved)
    ↓ (consumed by)
Petty Cash Journal Voucher (BV, approved)
    ↓ (linked via linked_journal_id)
Journal Entry (JB mode, approved)
    ↓ (queried by)
Balance Sheet / Bill Payment (voucher type)
```

### Petty Cash Budget

**Service:** `finance/petty_cash/budget/service.py` (700+ lines)
- Budget allocation per project per CC code
- Supports revision (amend approved budgets)
- Referenced by docket vouchers for available budget

### Petty Cash Docket Voucher

**Service:** `finance/petty_cash/docket_voucher/service.py` (750+ lines)
- Actual petty cash expenditure records
- `mode_of_payment`: "Cash" or "Bank"
- Links to approved budget
- `total_amount` used by Balance Sheet `_cash_balance`

### Petty Cash Journal Voucher

**Service:** `finance/journal_entry/journal_voucher/service.py` (667 lines)
**Model:** `PettyCashJournalVoucher` + `PettyCashJournalLine` — separate table, NOT in journal_entry_master
- Intermediate records — NOT journal entries themselves
- `fund_source`: "Bank" or "Cash"
- Lines store `cc_code`/`cc_name` as **strings** (not FK to CCCode)
- Bank mode: only one docket voucher allowed
- Cash mode: all lines must share same CC code
- Consumed by journal_entry's `bulk_docket` mode via `linked_journal_id`

**Important:** Journal Voucher lines do NOT flow into Balance Sheet calculations directly because they are in a separate model. The link is: approved docket vouchers → Journal Entry (bulk_docket mode) → JournalEntryLine with `cc_id` FK.

---

## 19. Procurement & Sales Lifecycle

### Procurement Flow

```
Indent → Order (Purchase) → GRN (Goods Received) → BRR (Bill Received Register) → Purchase Bill
                          → GIN (Goods Issue Note)
```

For project work / services:
```
Project Work Order → SRN (Service Received) → BRR → Purchase Bill
```

| Module | Service File | Lines | Creates JE? | Accounting Impact |
|--------|-------------|-------|-------------|-------------------|
| Indent | `indent/service.py` | ~2045 | NO | Workflow only. CC summary via Item→CCCode join |
| Order | `order/service.py` | — | NO | CC summary with `get_cc_code_summary()`. GST per item |
| GRN | `grn/service.py` | — | NO | Goods received tracking. Validates against order balance |
| GIN | `gin/service.py` | ~1270 | NO | Goods issue. Reduces available stock |
| SRN | `srn/service.py` | ~1292 | NO | Service received tracking |
| DLR | `dlr/service.py` | ~697 | NO | Delivery record tracking |
| Stock | `stock/service.py` | ~358 | NO | **Dynamically computed**: GRN received - GIN issued, by CC code |
| BRR | `bill_receive_register/` | — | NO | Bill Receive Register. Stores amounts. No journal impact |
| BRR Billing | `brr_billing/` | — | NO | Billing against BRR |

### Sales/Billing Flow

```
OG Sale Order → Budget → Custom Billing (Sale Claim → Certified Bill) → Sale Bill → Sale Receipt → Sale Receipt Billing
```

| Model | Purpose | Financial Link |
|-------|---------|---------------|
| `OgSaleOrderMaster` | Customer sale orders | P&L income source |
| `BudgetMaster` + `BudgetItemCCCode` | Cost estimation per SO | P&L expense source |
| `BillingMaster` + items | Certified bills (claims) | Links to Sale Bill |
| `SaleBillMaster` + items + GST | Invoices | My Ledger, BS debtors, GST output |
| `SaleReceiptMaster` | Receipt header | BS debtors deduction |
| `SaleReceiptBillingMaster` + items + GST | Receipt per certified bill | My Ledger |

---

## 20. API Endpoint Map (Finance)

See `src/config/api.config.js` lines 526-745 for the complete map.

### Report Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/finance/profit-loss` | GET | P&L report (projectCode, fromDate, toDate) |
| `/finance/balance-sheet` | GET | Balance Sheet (projectCode, fromDate, toDate) |
| `/finance/my-ledger` | GET | Project ledger (projectCode, fromDate, toDate) |
| `/finance/vendor-ledger` | GET | Vendor ledger (vendorId, projectCode, fromDate, toDate) |
| `/finance/petty-cash/ledger/account-ledger` | GET | Petty cash account ledger |

### Standard CRUD Pattern

All financial modules follow: `/finance/{module}/create`, `list`, `/{id}`, `edit/{id}`, `submit/{id}`, `approve/{id}`, `reback/{id}`, `reject/{id}`, `history/{id}`, `my-approval-status/{id}`, `uuid/{uuid}`

---

## 21. Data Integrity and Accounting Consistency Issues

### CRITICAL Issues

| # | Issue | Impact |
|---|-------|--------|
| 1 | **No automatic journal posting from ANY transaction module** | Transactions are approved but never reach the general journal; balance sheet items that depend on JE will be zero unless manual JEs are created |
| 2 | **P&L and Balance Sheet use completely different data sources** | P&L: OG Sale Orders + Budgets + Purchase Bills. BS: JournalEntryLine + special aggregations. These are independent, unreconciled computation paths |
| 3 | **No Trial Balance** | Cannot verify that total debits = total credits across the entire system |
| 4 | **No Financial Year / Period Close** | All calculations are cumulative from inception; no ability to close a year, carry forward balances, or compare year-over-year |
| 5 | **Balance Sheet `caav` undefined (BUG)** | `balance_sheet/service.py` line 688 references `caav` (Advance to Vendors) but it's never assigned — will crash with NameError |
| 6 | **Contra Entries not in Journal system** | Bank transfers don't create JE lines; invisible to journal-based BS calculation |
| 7 | **Bank balance calculation incomplete** | Only tracks PV outflows and BPR inflows — misses contra transfers, sale receipts, direct JE bank entries, and opening balances |
| 8 | **Cash balance is spending total, not balance** | BS "Cash in hand" = total petty cash spent via cash, not actual cash position |

### HIGH-Severity Issues

| # | Issue | Impact |
|---|-------|--------|
| 9 | **Single-sided journal entries allowed** | JEs with only Dr lines (no Cr) pass validation, violating double-entry principle |
| 10 | **JE entry_date forced to today()** | Cannot backdate journal entries; adjustment entries for past periods use today's date |
| 11 | **LON3 code shared across 3 accounts** | Kotak JCB, Kotak Venus, ICICI OD all use LON3. Code hardcodes Venus and ICICI to 0.0. No sub-code mechanism |
| 12 | **3 P&L columns not implemented** | `workDone`, `stock`, `actual` return None. Functional but incomplete |
| 13 | **No opening balance mechanism** | Cannot set starting balances at system go-live or year-start |
| 14 | **~80 CC codes hardcoded in reports** | Adding/modifying codes requires code changes in both backend services and frontend config |

### MEDIUM-Severity Issues

| # | Issue | Impact |
|---|-------|--------|
| 15 | **CC code string denormalization** | ~15 tables store CC as strings without FK; renames in master won't propagate |
| 16 | **My Ledger and Vendor Ledger bypass journals** | Read from source docs, not JE — journal adjustments invisible in ledger views |
| 17 | **Customer references are free-text** | JE customer lines can't be reconciled against any master |
| 18 | **No unified chart of accounts** | CC codes, vendors, bank accounts are separate namespaces |
| 19 | **No GST return preparation** | GST data exists but no GSTR-1/3B compilation |
| 20 | **GST input credit at payment time** | Input GST from BPR (payment), not PB (invoice) — may not align with GST rules |
| 21 | **No audit trail for amount changes** | Only workflow state changes tracked; amount modifications within Draft/Reback leave no trail |
| 22 | **No multi-currency support** | All amounts Numeric(14,2) assumed INR |

---

## 22. Risk Assessment

### Financial Reporting Risk: HIGH

The P&L and Balance Sheet reports produce meaningful numbers only under specific conditions:
- P&L requires up-to-date budgets that mirror actual costs
- Balance Sheet requires manual journal entries for ALL CC-based line items
- Balance Sheet bank balances only reflect vendor payment flows
- Any transaction without a corresponding manual JE is invisible to the balance sheet for affected line items
- The `caav` bug means the CALA section will crash if it executes

### Data Integrity Risk: MEDIUM-HIGH

- String CC codes can't be validated against the master
- No mechanism prevents CC code drift across 15+ tables
- Free-text customer references in journal entries have no traceability
- Single-sided journal entries can introduce imbalance
- Delete-and-recreate pattern on line item edits leaves no historical trail

### Compliance Risk: MEDIUM

- No trial balance for audit verification
- No financial year closing for statutory reporting
- GST input credit recognized at payment time, not invoice time (may not align with GST rules)
- No GSTR preparation functionality
- No opening balance mechanism makes regulatory reporting incomplete

### Operational Risk: LOW-MEDIUM

- Manual journal entry creation is error-prone and labor-intensive
- Hardcoded CC codes in reports require developer intervention to modify
- No opening balance mechanism makes system migration/go-live complex
- Bill Payment and Payment Voucher share "payment" workflow — same approvers for both

---

## 23. Recommended Target Architecture (Phase 2 Roadmap)

### Phase 2 Priority — Architectural (Fix Now)

1. **Fix `caav` undefined bug** — Add CAAV to the `_bulk_journal_debit_sum()` query or set to 0.0 in `balance_sheet/service.py`

2. **Implement automatic journal posting** — Each approved transaction should auto-create balanced journal entries. Priority: Purchase Bill, Sale Bill, Payment Voucher, Bill Payment Receipt

3. **Create Contra Entry → Journal Entry integration** — When a contra entry is approved, auto-generate a JE with Dr/Cr lines for the bank/cash accounts

4. **Implement Trial Balance** — Aggregate all JournalEntryLine Dr/Cr by CC code + vendor accounts, verify Dr total = Cr total

5. **Unify P&L data source** — Either route P&L through journal entries (preferred: create JE lines when budgets are approved), or accept the parallel paths and document them as designed

### Phase 2 Priority — Data Integrity

6. **Fix single-sided JE validation** — Require total_debit == total_credit for ALL entries, not just those with Cr lines

7. **Allow custom entry_date on JEs** — Accept user-provided dates with validation, not forcing today()

8. **LON3 sub-code resolution** — Either add sub-codes to cc_codes or introduce separate tracking for loans sharing a CC code

### Phase 2 Priority — Financial Framework

9. **Opening Balance framework** — Add opening_balance table (cc_code, vendor_id, bank_cash_id, amount, fy_year); incorporate into BS and ledger calculations

10. **Financial Year model** — FY table with start_date, end_date, is_locked; enforce period restrictions on entries

11. **Fix Balance Sheet bank balances** — Include all bank-impacting transactions (contra entries, sale receipts)

12. **Fix cash balance** — Track actual cash position (opening + receipts - payments)

### Phase 2 Priority — Reporting

13. **Implement P&L remaining columns** — `workDone` (from site reports/DPR?), `stock` (from GRN/stock module), `actual` (from payment vouchers/bill payments)

14. **Dynamic CC code mapping in reports** — Read CC codes from database configuration instead of hardcoding in Python/JS

### Phase 3 — Compliance & Operations

15. **GST return preparation** — Compile GSTR-1/3B from existing GST data
16. **Opening balance entry mechanism** — Allow initial balance setup for all account types
17. **General Ledger report** — Unified view across CC, Vendor, and Bank accounts
18. **Unified Chart of Accounts** — Single account master linking CC codes, vendors, and bank accounts
19. **Standardize CC code storage** — Migrate to consistent FK pattern (or explicitly document denormalized-snapshot pattern)
20. **Multi-project financial consolidation** — Group-level consolidation beyond single/all project views

---

## Appendix A: Complete CC Code Inventory (~80 codes)

### P&L Codes (50, from `profitLoss.config.js` / `profit_loss/service.py`)

```
CRIN, CRHL, CRAP, UCAP, WIPS, INOC
DRCW, DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS
IRDC, IRAD, IRLE, IRFS, IRMR, IRLU, IRMT, IRPS, IRSD, IRIM, IRIL, IRFM, IRTT, IRLH, IRLM, IRLT
IOFM, IOHR, IOME, IOMS, IOMB, IOSS, IOVR, IOTV
IOCR, CRBC, CRBD, CRCC, CRDR, CRES, CRIC, CRIP, CRLC, CRPF, CRIT
```

### BS Codes (~30, from `balance_sheet/service.py`)

```
DIR1, DIR2, CRSF
LON1, LON2, LON3, USLO, NBFC
NCDT, NCTL, NCTP
CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM, CLGP
APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB
NCIV, NCTA, LTLA, NCCA
CARM, CAHL, CAAP, CAUM, CAWP, CASD
CART, CAAE, CAOP, CACI, CATS, CAOA
CABA, CACH
```

### Section/Composite Codes (non-leaf)

```
NCTB, CACS, CALA
```

---

## Appendix B: Model File Index (Finance-relevant)

| Model File | Table(s) | Key Relationships |
|---|---|---|
| `cc_code.py` | cc_codes | group_master, category_master, sub_group_master |
| `category_group.py` | group_master, category_master, sub_group_master | head_under: "P&L" / "BS" |
| `journalEntry.py` | journal_entry_master, journal_entry_lines | cc_codes, vendors, projects |
| `journalVoucher.py` | petty_cash_journal_vouchers, petty_cash_journal_lines | docket vouchers |
| `bankCash.py` | bank_cash, bank_cash_project | group_master, sub_group_master, projects |
| `vendor.py` | vendors | category_master |
| `saleBill.py` | sale_bill_masters, sale_bill_items, sale_bill_gst, sale_bill_sources | certified bills |
| `purchaseBill.py` | purchase_bill_masters, purchase_bill_items, purchase_bill_gst | BRR items |
| `paymentVoucher.py` | payment_voucher_masters, payment_voucher_gst | cc_codes, bank_cash |
| `billPaymentReceipt.py` | bill_payment_receipt_masters, bill_payment_items, bill_payment_gst | purchase bills |
| `saleReceipt.py` | sale_receipt_masters | OG sale orders |
| `saleReceiptBilling.py` | sale_receipt_billing_masters, _items, _gst | sale invoices |
| `contraEntry.py` | contra_entry_masters, contra_entry_lines | bank_cash |
| `creditNote.py` | credit_note_masters, credit_note_items, credit_note_gst | sale bills |
| `debitNote.py` | debit_note_masters, debit_note_items, debit_note_gst | BRR |
| `budget.py` | budget_masters, budget_items, budget_item_cc_codes | OG sale orders, cc_codes |
| `pettyCashBudget.py` | petty_cash_budget_masters, petty_cash_budget_items | — |
| `pettyCashDocketVoucher.py` | petty_cash_docket_vouchers, petty_cash_docket_voucher_details | petty_cash_budget |
| `ogSaleOrder.py` | og_sale_order_masters, og_sale_order_items, og_sale_order_gst | projects |
| `asset.py` | asset_masters | cc_codes, category_master |
| `item.py` | item_masters | cc_codes, category_master |

---

## Appendix C: Recent Migrations (Last 10)

| File | Date | Description |
|---|---|---|
| `0002eb24d026_credit_note_changes.py` | 2026-11-10 | Credit note model changes |
| `acad998d767c_debit_note_changes_to_add_brr_id.py` | 2026-11-10 | Debit note BRR ID link |
| `b4185cb65999_debit_note_changes.py` | 2026-11-10 | Debit note changes |
| `e4f5a6b7c8d9_backfill_print_uuids.py` | 2026-11-10 | Backfill print UUIDs |
| `96d609324057_chat.py` | 2026-11-10 | Chat model |
| `c1d2e3f4a5b6_je_line_description.py` | 2026-11-09 | JE line description field |
| `b7c8d9e0f1a2_docket_linked_journal.py` | 2026-11-09 | Docket to Journal link |
| `1005081d27c9_payment_changes.py` | 2026-11-09 | Payment model changes |
| `fd23dc6589bd_daily_progress_report.py` | 2026-11-09 | DPR model |
| `451d4ecd9ae7_receipt_deleted_column.py` | 2026-11-08 | Receipt column cleanup |

No migrations exist for opening balance, financial year, or trial balance tables.

---

*End of Phase 1 Audit Report — PRAX ERP Complete Accounting Architecture and Dependency Audit*
