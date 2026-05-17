# Parent Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `/profile` BottomNav link with a fully mobile-supported parent screen showing identity, children, per-tenant help/refund rows, global legal links, and sign-out — no new schema, no new API routes.

**Architecture:** New route `app/profile/` with an RSC (`page.tsx`) that gates auth, fetches `getChildrenForParent(user.id)` + `getTenantsByIds(uniqueTenantIds)`, and passes data to a `"use client"` companion (`profile-client.tsx`) that renders inside `MobileShell` with `BottomNav active="profile"`. Sign-out reuses `authClient.signOut()` from `@/lib/auth/client`.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19, Tailwind CSS v4, Better Auth (`@neondatabase/auth/next`), Drizzle ORM (neon-http).

**Correctness gate:** `pnpm check-types:web` (no test suite per CLAUDE.md). Each task verifies via check-types + manual mobile viewport check.

**Spec:** `docs/superpowers/specs/2026-05-18-parent-profile-screen-design.md`

---

## File inventory

- **Create:** `apps/web/src/app/profile/page.tsx` (RSC, ~60 lines)
- **Create:** `apps/web/src/app/profile/profile-client.tsx` (client component, ~200 lines)
- **Modify:** `apps/web/src/components/bottom-nav.tsx:21` (single href change)
- **No new schema, no new API routes, no new queries.** Verified `getChildrenForParent` (queries.ts:758) and `getTenantsByIds` (queries.ts:863) already exist.

---

### Task 1: Scaffold `/profile` route + auth gate + render stub

**Files:**
- Create: `apps/web/src/app/profile/page.tsx`
- Create: `apps/web/src/app/profile/profile-client.tsx`

Establishes the route, auth gate, and minimal MobileShell render. No data yet — just enough to navigate to `/profile` and see a working stub. Build everything else incrementally on top.

- [ ] **Step 1: Create `apps/web/src/app/profile/profile-client.tsx`**

```tsx
"use client";

import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";

export function ProfileClient() {
  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          Profile
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Sections added in later tasks */}
      </div>

      <BottomNav active="profile" />
    </MobileShell>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/app/profile/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/authorization";
import { ProfileClient } from "./profile-client";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?callbackURL=%2Fprofile");
  }
  return <ProfileClient />;
}
```

- [ ] **Step 3: Run check-types from repo root**

Run: `pnpm check-types:web`
Expected: PASS (no errors).

- [ ] **Step 4: Manual verification**

Start dev server if not running: `pnpm --filter web dev`

In browser, while signed out, visit `http://localhost:3000/profile`. Expected: redirect to `/auth/sign-in?callbackURL=%2Fprofile`.

Sign in as `parent@demo.uniformorder.online` / `DemoPass123!` (created in earlier session). Expected: land on `/profile` showing the empty MobileShell with "Profile" header and BottomNav with the Profile tab highlighted.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): scaffold /profile route with auth gate

Mobile-shell wrapped placeholder. Redirects signed-out users to
/auth/sign-in with callbackURL=/profile. Sections to come in
subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Identity card

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

