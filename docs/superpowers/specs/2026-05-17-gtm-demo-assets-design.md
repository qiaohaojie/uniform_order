# GTM Demo Assets — Design Spec

**Date:** 2026-05-17
**Branch:** `gtm-demo-assets` (git worktree at `../uniform_order-gtm-demo`)
**Status:** Draft for review

## 1. Purpose

Build a complete, repo-aware `GTM/` directory that supports repeatable sales demos, investor walkthroughs, pilot onboarding, screen recording, and safe demo database setup for UniformOrder. Output is durable, versioned alongside code, and grounded in the actual Drizzle schema, Neon Auth model, Stripe Connect integration, and Next.js 16 routes that exist today — not generic SaaS positioning.

## 2. Out of scope

- Real Stripe test-mode payments inside the seed (deferred — fake refs only)
- Real PostHog event capture from seed (deferred)
- Real UploadThing image uploads (catalog uses existing `imageUrl` strings / SVG `GarmentVector` fallback)
- Bulk Neon Auth user provisioning (Neon Auth users are external to our schema — created manually once per machine)
- Production / staging seeding (scripts refuse to run against any non-localhost DB by default)
- Inventory / stock tracking (out of scope per `project_no_inventory` memory)

## 3. Output structure

```
GTM/
├── IMPLEMENTATION_NOTES.md
├── demo_data/
│   ├── README.md
│   ├── operator_run_guide.md
│   ├── seed-demo.ts
│   ├── cleanup-demo.ts
│   ├── .env.demo.example
│   └── fixtures/
│       └── demo-scenarios.json
└── product_demo/
    ├── product-walkthrough.md
    ├── demo-playbook.md
    ├── route-map.md
    ├── playwright/
    │   ├── README.md
    │   ├── demo-recording.config.ts
    │   └── record-demo.spec.ts
    └── recordings/
        ├── README.md
        ├── .gitkeep
        ├── 001_act1_setup_and_login.md
        ├── 002_act2_operator_dashboard.md
        ├── 003_act3_live_parent_order.md
        ├── 004_act4_order_management.md
        ├── 005_act5_reports_exports_gst.md
        └── 006_act6_admin_configuration.md
```

Generated video artifacts (`output/`, `*.webm`, `*.mp4`) are gitignored and never committed.

## 4. Demo data architecture

### 4.1 Tenant namespace

Two deterministic, isolated tenants. Production tenants `nsbh` and `rgsh` are never touched.

| Tenant slug    | Tenant name            | Scenario                                           |
|----------------|------------------------|----------------------------------------------------|
| `demo-blank`   | Hawthorn Grammar       | A — clean onboarding workspace, ~6 catalog items, 0 orders |
| `demo-academy` | Riverside Academy      | B — pre-populated, ~10 catalog items, ~40 orders mixed states |

Both tenants are marked `isPubliclyListed=true` (visible on the parent home picker), `platformApprovalStatus='approved'` (catalog editing enabled), and have a single `tenantLegalVersions` row with `currentLegalVersionId` set. `tenantSettings` defaults to `workflowMode='standard'`, `pickupEnabled=true`, `shippingEnabled=false`.

Fake Stripe Connect state: `stripeAccountId='acct_demo_blank'` / `'acct_demo_academy'`, `stripeChargesEnabled=true`, `stripePayoutsEnabled=true` — coherent values so the admin UI renders correctly, never used against the real Stripe API.

### 4.2 Catalog fixture

Australian school-uniform stock per the project domain:

- Polo shirt (short / long sleeve variants)
- Summer dress
- Winter jumper
- Sports shorts
- School hat
- House shirt (Bradman / Phar Lap / Sutherland / Cuthbert houses for `demo-academy`)
- Tracksuit pants
- Backpack
- Name labels (pack of 50)
- Tie (`demo-academy` only — formal)

Each item has 2–4 `catalogVariants` with realistic AUD prices ($14–$95 range) and `sizes` JSONB array (`["6","8","10","12","14","16"]` or `["S","M","L","XL"]`). `GarmentVector` IDs match existing IDs in `lib/data.ts` where possible (`polo`, `jumper`, `shorts-sport`, `hat`) so visuals render.

### 4.3 Order distribution (demo-academy only)

40 orders, IDs `RVRA-00001` through `RVRA-00040`, spread across the last 60 days:

