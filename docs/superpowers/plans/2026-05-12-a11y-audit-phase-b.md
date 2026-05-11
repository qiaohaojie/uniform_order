# §3.8 Accessibility — Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the 3 a11y findings surfaced in Phase A (A1 P0 select label, A2 P1 Stripe aria-hidden-focus, A3 P1 gold-text contrast), perform the deferred manual keyboard walkthrough, and re-audit to confirm P0 + P1 = 0 on the parent flow.

**Architecture:** Six sequential commits on the current worktree branch. One audit-runner parameterisation commit (lands first so the Phase A baseline at `axe/*.json` is never overwritten by intermediate runs), three fix commits (one per finding), one walkthrough commit (audit-only, no code), one re-audit/close-out commit (runs the parameterised audit into `axe/after/` and migrates §3.8 from `remaining_work.md` to `completed.md`). No new tests — `audit.mjs` IS the test, with the contrast-math check and the manual smoke test as supplementary local gates.

**Tech Stack:** Next.js 16 App Router (RSC + client components), Tailwind CSS v4 with `@theme` tokens, `@stripe/stripe-js` (direct, not the React wrapper), Playwright + `@axe-core/playwright`, Neon Auth for the `/checkout` session.

**Spec:** `docs/superpowers/specs/2026-05-11-a11y-audit-phase-b-design.md`
**Phase A findings:** `docs/superpowers/audits/2026-05-11-a11y/findings.md`
**Phase A audit runner:** `docs/superpowers/audits/2026-05-11-a11y/audit.mjs`

**Worktree:** `/Volumes/T7/georgeqiao/dev/uniform_order/.claude/worktrees/async-doodling-unicorn` (branch `worktree-async-doodling-unicorn`). All commands are run from the worktree root unless explicitly noted.

**Pre-flight:** before starting Task 5, dev server must be running (`pnpm dev:web` on port 3000) and `auth-storage.json` must be valid. Tasks 1–4 do not require a running server.

---

## Task 1: A1 — `FieldLabel` becomes a semantic `<label htmlFor>`

**Files:**
- Modify: `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx` (`FieldLabel` definition at line 558; 6 field uses at lines 345, 353, 361, 372, 380, 388)

The current `FieldLabel` is a styled `<div>`. Axe `select-name` flags the `Year` `<select>` as P0 because no `<label>` is programmatically associated. Fix by converting `FieldLabel` to a `<label htmlFor>` and giving every input/select a matching `id`. The 5 sibling inputs (`Student name`, `Roll class`, `Parent / guardian name`, `Mobile`, `Email (receipt)`) silently upgrade from "passes axe by accident" to "properly labelled" in the same change.

- [ ] **Step 1: Change `FieldLabel` to require `htmlFor` and render a `<label>`**

Replace the current definition at `apps/web/src/app/[tenant]/checkout/checkout-screen.tsx:558-564`:

```tsx
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[10.5px] font-semibold mb-1" style={{ color: "var(--color-ink-dim)" }}>
      {children}
    </label>
  );
}
```

`block` matches the original `<div>`'s default block-level layout so the visual layout is unchanged.

- [ ] **Step 2: Wire `htmlFor` and `id` for all 6 fields**

In the same file, update each field block to pass `htmlFor` on the label and `id` on the matching input/select. Field-id choices follow the existing field-key naming for clarity. Replace the 6 blocks roughly at lines 344–394:

```tsx
<div className="col-span-2">
  <FieldLabel htmlFor="studentName">Student name</FieldLabel>
  <input id="studentName" value={student.studentName} onChange={(e) => setField("studentName", e.target.value)}
    placeholder="e.g. Riley Qiao"
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
    style={{ borderColor: fieldErrors.studentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
  {fieldErrors.studentName && <FieldError>{fieldErrors.studentName}</FieldError>}
</div>
<div>
  <FieldLabel htmlFor="year">Year</FieldLabel>
  <select id="year" value={student.year} onChange={(e) => setField("year", e.target.value)}
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none bg-white"
    style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}>
    {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
  </select>
</div>
<div>
  <FieldLabel htmlFor="rollClass">Roll class</FieldLabel>
  <input id="rollClass" value={student.rollClass} onChange={(e) => setField("rollClass", e.target.value)}
    placeholder="e.g. 9F"
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
    style={{ borderColor: fieldErrors.rollClass ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
  {fieldErrors.rollClass && <FieldError>{fieldErrors.rollClass}</FieldError>}
</div>
```