Renders the avatar (image if `user.image` present, otherwise initials from name, fallback to email's first letter), name, and email in a card. Card uses the existing parent-shop card pattern (`rounded-[14px]` + `border-rule` + soft shadow), matching `home-client.tsx:115`.

- [ ] **Step 1: Compute initials helper at top of `profile-client.tsx`** (just under the imports, before the component)

```tsx
function getInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email;
  // If we used the email, take just the first letter of the local part.
  if (!displayName.trim()) {
    return (email[0] ?? "U").toUpperCase();
  }
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}
```

- [ ] **Step 2: Add `ProfileClientProps` type and update the component signature**

Replace the existing component declaration with:

```tsx
export type ProfileClientProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

export function ProfileClient({ user }: ProfileClientProps) {
  const displayName = user.name?.trim() || user.email;
  const initials = getInitials(user.name ?? "", user.email);
  // ...
}
```

- [ ] **Step 3: Render the identity card inside the scrollable body**

Replace the placeholder comment in the scroll container with:

```tsx
<div
  className="rounded-[14px] border bg-white p-4 mb-3 flex items-center gap-3"
  style={{
    borderColor: "var(--color-rule)",
    boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
  }}
>
  {user.image ? (
    <img
      alt=""
      src={user.image}
      className="w-[52px] h-[52px] rounded-full object-cover flex-shrink-0"
    />
  ) : (
    <div
      className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white font-serif text-[20px] font-medium flex-shrink-0"
      style={{ background: "var(--color-navy-deep)" }}
    >
      {initials}
    </div>
  )}
  <div className="flex-1 min-w-0">
    <div
      className="font-serif text-[17px] font-semibold leading-[1.15] truncate"
      style={{ color: "var(--color-ink)" }}
    >
      {displayName}
    </div>
    <div
      className="text-[12px] mt-0.5 truncate"
      style={{ color: "var(--color-ink-dim)" }}
    >
      {user.email}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Pass user props from `page.tsx`**

Replace the `<ProfileClient />` line with:

```tsx
return (
  <ProfileClient
    user={{
      name: user.name,
      email: user.email,
      image: null, // SessionUser doesn't expose image today; null fallback to initials
    }}
  />
);
```

Note: `getSessionUser()` returns `{ id, email, name }` — no `image`. Pass `null` so the initials path is exercised. A later iteration can extend `getSessionUser()` to surface `image` from Better Auth's user record.

- [ ] **Step 5: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Reload `/profile`. Expected: identity card shows "Demo Parent" (initials "DP" on navy background) and `parent@demo.uniformorder.online`. Truncation works for long emails.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): identity card with avatar + name + email

Avatar shows user.image if present, falls back to initials on navy.
SessionUser doesn't surface image today, so always renders initials
for now — image path is wired but inert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Children quick-view card

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

One-row card showing `My children · N saved ›`. Taps to `/` (home). Always rendered — `N` can be 0.

- [ ] **Step 1: Extend `ProfileClientProps`**

```tsx
export type ProfileClientProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  childrenCount: number;
};
```

Update destructure: `export function ProfileClient({ user, childrenCount }: ProfileClientProps) {`

- [ ] **Step 2: Add a `<Link>` import at the top**

```tsx
import Link from "next/link";
```

- [ ] **Step 3: Render the children card immediately below the identity card**

Add this JSX after the identity card:

```tsx
<Link
  href="/"
  className="block rounded-[14px] border bg-white p-4 mb-3"
  style={{
    borderColor: "var(--color-rule)",
    boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
  }}
>
  <div className="flex items-center justify-between">
    <span className="text-[13.5px] font-medium" style={{ color: "var(--color-ink)" }}>
      My children
    </span>
    <span className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--color-ink-dim)" }}>
      {childrenCount === 0 ? "0 saved" : `${childrenCount} saved`}
      <span style={{ color: "var(--color-rule)" }}>›</span>
    </span>
  </div>
</Link>
```

- [ ] **Step 4: Fetch children in `page.tsx`**

Update imports:

```tsx
import { getChildrenForParent } from "@/db/queries";
```

Update body after the auth gate, before `return`:

```tsx
const children = await getChildrenForParent(user.id);

return (
  <ProfileClient
    user={{
      name: user.name,
      email: user.email,
      image: null,
    }}
    childrenCount={children.length}
  />
);
```

- [ ] **Step 5: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Reload `/profile`. Expected: a second card below the identity card reading "My children · 0 saved ›" (or whatever the demo parent has). Tap it → navigate to `/`. Tap BottomNav Profile → return to `/profile`.

If demo parent has zero children, optionally seed one via `/?action=add-child` in the browser, then return to `/profile` and confirm the count updates to 1.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): children quick-view card linking to home

One-row card showing saved children count. Reuses existing
getChildrenForParent query; renders 0 saved naturally when the
parent has no children yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Help & contact card (per-tenant)

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

For each unique tenant the parent has children at, render an `Email <tenant.short> ›` row that opens `mailto:<tenant.shopEmail>`. Hide the whole card if the parent has no children OR none of the relevant tenants has a `shopEmail` set.

- [ ] **Step 1: Extend `ProfileClientProps`**

Add a `tenants` field representing only the tenants the parent has children at (deduped, alphabetized server-side):

```tsx
export type ProfileTenant = {
  id: string;
  short: string;
  shopEmail: string | null;
};

