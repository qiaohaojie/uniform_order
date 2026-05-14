# Neon Auth UI Migration + Magic Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the auth UI off `@neondatabase/auth` sub-path imports onto the standalone `@neondatabase/auth-ui` package and enable passwordless `magicLink` sign-in for parents, while leaving `lib/auth/{server,client,authorization}.ts` untouched.

**Architecture:** Two-file surgical migration. `apps/web/package.json` swaps the UI dependency and bumps the auth core; `apps/web/src/app/auth/[[...path]]/page-client.tsx` (the only file importing UI sub-paths) is rewritten to use the new package, wire Next router navigation props, and enable `magicLink`. Server-side session reading (`lib/auth/server.ts` → `createNeonAuth()` from `@neondatabase/auth/next/server`) is unchanged, preserving every authorization helper.

**Tech Stack:** Next.js 16 (App Router), `@neondatabase/auth` (next/next-server entries), `@neondatabase/auth-ui` (new UI package), Better Auth (server-side), TypeScript strict.

**Verification model:** This project has no test suite — `pnpm check-types:web` and `pnpm build:web` are the correctness gates, followed by a manual dev smoke test. Plan reflects that: no TDD test-first cycle; instead, each task ends with a type-check and a commit.

**Spec:** `docs/superpowers/specs/2026-05-13-neon-auth-ui-migration-design.md`

---

## File Map

| Path | Action | Responsibility |
| --- | --- | --- |
| `apps/web/package.json` | Modify | Swap `@neondatabase/auth` sub-path UI for standalone `@neondatabase/auth-ui` package. Bump core. Investigate `react` shim. |
| `apps/web/src/app/auth/[[...path]]/page-client.tsx` | Rewrite | Switch imports, wire `useRouter` + `Link`, enable `magicLink`, preserve `clearActiveChildCookieClient` sign-out side-effect. Consolidate the duplicate `useSession` import. |
| `apps/web/src/lib/auth/{server,client,authorization}.ts` | **No changes** | Out of scope. Server-side session contract is untouched. |

---

## Task 1: Install `@neondatabase/auth-ui` and bump `@neondatabase/auth`

**Files:**
- Modify: `apps/web/package.json` (dependencies block)

- [ ] **Step 1: Inspect current pinned versions and the `react` shim**

Read the dependencies block of `apps/web/package.json`. Confirm:
- `"@neondatabase/auth": "0.3.0-beta"` is present.
- `"react": "link:@neondatabase/auth/react"` is present.
- No `@neondatabase/auth-ui` entry exists.

Note the current state in a scratch comment in the commit message — needed for the shim-removal decision in Task 2.

- [ ] **Step 2: Add `@neondatabase/auth-ui` and bump `@neondatabase/auth` to latest**

Run from the repo root:

```bash
pnpm --filter web add @neondatabase/auth-ui@latest @neondatabase/auth@latest
```

Expected: pnpm resolves both, updates `apps/web/package.json`, writes `pnpm-lock.yaml`. Note any peer-dep warnings printed by pnpm — they may force the Task 2 fallback.

- [ ] **Step 3: If pnpm reports a peer-dep conflict between `@neondatabase/auth-ui` and the current `@neondatabase/auth`**

If install fails or warns about peers (e.g. `auth-ui` requires a different `@neondatabase/auth` major):

Per the spec risks table, the "keep old core, add new UI alongside" fallback is unavailable. Accept the bump dictated by the UI package — re-run install with the version range it peers against:

```bash
pnpm --filter web add @neondatabase/auth-ui@latest @neondatabase/auth@<required-version>
```

Document the chosen versions in the task commit message. If this triggers compile errors in `lib/auth/server.ts` or `lib/auth/client.ts`, stop here and surface to the reviewer — that crosses the non-goal boundary in the spec and needs a scope decision before continuing.

- [ ] **Step 4: Run type check to confirm baseline still compiles**

```bash
pnpm check-types:web
```

Expected: clean exit (no errors). If `PageProps`/`LayoutProps` errors appear in a fresh worktree, run `pnpm exec next build` once from `apps/web/` to regenerate `next-env.d.ts`, then re-run `check-types:web`.

If new errors appear in `lib/auth/server.ts` / `lib/auth/client.ts`: stop and surface — see Step 3 escalation.

- [ ] **Step 5: Commit**