| Count | fulfilment_status | payment_status      | Notes                                      |
|-------|-------------------|---------------------|--------------------------------------------|
| 8     | to_prepare        | paid                | Just paid, awaiting pick                   |
| 6     | ready             | paid                | Ready-for-collection email sent            |
| 10    | completed         | paid                | Collected, last 30 days, drives reports    |
| 6     | completed         | paid                | Collected, 30–60 days ago                  |
| 3     | needs_attention   | paid                | Hold email sent (size unavailable)         |
| 4     | to_prepare        | pending             | Cart abandonment / unpaid                  |
| 2     | completed         | partially_refunded  | Single line refunded                       |
| 1     | completed         | refunded            | Full refund                                |

Per order: 1–4 `orderLines` referencing real `catalogItems.id`s from the demo catalog. GST = `subtotal / 11`, total = `subtotal + deliveryFee` (AUD GST-inclusive convention).

Companion event rows:
- `orderEvents`: `order_paid` for every paid order; `status_changed` for every transition past `to_prepare`; `ready_email_sent` for `ready`+`completed` orders; `refund_created` for refunded.
- `orderNotificationEvents`: `ready` notification per `ready`+`completed` order; `hold` per `needs_attention`; `refund` per refunded. Status `sent` with fake `providerMessageId='msg_demo_<orderId>_<type>'`.
- `orderRefunds`: one row per `partially_refunded` / `refunded` order, fake `stripeRefundId='re_demo_<orderId>_001'`.

### 4.4 Realism (Unicode / edge cases)

Fixture names exercise encoding edge cases:

- `Chloë Nguyen`, `José O'Connor`, `Søren Müller`, `Aroha Te Rangi`, `Miyuki Tanaka`
- `李小明` (parent `Liu Mingsheng`)
- House labels include `São Paulo House` variant
- Long parent name: `Alexandra Catherine Featherstonehaugh-Williamson`
- Apostrophes, hyphens, accents, CJK chars across both parent and student records
- Australian suburbs in `parentMobile` area patterns and (where displayed) addresses

No real personal data is used.

### 4.5 Demo credentials (manual, out-of-band)

`neonAuthUsers` lives in the `neon_auth` schema and is owned by Neon Auth, not our app. The seed cannot create login users. `.env.demo.example` and `operator_run_guide.md` document a one-time manual step: create three Neon Auth users via the auth UI:

- `operator@demo.uniformorder.online` (used as `tenants.shopEmail` for both demo tenants)
- `parent@demo.uniformorder.online` (used as `orders.parentEmail` for ~3 orders so the parent portal shows history)
- `platformadmin@demo.uniformorder.online` (must also be present in `PLATFORM_ADMIN_EMAILS` env var)

All use password `DemoPass123!` (documented as demo-only, rotate per `operator_run_guide.md`).

The seed sets `orders.userId` to `NULL` for the vast majority of orders (operator-created orders without parent accounts), and to the parent's Neon Auth UUID for 3 orders **only if** that UUID is provided in `.env.demo` as `DEMO_PARENT_USER_ID`. If absent, all orders are user-less and the parent-portal demo is skipped.

## 5. Seed script design

### 5.1 Runtime

`tsx GTM/demo_data/seed-demo.ts [flags]`. Uses the existing Drizzle / `neon-http` client (`apps/web/src/db/index.ts`) — same connection path the app uses, ensuring schema compatibility.

**neon-http constraint:** uses `db.batch(...)` per project convention; never `db.transaction(...)`.

### 5.2 Flags

| Flag                       | Effect                                                                 |
|----------------------------|------------------------------------------------------------------------|
| `--dry-run`                | Prints planned operations; performs no writes                          |
| `--reset`                  | Deletes demo-namespace rows before re-seeding (otherwise upsert-only)  |
| `--allow-remote`           | Bypasses localhost-only DB host guard (requires manual confirmation)   |
| `--i-know-what-im-doing`   | Required alongside `--allow-remote` when DB host matches prod patterns |
| `--only=blank\|academy`    | Seed only one of the two tenants                                       |

Default invocation seeds both tenants idempotently against localhost only.

### 5.3 Safety guards

The script aborts before any DB connection if any of the following hold. Each prints a clear remediation message before `exit 1`:

1. `DATABASE_URL` is unset.
2. The host parsed from `DATABASE_URL` contains neither `localhost` nor `127.0.0.1`, **and** `--allow-remote` was not passed.
3. The host parsed from `DATABASE_URL` matches the prod-pattern set `{prod, production, super-cell-03401356}`, **and** `--i-know-what-im-doing` was not passed. (This trips even with `--allow-remote`.)
4. `NODE_ENV === "production"`, **and** `--i-know-what-im-doing` was not passed.