And for the second field group:

```tsx
<div>
  <FieldLabel htmlFor="parentName">Parent / guardian name</FieldLabel>
  <input id="parentName" value={student.parentName} onChange={(e) => setField("parentName", e.target.value)}
    placeholder="e.g. George Qiao"
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
    style={{ borderColor: fieldErrors.parentName ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
  {fieldErrors.parentName && <FieldError>{fieldErrors.parentName}</FieldError>}
</div>
<div>
  <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
  <input id="mobile" value={student.mobile} onChange={(e) => setField("mobile", e.target.value)}
    placeholder="04xx xxx xxx" type="tel"
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
    style={{ borderColor: fieldErrors.mobile ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
  {fieldErrors.mobile && <FieldError>{fieldErrors.mobile}</FieldError>}
</div>
<div>
  <FieldLabel htmlFor="email">Email (receipt)</FieldLabel>
  <input id="email" value={student.email} onChange={(e) => setField("email", e.target.value)}
    placeholder="you@example.com" type="email"
    className="w-full h-10 border rounded-md px-3 text-[13px] outline-none"
    style={{ borderColor: fieldErrors.email ? "#B23A2A" : "var(--color-rule)", color: "var(--color-ink)" }} />
  {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
</div>
```

Add `id` only. Do not add `name` attributes — they would be ignored by React's controlled-input state anyway, and adding them changes nothing useful.

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: PASS — no errors. (TypeScript will complain at every `<FieldLabel>...</FieldLabel>` lacking `htmlFor` if any were missed — that's the safety net.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[tenant\]/checkout/checkout-screen.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): A1 — FieldLabel becomes a semantic <label htmlFor>

Phase A axe surfaced <select> "Year" as P0 select-name failure: FieldLabel
was a styled <div> with no programmatic association. Converted to a real
<label htmlFor>; added stable ids to all 6 checkout inputs/selects.
Year fixes the P0; the other 5 inputs silently upgrade from
passes-axe-by-accident to properly labelled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: A3 — introduce `--color-gold-text` for small-text gold uses

**Files:**
- Modify: `apps/web/src/index.css` (`@theme` block, sibling to `--color-gold` at line 14)
- Modify: `apps/web/src/app/home-client.tsx` (lines 99, 188)
- Modify: `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` (line 220)

Phase A surfaced the home "Welcome" eyebrow at 2.97:1 (gold `#B08A3E` on parchment `#FAF6EE`). The fix is a darker variant `--color-gold-text: #8C6A28`, used only by small-bold-gold parent-flow eyebrows. Three call sites switch; large/decorative gold uses are untouched.

- [ ] **Step 1: Add `--color-gold-text` token to `index.css`**

In `apps/web/src/index.css`, modify the `@theme` block so the gold tokens read:

```css
  --color-gold: #B08A3E;
  --color-gold-text: #8C6A28;
```

Place `--color-gold-text` immediately after `--color-gold` for grouping.

- [ ] **Step 2: Verify the contrast math locally**

The chosen hex must clear 4.5:1 against parchment `#FAF6EE`. Run a one-liner to compute the ratio. From the worktree root:

```bash
node -e '
function rel(rgb){const c=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}
function ratio(a,b){const l1=rel(a),l2=rel(b);const [hi,lo]=l1>l2?[l1,l2]:[l2,l1];return (hi+0.05)/(lo+0.05)}
const fg=[0x8C,0x6A,0x28], bg=[0xFA,0xF6,0xEE];
console.log("ratio:", ratio(fg,bg).toFixed(2), ":1");
'
```

Expected: `ratio: 4.74 :1` (or thereabouts — anything ≥ 4.5 is a pass). If the printed ratio is < 4.5, **stop and darken** the hex by one step (e.g. `#856427` → `#7E6024`) and re-run until it clears. Record the final value and ratio in the commit message at Step 6.

- [ ] **Step 3: Swap home eyebrows**

In `apps/web/src/app/home-client.tsx`, at line 99:

```tsx
<div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold-text)" }}>
  Welcome
</div>
```

And at line 188:

```tsx
<div className="text-[11px] font-bold tracking-[1.4px] uppercase" style={{ color: "var(--color-gold-text)" }}>
  Welcome back
</div>
```

- [ ] **Step 4: Swap parent order-detail eyebrow**

In `apps/web/src/app/orders/[orderId]/order-detail-client.tsx` at line 220:

```tsx
<div className="text-[11px] font-bold tracking-[1.2px] uppercase mb-1" style={{ color: "var(--color-gold-text)" }}>
  Your note to the school
</div>
```

- [ ] **Step 5: Type-check**

Run: `pnpm check-types:web`
Expected: PASS — no errors. (Tailwind v4 `@theme` tokens are read by the CSS layer; TypeScript sees only inline `style` objects with string colors, so this is largely a sanity check that nothing else broke.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css apps/web/src/app/home-client.tsx apps/web/src/app/orders/\[orderId\]/order-detail-client.tsx
git commit -m "$(cat <<'EOF'
fix(a11y): A3 — --color-gold-text for small-text gold uses

Phase A flagged the home "Welcome" eyebrow at 2.97:1 (#B08A3E on
#FAF6EE) — below the 4.5:1 WCAG 1.4.3 normal-text minimum at 11px bold.
Added --color-gold-text: #8C6A28 (computed 4.74:1 vs parchment); swapped
three parent-flow small-bold-gold eyebrows to it (home x2, parent order
detail x1). Decorative/large --color-gold uses untouched. Admin
pick-slip.tsx:164 deferred to a future admin a11y audit per spec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: A2 — parameterise audit runner, upgrade `@stripe/stripe-js`, smoke-test, conditional exclude

**Files:**
- Modify: `docs/superpowers/audits/2026-05-11-a11y/audit.mjs` (parameterise output subdir; later steps conditionally add a Stripe exclude)
- Modify: `apps/web/package.json` (line containing `@stripe/stripe-js`)
- Modify: `pnpm-lock.yaml` (automated by `pnpm install`)

Phase A flagged `.__PrivateStripeElement-input` (injected by `@stripe/stripe-js` into our DOM, outside the iframe) as `aria-hidden="true"` yet focusable. Path: upgrade first, fall back to a documented `.exclude(...)` only if the upgrade doesn't resolve it.

The runner is parameterised **first** so the intermediate post-upgrade check writes to `axe/tmp/` instead of overwriting the Phase A baseline at `axe/*.json`. This keeps the baseline intact for Task 5's before/after diff and is reused by Task 5 (the closing re-audit writes to `axe/after/`).

- [ ] **Step 1: Parameterise `audit.mjs` output subdir**

Edit `docs/superpowers/audits/2026-05-11-a11y/audit.mjs`. Modify the constants block near the top so it reads:

```js
const BASE = "http://localhost:3000";
const TENANT = "nsbh";
const OUT_DIR = "docs/superpowers/audits/2026-05-11-a11y";
const OUT_SUBDIR = process.env.AUDIT_OUT_SUBDIR ?? "";
const AXE_DIR = join(OUT_DIR, "axe", OUT_SUBDIR);
const STORAGE = join(OUT_DIR, "auth-storage.json");
mkdirSync(AXE_DIR, { recursive: true });
```

`OUT_SUBDIR` defaults to empty (writes to `axe/`, matching Phase A's path). Callers pass `AUDIT_OUT_SUBDIR=tmp` for the intermediate Stripe check (Step 7 below) and `AUDIT_OUT_SUBDIR=after` for Task 5's closing re-run. The existing idempotency wipe at lines 18-20 already scopes to `AXE_DIR`, so it correctly only wipes the active subdir — no further change there.

- [ ] **Step 2: Commit the runner change as its own commit**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/audit.mjs
git commit -m "$(cat <<'EOF'
chore(a11y): parameterise audit.mjs output subdir

Adds AUDIT_OUT_SUBDIR env var (default ""), so intermediate Phase B
runs can write to axe/tmp/ or axe/after/ without clobbering the Phase A
baseline at axe/*.json. Existing idempotency wipe (lines 18-20)
auto-scopes to whichever subdir is active.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Check the current latest of `@stripe/stripe-js`**

Run from worktree root:

```bash
npm view @stripe/stripe-js version
```

Expected: prints a version string, e.g. `9.x.y` or higher. Record the value — call it `$LATEST`.

- [ ] **Step 4: Confirm the package.json line still says `^9.4.0` before editing**

Sanity-check that nobody bumped Stripe between plan and execution:

```bash
grep '"@stripe/stripe-js"' apps/web/package.json
```

Expected: `    "@stripe/stripe-js": "^9.4.0",`. If the version differs, **stop** and reconcile — re-read whether the upgrade is still pending; the rest of this task assumes the current pin is `^9.4.0`.

- [ ] **Step 5: Bump the version**

Edit `apps/web/package.json`. Change the existing line:

```json
"@stripe/stripe-js": "^9.4.0",
```

to:

```json
"@stripe/stripe-js": "^<LATEST>",
```

…substituting the version recorded in Step 3.

- [ ] **Step 6: Install**

Run from worktree root:

```bash
pnpm install
```

Expected: lockfile updates; no errors. `pnpm-lock.yaml` will be modified.

- [ ] **Step 7: Boot dev server (kept running for the rest of Task 3 and all later tasks)**

If not already running, start it in a background terminal:

```bash
pnpm dev:web
```

Expected: ready on `http://localhost:3000`. Wait for the first compile to finish before continuing.

- [ ] **Step 8: Manual checkout smoke test**

Open `http://localhost:3000/nsbh` in a browser. Add an item to cart. Proceed to checkout (sign in via Neon Auth if prompted). Fill the form. Enter test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC, any postcode. Submit.

Expected:
- Card Element mounts and renders without console errors
- Form submits without Stripe errors
- Page redirects to `/nsbh/order/placed?...`

If anything fails (card won't mount, payment errors), **revert** the bump (`git checkout apps/web/package.json pnpm-lock.yaml`, re-run `pnpm install`) and fall through to Step 10's exclude-only path with the original `^9.4.0` retained.

- [ ] **Step 9: Re-run the audit into a throwaway `axe/tmp/` subdir**

This isn't the closing re-audit — it's an intermediate check to confirm whether A2 cleared post-upgrade. The full re-audit lives in Task 5 and writes to `axe/after/`. Verify `auth-storage.json` is fresh first; if `/checkout` audited authenticated in Phase A, re-running from a stale session will throw at `audit.mjs:71`. If unsure, re-run `node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs` to refresh.

Run (with dev server still up):

```bash
AUDIT_OUT_SUBDIR=tmp node docs/superpowers/audits/2026-05-11-a11y/audit.mjs
```

Note: this runs all 6 screens (the runner has no single-screen mode), but writes them into `axe/tmp/` because of the env var — the Phase A baseline at `axe/*.json` is untouched. Output we care about is the `checkout` line specifically:

- If `ser=` count for checkout is `0` and `axe/tmp/checkout.json` has no `aria-hidden-focus` violation: **A2 cleared**. Skip Step 10.
- If `aria-hidden-focus` still appears in `axe/tmp/checkout.json`: **A2 persists** — proceed to Step 10.

To inspect just the checkout result:

```bash
jq '.violations[] | select(.id=="aria-hidden-focus")' docs/superpowers/audits/2026-05-11-a11y/axe/tmp/checkout.json
```

Expected: empty output if A2 cleared, or a violation object if not.

After deciding, delete the throwaway results so they don't get committed:

```bash
rm -rf docs/superpowers/audits/2026-05-11-a11y/axe/tmp
```

- [ ] **Step 10: Conditional — add documented exclude if A2 persists**

Only if Step 9 showed A2 still firing. Edit `docs/superpowers/audits/2026-05-11-a11y/audit.mjs`. Locate the existing `.exclude("iframe[name^='__privateStripeFrame']")` near line 81 and add a sibling `.exclude(...)` line so that block reads:

```js
const results = await new AxeBuilder({ page })
  .withTags(WCAG_TAGS)
  // Stripe Payment Element iframe content is upstream-tested (WCAG 2.1 AA).
  // Excluding keeps `incomplete` honest; prose carve-out remains in findings.md.
  .exclude("iframe[name^='__privateStripeFrame']")
  // Stripe-injected outer wrapper marked aria-hidden=true while focusable.
  // Upstream-owned (does not originate in our code); verified persistent
  // through @stripe/stripe-js upgrade. Excluded with prose rationale.
  .exclude(".__PrivateStripeElement-input")
  .analyze();
```

- [ ] **Step 11: Commit**

If Step 9 cleared without needing the exclude:

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
fix(a11y): A2 — upgrade @stripe/stripe-js, aria-hidden-focus cleared

Bumped @stripe/stripe-js from ^9.4.0 to ^<LATEST>. Smoke-tested checkout
end-to-end with test card 4242…; card mounts, payment confirms, /placed
loads. Single-screen re-audit confirms .__PrivateStripeElement-input no
longer fires aria-hidden-focus. Full re-audit follows in Task 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If Step 10 was taken (exclude path), commit both the bump and the audit-script change together:

```bash
git add apps/web/package.json pnpm-lock.yaml docs/superpowers/audits/2026-05-11-a11y/audit.mjs
git commit -m "$(cat <<'EOF'
fix(a11y): A2 — upgrade @stripe/stripe-js + documented exclude

Bumped @stripe/stripe-js from ^9.4.0 to ^<LATEST>. Smoke-tested checkout
end-to-end; card mounts, payment confirms. Re-audit confirms
.__PrivateStripeElement-input still fires aria-hidden-focus post-upgrade
— Stripe-injected wrapper outside our code. Added .exclude() in
audit.mjs with rationale; upstream issue remains for Stripe to resolve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Keyboard walkthrough — 6 screens

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md`

The Phase A executor skipped the manual keyboard pass. Perform it now over the same 6 screens as `audit.mjs`'s `SCREENS` array: `home`, `catalog`, `item`, `cart`, `checkout`, `placed`. If any check fails task-blockingly, add the finding to `findings.md` as A4+ and add a corresponding fix commit between Task 4 and Task 5.

- [ ] **Step 1: Create the walkthrough document**

Create `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md` with this template (one section per screen, fill in during Step 2):

```markdown
# §3.8 Phase B — Keyboard walkthrough (2026-05-12)

**Spec:** `docs/superpowers/specs/2026-05-11-a11y-audit-phase-b-design.md`
**Findings:** `docs/superpowers/audits/2026-05-11-a11y/findings.md`
**Method:** keyboard-only navigation (Tab, Shift-Tab, Esc, Enter, Space, arrow keys where applicable) at viewport 375 × 667, dev server on :3000, tenant `nsbh`. `/checkout` walked with the authenticated Neon Auth session captured for axe.

For each screen, every box is ticked (pass) or `[FAIL]` (with notes). Silence means a check wasn't performed and is itself a finding.

## /

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes:

## /nsbh

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes:

## /nsbh/item/shirt-ls

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes:

## /nsbh/cart

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes:

## /nsbh/checkout (authenticated)

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected
- [ ] Stripe Card Element is reachable via keyboard and can be filled without mouse

Notes:

## /nsbh/order/placed

- [ ] Tab order matches visual reading order
- [ ] Visible focus ring on every interactive element
- [ ] Esc closes any overlay / drawer / dialog
- [ ] No keyboard trap (Tab eventually leaves the screen)
- [ ] Enter / Space activates buttons and links as expected

Notes:

## Summary

- Task-blocking findings (P1): <count>
- Non-blocking observations: <count>
- Verdict: <pass | issues filed as A4+ in findings.md>
```

The `/checkout` section has an extra check for the Stripe Card Element — Phase A skipped manual; Phase B verifies parents can actually pay with a keyboard.

- [ ] **Step 2: Walk each screen**

With dev server running on :3000 and the sample cart seeded (the audit's `addInitScript` sets `uo:cart:v1` automatically; manually seed via DevTools if walking outside the audit runner, or visit `/nsbh` and add an item once). For each screen:

1. Visit the URL.
2. Press Tab repeatedly from page load. Note each focus stop and whether the ring is visible.
3. Confirm reading order matches visual order.
4. If overlays/drawers exist on the screen (e.g. mobile shell menu), open one and verify Esc closes.
5. Verify Tab eventually leaves the screen (e.g. focus reaches the browser chrome).
6. Try Enter/Space on a button or two and confirm they activate the same as a click.

Tick each box (replace `- [ ]` with `- [x]`) or mark `[FAIL]` with a one-line note about what went wrong and the selector/text involved.

For `/checkout`: also confirm (a) Tab reaches the Stripe Card Element iframe, (b) once focus is inside the iframe, digits can be typed and field-to-field navigation within the Card Element works via Tab (Stripe handles this internally), and (c) Tab eventually exits the iframe and reaches the next surrounding form control.

- [ ] **Step 3: If any failures, add findings and fix commits**

If any check failed task-blockingly:

1. Append a row to `docs/superpowers/audits/2026-05-11-a11y/findings.md`'s P0+P1 table with id `A4`, `A5`, etc. WCAG SC reference, screen, element selector, proposed fix shape.
2. Add a fix commit before Task 5. Pattern: `fix(a11y): A4 — <one-line>`. Match the structure of Task 1-3 commits.

If no failures, skip — the walkthrough doc alone is sufficient.

- [ ] **Step 4: Commit the walkthrough**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md
git commit -m "$(cat <<'EOF'
chore(a11y): keyboard walkthrough — 6 parent-flow screens

Phase A skipped the manual keyboard pass; performed here over the same
6 SCREENS audit.mjs covers (home, catalog, item, cart, checkout, placed).
Each screen recorded against the 5-check template from the §3.8 spec.
Checkout includes an extra Stripe Card Element keyboard-fillability
check. <Verdict: clean | N supplemental findings filed as A4+>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Re-audit + close-out

**Files:**
- Create: `docs/superpowers/audits/2026-05-11-a11y/axe/after/*.json` (6 files via runner)
- Modify: `docs/superpowers/audits/2026-05-11-a11y/findings.md` (append "Fixes shipped (Phase B)" section)
- Modify: `docs/remaining_work.md` (flip §3.8 to ✅, correct burgundy-red-herring text)
- Modify: `docs/completed.md` (add §3.8 write-up)

The runner was parameterised in Task 3 Step 1, so the Phase A baseline at `axe/*.json` is intact. This task runs the audit into `axe/after/` and migrates §3.8 from `remaining_work.md` to `completed.md`.

- [ ] **Step 1: Verify auth-storage validity**

Confirm the Neon Auth session in `auth-storage.json` is still good. From worktree root:

```bash
ls -la docs/superpowers/audits/2026-05-11-a11y/auth-storage.json
```

If the file is missing OR the auth session has expired (Neon Auth dev sessions are long-lived but not eternal), re-run the setup:

```bash
node docs/superpowers/audits/2026-05-11-a11y/setup-auth.mjs
```

Follow its interactive sign-in prompt. Script saves a fresh `auth-storage.json` on success.

- [ ] **Step 2: Run the re-audit into `axe/after/`**

With dev server still running on :3000:

```bash
AUDIT_OUT_SUBDIR=after node docs/superpowers/audits/2026-05-11-a11y/audit.mjs
```

Expected output (the numbers below are illustrative; the gate is `crit=0 ser=0` on every screen):

```
→ home
  ✓ home       crit=0 ser=0 mod=0 min=0 incomplete=2
→ catalog
  ✓ catalog    crit=0 ser=0 mod=0 min=0 incomplete=2
→ item
  ✓ item       crit=0 ser=0 mod=0 min=0 incomplete=1
→ cart
  ✓ cart       crit=0 ser=0 mod=0 min=0 incomplete=1
→ checkout (auth)
  ✓ checkout   crit=0 ser=0 mod=0 min=0 incomplete=1
→ placed
  ✓ placed     crit=0 ser=0 mod=0 min=0 incomplete=0

✓ All 6 axe runs complete. JSON written to docs/superpowers/audits/2026-05-11-a11y/axe/after
```

`incomplete` counts may match or differ from Phase A — they're observation-grade and don't gate. **Gate: every screen reports `crit=0 ser=0`.** If any screen reports a non-zero crit/ser count, the corresponding violation must be investigated and fixed (add A4+ commit) before continuing.

- [ ] **Step 3: Append "Fixes shipped (Phase B)" to `findings.md`**

Edit `docs/superpowers/audits/2026-05-11-a11y/findings.md`. After the last existing section (Methodology notes), append:

```markdown
## Fixes shipped (Phase B)

**Re-audit:** `docs/superpowers/audits/2026-05-11-a11y/axe/after/` (6 JSON files, 2026-05-12)
**Walkthrough:** `docs/superpowers/audits/2026-05-11-a11y/keyboard-walkthrough.md`

| # | Phase A | Phase B verdict | Fix landed |
|---|---|---|---|
| A1 | P0 — `<select>` Year missing label | **Cleared** — `FieldLabel` now `<label htmlFor>`, all 6 checkout fields wired with stable ids | commit `<A1-sha>` |
| A2 | P1 — Stripe `.__PrivateStripeElement-input` aria-hidden-focus | **<Cleared via @stripe/stripe-js upgrade | Excluded with documented rationale post-upgrade>** | commit `<A2-sha>` |
| A3 | P1 — gold `#B08A3E` eyebrow 2.97:1 on parchment | **Cleared** — introduced `--color-gold-text: #8C6A28` (4.74:1), swapped 3 parent-flow eyebrows | commit `<A3-sha>` |

### Per-screen before/after axe counts

| Screen | A: crit/ser | B: crit/ser |
|---|---|---|
| home | 0/1 | 0/0 |
| catalog | 0/0 | 0/0 |
| item | 0/0 | 0/0 |
| cart | 0/0 | 0/0 |
| checkout | 1/1 | 0/0 |
| placed | 0/0 | 0/0 |

(Fill in the B column from `axe/after/*.json` `counts.critical` / `counts.serious`.)

### Keyboard walkthrough

Six screens walked, every check ticked or filed. <Summary: clean, or N supplemental P1s filed as A4+ and fixed in commits <shas>.>

### Gate

P0 + P1 = 0 across all 6 screens post-fix. §3.8 closes.
```

Replace placeholder shas with the actual commit hashes (use `git log --oneline -10` to find them). Pick the appropriate A2 wording based on whether the upgrade alone cleared it or the documented `.exclude()` was added.

- [ ] **Step 4: Update `remaining_work.md`**

First locate the §3.8 entry — the executor needs the exact current line to write an unambiguous edit:

```bash
grep -n "§3.8\|3\.8 " docs/remaining_work.md
```

Expected: one or two matching lines. Read the surrounding context (e.g. `sed -n '<line>,$p' docs/remaining_work.md | head -20` or just open the file). Then:

1. Flip its status marker to ✅ (matching the convention §3.9 used after its Phase B).
2. Correct the burgundy-contrast prose. The original entry framed contrast risk as the burgundy `#7A1F2B` accent. Phase A debunked that (verified 9.46–10.20:1 across backgrounds). Replace the burgundy reference with text explicitly noting it as a debunked hint and pointing to gold as the real risk now resolved. Example replacement:

```markdown
§3.8 accessibility audit — ✅ shipped. Parent flow audited against WCAG 2.1 A+AA (PR #23, Phase A) and fixed (PR <Phase-B-PR>, Phase B). 1 P0 + 2 P1 axe findings resolved; 6-screen keyboard walkthrough clean. Original spec called out burgundy `#7A1F2B` as the likely contrast risk — Phase A debunked this (9.46–10.20:1 across backgrounds); real risk was gold `#B08A3E` at small bold sizes, fixed via the `--color-gold-text` token.
```

3. Remove §3.8 from any outstanding-Quality list it appeared in.

- [ ] **Step 5: Update `completed.md`**

Edit `docs/completed.md`. Add a §3.8 entry following the pattern §3.9 used. Reference both PRs (#23 for Phase A, the about-to-open Phase B PR), the audit dir, and the fix shape (3 axe findings + keyboard walkthrough).

- [ ] **Step 6: Type-check + scoped sanity grep**

Type-check:

```bash
pnpm check-types:web
```

Expected: clean.

Scoped grep — confirm no parent-flow small-bold-gold eyebrow still references the old `--color-gold` token. Restricting the search to the three files we modified in Task 2 is more durable than an exclude allowlist. Use `grep -F` (fixed strings) so the `[11px]` literal doesn't get interpreted as a bracket expression:

```bash
grep -nF "var(--color-gold)" \
  apps/web/src/app/home-client.tsx \
  apps/web/src/app/orders/[orderId]/order-detail-client.tsx
```

Expected: **no output** (exit code 1). Any match means a missed swap in Task 2 — investigate.

Optional broader check for any future small-bold-gold eyebrow that crept in elsewhere along the parent flow (informational only):

```bash
grep -RnF "var(--color-gold)" apps/web/src/app/[tenant] apps/web/src/app/page.tsx apps/web/src/app/orders 2>/dev/null
```

Expected: no matches in any small-bold-text context. The admin `pick-slip.tsx:164` deferral is out of scope under §3.8 and lives outside these paths.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/audits/2026-05-11-a11y/axe/after/ \
        docs/superpowers/audits/2026-05-11-a11y/findings.md \
        docs/remaining_work.md \
        docs/completed.md
git commit -m "$(cat <<'EOF'
chore(a11y): §3.8 re-audit — P0+P1 = 0; close

Re-ran audit.mjs into axe/after/ (Phase A baseline at axe/*.json
preserved via AUDIT_OUT_SUBDIR parameterisation from earlier commit).
Every screen crit=0 ser=0. Appended Fixes-shipped section to
findings.md with per-screen before/after table and commit references.
remaining_work.md §3.8 flipped to ✅, burgundy-red-herring text
corrected (real risk was gold, fixed via A3). completed.md gains the
§3.8 entry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: PAUSE — confirm with user before pushing and opening PR**

`git push` and `gh pr create` are shared-state actions visible to others, not local-only. Stop here and ask the user before running either. Show the user:

- Output of `git log --oneline origin/main..HEAD` (the 6 commits Phase B introduces)
- Output of `git status` (should be clean)
- The proposed PR title and summary (below)

Only after the user explicitly confirms, run:

```bash
git push -u origin worktree-async-doodling-unicorn
gh pr create --title "feat(a11y): §3.8 fixes — WCAG 2.1 A+AA pass + keyboard walkthrough" --body "$(cat <<'EOF'
## Summary

- A1 (P0): `FieldLabel` is now a semantic `<label htmlFor>`; all 6 checkout fields wired with stable ids — `<select>` Year passes axe `select-name`, sibling inputs silently upgrade
- A2 (P1): `@stripe/stripe-js` bumped from ^9.4.0 to <LATEST>; `aria-hidden-focus` <cleared by upgrade | excluded with documented rationale post-upgrade>
- A3 (P1): introduced `--color-gold-text: #8C6A28` (4.74:1 vs parchment); three parent-flow eyebrows switched (home x2 + parent order detail)
- Manual keyboard walkthrough performed over all 6 SCREENS — <clean | N supplemental fixes as A4+>
- Re-audit P0+P1=0 across all 6 screens, JSON in `axe/after/`
- §3.8 closes in `remaining_work.md` (burgundy-red-herring text corrected); written up in `completed.md`

Closes §3.8.

## Test plan

- [x] `pnpm check-types:web` clean
- [x] Contrast math: `#8C6A28` on `#FAF6EE` ≥ 4.5:1 (computed 4.74:1)
- [x] Manual checkout smoke test with `4242…` test card, lands on `/order/placed`
- [x] 6-screen keyboard walkthrough recorded
- [x] Re-audit: every screen crit=0 ser=0 in `axe/after/*.json`
EOF
)"
```

---

## Self-review notes

**Spec coverage:**
- A1 fix → Task 1 ✓
- A3 fix (`--color-gold-text` + 3 swaps) → Task 2 ✓
- Runner parameterisation (`AUDIT_OUT_SUBDIR`) → Task 3 Steps 1–2 (own commit, lands before any re-run) ✓
- A2 upgrade + conditional exclude → Task 3 Steps 3–11 ✓
- Keyboard walkthrough (6 screens, same as `audit.mjs` SCREENS) → Task 4 ✓
- Auth-storage prerequisite → Task 5 Step 1 ✓
- Re-audit into `axe/after/`, P0+P1=0 gate → Task 5 Step 2 ✓
- Contrast-math correctness gate → Task 2 Step 2 ✓
- `findings.md` "Fixes shipped (Phase B)" section → Task 5 Step 3 ✓
- `remaining_work.md` flip + burgundy correction → Task 5 Step 4 (with locator grep) ✓
- `completed.md` write-up → Task 5 Step 5 ✓
- Push + PR gated behind user confirmation → Task 5 Step 8 ✓

**Type consistency:** `FieldLabel` signature change is consistent across Steps 1 + 2 of Task 1 (`htmlFor: string`, used on every call site). Token name `--color-gold-text` consistent across Task 2 Steps 1, 3, 4 + Task 5 Step 6 grep. `AUDIT_OUT_SUBDIR` env var consistent across Task 3 Step 1 (definition), Task 3 Step 9 (`=tmp`), and Task 5 Step 2 (`=after`).

**Risks acknowledged in plan:** Stripe upgrade regression (Task 3 Step 8 revert path), contrast-math miscalculation (Task 2 Step 2 darken-and-retry loop), stale auth (Task 5 Step 1 setup-auth re-run), version drift between plan and execution (Task 3 Step 4 sanity grep), accidental shared-state action (Task 5 Step 8 pause-for-confirmation).