export type ProfileClientProps = {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
  childrenCount: number;
  tenants: ProfileTenant[]; // unique tenants of the parent's children, sorted by short
};
```

Update destructure: `export function ProfileClient({ user, childrenCount, tenants }: ProfileClientProps) {`

- [ ] **Step 2: Render the Help card after the children card**

```tsx
{tenants.some((t) => t.shopEmail) && (
  <div
    className="rounded-[14px] border bg-white mb-3 overflow-hidden"
    style={{
      borderColor: "var(--color-rule)",
      boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
    }}
  >
    {tenants
      .filter((t) => t.shopEmail)
      .map((t, i) => (
        <a
          key={t.id}
          href={`mailto:${t.shopEmail}`}
          className="block px-4 py-3 flex items-center justify-between"
          style={{
            color: "var(--color-ink)",
            borderTop: i === 0 ? undefined : "1px solid var(--color-rule)",
          }}
        >
          <span className="text-[13.5px] font-medium">Email {t.short}</span>
          <span style={{ color: "var(--color-rule)" }}>›</span>
        </a>
      ))}
  </div>
)}
```

Note: do NOT use JSX self-closing comment syntax around the conditional — Next/React handle conditional rendering with `&&` natively.

- [ ] **Step 3: Fetch tenants in `page.tsx`**

Update imports:

```tsx
import { getChildrenForParent, getTenantsByIds } from "@/db/queries";
```

Update body — compute unique tenantIds from children, fetch matching tenants, sort, and pass:

```tsx
const children = await getChildrenForParent(user.id);

const uniqueTenantIds = Array.from(new Set(children.map((c) => c.tenantId)));
const fullTenants = await getTenantsByIds(uniqueTenantIds);
const tenants = fullTenants
  .map((t) => ({ id: t.id, short: t.short, shopEmail: t.shopEmail }))
  .sort((a, b) => a.short.localeCompare(b.short));

return (
  <ProfileClient
    user={{
      name: user.name,
      email: user.email,
      image: null,
    }}
    childrenCount={children.length}
    tenants={tenants}
  />
);
```

- [ ] **Step 4: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Reload `/profile`. If the demo parent has at least one saved child at `demo-academy`, expect to see a third card with `Email Riverside Academy ›`. Tap → browser opens mail composer to `operator@demo.uniformorder.online`.

If parent has no children: Help card is absent. Add a child at demo-academy (via `/?action=add-child`), reload, confirm the card appears.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): per-tenant help & contact card

One mailto row per unique tenant in the parent's children list.
Card omits any tenant without a shopEmail; hides the whole card if
the parent has no children.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Legal card (per-tenant refund + global privacy/terms)

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`

Render per-tenant `Refund policy · <short> ›` rows (one per unique tenant the parent has children at, omitted if no children), followed by global `Privacy ›` (`/privacy`) and `Terms of service ›` (`/terms`).

- [ ] **Step 1: Render the Legal card after the Help card**

```tsx
<div
  className="rounded-[14px] border bg-white mb-3 overflow-hidden"
  style={{
    borderColor: "var(--color-rule)",
    boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
  }}
>
  {tenants.map((t, i) => (
    <Link
      key={`refund-${t.id}`}
      href={`/${t.id}/refund-policy`}
      className="block px-4 py-3 flex items-center justify-between"
      style={{
        color: "var(--color-ink)",
        borderTop: i === 0 ? undefined : "1px solid var(--color-rule)",
      }}
    >
      <span className="text-[13.5px] font-medium">Refund policy · {t.short}</span>
      <span style={{ color: "var(--color-rule)" }}>›</span>
    </Link>
  ))}
  <Link
    href="/privacy"
    className="block px-4 py-3 flex items-center justify-between"
    style={{
      color: "var(--color-ink)",
      borderTop: tenants.length === 0 ? undefined : "1px solid var(--color-rule)",
    }}
  >
    <span className="text-[13.5px] font-medium">Privacy</span>
    <span style={{ color: "var(--color-rule)" }}>›</span>
  </Link>
  <Link
    href="/terms"
    className="block px-4 py-3 flex items-center justify-between"
    style={{
      color: "var(--color-ink)",
      borderTop: "1px solid var(--color-rule)",
    }}
  >
    <span className="text-[13.5px] font-medium">Terms of service</span>
    <span style={{ color: "var(--color-rule)" }}>›</span>
  </Link>
</div>
```

- [ ] **Step 2: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Reload `/profile`. Expected: a Legal card with per-tenant refund policy rows (if any) plus Privacy and Terms. Tap Privacy → navigate to `/privacy`. Tap Terms → navigate to `/terms`. Tap Refund policy · Riverside Academy → navigate to `/demo-academy/refund-policy`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): legal card with per-tenant refund + global privacy/terms

