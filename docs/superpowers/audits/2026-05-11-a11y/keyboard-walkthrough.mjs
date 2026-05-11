// §3.8 a11y Phase B — Keyboard walkthrough.
// Playwright-assisted: programmatically Tabs through each screen, captures
// focus order, detects keyboard traps. Outputs per-screen JSON into keyboard/.
//
// Run from worktree root:
//   node docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.mjs
//
// Optional filter (single screen):
//   SCREEN=cart node docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.mjs
//
// Pre-reqs: pnpm dev:web on :3000. auth-storage.json optional (checkout deferred if absent).

import { chromium } from "playwright";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const TENANT = "nsbh";
const OUT_DIR = "docs/superpowers/audits/2026-05-11-a11y";
const KEY_DIR = join(OUT_DIR, "keyboard");
const STORAGE = join(OUT_DIR, "auth-storage.json");
mkdirSync(KEY_DIR, { recursive: true });

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

const MAX_TABS = 50;
const FILTER = process.env.SCREEN || process.argv[2] || null;

const authStorageExists = existsSync(STORAGE);

function describeNode(info) {
  if (!info) return "<null>";
  const name = info.ariaLabel || info.text || info.href || info.id || "";
  return `${info.tag}${info.type ? `[type=${info.type}]` : ""}${info.role ? `[role=${info.role}]` : ""} "${name.slice(0, 40)}"`;
}

