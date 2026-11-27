# PRAX ERP — Central Accounting Posting Guide

> **Last updated:** 2026-11-27  
> **Scope:** All GL posting rules, document flows, and CC code assignments for the central accounting module.  
> **Backend path:** `erp_backend/app/modules/finance/accounting/`

---

## 1. Architecture Overview

The central accounting module maintains two tables:

| Table | Purpose |
|-------|---------|
| `accounting_ledger` | One header row per posted document (source_type + source_id) |
| `accounting_ledger_lines` | Individual Dr/Cr lines for each ledger entry |

Every approved source document triggers `post_document(source_type, source_id, user_id)` in `posting_engine.py`, which calls the matching rule from `posting_rules.py` and validates that `sum(Dr) == sum(Cr)` before writing.

**Account types used in lines:**

| account_type | Resolved from | Examples |
|-------------|---------------|---------|
| `CC` | `cc_codes` master table | UWIP, CAAV, SRCW, DRCW, GST codes |
| `Vendor` | `vendors` table | Supplier payables, customer debtors (debtors are stored as Vendor records with debtor flag) |
| `Bank` | `bank_accounts` table | Bank / cash accounts |

---

## 2. Document Posting Rules (All Modules)

### 2.1 Purchase Bill (PB)
**Source type:** `purchase_bill`  
**Trigger:** Workflow status → Approved

```
Dr  CC Expense code(s)      ← per line item (item.cc_code)
Dr  GST Input CC            ← per GST line (IGST / CGST / SGST)
Cr  Vendor (payable)        ← total invoice amount
```

- Line items drive the expense split across CC codes.
- GST CC resolved via `_resolve_gst_cc("Input", gst_type)`.
- Discount: Dr `DSCA`, Round-off: Dr/Cr `ROFE`/`ROFI`.

---

### 2.2 Payment Voucher (PV)
**Source type:** `payment_voucher`  
**Trigger:** Workflow status → Approved

```
Dr  CC Expense code(s)      ← per line item (item.cc_code)
Dr  GST Input CC            ← per GST line
Cr  Bank / Cash             ← pv.bank_ac_id or pv.cash_ac_id
```

Direct payment without a vendor bill. Expense hits P&L immediately.

---

### 2.3 Bill Payment Receipt (BPR)
**Source type:** `bill_payment`  
**Trigger:** Workflow status → Approved  
**Two modes — `kind` field on BillPaymentReceiptMaster:**

#### Mode: `advance`
```
Dr  CAAV  (Current Asset: Advance to Vendors)   ← full advance amount
Cr  Bank / Cash                                  ← bpr.bank_ac_id or cash_ac_id
```
Advance sits on CAAV (asset) until adjusted against a bill.

#### Mode: bill payment (any other kind)
```
Dr  Vendor (payable)        ← per CC split from BPR line items
Cr  Bank / Cash             ← full payment amount
```
Settles the vendor payable created by the Purchase Bill.

> **Note:** PB creates Cr Vendor → BPR clears Dr Vendor → net effect Dr CC / Cr Bank. No duplication.

---

### 2.4 Advance Adjustment
**Source type:** `advance_adjustment`  
**Trigger:** Workflow status → Approved

```
Dr  Vendor (payable)        ← advance being applied to bill
Cr  CAAV                    ← clears the advance asset
```

Links the advance (CAAV) to a specific Purchase Bill. After adjustment:
- PB: Cr Vendor (payable)
- Advance Adj: Dr Vendor / Cr CAAV
- Net: Cr CAAV settled, vendor payable reduced

---

### 2.5 Sale Bill (SB)
**Source type:** `sale_bill`  
**Trigger:** Workflow status → Approved

```
Dr  Debtor / Customer       ← sb.total_invoice_amount (via sale_order → OgSaleOrder.debtor_id)
Cr  Revenue CC code(s)      ← per line item (item.cc_code, e.g. SRCW)
Cr  GST Output CC           ← per GST line (IGST / CGST / SGST)
```

> **Prerequisite:** Sale bill must be linked to a sale order (`sale_order_id`) and that sale order must have `debtor_id` set. Posting fails with a clear error if not.

---

### 2.6 Sale Receipt Billing (SRB)
**Source type:** `sale_receipt_billing`  
**Trigger:** Workflow status → Approved

```
Dr  Bank / Cash             ← receipt amount
Cr  Debtor / Customer       ← clears receivable from Sale Bill
```

Settles the customer receivable created by the Sale Bill.

---

### 2.7 Journal Entry (JE)
**Source type:** `journal_entry`  
**Trigger:** Workflow status → Approved

```
Dr / Cr  as entered manually by the user
```

Manual entries — no auto-derivation. Includes both regular JEs and **bulk_docket** (PCJV) JEs.

