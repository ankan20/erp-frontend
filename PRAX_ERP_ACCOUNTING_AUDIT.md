# PRAX ERP — Complete Accounting Architecture and Dependency Audit

**Phase 1: Research-Only Report**
**Date:** 2026-11-10

---

## 1. Module Map — Every Module in the System

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

### Other: HR, Auth, Communication, Company, Search, Settings, Workflow, Traceability, AI, Delete Manager

---

## 2. Finance Module Dependency Map

### Data Flow: Procurement to Accounting

```
Indent --> Order --> GRN/SRN --> BRR --> BRR Billing (BRB)
                                             |
                                     Purchase Bill  (items from BRR)
                                             |
                                     Payment Voucher  (references Purchase Bill)
                                             |
                                     Bill Payment Receipt  (references Purchase Bill items)
```

### Data Flow: Sales to Accounting

```
OG Sale Order --> Budget (links CC codes)
      |
Custom Billing (Sale Claim --> Certified Bill)
      |
Sale Bill  (items from Certified Bills)
      |
Sale Receipt --> Sale Receipt Billing (collections)
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

---

## 3. CC Code Architecture Audit

### Master Model: `app/models/cc_code.py` table `cc_codes`

**Fields:**
- `id` (PK), `cc_code` (String 50, unique), `cc_name` (String 200)
- `group_id` FK to `group_master.id` (required)
- `category_code` FK to `category_master.fixed_code` (required)
- `sub_group_id` FK to `sub_group_master.id` (optional)
- `is_non_ledger` (Boolean, nullable) -- only meaningful for Balance Sheet groups
- `pl_linked` (Boolean, default False) -- whether this CC code also appears in P&L
- `pl_group_id` FK to `group_master.id` (optional P&L group link)
- `pl_sub_group_id` FK to `sub_group_master.id` (optional P&L sub-group link)
- `status`, `created_at`, `updated_at`, `created_by`

**Key Design:** head_under is COMMENTED OUT on CCCode model (line 80). The P&L vs Balance Sheet classification is derived from `GroupMaster.head_under`.

### GroupMaster: `app/models/category_group.py` table `group_master`

- `id`, `group_name` (unique), `head_under` (String 100, required: "Profit & Loss" or "Balance Sheet"), `status`

### SubGroupMaster: table `sub_group_master`

- Hierarchical tree: `group_id` to parent Group, `parent_id` to parent SubGroup (nullable for top-level)
- `level`: 0 = Sub Group, 1 = Sub Group 1, 2 = Sub Group 2 (max 3 levels)
- `fixed_code` (unique)

### CategoryMaster: table `category_master`

- `fixed_code` (unique), `category_name` -- used across CC codes, vendors, items, orders

### CC Code Storage Pattern Across Models

**Normalized (FK to cc_codes.id):**
- `JournalEntryLine.cc_id` to cc_codes.id
- `PaymentVoucherMaster.cc_code_id` to cc_codes.id
- `AssetMaster.cc_code_id` to cc_codes.id
- `ItemMaster.cc_code_id` to cc_codes.id
- `BudgetItemCCCode.cc_code_id` to cc_codes.id

**Denormalized (cc_code + cc_name string snapshots):**
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
- `BudgetItemCCCode`: `cc_code`, `cc_name` (plus FK)

**Risk:** Denormalized snapshots become stale if the master cc_code or cc_name is edited. There is no update-propagation mechanism. However, this is a deliberate design -- snapshots preserve the value at transaction time, which is correct for audit/compliance.

---

## 4. Hardcoded CC Codes and Accounting Values

### P&L Report -- Frontend: `src/config/profitLoss.config.js`

50 leaf CC codes hardcoded in display order:

**Section A -- SALE (6 codes):** CRIN, CRHL, CRAP, UCAP, WIPS, INOC

**Section B -- EXPENSES:**
- B.1 Direct Expenses (9): DRCW, DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS
- B.2.1 Project Overhead (16): IRDC, IRAD, IRLE, IRFS, IRMR, IRLU, IRMT, IRPS, IRSD, IRIM, IRIL, IRFM, IRTT, IRLH, IRLM, IRLT
- B.2.2 Employee Overhead (8): IOFM, IOHR, IOME, IOMS, IOMB, IOSS, IOVR, IOTV
- B.2.3 Office Overhead (11): IOCR, CRBC, CRBD, CRCC, CRDR, CRES, CRIC, CRIP, CRLC, CRPF, CRIT

**Section C -- P&L result:** computed as Sale - Expenses

### P&L Report -- Backend: `profit_loss/service.py`

Same 50 codes hardcoded in `_ALL_CODES` list (line 22-29).
Sale codes in `_SALE_CODES` set (line 31).
DE sibling codes in `_DE_SIBLING_CODES` set (line 7): DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS.
DRCW is derived as sum of all DE siblings (not stored separately).

**Data sources for each P&L column:**
- `order` column: Sale = total from approved OgSaleOrderMaster; Expenses = from BudgetItemCCCode.cc_total + BudgetMaster.overhead_data JSON
- `booked` column: from PurchaseBillItem.basic_amount grouped by cc_code (approved PBs only)
- `workDone`, `stock`, `actual`: currently return `None` -- **NOT IMPLEMENTED**

### Balance Sheet -- Backend: `balance_sheet/service.py`

**Hardcoded CC codes used in bulk queries (lines 452-462):**

Equity & Liabilities (credit-balance codes):
- DIR1, DIR2 (Director capitals)
- LON3, LON1, LON2, USLO, NBFC (Loans)
- NCDT, NCTL, NCTP (Non-current liabilities)
- CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM (Current liabilities)

Assets (debit-sum codes):
- APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB (Fixed assets)
- NCIV, NCTA, LTLA, NCCA (Other non-current)
- CARM, CAHL, CAAP, CAUM, CAWP (Closing stock)
- CART, CAAE, CAOP (Advances)
- CACI, CATS, CAOA (Other current)

**Special computations (not from CC codes):**
- CRSF (Company Reserves & Surplus Fund) = P&L net (income - expense), computed inline
- CASD (Sundry Debtors) = approved sale bill totals - sale receipt totals
- CLGP (GST Payable) = output GST (SaleBillGst) - input GST (BillPaymentReceiptGst)
- Bank accounts = received (BPR per bank) - paid (PV per bank) from BankCash accounts
- Cash = sum of approved petty cash docket vouchers (Cash mode)
- GST excess input (asset side) = max(0, -net_gst_payable)

**Hardcoded in BS response structure:**
- "Kotak Mahindra Bank -- JCB", "Kotak Mahindra Bank -- Venus" (LON3 split -- line 577-578)
- "Bajaj Finserv" (LON1), "L&T Finance" (LON2)
- "ICICI Bank OD A/c" (LON3 split -- line 594)
- lon3_kotak_venus and lon3_icici_od are hardcoded to `0.0` because LON3 shared code can't be split without sub-codes

### Hardcoded GST Types

All GST sub-tables use string column `gst_type` with values "IGST", "CGST", "SGST" -- these are string constants, not from a master table.

Models with GST sub-tables:
- `SaleBillGst`, `PurchaseBillGst`, `PaymentVoucherGst`, `BillPaymentReceiptGst`
- `SaleReceiptBillingGst`, `DebitNoteGst`, `CreditNoteGst`

Frontend hardcoded in `BillwiseBreakdownTable.jsx` (lines 30-32):
```
IGST -> ccCode: "IGST", ccName: "Output-IGST",  fraction: 1
CGST -> ccCode: "CGST", ccName: "Output-CGST",  fraction: 0.5
SGST -> ccCode: "SGST", ccName: "Output-SGST",  fraction: 0.5
```

IGST is mutually exclusive with CGST+SGST globally across all bills (enforced in frontend).

### Sale Bill Number -- Financial Year Logic

`sale_bill/service.py` line 45-50:
```
FY runs April-March.
fy_start = year if month >= 4 else year - 1
Prefix = "{fy_start last 2 digits}{fy_end last 2 digits}DH"
```
"DH" suffix = "Dishaan Hi-tech". Hardcoded company identifier.

---

## 5. Journal Entry System -- The Accounting Source of Truth

### Model: `app/models/journalEntry.py`

**JournalEntryMaster:**
- `voucher_no` (String 50), `journal_uuid` (UUID for public access)
- `entry_date` (Date), `project_code` FK to projects
- `entry_mode`: "new_voucher" (JV), "bulk_docket" (JB), "adjustment" (JA)
- `ref_bill_type` / `ref_bill_id`: optional link to sale_bill / purchase_bill / receipt_billing
- `total_debit`, `total_credit` (Numeric 14,2)
- Full workflow: Draft to Pending_L{n} to Approved / Reback / Rejected
- `locked` flag prevents edits when submitted/approved

**JournalEntryLine:**
- `account_type`: "CC" | "Vendor" | "Customer"
- `dr_cr`: "Dr" | "Cr"
- `cc_id` FK to cc_codes.id (for CC type)
- `vendor_id` FK to vendors.id (for Vendor type)
- `customer_ref` (String -- client name snapshot for Customer type)
- `debit_amount`, `credit_amount` (Numeric 14,2)

**Validation:** Total debit must equal total credit (enforced in service, line 169).

**Balance Sheet derives ALL values from JournalEntryLine** via:
- `_bulk_journal_balance()`: credit - debit (for liabilities/equity)
- `_bulk_journal_debit_sum()`: sum of debits (for assets)
- Only "Approved" + "Active" entries count

### Journal Voucher (Petty Cash): `app/models/journalVoucher.py`

**PettyCashJournalVoucher:** Separate table, NOT in journal_entry_master. Links to docket voucher details.
**PettyCashJournalLine:** Uses denormalized `cc_code`/`cc_name` strings (NOT FK to cc_codes).

**Important:** Journal Voucher lines do NOT flow into Balance Sheet or P&L calculations because they are in a separate model and the balance_sheet/service.py queries only JournalEntryLine. The link is: approved docket vouchers -> Journal Entry (bulk_docket mode) -> JournalEntryLine with cc_id FK.

---

## 6. Ledger Architecture

### My Ledger (`my_ledger/service.py`)

**Source documents (6 types):**
1. Sale Bill -> Debit (we billed client, receivable)
2. Sale Receipt Billing -> Debit (client paid us)
3. Purchase Bill -> Credit (vendor billed us, payable)
4. Bill Payment Receipt -> Credit (we paid vendor)
5. Debit Note -> Debit (reduces payable)
6. Credit Note -> Credit (increases payable)

**All filter by:** project_code, from_date, to_date, workflow_status = "Approved"

**Two modes:**
- Single project: queries 6 document types for one project_code
- All projects: 6 global queries, grouped by project_code in Python

**Running balance:** Debit = income/receivable (+), Credit = expense/payable (-)

### Vendor Ledger (`vendor_ledger/service.py`)

**Source documents (4 types):**
1. Purchase Bill -> Credit (we owe vendor)
2. Bill Payment Receipt -> Debit (we paid vendor)
3. Debit Note -> Debit (reduces our payable)
4. Credit Note -> Credit (increases our payable)

**Running balance:** Credit = we owe vendor (+), Debit = we paid (-). Opposite convention to My Ledger.

**Key observation:** Neither ledger pulls from JournalEntry. They are purely transaction-document-based, independent of the double-entry journal system.

---

## 7. Trial Balance

**NOT IMPLEMENTED.** No trial balance module, service, route, or frontend page exists. The system has:
- P&L (computed from budgets + sale orders + purchase bills)
- Balance Sheet (computed from journal entries + special aggregations)
- No trial balance that reconciles between them

---

## 8. P&L Report Architecture

### Backend: `profit_loss/service.py` -> `get_pl_report()`

| Column | Source | Query |
|---|---|---|
| `order` (Sale) | OgSaleOrderMaster.total_amount | Approved + Active, sum by date range |
| `order` (Expenses) | BudgetItemCCCode.cc_total + BudgetMaster.overhead_data JSON | Approved + Active budgets |
| `booked` | PurchaseBillItem.basic_amount | Approved purchase bills grouped by cc_code |
| `workDone` | **NOT IMPLEMENTED** | Returns `None` for all rows |
| `stock` | **NOT IMPLEMENTED** | Returns `None` for all rows |
| `actual` | **NOT IMPLEMENTED** | Returns `None` for all rows |

### Frontend: `src/config/profitLoss.config.js`

- 5 value columns defined: order, workDone, booked, stock, actual
- ColumnPicker lets user toggle visibility
- Layout is hardcoded by business requirement (comment in config file)
- Section totals and percentages computed on client
- Color coding: sale = green, expense = red, result = blue

**Critical issue:** P&L is NOT derived from Journal Entries. It queries OG Sale Orders (for revenue) and Budgets (for expenses). This is a parallel data path from the Balance Sheet, which IS journal-entry-based.

---

## 9. Balance Sheet Architecture

### Backend: `balance_sheet/service.py` -> `get_balance_sheet()`

**Architecture:**
1. Two bulk queries to JournalEntryLine for most values
2. Special standalone computations for CRSF, CASD, GST, banks, cash
3. Hardcoded response structure with named sections

**Equity & Liabilities:**
- A: Capital Account = shareholders fund (DIR1+DIR2) + CRSF (P&L net)
- B: Non-current Liability = long-term borrowings (LON1-3, USLO, NBFC) + NCDT + NCTL + NCTP
- C: Current Liabilities = CLDT + CLSC + CLTB + CLTP + other (CLFP, CLCP, CLOP, CLCM) + GST payable

**Assets:**
- A: Non-current Assets = fixed assets (12 codes) + NCIV + NCTA + LTLA + NCCA
- B: Current Assets = closing stock (CARM, CAHL, CAAP, CAUM, CAWP) + CASD (sundry debtors) + CART + loans & advances (CAAE, CAOP) + CACI + CATS + CAOA + GST excess input + banks + cash

**BUG: `caav` variable undefined.** In `balance_sheet/service.py` line 688, the CALA section includes `{"code": "CAAV", "label": "Advance to vendors", "value": caav}` but `caav` is never defined in the function. CAAV is not in the `_bulk_journal_debit_sum()` query. This will cause a NameError if this code path executes.

---

## 10. GST Accounting

### Storage Pattern

Every financial document with GST has a child table with rows for each GST type:
- `gst_type`: "IGST" | "CGST" | "SGST" (string, not FK)
- `gst_rate`, `gst_amount`, `basic_amount`, etc.
- `is_selected` (Boolean) -- on SaleBillGst, used to filter which GST rows count
- `cc_code`, `cc_name` -- denormalized CC code snapshot per GST row

### GST in Balance Sheet

Output GST = sum of `SaleBillGst.gst_amount` where `is_selected = True`, grouped by gst_type
Input GST = sum of `BillPaymentReceiptGst.current_amount`, grouped by gst_type
Net = Output - Input

If positive -> GST Payable (liability side, code CLGP)
If negative -> GST Excess Input Credit (asset side)

### GST in Frontend

Print pages (order, service-order) use hardcoded IGST/CGST/SGST logic:
- If gstType === "IGST": show full amount as IGST
- Else: split gstAmount / 2 for CGST and SGST

BillwiseBreakdownTable enforces global mutual exclusion: IGST xor (CGST+SGST).

---

## 11. Opening Balances and Financial Year

### Opening Balance

**Only found in Contra Entry:** `ContraEntryLine.opening_balance` and `.closing_balance` -- these are per-line computed values (opening - debit + credit = closing), NOT system-wide opening balances.

**No opening balance mechanism exists for:**
- CC Codes
- Bank/Cash accounts
- Vendor accounts
- General ledger
- Journal entries

**The Balance Sheet has no opening balance carry-forward.** All values are computed from the full transaction history (approved journal entries, sale bills, etc.) filtered by date range. There is no concept of "closing balance of previous FY becomes opening balance of new FY."

### Financial Year

**Only reference:** `sale_bill/service.py` -> `_fy_prefix()` which derives FY from invoice_date (Apr-Mar cycle).

**No financial year model/table exists.** No FY close, FY lock, or period-based accounting restrictions.

---

## 12. Contra Entry (Bank Transfer) Architecture

### Model: `app/models/contraEntry.py`

- ContraEntryMaster: voucher_no (CV prefix), entry_date, project_code, total_amount
- ContraEntryLine: dr_cr, account_id (FK to bank_cash.id), opening_balance, debit_amount, credit_amount, closing_balance

**Transfer types tracked:** Bank to Cash, Cash to Bank, Bank to Bank, Cash to Cash (summary computed in list endpoint).

**Not connected to Journal Entry system.** Contra entries are standalone -- they don't create JournalEntryLines. This means bank transfers are NOT reflected in the Balance Sheet's journal-based calculations.

---

## 13. BankCash Model and Balance Sheet Integration

### Model: `app/models/bankCash.py`

- `type`: "Bank" or "Cash"
- `bank_code` (unique), `bank_name`, account details
- `group_id` FK to group_master (Balance Sheet classification)
- `sub_group_id` FK to sub_group_master
- Links to projects via `BankCashProject` junction table

### Balance Sheet Bank Balance

Computed as: `received (BillPaymentReceiptMaster per bank) - paid (PaymentVoucherMaster per bank)`

**NOT from journal entries.** This is a separate computation path. Bank balances ignore:
- Contra entries (bank transfers)
- Direct journal entries involving bank accounts
- Opening balances

---

## 14. Vendor (Ledger) Model

### Model: `app/models/vendor.py`

The Vendor model serves as the "Ledger" master in the system. Key fields:
- `ledger_code`, `ledger_name`, `gstin`, `pan`
- `type`: "creditor" | "debtor"
- `category_code` FK to category_master
- State, address, contact details
- `is_supplier` (Boolean) -- links to SupplierMaster

The "Ledger" in PRAX is synonymous with "Vendor/Party." There is no separate general ledger / chart of accounts for non-CC, non-vendor accounts.

---

## 15. Budget Model and CC Code Junction

### Model: `app/models/budget.py`

**BudgetMaster:** project_code, budget_date, linked to OG Sale Order items, overhead_data (JSON)
**BudgetItem:** Represents a line item in the budget, linked to OG Sale Order items
**BudgetItemCCCode:** Junction table linking BudgetItem to CC codes with `cc_total` amounts
- `cc_code_id` FK to cc_codes.id
- `cc_code`, `cc_name` (denormalized snapshots)
- `cc_total` (Numeric) -- the budgeted amount for this CC code

**Overhead data** stored as JSON in BudgetMaster.overhead_data:
```
{
  "projectOverhead": [{"ccCode": "IRDC", "estimatedCost": 50000}, ...],
  "employeeOverhead": [{"ccCode": "IOFM", "estimatedCost": 30000}, ...]
}
```

This is a hybrid approach -- direct expenses use the junction table, overhead expenses use a JSON column.

---

## 16. Workflow Architecture

All finance modules share a common workflow via `app/modules/work_flow/`:
- `is_creator()`, `is_current_approver()`, `get_first_approver()`, `get_next_approver()`
- `get_gap_level()`, `create_history()`, `get_history()`, `get_approval_steps()`

**States:** Draft -> Pending_L{n} -> Approved / Reback / Rejected
- Reback: returns to Draft, unlocks for editing
- Approved: locks the record
- Rejected: locks and sets status to Inactive

Each module has a `_MODULE` code for workflow registration:
- `"journal"` (Journal Entry), `"petty_cash"` (Journal Voucher), `"contra"` (Contra Entry)
- `"sale"` (Sale Bill), `"purchase"` (Purchase Bill), `"pv_payment"` (Payment Voucher)
- `"bill_payment"` (Bill Payment), etc.

---

## 17. Data Integrity and Accounting Consistency Issues

### Critical Issues

1. **P&L and Balance Sheet use different data sources.**
   - P&L: OG Sale Orders (revenue) + Budget CC codes (expenses) + Purchase Bill items (booked)
   - Balance Sheet: JournalEntryLine (most values) + SaleBill/BPR aggregates (GST, sundry debtors, banks)
   - These are independent computation paths with no reconciliation mechanism

2. **No Trial Balance.**
   - Without a trial balance, there's no automated check that debits = credits across the entire system
   - The journal entry service validates Dr=Cr per entry, but no system-wide check exists

3. **Balance Sheet `caav` variable undefined (bug).**
   - `balance_sheet/service.py` line 688 references `caav` (Advance to Vendors) but it is never assigned
   - The CALA (Short-term loans & advances) section will crash if this code path is exercised

4. **Contra Entries not in Journal system.**
   - Bank transfers (Contra Entry) don't create Journal Entry lines
   - Bank balances in Balance Sheet are computed from PV/BPR, not from journals
   - Contra entries are invisible to the journal-based BS calculation

5. **LON3 code shared across multiple accounts.**
   - Kotak JCB and Kotak Venus both use LON3
   - ICICI OD also shares LON3
   - Backend hardcodes `lon3_kotak_venus = 0.0` and `lon3_icici_od = 0.0`
   - No sub-code mechanism exists to distinguish them

6. **3 P&L columns not implemented.**
   - `workDone`, `stock`, `actual` all return `None`
   - Frontend renders them as empty -- functional but incomplete

7. **No opening balance / carry-forward mechanism.**
   - All reports compute from full history with date filters
   - No FY close, no period lock, no opening balance tables
   - If filtered to a single FY, previous FY balances are lost

8. **Bank balance ignores contra entries.**
   - Bank-to-bank transfers via Contra Entry don't adjust the computed bank balance
   - Formula: received (BPR) - paid (PV) per bank, ignoring all other movements

### Moderate Issues

9. **Denormalized CC codes are snapshots.**
   - CC code/name strings on 15+ models are point-in-time snapshots
   - Renaming a CC code in the master won't update historical transactions (correct for audit trail, but may confuse reporting if CC codes are renamed)

10. **My Ledger and Vendor Ledger don't use Journal Entries.**
    - They aggregate from 4-6 document types directly
    - A journal adjustment entry won't appear in any ledger view

11. **No multi-currency support.**
    - All amounts are Numeric(14,2) with no currency field
    - Assumed to be INR throughout

12. **No audit trail on amount changes.**
    - Edit operations delete-and-recreate all line items
    - No historical line-level tracking (only workflow history captures action timestamps)

---

## 18. API Endpoint Map (Finance)

See `src/config/api.config.js` lines 526-745 for the complete map. Key report endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/finance/profit-loss` | GET | P&L report (projectCode, fromDate, toDate) |
| `/finance/balance-sheet` | GET | Balance Sheet (projectCode, fromDate, toDate) |
| `/finance/my-ledger` | GET | Project ledger (projectCode, fromDate, toDate) |
| `/finance/vendor-ledger` | GET | Vendor ledger (vendorId, projectCode, fromDate, toDate) |
| `/finance/petty-cash/ledger/account-ledger` | GET | Petty cash account ledger |