Guard 3 covers the named prod Neon project explicitly so the seed can never accidentally hit it.

### 5.4 Idempotency

Every insert is an `ON CONFLICT (natural_key) DO UPDATE SET ... updatedAt=now()`:

- `tenants` on `id`
- `tenantSettings` on `tenantId`
- `catalogItems` on `id`
- `catalogVariants` — deleted + re-inserted per item (cleanest given no natural key)
- `orders` on `id` (prefixed `HWGM-` and `RVRA-`)
- `orderLines`, `orderEvents`, `orderNotificationEvents`, `orderRefunds` — deleted per order id then re-inserted

Re-running the seed without `--reset` produces no semantic change.

### 5.5 Fixture file

`fixtures/demo-scenarios.json` holds all tenant config, catalog items, variants, and the order distribution template. Seed logic stays generic; future tuning happens in JSON.

Order rows are generated deterministically — fixed RNG seed derived from order ID, so re-runs produce identical names, emails, lines, totals. This matters for reproducible recordings.

## 6. Cleanup script design

`tsx GTM/demo_data/cleanup-demo.ts [flags]`.

Identical safety guards to seed. Always prints a deletion plan first. Requires `--confirm` to execute.

Deletion is **strictly scoped** by `tenantId IN ('demo-blank','demo-academy')`. Cascade FKs (`onDelete: 'cascade'` on `orders.tenantId`, `catalogItems.tenantId`, etc.) clean dependents. `auditEvents` rows where `tenantId IN (demo tenants)` are also removed; rows with `tenantId=NULL` are never touched.

`orderRefunds.stripeRefundId` uniqueness — cleared by cascade through `orders` deletion. `tenantLegalVersions` for demo tenants deleted last (after `tenants.currentLegalVersionId` is nulled out, since the FK is enforced via SQL ALTER without cascade).

## 7. Product demo narrative

### 7.1 Walkthrough (`product-walkthrough.md`)

Audience: investor / school district decision-maker. Sections:

1. **Problem** — manual paper-based uniform ordering at AU schools (the `Uniform_Online_Order_Form.pdf` baseline)
2. **Personas** — Platform operator (us), School operator (uniform shop staff/P&C), Parent
3. **Workflow** — onboarding → catalog config → parent order → operator fulfilment → reporting
4. **Feature deep-dives** with implementation status labels:
   - ✓ Invite-based auth (Neon Auth) — implemented
   - ✓ Tenant configuration (branding, legal, settings) — implemented
   - ✓ Catalog management (drag-reorder, variants, sizes, size-guide JSON) — implemented
   - ✓ Parent ordering (mobile-first 430px shell, cart, checkout, Stripe) — implemented
   - ✓ Order management (Kanban, status transitions, pick slip, refunds) — implemented
   - ✓ Reports & CSV export (last 30/60 days, GST-inclusive) — implemented
   - ✓ Refund-policy versioning + parent acknowledgement — implemented
   - ✓ Audit events (operator actions) — implemented
   - 🚧 BAS export — **planned, not yet implemented**
   - 🚧 Bulk-upload UI — **partial route exists, full flow planned**
   - 🚧 Platform portal — **in design per `docs/superpowers/specs/2026-05-09-platform-portal-design.md`**
5. **Compliance & trust** — AU data sovereignty (Sydney Neon region), PII minimisation (no DOB / no payment data stored), RBAC via `authorization.ts`, audit log, refund policy versioning
6. **Demo narrative arc** — before / product moment / business outcome / expansion

### 7.2 Playbook (`demo-playbook.md`)

Day-in-the-life sales script structured as 6 acts (Section 8 below). Includes:

- Pre-demo checklist (seed run, dev server up, Neon Auth users present, browser zoom 100%)
- Timing matrix (act → minutes)
- Per-act: persona, route, click targets, narration lines, expected outcome, fallback lines
- Objection handling (price, security, PII, GST/BAS, migration from existing system)
- Discovery questions
- Participation moment (Act 3 — prospect places live order on `demo-blank` from their phone)
- Closing script and follow-up checklist

### 7.3 Route map (`route-map.md`)

Per-route table covering demo-relevant URLs found in `apps/web/src/app/`:

| Route                                    | Role           | Purpose                       | Seed dep        |
|------------------------------------------|----------------|-------------------------------|-----------------|
| `/`                                      | public         | School picker                 | both tenants    |
| `/[tenant]`                              | parent         | Catalog browse                | catalog seeded  |
| `/[tenant]/item/[itemId]`                | parent         | Item detail + variants        | variants seeded |
| `/[tenant]/cart`                         | parent         | Cart                          | localStorage    |
| `/[tenant]/checkout`                     | parent         | Stripe Payment Element        | live Stripe     |
| `/[tenant]/refund-policy`                | parent         | Refund policy text            | legal seeded    |
| `/orders/[orderId]`                      | parent         | Parent order detail           | DEMO_PARENT_USER_ID set |
| `/admin/[tenant]`                        | operator       | Operator dashboard            | orders seeded   |
| `/admin/[tenant]/orders` (Kanban)        | operator       | Order board                   | 40 orders       |
| `/admin/[tenant]/orders/[orderId]`       | operator       | Order detail + actions        | orders seeded   |
| `/admin/[tenant]/catalog`                | operator       | Catalog management            | catalog seeded  |
| `/admin/[tenant]/reports`                | operator       | CSV export, GST totals        | completed orders|
| `/admin/[tenant]/settings`               | operator       | Workflow mode, branding       | tenantSettings  |
| `/platform`                              | platform admin | Platform console              | platform admin in PLATFORM_ADMIN_EMAILS |
| `/platform/tenants`                      | platform admin | Tenant approval list          | both tenants    |

## 8. Acts (recording scripts)

Each `recordings/00N_act*.md` contains: purpose, persona, starting URL, seed prerequisite, step-by-step actions with exact narration lines, expected visual outcomes, possible failure states, re-recording command, cleanup notes.

1. **Setup & login** — platform admin views `/platform/tenants`, approves a tenant, lands in operator view
2. **Operator dashboard** — operator at `/admin/demo-academy`, scan KPIs, filter Kanban by year level, open order detail
3. **Live parent order** — parent persona on `demo-blank` from operator's device, builds cart with size selector, reaches checkout (Stripe step optional — labelled clearly)
4. **Order management** — operator transitions `RVRA-00003` to_prepare → ready → completed, prints pick slip, sends ready email, then refunds one line on a completed order
5. **Reports & exports** — operator at `/admin/demo-academy/reports`, downloads CSV, opens in spreadsheet to show GST-inclusive totals
6. **Admin configuration** — operator toggles workflow mode, edits refund policy, updates branding accent colour, views audit trail

## 9. Playwright automation

### 9.1 Files

- `GTM/product_demo/playwright/demo-recording.config.ts` — config separate from any future test config
- `GTM/product_demo/playwright/record-demo.spec.ts` — six `test.describe` blocks, one per act

### 9.2 Projects

```ts
projects: [
  {
    name: 'desktop',
    use: { viewport: { width: 1920, height: 1080 }, video: 'on', headless: false, launchOptions: { slowMo: 300 } },
  },
  {
    name: 'mobile',
    use: { ...devices['iPhone 13'], video: 'on', headless: false, launchOptions: { slowMo: 300 } },
  },
],
```

Video output → `GTM/product_demo/recordings/output/<project>/<actId>.webm`.

### 9.3 Pre-flight

`globalSetup` performs `fetch('http://localhost:3000', { signal: AbortSignal.timeout(5000) })` and aborts the run with a clear error if the dev server is not responding.

### 9.4 Selectors

Prefer `page.getByRole('button', { name: ... })` and `page.getByLabel(...)`. Where the existing UI lacks accessible names, use `getByText` and add a code comment flagging it as a brittleness point. The agent will NOT run headed Playwright itself (per `feedback_no_headed_browser_in_agent` memory) — the user runs it from their own terminal using the documented commands.

### 9.5 Credentials

Loaded via `dotenv` from `GTM/demo_data/.env.demo`. Never logged. The `.env.demo.example` documents required variables:

```
DEMO_OPERATOR_EMAIL=operator@demo.uniformorder.online
DEMO_OPERATOR_PASSWORD=DemoPass123!
DEMO_PARENT_EMAIL=parent@demo.uniformorder.online
DEMO_PARENT_PASSWORD=DemoPass123!
DEMO_PLATFORM_ADMIN_EMAIL=platformadmin@demo.uniformorder.online
DEMO_PLATFORM_ADMIN_PASSWORD=DemoPass123!
DEMO_PARENT_USER_ID=                # optional; set after creating parent Neon Auth user
DEMO_BASE_URL=http://localhost:3000
```

## 10. App-level changes outside `GTM/`

Documented in `GTM/IMPLEMENTATION_NOTES.md`. Limited to:

