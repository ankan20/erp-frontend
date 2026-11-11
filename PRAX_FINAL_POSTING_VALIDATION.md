# PRAX ERP — Final Accounting Posting Validation

> **Date:** 2026-11-10
> **Scope:** Complete revalidation of every posting rule, duplicate accounting resolution, double-entry verification, party/account identity, GST treatment, historical posting safety, and technical consistency
> **Constraint:** Research only — no code changes, no schema changes, no commits, no migrations

---

## Table of Contents

1. [Corrected Transaction-by-Transaction Dr/Cr Matrix](#section-1)
2. [Numerical Accounting Examples](#section-2)
3. [Duplicate Accounting Analysis](#section-3)
4. [Party and Account Identity Validation](#section-4)
5. [GST Treatment Validation](#section-5)
6. [Historical Posting and Reconciliation Strategy](#section-6)
7. [Technical Implementation Consistency](#section-7)
8. [Confirmed Rules vs Unresolved Decisions](#section-8)
9. [Corrected Central Ledger Model](#section-9)
10. [Safe Implementation Sequence](#section-10)
11. [Regression Test Cases](#section-11)

---

<a id="section-1"></a>
## 1. Corrected Transaction-by-Transaction Dr/Cr Matrix

Every posting rule below is derived from the actual service code and model definitions. Fields are cited by their actual names. Where a field is a string (no FK), it is marked `(STRING)`.

### 1.1 Purchase Bill — Approval

**Business event:** Recognition of vendor invoice. Creates expense/asset + vendor liability.
**Source:** `PurchaseBillMaster`, `PurchaseBillItem`, `PurchaseBillGst`
**Trigger:** `approve_purchase_bill()` sets `workflow_status = "Approved"` (`purchase_bill/service.py:993`)
**No payment involved** — PB has NO `bank_ac_id`/`cash_ac_id`/`payment_mode` fields.

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | CC-code expense/asset | `item.cc_code` (STRING) | `item.basic_amount` | Per item |
| Dr | GST Input (see §5) | `gst.gst_type` WHERE `is_selected=True` | `gst.gst_amount` | `basic_total × percent / 100` |
| Cr | Vendor payable | `master.vendor_id` FK | `master.total_invoice_amount` | `basic + gst - discount + round_off` |
| Dr/Cr | Discount/RoundOff adjustment | System account | `|discount - round_off|` | Balancing leg when `discount ≠ 0` or `round_off ≠ 0` |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount` (with discount/round_off adjustment)

**Creates:** New vendor payable + new expense. **Settles:** Nothing.

---

### 1.2 Payment Voucher — Approval

**Business event:** Direct cash payment to vendor against CC-code accounts. Simultaneously creates expense AND makes payment. **NOT a payment against a Purchase Bill** — PV has NO `purchase_bill_id` FK.
**Source:** `PaymentVoucherMaster`, `PaymentVoucherItem`, `PaymentVoucherGst`
**Trigger:** `approve_payment_voucher()` (`payment_voucher/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | CC-code expense/asset | `item.cc_code_id` (FK) | `item.current_amount` | NOT `booked_amount` |
| Dr | GST Input (see §5) | `gst.gst_type` WHERE `is_selected=True` | `gst.current_amount` | User-specified, NOT recalculated |
| Cr | Bank/Cash | `master.bank_ac_id` (if Bank) or `master.cash_ac_id` (if Cash) FK | `master.total_invoice_amount` | `basic + gst - discount + round_off` |
| Dr/Cr | Discount/RoundOff | System account | `|discount - round_off|` | Balancing leg |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount`

**PV does NOT post to vendor sub-ledger.** The `vendor_id` is informational (who received the money). PV is a self-contained expense+payment — no outstanding balance to track.

**Creates:** New expense + bank/cash outflow. **Settles:** Nothing (PV is standalone).

**Key field distinction:** `booked_amount` is an informational snapshot of a reference/budgeted amount. `current_amount` is the actual amount paid now. Only `current_amount` matters for posting.

---

### 1.3 Bill Payment Receipt (bill mode) — Approval

**Business event:** Cash payment to settle an existing Purchase Bill liability. Does NOT create any new expense.
**Source:** `BillPaymentReceiptMaster` WHERE `payment_type = "bill"`, `BillPaymentReceiptItem`, `BillPaymentReceiptGst`
**Trigger:** `approve_bill_payment_receipt()` (`bill_payment/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Vendor payable | `master.vendor_id` FK | `master.total_invoice_amount` | Settles PB liability |
| Cr | Bank/Cash | `master.bank_ac_id` or `master.cash_ac_id` FK | `master.total_invoice_amount` | Cash outflow |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount`

**BPR bill mode does NOT re-recognize expense.** The expense was already posted by the Purchase Bill. BPR only moves cash from bank to clear the vendor payable.

**BPR does NOT post GST input** in this mode (see §3.2 and §5 for detailed reasoning).

**Creates:** Bank/Cash outflow. **Settles:** Vendor payable from PB.

**Partial payment support:** `_paid_item_map(purchase_bill_id)` tracks `Σ current_amount` from all approved BPR items per `pb_item_id`. Balance = `booked_amount - paid_so_far`. No DB constraint prevents overpayment — only UI-level display.

**Multi-bill support:** `purchaseBillIds` array. GST types prefixed as `"{bill_id}:IGST"` to keep bills distinct. Posting treats it as single vendor payment regardless of bill count.

---

### 1.4 Bill Payment Receipt (voucher mode) — Approval

**Business event:** Cash payment to settle a Journal Entry's vendor liability. The JE already created the expense (Dr CC-code) and liability (Cr Vendor). BPR-voucher settles the cash side only.
**Source:** `BillPaymentReceiptMaster` WHERE `payment_type = "voucher"`, `BillPaymentReceiptItem`
**Trigger:** Same approve function, but GST total = 0.

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Vendor payable | `master.vendor_id` FK | `master.total_invoice_amount` | Settles JE's Cr Vendor line |
| Cr | Bank/Cash | `master.bank_ac_id` or `master.cash_ac_id` FK | `master.total_invoice_amount` | Cash outflow |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount`

**Critical:** BPR-voucher only settles JEs where `entry_mode in ("new_voucher", "bulk_docket")` (`bill_payment/service.py:969`). It picks JE Dr lines where `account_type == "CC"` and `dr_cr == "Dr"` (`line 831`). The Dr leg in the posting is NOT to the CC-code — it is to the vendor (to clear the Cr Vendor line from the JE). The CC-code reference on BPR items is informational.

**No GST** — voucher mode has `gst_amount = 0`.

**Creates:** Bank/Cash outflow. **Settles:** Vendor payable from JE.

---

### 1.5 Sale Bill — Approval

**Business event:** Revenue recognition. Creates customer receivable + revenue + GST output liability.
**Source:** `SaleBillMaster`, `SaleBillItem`, `SaleBillGst`
**Trigger:** `approve_sale_bill()` (`sale_bill/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Customer receivable | `master.sale_order_id` → `OgSaleOrderMaster.debtor_id` FK → Vendor | `master.total_invoice_amount` | `basic + gst - discount + round_off` |
| Cr | Revenue/CC-code | `item.cc_code` (STRING) | `item.basic_amount` | Per item |
| Cr | GST Output (see §5) | `gst.gst_type` WHERE `is_selected=True` | `gst.gst_amount` | `basic_total × percent / 100` |
| Dr/Cr | Discount/RoundOff | System account | `|discount - round_off|` | Balancing leg |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount`

**Customer identity is INDIRECT:** SaleBillMaster has NO `vendor_id` or `customer_id`. The customer (debtor) is found via: `sale_bill.sale_order_id` → `OgSaleOrderMaster.debtor_id` → `Vendor.id` WHERE `is_debtor=True`. If `sale_order_id` is NULL, the customer cannot be identified.

**`bank_ac_id` on SaleBill is NOT the payment bank.** It is the company's bank account printed on the invoice for customer reference. The actual payment bank comes from SaleReceipt parent (see §1.7).

**Creates:** Customer receivable + revenue + GST output liability. **Settles:** Nothing.

---

### 1.6 Sale Receipt (Parent) — NO POSTING

**Business event:** Payment receipt header grouping one or more SRB children.
**Source:** `SaleReceiptMaster`

**SaleReceipt MUST NOT generate any accounting entry.** It has:
- NO `workflow_status` field — no approval workflow
- NO submit/approve/reback functions — pure CRUD
- Its `total_amount` is informational

The SaleReceipt parent exists solely as a payment instrument header (payment_mode, bank_ac_id/cash_ac_id, UTR reference). Its children (SRB) are the actual accounting events.

---

### 1.7 Sale Receipt Billing (Child) — Approval

**Business event:** Cash receipt settling an existing customer receivable from a Sale Bill.
**Source:** `SaleReceiptBillingMaster`, `SaleReceiptItem`, `SaleReceiptGst`
**Trigger:** `approve_srb()` (`sale_receipt_billing/service.py:791`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Bank/Cash | `srb.receipt.bank_ac_id` or `srb.receipt.cash_ac_id` (from parent SaleReceipt) | `master.total_invoice_amount` | `basic + gst - discount + round_off` |
| Cr | Customer receivable | `srb.og_sale_order_id` → `OgSaleOrderMaster.debtor_id` → Vendor | `master.total_invoice_amount` | Settles SB receivable |

**Verify:** `Σ Dr = Σ Cr = total_invoice_amount`

**SRB does NOT post GST separately.** The GST was already created as output liability by the SaleBill. SRB settles the total receivable (including the GST portion). The GST breakdown on SRB items (booked/received/balance/current) is partial payment tracking, not a separate accounting event.

**Bank/Cash inheritance:** SRB has NO own bank/cash fields. Must traverse `srb.receipt` → parent SaleReceiptMaster for `bank_ac_id`/`cash_ac_id`/`payment_mode`.

**Partial payment support:** Items have `booked_amount` (from SB), `received_amount` (from prior SRBs), `balance_amount` (remaining), `current_amount` (this receipt). Calculated via `get_details_by_invoice_no()`.

**Creates:** Bank/Cash inflow. **Settles:** Customer receivable from SB.

---

### 1.8 Journal Entry — Approval

**Business event:** Manual double-entry accounting — the catch-all for any transaction without a dedicated module.
**Source:** `JournalEntryMaster`, `JournalEntryLine`
**Trigger:** `approve_journal_entry()` (`journal_entry/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr/Cr | CC-code | `line.cc_id` FK WHERE `account_type = "CC"` | `line.debit_amount` or `line.credit_amount` | Per line |
| Dr/Cr | Vendor sub-ledger | `line.vendor_id` FK WHERE `account_type = "Vendor"` | same | Per line |
| Dr/Cr | Customer (free-text) | `line.customer_ref` (STRING) WHERE `account_type = "Customer"` | same | Per line |

**Verify:** `total_debit == total_credit` — BUT the service allows debit-only JEs when there are no Cr lines (`journal_entry/service.py:169`). **This is a data integrity risk.** Debit-only JEs create unbalanced entries.

**Three entry modes:**
1. `new_voucher` (prefix "JV") — standard manual entry. **Posts normally.**
2. `bulk_docket` (prefix "JB") — aggregates approved PettyCashJournalVouchers. **See §3.4 for triple-posting risk.**
3. `adjustment` (prefix "JA") — references a bill via `ref_bill_type`/`ref_bill_id`. **See §3.5 for overlap risk.**

**No GST** — JournalEntry has no GST fields or sub-table.
**No Bank/Cash** — JournalEntryLine has no `bank_ac_id` FK. Cash/bank movements are handled by PV, BPR, CE, PCDV.

**Creates:** Whatever the Dr/Cr lines specify. **Settles:** Whatever the Dr/Cr lines specify.

---

### 1.9 Contra Entry — Approval

**Business event:** Fund transfer between Bank/Cash accounts. Pure money movement — no expense, no revenue, no vendor, no customer.
**Source:** `ContraEntryMaster`, `ContraEntryLine`
**Trigger:** `approve_contra_entry()` (`contra_entry/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | BankCash (receiving) | `line.account_id` FK WHERE `dr_cr = "Dr"` | `line.debit_amount` | Per line |
| Cr | BankCash (paying) | `line.account_id` FK WHERE `dr_cr = "Cr"` | `line.credit_amount` | Per line |

**Verify:** `total_debit == total_credit` (validated at creation, `contra_entry/service.py:125-126`)

**No CC-codes, no vendors, no customers, no GST.** Contra Entry only affects BankCash accounts.

The `opening_balance`/`closing_balance` on lines are display-time snapshots, not authoritative balances.

**Creates:** Nothing new. **Settles:** Nothing. **Moves:** Funds between bank/cash accounts.

---

### 1.10 Debit Note — Approval

**Business event:** Claim against vendor to reduce amount payable. Linked to purchase side via BRR (nullable).
**Source:** `DebitNoteMaster`, `DebitNoteItem`, `DebitNoteGst`
**Trigger:** `approve_debit_note()` (`debit_note/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Vendor payable | `master.vendor_id` FK (nullable) | `master.total_amount` | `basic + gst` |
| Cr | CC-code (expense reversal) | `item.cc_code` (STRING) | `item.basic_amount` | Per item |
| Cr | GST Input reversal (see §5) | `gst.gst_type` WHERE `is_selected=True` | `gst.gst_amount` | `basic_total × percent / 100` |

**Verify:** `Σ Dr = Σ Cr = total_amount`

**`brr_id` is NULLABLE** — a Debit Note can exist standalone without a BRR link.
**`vendor_id` is NULLABLE** — but in practice should always be set for the posting to work.

**Creates:** Nothing new. **Settles/Reverses:** Vendor payable + original expense + GST input credit.

---

### 1.11 Credit Note — Approval

**Business event:** Credit issued to customer (debtor) to reduce outstanding receivable. Linked to SaleBill via `sale_bill_id`.
**Source:** `CreditNoteMaster`, `CreditNoteItem`, `CreditNoteGst`
**Trigger:** `approve_credit_note()` (`credit_note/service.py:408`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | Revenue/CC-code reversal | `item.cc_code` (STRING) | `item.basic_amount` | Per item |
| Dr | GST Output reversal (see §5) | `gst.gst_type` WHERE `is_selected=True` | `gst.gst_amount` | `basic_total × percent / 100` |
| Cr | Customer receivable | `master.vendor_id` FK (= debtor, `is_debtor=True`) | `master.total_amount` | `basic + gst` |

**Verify:** `Σ Dr = Σ Cr = total_amount`

**`vendor_id` on CreditNote IS the customer.** The CN sale bill picker uses `debtor_id` from OgSaleOrder to find the Vendor record. The field name is misleading.

**Creates:** Nothing new. **Settles/Reverses:** Customer receivable + revenue + GST output liability.

---

### 1.12 Petty Cash Docket Voucher — Approval

**Business event:** Small cash/bank disbursement for operational expenses.
**Source:** `PettyCashDocketVoucher`, `PettyCashDocketVoucherDetail`
**Trigger:** `approve_docket_voucher()` (`petty_cash/docket_voucher/service.py`)

| Leg | Account | Reference | Amount | Calculation |
|-----|---------|-----------|--------|-------------|
| Dr | CC-code expense | `detail.cc_code` (STRING) | `detail.amount` | Per detail line |
| Cr | Bank/Cash | `master.bank_cash_id` FK | `master.total_amount` | Sum of detail amounts |

**Verify:** `Σ Dr = Σ Cr = total_amount`

**No GST** — PCDV has no GST fields.
**No vendor** — PCDV has no `vendor_id`.
**`mode_of_payment`** = "Cash"/"Cheque"/"Online"/"NEFT"/"RTGS" — determines the type of bank_cash account used.

**Creates:** New expense + bank/cash outflow. **Settles:** Nothing.

**Triple-posting risk — see §3.4.**

---

<a id="section-2"></a>
## 2. Numerical Accounting Examples

### 2.1 Purchase Bill → Full Payment via BPR

**Scenario:** Purchase of office supplies ₹10,000 + 18% CGST/SGST from Vendor V001.

**Step 1: PB Approved**
- Items: cc_code="CAOP", basic_amount=₹10,000
- GST: CGST 9%=₹900 (selected), SGST 9%=₹900 (selected), IGST 18% (not selected)
- total_invoice_amount = 10,000 + 900 + 900 = ₹11,800

```
Dr  CC[CAOP]           ₹10,000
Dr  GST_INPUT_CGST        ₹900
Dr  GST_INPUT_SGST        ₹900
    Cr  Vendor[V001]   ₹11,800
─────────────────────────────────
Σ Dr = ₹11,800   Σ Cr = ₹11,800  ✓
```

**Step 2: BPR (bill mode) Approved — Full payment, Bank**
- payment_type="bill", vendor_id=V001, bank_ac_id=SBI
- Items: pb_item_id → PB item, booked=10,000, current=10,000
- GST: CGST booked=900, current=900; SGST booked=900, current=900
- total_invoice_amount = ₹11,800

```
Dr  Vendor[V001]       ₹11,800
    Cr  BankCash[SBI]  ₹11,800
─────────────────────────────────
Σ Dr = ₹11,800   Σ Cr = ₹11,800  ✓
```

**Ledger balances after both:**
| Account | Dr | Cr | Net |
|---------|----|----|-----|
| CC[CAOP] | 10,000 | | 10,000 Dr (expense) |
| GST_INPUT_CGST | 900 | | 900 Dr (credit) |
| GST_INPUT_SGST | 900 | | 900 Dr (credit) |
| Vendor[V001] | 11,800 | 11,800 | 0 (settled) ✓ |
| BankCash[SBI] | | 11,800 | 11,800 Cr (outflow) |

---

### 2.2 Purchase Bill → Partial Payment → Second Payment

**Scenario:** PB for ₹10,000 + 18% IGST (inter-state) from Vendor V002. First pay ₹6,000 basic portion, then remaining.

**Step 1: PB Approved**
- total_invoice_amount = 10,000 + 1,800 = ₹11,800

```
Dr  CC[CARM]           ₹10,000
Dr  GST_INPUT_IGST      ₹1,800
    Cr  Vendor[V002]   ₹11,800
```

**Step 2: BPR #1 — Partial (60% of basic)**
- Items: booked=10,000, current=6,000
- GST: IGST booked=1,800, current=1,080 (60%)
- total = 6,000 + 1,080 = ₹7,080

```
Dr  Vendor[V002]       ₹7,080
    Cr  BankCash[SBI]  ₹7,080
```

**After BPR #1:**
- Vendor[V002] net: 11,800 Cr − 7,080 Dr = **₹4,720 Cr** (still owes)
- `_paid_item_map`: {pb_item_id: 6,000}
- `_paid_gst_map`: {IGST: 1,080}
- Remaining: basic 4,000 + GST 720 = ₹4,720

**Step 3: BPR #2 — Remaining**
- Items: booked=10,000, current=4,000 (balance = 10,000 − 6,000)
- GST: IGST booked=1,800, current=720 (balance = 1,800 − 1,080)
- total = 4,000 + 720 = ₹4,720

```
Dr  Vendor[V002]       ₹4,720
    Cr  BankCash[SBI]  ₹4,720
```

**Final:** Vendor[V002] net = 0 ✓

---

### 2.3 Two Purchase Bills Paid in One BPR

**Scenario:** PB-A ₹8,000 + 18% IGST = ₹9,440 and PB-B ₹5,000 + 18% IGST = ₹5,900. Same Vendor V003. One combined BPR.

**PB-A Approved:**
```
Dr  CC[CAOP]           ₹8,000
Dr  GST_INPUT_IGST     ₹1,440
    Cr  Vendor[V003]   ₹9,440
```

**PB-B Approved:**
```
Dr  CC[CARM]           ₹5,000
Dr  GST_INPUT_IGST       ₹900
    Cr  Vendor[V003]   ₹5,900
```

**BPR multi-bill payment:**
- purchaseBillIds = [PB-A.id, PB-B.id]
- Items: 2 items with pb_item_id → each PB's item
- GST: "{PB-A.id}:IGST" current=1,440, "{PB-B.id}:IGST" current=900
- total = (8,000 + 5,000) + (1,440 + 900) = ₹15,340

```
Dr  Vendor[V003]        ₹15,340
    Cr  BankCash[HDFC]  ₹15,340
```

**Final Vendor[V003]:** (9,440 + 5,900) Cr − 15,340 Dr = 0 ✓

---

### 2.4 Payment Voucher — Direct Expense Payment

**Scenario:** Consultant fee ₹5,000 + 18% CGST/SGST, paid directly via PV to Vendor V004 from HDFC bank.

```
Dr  CC[CLCP]             ₹5,000   (consultancy expense)
Dr  GST_INPUT_CGST         ₹450
Dr  GST_INPUT_SGST         ₹450
    Cr  BankCash[HDFC]   ₹5,900
─────────────────────────────────
Σ Dr = ₹5,900   Σ Cr = ₹5,900  ✓
```

**No vendor sub-ledger entry.** PV is a self-contained expense+payment. Vendor V004 is informational metadata, not an accounting party in this transaction.

---

### 2.5 Journal Entry → BPR Voucher Settlement

**Scenario:** JE (new_voucher) books ₹20,000 expense with vendor payable. BPR-voucher settles it.

**Step 1: JE Approved**
```
Dr  CC[CAOP]           ₹20,000   (line: account_type="CC", dr_cr="Dr")
    Cr  Vendor[V005]   ₹20,000   (line: account_type="Vendor", dr_cr="Cr")
```

**Step 2: BPR (voucher mode) Approved**
- payment_type="voucher", journal_entry_id=JE.id, vendor_id=V005
- Items: je_line_id → JE Dr line, booked=20,000, current=20,000
- GST: none (voucher mode gst_amount=0)
- total = ₹20,000

```
Dr  Vendor[V005]        ₹20,000
    Cr  BankCash[SBI]   ₹20,000
```

**Final Vendor[V005]:** 20,000 Cr − 20,000 Dr = 0 ✓
**Expense CC[CAOP]:** 20,000 Dr (unchanged — was booked by JE, not by BPR) ✓

---

### 2.6 Sale Bill → Full Receipt via SRB

**Scenario:** Sale invoice ₹50,000 + 18% CGST/SGST to Customer D001 (Vendor with is_debtor=True). Full receipt.

**Step 1: SaleBill Approved**
```
Dr  Customer[D001]       ₹59,000   (via og_so.debtor_id)
    Cr  Revenue[CRIN]    ₹50,000
    Cr  GST_OUTPUT_CGST   ₹4,500
    Cr  GST_OUTPUT_SGST   ₹4,500
```

**Step 2: SaleReceipt Created** — NO posting (header only).

**Step 3: SRB Approved**
- invoice_no = SB's sale_bill_no
- Items: cc_code="CRIN", booked=50,000, received=0, balance=50,000, current=50,000
- GST: CGST booked=4,500, current=4,500; SGST booked=4,500, current=4,500
- total_invoice_amount = 50,000 + 4,500 + 4,500 = ₹59,000
- Bank from parent: receipt.bank_ac_id = SBI

```
Dr  BankCash[SBI]        ₹59,000
    Cr  Customer[D001]   ₹59,000
```

**Final:**
| Account | Dr | Cr | Net |
|---------|----|----|-----|
| Customer[D001] | 59,000 | 59,000 | 0 (settled) ✓ |
| Revenue[CRIN] | | 50,000 | 50,000 Cr (income) |
| GST_OUTPUT_CGST | | 4,500 | 4,500 Cr (liability) |
| GST_OUTPUT_SGST | | 4,500 | 4,500 Cr (liability) |
| BankCash[SBI] | 59,000 | | 59,000 Dr (inflow) |

---

### 2.7 Sale Bill → Partial Receipt → Credit Note → Final Receipt

**Scenario:** SB ₹50,000 + 18% IGST to Customer D002. Partial receipt ₹29,500. Then Credit Note ₹10,000. Then final receipt.

**Step 1: SB Approved**
```
Dr  Customer[D002]       ₹59,000
    Cr  Revenue[CRIN]    ₹50,000
    Cr  GST_OUTPUT_IGST   ₹9,000
```

**Step 2: SRB #1 Approved — Partial (₹25,000 basic + ₹4,500 GST)**
```
Dr  BankCash[SBI]        ₹29,500
    Cr  Customer[D002]   ₹29,500
```

Customer[D002] after: 59,000 − 29,500 = **₹29,500 Dr** (still owes)

**Step 3: CN Approved — ₹10,000 + 18% IGST = ₹11,800**
- vendor_id = D002 (the debtor)
- Items: cc_code="CRIN", basic=10,000
- GST: IGST gst_amount=1,800 (selected)

```
Dr  Revenue[CRIN]          ₹10,000   (sales return)
Dr  GST_OUTPUT_IGST         ₹1,800   (reverse output)
    Cr  Customer[D002]     ₹11,800   (reduce receivable)
```

Customer[D002] after: 29,500 − 11,800 = **₹17,700 Dr** (remaining)

**Step 4: SRB #2 Approved — Remaining ₹17,700**
```
Dr  BankCash[SBI]        ₹17,700
    Cr  Customer[D002]   ₹17,700
```

**Final Customer[D002]:** 59,000 Dr − 29,500 Cr − 11,800 Cr − 17,700 Cr = **0** ✓

**Known Gap:** The SRB picker (`get_details_by_invoice_no`) does NOT deduct CN amounts from the available balance. It would show booked=50,000, received=25,000, balance=25,000 — not accounting for the CN reduction. The user must manually enter ₹17,700 (not ₹25,000) to avoid over-collection.

---

### 2.8 Contra Entry — Bank-to-Bank Transfer

**Scenario:** Transfer ₹50,000 from SBI (Bank) to Petty Cash (Cash).

```
Dr  BankCash[PettyCash]   ₹50,000   (line: dr_cr="Dr", account_id=PettyCash)
    Cr  BankCash[SBI]     ₹50,000   (line: dr_cr="Cr", account_id=SBI)
─────────────────────────────────
Σ Dr = ₹50,000   Σ Cr = ₹50,000  ✓
```

---

### 2.9 Debit Note — Goods Return to Vendor

**Scenario:** Return goods worth ₹3,000 + 18% CGST/SGST to Vendor V001 (original PB was CC[CARM]).

```
Dr  Vendor[V001]          ₹3,540
    Cr  CC[CARM]          ₹3,000   (expense reversal)
    Cr  GST_INPUT_CGST      ₹270   (input credit reversal)
    Cr  GST_INPUT_SGST      ₹270   (input credit reversal)
─────────────────────────────────
Σ Dr = ₹3,540   Σ Cr = ₹3,540  ✓
```

---

### 2.10 Petty Cash — Office Supplies

**Scenario:** ₹2,000 for stationery from petty cash fund.

```
Dr  CC[CAOP]                 ₹2,000
    Cr  BankCash[PettyCash]  ₹2,000
─────────────────────────────────
Σ Dr = ₹2,000   Σ Cr = ₹2,000  ✓
```

---

<a id="section-3"></a>
## 3. Duplicate Accounting Analysis

### 3.1 PV vs PB: Can the Same Expense Be Posted Twice?

**Risk:** A user creates a PV (direct expense+payment) AND a PB (expense+liability) for the same vendor and CC-code. Both approved = expense doubled.

**System prevention:** None. PV and PB have no cross-reference.
**Conclusion:** Business process risk. Mitigation: SOPs + reconciliation reports flagging same-vendor, same-CC, same-date from both modules.

### 3.2 BPR (bill mode) and GST: Does BPR Re-Recognize GST?

If PB posts `Dr GST_INPUT` and BPR also posts `Dr GST_INPUT`, input credit is doubled.

**Correct treatment:** BPR (bill mode) posts ONLY `Dr Vendor, Cr Bank`. No GST leg. The `BillPaymentReceiptGst.current_amount` tracks cash-flow paid GST — not accounting recognition.

**If business prefers cash-basis GST (D3):** Then PB does NOT post GST, and BPR does. Cannot be both.

### 3.3 BPR (voucher mode) and JE: Is the Expense Duplicated?

**No.** JE: `Dr CC-code, Cr Vendor`. BPR-voucher: `Dr Vendor, Cr Bank`. Two different events. CC-code debit appears only in JE. Vendor settles to zero.

### 3.4 PCDV → PCJV → JE (bulk_docket): Triple-Posting Risk

**Flow:** PCDV approved → PettyCashJournalVoucher (PCJV) aggregates approved dockets → JE (bulk_docket mode) created from PCJVs → `linked_journal_id` set on PCJV records.

If both PCDV and JE(bulk_docket) post, expense is counted twice:
- PCDV: `Dr CC-code, Cr BankCash`
- JE: `Dr CC-code, Cr Vendor` (or similar)

**Resolution:** Post PCDV on approval. **Skip** JE where `entry_mode = "bulk_docket"`.

Rationale: PCDV is the source cash event with the `bank_cash_id` for the Cr leg. The JE bulk_docket is a formalization step. Not all PCDVs get journalized — skipping PCDV posting would lose unaggregated expenses.

### 3.5 JE (adjustment mode) vs DN/CN: Correction Overlap

An adjustment JE (`ref_bill_type` set) and a DN/CN against the same bill both make corrections. If both exist, correction is doubled.

**Resolution:** Post both (legitimate documents). Reconciliation report should flag same `ref_bill_id` referenced by both an adjustment JE and a DN/CN.

### 3.6 SaleReceipt Parent + SRB Child

**No risk** — SaleReceipt parent is excluded from posting (no workflow, no trigger).

### 3.7 Multiple BPRs Exceeding PB Amount

No DB constraint prevents overpayment. Mitigation: posting engine validates `Σ paid ≤ PB.total_invoice_amount`.

---

<a id="section-4"></a>
## 4. Party and Account Identity Validation

### 4.1 Vendor.is_debtor Reliability

Set at creation via `generate_ledger_code(is_debtor)`. Creditors: 260001+. Debtors: 270001+. Immutable in practice. Sufficient for posting.

### 4.2 Customer Identity Across Sale-Side Modules

| Module | Customer Field | How to Resolve |
|--------|---------------|----------------|
| SaleBill | None directly | `sale_order_id` → `OgSaleOrder.debtor_id` → Vendor(is_debtor=True) |
| SaleReceipt | None | N/A — no posting |
| SaleReceiptBilling | None directly | `og_sale_order_id` → `OgSaleOrder.debtor_id` → Vendor(is_debtor=True) |
| CreditNote | `vendor_id` FK | Direct — Vendor(is_debtor=True) |

**If `sale_order_id` is NULL:** Post to generic "Sundry Debtors" control account. Log warning.

### 4.3 JE customer_ref — Free-Text Problem

`customer_ref` is String(300), no FK. Resolution for posting:
1. Attempt match against `Vendor.ledger_name` or `Vendor.ledger_code` WHERE `is_debtor=True`
2. If matched → `party_id = vendor.id`
3. If not matched → `party_ref = customer_ref` (unstructured). Warning logged.

### 4.4 CC-Code STRING vs FK

| Module | Field | Type |
|--------|-------|------|
| JournalEntryLine | `cc_id` | FK ✓ |
| PaymentVoucherItem | `cc_code_id` | FK ✓ |
| PurchaseBillItem | `cc_code` | STRING ⚠ |
| SaleBillItem | `cc_code` | STRING ⚠ |
| DebitNoteItem | `cc_code` | STRING ⚠ |
| CreditNoteItem | `cc_code` | STRING ⚠ |
| PettyCashDocketVoucherDetail | `cc_code` | STRING ⚠ |
| BillPaymentReceiptItem | `cc_code` | STRING — informational |

For STRING fields: look up `CCCode` by `upper(cc_code)`. If not found → **FAIL posting** with clear error.

---

<a id="section-5"></a>
## 5. GST Treatment Validation

### 5.1 GST Input — Purchase Side

| Event | Accrual (recommended) | Cash basis (alternative) |
|-------|----------------------|-------------------------|
| PB Approved | Dr GST_INPUT_{type} | No GST posting |
| BPR Approved | No GST posting | Dr GST_INPUT_{type} |
| PV Approved | Dr GST_INPUT_{type} | Dr GST_INPUT_{type} (PV is always cash) |
| DN Approved | Cr GST_INPUT_{type} (reversal) | Cr GST_INPUT_{type} (reversal) |

**Current BS uses cash basis** (BPR GST). Indian GST law supports accrual (ITC on invoice receipt). **Decision D3.**

### 5.2 GST Output — Sale Side

| Event | Posting |
|-------|---------|
| SB Approved | Cr GST_OUTPUT_{type} (liability on supply) |
| SRB Approved | No GST posting (settles receivable, not GST) |
| CN Approved | Dr GST_OUTPUT_{type} (reversal) |

Already accrual-basis in current BS. Correct.

### 5.3 IGST vs CGST+SGST

Controlled by `is_selected` flag on each GST sub-table. Post only selected types.

Multi-bill BPR: GST type format `"{bill_id}:IGST"` — strip prefix: `gst_type.split(":")[-1].upper()`.

### 5.4 PV GST — User-Specified Amounts

PV GST uses `current_amount` (user-entered), not recalculated. Use as-is for posting.

### 5.5 Existing BS GST Gaps

Current `_gst_output_net()` does NOT include:
- CreditNote GST output reversals
- DebitNote GST input reversals
- SaleReceiptBilling GST (correct — shouldn't be included)
- PurchaseBill GST input (if accrual basis is chosen)

The centralised ledger fixes all of these.

### 5.6 GST Account Summary

| Account | Normal Balance | Increased By | Decreased By |
|---------|---------------|-------------|-------------|
| GST_INPUT_IGST | Debit (asset) | PB, PV approval | DN approval |
| GST_INPUT_CGST | Debit (asset) | PB, PV approval | DN approval |
| GST_INPUT_SGST | Debit (asset) | PB, PV approval | DN approval |
| GST_OUTPUT_IGST | Credit (liability) | SB approval | CN approval |
| GST_OUTPUT_CGST | Credit (liability) | SB approval | CN approval |
| GST_OUTPUT_SGST | Credit (liability) | SB approval | CN approval |

---

<a id="section-6"></a>
## 6. Historical Posting and Reconciliation Strategy

### 6.1 Risks

**A. JEs that mirror source documents:** The existing BS reads ALL CC-code balances from JE. If the ledger ALSO posts from source documents, and those have corresponding manual JEs, CC-code balances double.

**B. bulk_docket JEs duplicate PCDV expenses.** (§3.4)

**C. adjustment JEs may overlap with DN/CN.** (§3.5)

**D. Deleted records:** Documents with `status = "Deleted"` must NOT be posted.

**E. Missing data:** NULL `sale_order_id`, NULL `vendor_id` on DN, invalid cc_code strings.

### 6.2 Safe Migration Strategy

**Phase A: Pre-posting analysis**
1. Count approved+active documents per module
2. Identify bulk_docket JEs to exclude
3. Identify adjustment JEs for overlap checking
4. Check for orphaned records (BPR referencing deleted PB, SRB with deleted parent)
5. Check for NULL required fields
6. Identify manual JEs that might mirror source documents (same vendor, amount, date)

**Phase B: Post in dependency order**
1. JE (`new_voucher` and `adjustment` only) — current accounting backbone
2. Purchase Bills — create vendor liabilities
3. Sale Bills — create customer receivables
4. Payment Vouchers — standalone expense+payment
5. Petty Cash Docket Vouchers — standalone expense+payment
6. Bill Payment Receipts — settle PB/JE liabilities
7. Sale Receipt Billings — settle SB receivables
8. Debit Notes — reduce vendor payables
9. Credit Notes — reduce customer receivables
10. Contra Entries — bank transfers

**SKIP:** JE with `entry_mode = "bulk_docket"`

**Phase C: Reconciliation** — run all tests from §11.

### 6.3 The JE Problem — Critical Decision

**Strategy 1 (Recommended):** Post source documents + post JEs (except bulk_docket). Accept that some CC-code balances may be doubled where manual JEs mirror source documents. Identify these in Phase A and tag them for exclusion or review.

**Strategy 2:** Post ONLY JEs, skip source documents. Reproduces current behavior but loses bank/cash legs and misses non-journalized transactions.

**Strategy 3:** Post source documents ONLY, skip all JEs. Loses standalone JE-only transactions (manual adjustments).

**Decision D6:** Confirm Strategy 1.

---

<a id="section-7"></a>
## 7. Technical Implementation Consistency

### 7.1 Atomicity

Replace `db.session.commit()` with `db.session.flush()` → `post_document()` → `db.session.commit()`. If posting fails, entire transaction rolls back. Document stays Pending.

### 7.2 Idempotency

Application-level: query for existing entry before creating.
DB-level: partial unique index `(source_type, source_id) WHERE is_reversal = FALSE`.

### 7.3 Concurrency

Add `SELECT ... FOR UPDATE` (`XxxMaster.query.with_for_update().get(xxx_id)`) to serialize concurrent approvals.

### 7.4 Partial Failure

Rollback reverts all changes. Document stays Pending. User retries after fix.

### 7.5 Post-Approval Edits

All modules set `locked = True` on approval. Edit functions check `if doc.locked`. Approved documents cannot be edited.

### 7.6 Parent-Child (SaleReceipt)

SRB reads bank_ac_id from parent at posting time. Once posted, ledger entry is immutable. If parent changes later, only new SRBs are affected.

### 7.7 Unique Index and Reversals

Partial index `WHERE is_reversal = FALSE` allows one non-reversal entry per source and unlimited reversals. For Phase 1 (no cancellation), this is sufficient. Revisit if D4 changes.

---

<a id="section-8"></a>
## 8. Confirmed Rules vs Unresolved Decisions

### Confirmed Rules (C1–C15)

| Rule | Description |
|------|-------------|
| C1 | PB posts: Dr CC-codes + Dr GST_INPUT, Cr Vendor |
| C2 | BPR(bill) posts: Dr Vendor, Cr Bank/Cash. No expense. No GST. |
| C3 | BPR(voucher) posts: Dr Vendor, Cr Bank/Cash. No CC-code re-posting. |
| C4 | PV posts: Dr CC-codes + Dr GST_INPUT, Cr Bank/Cash. No vendor sub-ledger. |
| C5 | SB posts: Dr Customer, Cr CC-codes + Cr GST_OUTPUT. Customer via OgSaleOrder.debtor_id. |
| C6 | SaleReceipt parent: NO posting. |
| C7 | SRB posts: Dr Bank/Cash, Cr Customer. Bank/Cash from parent. No GST. |
| C8 | CN posts: Dr CC-codes + Dr GST_OUTPUT, Cr Customer. Customer via vendor_id. |
| C9 | DN posts: Dr Vendor, Cr CC-codes + Cr GST_INPUT. |
| C10 | CE posts: Dr BankCash(receiving), Cr BankCash(paying). Nothing else. |
| C11 | PCDV posts: Dr CC-codes, Cr BankCash. No GST. No vendor. |
| C12 | JE(bulk_docket) EXCLUDED from posting — PCDV is the source. |
| C13 | Reback only from Pending. No reversal needed. |
| C14 | Approved documents are locked. Cannot be edited after approval. |
| C15 | Every entry: total_debit == total_credit. Discount/round_off use balancing legs. |

### Unresolved Decisions (D1–D8)

| # | Decision | Recommendation |
|---|----------|---------------|
| D1 | PV vendor sub-ledger: advance or direct expense? | Direct expense (no advance tracking exists) |
| D2 | Customer model: separate or Vendor(is_debtor)? | Continue Vendor(is_debtor). Optionally add debtor_id FK to SaleBill/SRB. |
| D3 | GST input timing: accrual (PB) or cash (BPR)? | Accrual (correct per GST law) |
| D4 | Can approved documents be cancelled? | No (Phase 1). Corrections via DN/CN/JE. |
| D5 | SRB bank_ac_id: inherit or copy from parent? | Copy at creation (schema change needed) |
| D6 | Historical posting: which JEs to include? | Strategy 1: all except bulk_docket, with duplicate review |
| D7 | Unbalanced JEs: accept or reject? | Reject at posting time. Flag existing ones. |
| D8 | Discount/round-off: which accounts? | Create system accounts DISC_RECEIVED, ROUND_OFF |

---

<a id="section-9"></a>
## 9. Corrected Central Ledger Model

### AccountingLedger (Header)

```python
class AccountingLedger(db.Model):
    __tablename__ = "accounting_ledger"

    id            = db.Column(db.Integer, primary_key=True)
    voucher_no    = db.Column(db.String(50), nullable=False, unique=True)
    posting_date  = db.Column(db.Date, nullable=False)

    source_type   = db.Column(db.String(50), nullable=False)
    source_id     = db.Column(db.Integer, nullable=False)
    is_reversal   = db.Column(db.Boolean, default=False)

    project_code  = db.Column(db.String(50), db.ForeignKey("projects.project_code"), nullable=False)

    total_debit   = db.Column(db.Numeric(15, 2), nullable=False)
    total_credit  = db.Column(db.Numeric(15, 2), nullable=False)

    narration     = db.Column(db.Text, nullable=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    created_by    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    lines = db.relationship("AccountingLedgerLine", backref="ledger",
                            cascade="all,delete-orphan",
                            order_by="AccountingLedgerLine.sl_no")

    __table_args__ = (
        db.CheckConstraint("total_debit = total_credit", name="ck_ledger_balanced"),
        db.Index("uq_ledger_source", "source_type", "source_id",
                 unique=True, postgresql_where=db.text("is_reversal = FALSE")),
    )
```

### AccountingLedgerLine (Detail)

```python
class AccountingLedgerLine(db.Model):
    __tablename__ = "accounting_ledger_lines"

    id          = db.Column(db.Integer, primary_key=True)
    ledger_id   = db.Column(db.Integer, db.ForeignKey("accounting_ledger.id"), nullable=False)
    sl_no       = db.Column(db.Integer, nullable=False)

    account_type = db.Column(db.String(20), nullable=False)
    # "CC" | "BankCash" | "Party" | "GST" | "System"

    cc_code_id          = db.Column(db.Integer, db.ForeignKey("cc_code.id"), nullable=True)
    bank_cash_id        = db.Column(db.Integer, db.ForeignKey("bank_cash.id"), nullable=True)
    party_type          = db.Column(db.String(20), nullable=True)   # "Vendor" | "Customer"
    party_id            = db.Column(db.Integer, nullable=True)
    party_ref           = db.Column(db.String(300), nullable=True)  # JE customer_ref fallback
    gst_account_code    = db.Column(db.String(30), nullable=True)
    system_account_code = db.Column(db.String(30), nullable=True)   # DISC_RECEIVED, ROUND_OFF

    dr_cr    = db.Column(db.String(3), nullable=False)
    amount   = db.Column(db.Numeric(15, 2), nullable=False)

    project_code = db.Column(db.String(50), nullable=False)
    narration    = db.Column(db.Text, nullable=True)

    cc_code   = db.relationship("CCCode", foreign_keys=[cc_code_id])
    bank_cash = db.relationship("BankCash", foreign_keys=[bank_cash_id])

    __table_args__ = (
        db.CheckConstraint("amount > 0", name="ck_line_positive"),
        db.CheckConstraint(
            "(account_type = 'CC' AND cc_code_id IS NOT NULL) OR "
            "(account_type = 'BankCash' AND bank_cash_id IS NOT NULL) OR "
            "(account_type = 'Party' AND (party_id IS NOT NULL OR party_ref IS NOT NULL)) OR "
            "(account_type = 'GST' AND gst_account_code IS NOT NULL) OR "
            "(account_type = 'System' AND system_account_code IS NOT NULL)",
            name="ck_line_account_set"
        ),
    )
```

---

<a id="section-10"></a>
## 10. Safe Implementation Sequence

| Phase | Step | Description |
|-------|------|-------------|
| 0 | 0.1–0.5 | Pre-analysis: count documents, identify duplicate-risk JEs, get D1–D8 decisions |
| 1 | 1.1 | Create schema (accounting_ledger + accounting_ledger_lines + constraints) |
| 1 | 1.2 | Build posting engine with module-specific functions |
| 1 | 1.3 | Build reconciliation report API |
| 1 | 1.4 | Unit test every posting function |
| 2 | 2.1 | Retroactive posting in dependency order (§6.2) |
| 2 | 2.2 | Reconciliation — compare ledger vs current BS/P&L |
| 2 | 2.3 | Document and resolve discrepancies |
| 3 | 3.1 | Modify approve functions (flush + post + commit) |
| 3 | 3.2 | Add SELECT ... FOR UPDATE |
| 3 | 3.3 | Test each module live |
| 4 | 4.1 | Build ledger-based reports (parallel to existing) |
| 4 | 4.2 | Compare new vs old reports |
| 4 | 4.3 | Switch to ledger-based reports |
| 5 | 5.1 | FinancialYear model + year-end closing (future) |

---

<a id="section-11"></a>
## 11. Regression Test Cases

### A: Posting Correctness (13 cases)

| # | Test | Expected |
|---|------|----------|
| A1 | PB ₹10K + CGST ₹900 + SGST ₹900 | Dr CC 10K + Dr GST_CGST 900 + Dr GST_SGST 900, Cr Vendor 11,800 |
| A2 | PV ₹5K + IGST ₹900, Bank | Dr CC 5K + Dr GST_IGST 900, Cr Bank 5,900 |
| A3 | BPR(bill) full ₹11,800 | Dr Vendor 11,800, Cr Bank 11,800. No GST. |
| A4 | BPR(bill) partial ₹5,900 | Dr Vendor 5,900, Cr Bank 5,900 |
| A5 | BPR(voucher) ₹20K | Dr Vendor 20K, Cr Bank 20K |
| A6 | SB ₹50K + IGST ₹9K | Dr Customer 59K, Cr CC 50K + Cr GST_IGST 9K |
| A7 | SRB full ₹59K | Dr Bank 59K, Cr Customer 59K |
| A8 | SRB partial ₹29.5K | Dr Bank 29.5K, Cr Customer 29.5K |
| A9 | CN ₹10K + IGST ₹1,800 | Dr CC 10K + Dr GST_OUTPUT_IGST 1,800, Cr Customer 11,800 |
| A10 | DN ₹3K + CGST ₹270 + SGST ₹270 | Dr Vendor 3,540, Cr CC 3K + Cr GST_CGST 270 + Cr GST_SGST 270 |
| A11 | CE transfer ₹50K | Dr BankCash[target] 50K, Cr BankCash[source] 50K |
| A12 | JE Dr CC 5K, Cr Vendor 5K | Mirrors JE lines |
| A13 | PCDV ₹2K | Dr CC 2K, Cr BankCash 2K |

### B: Duplicate Prevention (5 cases)

| # | Test | Expected |
|---|------|----------|
| B1 | Same PB approved twice (concurrent) | Second fails (status check) |
| B2 | Retry after rollback | Succeeds (no orphaned ledger entry) |
| B3 | JE(bulk_docket) approved | NO ledger entry (C12) |
| B4 | PB then BPR(bill) | Two entries, no expense duplication |
| B5 | SB then SRB | Two entries, no revenue duplication |

### C: Balance Validation (6 cases)

| # | Test | Expected |
|---|------|----------|
| C1 | Every entry | total_debit == total_credit |
| C2 | PB + full BPR | Vendor net = 0 |
| C3 | SB + full SRB | Customer net = 0 |
| C4 | SB + CN + SRB remaining | Customer net = 0 |
| C5 | PB + partial DN | Vendor balance reduced |
| C6 | CE transfer | Source bank −, target bank + |

### D: Edge Cases (7 cases)

| # | Test | Expected |
|---|------|----------|
| D1 | PB with discount ₹500 | Balancing leg to DISC_RECEIVED |
| D2 | SB with NULL sale_order_id | Posts to generic Sundry Debtors. Warning. |
| D3 | Invalid cc_code string | Posting FAILS. Document stays Pending. |
| D4 | Unbalanced JE (Dr only) | Posting FAILS. Error. |
| D5 | Multi-bill BPR with prefixed GST | Parsed correctly |
| D6 | PCDV with NULL bank_cash_id | Posting FAILS |
| D7 | SRB with deleted parent | Posting FAILS |

### E: Existing Report Reconciliation (7 cases)

| # | Test | Expected |
|---|------|----------|
| E1 | BS CC-code balances | Match current `_journal_balance()` (for JE-sourced entries) |
| E2 | BS bank balances | Ledger ≥ current (includes SaleReceipt + CE) |
| E3 | BS GST output | Ledger = SB GST − CN GST (more accurate) |
| E4 | BS GST input | Depends on D3 |
| E5 | BS sundry debtors | Ledger = SB − SRB − CN (more accurate) |
| E6 | P&L income | Match current OgSaleOrder-based calc |
| E7 | P&L expenses | Match current budget-based calc |

---

## Known Gaps in Existing Reports (Ledger Will Fix)

| Gap | Current BS | Ledger |
|-----|-----------|--------|
| Bank balance | PV + BPR only | All bank-touching modules |
| Cash balance | PCDV only (one-directional) | All cash movements |
| Sundry debtors | SB − SaleReceipt.total_amount (no workflow) | SB − approved SRB − CN |
| GST output | SaleBillGst only | SaleBillGst − CreditNoteGst |
| GST input | BillPaymentReceiptGst (cash basis) | PurchaseBillGst − DebitNoteGst (accrual) |
| Contra entries | NOT in bank balance | Included |

---

*End of Final Posting Validation Document*
