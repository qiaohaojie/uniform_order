# Plan: P&C preloved uniform shop (donation first)

**Status:** Phase 1 approved (donation-only). Do not implement until asked to build.  
**Date:** 2026-09-06  
**Decided:** 2026-09-06 — George chose **A**: donation-only rack first. Consignment stays Phase 2. C2C marketplace is out.  
**Research:** [research-australian-second-hand-uniform-trading.md](./research-australian-second-hand-uniform-trading.md)  
**Mode:** copy the common Australian school-shop practice. Do not invent a marketplace.

UniformOrder already sells **new** uniforms for a school / P&C (seller of record, Stripe Connect, pickup Kanban). The common second-hand practice in that same shop is a **preloved rack**: parents donate washed current-uniform items; volunteers inspect, price, and sell; other parents buy and collect at the shop.

That is the feature. Not Facebook. Not Rethread. Not swap credits.

---

## 1. Goal

Let a UniformOrder tenant run the second-hand half of a real Australian uniform shop:

1. Parents **donate** outgrown current-uniform items at the shop.
2. Operators **accept, price, and list** those items.
3. Other parents **buy preloved next to new** in the same catalogue and the same cart.
4. Operators **pick and hand over** on the existing Kanban.
5. Optional later: **consignment** (parent gets a cut) for schools that still use paper consignment forms.

Success looks like Manly / PLC / Vardys Road, on the existing shop: a preloved section, a donation drop-off note, a volunteer intake list, and paid preloved lines on the same order as a new polo.

---

## 2. Non-goals

Do **not** build:

- Parent-to-parent listings, chat, or “meet at the gate”
- Parent-set prices on shop stock
- Escrow / hold-until-handover payments
- Cross-school search
- Swap credits, token balances, or garment-for-garment matching
- A competing C2C network (Rethread, KidKit, UniformHub, The Uniform Exchange, Facebook groups already do that)
- Automatic GST-free treatment for every tenant
- A blanket “no refunds on second-hand” policy that fights ACL

Parents who want to sell privately keep using Facebook or a C2C site. UniformOrder’s job is the **shop**.

---

## 3. The model we copy

Source detail and citations live in the research note. The operating loop is:

```text
Parent washes current uniform
  -> drops bag at shop / reception (donation by default)
  -> operator inspects against the school’s accept list
  -> accepted items are priced from the preloved price list (typically ≤ 50% of new)
  -> listed in the shop as Preloved, with qty
  -> another parent buys in the same cart as new stock
  -> pay Stripe to the school’s Connect account
  -> pick from the existing Kanban, collect at the uniform shop
  -> unsold after the hold period (default 12 months) is written off to charity
```

Consignment is the same loop plus: a signed form, a ticket on the garment, a commission split, and a payout batch. It is Phase 2 because several schools (PLC Sydney) dropped it as too much volunteer work, and because GST treatment is different (a consignment is not a gift).

### Tenant switch

| Setting | Default | Meaning |
|---|---|---|
| Preloved shop | off | Tenant opts in |
| Intake mode | `donation_only` | Phase 1 |
| Intake mode | `donation_and_consignment` | Phase 2 |
| Max price vs new | 50% | Soft warning in admin, not a hard legal cap |
| Hold period | 12 months | Then charity / write-off |
| Commission | 50% to shop | Phase 2; inspected shops also use 25%, 30%+$2, 40% |
| GST on donated preloved | tenant-declared | Accountant confirms s 38-255 applies |
| Refuse list | socks, swimwear, hats | Editable |

---

## 4. Parent journeys

### 4.1 Buy preloved (Phase 1)

Same mobile shop as today (`/[tenant]`).

1. Catalogue gains a **Preloved** filter next to Summer / Winter / Sports / Formal / Bags / Stationery. Preloved cards also appear under the matching garment category with a “Preloved” badge.
2. Card shows size, price, remaining qty, condition band (Good / Fair). Optional one photo of the actual garment; if none, reuse the new-item vector.
3. Item page: condition, known defects, “sold as worn”, ACL sentence, qty limited to stock on hand.
4. Add to cart with new items. Mixed cart is allowed and expected (“buy before you buy new”).
5. Checkout, pay, collect — existing pickup flow. Pick slip marks preloved lines so the volunteer takes from the preloved rack, not new stock.

Empty state: “No preloved in this size right now. Donate outgrown items, or buy new.” Link to donation instructions.

