# UniformOrder demo playbook

This is the sales / investor demo script. Run it against the seeded `demo-academy` tenant unless noted. Total runtime: ~18 minutes core + ~5 minutes Q&A buffer.

## Demo goal

UniformOrder replaces the paper-form uniform workflow with an end-to-end digital system that delivers measurable time savings, a full audit trail, and BAS-ready reporting. For a P&C committee or school business manager, the pitch is simple: parents order online in under 90 seconds, the shop coordinator works from a live Kanban instead of a manila folder, and month-end reconciliation drops from a weekend to an afternoon. For investors or partners, the demo proves the workflow is genuinely end-to-end, multi-tenant, and compliant with Australian consumer law — not a prototype, a running product.

## Target audiences

- P&C committee (~5 people, mix of tech-comfortable parents)
- School business manager (1:1)
- Investor / partner (1:1 or small panel)

The playbook is calibrated for the P&C committee narrative. Branch points for the other audiences are flagged inline.

## Required setup (pre-demo checklist)

- [ ] Seed run completed within last hour: `pnpm --filter web demo:seed`
- [ ] Dev server up: `pnpm --filter web dev` on `http://localhost:3000`
- [ ] Demo Neon Auth users present (see `demo_data/operator_run_guide.md`)
- [ ] Browser zoom 100%, font size default
- [ ] Two windows open: desktop (1920×1080) and phone emulator (390×844 in Chrome devtools)
- [ ] Notifications silenced; Slack closed
- [ ] Audio source confirmed if recording

## Demo accounts (handy reference)

| Email | Role | Used in |
|---|---|---|
| `platformadmin@demo.uniformorder.online` | Platform admin | Act 1 |
| `operator@demo.uniformorder.online` | Operator (both tenants) | Acts 2, 4, 5, 6 |
| `parent@demo.uniformorder.online` | Parent | Act 3 (sign-in version) |

## Timing matrix

| Act | Runtime | Cumulative |
|---|---|---|
| 1. Setup & login | 2 min | 2:00 |
| 2. Operator dashboard | 3 min | 5:00 |
| 3. Live parent order | 3 min | 8:00 |
| 4. Order management | 4 min | 12:00 |
| 5. Reports & exports | 3 min | 15:00 |
| 6. Admin configuration | 3 min | 18:00 |
| Q&A buffer | 5 min | 23:00 |

## Act 1 — Setup & login

**Persona:** Platform admin.
**Route:** `/platform` → `/platform/tenants`.

Open the platform console and show the tenant list. Highlight the approval state column for `demo-academy` and `demo-blank`. Quick line about Stripe Connect status — both tenants are approved, payouts enabled.

**Click targets:**
1. Open `http://localhost:3000/platform` — already signed in as platform admin.
2. Navigate to `/platform/tenants`.
3. Click `demo-academy` row → tenant detail.

**Narration lines (verbatim):**
- "This is the platform console — where we approve schools. A real onboarding from sign-up to first parent order takes about 15 minutes."
- "Here's Riverside Academy. They were approved last week. Once Stripe Connect verification clears, they're live."

**Fallback if route looks stub-y:** "The full console is in design — what you see today is the data model and the routes; the UI polish ships next sprint."

**Expected outcome:** audience understands multi-tenancy and that we operate as the platform layer.

## Act 2 — Operator dashboard

**Persona:** School operator (sign in as `operator@demo.uniformorder.online`).
**Route:** `/admin/demo-academy` → `/admin/demo-academy/orders`.

Scan the dashboard KPIs. Open the Kanban. Highlight Unicode names rendering correctly. Filter by year level. Click into one order.

**Click targets:**
1. Sign in as operator (use password from `.env.demo`).
2. Land on `/admin/demo-academy`.
3. Click "Orders" in sidebar → Kanban.
4. Hover the "Needs Attention" column header → "3 orders waiting on stock".
5. Click into `RVRA-00015` (Hannah Goldberg / Eli Goldberg) — see the hold reason.

