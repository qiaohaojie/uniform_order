# Demo route map

Routes referenced by the demo playbook, with role gating, seed dependencies, and recording notes. Paths reflect the actual `apps/web/src/app/` structure as of 2026-05-17.

## Public

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/` | public | Parent home — school picker | reads `lib/data.ts` `TENANTS` (static); demo tenants currently absent until platform-portal DB migration lands | Mention as known limitation; demo tenants reached via direct URL |
| `/[tenant]` (`demo-blank`, `demo-academy`) | parent | Catalog browse, mobile-first | catalog seeded | Act 3 opening shot |
| `/[tenant]/item/[itemId]` | parent | Item detail + variants + size guide | variants + size guide seeded (size guide null for now) | Act 3 — variant picker |
| `/[tenant]/cart` | parent | Cart (localStorage) | none (client state) | Act 3 — review step |
| `/[tenant]/checkout` | parent | Stripe Payment Element + refund policy ack | tenant Stripe Connect fields populated | Act 3 — payment step (fake Stripe in default mode; real test-mode is opt-in) |
| `/[tenant]/refund-policy` | parent | Tenant refund policy text | `tenantLegalVersions` row seeded | Act 6 — referenced when toggling policy editor |
| `/[tenant]/contact` | parent | Contact info | tenant address/email/hours seeded | Optional Act 1 polish shot |
| `/orders/[orderId]` | parent (own orders) | Parent order detail page | requires `DEMO_PARENT_USER_ID` to be set + ~3 attributed orders | Optional Act 3 closing shot |

## School operator

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/admin/[tenant]` | operator | Dashboard, KPIs | 40 orders mixed states | Act 2 opening |
| `/admin/[tenant]/orders` | operator | Kanban board | orders + events seeded | Act 2 + Act 4 |
| `/admin/[tenant]/orders/[orderId]` | operator | Order detail + actions (mark ready, print, refund) | one order pre-selected (`RVRA-00003`) | Act 4 — transition demo |
| `/admin/[tenant]/catalog` | operator | Catalog management | catalog + variants seeded | Act 6 — drag-reorder + variant edit |
| `/admin/[tenant]/reports` | operator | CSV export + GST view | completed orders within range | Act 5 |
| `/admin/[tenant]/settings` | operator | Workflow mode, refund policy, branding | tenant + settings + legal seeded | Act 6 |
| `/admin/[tenant]/bulk` | operator | Bulk upload (🚧 partial) | none | Mention only — not part of demo flow |

## Platform admin

| Path | Role | Purpose | Seed dep | Screenshot moment |
|---|---|---|---|---|
| `/platform` | platform admin | Console root | `PLATFORM_ADMIN_EMAILS` env contains demo admin | Act 1 opening (currently stub — design spec referenced) |
| `/platform/tenants` | platform admin | Tenant list | demo tenants in DB | Act 1 — show approval state |
| `/platform/billing` | platform admin | Billing overview (🚧 in design) | n/a | Mention only |

## Risks & dependencies

- **`/` parent home** still reads from `lib/data.ts` static `TENANTS`. Until the platform-portal DB migration lands, the parent shop picker will not surface demo tenants. The playbook directs the prospect to direct tenant URLs during Act 3.
- **`/[tenant]/checkout`** renders the Stripe Payment Element using `stripeAccountId='acct_demo_*'`. In default demo mode this Element will fail to load a real Stripe account; the playbook narration explicitly stops at "this is where the parent enters their card" and does not attempt a real charge unless the operator has swapped in a Connect test-mode account ID beforehand.
- **`/admin/[tenant]/reports`** caps the order range at 60 days. The seed places orders within 60 days; do not seed with arbitrary `daysAgo` values beyond that.
- **`/orders/[orderId]`** requires the requesting Neon Auth user to match `orders.userId`. Without `DEMO_PARENT_USER_ID`, the parent-portal route returns 404 for seeded orders.