### 4.2 Donate (Phase 1)

Parents do **not** photograph and list. They drop a bag. The product only explains how.

New page `/{tenant}/preloved/donate` (linked from catalogue and from the shop footer):

- What to bring: current uniform, washed, no stains/holes, name labels out.
- What not to bring: default refuse list.
- Where and when: reuse `tenants.shopHours`, `tenants.address`, `tenants.collectionInstructions`. Name the unattended box if the school has one (office hallway, reception tub) — that is how Manly and West Pymble take donations between stall days.
- What happens to rejects: charity or textile recycling (WornUp / H&M-style), not returned as a matter of course.
- Optional: “I am dropping off a donation” note (name, student, bag count) so the operator expects a bag. This is a message, not a listing.

No payment. No photos required from the parent.

### 4.3 Consign (Phase 2 only)

Digital version of the Tara / CCGS paper form:

- Family name, student, email, mobile
- Bank BSB/account **or** “credit school fees” **or** “donate proceeds to the P&C”
- Item list (garment, size)
- Unsold preference: donate to charity / collect within 14 days of expiry
- Agree to shop terms

Parent still **drops the bag**. The form only replaces the PDF. The operator still accepts or rejects each garment after inspection.

---

## 5. Operator journeys

### 5.1 Intake (new admin screen)

Admin: **Preloved → Intake**.

For each garment in a bag:

1. Match to an existing **new** catalogue item + size (so naming and size charts stay consistent).
2. Condition: Good or Fair. Optional defect note.
3. Source: donation (Phase 1) or consignment lot (Phase 2).
4. Price: default = configured fraction of the matching new variant price (50%). Operator can type a lower figure. Warn if above the cap.
5. Accept → stock qty on that preloved SKU goes up by 1 (pooled) **or** a unique row with qty 1 (if the tenant later needs photos per garment).
6. Reject → reason (wrong style, stained, refuse-list). No parent listing is created.

Phase 1 default **pooling**: all “Preloved polo / Size 10 / Good” share one SKU and a qty. That matches a printed preloved price list (PLC, Craigburn). Unique photo-per-garment is optional later, not required to copy the shop.

### 5.2 Fulfilment

Reuse the existing paid → packing → ready → collected Kanban.

Pick slip:

- Preloved lines labelled **PRELOVED** and rack location if set.
- Qty 1 of a pooled SKU is still “any matching garment on the rack”.

On paid webhook: decrement preloved qty. Do not decrement new catalogue (new stock is still untracked today; do not sneak inventory onto new items in this project).

Oversell: if qty hits 0 between browse and pay, fail the PaymentIntent creation for that line (same pattern as a missing variant). Show “just sold” on the item page.

### 5.3 Write-off

A weekly operator list: items past hold period. One action: **Write off to charity**. Qty → 0. Audit event. No parent payout on donations.

### 5.4 Consignment payout (Phase 2)

End of term (Mentone) or when a lot is fully sold / expired (CCGS, Ferny Grove):

- Report: consignor, items sold, sale price, shop commission, amount owing.
- Export CSV for EFT (BSB, account, amount, reference).
- Mark lot paid.
- Do **not** pay out through Stripe Connect to parents. Schools already pay consignors by EFT or school-fee credit. Copy that. Stripe Connect stays school-as-seller.

---

## 6. Product surfaces

### Parent (`apps/web/src/app/[tenant]/`)

| Surface | Change |
|---|---|
| Catalogue grid | Preloved filter + badge |
| Item page | Condition, defects, stock qty, ACL sentence |
| Cart / checkout | Mixed GST lines (see §8) |
| New donate page | Drop-off instructions + optional bag note |
| Refund policy | Preloved paragraph: no change-of-mind; ACL for not-as-described |

### Admin (`apps/web/src/app/admin/[tenant]/`)

| Surface | Change |
|---|---|
| New **Preloved** nav item | Intake, stock list, write-offs |
| Pick slip | PRELOVED marker |
| Reports / GST CSV | Split taxable vs GST-free preloved |
| Settings | Opt-in, intake mode, price fraction, hold period, refuse list, GST-free declaration |
| Phase 2 | Consignment lots, payout CSV |

### Platform

No new platform portal work in Phase 1 beyond noting the feature exists. Seller of record remains the tenant.

---

## 7. Data (Phase 1 sketch)

Keep this small. Prefer extending catalogue + a stock table over a marketplace schema.

