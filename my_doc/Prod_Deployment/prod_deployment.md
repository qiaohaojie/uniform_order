# Production Deployment Guide — Uniform Online Order System

**Purpose:** AI-executable step-by-step guide for deploying to Hostinger (Node.js).  
**Assumptions:** All dev work is complete and merged to `main`. You are running from the repo root.

---

## 0. Prerequisites checklist (verify before starting)

- [ ] All feature branches merged to `main`; `pnpm check-types:web` passes
- [ ] Stripe live-mode keys obtained from Stripe Dashboard → Developers → API Keys
- [ ] Production domain purchased and pointed at Hostinger (A-record or CNAME)
- [ ] Hostinger plan supports Node.js 20+ (Business or Cloud Startup tier)
- [ ] Emailit account confirmed working in prod (same API key works across envs)
- [ ] PostHog project key noted (same key works across envs unless you want separate projects)

---

## 1. Create production Neon database

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
   - Name: `uniform_order_prod`
   - Region: `ap-southeast-2` (Sydney — closest to NSW users)
   - Postgres version: 17
2. Copy the connection string. It looks like:
   ```
   postgresql://user:password@ep-xxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Save it as `PROD_DATABASE_URL` — you'll need it in step 3.

---

## 2. Run all database migrations against production

From the repo root, with `PROD_DATABASE_URL` in your shell:

```bash
cd apps/web
DATABASE_URL="<paste PROD_DATABASE_URL here>" ./node_modules/.bin/drizzle-kit migrate
```

Expected output: `applying migrations... 0000 ✓ 0001 ✓ 0002 ✓ 0003 ✓`

Verify:
```bash
# Use Neon MCP or psql to confirm
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Should include: tenants, orders, order_lines, order_refunds, catalog_items, catalog_variants

SELECT enum_range(NULL::order_status);
-- Should include: pending_payment, new, packing, ready, collected, partially_refunded, refunded
```

---

## 3. Seed production tenants

Run the seed script (or apply manually via Neon MCP):

```sql
INSERT INTO tenants (id, name, short, accent, motto, address, shop_hours, shop_email, platform_approval_status, platform_approved_at, platform_approved_by)
VALUES
  ('nsbh', 'North Sydney Boys High School', 'NSBH', '#7A1F2B',
   'Honour Above All', '45 Miller St, North Sydney NSW 2060',
   'Tue & Thu 8:00–9:00am, Fri 3:00–4:00pm',
   'uniformshop@nsbh.nsw.edu.au',
   'approved', now(), 'platform'),
  ('rgsh', 'Riverside Girls High School', 'RGHS', '#1A3C5E',
   'Persevere and Achieve', '1 Valentia St, Gladesville NSW 2111',
   'Mon & Wed 8:00–9:00am',
   'uniformshop@rghs.nsw.edu.au',
   'approved', now(), 'platform')
ON CONFLICT (id) DO NOTHING;
```

Seed catalog items from the existing dev data or via the admin Bulk Upload UI once the app is live.

---

## 4. Set up Stripe live mode

### 4a. Stripe platform account
Already set up. Switch to **Live mode** in the Stripe Dashboard.

Live keys to collect:
- `STRIPE_SECRET_KEY` → `sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`

### 4b. Stripe Connect — onboard each school (NSBH, RGSH)

Each school needs its own Stripe Express account so the platform can route payments and issue refunds correctly.

1. In Stripe Dashboard (live mode) → **Connect** → **Accounts** → **Create account**
   - Type: Express
   - Country: AU
   - Email: the school's shop email (e.g. `uniformshop@nsbh.nsw.edu.au`)
2. Complete the Express onboarding link (Stripe will email the school, or you can generate the link manually via the API):
   ```bash
   curl https://api.stripe.com/v1/account_links \
     -u sk_live_...: \
     -d "account=acct_XXXXXXXXXXXXXXXX" \
     -d "refresh_url=https://uniformorder.online/admin/nsbh/settings" \
     -d "return_url=https://uniformorder.online/admin/nsbh/settings" \
     -d "type=account_onboarding"
   # Returns a URL — send to the school to complete onboarding
   ```
3. Once the school completes onboarding, `charges_enabled` and `payouts_enabled` become `true`.
4. The `account.updated` webhook (already wired) will automatically sync these to `tenants.stripe_charges_enabled` and `tenants.stripe_payouts_enabled`.
5. Until step 4 fires, you can manually set:
   ```sql
   UPDATE tenants SET stripe_account_id = 'acct_XXXXXXXXXXXXXXXX' WHERE id = 'nsbh';
   -- stripe_charges_enabled / stripe_payouts_enabled will be set by webhook
   ```

### 4c. Stripe webhook endpoint (live mode)

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
   - URL: `https://uniformorder.online/api/stripe/webhook`
   - Events to listen to:
     - `payment_intent.succeeded`
     - `account.updated`
     - `charge.refunded`
     - `charge.refund.updated`
