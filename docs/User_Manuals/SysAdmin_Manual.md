# System Administrator & Platform Operations Manual

This manual is for **System Administrators, Platform Operators, DevOps Engineers, and IT Systems Personnel** responsible for maintaining, deploying, configuring, and monitoring the UniformOrder infrastructure.

---

## 📋 Table of Contents

1. [System Architecture & Stack Overview](#1-system-architecture--stack-overview)
2. [Environment Variables & Configuration Matrix](#2-environment-variables--configuration-matrix)
3. [Database Architecture & Migrations](#3-database-architecture--migrations)
4. [Platform Super-Admin Console (`/platform`)](#4-platform-super-admin-console-platform)
5. [Production Deployment Runbook (Hostinger Cloud Startup)](#5-production-deployment-runbook-hostinger-cloud-startup)
6. [Stripe Connect Architecture & Webhooks](#6-stripe-connect-architecture--webhooks)
7. [Security, Access Control & Audit Event Logging](#7-security-access-control--audit-event-logging)
8. [Monitoring, Maintenance & Disaster Recovery](#8-monitoring-maintenance--disaster-recovery)

---

## 1. System Architecture & Stack Overview

UniformOrder is built as a high-performance TypeScript monorepo hosted on **Hostinger Cloud Startup** (Node.js standalone runtime) connected to **Neon Postgres** in Sydney (`ap-southeast-2`).

```
                               ┌──────────────────────────────────────────┐
                               │           Hostinger Cloud Node           │
                               │      (output: "standalone", Node 22)     │
                               └────────────────────┬─────────────────────┘
                                                    │
             ┌──────────────────────────────────────┼──────────────────────────────────────┐
             ▼                                      ▼                                      ▼
┌───────────────────────────┐          ┌───────────────────────────┐          ┌───────────────────────────┐
│     Next.js 16 App Router │          │   Neon Postgres Database  │          │  Stripe Connect Standard  │
│  (Parent + Admin + Ops)   │          │  (Drizzle ORM, Sydney AU) │          │ (Destination Charges/Fees)│
└────────────┬──────────────┘          └────────────┬──────────────┘          └────────────┬──────────────┘
             │                                      │                                      │
             ├─ Neon Auth (Magic / Google)          ├─ Schema Migrations (Drizzle Kit)     ├─ Payment Element Checkout
             ├─ Emailit API (React Email)           ├─ Batch Queries (db.batch)            ├─ Webhook Idempotency
             └─ UploadThing (Image CDN)             └─ Audit Logs & Event Queues           └─ Platform Application Fee
```

### Technology Matrix

| Layer | Choice | Details |
|---|---|---|
| **App Framework** | Next.js 16 (App Router) | Server-Side Rendering (RSC) + Client Companions (`*-screen.tsx`). |
| **Monorepo Manager** | `pnpm` workspaces | Workspaces root with `apps/web` application package. |
| **Database & ORM** | Neon Postgres + Drizzle ORM | Serverless Postgres located in `ap-southeast-2` (Sydney). |
| **Auth Provider** | Neon Auth | Magic link email sign-in & Google OAuth 2.0. |
| **Payments** | Stripe Connect Standard | Direct seller-of-record payouts to P&C bank accounts. |
| **Transactional Email** | Emailit | Custom React Email templates with idempotency headers. |
| **Image Hosting** | UploadThing | Secure CDN uploads for uniform garment imagery. |
| **Analytics** | PostHog | Product analytics and conversion tracking. |
| **Target Host** | Hostinger Cloud Startup | Node.js runtime (`output: "standalone"`). **Not Vercel.** |

---

## 2. Environment Variables & Configuration Matrix

Environment variables are loaded via `.env.local` for local development and managed through **Hostinger hPanel** in production.

> ⚠️ **CRITICAL**: Hostinger Cloud Startup Node.js applications require a **full app restart** from hPanel after updating environment variables for changes to take effect.

```bash
# ─── DATABASE ─────────────────────────────────────────────────────────────
DATABASE_URL="postgres://user:pass@ep-cool-pool-123456.ap-southeast-2.aws.neon.tech/neondb?sslmode=require"

# ─── NEON AUTH ───────────────────────────────────────────────────────────
NEON_AUTH_BASE_URL="https://auth.uniformorder.online"
NEON_AUTH_COOKIE_SECRET="super-secret-at-least-32-bytes-long-random-string"

# ─── PLATFORM CONTROL ───────────────────────────────────────────────────
PLATFORM_ADMIN_EMAILS="admin@uniformorder.online,sysadmin@pimspace.com"
NEXT_PUBLIC_APP_URL="https://uniformorder.online"

# ─── STRIPE CONNECT ──────────────────────────────────────────────────────
STRIPE_SECRET_KEY="sk_live_51M..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51M..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_APPLICATION_FEE_BPS="50" # Basis points (50 bps = 0.50%)

# ─── THIRD PARTY SERVICES ─────────────────────────────────────────────────
UPLOADTHING_TOKEN="eyJhbGci..."
EMAILIT_API_KEY="em_live_..."
FROM_EMAIL="orders@uniformorder.online"
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

---

## 3. Database Architecture & Migrations

Database interactions utilize Drizzle ORM (`apps/web/src/db/schema.ts`). Connection pooling is configured for serverless execution.

### Database Commands

```bash
# Run from repository root
pnpm check-types          # Verify TypeScript schema & query types

# Run drizzle-kit migrations against Neon DB
pnpm --filter web exec drizzle-kit migrate

# Seed database with initial tenant & catalog fixtures
cd apps/web && node scripts/seed.mjs
```

### Key DB Design Principles
1. **Neon HTTP Batching**: Neon HTTP does not support interactive transactions (`db.transaction(...)`). Use `db.batch([...])` when multi-table writes are required.
2. **Legal Versioning**: Tenant legal refund policies (`tenant_legal_versions`) are linked via UUID references to maintain consent auditability for Australian Consumer Law compliance.
3. **Idempotency Indexing**: `orders.stripePaymentIntentId` and `order_events.orderId (order_paid)` have unique database indexes to prevent duplicate order creation or audit events during Stripe webhook retries.

---

## 4. Platform Super-Admin Console (`/platform`)

The Platform Console (`https://uniformorder.online/platform`) is restricted to emails configured in `PLATFORM_ADMIN_EMAILS`.

```
┌────────────────────────────────────────────────────────────────────────┐
│ UNIFORM ORDER · PLATFORM MANAGEMENT CONSOLE                            │
├────────────────────────────────────────────────────────────────────────┤
│ PENDING TENANT APPROVAL QUEUE                                          │
│                                                                        │
│ Tenant Name           Slug    Stripe Connected   Status     Action     │
│ Riverside Academy     rgsh    Yes (acct_1N...)   Pending    [ Approve ]│
│ St Patrick's Primary  stpat   No                 Blocked    [ View ]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Operations Tasks
1. **Provisioning New School Tenants**:
   - Access `/platform/tenants/new`.
   - Enter Tenant ID (slug, e.g. `imhs`), School Name, Short Code, Primary Contact Email, Accent Color.
2. **Tenant Approval Queue**:
   - Review pending schools (`/platform/tenants`).
   - Verify that the school P&C has completed Stripe Connect onboarding (`stripeAccountId` set, `charges_enabled: true`).
   - Click **"Approve Tenant"**. Approval sets `platformApprovalStatus = "approved"`, publicly listing the school and unlocking their operator catalog editor.

---

## 5. Production Deployment Runbook (Hostinger Cloud Startup)

UniformOrder deploys to Hostinger Cloud Startup running a Node.js process using Next.js standalone output.

### Build Process
```bash
# Clean build artifacts
rm -rf apps/web/.next

# Generate Next.js App Router types
pnpm --filter web exec next typegen

# Execute production build
pnpm build:web
```

### Hostinger Deployment Steps
1. Push production-tested commits to `main`.
2. Connect to Hostinger via SSH or hPanel Git deployment runner.
3. Install dependencies: `pnpm install --frozen-lockfile`.
4. Run migrations: `pnpm --filter web exec drizzle-kit migrate`.
5. Execute build: `pnpm build:web`.
6. Copy standalone output assets if necessary:
   ```bash
   cp -R apps/web/public apps/web/.next/standalone/apps/web/
   cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
   ```
7. Restart Node.js application process in Hostinger hPanel.
8. Verify production domain HTTP response and security headers:
   ```bash
   curl -I https://uniformorder.online
   ```

---

## 6. Stripe Connect Architecture & Webhooks

UniformOrder utilizes **Stripe Connect Standard** destination charges.

```
Parent Pay Card ──► Stripe Payment Intent ──► 99.5% Direct to P&C Bank Account
                                          └──► 0.5% Platform Fee (STRIPE_APPLICATION_FEE_BPS)
```

### Webhook Endpoint Configuration
- **Webhook URL**: `https://uniformorder.online/api/stripe/webhook`
- **Signing Secret**: Set as `STRIPE_WEBHOOK_SECRET` in environment variables.

### Handled Webhook Events

| Stripe Event | System Action |
|---|---|
| `payment_intent.succeeded` | Validates payment, writes order to Neon DB, triggers `order_paid` audit event, sends parent confirmation email. |
| `payment_intent.payment_failed` | Logs payment failure in audit events table. |
| `charge.refunded` | Updates order `refundedAmountCents` and `payment_status` (`partially_refunded` or `refunded`), sends refund email. |
| `account.updated` | Updates tenant `stripeChargesEnabled` and `stripePayoutsEnabled` flags in DB. |

---

## 7. Security, Access Control & Audit Event Logging

### Security Headers
Security headers are configured in `apps/web/next.config.ts`:
- **HTTP Strict Transport Security (HSTS)**: `max-age=63072000; includeSubDomains; preload`
- **Content Security Policy (CSP)**: Nonce-based execution for inline scripts, restricting script/frame origins to authorized providers (Stripe, PostHog, UploadThing).
- **X-Frame-Options**: `DENY` to prevent clickjacking.
- **X-Content-Type-Options**: `nosniff`.

### Audit Event Logging
All critical administrative and financial actions are logged to the `audit_events` Postgres table:
- **Columns**: `id`, `createdAt`, `tenantId`, `actorEmail`, `actorRole`, `action`, `targetType`, `targetId`, `payload`.
- Actions tracked include order refunds, legal policy updates, catalog alterations, tenant approvals, and setting changes.

---

## 8. Monitoring, Maintenance & Disaster Recovery

### Health Checks & Automated Verification
Run automated type safety and schema consistency checks in CI:
```bash
pnpm check-types
```

### Database Backup & Point-In-Time Recovery
- Neon Postgres provides automatic daily backups and continuous point-in-time recovery (PITR) in the Sydney AWS region (`ap-southeast-2`).
- To initiate a database restore, log into the Neon Console, select the project timeline, and create a branch or restore point from the desired timestamp.

### Troubleshooting Production Incidents

#### Issue: Webhook failure / Missed Order Creation
If a Stripe webhook fails due to a network interruption:
1. Open the Stripe Dashboard -> Developers -> Webhooks.
2. Filter for failed `payment_intent.succeeded` events.
3. Click **"Resend Webhook"**. The API's built-in idempotency logic prevents duplicate order lines or double charges.

#### Issue: Next.js missing route types after build
If `PageProps` or `LayoutProps` error during compilation:
```bash
pnpm --filter web exec next typegen
pnpm check-types:web
```

---

*For platform support escalation, contact sysadmin@pimspace.com.*
