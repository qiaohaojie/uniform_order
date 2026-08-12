# demo/ — lessons learned

A postmortem of the issues hit during the 2026-05-17 recording session, so the next person (or Claude session) doesn't have to rediscover them.

The structural overview lives in `IMPLEMENTATION_NOTES.md`. This file is the operational debrief: **what went wrong, why, and what to do differently next time.**

---

## 0. Video resolution defaults (the recurring one)

**Issue:** `video: "on"` in `demo-recording.config.ts` records at ~800×450 by default. Playwright scales the video down to fit an 800×800 box for performance, **regardless of viewport size**. So a 1920×1080 desktop viewport still produced a small, low-resolution video. This has bitten this project **twice**.

**Fix:** Always set `video.size` explicitly per project:

```ts
use: {
  video: { mode: "on", size: { width: 1920, height: 1080 } },
},
projects: [
  {
    name: "desktop",
    use: {
      viewport: { width: 1920, height: 1080 },
      video: { mode: "on", size: { width: 1920, height: 1080 } },
    },
  },
  {
    name: "mobile",
    use: {
      ...devices["iPhone 13"],
      video: { mode: "on", size: devices["iPhone 13"].viewport },
    },
  },
]
```

**Rule going forward:** if a Playwright config has `video: "on"` and no `size`, treat it as a bug. Don't trust the default.

---

## 1. Seed FK violations only surface on real DB

**Issue:** `seed-demo.ts` hardcoded `enteredByUserId: "00000000-0000-0000-0000-000000000000"` for `tenant_legal_versions`. The Drizzle schema marks this column `notNull()` but doesn't define the FK (`// FK enforced via SQL only — see note above`). The FK to `neon_auth."user"(id)` is added by a migration ALTER, so a fixture with a fake UUID:

- passes locally when the FK isn't applied
- passes against a Postgres without that migration
- **fails** against the real Neon dev DB the first time anyone runs it

**Fix applied:** seed now does `SELECT id FROM neon_auth."user" LIMIT 1` and uses whichever real user exists.

**Rule going forward:** when a seed touches a column commented `FK enforced via SQL only`, never hardcode UUIDs — look one up from the referenced table at seed time.

---

## 2. Better Auth + WebKit + localhost = silent cookie drop

**Issue:** Better Auth issues `__Secure-neon-auth.session_token` with `secure: true`. Chromium treats `http://localhost` as a secure context and sends the cookie. **WebKit does not** — it strictly enforces `Secure` regardless of host. Playwright's `devices["iPhone 13"]` uses WebKit by default, so every mobile test that needed auth bounced silently back to `/auth/sign-in`. The diagnostic was non-obvious: `apiSignIn` succeeded (cookie was on the context) but the cookie was never *sent* on the next navigation.

**Fix applied:** `mobile` project pinned to `browserName: "chromium"` while keeping the iPhone 13 viewport / UA / touch emulation.

**Rule going forward:** any Playwright mobile project that hits an auth-protected route over `http://localhost` should use Chromium, not WebKit. If you must use WebKit, run the dev server over HTTPS (e.g. `next dev --experimental-https`).

---

## 3. UI-form sign-in is unreliable; use the API

**Issue:** The `@neondatabase/auth-ui` sign-in form has selector quirks (no `<label>` elements, submit button reads "Login" not "Sign in") *and* mobile-engine click-to-submit issues. Even after fixing the selectors and pressing Enter instead of clicking, sign-in still didn't always commit the cookie before the next navigation.

**Fix applied:** introduced `apiSignIn(page, email, password)` that POSTs to `/api/auth/sign-in/email` via `page.context().request`. The response's `Set-Cookie` is captured by the BrowserContext, so subsequent navigations carry the session. UI sign-in (`uiSignIn`) is kept solely for Act 1 where the form must appear on camera.

**Rule going forward:** for any Playwright test that needs an authenticated session but isn't *recording* the sign-in flow, use API auth. Treat UI sign-in as a thing you film, not a thing you test through.

---

## 4. neon-http returns timestamps as strings

**Issue:** `listTenantsWithStats()` in `apps/web/src/lib/platform/queries.ts` used `db.execute(sql\`SELECT ... t.created_at ...\`)`. The type was annotated `createdAt: Date | null` but at runtime it was a string. `r.createdAt.toLocaleDateString(...)` in the component threw a 500. `/platform/tenants` had presumably never been visited with real data after the migration.

**Fix applied:** wrapped the cast at the query layer: `createdAt: r.created_at ? new Date(r.created_at as string | Date) : null`. Fixing it in the component would have hidden the bug from other callers.

