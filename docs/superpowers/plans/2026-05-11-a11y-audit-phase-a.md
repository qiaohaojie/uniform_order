# §3.8 Accessibility audit — Phase A implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended — the audit needs the same long-lived dev server + Playwright session, which fights subagent-per-task isolation). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a WCAG 2.1 A+AA pass via `@axe-core/playwright` against the six parent-purchase critical-path screens at iPhone SE 375 × 667 (one of them authenticated), overlay a manual keyboard-only walkthrough, and ship the artefacts + a findings.md as PR #23 — same shape as the §3.9 audit Phase A.

**Architecture:** Reuse §3.9's `capture.mjs` navigation + sample-cart seeding patterns, strip the multi-viewport loop, swap the screenshot step for `new AxeBuilder(page).withTags(...).analyze()`. Auth via a one-off `setup-auth.mjs` that opens headed Playwright, waits for the developer to sign in interactively, and saves `auth-storage.json` (gitignored) via `context.storageState({ path })`. `audit.mjs` loads that file via `browser.newContext({ storageState })` so every navigation runs as the signed-in parent.

**Tech Stack:** Playwright 1.59 (existing, workspace root), `@axe-core/playwright` (new dep, workspace root), Node ESM, Bash + jq for the headline-number derivation.

**Spec:** `docs/superpowers/specs/2026-05-11-a11y-audit-design.md` (commit `cb12a74`). Severity bar: P0 = axe `critical`, P1 = axe `serious` + keyboard task-blockers; observations otherwise. Axe `color-contrast` keeps its own WCAG 1.4.3 thresholds (4.5:1 normal, 3:1 large).

**Correctness gate:** `pnpm check-types:web` clean (no source touched in Phase A — gate is a guard against incidental edits). `node docs/superpowers/audits/2026-05-11-a11y/audit.mjs` exits 0 and writes 6 JSON files. `findings.md` headline numbers derived from those JSON files via the jq summariser in Task 9.

---

## File map (Phase A)

