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
import { eq } from "drizzle-orm";

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
  console.log(`  (Stopping early — DB write logic added in Task 5+.)`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