async function walkScreen(browser, screen) {
  const notes = [];

  if (screen.auth && !authStorageExists) {
    const result = {
      screen: screen.slug,
      url: screen.url,
      auth: screen.auth,
      status: "deferred",
      reason: "auth-storage.json absent in this worktree; programmatic auth walk skipped. Re-run setup-auth.mjs and re-execute this script, or perform the /checkout pass manually.",
      focusableCount: 0,
      focusOrder: [],
      escapedToBody: null,
      trapDetected: null,
      escStateChanges: [],
      notes,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(join(KEY_DIR, `${screen.slug}.json`), JSON.stringify(result, null, 2));
    console.log(`  ⚠ ${screen.slug.padEnd(10)} DEFERRED (no auth-storage.json)`);
    return result;
  }

  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    storageState: screen.auth ? STORAGE : undefined,
  });
  await context.addInitScript((cart) => {
    try {
      localStorage.setItem("uo:cart:v1", JSON.stringify(cart));
    } catch {}
  }, SAMPLE_CART);

  const page = await context.newPage();
  let escapedToBody = false;
  let trapDetected = false;
  const chain = [];
  const escStateChanges = [];
  let status = "ok";

  try {
    await page.goto(screen.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    if (screen.auth && page.url().includes("/auth/")) {
      status = "bounced";
      notes.push(`Auth bounce to ${page.url()} — session likely expired.`);
    } else {
      // Click body to ensure focus starts deterministically at the top.
      await page.evaluate(() => {
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
      });

      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body || el === document.documentElement) return null;
          const computeAccName = () => {
            const aria = el.getAttribute("aria-label");
            if (aria) return aria;
            const labelledBy = el.getAttribute("aria-labelledby");
            if (labelledBy) {
              const ref = document.getElementById(labelledBy);
              if (ref) return ref.textContent?.trim() || null;
            }
            if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
              const id = el.id;
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label) return label.textContent?.trim() || null;
              }
              const wrappingLabel = el.closest("label");
              if (wrappingLabel) return wrappingLabel.textContent?.trim() || null;
              const ph = el.getAttribute("placeholder");
              if (ph) return `[placeholder] ${ph}`;
            }
            return null;
          };
          return {
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || null,
            role: el.getAttribute("role") || null,
            ariaLabel: computeAccName(),
            text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
            id: el.id || null,
            href: el.tagName === "A" ? el.getAttribute("href") : null,
            disabled: el.hasAttribute("disabled"),
            tabindex: el.getAttribute("tabindex") || null,
          };
        });
        if (info === null) {
          escapedToBody = true;
          break;
        }
        chain.push(info);
      }

      if (!escapedToBody && chain.length === MAX_TABS) {
        // Possible trap: 50 Tabs and never returned to body.
        // Heuristic: if the last 5 entries cycle through the same node IDs/refs
        // as some earlier window, we're in a real cycle; otherwise it's just
        // that the page has >=50 focusables. Mark uncertain when chain has
        // many unique nodes.
        const last5 = chain.slice(-5).map(describeNode).join("|");
        const earlier = chain.slice(0, -5).map(describeNode).join("|");
        if (earlier.includes(last5)) {
          trapDetected = true;
          notes.push("Tab cycled back to earlier focus within 50 presses without escaping to body — possible trap or natural cycle. Manual verification recommended.");
        } else {
          notes.push(`Reached MAX_TABS (${MAX_TABS}) without exiting to body. ${chain.length} unique-ish focuses captured; not a confirmed trap.`);
        }
      }

      // Esc heuristic: press Esc on the page, observe whether the URL or any
      // visible dialog/menu count changes. Informational only.
      const beforeEsc = await page.evaluate(() => ({
        url: location.href,
        dialogCount: document.querySelectorAll("[role=dialog], dialog[open]").length,
        menuCount: document.querySelectorAll("[role=menu], [aria-expanded='true']").length,
      }));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      const afterEsc = await page.evaluate(() => ({
        url: location.href,
        dialogCount: document.querySelectorAll("[role=dialog], dialog[open]").length,
        menuCount: document.querySelectorAll("[role=menu], [aria-expanded='true']").length,
      }));
      if (
        beforeEsc.url !== afterEsc.url ||
        beforeEsc.dialogCount !== afterEsc.dialogCount ||
        beforeEsc.menuCount !== afterEsc.menuCount
      ) {
        escStateChanges.push({ before: beforeEsc, after: afterEsc });
      }
    }
  } catch (err) {
    status = "error";
    notes.push(`Error during walk: ${err.message}`);
  } finally {
    await context.close();
  }

  const result = {
    screen: screen.slug,
    url: screen.url,
    auth: screen.auth,
    status,
    focusableCount: chain.length,
    focusOrder: chain,
    escapedToBody,
    trapDetected,
    escStateChanges,
    notes,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(KEY_DIR, `${screen.slug}.json`), JSON.stringify(result, null, 2));
  console.log(
    `  ${trapDetected ? "✗" : "✓"} ${screen.slug.padEnd(10)} focusables=${chain.length} escapedToBody=${escapedToBody} trap=${trapDetected} status=${status}`,
  );
  return result;
}

const screens = FILTER ? SCREENS.filter((s) => s.slug === FILTER) : SCREENS;
if (FILTER && screens.length === 0) {
  console.error(`No screen matches filter: ${FILTER}`);
  process.exit(1);
}

console.log(`Keyboard walkthrough — ${screens.length} screen(s). auth-storage=${authStorageExists ? "present" : "absent"}.`);
const browser = await chromium.launch({ headless: true });
const summary = [];
try {
  for (const screen of screens) {
    console.log(`→ ${screen.slug}${screen.auth ? " (auth)" : ""}`);
    const r = await walkScreen(browser, screen);
    summary.push(r);
  }
} finally {
  await browser.close();
}

const totals = {
  walked: summary.filter((r) => r.status === "ok").length,
  deferred: summary.filter((r) => r.status === "deferred").length,
  bounced: summary.filter((r) => r.status === "bounced").length,
  errored: summary.filter((r) => r.status === "error").length,
  traps: summary.filter((r) => r.trapDetected).length,
};
console.log(`\nDone. walked=${totals.walked} deferred=${totals.deferred} bounced=${totals.bounced} errored=${totals.errored} traps=${totals.traps}`);
console.log(`JSON written to ${KEY_DIR}/`);