One refund-policy row per unique tenant in the parent's children list,
followed by always-present Privacy and Terms rows. Refund rows omitted
when the parent has no children.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sign-out button + handler

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`

Full-width sign-out button styled red on paper, inline error banner on failure, button label flips to "Signing out…" while pending. Mirrors `admin-shell.tsx:62-75`.

- [ ] **Step 1: Add imports at top of `profile-client.tsx`**

```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";
```

- [ ] **Step 2: Add sign-out state + handler inside the component, before the return**

```tsx
const router = useRouter();
const [signingOut, setSigningOut] = useState(false);
const [signOutError, setSignOutError] = useState<string | null>(null);

const handleSignOut = async () => {
  setSignOutError(null);
  setSigningOut(true);
  try {
    await authClient.signOut();
    clearActiveChildCookieClient();
    router.replace("/");
    router.refresh();
  } catch {
    setSignOutError("Couldn't sign out. Try again.");
  } finally {
    setSigningOut(false);
  }
};
```

- [ ] **Step 3: Render sign-out card after the Legal card**

```tsx
<div className="mt-2">
  {signOutError && (
    <div
      className="text-[12px] font-semibold text-center mb-2 py-2 px-3 rounded-[10px]"
      style={{ color: "#B23A2A", background: "rgba(178,58,42,0.06)" }}
    >
      {signOutError}
    </div>
  )}
  <button
    type="button"
    onClick={handleSignOut}
    disabled={signingOut}
    className="w-full py-3.5 rounded-[14px] border bg-white text-[13px] font-semibold disabled:opacity-60"
    style={{
      borderColor: "var(--color-rule)",
      color: "#B23A2A",
      boxShadow: "0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.10)",
    }}
  >
    {signingOut ? "Signing out…" : "Sign out"}
  </button>
</div>
```

- [ ] **Step 4: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 5: Manual verification — happy path**

Reload `/profile`. Tap Sign out. Expected: button shows "Signing out…", then navigation to `/`. Confirm the session is cleared by visiting `/profile` again → redirect to `/auth/sign-in?callbackURL=%2Fprofile`.

- [ ] **Step 6: Manual verification — failure path**

Sign back in. Open Chrome DevTools → Network tab → Offline. Tap Sign out. Expected: red banner "Couldn't sign out. Try again." appears above the button, button re-enabled. Go back online; tap Sign out again; expect success.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): sign-out button with pending + error states

Mirrors the admin-shell sign-out pattern: authClient.signOut(),
clear active-child cookie, navigate to /. Inline red banner on
failure, button label flips to "Signing out…" while pending.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Version line

**Files:**
- Modify: `apps/web/src/app/profile/profile-client.tsx`

Small, centered, dim line under the sign-out button reading `UniformOrder · v<pkg.version>`. Reads `version` directly from `apps/web/package.json` at build time (Next.js handles JSON imports). No new env vars needed for v1; build-date deferred.

- [ ] **Step 1: Add the package.json import at the top of `profile-client.tsx`**

```tsx
import pkg from "../../../package.json";
```

This is a standard Next.js pattern (the bundler tree-shakes to just the version string).

- [ ] **Step 2: Render the version line below the sign-out button**

Add immediately after the `</div>` that wraps the sign-out button section:

```tsx
<div
  className="text-center text-[10px] mt-4 tracking-[0.4px]"
  style={{ color: "var(--color-ink-dim)", opacity: 0.6 }}
>
  UniformOrder · v{pkg.version}
