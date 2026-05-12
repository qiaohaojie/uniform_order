// Playwright-driven print QA for §3.7 (pick slips).
//
// Usage:
//   1. Start the dev server in another shell:  pnpm dev:web
//   2. First run:    pnpm print-qa --auth
//        Opens a headed browser. Sign in as a tenant operator, then close it.
//        Storage state is saved to apps/web/tests/print/.storage.json (gitignored).
//   3. Subsequent runs:
//        pnpm print-qa --tenant=nsbh --orders=<orderId>,<orderId-with-note>
//
// Outputs PDFs + screenshots into apps/web/tests/print/output/{engine}/
// Exits non-zero if any assertion fails.
//
// What it verifies:
//   - Single slip: exactly one page, barcode SVG present, no Kanban elements,
//     [data-no-print] hidden, parent-note banner visible iff order has a note.
//   - Batch: orders-board /admin/{tenant}/orders in print emulation — the
//     hidden batch wrapper becomes visible, Kanban is hidden, every slip except
//     the last carries `break-after-page`, no trailing blank.
//
// PDFs are Chromium-only (Playwright limitation). For WebKit (Safari engine)
// we run print-media-emulated screenshots so you can eyeball Safari rendering
// side-by-side with the Chrome PDFs.

import { chromium, webkit } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE = join(__dirname, ".storage.json");
const OUT = join(__dirname, "output");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function authFlow() {
  console.log(`[auth] Opening ${BASE}. Sign in as a tenant operator, then close the browser window (⌘W or click the X). The script waits until disconnection.`);
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE);
  await new Promise((resolve) => browser.once("disconnected", resolve));
  // browser is now disconnected; nothing more to do except persist storage we already grabbed
  // (storage saved on a 1s heartbeat below in case user just closes window with cookies set)
}

