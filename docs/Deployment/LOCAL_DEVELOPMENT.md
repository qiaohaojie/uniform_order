# Local Development Guide — UniformOrder

This guide provides instructions for setting up, running, and testing the **UniformOrder** multi-tenant online uniform shop platform locally.

---

## 1. Architecture & Tech Stack Overview

UniformOrder is built as a pnpm monorepo consisting of:
- **`apps/web`**: Next.js 16 (App Router) containing the Parent Shop, School Admin Portal, Platform Console, and API routes.
- **`apps/landing`**: Astro marketing landing page.

### Core Tech Stack
- **Framework:** Next.js 16 (App Router, RSC + Client Companions)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + HeroUI v3
- **Database & ORM:** Neon PostgreSQL + Drizzle ORM
- **Authentication:** Neon Auth (Magic Link & Google OAuth)
- **Payments:** Stripe Connect Standard (Destination charges with optional application fees)
- **Image Storage:** UploadThing
- **Transactional Email:** Emailit (React Email templates)
- **Analytics:** PostHog

---

## 2. Prerequisites & Initial Installation

### Requirements
- **Node.js**: v22.x or higher
- **pnpm**: v10.x or higher
- **Git**
- **Neon Postgres Account**: (or a local PostgreSQL database instance)
- **Stripe Account**: (Test mode keys with Connect enabled)

### Step-by-Step Repository Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/qiaohaojie/uniform_order.git
   cd uniform_order
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment configuration in `apps/web`:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   Configure the minimum required variables in `apps/web/.env.local`:
   ```env
   # Database Connection
   DATABASE_URL="postgresql://user:password@ep-xyz.ap-southeast-2.aws.neon.tech/neondb?sslmode=require"

   # Application Base URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"

   # Neon Auth Setup
   NEON_AUTH_BASE_URL="https://auth.uniformorder.online"
   NEON_AUTH_COOKIE_SECRET="a_random_32_character_secret_key_here"

   # Platform Admin Allowlist (Comma-separated)
   PLATFORM_ADMIN_EMAILS="admin@example.com,support@pimspace.com"

   # Stripe Test Keys
   STRIPE_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   STRIPE_APPLICATION_FEE_BPS="0"
   ```

4. **Initialize Database Schema & Seed Data:**
   Apply database schema migrations, then choose a seeder:
   ```bash
   # Apply database migrations
   pnpm --filter web exec drizzle-kit migrate

   # Product tenants (imhs / rgsh) — default local shop data
   cd apps/web && node scripts/seed.mjs && cd ../..

   # Optional: sales/QA demo tenants (demo-blank / demo-academy) with ~40 sample orders
   # Full steps: demo/demo_data/README.md
   cp demo/demo_data/.env.demo.example demo/demo_data/.env.demo
   # set DATABASE_URL in .env.demo to the same Neon URL as apps/web/.env.local
   pnpm --filter web demo:seed
   ```

   After `demo:seed`, open `/demo-academy` or `/admin/demo-academy`. Fastest local operator path (dev only):

   `http://localhost:3000/api/dev/login?email=operator@demo.uniformorder.online&callbackURL=/admin/demo-academy`

---

## 3. Parent-Facing Application (Local Setup & Workflow)

The Parent-Facing Shop is optimized for mobile browser interactions, enabling parents to browse catalogs, select variant sizing, manage items in a persistent cart, and place orders via Stripe.

### 3.1 Architecture & Routes

| Route | Purpose | Component Shell |
|---|---|---|
| `/` | School picker / home page auto-redirect | `page.tsx` |
| `/[tenant]` | Parent Shop Catalog (category filter, search, garment previews) | `MobileShell` |
| `/[tenant]/cart` | Shopping cart preview & item quantity management | `MobileShell` |
| `/[tenant]/checkout` | Pickup details, student note, legal policy consent & Stripe checkout | `MobileShell` |
| `/[tenant]/orders` | Parent order history & active order status tracking | `MobileShell` |
| `/[tenant]/orders/[orderId]` | Individual order confirmation & pickup status details | `MobileShell` |

### 3.2 Key Parent Features & Local Behavior
- **Tenant Context (`[tenant]`):** The parent portal validates tenant slugs against active database records (e.g., `/imhs` for Illawarra Modern High School, `/rgsh` for Riverside Academy). Each tenant renders custom accent colors and school branding.
- **Garment SVG Vectors:** Product visual previews are rendered via client-side vector generators (`components/garment.tsx`) based on item ID and category.
- **Local Cart Persistence:** Cart state is synchronized in browser `localStorage` under the key `uo:cart:v1`.
- **Checkout & Payments:**
  - Standard test payment: Use Stripe test card `4242 4242 4242 4242` with any future expiry date and 3-digit CVC.
  - Checkout calls `/api/orders` to create a `payment_intent` with Stripe Connect destination charges.

### 3.3 Running & Testing Parent Flow Locally

1. **Start the web development server:**
   ```bash
   pnpm dev:web
   ```