#### Special case — bulk_docket (PCJV / Petty Cash Journal)
```
Dr  CC Expense code(s)      ← per JE line (petty cash expenses)
Cr  Bank / Cash             ← cash disbursement account
```

PCJV posts via the standard journal entry rule — no special handling.

---

### 2.8 Petty Cash Docket Voucher (PCDV)
**Source type:** `petty_cash_docket`  
**GL posting:** ❌ **NONE — no accounting entry**

PCDV is a collection and reconciliation document only. It records individual petty cash expense claims against a docket. GL posting happens only when the docket is journalised into a **PCJV (bulk_docket Journal Entry)**.

> **Rule:** PCDV approval → no GL. PCJV approval → Dr CC / Cr Bank.

---

### 2.9 GRN (Goods Receipt Note)
**Source type:** `grn`  
**GL posting:** ❌ **NONE — stock ledger only**

GRN records quantity received into stock. Financial liability is confirmed only when the vendor's invoice (Purchase Bill) is received and approved.

Posting GRN to GL would duplicate the Dr CC / Cr Vendor already created by the Purchase Bill.

> **Stock ledger:** Updated by `post_grn_stock()` in `stock_posting_rules.py`.

---

### 2.10 GIN (Goods Issue Note)
**Source type:** `gin`  
**GL posting:** ❌ **NONE — stock ledger only**

GIN records quantity issued from stock. No GL entry — material cost is already captured at PB/PV stage.

> **Stock ledger:** Updated by `post_gin_stock()` in `stock_posting_rules.py`.

---

### 2.11 Sale Claim Bill
**Source type:** `sale_claim_bill` (BillingMaster, mode = `sale_claim_bill`)  
**Trigger:** Workflow status → Approved

```
Dr  UWIP  (Unbilled Work in Progress)   ← this_bill_claim amount
Cr  Customer / Debtor                   ← provisional receivable (via og_sale_order → debtor_id)
```

Recognises work completed but not yet certified. UWIP is a Balance Sheet asset.

> **Prerequisite:** BillingMaster must have `og_sale_order_id` set, and that sale order must have `debtor_id`. Posting fails with clear error if not.

---

### 2.12 Sale Certified Bill
**Source type:** `sale_certified_bill` (BillingMaster, mode = `sale_certified_bill`)  
**Trigger:** Workflow status → Approved

```
Dr  Customer / Debtor                   ← certified receivable (via og_sale_order → debtor_id)
Cr  UWIP  (Unbilled Work in Progress)   ← reduces WIP for certified portion
```

Converts provisional WIP receivable into a confirmed customer receivable when the engineer certifies the work.

---

### 2.13 Uncertified Statement
**Source type:** `uncertified_statement`  
**Trigger:** Workflow status → Approved

Reclassifies UWIP into hold sub-categories:

```
Dr  SAMD  ← certified_hold_amendment_pending
Dr  SNBQ  ← non_boq_items_rate
Dr  SUSW  ← hold_work
Dr  SFWN  ← hold_for_full_work_not_completed
Cr  UWIP  ← total reclassified amount
```

---

### 2.14 Debit Note
**Source type:** `debit_note`  
**Trigger:** Workflow status → Approved

Reversal / correction on the purchase side:

```
Cr  CC Expense code(s)      ← reverses PB expense lines
Dr  Vendor (payable)        ← reduces vendor payable
```

---

### 2.15 Credit Note
**Source type:** `credit_note`  
**Trigger:** Workflow status → Approved

Reversal / correction on the sale side:

```
Cr  Debtor / Customer       ← reduces receivable
Dr  Revenue CC code(s)      ← reverses Sale Bill revenue lines
```

---

### 2.16 Contra Entry
**Source type:** `contra_entry`  
**Trigger:** Workflow status → Approved

Bank-to-bank or cash-to-bank transfers:

```
Dr  Destination Bank / Cash
Cr  Source Bank / Cash
```

---

## 3. Key CC Codes

| CC Code | Name | Type | Used by |
|---------|------|------|---------|
| `UWIP` | Unbilled Work in Progress | Balance Sheet Asset | Sale Claim Bill, Certified Bill, Uncertified Statement |
| `CAAV` | Current Asset: Advance to Vendors | Balance Sheet Asset | BPR advance, Advance Adjustment |
| `SRCW` | Sale Revenue — Civil Works | P&L Revenue | Sale Bill line items |
| `DRCW` | Direct Cost — Civil Works | P&L Expense | Purchase Bill / PV line items |
| `SAMD` | Hold — Amendment Pending | Balance Sheet | Uncertified Statement |
| `SNBQ` | Hold — Non-BOQ Items | Balance Sheet | Uncertified Statement |
| `SUSW` | Hold — Suspended Work | Balance Sheet | Uncertified Statement |
| `SFWN` | Hold — Full Work Not Completed | Balance Sheet | Uncertified Statement |
| `DSCA` | Discount Allowed | P&L Expense | Sale Bill, Purchase Bill |
| `ROFE` | Round-off Expense | P&L | Bill round-off |
| `ROFI` | Round-off Income | P&L | Bill round-off |

