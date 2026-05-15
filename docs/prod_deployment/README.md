# Production Deployment — UniformOrder

**Domain:** `uniformorder.online`  
**Host:** Hostinger Cloud Startup (Node.js)  
**DB:** Neon project `cool-wind-76972110` (ap-southeast-2)

Legend: 🤖 Claude can do this · 🖥️ run in your terminal · 🌐 manual dashboard step

---

## 1. Neon — run pending migrations

🤖 **Tell Claude:** "Run production migrations on Neon project cool-wind-76972110"

Claude applies all 15 SQL files (`0000` → `0014`) via `mcp__Neon__run_sql_transaction` and inserts the corresponding rows into `__drizzle_migrations`. If you want to do it yourself:

```
Neon Console → cool-wind-76972110 → SQL Editor
```
Paste each file in `apps/web/drizzle/` in numeric order; then insert into `__drizzle_migrations` manually (see memory note on drizzle-kit websocket blocker).

> The Neon DB is shared between dev and prod. Migrations are idempotent (all use `IF NOT EXISTS` / `DO UPDATE`). Running them again is safe.

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
| `DATABASE_URL` | 🤖 Ask Claude: "Get the Neon connection string for cool-wind-76972110" |
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

🤖 **Or tell Claude:** "Run the NSBH seed against Neon project cool-wind-76972110" — Claude can insert catalog rows directly via `mcp__Neon__run_sql_transaction`.

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

🤖 **Tell Claude:** "Run: UPDATE tenants SET is_publicly_listed = true WHERE id IN ('nsbh','rgsh') on Neon project cool-wind-76972110"

---

## Post-deploy ops checklist

- [ ] PostHog receiving events from `uniformorder.online` (check Live Events)
- [ ] Stripe webhook delivering (Dashboard → Webhooks → recent deliveries all 200)
- [ ] Apple Pay shows in checkout wallet tab on iPhone (requires real device + live mode)
- [ ] GST/BAS report reviewed by accountant (send `/admin/nsbh/reports` screenshot)