All financial CRUD endpoints follow the pattern:
`/finance/{module}/create`, `list`, `/{id}`, `edit/{id}`, `submit/{id}`, `approve/{id}`, `reback/{id}`, `reject/{id}`, `history/{id}`, `my-approval-status/{id}`, `uuid/{uuid}`

---

## 19. Recent Migrations (Last 10)

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

No migrations for opening balance, financial year, or trial balance tables.

---

## 20. Recommended Target Architecture (Phase 2 Roadmap)

### High Priority

1. **Fix `caav` undefined bug** in `balance_sheet/service.py` -- add CAAV to the debit-sum bulk query or set to 0.0

2. **Create Contra Entry to Journal Entry integration** -- when a contra entry is approved, auto-generate a JournalEntry with Dr/Cr lines for the bank/cash accounts

3. **Implement Trial Balance** -- aggregate all JournalEntryLine Dr/Cr by CC code + vendor accounts, verify Dr total = Cr total

4. **Unify P&L data source** -- either:
   a. Route P&L through journal entries (preferred: create JE lines when budgets are approved), or
   b. Accept the parallel paths and document them as designed

### Medium Priority

5. **Opening Balance framework** -- add opening_balance table (cc_code, vendor_id, bank_cash_id, amount, fy_year), incorporate into BS and ledger calculations

