// One-time helper to capture a signed-in Neon Auth session.
// Run from worktree root: node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
// Pre-req: pnpm dev:web running on http://localhost:3000.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT = "docs/superpowers/audits/2026-05-11-a11y/auth-storage.json";
const SIGN_IN_PATH = "/auth/sign-in";
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes — interactive sign-in incl. magic-link round-trip

if (existsSync(OUT)) {
  console.log(`auth-storage.json already exists at ${OUT}`);
  console.log("Delete it manually if you want to re-capture.");
  process.exit(0);
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 375, height: 667 }, // matches audit viewport
});
const page = await context.newPage();

console.log("Opening sign-in page. Complete the sign-in flow in the browser.");
console.log("The script will save storage state and exit automatically once it detects a real session.");
await page.goto(`${BASE}${SIGN_IN_PATH}`);

const deadline = Date.now() + TIMEOUT_MS;
while (Date.now() < deadline) {
  const url = page.url();
  if (!url.includes(SIGN_IN_PATH) && !url.includes("/auth/")) {
    // URL has left /auth/. That alone is loose — Neon Auth's [[...path]]
    // catch-all may redirect through transient locations before the session
    // cookie is actually set. Behavioural double-check: navigate to a known
    // gated route and verify we stay there.
    await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
    if (!page.url().includes("/auth/")) {
      console.log(`Auth confirmed via /orders staying at: ${page.url()}`);
      break;
    }
    // Bounced back to /auth/. Sign-in didn't actually take — keep waiting.
    await page.goto(`${BASE}${SIGN_IN_PATH}`);
  }
  await page.waitForTimeout(1000);
}

if (page.url().includes(SIGN_IN_PATH) || page.url().includes("/auth/")) {
  console.error("Timed out waiting for a real sign-in. No file written.");
  await browser.close();
  process.exit(1);
}

const cookies = await context.cookies();
if (cookies.length === 0) {
  console.error("Post-sign-in but zero cookies on context — refusing to save an empty storage state.");
  await browser.close();
  process.exit(1);
}

await context.storageState({ path: OUT });
console.log(`Saved storage state to ${OUT} (${cookies.length} cookies).`);
console.log("This file is gitignored — verify with: git check-ignore -v " + OUT);
await browser.close();