If install succeeded with the spec's preferred (latest) versions:
```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(auth): add @neondatabase/auth-ui, bump @neondatabase/auth"
```

If Step 3 escalation fired (forced version chosen by peer-dep resolver):
```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(auth): add @neondatabase/auth-ui, pin @neondatabase/auth to <chosen-version>

@neondatabase/auth-ui peer-required <chosen-version> of the core package.
Default 'latest' bump was not compatible; pinned to satisfy the resolver."
```

---

## Task 2: Investigate and (provisionally) remove the `react` link shim

**Files:**
- Modify: `apps/web/package.json` (dependencies block — `react` entry)

- [ ] **Step 1: Remove the shim and reinstall**

In `apps/web/package.json`, change:

```json
"react": "link:@neondatabase/auth/react",
```

to:

```json
"react": "^19.2.5",
```

(Match `react-dom` exactly — currently `^19.2.5`. A lower floor like `^19.2.0` risks pnpm resolving a patch below what `@types/react: ^19.2.14` and `react-dom: ^19.2.5` already expect. If pnpm prefers a higher patch via the lockfile, accept it.)

Then run:

```bash
pnpm install
```

Expected: pnpm resolves a standard React 19 release with no peer warnings.

- [ ] **Step 2: Verify the type check still passes**

```bash
pnpm check-types:web
```

Expected: clean.

- [ ] **Step 3: Verify the production build still succeeds**

```bash
pnpm build:web
```

Expected: build completes. Pre-rendering may fail on `/sitemap.xml` if `DATABASE_URL` isn't in the worktree env — that's not a regression and is acceptable for this step. The build's TypeScript phase ("Finished TypeScript in X.Xs") and bundle compile must complete without error; only the static-prerender step may fail due to missing env. If TypeScript or webpack/turbopack errors appear, the shim removal is the cause.

- [ ] **Step 4: If either check fails, restore the shim**

Revert the `react` line back to `"react": "link:@neondatabase/auth/react"`, re-run `pnpm install`, re-run `pnpm check-types:web` to confirm restoration. Note the failure mode (one-line) in the commit message body so the next reviewer knows why the shim stays. Then proceed to Step 5.

- [ ] **Step 5: Commit**

If shim removed successfully:
```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(auth): remove obsolete react link shim, use standard react 19"
```

If shim restored:
```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(auth): keep react link shim (auth-ui requires bundled react copy)

Removing the shim broke <type-check|build>. Auth-ui still needs the same
React instance as @neondatabase/auth core. Documenting for future revisit."
```

---

## Task 3: Post-install type inspection — verify `@neondatabase/auth-ui` API shape

**Files (read-only inspection):**
- Read: `apps/web/node_modules/@neondatabase/auth-ui/dist/*.d.ts` (or wherever types resolve)
- Read: `apps/web/node_modules/@neondatabase/auth-ui/package.json` (locate the `types` entry)

This task produces no code changes — its output is a short notes file consumed by Task 4. It must run before the rewrite so any prop-name surprises adjust the code we write.

- [ ] **Step 1: Locate the type entry**

```bash
grep -E '"(types|exports|main|module)"' apps/web/node_modules/@neondatabase/auth-ui/package.json
```

Open the file pointed to by the `types` field (or `exports["."].types`).

- [ ] **Step 2: Confirm each of the following — write the actual symbol/name as exported by the package into a scratch note (`docs/superpowers/plans/.scratch-auth-ui-types.md`, gitignored via the `.scratch-*` prefix — if not ignored, add `docs/superpowers/plans/.scratch-*` to `.gitignore` first):**

Items to record:

1. The exported name for the route-path prop on `AuthView` — `path` (current spec assumption) or `pathname` (possible rename). Record actual name.
2. The exported type name for the path enum — `AuthViewPath` (current assumption) or new equivalent. Record actual exported name.
3. Whether `NeonAuthUIProvider` accepts these props with the signatures shown:
   - `authClient: AuthClient`
   - `navigate?: (href: string) => void`
   - `replace?: (href: string) => void`
   - `onSessionChange?: () => void`
   - `Link?: ComponentType<{ href: string; children: ReactNode }>` (or compatible)
   - `magicLink?: boolean`
   Record the **actual** declared shapes — any mismatch is what Task 4 has to adapt to.