1. **`apps/web/package.json`** — add four scripts:
   ```json
   "demo:seed":          "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts",
   "demo:seed:dry":      "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/seed-demo.ts --dry-run",
   "demo:cleanup":       "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts",
   "demo:cleanup:confirm": "tsx --env-file=../../GTM/demo_data/.env.demo ../../GTM/demo_data/cleanup-demo.ts --confirm"
   ```
   `tsx` is added as a dev dependency in `apps/web/package.json` if not already present.

2. **Root `.gitignore`** — append:
   ```
   GTM/product_demo/recordings/output/
   GTM/demo_data/.env.demo
   *.webm
   *.mp4
   ```

3. **`apps/web/src/lib/data.ts`** — **no change**. Demo tenants come from DB, not the static `TENANTS` map. (Note: the parent home picker currently reads from `TENANTS`; ensuring demo tenants surface there is an open question — see Section 12.)

## 11. Quality bar

- All copy refers to "UniformOrder", AU schools, GST, P&C committees, year levels — not generic SaaS
- Aspirational claims labelled explicitly: 🚧 Planned / 🚧 Future positioning / 🚧 Not currently implemented
- Implementation status verified against actual routes/code at design time
- Seed produces exactly the same data on every run (deterministic RNG by order ID)
- Cleanup is provably scoped (tenant filter + plan-before-act)
- No secrets in committed files; `.env.demo` is gitignored

## 12. Open questions / acknowledged gaps

1. **Parent home picker tenant source** — `app/page.tsx` reads from `lib/data.ts` `TENANTS` (static), not the DB. Demo tenants seeded into the DB will NOT appear on `/` until that route migrates to a DB-backed lookup. **Resolution:** the playbook directs the prospect to `/<demo-blank>` and `/<demo-academy>` directly via URL during Act 3, and documents this as a known limitation in `IMPLEMENTATION_NOTES.md`. The platform-portal spec (`docs/superpowers/specs/2026-05-09-platform-portal-design.md`) plans the DB migration; this GTM build does not require it.

2. **Live Stripe in Act 3** — full prospect-completed-payment demo requires a real Stripe Connect test account on `demo-blank`. The seed creates fake `stripeAccountId='acct_demo_blank'`. Two operating modes documented:
   - **Default (no live Stripe):** Act 3 stops at the Stripe Payment Element render and the operator narrates "this is where the prospect would enter test card 4242..."
   - **Optional (live Stripe test mode):** operator manually replaces `acct_demo_blank` with a real test-mode Connect account ID via the platform console before the demo. Documented but not automated.

3. **Email sending** — `orderNotificationEvents` are seeded with `status='sent'` and fake `providerMessageId`s. No real email is sent. Demo narration covers what would happen ("a parent at this point receives the collection email"). Triggering a real send during the demo is out of scope.

4. **Drizzle migrations vs runtime seed** — seed uses runtime Drizzle ORM (same client as the app), not `drizzle-kit`. Avoids the `drizzle-kit migrate` websocket blocker documented in `project_drizzle_kit_websocket_blocker.md`.

## 13. Acceptance criteria

- `pnpm --filter web demo:seed:dry` runs from a clean checkout and prints a coherent plan without writing
- `pnpm --filter web demo:seed` writes ~40 orders, ~16 catalog items, ~32 variants, 2 tenants, 2 settings rows, 2 legal versions, ~100 events, ~30 notification events, 3 refunds — all idempotent
- `pnpm check-types:web` passes after all file additions
- `pnpm --filter web demo:cleanup --confirm` removes only the demo-namespace rows
- All `GTM/*.md` files contain UniformOrder-specific language, no `{{PROJECT_NAME}}` placeholders
- All implementation-status labels match actual codebase reality at 2026-05-17
- Playwright config + spec parse without errors (`npx playwright test --list -c GTM/product_demo/playwright/demo-recording.config.ts`)
- Generated `.webm` files do not appear in `git status`

## 14. Implementation phasing

The implementation plan (writing-plans next step) will sequence as:

1. Scaffold `GTM/` skeleton + fixture JSON
2. Implement `seed-demo.ts` (read-only dry-run path first)
3. Implement `cleanup-demo.ts`
4. Wire `package.json` scripts + `.gitignore`
5. Write `demo_data/README.md` + `operator_run_guide.md`
6. Write `product-walkthrough.md` + `route-map.md` (grounded in actual routes)
7. Write `demo-playbook.md` + 6 act scripts
8. Implement Playwright config + spec
9. Write `playwright/README.md` + `recordings/README.md`
10. Write `IMPLEMENTATION_NOTES.md`
11. Validate: dry-run + check-types + Playwright list
12. Commit on `gtm-demo-assets`