**Tenant settings** (new columns or a `tenant_preloved_settings` row):

- `prelovedEnabled`
- `intakeMode`: `donation_only` | `donation_and_consignment`
- `priceFractionOfNew` (default `0.50`)
- `holdDays` (default `365`)
- `commissionBps` (Phase 2, default `5000` = 50%)
- `donatedGstFree` (boolean, tenant-declared)
- `refuseList` (text array)

**Preloved SKU** (pooled):

- `id`, `tenantId`
- `sourceItemId` (FK to `catalog_items` — the matching new garment)
- `size` (text, from that item’s size list)
- `condition`: `good` | `fair`
- `price` (numeric)
- `qtyOnHand` (integer ≥ 0)
- `gstFree` (boolean, copied from tenant donation rule at list time)
- `active`
- optional `imageUrl`
- `listedAt`, `expiresAt`

**Intake event** (audit + write-off):

- who accepted, source (donation), qty added, reject reason if any

**Order lines** (extend `order_lines`):

- `prelovedSkuId` nullable
- `gstFree` boolean default false
- `condition` text nullable (frozen at purchase)

**Do not** put unlimited qty on preloved. New catalogue stays as it is (no inventory) so this project does not become a full stock system.

Phase 2 adds `consignment_lots` (parent, bank details, unsold preference) and `consignment_items` (lot, sku or unique garment, sold order line, payout status). Bank details are operator-only, not shown in the parent shop.

Neon-http: use `db.batch`, not transactions, same as the rest of the app.

---

## 8. Money, GST, ACL

### 8.1 Payments

Preloved sale price is paid to the **school’s Stripe Connect account**, same as new stock. The school is still the seller of record. That matches donation (shop owns the garment) and consignment (shop sells as the retailer and later remits a net amount by EFT).

Do not split the Stripe charge to the parent.

### 8.2 GST

Today `computeTotals` always sets `gst = total / 11`. That is wrong for a mixed cart.

Phase 1 rule:

- New lines: GST-inclusive, 1/11, as now.
- Donated preloved lines: GST-free **only if** `tenant.donatedGstFree === true`.
- Consignment lines (Phase 2): taxable unless a later accountant-backed exception is added. Default taxable.
- Shipping: stays GST-applicable when used.
- Order header `gst` = sum of GST on taxable lines only.
- Reports CSV: columns for GST-free preloved sales vs taxable sales.

GST-free donated sales still count toward GST turnover (ATO). No product action other than reporting the GST-free amount.

The tenant settings screen must show: “Confirm with your accountant that your P&C / school is an endorsed charity, gift-deductible entity, or government school before treating donated preloved as GST-free (GST Act s 38-255).” Default `donatedGstFree` to **false**.

### 8.3 ACL and refund policy

Extend the per-tenant refund policy text (already versioned) with a preloved clause:

- Preloved is sold as worn, at a reduced price, with the stated condition.
- No change-of-mind.
- If the item is not as described, or not of acceptable quality for a used garment at that price, the shop will repair, replace, or refund as ACL requires.
- Known defects are listed on the item page.

Never ship a “no refunds on second-hand” toggle.

Collection remains the inspection moment (Vardys Road: inspect at purchase). That is allowed; it does not remove hidden-defect rights.

---

## 9. Fit with the current app

| Already there | Gap this feature needs |
|---|---|
| Multi-tenant shop, seller of record = school | Preloved is a stocked SKU, not an infinite catalogue variant |
| Stripe Connect destination charges | Mixed GST in one PaymentIntent (reporting only; Stripe still charges the total) |
| Pickup Kanban + pick slips | PRELOVED line marker + rack vs new stock |
| Catalogue items + variants + sizes | Link preloved SKU to a source item + size; do not duplicate the whole catalogue |
| Versioned refund policy + checkout consent | Preloved paragraph |
| GST as 1/11 of whole order | Line-level `gstFree` |
| No inventory on new items | Inventory **only** on preloved |
| UploadThing images | Optional garment photo at intake |
| Admin catalog editor | Separate intake screen; do not overload the new-item drawer |

HeroUI OSS + existing parchment / navy tokens. No Pro components. Pickup stays the default fulfilment; do not add a special preloved shipping path in Phase 1 (shops hand these over at the counter).

---

## 10. Phasing

### Phase 1 — Donation rack (ship this first)

