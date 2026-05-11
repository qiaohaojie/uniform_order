// Mobile viewport audit — Phase A capture script.
// Run from worktree root: node docs/superpowers/audits/2026-05-11-mobile/capture.mjs
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const TENANT = "nsbh";
const OUT_DIR = "docs/superpowers/audits/2026-05-11-mobile";
const BASELINE = join(OUT_DIR, process.argv[2] ?? "baseline");
const DOM = join(OUT_DIR, "dom");
mkdirSync(BASELINE, { recursive: true });
mkdirSync(DOM, { recursive: true });

const VIEWPORTS = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "android-landscape", width: 740, height: 360 },
  { name: "ipad-split", width: 507, height: 820 },
];

const SAMPLE_CART = [
  { itemId: "shirt-ls", variantLabel: "10–24", size: "16", qty: 2, price: 28, name: "White Shirt — Long Sleeves" },
  { itemId: "jumper", variantLabel: "12–16", size: "16", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
  { itemId: "tie", variantLabel: "Year 7–10 long (137cm)", size: "7-10L", qty: 1, price: 18, name: "School Tie — Navy Crested" },
];

const PLACED_QS = `total=149.00&delivery=pickup&orderId=${TENANT.toUpperCase()}-AUDIT`;

async function snapshotInteractive(page) {
  return await page.evaluate(() => {
    const rects = Array.from(
      document.querySelectorAll("button, a, input, select, textarea, [role=button], [role=link]"),
    ).map((el) => {
      const r = el.getBoundingClientRect();
      const inViewport =
        r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
      const cls =
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      const id = el.id ? "#" + el.id : "";
      return {
        selector: el.tagName.toLowerCase() + id + cls,
        rectPx: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        visible: inViewport,
        smallestDim: Math.min(r.width, r.height),
      };
    });
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      interactiveElements: rects,
    };
  });
}

async function capture(page, screen, viewport) {
  const baseName = `${screen}-${viewport.name}`;
  const pngPath = join(BASELINE, `${baseName}.png`);
  const jsonPath = join(DOM, `${baseName}.json`);

  // Let layout settle.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);

  await page.screenshot({ path: pngPath, fullPage: true });
  const snap = await snapshotInteractive(page);
  writeFileSync(jsonPath, JSON.stringify({ screen, viewport: viewport.name, viewportPx: [viewport.width, viewport.height], ...snap }, null, 2));
  console.log(`  captured ${baseName} (scrollWidth=${snap.documentScrollWidth} vs viewport=${snap.viewportWidth})`);
}

async function runViewport(browser, viewport) {
  console.log(`\n→ Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });

  // Seed cart into localStorage on every page-load.
  await context.addInitScript((cart) => {
    try {
      localStorage.setItem("uo:cart:v1", JSON.stringify(cart));
    } catch {}
  }, SAMPLE_CART);

  const page = await context.newPage();

  // 1. Home
  await page.goto(BASE);
  await capture(page, "home", viewport);

  // 2. Catalog
  await page.goto(`${BASE}/${TENANT}`);
  await capture(page, "catalog", viewport);

  // 3. Item detail — grab the first item id from the catalog DOM.
  const itemHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/item/"]');
    return a ? a.getAttribute("href") : null;
  });
  if (!itemHref) throw new Error("Could not find an item link on the catalog page");
  await page.goto(`${BASE}${itemHref}`);
  await capture(page, "item", viewport);

  // 4. Cart (stubbed localStorage)
  await page.goto(`${BASE}/${TENANT}/cart`);
  await capture(page, "cart", viewport);

  // 5. Checkout (stubbed localStorage)
  await page.goto(`${BASE}/${TENANT}/checkout`);
  await capture(page, "checkout", viewport);

  // 6. Placed (stub query params — placed page has defaults for everything)
  await page.goto(`${BASE}/${TENANT}/order/placed?${PLACED_QS}`);
  await capture(page, "placed", viewport);

  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const vp of VIEWPORTS) {
      await runViewport(browser, vp);
    }
  } finally {
    await browser.close();
  }
  console.log("\n✓ All 18 captures complete.");
})();