6. **Financial Year model** -- FY table with start_date, end_date, is_locked; enforce period restrictions on entries

7. **LON3 sub-code resolution** -- either add sub-codes to cc_codes or introduce a separate tracking mechanism for loans that share a CC code

8. **Implement P&L remaining columns** -- workDone (from site reports/DPR?), stock (from GRN/stock module), actual (from payment vouchers/bill payments)

### Lower Priority

9. **Standardize CC code storage** -- either all FK (preferred for consistency) or all denormalized (simpler joins). The current hybrid adds complexity.

10. **Bank balance from journal entries** -- migrate bank balance calculation to use JournalEntryLine instead of direct PV/BPR aggregation, for consistency with rest of BS

11. **Multi-project financial consolidation** -- currently each report filters by single project or all projects; no group-level consolidation

---

## Appendix A: Complete CC Code List (50 P&L + ~30 BS = ~80 codes)

### P&L Codes (from profitLoss.config.js)
CRIN, CRHL, CRAP, UCAP, WIPS, INOC, DRCW, DRMC, DRFD, DRMH, DRUS, DRMR, DRLC, DRLS, DRMS, IRDC, IRAD, IRLE, IRFS, IRMR, IRLU, IRMT, IRPS, IRSD, IRIM, IRIL, IRFM, IRTT, IRLH, IRLM, IRLT, IOFM, IOHR, IOME, IOMS, IOMB, IOSS, IOVR, IOTV, IOCR, CRBC, CRBD, CRCC, CRDR, CRES, CRIC, CRIP, CRLC, CRPF, CRIT

