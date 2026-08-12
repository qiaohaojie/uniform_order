# Production Deployment Guide — UniformOrder

This guide provides comprehensive, step-by-step instructions for deploying the **UniformOrder** multi-tenant online uniform shop platform to production on Hostinger Cloud Startup Node.js infrastructure.

---

## 1. System Overview & Production Architecture

UniformOrder is designed as a standalone Next.js 16 application configured for self-hosted Node.js container environments (non-Vercel).

### Production Architecture Stack
- **Framework & Runtime:** Next.js 16 (App Router, Node.js 22.x LTS runtime in `output: "standalone"` mode)
- **Deployment Host:** Hostinger Cloud Startup Node.js application hosting
- **Production Domain:** `uniformorder.online`
- **Database:** Neon PostgreSQL (Provisioned in **AWS `ap-southeast-2` Sydney** for low latency)
- **ORM:** Drizzle ORM
- **Authentication:** Neon Auth (Magic Link & Google OAuth)
- **Payment Processing:** Stripe Connect Standard (Destination charges with optional platform application fees)
- **Catalog Asset Storage:** UploadThing (Product images & garment vectors)
- **Transactional Email:** Emailit (React Email templates)
- **Product Analytics:** PostHog

---

## 2. Pre-Deployment Preparation & External Services

Before deploying the application files, provision and configure external services:

### 2.1 Database Provisioning (Neon Postgres in Sydney)
1. Log into [Neon Console](https://console.neon.tech).
2. Create a production project named `uniformorder-prod`.
3. **Region Selection:** Explicitly select **AWS `ap-southeast-2` (Sydney)** to minimize latency for Australian school operations.
4. Copy the pooled connection string (`DATABASE_URL`).
5. Run migrations against the production database:
   ```bash
   DATABASE_URL="postgresql://user:pass@ep-xyz.ap-southeast-2.aws.neon.tech/neondb?sslmode=require" pnpm --filter web exec drizzle-kit migrate
   ```
6. Seed baseline tenant data:
   ```bash
   cd apps/web && DATABASE_URL="<production_database_url>" node scripts/seed.mjs && cd ../..
   ```

### 2.2 Stripe Connect Production Setup
1. In the [Stripe Dashboard](https://dashboard.stripe.com), enable **Stripe Connect Standard**.
2. Retrieve your Live API Keys: `STRIPE_SECRET_KEY` (`sk_live_...`) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_...`).
3. Configure Webhook Endpoint:
   - **URL:** `https://uniformorder.online/api/stripe/webhook`
   - **Events to listen for:**
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `account.updated`
     - `charge.refunded`
4. Copy the signing secret (`STRIPE_WEBHOOK_SECRET`).

### 2.3 UploadThing, Emailit & PostHog Setup
- **UploadThing:** Retrieve your production v7 token (`UPLOADTHING_TOKEN`).
- **Emailit:** Retrieve `EMAILIT_API_KEY` and set a verified `FROM_EMAIL` (e.g., `orders@uniformorder.online` or `support@pimspace.com`).
- **PostHog:** Retrieve production API keys (`NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_SERVER_KEY`) and set host (`https://us.i.posthog.com`).

---

## 3. Production Environment Variables Reference

Configure all variables in Hostinger hPanel under **Advanced → Node.js → Environment Variables**:

| Variable Name | Description | Required Format / Example |
|---|---|---|
| `NODE_ENV` | Node runtime environment | `production` |
| `DATABASE_URL` | Neon Postgres Sydney Connection String | `postgresql://user:pass@ep-xyz.ap-southeast-2.aws.neon.tech/neondb?sslmode=require` |
| `NEON_AUTH_BASE_URL` | Neon Auth production host URL | `https://auth.uniformorder.online` |
| `NEON_AUTH_COOKIE_SECRET` | Secret key for session cookies (≥ 32 bytes) | `64_char_random_hex_string` |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated super-admin allowlist | `support@pimspace.com,admin@uniformorder.online` |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL of the application | `https://uniformorder.online` |
| `STRIPE_SECRET_KEY` | Stripe Live Secret Key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Live Publishable Key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret | `whsec_...` |
| `STRIPE_APPLICATION_FEE_BPS` | Platform fee in basis points (e.g. `200` = 2.0%) | `0` |
| `UPLOADTHING_TOKEN` | UploadThing server token | `eyJ...` |
| `EMAILIT_API_KEY` | Emailit API Key | `em_live_...` |
| `FROM_EMAIL` | Transactional email sender address | `support@pimspace.com` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Public Key | `phc_...` |
| `POSTHOG_SERVER_KEY` | PostHog Server Key | `phc_...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog Ingestion Host | `https://us.i.posthog.com` |

---

## 4. Parent-Facing Application (Production Deployment)

The parent portal in production serves public school uniform shops, enabling mobile ordering, live Stripe checkout, and automated pickup notifications.

### 4.1 Configuration Requirements
- **Canonical App URL (`NEXT_PUBLIC_APP_URL`):** Must be set to `https://uniformorder.online` so payment redirects and webhook callbacks construct valid URLs.
- **Live Stripe Payment Element:** Ensures live credit card, Apple Pay, and Google Pay transactions execute securely.
- **Apple Pay Domain Verification:**
  1. Go to Stripe Dashboard → Settings → Payment methods → Apple Pay → Add domain (`uniformorder.online`).
  2. Download the verification file provided by Stripe.
  3. Place the file at: `apps/web/public/.well-known/apple-developer-merchantid-domain-association`.
  4. Commit and upload the file to your production server.
- **Transactional Customer Emails:** When an operator marks an order as **Ready for Pickup**, Emailit sends an automated notification email to the parent using the `FROM_EMAIL` sender address.

### 4.2 Parent Shop Production Verification Checklist
- [ ] **Catalog Browsing:** Access `https://uniformorder.online/imhs` on mobile and desktop. Verify categories, search filters, and garment vector rendering.
- [ ] **Checkout Flow:** Add an item to cart, fill in student details, and verify Stripe Payment Element loads securely over HTTPS.
- [ ] **Apple Pay / Digital Wallets:** Verify Apple Pay tab displays on iOS devices.
- [ ] **Order Confirmation:** Verify parent is redirected to `/imhs/orders/[orderId]` upon successful checkout.
- [ ] **Parent Order History:** Log in as a parent via Neon Auth magic link and verify order history displays correctly.

---

## 5. Admin-Facing Application (Production Deployment)

The admin portal in production handles sensitive financial transactions, order fulfillment, catalog changes, and school onboarding.

### 5.1 Security & Access Control
- **Strict HTTPS & Security Headers:** `next.config.ts` enforces HSTS (`max-age=63072000`), Content-Security-Policy (CSP) nonces, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
- **Authorization Enforcement:** Operator routes (`/admin/[tenant]/*`) strictly validate the logged-in session against the tenant's `shop_email` stored in PostgreSQL or the `PLATFORM_ADMIN_EMAILS` environment variable.
- **Disabled Dev Routes:** Dev login endpoints (`/api/dev/*`) are automatically disabled when `NODE_ENV=production`.

### 5.2 Stripe Connect Account Onboarding
- Schools onboard their bank accounts via Stripe Express Connect.
- When an onboarded school completes Stripe verification, Stripe emits an `account.updated` webhook.
- The webhook updates `tenants.stripe_charges_enabled = true` in PostgreSQL, enabling live checkout payouts for that school.

### 5.3 Catalog Image Uploads & Financial Reports
- **UploadThing Token:** Ensure `UPLOADTHING_TOKEN` is set in Hostinger environment variables so school operators can upload product photos in `/admin/[tenant]/catalog`.
- **GST / BAS CSV Export:** Test `/admin/[tenant]/reports` to verify Australian 10% GST calculation summaries and CSV exports.

### 5.4 Admin Portal Production Verification Checklist
- [ ] **Operator Login:** Access `https://uniformorder.online/admin/imhs` with authorized operator credentials. Confirm unauthorized emails are denied access.
- [ ] **Kanban Board Updates:** Drag an order from **Paid** to **To Prepare** and **Ready for Pickup**. Confirm order status updates in Neon Postgres.
- [ ] **Email Notification Trigger:** Confirm ready-for-pickup email is delivered to the parent's inbox upon moving order status to Ready.
- [ ] **Batch Pick-Slip Printing:** Select multiple orders and click **Batch Print Pick Slips**. Verify print stylesheet layout formatted for A4.
- [ ] **Platform Console Access:** Access `https://uniformorder.online/platform` with emails listed in `PLATFORM_ADMIN_EMAILS`. Verify tenant onboarding drawer and approval controls.

---

## 6. Build Process & Hostinger Deployment Runbook

UniformOrder utilizes Next.js standalone mode (`output: "standalone"` in `apps/web/next.config.ts`), generating a minimal, self-contained production bundle.

### 6.1 Build the Production Bundle Locally / CI

1. Clean install dependencies:
   ```bash
   pnpm install --frozen-lockfile
   ```
2. Run type check gate:
   ```bash
   pnpm check-types
   ```
3. Build production web bundle:
   ```bash
   pnpm build:web
   ```

### 6.2 Prepare Standalone Deployment Package

The build command outputs the standalone server at `apps/web/.next/standalone/`. Copy static assets into the standalone bundle directory:

```bash
# Copy static assets into the standalone bundle structure
cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cp -R apps/web/public apps/web/.next/standalone/apps/web/public
```

### 6.3 Deploy to Hostinger Cloud Startup

1. **Upload Files:**
   - Connect to Hostinger via SFTP or SSH.
   - Upload the contents of `apps/web/.next/standalone/` (including the copied `public` and `.next/static` directories) to your Node.js application directory on Hostinger.

2. **Configure Node.js in Hostinger hPanel:**
   - Log into **Hostinger hPanel**.
   - Navigate to **Websites → Manage → Advanced → Node.js**.
   - Set **Node.js Version** to `22.x`.
   - Set **Application Startup File**: `apps/web/server.js` (or `server.js`).
   - Input all production Environment Variables (Section 3).
   - Click **Save** and **Restart Node.js App**.

> **Important:** Any time environment variables are added or modified in Hostinger hPanel, you **must explicitly restart the Node.js application** for the changes to take effect.

---

## 7. Post-Deployment Operations & Webhook Audit

After deployment, perform these ongoing operational checks:

- **Stripe Webhook Health:** Check [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks). Confirm recent events report HTTP status `200 OK`.
- **PostHog Live Events:** Check [PostHog Dashboard](https://us.posthog.com). Confirm live pageviews and telemetry events from `uniformorder.online`.
- **Security & Support:**
  - Security vulnerability reports should be directed to `support@pimspace.com` (refer to `SECURITY.md`).
  - Maintenance & infrastructure questions: PimSpace Operations Team (`support@pimspace.com`).