GST CC codes are resolved dynamically by `_resolve_gst_cc(direction, gst_type)`.

---

## 4. Document Flow Chains

### 4.1 Procurement Flow

```
Purchase Order
      │
      ▼
   GRN ──────────────────► Stock Ledger only (no GL)
      │
      ▼
 Purchase Bill ───────────► Dr CC Expense / Cr Vendor  [GL]
      │
      ├──► BPR (advance) ──► Dr CAAV / Cr Bank  [GL]
      │          │
      │    Advance Adj ─────► Dr Vendor / Cr CAAV  [GL]
      │
      └──► BPR (payment) ──► Dr Vendor / Cr Bank  [GL]
```

**Net effect (bill + advance + adjustment + payment):**
```
Dr CC Expense   Cr Bank
```

---

### 4.2 Petty Cash Flow

```
Petty Cash Docket Voucher (PCDV)
      │
      │  (collection only — NO GL)
      ▼
 Petty Cash Journal (PCJV / bulk_docket JE)
      │
      ▼
  Dr CC Expense / Cr Bank  [GL]
```

PCDV collects and reconciles individual expense slips. PCJV posts the total to GL once approved.

---

### 4.3 Sales / Billing Flow

```
OG Sale Order
      │
      ▼
Sale Claim Bill ──────────► Dr UWIP / Cr Customer (provisional)  [GL]
      │
      ▼
Uncertified Statement ────► Dr Hold CCs / Cr UWIP  [GL]  (optional)
      │
      ▼
Sale Certified Bill ──────► Dr Customer / Cr UWIP  [GL]
      │
      ▼
   Sale Bill ─────────────► Dr Debtor / Cr Revenue CC + GST  [GL]
      │
      ▼
Sale Receipt Billing ─────► Dr Bank / Cr Debtor  [GL]
```

---

### 4.4 Direct Sale (no claim/certified)

```
OG Sale Order
      │
      ▼
   Sale Bill ─────────────► Dr Debtor / Cr Revenue CC + GST  [GL]
      │
      ▼
Sale Receipt Billing ─────► Dr Bank / Cr Debtor  [GL]
```

---

## 5. Posting Rules — What Does NOT Post to GL

| Document | Reason |
|----------|--------|
| **GRN** | Stock only. PB already posts Dr CC / Cr Vendor. Dual posting = double-count. |
| **GIN** | Stock only. Material cost captured at PB/PV stage. |
| **PCDV** | Collection/reconciliation voucher only. PCJV posts to GL. |

---

## 6. Reversal Rules

Any approved GL entry can be reversed by calling `reverse_posting(source_type, source_id)`. This:
1. Creates a new `accounting_ledger` row with `is_reversal=True`
2. Swaps all Dr/Cr lines
3. Marks the original entry `is_reversed=True`
4. Preserves full audit trail — nothing is deleted

Cancelled / reversed documents are excluded from all reports via `_not_cancelled()` filter.

---

## 7. Historical Posting

`historical_posting.py` → `run_historical_posting()` processes all approved documents in dependency order:

```
journal_entry → purchase_bill → sale_bill → payment_voucher →
bill_payment → advance_adjustment → sale_receipt_billing →
debit_note → credit_note → contra_entry →
grn (stock only) → gin (stock only) →
sale_claim_bill → sale_certified_bill → uncertified_statement
```

- Already-posted documents are skipped (checks `accounting_ledger` for existing entry).
- GRN/GIN: stock ledger posted, GL skipped (no accounting entry generated).
- Errors per document are isolated — one failure does not stop the rest.

**To re-run historical posting (without wiping):**
```bash
cd erp_backend && source venv/bin/activate
python3 - <<'EOF'
from app import create_app
from app.modules.finance.accounting.historical_posting import run_historical_posting
app = create_app()
with app.app_context():
    result, _ = run_historical_posting(user_id=None)
    s = result["data"]["summary"]
    print(f"Posted: {s['totalPosted']}  Skipped: {s['totalSkipped']}  Errors: {s['totalErrors']}")
EOF
```

---

## 8. Prerequisites for Posting

| Document | Required data |
|----------|--------------|
| Sale Bill | `sale_order_id` set + OgSaleOrder has `debtor_id` |
| Sale Claim Bill | `og_sale_order_id` set + OgSaleOrder has `debtor_id` |
| Sale Certified Bill | Same as above |
| BPR (any) | `bank_ac_id` or `cash_ac_id` set |
| All line-item docs | `cc_code` on each line must exist in `cc_codes` master |

Posting raises a clear `PostingError` with a descriptive message if any prerequisite is missing.
