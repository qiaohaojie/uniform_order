/**
 * GTM demo seed script
 *
 * Idempotent. Seeds two isolated demo tenants (demo-blank, demo-academy).
 * Production tenants (imhs, rgsh) are never touched.
 *
 * Run via:
 *   pnpm --filter web demo:seed:dry   # dry-run, no writes
 *   pnpm --filter web demo:seed       # actual seed
 *
 * See GTM/demo_data/README.md and GTM/demo_data/operator_run_guide.md.
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";

import * as schema from "../../apps/web/src/db/schema";

const DEMO_TENANT_IDS = ["demo-blank", "demo-academy"] as const;
type DemoTenantId = (typeof DEMO_TENANT_IDS)[number];

type Flags = {
  dryRun: boolean;
  reset: boolean;
  allowRemote: boolean;
  iKnowWhatImDoing: boolean;
  only: DemoTenantId | "blank" | "academy" | undefined;
};

function parseFlags(): Flags {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      reset: { type: "boolean", default: false },
      "allow-remote": { type: "boolean", default: false },
      "i-know-what-im-doing": { type: "boolean", default: false },
      only: { type: "string" },
    },
  });
  return {
    dryRun: Boolean(values["dry-run"]),
    reset: Boolean(values.reset),
    allowRemote: Boolean(values["allow-remote"]),
    iKnowWhatImDoing: Boolean(values["i-know-what-im-doing"]),
    only: values.only as Flags["only"],
  };
}

const PROD_HOST_PATTERNS = ["prod", "production", "super-cell-03401356"];

// ─── Fixture types ───────────────────────────────────────────────────────────
type FixtureVariant = { label: string; price: string; sizes: string[] };
type FixtureCatalogItem = {
  id: string;
  name: string;
  category: string;
  description?: string;
  variants: FixtureVariant[];
};
type FixtureLegal = {
  policyMode: "text" | "url";
  policyText?: string;
  policyUrl?: string;
  aclAcknowledged: boolean;
  sellerOfRecordAcknowledged: boolean;
  declarantName: string;
  declarantRole: string;
};
type FixtureSettings = {
  workflowMode: "standard" | "simple";
  pickupEnabled: boolean;
  shippingEnabled: boolean;
};
type FixtureOrder = {
  n: number;
  fulfilment: "to_prepare" | "ready" | "needs_attention" | "completed";
  payment: "pending" | "paid" | "partially_refunded" | "refunded";
  daysAgo: number;
  parent: string;
  student: string;
  year: string;
  roll: string;
  lines: Array<[string, string, string, number]>;
  holdReason?: string;
  refund?: { amount: string; reason: string; lineIndex: number };
};
type FixtureTenant = {
  id: DemoTenantId;
  name: string;
  short: string;
  accent: string;
  motto: string;
  address: string;
  shopHours: string;
  shopEmail: string;
  timezone: string;
  isPubliclyListed: boolean;
  stripeAccountId: string;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  platformApprovalStatus: string;
  orderIdPrefix: string;
  settings: FixtureSettings;
  legal: FixtureLegal;
  catalog: FixtureCatalogItem[];
  orders: FixtureOrder[];
};
type Fixture = { tenants: FixtureTenant[] };

function loadFixture(): Fixture {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const path = resolve(__dirname, "fixtures/demo-scenarios.json");
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

function abortWithGuard(reason: string, remediation: string): never {
  console.error(`\n✗ SAFETY GUARD TRIPPED: ${reason}`);
  console.error(`  Remediation: ${remediation}`);
  console.error(`  Run aborted; no DB connection attempted.\n`);
  process.exit(1);
}

function checkSafety(databaseUrl: string, flags: Flags) {
  let host = "";
  try {
    host = new URL(databaseUrl).host;
  } catch {
    abortWithGuard(
      "DATABASE_URL is not a valid URL",
      "Set DATABASE_URL in GTM/demo_data/.env.demo to a postgres connection string."
    );
  }

  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  if (!isLocal && !flags.allowRemote) {
    abortWithGuard(
      `DATABASE_URL host '${host}' is not localhost`,
      "Pass --allow-remote to seed a remote DB. Recommended only for ephemeral dev branches."
    );
  }

  const matchesProd = PROD_HOST_PATTERNS.some((p) => host.includes(p));
  if (matchesProd && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      `DATABASE_URL host '${host}' matches prod pattern`,
      "This seed must never run against production. If you are absolutely certain, pass --i-know-what-im-doing."
    );
  }

  if (process.env.NODE_ENV === "production" && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      "NODE_ENV is set to 'production'",
      "Unset NODE_ENV or set it to 'development' before running the seed. If you really mean it, pass --i-know-what-im-doing."
    );
  }
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

async function seedTenant(db: Db, t: FixtureTenant, flags: Flags) {
  // Tenant upsert
  await db
    .insert(schema.tenants)
    .values({
      id: t.id,
      name: t.name,
      short: t.short,
      accent: t.accent,
      motto: t.motto,
      address: t.address,
      shopHours: t.shopHours,
      shopEmail: t.shopEmail,
      timezone: t.timezone,
      isPubliclyListed: t.isPubliclyListed,
      stripeAccountId: t.stripeAccountId,
      stripeChargesEnabled: t.stripeChargesEnabled,
      stripePayoutsEnabled: t.stripePayoutsEnabled,
      platformApprovalStatus: t.platformApprovalStatus,
      platformApprovedAt: new Date(),
      platformApprovedBy: "demo-seed",
    })
    .onConflictDoUpdate({
      target: schema.tenants.id,
      set: {
        name: t.name,
        short: t.short,
        accent: t.accent,
        motto: t.motto,
        address: t.address,
        shopHours: t.shopHours,
        shopEmail: t.shopEmail,
        timezone: t.timezone,
        isPubliclyListed: t.isPubliclyListed,
        stripeAccountId: t.stripeAccountId,
        stripeChargesEnabled: t.stripeChargesEnabled,
        stripePayoutsEnabled: t.stripePayoutsEnabled,
        platformApprovalStatus: t.platformApprovalStatus,
        updatedAt: new Date(),
      },
    });
  console.log(`  ✓ tenant row`);

  // Settings upsert
  await db
    .insert(schema.tenantSettings)
    .values({
      tenantId: t.id,
      workflowMode: t.settings.workflowMode,
      pickupEnabled: t.settings.pickupEnabled,
      shippingEnabled: t.settings.shippingEnabled,
    })
    .onConflictDoUpdate({
      target: schema.tenantSettings.tenantId,
      set: {
        workflowMode: t.settings.workflowMode,
        pickupEnabled: t.settings.pickupEnabled,
        shippingEnabled: t.settings.shippingEnabled,
        updatedAt: new Date(),
      },
    });
  console.log(`  ✓ tenant settings`);

  // Legal version: insert if not exists for (tenantId, version=1)
  const existing = await db
    .select({ id: schema.tenantLegalVersions.id })
    .from(schema.tenantLegalVersions)
    .where(eq(schema.tenantLegalVersions.tenantId, t.id))
    .limit(1);

  let legalVersionId: string;
  if (existing.length > 0) {
    legalVersionId = existing[0].id;
  } else {
    // entered_by_user_id has a SQL-level FK to neon_auth."user"(id). Pick
    // any real auth user to satisfy it — the value is only display metadata
    // for demo data and is not surfaced in the parent/operator UI.
    const userLookup = await db.execute<{ id: string }>(
      sql`SELECT id FROM neon_auth."user" LIMIT 1`,
    );
    const seedUserId = userLookup.rows[0]?.id;
    if (!seedUserId) {
      throw new Error(
        "neon_auth.\"user\" is empty — create at least one auth user " +
          "(e.g. sign up via /auth/sign-up) before seeding demo data.",
      );
    }
    const [inserted] = await db
      .insert(schema.tenantLegalVersions)
      .values({
        tenantId: t.id,
        version: 1,
        policyMode: t.legal.policyMode,
        policyText: t.legal.policyText ?? null,
        policyUrl: t.legal.policyUrl ?? null,
        aclAcknowledged: t.legal.aclAcknowledged,
        sellerOfRecordAcknowledged: t.legal.sellerOfRecordAcknowledged,
        declarantName: t.legal.declarantName,
        declarantRole: t.legal.declarantRole,
        enteredByUserId: seedUserId,
        enteredByEmail: "demo-seed@uniformorder.online",
      })
      .returning({ id: schema.tenantLegalVersions.id });
    legalVersionId = inserted.id;
  }

  // Link tenant → current legal version
  await db
    .update(schema.tenants)
    .set({ currentLegalVersionId: legalVersionId })
    .where(eq(schema.tenants.id, t.id));
  console.log(`  ✓ legal version (id ${legalVersionId.slice(0, 8)}…)`);

  await seedCatalog(db, t);
  if (t.orders.length > 0) {
    await seedOrders(db, t);
  }
  void flags;
}

function lookupPrice(t: FixtureTenant, itemId: string, variantLabel: string): number {
  const item = t.catalog.find((i) => i.id === itemId);
  if (!item) throw new Error(`Fixture refers to unknown item ${itemId} in tenant ${t.id}`);
  const variant = item.variants.find((v) => v.label === variantLabel);
  if (!variant) throw new Error(`Fixture refers to unknown variant '${variantLabel}' on ${itemId}`);
  return Number(variant.price);
}

function itemName(t: FixtureTenant, itemId: string): string {
  const item = t.catalog.find((i) => i.id === itemId);
  return item?.name ?? itemId;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function money(n: number): string {
  return n.toFixed(2);
}

const GST_DIVISOR = 11;

async function seedCatalog(db: Db, t: FixtureTenant) {
  let sortOrder = 0;
  for (const item of t.catalog) {
    await db
      .insert(schema.catalogItems)
      .values({
        id: item.id,
        tenantId: t.id,
        name: item.name,
        category: item.category,
        description: item.description ?? null,
        active: true,
        sortOrder: sortOrder++,
      })
      .onConflictDoUpdate({
        target: schema.catalogItems.id,
        set: {
          name: item.name,
          category: item.category,
          description: item.description ?? null,
          active: true,
          sortOrder: sortOrder - 1,
          updatedAt: new Date(),
        },
      });

    // Variants: delete-then-insert (no natural key)
    await db.delete(schema.catalogVariants).where(eq(schema.catalogVariants.itemId, item.id));
    if (item.variants.length > 0) {
      await db.insert(schema.catalogVariants).values(
        item.variants.map((v) => ({
          itemId: item.id,
          label: v.label,
          price: v.price,
          sizes: v.sizes,
          active: true,
        }))
      );
    }
  }
  console.log(`  ✓ catalog (${t.catalog.length} items)`);
}

async function seedOrders(db: Db, t: FixtureTenant) {
  // Delete existing demo orders for this tenant (cascade clears lines/events/notifications/refunds)
  const existing = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.tenantId, t.id));
  if (existing.length > 0) {
    await db.delete(schema.orders).where(eq(schema.orders.tenantId, t.id));
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (const o of t.orders) {
    const orderId = `${t.orderIdPrefix}-${pad(o.n, 5)}`;
    const createdAt = new Date(now - o.daysAgo * oneDay);

    // Compute totals
    let subtotal = 0;
    const lineRows = o.lines.map(([itemId, variantLabel, size, qty]) => {
      const unit = lookupPrice(t, itemId, variantLabel);
      const lineTotal = unit * qty;
      subtotal += lineTotal;
      return {
        orderId,
        itemId,
        itemName: itemName(t, itemId),
        variantLabel,
        size,
        qty,
        unitPrice: money(unit),
        lineTotal: money(lineTotal),
      };
    });
    const total = subtotal; // GST-inclusive convention
    const gst = subtotal / GST_DIVISOR;

    // Build order row
    const refundedCents = o.refund ? Math.round(Number(o.refund.amount) * 100) : 0;

    const readyAt =
      o.fulfilment === "ready" || o.fulfilment === "completed"
        ? new Date(createdAt.getTime() + 1 * oneDay)
        : null;
    const completedAt =
      o.fulfilment === "completed"
        ? new Date(createdAt.getTime() + 2 * oneDay)
        : null;

    await db.insert(schema.orders).values({
      id: orderId,
      tenantId: t.id,
      parentName: o.parent,
      parentEmail: "parent@demo.uniformorder.online",
      parentMobile: "+61400000000",
      studentName: o.student,
      studentYear: o.year,
      studentRoll: o.roll,
      fulfilmentMethod: "pickup",
      fulfilmentStatus: o.fulfilment,
      completionType: o.fulfilment === "completed" ? "collected" : null,
      deliveryFee: "0",
      subtotal: money(subtotal),
      gst: money(gst),
      total: money(total),
      refundedAmountCents: refundedCents,
      stripePaymentIntentId: `pi_demo_${orderId}`,
      stripeRef: `ch_demo_${orderId}`,
      paymentStatus: o.payment,
      refundPolicyAcceptedAt: createdAt,
      readyAt,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? readyAt ?? createdAt,
    });

    // Lines — capture IDs in insertion order so refund linking is deterministic
    let insertedLineIds: string[] = [];
    if (lineRows.length > 0) {
      const inserted = await db
        .insert(schema.orderLines)
        .values(lineRows)
        .returning({ id: schema.orderLines.id });
      insertedLineIds = inserted.map((r) => r.id);
    }

    // Events
    const events: Array<typeof schema.orderEvents.$inferInsert> = [];
    if (o.payment === "paid" || o.payment === "partially_refunded" || o.payment === "refunded") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "order_paid",
        createdAt,
      });
    }
    if (o.fulfilment === "ready" || o.fulfilment === "completed") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "to_prepare",
        toStatus: "ready",
        createdAt: readyAt!,
      });
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "ready_email_sent",
        createdAt: readyAt!,
      });
    }
    if (o.fulfilment === "completed") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "ready",
        toStatus: "completed",
        createdAt: completedAt!,
      });
    }
    if (o.fulfilment === "needs_attention") {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "status_changed",
        fromStatus: "to_prepare",
        toStatus: "needs_attention",
        reason: o.holdReason ?? null,
        createdAt: new Date(createdAt.getTime() + oneDay),
      });
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "hold_email_sent",
        createdAt: new Date(createdAt.getTime() + oneDay),
      });
    }
    if (o.refund) {
      events.push({
        orderId,
        tenantId: t.id,
        eventType: "refund_created",
        reason: o.refund.reason,
        createdAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
    if (events.length > 0) {
      await db.insert(schema.orderEvents).values(events);
    }

    // Notification events
    const notifs: Array<typeof schema.orderNotificationEvents.$inferInsert> = [];
    if (o.fulfilment === "ready" || o.fulfilment === "completed") {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "ready",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_ready`,
        idempotencyKey: `demo_${orderId}_ready`,
        triggeredBy: "system",
        sentAt: readyAt,
      });
    }
    if (o.fulfilment === "needs_attention") {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "hold",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_hold`,
        idempotencyKey: `demo_${orderId}_hold`,
        triggeredBy: "system",
        sentAt: new Date(createdAt.getTime() + oneDay),
      });
    }
    if (o.refund) {
      notifs.push({
        orderId,
        tenantId: t.id,
        type: "refund",
        status: "sent",
        recipientEmail: "parent@demo.uniformorder.online",
        providerMessageId: `msg_demo_${orderId}_refund`,
        idempotencyKey: `demo_${orderId}_refund`,
        triggeredBy: "system",
        sentAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
    if (notifs.length > 0) {
      await db.insert(schema.orderNotificationEvents).values(notifs);
    }

    // Refunds — link to the captured line ID at the fixture-specified index
    if (o.refund) {
      const targetLineId = insertedLineIds[o.refund.lineIndex] ?? null;
      await db.insert(schema.orderRefunds).values({
        orderId,
        lineId: targetLineId,
        amount: o.refund.amount,
        reason: o.refund.reason,
        stripeRefundId: `re_demo_${orderId}_001`,
        createdAt: new Date((completedAt ?? createdAt).getTime() + oneDay),
      });
    }
  }
  console.log(`  ✓ orders (${t.orders.length})`);
}

async function main() {
  const flags = parseFlags();
  console.log("─".repeat(60));
  console.log("UniformOrder demo seed");
  console.log(`  dryRun:           ${flags.dryRun}`);
  console.log(`  reset:            ${flags.reset}`);
  console.log(`  allowRemote:      ${flags.allowRemote}`);
  console.log(`  only:             ${flags.only ?? "all"}`);
  console.log("─".repeat(60));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    abortWithGuard(
      "DATABASE_URL is not set",
      "Copy GTM/demo_data/.env.demo.example to GTM/demo_data/.env.demo and fill DATABASE_URL."
    );
  }
  checkSafety(databaseUrl, flags);
  console.log("✓ Safety guards passed.");

  const fixture = loadFixture();
  const wantedTenants = fixture.tenants.filter((t) => {
    if (!flags.only) return true;
    if (flags.only === "blank") return t.id === "demo-blank";
    if (flags.only === "academy") return t.id === "demo-academy";
    return t.id === flags.only;
  });

  if (flags.dryRun) {
    console.log("\n[DRY RUN] Would seed:");
    for (const t of wantedTenants) {
      console.log(`  tenant ${t.id} — ${t.catalog.length} items, ${t.orders.length} orders`);
    }
    console.log("\n[DRY RUN] No DB connection opened.");
    return;
  }

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient, { schema });

  for (const t of wantedTenants) {
    console.log(`\n→ Seeding tenant ${t.id} (${t.name})`);
    await seedTenant(db, t, flags);
  }

  console.log("\n✓ Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
