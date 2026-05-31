// Generates the social share card → apps/landing/public/og.png (1200×630).
// Renders an on-brand HTML template with headless Chromium so the real
// design-system fonts (Newsreader / Inter / JetBrains Mono) are used.
//
//   node apps/landing/scripts/generate-og.mjs
//
// Re-run whenever the wording or branding changes.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/og.png");

const NAVY_DEEP = "#081A2D";
const NAVY = "#0E2A47";
const PARCHMENT = "#FAF6EE";
const GOLD = "#B08A3E";
const DIM = "rgba(250,246,238,0.66)";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300..700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  .card {
    width: 1200px; height: 630px; position: relative; overflow: hidden;
    background: linear-gradient(135deg, ${NAVY_DEEP} 0%, ${NAVY} 100%);
    color: ${PARCHMENT};
    padding: 80px;
    display: flex; flex-direction: column;
    font-family: "Inter", sans-serif;
  }
  .rings { position: absolute; right: -160px; top: 50%; transform: translateY(-50%); opacity: 0.10; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .wordmark { font-family: "Newsreader", serif; font-weight: 600; font-size: 30px; letter-spacing: 0.2px; }
  .headline {
    font-family: "Newsreader", serif; font-weight: 500;
    font-size: 64px; line-height: 1.08; letter-spacing: -0.8px;
    max-width: 820px; margin-top: auto;
  }
  .rule { display: flex; flex-direction: column; gap: 3px; margin: 28px 0; width: 120px; }
  .rule span { height: 1.5px; background: ${GOLD}; display: block; }
  .rule span:last-child { width: 60%; }
  .sub { font-size: 23px; line-height: 1.5; color: ${DIM}; max-width: 720px; }
  .url { font-family: "JetBrains Mono", monospace; font-weight: 600; font-size: 19px; color: ${GOLD}; letter-spacing: 0.5px; margin-top: auto; }
</style></head>
<body>
  <div class="card">
    <svg class="rings" width="520" height="520" viewBox="0 0 520 520" aria-hidden="true">
      <circle cx="260" cy="260" r="250" stroke="#fff" stroke-width="1.5" fill="none"/>
      <circle cx="260" cy="260" r="185" stroke="#fff" stroke-width="1.5" fill="none"/>
      <circle cx="260" cy="260" r="120" stroke="#fff" stroke-width="1.5" fill="none"/>
      <circle cx="260" cy="260" r="60" stroke="#fff" stroke-width="1.5" fill="none"/>
    </svg>

    <div class="brand">
      <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="none" stroke="${PARCHMENT}" stroke-width="1.4"/>
        <path d="M9 9 V18 a3 3 0 0 0 6 0 V9" fill="none" stroke="${PARCHMENT}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="22" cy="14" r="4.5" fill="none" stroke="${PARCHMENT}" stroke-width="1.8"/>
      </svg>
      <span class="wordmark">UniformOrder</span>
    </div>

    <h1 class="headline">Online uniform shops for Australian schools.</h1>
    <div class="rule"><span></span><span></span></div>
    <p class="sub">Parents order from their phone. Your P&amp;C packs from a tablet. Payouts land straight in the school&rsquo;s bank account.</p>
    <div class="url">uniformorder.online</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await page.locator(".card").screenshot({ path: OUT });
await browser.close();
console.log("Wrote", OUT);