2. **Access the Parent Shop in your browser:**
   - Open [http://localhost:3000](http://localhost:3000) (redirects to default school picker or tenant).
   - Navigate directly to a demo school catalog: [http://localhost:3000/imhs](http://localhost:3000/imhs).
3. **Walkthrough Test Sequence:**
   - Select a garment (e.g., *Junior Short Sleeve Shirt*), choose size and quantity, and click **Add to Order**.
   - Open the cart at `http://localhost:3000/imhs/cart` and proceed to Checkout.
   - Enter student details and complete the test Stripe payment.

---

## 4. Admin-Facing Application (Local Setup & Workflow)

The Admin-Facing Portal provides school operators and uniform shop volunteers with desktop-optimized tools for order fulfillment, batch pick-slip printing, catalog editing, financial reporting, and platform onboarding.

### 4.1 Architecture & Routes

| Route | Purpose | Access Control |
|---|---|---|
| `/admin/[tenant]` | Operator Dashboard (sales overview & quick action triggers) | Gated by `shop_email` / Platform Admin |
| `/admin/[tenant]/orders` | Kanban Fulfillment Board (Paid → To Prepare → Ready → Completed) | Gated by `shop_email` / Platform Admin |
| `/admin/[tenant]/orders/print` | Batch Pick-Slip Printing (Print-optimized stylesheet) | Gated by `shop_email` / Platform Admin |
| `/admin/[tenant]/catalog` | Self-service Catalog Management & UploadThing image uploader | Gated by `shop_email` / Platform Admin |
| `/admin/[tenant]/reports` | GST / BAS Financial Summary & CSV Export Download | Gated by `shop_email` / Platform Admin |
| `/admin/[tenant]/settings` | School branding accent color, pickup policy & Stripe Connect status | Gated by `shop_email` / Platform Admin |
| `/platform` | Platform Super-Admin Portal (School onboarding & approval queue) | Gated by `PLATFORM_ADMIN_EMAILS` |

### 4.2 Local Authentication & Operator Gating
- **Authorization Gating (`lib/auth/authorization.ts`):** Admin routes verify user session emails against either the tenant's registered `shop_email` in the database or the `PLATFORM_ADMIN_EMAILS` allowlist.
- **Local Dev Auth Bypass / Test Login:**
  - For local development, dev auth helpers exist at `/api/dev/login` and `/api/dev/logout` to simulate logged-in operator or super-admin sessions without requiring an external email provider setup.

### 4.3 Key Admin Features & Local Behavior
- **Kanban Order Fulfillment:** Orders transition across status columns (Paid → To Prepare → Ready for Pickup → Completed). State changes update Neon PostgreSQL records and trigger transactional customer notification emails.
- **Batch Pick-Slip Printing:** Route `/admin/[tenant]/orders/print` renders clean, page-broken pick slips formatted specifically for standard A4 thermal/laser printing.
- **Catalog Management & Uploads:** Allows creating/editing items, variant sizes, and uploading product images via UploadThing.
- **GST / BAS CSV Export:** Calculates 10% GST components on catalog items and exports downloadable CSV files for accounting compliance.

### 4.4 Running & Testing Admin Flow Locally

1. **Start the web development server:**
   ```bash
   pnpm dev:web
   ```
2. **Access the Admin Portal in your browser:**
   - Open the School Admin Portal for IMHS: [http://localhost:3000/admin/imhs](http://localhost:3000/admin/imhs).
   - Open the Platform Super-Admin Console: [http://localhost:3000/platform](http://localhost:3000/platform).
3. **Walkthrough Test Sequence:**
   - Go to `/admin/imhs/orders` and drag an order from **Paid** to **To Prepare** and **Ready for Pickup**.
   - Select orders and click **Batch Print Pick Slips** to inspect the print layout preview.
   - Navigate to `/admin/imhs/reports` and test the **Download GST CSV** export button.

---

## 5. Development Commands & Quality Gates

Run these scripts from the repository root:

```bash
# Start Next.js web application dev server (http://localhost:3000)
pnpm dev:web

# Start Astro marketing landing dev server (http://localhost:4321)
pnpm dev:landing

# TypeScript verification across all monorepo packages
pnpm check-types

# TypeScript verification for apps/web only
pnpm check-types:web

# Production bundle build test
pnpm build:web
```

---

## 6. Monorepo Structure

```
uniform_order/
├── apps/
│   ├── landing/                   # Astro marketing website
│   └── web/                       # Next.js 16 parent & admin application
│       ├── src/
│       │   ├── app/
│       │   │   ├── [tenant]/      # Parent Shop routes
│       │   │   ├── admin/[tenant]/# School Operator Admin routes
│       │   │   ├── platform/      # Platform Admin Console
│       │   │   ├── api/           # Orders, catalog, tenant & Stripe APIs
│       │   │   └── auth/          # Neon Auth sign-in / session handlers
│       │   ├── components/        # Shared UI components (shells, garment SVGs)
│       │   ├── db/                # Schema, Drizzle client & query helpers
│       │   └── lib/               # Auth, Stripe, Email, Analytics & Cart helpers
│       └── scripts/               # Database seed scripts
├── docs/                          # Project documentation
└── package.json                   # Monorepo configuration
```