2. Copy the **Signing secret** (`whsec_...`) — this becomes `STRIPE_WEBHOOK_SECRET`.

---

## 5. Configure Neon Auth (production)

1. In Neon Console → your production project → **Auth** tab → enable Neon Auth.
2. Copy the auth configuration — it auto-provisions the `neon_auth` schema and tables.
3. Note any new environment variables Neon Auth requires (typically just `DATABASE_URL` is sufficient as it reads from the same DB).
4. Set `PLATFORM_ADMIN_EMAILS` to your admin email(s) in the Hostinger env vars.

---

## 6. Configure Hostinger Node.js deployment

### 6a. Upload code

Hostinger Node.js uses a ZIP upload or Git integration:

```bash
# From repo root — build first
pnpm build:web

# The standalone output is at apps/web/.next/standalone
# Copy the required files into a deployment package:
cp -r apps/web/.next/standalone ./deploy
cp -r apps/web/.next/static ./deploy/apps/web/.next/static
cp -r apps/web/public ./deploy/apps/web/public
```

Zip and upload to Hostinger, or connect your GitHub repo via Hostinger's Git deployment panel.

### 6b. Set Node.js entry point

In Hostinger hPanel → Node.js → **Application startup file**:
```
apps/web/server.js
```

### 6c. Set environment variables

In Hostinger hPanel → Node.js → **Environment variables**, set all of the following:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `postgresql://...` | Production Neon connection string |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Live mode |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Live mode |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From step 4c |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | |
| `EMAILIT_API_KEY` | `...` | Emailit API key |
| `EMAIL_FROM` | `noreply@uniformorder.online` | Sender address |
| `PLATFORM_ADMIN_EMAILS` | `george.qiao@pimspace.com` | Comma-separated |
| `NEXTAUTH_URL` | `https://uniformorder.online` | (if required by Neon Auth) |

### 6d. Set Node.js version

Hostinger hPanel → Node.js → version: **20.x** (minimum).

---

## 7. Domain + TLS

1. Hostinger hPanel → **Domains** → point your domain to the Node.js app.
2. Enable **SSL/TLS** (Let's Encrypt) — Hostinger does this automatically for custom domains.
3. Verify HSTS header is returned: `curl -I https://uniformorder.online` should show `Strict-Transport-Security: max-age=63072000`.

---

## 8. Post-deploy smoke test checklist

Run these after the first deployment. Each step can be done by an AI agent with browser access.

- [ ] `https://uniformorder.online` loads (→ school picker or NSBH home)
- [ ] `https://uniformorder.online/nsbh` — parent catalog loads, PostHog pageview fires
- [ ] `https://uniformorder.online/nsbh/checkout` — Stripe Elements render, no CSP errors
- [ ] Place a real order with Stripe test card `4242 4242 4242 4242` (switch to test keys temporarily if not yet live, or use live mode with a real card)
- [ ] Stripe webhook delivers `payment_intent.succeeded` → order status flips to `new` in DB
- [ ] Confirmation email arrives at the receipt email address
- [ ] `https://uniformorder.online/admin/nsbh/dashboard` — loads, shows the order
- [ ] Refund partial amount from admin order detail → `order_refunds` row created, `charge.refunded` webhook fires
- [ ] PostHog dashboard shows events from the session (pageviews, refund_issued)
- [ ] CSP: zero "Refused to load" errors in browser DevTools across all 4 pages
- [ ] `curl -I https://uniformorder.online/nsbh` — verify `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY` all present

---

## 9. Known gaps to address before go-live (from remaining_work.md)

These items are tracked in `docs/remaining_work.md`. Do not deploy to a paying school until resolved:

| Item | Status |
|------|--------|
| Catalog seeded with all NSBH paper-form items (§3.1) | Pending |
| Accountant sign-off on GST report (§3.6) | Pending |
| Stripe Connect onboarded for NSBH + RGSH (required for checkout) | Pending |
| Test 3 (refund E2E) verified after Stripe Connect setup | Pending |
| Super-admin portal for onboarding tenant #3+ (§2.2) | Pending (not needed for NSBH launch) |
| Production build CSP check — `unsafe-eval` absent in prod bundle | Pending (verify during step 8) |