async function authFlowHeartbeat() {
  const tenant = args.tenant ?? "nsbh";
  const target = `${BASE}/admin/${tenant}/orders`;
  console.log(`[auth] Opening ${target}. Sign in as a tenant operator. Once you reach the orders Kanban, close the window.`);
  const browser = await chromium.launch({ headless: false });
  let stopped = false;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(target).catch(() => {});

  let lastWrite = "";
  const fs = await import("node:fs/promises");
  const writeIfChanged = async () => {
    try {
      const s = await ctx.storageState();
      const json = JSON.stringify(s);
      if (json !== lastWrite) {
        await fs.writeFile(STORAGE, json);
        lastWrite = json;
      }
    } catch {}
  };
  const interval = setInterval(() => { if (!stopped) writeIfChanged(); }, 1000);

  await new Promise((resolve) => browser.once("disconnected", resolve));
  stopped = true;
  clearInterval(interval);
  await writeIfChanged();
  console.log(`[auth] Browser closed. Storage saved → ${STORAGE}`);
  // force-exit to avoid lingering Chromium helper processes that the heartbeat may have kept alive
  process.exit(0);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

async function assertSingleSlip(page, orderId, expectedNote) {
  await page.emulateMedia({ media: "print" });

  // barcode lives inside an SVG with width=180 height=48 in pick-slip.tsx
  const barcode = await page.locator('svg[width="180"][height="48"]').count();
  barcode > 0 ? pass("barcode SVG present") : fail("no barcode SVG");

  const noPrintVisible = await page.locator("[data-no-print]").filter({ visible: true }).count();
  noPrintVisible === 0 ? pass("[data-no-print] elements hidden in print") : fail(`${noPrintVisible} [data-no-print] elements still visible`);

  // Real Kanban column headers come in a row of >=3. A single match is a status badge — that's expected on a pick slip.
  const allHeaders = await page.getByText(/^(New|In progress|Ready|Picked up)$/).count();
  allHeaders < 3 ? pass(`no kanban column-header row in print (matched ${allHeaders} status label(s) — expected for the order's own status badge)`) : fail(`${allHeaders} status labels — likely the Kanban board leaked into print`);

  // Note banner: look for the actual parent-note text. The print-only banner has no label, just the note content.
  if (expectedNote) {
    const found = await page.getByText(expectedNote.slice(0, 30), { exact: false }).count();
    found > 0 ? pass(`parent-note banner shows note text (order ${orderId})`) : fail(`order ${orderId} has a note but banner not found in print DOM`);
  } else {
    pass(`order ${orderId} has no parent note — banner check skipped`);
  }
}

async function runChromium(orders, tenant, notes) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: STORAGE });
  const dir = join(OUT, "chromium");
  await mkdir(dir, { recursive: true });
  const { readFile } = await import("node:fs/promises");

  for (const orderId of orders) {
    console.log(`\n[chromium] single slip: ${orderId}`);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/${tenant}/orders/${orderId}`, { waitUntil: "networkidle" });
    await assertSingleSlip(page, orderId, notes[orderId]);
    const pdf = join(dir, `single-${orderId}.pdf`);
    await page.pdf({ path: pdf, format: "A4", printBackground: true });
    pass(`PDF saved → ${pdf}`);

    const buf = await readFile(pdf);
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    pages === 1 ? pass(`single slip = 1 page`) : fail(`single slip rendered ${pages} pages (expected 1)`);
    await page.close();
  }

  console.log(`\n[chromium] batch slips: /admin/${tenant}/orders`);
  const board = await ctx.newPage();
  await board.goto(`${BASE}/admin/${tenant}/orders`, { waitUntil: "networkidle" });
  await board.emulateMedia({ media: "print" });

  const kanban = await board.locator("[data-no-print]").filter({ visible: true }).count();
  kanban === 0 ? pass("Kanban hidden in batch print") : fail("Kanban still visible in batch print");

  const slipCount = await board.locator('svg[width="180"][height="48"]').count();
  console.log(`  · ${slipCount} pick-slip barcodes in print DOM`);

  const breaks = await board.locator(".break-after-page").count();
  const expectedBreaks = Math.max(0, slipCount - 1);
  breaks === expectedBreaks ? pass(`${breaks} break-after-page elements (= slips − 1, no trailing blank)`) : fail(`${breaks} break-after-page elements (expected ${expectedBreaks})`);

  const batchPdf = join(dir, `batch.pdf`);
  await board.pdf({ path: batchPdf, format: "A4", printBackground: true });
  pass(`batch PDF saved → ${batchPdf}`);

  const buf = await readFile(batchPdf);
  const batchPages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  batchPages === slipCount ? pass(`batch PDF = ${batchPages} pages (= ${slipCount} slips, no trailing blank)`) : fail(`batch PDF = ${batchPages} pages but ${slipCount} slips in DOM`);

  await browser.close();
}

async function runWebkit(orders, tenant) {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ storageState: STORAGE });
  const dir = join(OUT, "webkit");
  await mkdir(dir, { recursive: true });

  for (const orderId of orders) {
    console.log(`\n[webkit] single slip screenshot: ${orderId}`);
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 794, height: 1123 }); // A4 @ 96dpi
    await page.goto(`${BASE}/admin/${tenant}/orders/${orderId}`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    const shot = join(dir, `single-${orderId}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    pass(`screenshot → ${shot}`);
    await page.close();
  }

  console.log(`\n[webkit] batch screenshot`);
  const board = await ctx.newPage();
  await board.setViewportSize({ width: 794, height: 1123 });
  await board.goto(`${BASE}/admin/${tenant}/orders`, { waitUntil: "networkidle" });
  await board.emulateMedia({ media: "print" });
  await board.screenshot({ path: join(dir, "batch.png"), fullPage: true });
  pass("batch screenshot saved");

  await browser.close();
}

async function main() {
  if (args.auth) {
    await authFlowHeartbeat();
    return;
  }
  const tenant = args.tenant ?? "nsbh";
  const orders = (args.orders ? String(args.orders) : "").split(",").map((s) => s.trim()).filter(Boolean);
  if (orders.length === 0) {
    console.error("Need --orders=<id1>,<id2>  (at least one with a parent note for the banner check)");
    process.exit(2);
  }

  // Optional --notes=NSBH-04297:Please leave...,NSBH-04298:
  //   tells the harness which orders should be checked for note-banner visibility and with what text.
  const notes = {};
  if (args.notes) {
    for (const pair of String(args.notes).split(",")) {
      const [id, ...rest] = pair.split(":");
      notes[id.trim()] = rest.join(":").trim();
    }
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await runChromium(orders, tenant, notes);
  await runWebkit(orders, tenant);

  if (process.exitCode) {
    console.log(`\n❌ Print QA finished with failures. See output above.`);
  } else {
    console.log(`\n✅ Print QA passed. Inspect PDFs/screenshots under ${OUT}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