4. If `magicLink` is **not** a boolean prop, find the equivalent: a `methods` array, `enabledFlows`, sub-config object, etc. Record the actual API for enabling magic link.
5. Confirm `NeonAuthUIProvider`'s declared `navigate` (and `replace`) parameter type accepts `router.push` directly. Next's `router.push` is `(href: string, options?: NavigateOptions) => void`. If TypeScript rejects the direct assignment (e.g. provider declares `(href: string) => void` invariantly, or stricter `noImplicitAny`/function-type variance flags), wrap each in a single-arg arrow: `navigate={(href) => router.push(href)}` / `replace={(href) => router.replace(href)}`.

- [ ] **Step 3: Decide the Task 4 code shape based on findings**

Annotate the scratch note with the final import statements and JSX that Task 4 will use. Examples:

If everything matches the spec:
```tsx
import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import type { AuthViewPath } from "@neondatabase/auth-ui";
// ... <NeonAuthUIProvider magicLink ... /> + <AuthView path={...} />
```

If `path` was renamed to `pathname`:
```tsx
// ... <AuthView pathname={path as AuthViewPath} />
```

If `magicLink` is configured via a methods array:
```tsx
// ... <NeonAuthUIProvider methods={["password", "magicLink"]} ... />
```

If `navigate` typing rejects `router.push` directly:
```tsx
navigate={(href) => router.push(href)}
replace={(href) => router.replace(href)}
```

- [ ] **Step 4: Do not commit the scratch note**

The scratch note is reference material for Task 4 only. Delete it after Task 4 commits, or leave it gitignored. No commit in this task.

---

## Task 4: Rewrite `page-client.tsx` to use `@neondatabase/auth-ui` + enable Magic Link

**Files:**
- Modify (full rewrite): `apps/web/src/app/auth/[[...path]]/page-client.tsx`

- [ ] **Step 1: Replace the file contents**

Open the scratch note from Task 3. Apply any adjustments it dictates to the imports/JSX below. The reference shape (assuming all spec assumptions hold) is:

```tsx
"use client";

import "@neondatabase/auth-ui/css";
import { AuthView, NeonAuthUIProvider } from "@neondatabase/auth-ui";
import type { AuthViewPath } from "@neondatabase/auth-ui";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth/client";
import { clearActiveChildCookieClient } from "@/lib/active-child.client";

export function AuthPageClient({ path }: { path: string }) {
  const router = useRouter();
  const session = useSession();

  // Sign-out side-effect: clear active-child cookie when session goes null.
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

Cleanup notes embedded in the rewrite:
- The duplicate `useSession` import (was on lines 7 and 8 of the original) is consolidated into a single named import alongside `authClient`.
- `useEffect` dependency `session?.data` is preserved exactly — sign-out side-effect must still fire.

- [ ] **Step 2: If Task 3 found that `navigate`/`replace` signatures don't accept `router.push` directly, wrap them**

Replace:
```tsx
navigate={router.push}
replace={router.replace}
```
with:
```tsx
navigate={(href) => router.push(href)}
replace={(href) => router.replace(href)}
```

- [ ] **Step 3: Run type check**

```bash
pnpm check-types:web
```

Expected: clean exit. If errors point at `@neondatabase/auth-ui` symbols, return to Task 3 — the type-inspection notes were incomplete; update them and adjust the JSX.

- [ ] **Step 4: Run production build**

```bash
pnpm build:web
```

Expected: TypeScript + bundle compilation succeed. `/sitemap.xml` prerender may fail on missing `DATABASE_URL` — that's pre-existing and acceptable, same as Task 2 Step 3. No new errors should originate in `app/auth/[[...path]]/`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/auth/[[...path]]/page-client.tsx
git commit -m "feat(auth): migrate UI to @neondatabase/auth-ui, enable magic link

- Replace @neondatabase/auth/react/ui imports with @neondatabase/auth-ui
- Wire useRouter + Link into NeonAuthUIProvider (navigate/replace/Link/onSessionChange)
- Enable magicLink prop for passwordless sign-in
- Consolidate duplicate useSession import
- Preserve clearActiveChildCookieClient sign-out side-effect"
```

---

## Task 5: Operator pre-smoke-test checklist (user runs in Neon Console)

This task is not Claude-executable — it lists what the user must do in the Neon Console before the dev smoke test in Task 6 will work. The plan executor reports this checklist to the user and waits for confirmation before proceeding to Task 6.