</div>
```

- [ ] **Step 3: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS. If TypeScript complains about importing JSON, confirm `resolveJsonModule: true` is set in `apps/web/tsconfig.json` (it should be — Next.js default).

- [ ] **Step 4: Manual verification**

Reload `/profile`. Expected: a dim line below the sign-out button reading `UniformOrder · v0.0.0` (matches the current package.json `version` field).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "$(cat <<'EOF'
feat(profile): version line reading apps/web/package.json

Static read at build time — no env vars. Build date deferred to a
follow-up that decides whether to inject NEXT_PUBLIC_APP_BUILD_DATE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update BottomNav href

**Files:**
- Modify: `apps/web/src/components/bottom-nav.tsx`

Single one-line change. The Profile tab now actually leads to the Profile screen everywhere it appears (every parent-shop page).

- [ ] **Step 1: Edit `apps/web/src/components/bottom-nav.tsx:21`**

Find:

```tsx
{ id: "profile", label: "Profile", href: "#", icon: ProfileIcon },
```

Replace with:

```tsx
{ id: "profile", label: "Profile", href: "/profile", icon: ProfileIcon },
```

- [ ] **Step 2: Run check-types**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Manual verification — from multiple parent surfaces**

For each of `/demo-academy`, `/demo-academy/cart`, `/orders`, `/`: tap the Profile tab in BottomNav. Expected: navigates to `/profile` each time, the Profile tab in the BottomNav is highlighted.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/bottom-nav.tsx
git commit -m "$(cat <<'EOF'
feat(bottom-nav): wire Profile tab to /profile

Was href="#" — now leads to the real Profile screen.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Mobile QA pass + final commit

**Files:** none (verification only — commit only if QA reveals issues to fix)

Final pass at two mobile widths, plus a check of empty state, multi-tenant state, and the auth redirect round-trip.

- [ ] **Step 1: Chrome DevTools mobile emulation — iPhone 13 (390 × 844)**

Open Chrome DevTools → Toggle device toolbar → iPhone 13.
Visit `/profile`. Expected:
- No horizontal scroll.
- All rows tappable (target ≥44px).
- Card stack reads cleanly top-to-bottom with comfortable spacing.
- Sign-out button reaches full content width.

- [ ] **Step 2: Chrome DevTools mobile emulation — Galaxy A8 / 320 × 568**

In the device dropdown, choose "Responsive" and set to 320×568 (smallest practical width).
Reload `/profile`. Expected:
- Still no horizontal scroll.
- Long email truncates with ellipsis instead of wrapping.
- "Email Riverside Academy" / "Refund policy · Riverside Academy" labels still read cleanly (may wrap to two lines on narrow widths — acceptable).

- [ ] **Step 3: Empty state — parent with no children**

Sign in as a parent with no `parent_children` rows (create a fresh demo account if needed via `/auth/sign-up`).
Visit `/profile`. Expected:
- Identity card present.
- Children card: `My children · 0 saved ›`.
- **Help card: absent.**
- **Legal card: only Privacy and Terms rows; no refund-policy rows.**
- Sign-out + version line present.

- [ ] **Step 4: Multi-tenant state**

Sign in as a parent with at least one child at each of two tenants (add children via `/?action=add-child` for both `demo-academy` and `demo-blank`).
Visit `/profile`. Expected:
- Help card lists `Email Hawthorn Grammar` AND `Email Riverside Academy` (alphabetical by `tenant.short`).
- Legal card lists `Refund policy · Hawthorn Grammar` AND `Refund policy · Riverside Academy`, then Privacy, then Terms.

- [ ] **Step 5: Auth round-trip**

Sign out via Profile. Expected: lands on `/`. Visit `/profile` directly. Expected: redirect to `/auth/sign-in?callbackURL=%2Fprofile`. Sign in. Expected: lands on `/profile`.

- [ ] **Step 6: Run check-types one final time**

Run: `pnpm check-types:web` and `pnpm check-types`
Expected: both PASS.

- [ ] **Step 7: No commit needed if QA clean**

If QA reveals any UI bug, fix inline and commit with a `fix(profile): …` message. If QA is clean, no commit — the previous 8 commits stand.

---

## Out of scope reminder

The following were explicitly deferred from v1 (see spec §"Non-goals"):

- Edit display name / avatar upload
- Delete account flow
- Notification preferences
- Multiple emails / phone numbers
- Linked-schools management beyond the existing home-page children list
- Surfacing `user.image` (requires extending `getSessionUser` to expose Better Auth's `image` field — small follow-up, not blocking v1)
- App build-date in the version line (decision pending: env-var vs literal)
- Playwright Act 7 covering the Profile flow (queued as a follow-up after v1 ships)

Do not add any of these to the implementation. If you find yourself wanting to, surface it as a follow-up task instead.

---

## Self-review checklist (run before handing off)

- **Spec coverage:** All sections in the spec are implemented somewhere — identity (Task 2), children (Task 3), help (Task 4), legal (Task 5), sign-out (Task 6), version (Task 7), BottomNav href (Task 8), mobile guarantees (Task 9). ✓
- **Placeholder scan:** No "TBD", no "add appropriate error handling", every code step has full code, every "test" step has a check-types command or manual verification with expected outcome. ✓
- **Type consistency:** `ProfileClientProps` grows monotonically — `user` added Task 2, `childrenCount` added Task 3, `tenants` added Task 4. `ProfileTenant = { id, short, shopEmail }` is the same shape from Task 4 onward. `getInitials(displayName, email)` signature matches its call sites. ✓
- **Scope check:** Single screen, ~1-day budget, no schema/API/migrations — fits one plan. ✓
