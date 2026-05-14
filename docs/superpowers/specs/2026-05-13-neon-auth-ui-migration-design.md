# Neon Auth UI Migration + Magic Link

**Date:** 2026-05-13
**Branch:** `feat/neon-auth-ui-migration` (worktree)
**Tracks:** `docs/remaining_work.md` §3.12 — passwordless sign-in for parents (launch prerequisite)

## Goal

Move the auth UI off the bundled `@neondatabase/auth` v0.3.0-beta sub-path imports onto the current standalone `@neondatabase/auth-ui` package, then enable the `magicLink` prop so parents can sign in passwordlessly. Email/password remains available alongside magic link.

## Non-goals

- **No changes to `lib/auth/authorization.ts`** (`getSessionUser`, `requireSessionUser`, `isPlatformAdminEmail`, `isTenantOperatorEmail`). These read sessions via the server module (`lib/auth/server.ts` → `createNeonAuth()` from `@neondatabase/auth/next/server`), which is already on Better Auth and unaffected.
- **No changes to `lib/auth/client.ts`** or `lib/auth/server.ts`. The `@neondatabase/auth/next` and `@neondatabase/auth/next/server` entrypoints stay on `@neondatabase/auth` (bumped to latest). Only the **UI** moves to `@neondatabase/auth-ui`.
- No new auth flows (OAuth, SSO, passkeys). Scope is magic link + existing email/password only.
- No DB schema changes. Magic link is server-side via Neon Auth plugin toggle.

## Current state (verified)

- `apps/web/src/app/auth/[[...path]]/page-client.tsx` is the **only** file with old UI sub-path imports:
  - `import "@neondatabase/auth/ui/css"`
  - `import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth/react/ui"`
  - `import type { AuthViewPath } from "@neondatabase/auth/react/ui"`
- `<NeonAuthUIProvider authClient={authClient}>` is missing required navigation props.
- An existing `useEffect` calls `clearActiveChildCookieClient()` when `session.data === null` (sign-out side-effect — must be preserved).
- `useSession` is imported twice (lines 7 and 8) — the rewrite consolidates to a single import as incidental cleanup.
- `apps/web/package.json` pins `"@neondatabase/auth": "0.3.0-beta"` and contains the workaround `"react": "link:@neondatabase/auth/react"`.

## Design

### 1. Package changes (`apps/web/package.json`)

| Change | Reason |
| --- | --- |
| `@neondatabase/auth` → `@latest` | Get current server/client entries aligned with the new UI package. |
| Add `@neondatabase/auth-ui` (latest) | New home for `AuthView` + `NeonAuthUIProvider`. |
| Remove `"react": "link:@neondatabase/auth/react"` **if** install + `check-types:web` still pass without it | This shim forces the app to use the React copy bundled by `@neondatabase/auth`. The new standalone UI package shouldn't require it; we verify by removing, running `pnpm install`, then `pnpm check-types:web` + `pnpm build:web`. Restore if either fails and document the cause in the plan. |

### 2. `page-client.tsx` rewrite

Replace imports and provider props. Final shape:

```tsx
"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import type { AuthViewPath } from "@neondatabase/auth-ui"; // confirm exported name after install
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

export function AuthPageClient({ path }: { path: string }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session?.data === null) {
      clearActiveChildCookieClient();
    }
  }, [session?.data]);

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-paper)" }}
    >
      <div className="w-full max-w-md">
        <NeonAuthUIProvider
          authClient={authClient}
          navigate={router.push}
          replace={router.replace}
          onSessionChange={router.refresh}
          Link={Link}
          magicLink
        >
          <AuthView path={path as AuthViewPath} />
        </NeonAuthUIProvider>
      </div>
    </main>
  );
}
```

### 3. Post-install type inspection (in plan)

After `pnpm install`, before the rewrite is final, inspect `node_modules/@neondatabase/auth-ui` types to confirm **all** of the following — any mismatch adjusts the rewrite:

- `AuthView` prop is `path` (current) vs `pathname` (possibly renamed).
- Type name `AuthViewPath` is still exported, or whatever the new equivalent is.
- `NeonAuthUIProvider` accepts `navigate`, `replace`, `onSessionChange`, and `Link` props with the shapes the rewrite assumes.
- `magicLink` is a boolean prop on `NeonAuthUIProvider` (vs. e.g. `methods={["magic-link"]}` or a sub-config).
- `navigate` / `replace` signatures match `router.push` / `router.replace`. If strict typing complains (Next's router methods accept an optional second `NavigateOptions` arg), wrap: `navigate={(href) => router.push(href)}`.

This is a ~5-minute check that prevents a build break. The plan must include it as an explicit step before TypeScript validation.

### 4. Non-code operator steps (user runs, not Claude)

1. Neon Console → Auth → Plugins → toggle **Magic Link** on.
2. Set **Link Expiration** = 5 min.
3. Set **Allow New User Registration** = on.
4. Confirm an **Email provider (SMTP)** is configured in Neon Auth. Without it, magic-link emails won't send and the smoke test will fail silently.

The plan should call these out as a checklist the user runs before the dev smoke test, since the `magicLink` prop is inert without the plugin enabled and emails won't deliver without SMTP.

## Verification gate

Must pass before merge:

```
pnpm check-types:web    # clean
pnpm build:web          # clean
```

Then dev smoke test (`pnpm dev:web`, navigate `/auth/sign-in`):

1. Magic Link option visible alongside email/password on `/auth/sign-in`.
2. `/auth/sign-up` still renders (catch-all serves multiple paths — confirm the sibling view didn't regress).
3. Magic link end-to-end: enter email → email arrives → click link → session established → redirected.
4. Existing email/password sign-in still works.
5. Post-sign-in redirect lands on the same destination as today (likely `/` or a `returnTo`/`callbackUrl` param). The added `onSessionChange={router.refresh}` re-renders RSC trees; confirm it doesn't change the landing destination vs. the old bare-provider flow.
6. Sign out → `clearActiveChildCookieClient()` fires (verify via cookie inspection: the active-child cookie is cleared).

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| `AuthView` prop renamed `path` → `pathname`, or `magicLink` prop shape differs | Inspect types after install (step 3 above). |
| Removing `react` shim breaks the bundle | Restore shim, document in plan, ship migration anyway. |
| `@neondatabase/auth` latest has API drift in `/next` or `/next/server` entries | Out of scope to fix here — if it breaks `lib/auth/client.ts` / `server.ts`, prefer reverting the auth bump and only adding `@neondatabase/auth-ui` alongside. **Caveat:** peer-dep conflict may block this (see next row). |
| `@neondatabase/auth-ui` peer-requires a different `@neondatabase/auth` major than 0.3.0-beta | If `pnpm install` rejects the combination, the "keep old core + add new UI" fallback is unavailable. Plan B then becomes: bump `@neondatabase/auth` to whatever the UI package peers require, and accept any resulting churn in `lib/auth/client.ts` / `server.ts` as in-scope for this migration. Flag in plan as a branch point. |
| Magic Link plugin / SMTP not configured before smoke test | Plan lists the four Neon Console steps (plugin, expiration, registration, SMTP) as an explicit pre-smoke-test checklist. |
| Post-sign-in redirect destination shifts due to `onSessionChange={router.refresh}` | Smoke test step 5 verifies landing destination matches today's behavior. |

## Out of scope

- Styling/theming the auth UI beyond what `@neondatabase/auth-ui/css` ships.
- Rate-limiting or anti-abuse on magic link requests (relies on Neon Auth's built-in handling).
- Migration of password-only users to magic-link-only (both methods coexist).
