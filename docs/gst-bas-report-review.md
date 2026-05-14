# GST / BAS Report — Accountant Review Request

**Project:** Uniform Online Order System (uniformorder.online)  
**Prepared by:** Engineering team  
**Date:** 2026-05-15  
**Purpose:** Please review the calculations below and confirm they are correct for GST reporting and BAS lodgement. If anything is wrong or needs adjustment, note it and we will update the code.

---

## Context

This is a SaaS platform that processes uniform orders on behalf of Australian schools. Each school is an operator (they receive the Stripe payouts). The platform facilitates payments — it does not collect the GST itself, each school does.

The Reports page (`/admin/<tenant>/reports`) shows a monthly GST summary table that school operators use to reconcile their BAS. There is also a CSV export button.

---

## Calculation Logic

### 1. Gross sales

Each order stores a `total` column in **cents** (integer), representing the GST-inclusive amount the parent paid (e.g. `2750` = $27.50). This is the Stripe `amount` field — what actually hit the parent's card.

Monthly gross = sum of all `total` values for completed orders in that calendar month (Sydney timezone), converted to dollars.

### 2. GST collected

Each order also stores a `gst` column in **cents**, calculated at order-placement time as:

```
gst = round(total / 11)
```

This is the standard Australian formula: GST = 1/11 of the GST-inclusive price.

**Example:** Order total $27.50 → GST = $27.50 / 11 = **$2.50**

Monthly GST = sum of all `gst` values for the same set of orders.

**Question for accountant:** Is `round(total / 11)` the correct rounding rule? Should it be floor, ceiling, or standard rounding (round half up)? The ATO uses "nearest cent" (standard round-half-up) — please confirm.

### 3. Net (ex-GST)

```
net = gross - gst
```

This is the revenue before GST — the figure a school would report as their G1 (total sales) on the BAS.

**Question for accountant:** Should the G1 figure on the BAS be the gross (GST-inclusive) amount, or the net (ex-GST) amount? The reports page labels the ex-GST column as "Net (ex-GST)" — is this the right input for G1?

### 4. Stripe fees (estimated)

The platform estimates Stripe processing fees to show operators their approximate net payout. This is **informational only** — it does not affect the GST or BAS figures.

Current estimate formula (Stripe AU standard rate as of 2026):

```
stripe_fee = gross × 0.017 + $0.30  (i.e. 1.7% + 30¢ per transaction)
```

This is applied at the monthly aggregate level (not per transaction), which is an approximation.

**Question for accountant:** Are Stripe fees GST-exclusive or GST-inclusive from the school's perspective? (Stripe charges 10% GST on their fees for Australian businesses.) Should the platform show the Stripe fee as a GST-exclusive figure and add a note that the school can claim the GST portion as an input tax credit?

### 5. Net payout

```
payout = net - stripe_fees
```

This is the estimated amount the school receives in their bank account after GST and Stripe fees. It is approximate because:
- Stripe fees are estimated (actual rate may differ if the school has a negotiated rate)
- Stripe payouts may cross month boundaries (a December order may pay out in January)

**Question for accountant:** Is it acceptable to show this as an estimate with a disclaimer, or does the BAS report need to reconcile against actual Stripe payouts?

---

## What the CSV export contains

The "Export CSV" button on the Reports page downloads a file with these columns:

| Column | Description |
|---|---|
| Period | Month label (e.g. "May 2026") |
| Gross sales | GST-inclusive total for the month ($) |
| GST collected | 1/11 of gross ($) |
| Net (ex-GST) | Gross minus GST ($) |
| Stripe fees | Estimated processing fees ($) |
| Net payout | Net minus Stripe fees ($) |

---

## Summary of questions

1. Is `round(total / 11)` the correct rounding rule for GST (should it be floor, ceiling, or standard round-half-up)?
2. For BAS G1, should the school report the **gross** (GST-inclusive) or **net** (ex-GST) figure?
3. Should Stripe fees be shown GST-exclusive with a note about input tax credits?
4. Is it acceptable to show net payout as an estimate, or does it need to reconcile against actual Stripe disbursements?

---

*Please annotate or reply with any corrections. Once confirmed, this document will be marked as reviewed and the §3.6 backlog item will be closed.*