**Narration lines:**
- "This is what the uniform shop coordinator sees on Monday morning. Eight orders to pick today, three waiting on stock, six already ready for collection."
- "The shop runs Mon/Wed/Fri 8:30 to noon. Between sessions the Kanban is their work plan."
- "When stock runs short — like this Year 9 jumper in size 16 — the operator marks it 'Needs Attention' with a reason, and the parent gets an automated hold email."

**Expected outcome:** audience sees realistic state distribution, not a clean empty demo.

## Act 3 — Live parent order

**Persona:** Parent (operator's own device, phone viewport).
**Route:** `/demo-blank` (clean tenant) or `/demo-academy` for richer catalog. Default: use `/demo-academy`.

**Participation moment:** if the prospect has a phone handy, hand them the URL and let them place a test order. Otherwise drive from your own device.

Open the parent shop in the mobile viewport. Browse the catalog. Tap a polo shirt → size 10. Add to cart. Add a jumper. Open cart. Tap Checkout. Show the refund-policy acknowledgement. Stop at the Stripe Payment Element.

**Click targets:**
1. `http://localhost:3000/demo-academy` on phone viewport.
2. Tap "Polo Shirt — Short Sleeve" → size 10 → Add to cart.
3. Back, tap "Winter Jumper" → size 12 → Add to cart.
4. Tap cart icon → review.
5. Tap "Checkout" → fill student name "Demo Student", year 8, roll 8A.
6. Tick refund policy.
7. **Stop at Payment Element render.**

**Narration lines:**
- "From a parent's perspective: it's a phone-shaped shop. They pick the polo, the jumper, tap checkout, accept the refund policy."
- "Stripe handles payment. We never see card details. Apple Pay and Google Pay are first-class — most parents finish checkout in under 90 seconds end-to-end."

**Fallback if Stripe Element fails to load:** "In live demos we stop here — the test card flow needs a real Stripe Connect test account. For our pilot schools we set this up during onboarding."

**Live-Stripe variant (optional):** if the operator has swapped in a real Connect test account ID for `demo-blank` before the demo, complete payment with test card `4242 4242 4242 4242`, any future expiry, any CVC. The order will land in the operator's Kanban within ~2 seconds via the Stripe webhook.

**Expected outcome:** prospect feels the speed and simplicity. If they participated, they're invested.

## Act 4 — Order management

**Persona:** Operator.
**Route:** `/admin/demo-academy/orders/RVRA-00003`.

Open a to_prepare order. Mark it Ready. Show the ready email being sent (notification event row appears). Print the pick slip. Then open a completed order and refund one line.

**Click targets:**
1. Click `RVRA-00003` (Søren Müller / Anika Müller, trousers + tie).
2. Click "Mark Ready" → confirm.
3. Click "Print Pick Slip".
4. Back to Kanban → click `RVRA-00038` (Layla Ibrahim / Zara Ibrahim, partially refunded).
5. Click the refunded line → show refund history + reason.

**Narration lines:**
- "When the order's picked, one click marks it Ready. The parent gets the collection email and the audit log captures who clicked, when, from what IP."
- "Refunds work the same — one click on a line, type a reason, the Stripe Connect refund fires, the customer gets a refund email. Reconciliation is automatic."
- "All of this is in the audit log. If a P&C member asks 'who marked this Ready last Thursday', we can answer."

**Expected outcome:** audience sees the workflow is one-click + auditable.

## Act 5 — Reports & exports

**Persona:** Operator.
**Route:** `/admin/demo-academy/reports`.

Open reports. Show the last 30 days. Highlight GST-inclusive totals. Click Export CSV. Open the CSV in a spreadsheet on a second screen.

**Click targets:**
1. Navigate to `/admin/demo-academy/reports`.
2. Set range = last 30 days.
3. Note total revenue, GST collected.
4. Click "Export CSV" → save → open in spreadsheet app.
5. Show GST column matches subtotal/11.

**Narration lines:**
- "At month-end, the operator pulls a CSV. GST is broken out — Riverside's accountant pivots this straight into BAS today, and we're shipping native BAS export next quarter."
- "Every refunded line is flagged. Reconciling against the bank statement takes about an afternoon now instead of a weekend."

**Fallback if CSV won't open inline:** simply scroll the on-screen report and describe.

**Expected outcome:** audience sees compliance / accounting workflow.

## Act 6 — Admin configuration

**Persona:** Operator.
**Route:** `/admin/demo-academy/settings`, `/admin/demo-academy/catalog`.

Open settings. Show workflow mode toggle (standard vs simple). Open refund policy editor — note version history. Open catalog management — show drag-reorder, variant prices, size guide.

**Click targets:**
1. Settings → workflow mode dropdown.
2. Settings → refund policy editor → show current version + history.
3. Catalog → drag a polo to top of list.
4. Catalog → edit a variant price.
5. Catalog → open size guide tab.

**Narration lines:**
- "The operator owns their own catalog. No tickets to us. Drag to reorder, click to edit prices, paste in a size guide."
- "Refund policy is versioned. Every order stores the version the parent acknowledged at checkout. If the policy changes, old orders stay anchored to the version that was current when they paid."

**Expected outcome:** audience sees operator independence + compliance posture.

## Objection handling

| Objection | Response |
|---|---|
| "We already use [X spreadsheet / Google Forms]." | "What does your end-of-term reconciliation look like? How long does it take?" Then: "We replace that weekend with about an afternoon." |
| "What about data security / PII?" | AU-hosted (Neon Sydney). Stripe holds card data. We hold name/email/mobile + order history. No DOB, no addresses unless shipping enabled. Full audit log. SOC2 roadmap. |
| "Setup time?" | ~15 min from school approval to first parent order. We help with the first catalog import. |
| "Stripe Connect — what's the fee?" | School pays Stripe AU rates directly (~1.7% + 30c). We don't take a cut on payments. Platform fee is flat monthly per school. |
| "GST / BAS handling?" | CSV with GST column today; native BAS export next quarter. We're working with two accountants on the export format. |
| "Refund policy compliance (ACL)?" | Built in. Every order acknowledges the current policy version. Versioning preserves the wording that was live at order time. |
| "What if Stripe is down?" | Checkout fails gracefully; cart persists; we don't lose orders. Webhook idempotency on receipt. |
| "Inventory?" | Out of scope by design — schools don't run on inventory systems, they order in batches. We track per-order quantity, not stock levels. |

## Discovery questions to ask the prospect

- "Walk me through what happens when a Year 7 parent orders a uniform today."
- "How does the uniform shop know when to restock?"
- "Where does the money flow — through the P&C account, the school's general account, or third-party?"
- "What's the worst thing that's happened at the end of a term?"

## Participation moment script

In Act 3, if the prospect has a phone:
> "Open `http://demo.local:3000/demo-academy` on your phone — same wifi. Order yourself a polo. We'll see it in the operator dashboard in about two seconds."

(Adapt URL to whatever's reachable from their device — if the dev server isn't exposed on the LAN, narrate the flow on your own phone instead.)

## Closing script

Today you saw a complete uniform order cycle in under 18 minutes: a platform admin approving a school, a shop coordinator working their Monday Kanban, a parent completing checkout on a phone, and an operator reconciling GST in a single CSV export. Based on conversations with three pilot schools, that workflow trims end-of-term reconciliation from a weekend to an afternoon and eliminates the back-and-forth over lost paper forms.

The natural next step is a 30-minute scoping call to map your school's catalog, confirm the Stripe Connect setup, and put together a pilot quote — schools typically go live within a week of sign-off.

On the roadmap: native BAS export (next quarter), the full platform portal for multi-school visibility, and a sportswear cross-sell module for schools that stock PE gear alongside uniforms.

## Post-demo follow-up checklist

- [ ] Send follow-up email within 24h with the recording link (if recorded).
- [ ] Include `product-walkthrough.md` as a PDF attachment if asked.
- [ ] Schedule pilot scoping call.
- [ ] Log demo in CRM with the answers to the four discovery questions.
- [ ] Note any new objections — add to this playbook.
- [ ] Reset demo data before next demo: `pnpm --filter web demo:cleanup:confirm && pnpm --filter web demo:seed`.