**Rule going forward:** when `db.execute(sql\`...\`)` returns a column that's typed as `Date`, wrap it in `new Date(...)` at the query layer. neon-http does not auto-coerce.

---

## 5. Two configs, two ways the demo can get blocked

**Issue:** Two environment variables that don't have obvious symptoms when wrong:

- `PLATFORM_ADMIN_EMAILS` (in `apps/web/.env.local`) must contain `platformadmin@demo.uniformorder.online` for Act 1 to access `/platform/*`. Missing → silent 404.
- `DATABASE_URL` (in `demo/demo_data/.env.demo`) must point at localhost or a Neon host; other remotes need `--allow-remote`. The safety guard is good but the error wording (`SAFETY GUARD TRIPPED`) is easy to misread as a different kind of failure.

**Rule going forward:** when this project is set up on a new machine, the prereq checklist is:

1. `demo/demo_data/.env.demo` exists with `DATABASE_URL` set.
2. `PLATFORM_ADMIN_EMAILS` in `apps/web/.env.local` includes every email that will sign in as a platform admin (`support@pimspace.com,platformadmin@demo.uniformorder.online` minimum).
3. The three Neon Auth users (`operator@`, `parent@`, `platformadmin@demo.uniformorder.online`) exist in `neon_auth."user"`. Verify with `SELECT id, email FROM neon_auth."user"`.
4. Tenants have `shop_email = 'operator@demo.uniformorder.online'`. The fixture already sets this, but verify after seed.

---

## 6. Demo state mutates; tests must be idempotent across projects

**Issue:** Act 4 transitions an order from `to_prepare` → `ready`. Both the desktop and mobile project run Act 4 sequentially. Desktop ran first, transitioned RVRA-00003, and mobile then had no `to_prepare` button to find.

**Fix applied:** per-project order ID — desktop transitions RVRA-00003, mobile transitions RVRA-00004 (`testInfo.project.name === "mobile" ? "RVRA-00004" : "RVRA-00003"`).

**Rule going forward:** any test that mutates demo data needs to either (a) reset the row in `afterEach`, (b) use a different row per project, or (c) be wrapped in a globalSetup that re-seeds. Option (b) is cheapest when the fixture has spare rows in the right state.

---

## 7. UI selectors discovered during this session

Reference table — if the UI changes, these are the spots that break recordings:

| Surface | What the spec assumes | Where it lives |
|---|---|---|
| Sign-in form | `input[type=email]` + `input[type=password]` + button name `/login/i` | `@neondatabase/auth-ui` AuthView |
| Parent landing splash | `uo:visited:<tenantId>` cookie suppresses it for 30 days | `apps/web/src/lib/landing-visit.client.ts` |
| Catalog tab | `?cat=Summer` query param filters by category | `apps/web/src/app/[tenant]/page.tsx` |
| PDP variant + size picker | two-step: variant button (e.g. `Size 6–14`) then size button (`10`) | `apps/web/src/app/[tenant]/item/[itemId]/` |
| Operator order detail | `Mark ready` button only renders when `fulfilment_status = 'to_prepare'` AND `workflow_mode = 'standard'` | `apps/web/src/app/admin/[tenant]/orders/[orderId]/order-detail-actions.tsx` |
| Admin topbar buttons | Inside `overflow-hidden` flex row → Playwright sometimes reports "outside viewport"; use `el.evaluate(e => e.click())` | `apps/web/src/components/admin-shell.tsx` |
| Platform tenants table | Each row has an "Open →" link, not a tenant-name link | `apps/web/src/app/platform/tenants/tenants-table.tsx` |
| Order links | Render twice on desktop (sidebar + list) — always use `.first()` | `apps/web/src/app/admin/[tenant]/orders/` |
| Mobile admin UI | Admin shell is desktop-first by design; admin acts on mobile render the desktop UI cramped | `CLAUDE.md` notes this explicitly |

---

## Net process improvement

For the *next* demo recording session, the right order is:

1. **Prereqs first:** verify (a) DB seed users exist via `SELECT FROM neon_auth.user`, (b) PLATFORM_ADMIN_EMAILS includes the demo admin, (c) `.env.demo` has a localhost or `--allow-remote`-acceptable `DATABASE_URL`.
2. **Seed in dry-run, then for real.** Confirm tenants/orders/users via SQL after.
3. **Reset mutable rows** before each run: `UPDATE orders SET fulfilment_status='to_prepare' WHERE id IN ('RVRA-00003','RVRA-00004');`.
4. **Verify the config sets `video.size`** — never trust `video: "on"` alone.
5. **Run desktop project first** to validate selectors and resolution on the simpler engine, *then* run mobile.
6. **Verify a sample `.webm` dimensions** (`ffprobe`) match what was requested before declaring done.