### BS Codes (from balance_sheet/service.py)
DIR1, DIR2, CRSF, LON1, LON2, LON3, USLO, NBFC, NCDT, NCTL, NCTP, CLDT, CLSC, CLTB, CLTP, CLFP, CLCP, CLOP, CLCM, CLGP, APNM, ASRV, AOFG, AELE, AMEG, ALGH, AINF, ASCF, ASHT, AEIT, AETT, ACAB, NCIV, NCTA, LTLA, NCCA, CARM, CAHL, CAAP, CAUM, CAWP, CASD, CART, CAAE, CAOP, CACI, CATS, CAOA, CABA, CACH

### Section Codes (composite, not leaf)
NCTB, CACS, CALA

---

## Appendix B: Model File Index (Finance-relevant)

| Model File | Table | Key Relationships |
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
| `pettyCashBudget.py` | petty_cash_budget_masters, petty_cash_budget_items | -- |
| `pettyCashDocketVoucher.py` | petty_cash_docket_vouchers, petty_cash_docket_voucher_details | petty_cash_budget |
| `ogSaleOrder.py` | og_sale_order_masters, og_sale_order_items, og_sale_order_gst | projects |
| `asset.py` | asset_masters | cc_codes, category_master |
| `item.py` | item_masters | cc_codes, category_master |

---

*End of Phase 1 Audit Report*