Copy donation-only shops (PLC Sydney, Vardys Road, Manly).

1. Tenant opt-in + settings (price fraction, hold days, refuse list, GST-free declaration).
2. Preloved SKU table + qty.
3. Admin intake (accept/reject, price, pool by item+size+condition).
4. Parent catalogue filter, item page, stock-capped cart.
5. Donate instructions page + optional bag note.
6. Decrement qty on paid order; PRELOVED on pick slip.
7. Mixed-cart GST.
8. Write-off list at hold expiry.
9. Refund-policy paragraph.
10. Reports: GST-free preloved column.

**Out of Phase 1:** consignment, parent bank details, unique photo-per-garment, parent self-listing, shipping of preloved.

### Phase 2 — Consignment (only if schools ask)

Copy Tara / CCGS / Ferny Grove / Mentone forms.

1. Intake mode `donation_and_consignment`.
2. Digital consignment form + lot + ticket code.
3. Configurable commission (25 / 30 / 40 / 50%, optional $ admin fee, optional flat blazer fee as at St Paul’s).
4. Payout CSV (EFT) + “donate proceeds” + optional school-fee credit as a **manual** operator mark (do not integrate school finance systems).
5. Unsold: donate or 14-day collect window, then donate.
6. Consignment sales taxable by default.

### Phase 3 — polish, not new models

- Optional photo per pooled SKU or per unique garment.
- “Buy before you buy new” prompt on the matching new item page when preloved qty > 0 in that size.
- Newsletter blurb / QR to the donate page for orientation packs.

No Phase ever becomes a C2C marketplace. An independent research pass listed Facebook-style listings and held-funds checkout as copyable channels. Those already exist outside UniformOrder. This plan copies the shop, not those sites.

---

## 11. Suggested PR slices (after approval)

Each PR should be reviewable on its own.

| PR | Title | Touches | Depends on |
|---|---|---|---|
| P1 | Preloved settings + schema (SKU, qty, gstFree, tenant flags) | `schema.ts`, migration, settings UI | — |
| P2 | Line-level GST in totals, orders, reports | `order-totals.ts`, checkout API, reports CSV | P1 |
| P3 | Admin intake + stock list + write-off | admin preloved screens, queries | P1 |
| P4 | Parent catalogue + item + stock-capped cart | `[tenant]` catalogue/item/cart | P1, P2 |
| P5 | Donate page + bag note + refund-policy paragraph | parent donate route, legal text | P1 |
| P6 | Pick slip PRELOVED + qty decrement on paid | webhook, pick slip, Kanban | P1, P4 |
| P7 | Phase 2 consignment lots + payout CSV | new tables, admin payout | P1–P6 |

Verification for a visual handoff of P4–P6: Playwright against the tenant shop — donate page renders, preloved item adds to cart with qty cap, mixed cart GST, pick slip label. Typecheck is the repo gate (`pnpm check-types:web`).

---

## 12. Key decisions

1. **Shop model, not C2C.** UniformOrder remains the school shop. Parents drop off; the shop lists.
2. **Donation first (approved 2026-09-06).** Phase 1 is donation-only. Consignment is optional Phase 2. Matches the volunteer-light shops and PLC Sydney’s peer research.
3. **Pooled SKUs** by source item + size + condition. Unique tickets only when consigning.
4. **Shop sets the price**, default 50% of the matching new variant, editable down.
5. **Stripe still pays the school.** Consignor EFT is a CSV the treasurer already knows.
6. **GST-free is opt-in per tenant**, default off, only for donated stock.
7. **ACL-safe “sold as worn”**, never a hard no-refunds flag.
8. **No inventory on new catalogue** in this project. Qty exists only for preloved.

---

## 13. Open questions

1. **Phase 1 scope — decided.** Donation-only rack. Consignment is not in the first build.
2. **GST default — plan default, not separately confirmed.** `donatedGstFree` stays off until the school ticks it.
3. **School-fee credit — Phase 2.** Not in this build.
4. **Hats — plan default, not separately confirmed.** Refuse list includes hats until a tenant turns them on.

Legal/tax wording in this plan is a product constraint, not advice. Each tenant remains responsible for their ACL policy and BAS.

---

## 14. What this is not

This plan is not a spec rewrite of UniformOrder and not a milestone roadmap in `specs/`. Phase 1 scope is approved. A build can be sliced from §11 (P1–P6 only; skip P7) when asked.
