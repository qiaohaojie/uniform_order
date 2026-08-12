/**
 * Demo cleanup script
 *
 * Scoped strictly to `tenantId IN ('demo-blank','demo-academy')`.
 * Safe against prod database. Run with `--confirm` to execute deletion.
 */
import { parseArgs } from "node:util";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import * as schema from "../../apps/web/src/db/schema";

const DEMO_TENANT_IDS = ["demo-blank", "demo-academy"] as const;
const PROD_HOST_PATTERNS = ["prod", "production", "super-cell-03401356"];

function parseFlags() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== "--"),
    options: {
      confirm: { type: "boolean", default: false },
      "allow-remote": { type: "boolean", default: false },
      "i-know-what-im-doing": { type: "boolean", default: false },
    },
    strict: true,
  });
  return {
    confirm: Boolean(values.confirm),
    allowRemote: Boolean(values["allow-remote"]),
    iKnowWhatImDoing: Boolean(values["i-know-what-im-doing"]),
  };
}

function abortWithGuard(reason: string, remediation: string): never {
  console.error(`\n✗ SAFETY GUARD TRIPPED: ${reason}`);
  console.error(`  Remediation: ${remediation}\n`);
  process.exit(1);
}

function checkSafety(databaseUrl: string, flags: ReturnType<typeof parseFlags>) {
  let host = "";
  try {
    host = new URL(databaseUrl).host;
  } catch {
    abortWithGuard("DATABASE_URL is not a valid URL", "Set DATABASE_URL in demo/demo_data/.env.demo.");
  }
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const isNeonCloud =
    host.includes(".neon.tech") || host.includes(".neon.build");
  if (!isLocal && !isNeonCloud && !flags.allowRemote) {
    abortWithGuard(
      `DATABASE_URL host '${host}' is not localhost or Neon`,
      "Use a Neon/dev DATABASE_URL, or pass --allow-remote for other remote hosts."
    );
  }
  const matchesProd = PROD_HOST_PATTERNS.some((p) => host.includes(p));
  if (matchesProd && !flags.iKnowWhatImDoing) {
    abortWithGuard(
      `DATABASE_URL host '${host}' matches prod pattern`,
      "Cleanup must never run against production. If you are absolutely certain, pass --i-know-what-im-doing."
    );
  }
  if (process.env.NODE_ENV === "production" && !flags.iKnowWhatImDoing) {
    abortWithGuard("NODE_ENV is 'production'", "Unset or pass --i-know-what-im-doing.");
  }
}

async function main() {
  const flags = parseFlags();
  console.log("─".repeat(60));
  console.log("UniformOrder demo cleanup");
  console.log(`  confirm:          ${flags.confirm}`);
  console.log(`  tenants targeted: ${DEMO_TENANT_IDS.join(", ")}`);
  console.log("─".repeat(60));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) abortWithGuard("DATABASE_URL not set", "See .env.demo.example.");
  checkSafety(databaseUrl, flags);

  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient, { schema });

  // Count what would be deleted (per-tenant)
  console.log("\nDeletion plan:");
  for (const tenantId of DEMO_TENANT_IDS) {
    const orders = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId));
    const items = await db
      .select({ id: schema.catalogItems.id })
      .from(schema.catalogItems)
      .where(eq(schema.catalogItems.tenantId, tenantId));
    const legal = await db
      .select({ id: schema.tenantLegalVersions.id })
      .from(schema.tenantLegalVersions)
      .where(eq(schema.tenantLegalVersions.tenantId, tenantId));
    console.log(
      `  ${tenantId}: ${orders.length} orders, ${items.length} catalog items, ${legal.length} legal versions`
    );
  }

  if (!flags.confirm) {
    console.log("\n[PLAN ONLY] Pass --confirm to execute.");
    return;
  }

  console.log("\nExecuting cleanup...");
  for (const tenantId of DEMO_TENANT_IDS) {
    // Null out tenants.currentLegalVersionId so the FK doesn't block legal_versions deletion
    await db
      .update(schema.tenants)
      .set({ currentLegalVersionId: null })
      .where(eq(schema.tenants.id, tenantId));

    // Cascades clean: orders → lines/events/notifications/refunds; catalog → variants
    await db.delete(schema.orders).where(eq(schema.orders.tenantId, tenantId));
    await db.delete(schema.catalogItems).where(eq(schema.catalogItems.tenantId, tenantId));
    await db.delete(schema.parentChildren).where(eq(schema.parentChildren.tenantId, tenantId));
    await db.delete(schema.tenantLegalVersions).where(eq(schema.tenantLegalVersions.tenantId, tenantId));
    await db.delete(schema.tenantSettings).where(eq(schema.tenantSettings.tenantId, tenantId));
    await db.delete(schema.auditEvents).where(eq(schema.auditEvents.tenantId, tenantId));
    await db.delete(schema.tenants).where(eq(schema.tenants.id, tenantId));
    console.log(`  ✓ ${tenantId} removed`);
  }
  console.log("\n✓ Cleanup complete.");
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
