# Magic Link Sign-In — Design

**Status:** Draft → review
**Date:** 2026-05-18
**Supersedes:** `remaining_work.md §3.12` ("OTP / magic-link login option — blocked on neon-js#58")
**Related:** `docs/superpowers/specs/2026-05-13-neon-auth-ui-migration-design.md`, `remaining_work.md §2.14` (auth direction)

## Goal

Enable passwordless magic-link sign-in on the existing `/auth/[[...path]]` route, delivered via our existing Emailit pipeline with a branded template. Password sign-in remains as the fallback; Google sign-in is explicitly out of scope (separate spec).

## Background

Neon Auth shipped native Magic Link plugin support in `@neondatabase/auth` / `@neondatabase/auth-ui` (Beta, 2026-05). The earlier attempt during the auth-ui migration (PR #35, `2e68584`) was blocked because `NeonAuthUIProvider` hardcoded `magicLink: false` and `@neondatabase/auth@0.3.0-beta` excluded `magicLinkClient` from its plugin list. That blocker is now resolved upstream; this spec re-enables the feature properly.

`@neondatabase/auth-ui@0.2.0-beta` is already installed and wired in `apps/web/src/app/auth/[[...path]]/page-client.tsx` — just without the `magicLink` prop.

## Decisions (recorded from brainstorm)

| Decision | Choice | Reason |
|---|---|---|
| Email delivery | Webhook → Emailit | Reuse verified `noreply@uniformorder.online` sender, single brand, single deliverability story |
| Sign-up via magic link | Allowed (`disable_sign_up: false`) | Matches §2.14 direction; seamless first-time UX |
| Link expiration | 15 min | Sweet spot — survives email prefetch / slow inboxes, well under attack-window concern |
| Scope | Magic link only; password stays; Google deferred | Smallest viable PR |
| UI integration | `magicLink` prop on `NeonAuthUIProvider` (pending API verification) | Reuses existing `AuthView`; falls back to custom form only if AuthView doesn't thread `callbackURL` |

## Architecture

```
Parent enters email in AuthView (/auth/sign-in?callbackURL=...)
        │
        ▼  signIn.magicLink({ email, callbackURL })
Neon Auth backend
        │
        ▼  POST send.magic_link  →  /api/neon-auth/webhook
Our webhook handler
        │
        ▼  sendEmail()  →  Emailit  →  noreply@uniformorder.online
Parent's inbox
        │
        ▼  click link  →  Neon verifies token  →  redirect to callbackURL
Session live, lands on intended destination
```

## File changes

| File | Change | Purpose |
|---|---|---|
| `apps/web/src/app/auth/[[...path]]/page-client.tsx` | Modify | Add `magicLink` prop to `NeonAuthUIProvider`. If AuthView does not thread `callbackURL`, see fallback in "Open question". |
| `apps/web/src/lib/email/templates/magic-link.tsx` | New | Branded HTML + plain-text template, matches existing order-confirmation style |
| `apps/web/src/app/api/neon-auth/webhook/route.ts` | New | Verify signature, dispatch by event type, deliver via Emailit |
| `apps/web/.env.example` | Modify | Document `NEON_AUTH_WEBHOOK_SECRET` |

## Webhook handler contract

**Route:** `POST /api/neon-auth/webhook` — Node runtime (consistency with rest of app; signature verify + Emailit call both fine on Node).

**Verification:** read `NEON_AUTH_WEBHOOK_SECRET` from env, validate signature header against raw body. Reject 401 if invalid. (Exact header name + algorithm is the one item the plan phase must verify against Neon docs — see "Open questions".)

**Dispatch:** `switch (event.type)` — single case today (`send.magic_link`), shaped for future events (`send.verification_email`, `send.password_reset`).

**Payload shape** (per Neon docs):
```ts
{
  type: "send.magic_link",
  data: {
    email: string,
    url: string,           // full link to embed in the email
    link_type: "sign-in" | "sign-up",
    token: string,         // included for audit; not used directly
  }
}
```

**Handler logic** (~25 LOC):
1. Verify signature → 401 on fail (no body, don't leak)
2. Parse JSON, switch on `event.type`
3. For `send.magic_link`: render `magicLinkEmail({ url, linkType })` → `sendEmail(...)`
4. Return 200 even if `sendEmail` returned `null` (4xx) — don't make Neon retry bad addresses
5. Re-throw on Emailit 5xx so Neon retries per its policy
6. PostHog: `serverCapture({ event: "auth_magic_link_sent", properties: { link_type, email_domain } })` — domain only, never address

**Unknown event types:** return 200 with `{ ignored: true }` (forward-compatible).

## Email template

Single React component `magicLinkEmail({ url, linkType })` rendered to HTML and plain text. Matches transactional email visual language (parchment background, serif headline, gold accent rule). No image assets; inline styles only — same pattern as existing order-confirmation email.

**Subject:**
- `link_type: "sign-in"` → *"Sign in to Uniform Online"*
- `link_type: "sign-up"` → *"Confirm your Uniform Online account"*

**Body (sign-in variant):**

```
Uniform Online
─────────────

Hi,

Click the button below to sign in. The link is valid for 15 minutes
and can only be used once.

  [ Sign in to Uniform Online ]   ← button → {url}

Or paste this link into your browser:
{url}

If you didn't request this, you can ignore this email — no account
changes have been made.

─────────────
Uniform Online
noreply@uniformorder.online
```

**Plain text:** same content, no markup. Critical for spam-filter scoring and accessibility.

**Explicitly NOT included:** tracking pixels (deliverability + privacy), marketing footer/unsubscribe (this is transactional, wrong list), school branding (link arrives before tenant context is established).

## callbackURL preservation

Today the parent lands at `/auth/sign-in?callbackURL=/nsbh/checkout`. The current `safeCallbackPath` reads the query param in *this* tab. With magic link, the click typically opens in a **new tab** (often different device — phone email → desktop browser) which doesn't carry that query param.

`callbackURL` must be passed into `signIn.magicLink({ email, callbackURL })` so Neon stores it with the token and redirects there after verification.

**Two implementation paths**, decided by behavior of `@neondatabase/auth-ui@0.2.0-beta`:

- **A. AuthView reads `callbackURL` from URL automatically.** The `magicLink` prop is sufficient; no other change.
- **B. AuthView doesn't thread it through.** Pass via provider prop / context / slot override, or fall back to a small custom magic-link form alongside `AuthView` that calls `authClient.signIn.magicLink({ email, callbackURL })` directly.

The plan phase must verify which path applies before implementation — a ~10 minute API check against the library source / network tab.

**Server-side guard (regardless of A/B):** when Neon redirects back to `callbackURL`, the existing `safeCallbackPath` lives client-side and won't re-run on the post-auth landing. **Preferred approach:** always pass `callbackURL: "/auth/complete?to=<encoded-target>"` into `signIn.magicLink`, and implement `/auth/complete` as a server route that re-runs `safeCallbackPath` server-side then `redirect()`s. Same primitive used twice, single hardening point, no middleware needed. This prevents `?callbackURL=//evil.com` attacks via forged magic-link URLs. (Plan phase confirms whether the library lets us set this indirection, or whether we need a Next.js `middleware.ts` matcher instead.)

## Environment configuration

**New env var:**

| Var | Where | Purpose |
|---|---|---|
| `NEON_AUTH_WEBHOOK_SECRET` | hPanel (prod), `.env.local` (dev) | Verify webhook signature |

**Reused (already configured in both `.env.example` and `.env.local`):** `EMAILIT_API_KEY`, `FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`.

**Neon project configuration** (one-time, no code):

1. Dev branch — Auth → Plugins → Magic Link → enable, `expires_in: 15`, `disable_sign_up: false`
2. Dev branch — Auth → Webhooks → subscribe `send.magic_link` → `https://<dev-host>/api/neon-auth/webhook` → capture signing secret into `NEON_AUTH_WEBHOOK_SECRET`
3. Run smoke test (below)
4. Repeat on prod branch only after dev passes

## Observability

Server-side PostHog events:
- `auth_magic_link_sent` — `{ link_type, email_domain }` (no PII)
- `auth_magic_link_failed` — `{ reason: "emailit_4xx" | "emailit_5xx" | "invalid_signature" }`
- `auth_magic_link_consumed` — derived from Better Auth session-create event if available; otherwise skip

Drives a single "Magic link funnel" insight: sent → consumed rate. Surfaces deliverability issues fast.

## Smoke test (manual, captured in PR description)

- Existing parent: enter email → Emailit-branded email arrives → click → land on `callbackURL` → session active
- New parent: never-seen email → account auto-created on click → land on `/`
- Forged callbackURL `?callbackURL=//evil.com` → rejected, lands on `/`
- Expired link (wait 16 min) → graceful "link expired" UI
- Re-click consumed link → graceful "link already used" UI
- Invalid webhook signature → 401, no email sent

## Rollback

Disable Magic Link in the Neon Console (one toggle) — `AuthView` falls back to password-only sign-in. Webhook handler stays in place harmlessly.

## Open questions (resolved in plan phase)

1. **Exact Neon Auth webhook signature header name + algorithm.** Confirm from Neon webhook docs before writing the verify helper.
2. **Whether `@neondatabase/auth-ui@0.2.0-beta`'s `AuthView` threads `callbackURL` into `signIn.magicLink` automatically** (path A vs B above). ~10 min library inspection.

## Out of scope

- Google sign-in (separate spec)
- Removing password sign-in (separate decision; password stays as fallback)
- Other Better Auth events (`send.verification_email`, `send.password_reset`) — handler is shaped to accept them, but implementing them is out of scope
- Account dedupe between magic-link and password (`remaining_work.md §2.11`) — Neon Auth handles this automatically by primary email; verification is a separate ops task
- Marketing/transactional email split (Reach vs Emailit) — both currently go through Emailit

## Acceptance criteria

- A parent can sign in by entering their email and clicking the link in the resulting Emailit-branded email
- The link respects the `callbackURL` query parameter, including across tabs/devices
- Forged `callbackURL` values (`//evil.com`, absolute URLs, `/auth/*`) are rejected
- Password sign-in continues to work unchanged
- `pnpm check-types:web` passes
- Webhook signature verification rejects unsigned/forged requests with 401
- Disabling Magic Link in Neon Console cleanly falls back to password-only without app changes