- [ ] **Step 1: Neon Console → Auth → Plugins → toggle Magic Link ON**
- [ ] **Step 2: Set Link Expiration = 5 minutes**
- [ ] **Step 3: Allow New User Registration = ON**
- [ ] **Step 4: Confirm Email provider (SMTP) is configured under Neon Auth → Email Settings (or equivalent)**

If SMTP is not configured, magic-link emails will not deliver and Task 6 Step 3 will silently appear to fail (email never arrives).

- [ ] **Step 5: User confirms each item is complete before Task 6 begins**

No commit. No git changes. Wait gate only.

---

## Task 6: Dev smoke test

**Files:** None (verification only).

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev:web
```

Wait for "Ready in N.Ns" / local URL printed.

- [ ] **Step 2: Visit `/auth/sign-in` and confirm Magic Link UI is present**

Open `http://localhost:3000/auth/sign-in` in a browser.

Expected: Both the existing email/password form **and** a Magic Link option are visible. If only password fields appear, the `magicLink` prop did not take effect — re-check Task 3 (was the API really `magicLink` boolean?) and Task 5 (is the plugin toggle actually ON in Neon Console?).

- [ ] **Step 3: Visit `/auth/sign-up` and confirm the sibling view still renders**

Open `http://localhost:3000/auth/sign-up`.

Expected: Sign-up form renders without console errors. The catch-all route `[[...path]]` must continue to serve this path correctly after the rewrite. If the page errors or 404s, `AuthView`'s path prop name or value isn't being passed correctly — re-check Task 3 Step 2 finding #1.

- [ ] **Step 4: Sign in via magic link end-to-end**

Enter a real email (one the SMTP provider can deliver to). Submit. Wait for the email to arrive (check inbox + spam). Click the link.

Expected: Browser navigates back to the app, session is established (e.g. landing on `/`, the home/school picker), no console errors.

**Partial-evidence fallback if SMTP is unavailable in this environment:**
If the operator cannot wire SMTP for this smoke test, accept partial evidence:
1. Open DevTools → Network tab before submitting.
2. After submit, locate the magic-link request to Neon Auth — confirm 200/202 response (not 4xx/5xx).
3. Check the Neon Auth dashboard / server logs for an "email queued" or equivalent entry.
4. Mark this step in Task 7's review report as "Step 4 partial — magic-link request succeeded server-side; email delivery not verified end-to-end."
This is a partial verification, not a substitute for a real delivery test before production launch.

- [ ] **Step 5: Confirm post-sign-in redirect destination matches pre-migration behavior**

After Step 4 lands, note the URL. Compare against the destination the old flow used (typically `/` for parent sign-in, or a `returnTo`/`callbackUrl` param if one was in the URL). The added `onSessionChange={router.refresh}` triggers a server-component re-render — it should not change the navigation target, but verify.

If the destination shifted: investigate whether `AuthView`'s built-in redirect handling differs in the new package, and whether `router.refresh` is racing with that handling. Surface to reviewer if behavior change is non-trivial.

- [ ] **Step 6: Sign in via existing email/password and confirm it still works**

Use an account that already has a password set. Sign in. Confirm session established.

- [ ] **Step 7: Sign out and confirm `clearActiveChildCookieClient` fires**

Trigger sign-out via the auth UI. In browser DevTools → Application → Cookies, confirm the active-child cookie `uo:active-child` (defined as `ACTIVE_CHILD_COOKIE_NAME` in `apps/web/src/lib/active-child.client.ts:6`) is cleared (`Max-Age=0`, no value) after sign-out.

If the cookie persists, the `useEffect` watching `session?.data === null` isn't firing. Inspect: does the new `useSession` from `@neondatabase/auth/next` still emit `data: null` on sign-out, or has the shape changed? If shape changed, this is in scope to fix here (the side-effect must be preserved per spec non-goals).

- [ ] **Step 8: Report results**

If all six smoke-test items pass: report success and proceed to Task 7.

If any fail: report which step failed, capture browser console output and any server log lines, and surface to reviewer before committing or pushing.

No commit in this task — verification only.

---

## Task 7: Finalize and request review

**Files:** None (workflow only).

- [ ] **Step 1: Confirm verification gate is fully green**

Re-run from a clean state:

```bash
pnpm check-types:web
pnpm build:web
```

Both must exit clean (build's `/sitemap.xml` prerender failure on missing `DATABASE_URL` is acceptable; any other failure is not).

- [ ] **Step 2: Push the worktree branch**

Read the current branch from git rather than hardcoding — the worktree native tool may have created a different branch name that was renamed manually, or the executor may have chosen another name.

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
case "$BRANCH" in
  HEAD|main|master) echo "Refusing to push: on $BRANCH (expected a feature branch)"; exit 1 ;;
esac
git push -u origin "$BRANCH"
```

If `BRANCH` is not the expected `feat/neon-auth-ui-migration`, stop and surface to the reviewer before pushing — a wrong branch name suggests the worktree setup diverged from the plan.

- [ ] **Step 3: Hand off to `superpowers:requesting-code-review`**

Invoke the requesting-code-review skill with this branch. Include in the request:
- Spec: `docs/superpowers/specs/2026-05-13-neon-auth-ui-migration-design.md`
- Plan: `docs/superpowers/plans/2026-05-13-neon-auth-ui-migration.md`
- Smoke-test results from Task 6 (which steps passed, any anomalies)
- Whether the `react` shim was removed or kept (from Task 2)
- Whether any prop names differed from spec assumptions (from Task 3)

No commit in this task.

---

## Abort Conditions

Stop work, do not commit further, and reopen the spec with the reviewer if **any** of the following happens:

1. **Forced core bump cascades into `lib/auth/*`.** Task 1 Step 3 escalates to a non-trivial `@neondatabase/auth` version, and the resulting type/runtime errors in `lib/auth/server.ts` or `lib/auth/client.ts` require more than mechanical fixes. These files are spec non-goals; modifying them is a scope breach.
2. **Sign-out side-effect breaks structurally.** Task 6 Step 7 shows the active-child cookie isn't cleared, and investigation reveals `useSession`'s return shape has changed enough that the `session?.data === null` predicate is no longer expressible cleanly. The fix here may also be a scope breach — surface before implementing.
3. **Post-sign-in redirect destination changes materially.** Task 6 Step 5 shows the landing destination has shifted in a way users would notice (e.g. landing on a sign-in confirmation page rather than `/`). Don't paper over with ad-hoc redirects; surface for spec amendment.
4. **Both fallbacks unavailable.** The `react` shim must stay (Task 2 Step 4 hit) **and** the peer-dep resolver forced an incompatible auth core (Task 1 Step 3 hit). Two simultaneous fallbacks indicate the migration assumptions in the spec no longer hold.

## Self-Review Notes

**Spec coverage check** — every spec section has a task:

- Spec §1 (package.json changes) → Task 1 (UI add + core bump) + Task 2 (react shim removal)
- Spec §2 (page-client.tsx rewrite) → Task 4
- Spec §3 (post-install type inspection — covers `path`/`AuthViewPath` rename, provider prop existence, `magicLink` shape, and `router.push` assignability) → Task 3
- Spec §4 (Neon Console operator steps — includes SMTP confirmation) → Task 5
- Spec verification gate (`check-types` + `build` + smoke tests, with `/auth/sign-up` render and post-sign-in redirect coverage, plus SMTP-unavailable fallback) → Task 6
- Spec risks → Task 1 Step 3 (peer-dep), Task 2 Step 4 (shim restore), Task 3 Step 2 (prop renames), Task 6 Step 5 (redirect verification)
- Spec non-goal (no changes to `lib/auth/{server,client,authorization}.ts`) → enforced in File Map, Task 1 Step 3 escalation, and Abort Conditions §1–2

**Placeholder scan:** No "TBD", no "add error handling later", no "similar to Task N". Every code step shows complete code or complete commands.

**Type consistency:** `AuthViewPath` used in Task 4 matches the type-inspection target in Task 3 Step 2 item 2. `magicLink` boolean prop used in Task 4 matches Task 3 Step 2 item 4 (with explicit fallback for non-boolean shapes). `navigate`/`replace` signatures in Task 4 match Task 3 Step 2 item 5 (with explicit arrow-wrap fallback in Task 4 Step 2). Cookie name `uo:active-child` in Task 6 Step 7 matches `ACTIVE_CHILD_COOKIE_NAME` in `apps/web/src/lib/active-child.client.ts:6`.