- **Modify:** `package.json` (workspace root) — add `@axe-core/playwright` to `devDependencies`.
- **Modify:** `.gitignore` (workspace root) — add the narrow path `docs/superpowers/audits/2026-05-11-a11y/auth-storage.json`.
- **Modify:** `docs/remaining_work.md` — flip §3.8 to "audit complete; fixes pending".
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/audit.mjs` — main runner.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs` — one-time storage-state capture.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/auth-setup.md` — developer-facing instructions.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/findings.md` — findings + observations writeup.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md` — per-screen checklist.
- **Create:** `docs/superpowers/audits/2026-05-11-a11y/axe/*.json` — 6 axe JSON results (one per screen).
- **NOT committed:** `docs/superpowers/audits/2026-05-11-a11y/auth-storage.json` (gitignored).

The six screens audited (paths fixed):

| Slug | URL | Auth |
|---|---|---|
| `home` | `/` | anon |
| `catalog` | `/nsbh` | anon |
| `item` | `/nsbh/item/shirt-ls` | anon |
| `cart` | `/nsbh/cart` | anon (seeded via localStorage on every context) |
| `checkout` | `/nsbh/checkout` | **authenticated** (cart also seeded) |
| `placed` | `/nsbh/order/placed?total=149.00&delivery=pickup&orderId=NSBH-A11Y` | anon |

Tenant `nsbh` matches the §3.9 audit and has the most-complete seed.

---

## Task 1: Add `@axe-core/playwright` to workspace-root devDependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dep**

```bash
pnpm add -Dw @axe-core/playwright@^4.10.0
```

`-Dw` puts it in `devDependencies` at the workspace root (alongside the existing `playwright@^1.59.1`). Pin to `^4.10.0` — that line is compatible with Playwright 1.59 per the axe-core/playwright README at the time of writing. If pnpm refuses the range as out-of-date, accept the latest 4.x it offers.

- [ ] **Step 2: Verify the install**

```bash
grep -A1 '"devDependencies"' package.json | head -5
node -e "import('@axe-core/playwright').then(m => console.log('ok:', typeof (m.default ?? m.AxeBuilder)))"
```

Expected: `@axe-core/playwright` is listed in `devDependencies` with a `^4` range, and the `node -e` line prints `ok: function`.

- [ ] **Step 3: Type-check (sanity)**

```bash
pnpm check-types:web
```

Expected: clean. (No source touched, but installing a new dep can shift node_modules — confirm nothing broke.)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(a11y): add @axe-core/playwright dep for §3.8 audit"
```

---

## Task 2: Gitignore the (future) auth-storage.json

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Append the narrow path**

In `.gitignore`, append:

```
# §3.8 a11y audit — local Neon Auth session, never commit
docs/superpowers/audits/2026-05-11-a11y/auth-storage.json
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore(a11y): gitignore the §3.8 audit's local auth-storage.json"
```

---

## Task 3: Create the audit directory + write `setup-auth.mjs`

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs`

This is a one-shot helper. Headed Playwright opens `/auth/sign-in`, the developer signs in by hand (magic link from server console, or Google), the script polls for the URL to change away from `/auth/sign-in`, then calls `context.storageState({ path })`.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p docs/superpowers/audits/2026-05-11-a11y/axe
```

- [ ] **Step 2: Write the script**

Create `docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs` with this content:

```javascript
// One-time helper to capture a signed-in Neon Auth session.
// Run from worktree root: node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
// Pre-req: pnpm dev:web running on http://localhost:3000.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const OUT = "docs/superpowers/audits/2026-05-11-a11y/auth-storage.json";
const SIGN_IN_PATH = "/auth/sign-in";
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — interactive sign-in

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
```

- [ ] **Step 3: Smoke-test the script exists + runs the existence check**

```bash
node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
```

If `auth-storage.json` already existed for some reason, the script prints the "already exists" line and exits. Otherwise (the expected first-run case), it launches headed Playwright. **Sign in to a dev account interactively, then let the script save the file.** If you don't have a dev account, create one via the sign-in flow first — pick an email you'd be happy to see in audit logs (e.g. `parent-a11y@local`).

- [ ] **Step 4: Verify the file was written and is ignored**

```bash
ls -la docs/superpowers/audits/2026-05-11-a11y/auth-storage.json
git check-ignore -v docs/superpowers/audits/2026-05-11-a11y/auth-storage.json
git status --short
```

Expected:
- File exists and is non-zero bytes.
- `git check-ignore` prints the rule from `.gitignore`.
- `git status` does NOT list `auth-storage.json`.

- [ ] **Step 5: Commit the script (NOT the storage file)**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
git commit -m "chore(a11y): add one-shot setup-auth.mjs for §3.8 audit

Captures a Neon Auth dev session into auth-storage.json (gitignored)
for the authenticated /checkout capture. Headed Playwright + manual
sign-in; script polls for redirect away from /auth/sign-in."
```

---

## Task 4: Write `audit.mjs`

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/audit.mjs`

The runner reuses §3.9's tenant + sample-cart pattern (see `docs/superpowers/audits/2026-05-11-mobile/capture.mjs` for reference), strips the `VIEWPORTS` loop, swaps the screenshot step for an axe analysis, and writes one JSON per screen to `axe/`. Single viewport: 375 × 667.

- [ ] **Step 1: Write the script**

Create `docs/superpowers/audits/2026-05-11-a11y/audit.mjs` with this content:

```javascript
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
```

- [ ] **Step 2: Commit the script before running it**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/audit.mjs
git commit -m "chore(a11y): add §3.8 audit.mjs runner

Playwright + @axe-core/playwright at iPhone SE 375×667 over 6
parent-flow screens. /checkout uses storageState from auth-storage.json
so the real form is audited; cart + checkout seed localStorage with
the §3.9 sample cart before navigation. Writes one JSON per screen
to docs/superpowers/audits/2026-05-11-a11y/axe/."
```

Committing first means if the run blows up mid-way we can iterate on the script with a clean diff.

---

## Task 5: Start the dev server

**Files:** none — runtime state only.

- [ ] **Step 1: Kill any stale Next.js dev server**

```bash
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
pgrep -f "next dev|next-server" | head -3 || echo stopped
```

Expected: `stopped` or no output.

- [ ] **Step 2: Confirm env.local exists in the worktree**

```bash
test -f apps/web/.env.local && echo "exists" || echo "MISSING — copy from primary worktree first"
```

If missing: `cp /Volumes/T7/georgeqiao/dev/uniform_order/apps/web/.env.local apps/web/.env.local`. The audit can't reach Neon Auth, Stripe, or any DB without it.

- [ ] **Step 3: Start the dev server in the background**

If running this plan via the Claude Code Bash tool, invoke `pnpm dev:web` with `run_in_background: true`. If running by hand from a terminal, use:

```bash
pnpm dev:web > /tmp/a11y-dev.log 2>&1 &
echo "dev PID: $!"
```

Either way, the dev server must be reachable at `http://localhost:3000` before continuing.

- [ ] **Step 4: Wait for :3000 to return 200**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 || echo down)
  if [ "$code" = "200" ]; then echo "ready ($i)"; break; fi
  sleep 3
done
```

Expected: `ready` within ~30 s.

---

## Task 6: Capture the Neon Auth dev session

**Files:** none — produces (gitignored) `auth-storage.json`.

- [ ] **Step 1: Run setup-auth.mjs**

```bash
node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
```

A headed Chromium window opens at `/auth/sign-in`. Sign in interactively (magic link from the dev console, or Google). The script auto-detects the redirect away from `/auth/sign-in`, saves `auth-storage.json`, and exits.

- [ ] **Step 2: Verify**

```bash
ls -la docs/superpowers/audits/2026-05-11-a11y/auth-storage.json
git status --short docs/superpowers/audits/2026-05-11-a11y/ | grep -v "^??" | head -3
```

Expected: file exists; `git status` does NOT list it (it's gitignored). The directory may show untracked new files from earlier tasks — that's fine.

---

## Task 7: Run the audit

**Files:** produces `axe/{home,catalog,item,cart,checkout,placed}.json`.

- [ ] **Step 1: Run audit.mjs**

```bash
node docs/superpowers/audits/2026-05-11-a11y/audit.mjs 2>&1 | tail -20
```

Expected output ends with `✓ All 6 axe runs complete.` and a per-screen line of impact counts. If any screen errors (e.g. axe throws on a malformed page), stop and report — likely a hydration timing issue; bump the `waitForTimeout(800)` to `1500` and retry.

- [ ] **Step 2: Verify all 6 JSON files exist**

```bash
ls docs/superpowers/audits/2026-05-11-a11y/axe/ | wc -l
ls docs/superpowers/audits/2026-05-11-a11y/axe/
```

Expected: `6` and the six filenames `home.json catalog.json item.json cart.json checkout.json placed.json`.

- [ ] **Step 3: Sanity-check the authenticated screen**

```bash
jq -r '.url, .auth, (.violations | length), (.violations[0].id // "no violations")' docs/superpowers/audits/2026-05-11-a11y/axe/checkout.json
```

Expected: prints the checkout URL, `true`, a violation count (any value), and the first violation id (or "no violations"). The critical thing is `.auth` = `true` — confirms storage state was applied. If `false`, the storage-state load didn't take.

If the `checkout.json` looks like it captured the sign-in page (e.g. an `axe` violation on a `<form>` whose `name` field has no label), the session expired or didn't apply. Re-run Task 6.

---

## Task 8: Compute headline numbers + the burgundy-contrast triple-check

**Files:** none — produces values used in Task 9.

- [ ] **Step 1: Aggregate impact counts across all 6 screens**

```bash
echo "=== Headline tallies (Phase A) ==="
for f in docs/superpowers/audits/2026-05-11-a11y/axe/*.json; do
  jq -r '"\(.screen): crit=\(.counts.critical) ser=\(.counts.serious) mod=\(.counts.moderate) min=\(.counts.minor) inc=\(.counts.incomplete)"' "$f"
done
echo
echo "=== Totals ==="
jq -s '{
  critical: (map(.counts.critical) | add),
  serious: (map(.counts.serious) | add),
  moderate: (map(.counts.moderate) | add),
  minor: (map(.counts.minor) | add),
  incomplete: (map(.counts.incomplete) | add)
}' docs/superpowers/audits/2026-05-11-a11y/axe/*.json
```

**Record these numbers** — they go into `findings.md` Headline and the PR body. Per the spec severity bar: `critical + serious` = total P0 + P1 count (you'll split P0 vs P1 in Task 9 by reading each violation row).

- [ ] **Step 2: List the violation ids per screen (so you know what's there)**

```bash
echo "=== Violation ids per screen ==="
for f in docs/superpowers/audits/2026-05-11-a11y/axe/*.json; do
  name=$(jq -r .screen "$f")
  jq -r --arg n "$name" '.violations[] | "\($n): [\(.impact)] \(.id) — \(.help) (\(.nodes | length) node\(if (.nodes | length) == 1 then "" else "s" end))"' "$f"
done
```

This is the raw list you turn into the findings table.

- [ ] **Step 3: Burgundy contrast triple-check**

The spec calls out the burgundy `#7A1F2B` accent specifically — verify the three combinations against actionable-text thresholds, regardless of whether axe flagged them on a given screen. Inline this in `findings.md`.

```bash
node -e '
function rel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function lum([r, g, b]) {
  return 0.2126 * rel(r) + 0.7152 * rel(g) + 0.0722 * rel(b);
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}
const burgundy = [0x7a, 0x1f, 0x2b];
const parchment = [0xfa, 0xf6, 0xee];
const paper = [0xfd, 0xfb, 0xf6];
const white = [0xff, 0xff, 0xff];
console.log("burgundy on parchment:", ratio(burgundy, parchment));
console.log("burgundy on paper:    ", ratio(burgundy, paper));
console.log("burgundy on white:    ", ratio(burgundy, white));
' | tee docs/superpowers/audits/2026-05-11-a11y/burgundy-contrast.txt
```

`tee` writes the ratios to `burgundy-contrast.txt` so Task 9 doesn't have to depend on terminal scrollback. The file gets committed alongside the rest of the audit dir.

Record the three ratios. WCAG 1.4.3: 4.5:1 normal text, 3:1 large text (≥ 18pt or 14pt bold). Any combination that falls below the relevant threshold for actionable text is a P1 finding — call it out explicitly in `findings.md`, even if axe missed it (axe only flags pairs it actually saw rendered, not theoretical combinations).

---

## Task 9: Write `findings.md`

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/findings.md`

Mirror §3.9's `findings.md` structure: front matter pointers, Headline, Findings table (one row per distinct violation; P0 = axe `critical`, P1 = axe `serious` or keyboard task-blocker), Burgundy contrast table, Observations (moderate/minor/incomplete), How-to-read, Methodology notes.

- [ ] **Step 1: Create the file**

Use this scaffold. **Replace every `<…>` placeholder** with values derived from the JSON + Tasks 8 / 10. Do not commit with placeholders unfilled.

```markdown
# §3.8 Accessibility audit — findings (2026-05-11)

**Spec:** `docs/superpowers/specs/2026-05-11-a11y-audit-design.md`
**Plan (Phase A):** `docs/superpowers/plans/2026-05-11-a11y-audit-phase-a.md`
**Captured:** 2026-05-11
**Tenant:** `nsbh`
**Viewport:** iPhone SE 375 × 667 (single — see spec)
**Axe results:** `docs/superpowers/audits/2026-05-11-a11y/axe/` (6 JSON files)

## Headline

Across the 6 critical-path screens at 375 × 667:

- Axe `critical`: **<N>** (P0)
- Axe `serious`: **<N>** (P1)
- Axe `moderate` / `minor`: **<N>** / **<N>** (observations)
- Axe `incomplete` (needs human eval, e.g. iframed Stripe): **<N>**
- Manual keyboard task-blockers: **<N>** (P1)

Net P0 + P1 count: **<N>**. See per-row table below.

## Findings (P0 + P1)

| # | Severity | Screen | Axe rule / source | WCAG SC | Affected element | Proposed fix shape |
|---|---|---|---|---|---|---|
| A1 | <P0/P1> | <screen> | `<axe-id>` or `keyboard:<note>` | <1.x.x> | `<selector>` | <one-line fix shape> |
| A2 | … | … | … | … | … | … |

(Add one row per distinct violation. If a single axe rule fires on N nodes within one screen, that's still one finding — list the node count in the element cell.)

## Burgundy `#7A1F2B` contrast (from Task 8 Step 3)

| Pairing | Computed ratio | WCAG 1.4.3 normal text (≥ 4.5:1) | WCAG 1.4.3 large text (≥ 3:1) | Verdict |
|---|---|---|---|---|
| burgundy on parchment `#FAF6EE` | <ratio> | <pass/fail> | <pass/fail> | <observation/P1> |
| burgundy on paper `#FDFBF6` | <ratio> | <pass/fail> | <pass/fail> | <observation/P1> |
| burgundy on white `#FFFFFF` | <ratio> | <pass/fail> | <pass/fail> | <observation/P1> |

(P1 if a failing combination is used on actionable text — link, button label. Observation if only used decoratively.)

## Observations (out of scope per severity bar; recorded for post-launch)

- <each axe moderate/minor finding worth recording>
- <each incomplete finding — e.g. "checkout: Stripe Card Element iframe contents flagged `incomplete` for color-contrast; axe cannot inspect cross-origin frames. Stripe asserts WCAG 2.1 AA upstream; accepted.">
- <any keyboard walkthrough notes that aren't task-blockers>

## How to read this

- **P0** = axe `critical` (e.g. keyboard trap, missing label on a form input, ARIA hidden focusable).
- **P1** = axe `serious` + manual keyboard findings that block a parent from completing the buy flow + burgundy actionable-text contrast failures.
- **Observation** = axe `moderate`/`minor`, axe `incomplete` we can't act on (Stripe iframe), heading-order quirks, redundant landmarks.

P0 and P1 are ship-blocking under the spec; observations are not.

## Methodology notes

- Single viewport: iPhone SE 375 × 667. Axe rule coverage is largely viewport-independent; this matches §3.9's baseline so any side-by-side fix verifications stay comparable.
- `/checkout` was audited authenticated (Neon Auth dev session captured into `auth-storage.json`, gitignored). Closes §3.9's anonymous-checkout gap.
- Stripe Payment Element iframe contents are not in scope — Stripe asserts WCAG 2.1 AA upstream. We audit the surrounding form.
- Phase B (fixes) is drafted only after this Phase A's findings are reviewed.
```

- [ ] **Step 2: Fill in every `<…>` placeholder**

Use the Task 8 outputs for the Headline + Burgundy table. For each row of "Findings", read the corresponding `axe/<screen>.json` to pull selector + failureSummary. Cross-reference Task 10 (keyboard walkthrough) for `keyboard:<note>` rows.

If a row is borderline (axe `serious` on a decorative element), keep it in the Findings table with a brief justification in the "Proposed fix shape" column — Phase B will accept-or-defer per row.

- [ ] **Step 3: Sanity-check the Headline numbers against the JSON one more time**

```bash
echo "JSON says:"
jq -s '{crit:(map(.counts.critical)|add), ser:(map(.counts.serious)|add), mod:(map(.counts.moderate)|add), min:(map(.counts.minor)|add), inc:(map(.counts.incomplete)|add)}' docs/superpowers/audits/2026-05-11-a11y/axe/*.json
echo
echo "findings.md says:"
grep -E "^- Axe " docs/superpowers/audits/2026-05-11-a11y/findings.md
```

The two outputs MUST agree on critical / serious / moderate / minor / incomplete. If not, fix findings.md.

---

## Task 10: Manual keyboard-only walkthrough

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md`

Per the spec, this is genuinely manual — you (the executor / developer) tab through each screen in a real browser, no automation. Record per the checklist template.

- [ ] **Step 1: Open each screen in a regular browser tab at 375 × 667**

Easiest: Chrome DevTools → toggle device toolbar → choose "iPhone SE". Visit each of the 6 URLs (sign in as the same dev account for /checkout). For each, use Tab / Shift-Tab only (no mouse) and exercise the page.

- [ ] **Step 2: Fill in `keyboard-walkthrough.md`**

Use this exact template, with one block per screen, in this order: home, catalog, item, cart, checkout, placed.

```markdown
# §3.8 Keyboard-only walkthrough (2026-05-11)

Companion to `findings.md`. iPhone SE 375 × 667. Mouse-free. One block per screen; check each box explicitly. **An un-checked box is a finding** — record what failed in the Notes.

### home — `/`

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes: <free-form, or "none" if all boxes checked>

### catalog — `/nsbh`

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes: …

### item — `/nsbh/item/shirt-ls`

(repeat)

### cart — `/nsbh/cart`

(repeat)

### checkout — `/nsbh/checkout` (authenticated)

(repeat)

### placed — `/nsbh/order/placed?orderId=demo`

(repeat)

## Cross-screen patterns

<any pattern that recurs across screens, e.g. "Focus ring on icon-only header buttons is hard to see against the burgundy bar — flagged separately as Finding A<N> for contrast">
```

- [ ] **Step 3: Convert any unchecked box into a Finding row in findings.md**

For every un-checked box, add a corresponding row to the Findings table in `findings.md` (Task 9) with `keyboard:<note>` in the source column. If a keyboard issue blocks task completion (e.g. you cannot reach the "Add to cart" button without a mouse), it's P1. If it's a focus-ring-not-visible-enough on a decorative control, it's an observation.

---

## Task 11: Update `remaining_work.md`

**Files:**
- Modify: `docs/remaining_work.md`

- [ ] **Step 1: Locate the §3.8 heading**

```bash
grep -n "^### 3\.8" docs/remaining_work.md
```

Expected: a single line matching `### 3.8 Accessibility audit`.

- [ ] **Step 2: Read and reconcile**

Read 15 lines around that line. If the wording has drifted from the snippet below, edit by the matched anchor instead of pasting verbatim — a silent Edit failure would leave §3.8 stale.

Current expected text (verify against actual file first):

```
### 3.8 Accessibility audit

No automated a11y tests run today. At minimum: keyboard nav through the parent flow, `aria-label`s on icon buttons (cart, add-to-cart, status pills), colour-contrast on the burgundy `#7A1F2B` accent.
```

Replace with (substitute real Headline numbers from Task 8):

```
### 3.8 Accessibility audit — audit complete; fixes pending

Audit done 2026-05-11. See `docs/superpowers/audits/2026-05-11-a11y/findings.md` for the findings + observations (<N> P0s, <N> P1s, <N> observations). Fix phase (Phase B plan) is drafted only after the findings are reviewed.
```

- [ ] **Step 3: Stage but do not commit**

```bash
git add docs/remaining_work.md
```

The §3.8 doc-update commit lands together with findings.md + keyboard-walkthrough.md + axe/* in Task 12.

---

## Task 12: Stop the dev server, commit, push, open PR

**Files:** all staged from Tasks 9-11.

- [ ] **Step 1: Stop the dev server**

```bash
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
```

- [ ] **Step 2: Stage the audit dir + findings + walkthrough**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/findings.md \
        docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md \
        docs/superpowers/audits/2026-05-11-a11y/burgundy-contrast.txt \
        docs/superpowers/audits/2026-05-11-a11y/axe/ \
        docs/remaining_work.md
git status --short
```

Expected: no `auth-storage.json` in the list (gitignored). Six new `axe/*.json` files. Two new docs. One modified `remaining_work.md`.

- [ ] **Step 3: Type-check (correctness gate)**

```bash
pnpm check-types:web
```

Expected: clean. (No source touched — this gate is a guard against incidental edits.)

- [ ] **Step 4: Commit**

Substitute the real Headline numbers from Task 8 for the `<N>` placeholders.

```bash
git commit -m "$(cat <<'EOF'
chore(a11y): §3.8 audit Phase A — axe results + findings

Single-viewport (iPhone SE 375×667) WCAG 2.1 A+AA pass across the
six parent-flow critical-path screens via @axe-core/playwright,
overlaid with a manual keyboard-only walkthrough.

- axe/*.json — 6 JSON result files.
- findings.md — Headline (<N> P0s, <N> P1s, <N> observations),
  findings table, burgundy #7A1F2B contrast triple-check.
- keyboard-walkthrough.md — per-screen checklist (every box
  explicitly checked or recorded as a finding).
- remaining_work.md §3.8 flipped to "audit complete; fixes pending".

/checkout audited authenticated via a Neon Auth dev session captured
locally into auth-storage.json (gitignored). Closes §3.9's known
anonymous-/checkout gap.

Phase B (fixes) drafted only after findings reviewed.
EOF
)"
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin worktree-a11y-audit 2>&1 | tail -5
gh pr create --title "chore(a11y): §3.8 audit — WCAG 2.1 A+AA pass on parent flow" --body "$(cat <<'EOF'
## Summary

Phase A of `docs/remaining_work.md` §3.8 — accessibility audit on the six parent-purchase critical-path screens at iPhone SE 375 × 667 via `@axe-core/playwright`, overlaid with a manual keyboard-only walkthrough.

### Results (headline)

- Axe `critical`: **<N>** (P0)
- Axe `serious`: **<N>** (P1)
- Axe `moderate` / `minor`: **<N>** / **<N>** (observations)
- Axe `incomplete`: **<N>** (mostly Stripe Payment Element iframe — accepted as upstream-tested)
- Manual keyboard task-blockers: **<N>** (P1)

Net **<N>** P0 + P1 to address in Phase B. See `docs/superpowers/audits/2026-05-11-a11y/findings.md` for the per-row table + the burgundy `#7A1F2B` contrast triple-check.

### Method

- 6 screens: home, catalog, item, cart, checkout (auth), placed.
- Axe tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
- `/checkout` audited authenticated via a Neon Auth dev session captured locally to `auth-storage.json` (gitignored). Closes §3.9's known anonymous-/checkout gap.
- Stripe Payment Element iframe is out of scope — accepted as upstream-tested.

### Phase B

Plan drafted only after this PR's findings are reviewed. Expected shape: one commit per P0/P1 fix, re-run audit into `axe/after/`, verify P0+P1 count drops to zero, close §3.8.

## Test plan

- [x] `pnpm check-types:web` clean.
- [x] `axe/` contains 6 JSON files (one per screen).
- [x] `findings.md` Headline numbers match `jq -s` totals across the 6 JSON files.
- [x] `keyboard-walkthrough.md` has every box explicitly checked or surfaced as a finding.
- [ ] George reviews `findings.md` before Phase B is drafted.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -5
```

- [ ] **Step 6: Print the PR URL**

```bash
gh pr view --json url -q .url
```

End of Phase A. Phase B plan is drafted only after George reviews `findings.md`.

---

## Self-review checklist (run after Task 12)

- [ ] Six axe JSON files in `axe/`.
- [ ] `findings.md` Headline numbers match the JSON tallies and the table rows.
- [ ] Burgundy contrast table in `findings.md` filled in with real ratios.
- [ ] `keyboard-walkthrough.md` has every box explicitly checked OR un-checked + a Note for any un-checked box.
- [ ] `remaining_work.md` §3.8 collapsed to the "audit complete; fixes pending" pointer with real numbers (not `<N>` placeholders).
- [ ] `auth-storage.json` exists locally but is NOT in `git status`.
- [ ] PR opened with `chore(a11y):` prefix; body has real Headline numbers (not `<N>` placeholders).
- [ ] Commit subject also uses `chore(a11y):` (matches PR title).
- [ ] `/checkout` `incomplete` count reviewed — any non-Stripe entries surfaced as findings or observations, not silently dropped. Stripe iframe entries are excluded at audit time via the `.exclude("iframe[name^='__privateStripeFrame']")` filter; verify they don't reappear from a different selector.

If any item fails, fix inline before handing off.
