# Production Deployment — UniformOrder

**Domain:** `uniformorder.online`  
**Host:** Hostinger Cloud Startup (Node.js)  
**DB:** Neon project in **AWS ap-southeast-2 (Sydney)** — must be created manually (see Step 1)

Legend: 🤖 Claude can do this · 🖥️ run in your terminal · 🌐 manual dashboard step

---

## 1. Neon — create the production project (manual, then handoff to Claude)

The Neon MCP `create_project` tool has **no region parameter** — it always lands in `us-east-1`. Because Hostinger hosts in AU, the production project must be created by hand in the Console so the region is Sydney.

### 1a. 🌐 Create the project (you)

[Neon Console → New Project](https://console.neon.tech/app/projects/new)

- **Name:** `uniformorder-prod` (or similar)
- **Region:** **AWS ap-southeast-2 (Sydney)** ← do not accept the default
- **Postgres version:** match dev (currently 16)

Copy the **project ID** (looks like `super-cell-XXXXXXXX`) and the **pooled `DATABASE_URL`** from the Connection Details panel.

### 1b. 🤖 Provision schema + seed (Claude)

Tell Claude:

> "Provision production Neon project `<project-id>` — apply schema, insert all `__drizzle_migrations` rows, seed `nsbh` + `rgsh` tenants and their `tenant_settings`."

Claude will, via Neon MCP `run_sql_transaction`:
- Apply the final schema DDL (all 13 tables) in one shot — skipping incremental migration replay, which is unsafe on neon-http (see `project_drizzle_kit_websocket_blocker` in memory).
- Insert all 15 rows into `drizzle.__drizzle_migrations` with hashes matching the dev project, so future `drizzle-kit generate` runs diff correctly.
- Insert both tenants (`nsbh`, `rgsh`) with `is_publicly_listed = true` and `platform_approval_status = 'approved'`.
- Insert `tenant_settings` rows for both tenants.

Once complete, paste the pooled `DATABASE_URL` into Hostinger env vars (Step 6).

### 1c. ⚠️ Old us-east-1 project

If a prior us-east-1 project exists from earlier provisioning attempts (e.g. `super-cell-03401356`), ask Claude to delete it after the Sydney project is live and verified:

> "Delete Neon project `<old-project-id>`."

---

## 2. Stripe — switch to live keys + create webhook

### 2a. Get live keys

🌐 [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)

Copy:
- **Secret key** → `STRIPE_SECRET_KEY` (starts `sk_live_…`)
- **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (starts `pk_live_…`)

### 2b. Create production webhook

🤖 **Tell Claude:** "Create a Stripe live-mode webhook for https://uniformorder.online/api/stripe/webhook listening to: payment_intent.succeeded, payment_intent.payment_failed, account.updated, charge.refunded"

Claude runs this via `mcp__plugin_stripe_stripe__stripe_api_execute`. Outputs a signing secret → set as `STRIPE_WEBHOOK_SECRET`.

Or manually:
🌐 Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://uniformorder.online/api/stripe/webhook`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `charge.refunded`

### 2c. Onboard NSBH Stripe Express account

🌐 Stripe Dashboard → Connect → Accounts → Create  
Complete Express onboarding for NSBH. Once `charges_enabled = true`, the `account.updated` webhook syncs it to `tenants.stripe_charges_enabled`.

### 2d. Set application fee

`STRIPE_APPLICATION_FEE_BPS` — set to your platform fee in basis points (e.g. `200` = 2%). Set `0` if not charging a fee yet.

---

## 3. Apple Pay — domain verification file

🌐 [Stripe Dashboard → Settings → Payment methods → Apple Pay → Add domain](https://dashboard.stripe.com/settings/payment_method_domains)

Add `uniformorder.online`. Stripe shows a file to download.

🖥️ Replace the placeholder:
```bash
# paste the Stripe-provided file content into:
apps/web/public/.well-known/apple-developer-merchantid-domain-association
git add apps/web/public/.well-known/apple-developer-merchantid-domain-association
git commit -m "chore: add real Apple Pay domain verification file"
git push
```

---

## 4. UploadThing — get token

🌐 [UploadThing Dashboard → API Keys](https://uploadthing.com/dashboard) → copy the v7 token

→ `UPLOADTHING_TOKEN`

---

## 5. PostHog — verify prod key

🌐 [PostHog → Project Settings → Project API key](https://us.posthog.com/settings/project)

Confirm `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_SERVER_KEY` match the production project (project ID 411893 "UniformOrder"). `POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`.

---

## 6. Set all env vars in Hostinger hPanel

🌐 hPanel → Hosting → your Node.js app → **Advanced → Node.js → Environment Variables**

Set every variable below, then click **Restart**:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Pooled connection string from the Sydney project (Step 1) |
| `NEON_AUTH_BASE_URL` | Neon Console → Auth → copy the base URL |
| `NEON_AUTH_COOKIE_SECRET` | Neon Console → Auth → copy the cookie secret |
| `STRIPE_SECRET_KEY` | Step 2a |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Step 2a |
| `STRIPE_WEBHOOK_SECRET` | Step 2b (starts `whsec_…`) |
| `STRIPE_APPLICATION_FEE_BPS` | Step 2d |
| `UPLOADTHING_TOKEN` | Step 4 |
| `NEXT_PUBLIC_POSTHOG_KEY` | Step 5 |
| `POSTHOG_SERVER_KEY` | Step 5 |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |
| `POSTHOG_HOST` | `https://us.i.posthog.com` |
| `NEXT_PUBLIC_APP_URL` | `https://uniformorder.online` |
| `PLATFORM_ADMIN_EMAILS` | `george.qiao@pimspace.com` (comma-separate more if needed) |
| `EMAILIT_API_KEY` | Your Emailit dashboard |
| `FROM_EMAIL` | Verified sending address in Emailit |
| `NODE_ENV` | `production` |

---

## 7. Build and deploy

🖥️ Run locally:
```bash
pnpm build:web
```

Output lands in `apps/web/.next/standalone/`. Upload to Hostinger:

🌐 hPanel → File Manager → upload `.next/standalone/` contents to your Node.js app root  
(or use the Hostinger Git deploy if configured)

Start command: `node server.js`

---

## 8. Seed NSBH catalog

🖥️ Run once after deploy (reads `DATABASE_URL` from `.env.local` — point it at prod first, or pass inline):

```bash
cd apps/web
DATABASE_URL="<prod-url>" node scripts/seed.mjs
```

🤖 **Or tell Claude:** "Run the NSBH seed against Neon project `<sydney-project-id>`" — Claude inserts catalog rows directly via `mcp__Neon__run_sql_transaction`.

---

## 9. Smoke test

Run through this sequence on `https://uniformorder.online`:

- [ ] Home → pick NSBH → catalog loads
- [ ] Add items → checkout → Stripe test card `4242 4242 4242 4242` → order placed
- [ ] Admin `/admin/nsbh/orders` → order appears in To Prepare
- [ ] Mark ready → ready email received at parent email
- [ ] Mark completed → Completed column
- [ ] Reports → GST summary shows the order
- [ ] CSV export downloads correctly
- [ ] Image upload in catalog item drawer saves a `utfs.io` URL

---

## 10. Verify `is_publicly_listed`

Both tenants are seeded with `is_publicly_listed = true` in Step 1b. After deploy, confirm via:

🤖 Tell Claude: "Show `slug, is_publicly_listed, platform_approval_status` for all rows in `tenants` on Neon project `<sydney-project-id>`."

---

## Post-deploy ops checklist

- [ ] PostHog receiving events from `uniformorder.online` (check Live Events)
- [ ] Stripe webhook delivering (Dashboard → Webhooks → recent deliveries all 200)
- [ ] Apple Pay shows in checkout wallet tab on iPhone (requires real device + live mode)
- [ ] GST/BAS report reviewed by accountant (send `/admin/nsbh/reports` screenshot)
