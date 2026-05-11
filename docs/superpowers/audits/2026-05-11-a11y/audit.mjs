// §3.8 a11y audit — Phase A runner.
// Run from worktree root: node docs/superpowers/audits/2026-05-11-a11y/audit.mjs
// Pre-reqs: pnpm dev:web on :3000; auth-storage.json captured via setup-auth.mjs.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const TENANT = "nsbh";
const OUT_DIR = "docs/superpowers/audits/2026-05-11-a11y";
const AXE_DIR = join(OUT_DIR, "axe");
const STORAGE = join(OUT_DIR, "auth-storage.json");
mkdirSync(AXE_DIR, { recursive: true });

// Idempotency: clear any stale JSON from a prior run so a partial
// failure doesn't leave mixed-vintage data in axe/.
for (const f of readdirSync(AXE_DIR)) {
  if (f.endsWith(".json")) rmSync(join(AXE_DIR, f));
}

if (!existsSync(STORAGE)) {
  console.error(`Missing ${STORAGE}.`);
  console.error("Run: node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs");
  process.exit(1);
}

const SAMPLE_CART = [
  { itemId: "shirt-ls", variantLabel: "10–24", size: "16", qty: 2, price: 28, name: "White Shirt — Long Sleeves" },
  { itemId: "jumper", variantLabel: "12–16", size: "16", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
  { itemId: "tie", variantLabel: "Year 7–10 long (137cm)", size: "7-10L", qty: 1, price: 18, name: "School Tie — Navy Crested" },
];

const PLACED_QS = `total=149.00&delivery=pickup&orderId=${TENANT.toUpperCase()}-A11Y`;

const SCREENS = [
  { slug: "home", url: `${BASE}/`, auth: false },
  { slug: "catalog", url: `${BASE}/${TENANT}`, auth: false },
  { slug: "item", url: `${BASE}/${TENANT}/item/shirt-ls`, auth: false },
  { slug: "cart", url: `${BASE}/${TENANT}/cart`, auth: false },
  { slug: "checkout", url: `${BASE}/${TENANT}/checkout`, auth: true },
  { slug: "placed", url: `${BASE}/${TENANT}/order/placed?${PLACED_QS}`, auth: false },
];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function runScreen(browser, screen) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    storageState: screen.auth ? STORAGE : undefined,
  });
  // Seed cart into localStorage on every page-load (matches §3.9 capture.mjs).
  // Bare array shape — matches lib/cart-store.ts. NOT { tenantId, lines }.
  await context.addInitScript((cart) => {
    try {
      localStorage.setItem("uo:cart:v1", JSON.stringify(cart));
    } catch {}
  }, SAMPLE_CART);
  const page = await context.newPage();

  await page.goto(screen.url, { waitUntil: "domcontentloaded" });
  // Next 16 App Router + RSC streaming + PostHog client + auth polling
  // means "networkidle" never resolves. Lean on DOMContentLoaded + a
  // hydration buffer instead. If a specific screen lags, bump per-screen
  // not globally.
  await page.waitForTimeout(800);

  // Belt-and-braces: an auth: true screen that landed back on /auth/
  // means the storage state was rejected (expired session, missing
  // cookies). Fail loudly so the executor re-runs setup-auth.mjs.
  if (screen.auth && page.url().includes("/auth/")) {
    throw new Error(
      `Auth screen ${screen.slug} bounced to ${page.url()} — session likely expired. Delete auth-storage.json and re-run setup-auth.mjs.`,
    );
  }

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // Stripe Payment Element iframe content is upstream-tested (WCAG 2.1 AA).
    // Excluding keeps `incomplete` honest; prose carve-out remains in findings.md.
    .exclude("iframe[name^='__privateStripeFrame']")
    .analyze();

  const summary = {
    screen: screen.slug,
    url: screen.url,
    auth: screen.auth,
    timestamp: new Date().toISOString(),
    counts: {
      critical: results.violations.filter((v) => v.impact === "critical").length,
      serious: results.violations.filter((v) => v.impact === "serious").length,
      moderate: results.violations.filter((v) => v.impact === "moderate").length,
      minor: results.violations.filter((v) => v.impact === "minor").length,
      incomplete: results.incomplete.length,
      passes: results.passes.length,
    },
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary,
      })),
    })),
    incomplete: results.incomplete.map((i) => ({
      id: i.id,
      impact: i.impact,
      help: i.help,
      nodes: i.nodes.length,
    })),
  };

  writeFileSync(join(AXE_DIR, `${screen.slug}.json`), JSON.stringify(summary, null, 2));
  console.log(
    `  ✓ ${screen.slug.padEnd(10)} crit=${summary.counts.critical} ser=${summary.counts.serious} mod=${summary.counts.moderate} min=${summary.counts.minor} incomplete=${summary.counts.incomplete}`,
  );

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const screen of SCREENS) {
    console.log(`→ ${screen.slug} ${screen.auth ? "(auth)" : ""}`);
    await runScreen(browser, screen);
  }
  console.log("\n✓ All 6 axe runs complete. JSON written to", AXE_DIR);
} finally {
  await browser.close();
}
