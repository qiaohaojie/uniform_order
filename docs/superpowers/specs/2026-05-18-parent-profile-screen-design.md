# Parent Profile screen — design spec

**Date:** 2026-05-18
**Status:** approved, ready for implementation planning
**Scope:** v1 (minimal). Editing display name, account deletion, notification prefs, and avatar upload are explicitly deferred.

## Problem

`BottomNav` (`apps/web/src/components/bottom-nav.tsx:21`) renders a Profile tab on every parent-shop screen, but its href is `"#"` — tapping does nothing. Parents see a dead nav item.

`/auth/account` is also referenced from `/privacy` as a link to "your account settings", and that route doesn't exist either.

There is no parent-facing surface to view their own identity, see what data the app has about them, reach the school, find legal links in one place, or sign out without going to the admin shell (which they shouldn't have access to anyway).

## Goals

1. Make the BottomNav Profile tab lead somewhere useful.
2. Provide a single screen where a signed-in parent can: see who they're signed in as, reach their schools, find legal/help links, and sign out.
3. Be fully mobile-supported — wrap in `MobileShell`, all tap targets ≥44px, no horizontal overflow at 320px.
4. Zero new schema, zero new API routes — reuse Better Auth's `signOut` and the existing `parentChildren` query layer.

## Non-goals (v1)

- Edit display name, email, or avatar upload.
- Delete account / GDPR data export.
- Notification preferences (requires new schema + actual notification routing).
- Address book, phone numbers, secondary emails.
- Linked-schools management beyond what the home page already does for children.
- A profile screen for logged-out users (they get redirected to sign-in).

## URL and auth

- **Path:** `/profile` (root-level, not tenant-scoped). The semantic matches the BottomNav label.
- **Auth gate:** RSC checks `getSessionUser()`; if `null`, `redirect("/auth/sign-in?callbackURL=%2Fprofile")`. Same pattern as `/orders/page.tsx` and `/[tenant]/order/placed/page.tsx`.
- **BottomNav update:** `bottom-nav.tsx:21` — `href: "#"` → `href: "/profile"`.

## Layout — card stack (Layout A from brainstorm)

Matches the existing parent shop card pattern (`rounded-[14px] border border-rule`, paper bg, soft shadow). Consistent with home-page tenant cards (`home-client.tsx:115`), orders list, and order detail.

Vertical order, all wrapped in `MobileShell`:

1. **Header bar** — `Profile` title, no back button (it's a tab, not a stacked route).
2. **Identity card** — avatar + name + email.
3. **Children quick-view card** — `My children · N saved ›`. One row. Taps to `/`.
4. **Help & contact card** — one row per *unique tenant* the parent has children at: `Email <tenant.short> ›` → `mailto:<tenant.shopEmail>`. Hidden entirely if parent has no saved children.
5. **Legal card** — per-tenant `Refund policy · <tenant.short> ›` rows (one per unique tenant), then global `Privacy ›` (`/privacy`) and `Terms of service ›` (`/terms`). The per-tenant refund rows are omitted if parent has no children.
6. **Sign-out button** — full-width, red text on paper bg, `Sign out`.
7. **Version line** — small, centered, dim: `UniformOrder · v<pkg.version> · <buildDate>`.

## Data flow

```
RSC (page.tsx)
  ├─ getSessionUser()                                  → user | redirect
  ├─ getParentChildren(user.id)                        → ParentChildRow[]
  └─ getTenantsByIds(unique(children.map(c=>c.tenantId))) → TenantBrandRow[] (id, name, short, accent, shopEmail)
       └─ pass { user, children, tenants } to ProfileClient
```

Both `getParentChildren` and a per-tenant lookup are already used by `home-client.tsx`. If the second query doesn't exist as a single function, add `getTenantsByIds(ids: string[])` to `db/queries.ts` returning `Pick<TenantRow, "id"|"name"|"short"|"accent"|"shopEmail">[]`.

## Client component responsibilities

`ProfileClient` (`"use client"`):

- Renders the `MobileShell` chrome with `BottomNav active="profile"`.
- Renders all cards listed above using props from the RSC.
- Handles sign-out via `authClient.signOut()` from `@/lib/auth/client`, mirroring `admin-shell.tsx:53-66`:
  - Disable button + flip label to `Signing out…` while pending.
  - On success: `router.push("/")`.
  - On error: inline red error banner, button re-enabled.
- Renders avatar as `<img>` if `user.image` is set, otherwise initials derived from `user.name` (two-letter fallback, uppercase, on `--color-navy-deep` background).

## Empty / edge states

| State | Behaviour |
|---|---|
| Signed-out user hits `/profile` | Redirect to `/auth/sign-in?callbackURL=%2Fprofile`. No flash of the profile UI. |
| Signed-in but `user.name === null` | Avatar shows initials from email local-part (first letter). Name row shows email-as-name fallback. |
| Signed-in, 0 children | Children row shows `0 saved`. Help card hidden. Per-tenant refund-policy rows hidden. Global Privacy/Terms still shown. |
| Signed-in, children at 1 tenant | Single email row + single refund-policy row. |
| Signed-in, children at multiple tenants | One email row per unique tenant; one refund-policy row per unique tenant; rendered alphabetically by tenant.short for stability. |
| `tenant.shopEmail === null` | That tenant's Email row is omitted. |
| Sign-out failure | Inline red banner inside the sign-out card, copy: `Couldn't sign out. Try again.` Button re-enabled. |

## App version exposure

Add at build time:

- `next.config.ts`: read `package.json` version + a build-date stamp, expose as `process.env.NEXT_PUBLIC_APP_VERSION` and `process.env.NEXT_PUBLIC_APP_BUILD_DATE`.
- Format displayed: `UniformOrder · v0.4.0 · 2026-05-18`.

If exposing these env vars is undesirable, an acceptable v1 fallback is to inline a literal version string in `ProfileClient` and bump it manually each release. Decide during implementation planning.

## Mobile guarantees

- Wrapped in `MobileShell` (max-w-430 frame, parchment bg, BottomNav included).
- Tap targets: rows use `py-3` → ~48px total height; sign-out button full-width with `py-3.5` → ~50px.
- Avatar 52px square.
- Body text `text-[13–14px]`; name `text-[17px]` Newsreader serif; section labels none (cards are self-grouping).
- No horizontal overflow at 320px (smallest practical mobile width); long names truncate with `truncate min-w-0`.
- Chevrons rendered with `var(--color-rule)`-tinted `›` character or `ChevronRightIcon` from `@/components/icons` (matches existing parent rows).

## File inventory

**New files:**

- `apps/web/src/app/profile/page.tsx` — RSC, ~60 lines.
- `apps/web/src/app/profile/profile-client.tsx` — client component, ~200 lines.

**Modified files:**

- `apps/web/src/components/bottom-nav.tsx` — line 21: change `href`.
- `apps/web/src/db/queries.ts` — possibly add `getTenantsByIds(ids)`; check if an equivalent helper already exists before adding.
- `apps/web/next.config.ts` — expose `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_APP_BUILD_DATE` env vars (if going with the dynamic-version approach).

**No changes:**

- DB schema.
- API routes (`signOut` already wired via `lib/auth/client`).
- Auth gates outside the new page.
- Any other parent shop screen.

## Testing

- **Correctness gate:** `pnpm check-types:web` and `pnpm check-types` must pass.
- **Manual verification:**
  1. Sign in as a demo parent at `http://localhost:3000/auth/sign-in`.
  2. Tap Profile in BottomNav at any tenant; confirm landing on `/profile`.
  3. Open Chrome DevTools mobile emulation at 390×844 (iPhone 13) and 320×568 (smallest practical); verify no horizontal scroll and all rows tappable.
  4. Sign out; confirm landing on `/`.
  5. Sign out failure path: temporarily blackhole `/api/auth/sign-out` (e.g. devtools network throttle → offline) and confirm inline banner appears.
- **Out of scope:** automated Playwright coverage. Optional Act 7 in the demo recording spec is a future task, not part of v1.

## Open questions for implementation planning

These are not design decisions — they're tactical choices for the implementation plan.

1. Does `getTenantsByIds` already exist? If yes, reuse; if no, the plan adds it.
2. Will `next.config.ts` env-var injection collide with any existing build config? If yes, fall back to the literal-version approach.
3. Should we add an Act 7 to the demo recording spec covering this screen? Recommend yes-but-later (post-merge), not part of v1.

## Decisions log

- **Card stack over sectioned list** — matches existing parent shop visual language.
- **Per-tenant Help and Refund rows over a single generic link** — accurate to multi-school families, scales to 1 tenant naturally.
- **Sign-out redirects to `/`** — matches admin sign-out behaviour; parents land on the home/school-picker after.
- **No editing, no deletion in v1** — defer until a parent actually asks for it; account deletion in particular has non-trivial cascade behaviour (orders, refunds, audit log) that deserves its own design pass.
- **No new schema** — everything Profile needs already exists in `neon_auth.user` and `parent_children`.
