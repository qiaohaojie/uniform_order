# Parent Account: Saved Children + Order Note — Design

**Date:** 8 May 2026
**Tracks:** `docs/remaining_work.md` §3.3
**Touches:** §3.10 (follow-up #4 — `/privacy` page is the platform-level disclosure surface)
**Status:** Design approved; ready for implementation plan
**Legal posture:** `my_doc/Legal/Parent_Children_Onboarding/2026-05-07-parent-school-linking.md`

---

## Problem

The school picker (`apps/web/src/app/page.tsx`) reads from `PARENT.kids` hardcoded mock data. The "Add another child" button has no `onClick`. Parents with siblings — or parents on a new device — cannot manage their saved profiles. Sibling families effectively re-enter student details at every checkout, even though `orders.userId` is already populated by Neon Auth at checkout time.

## Goal

Replace the hardcoded picker mock with a DB-backed list of saved "shopping profiles" scoped to the authenticated parent (Neon Auth user). Add UI for create / edit / remove. Surface a stale-year confirm prompt at school-year rollover. Bundle a small order-level "note for the school" field requested during brainstorming. Expand the existing `/privacy` page to disclose the new server-side storage of children's profiles.

## Non-goals

- Parent enrolment verification or school-issued invitation tokens (see legal doc — explicitly out by policy).
- Combined cross-tenant cart.
- Per-item `requires_staff_approval` flag for branded items.
- Manual order claim flow (every order in this codebase already has `userId` populated; there are no unlinked guest orders to claim).
- Auto-detection of year rollover beyond a `last_confirmed_at < Jan 1 of current year` check.
- Separate `parent_profiles` extension table (not needed for this PR — Stack Auth's user fields cover everything we'd put on it).

---

## What already exists (do not rebuild)

This avoids re-implementing infrastructure already in the repo:

| Surface | Where | Status |
|---|---|---|
| Neon Auth client | `apps/web/src/lib/auth/{server,client,authorization}.ts` | Integrated |
| Sign-in / sign-up UI | `apps/web/src/app/auth/[[...path]]/` (Neon's `<AuthView>`) | Live |
| Auth API | `apps/web/src/app/api/auth/[...path]/route.ts` | Live |
| `getSessionUser()`, `requireSessionUser()`, `ensureParentEmailAccess()` | `lib/auth/authorization.ts` | Live |
| `neonAuthUsers` schema reference (`neon_auth.user`, id `text`) | `db/schema.ts:19-27` | Live |
| `orders.userId text REFERENCES neon_auth.user(id)` | `db/schema.ts:131` | Live, populated at checkout |
| Parent order list / detail | `app/orders/page.tsx`, `app/orders/[orderId]/page.tsx` | Live (per `2026-05-07-parent-order-detail-design.md`) |
| Minimal `/privacy` page | `app/privacy/page.tsx` | Live, **content expansion required** |

**Implications:**
- **No auth code is written in this PR.** Configuring magic-link and Google providers is an ops task on the Neon Auth project dashboard, not a code change. The implementation plan must include a checklist item to verify both providers are enabled in the Neon Auth project before merge.
- **No retroactive order claim is needed.** Every order already has a `userId` because checkout requires sign-in (`api/orders/route.ts:140-143`).
- **Picker stays public.** Only signed-in users see saved children; not-signed-in users see an empty state with a sign-in CTA on the "Add a child" action. Catalog browsing remains anonymous-friendly to match today's flow.

---

## Auth model

| Surface | Access |
|---|---|
| `/` picker | Public; conditionally renders saved children if signed in. |
| `/[tenant]` catalog, cart | Public (today's behaviour). |
| `/[tenant]/checkout` | Sign-in required (today's behaviour, unchanged). |
| `/orders`, `/orders/[orderId]` | Sign-in required (today's behaviour). |
| **NEW:** `/api/parent/children` (CRUD) | Sign-in required; `getSessionUser()` then scope queries to user.id. |
| **NEW:** `/api/parent/children/[id]/confirm` (stale-year acknowledge) | Sign-in required; ownership-checked. |

Sign-in entry from the picker uses the existing `/auth/sign-in?callbackURL=...` pattern (precedent: `/orders`).

---

## Schema changes

Drizzle schema additions in `apps/web/src/db/schema.ts`:

```ts
// ─── Tenants ─────────────────────────────────────────────────────────────────
// (existing block) — add column:
export const tenants = pgTable("tenants", {
  // ...existing columns...
  isPubliclyListed: boolean("is_publicly_listed").notNull().default(false),
  // ...
});

// ─── Parent's saved children ─────────────────────────────────────────────────
export const parentChildren = pgTable(
  "parent_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: text("parent_id")
      .notNull()
      .references(() => neonAuthUsers.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),                 // name as it should appear on the order
    year: text("year").notNull(),                 // "7"–"12"; text for future flexibility
    rollClass: text("roll_class"),
    lastConfirmedAt: timestamp("last_confirmed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index("parent_children_parent_idx").on(t.parentId),
  })
);

// ─── Orders ──────────────────────────────────────────────────────────────────
// (existing block) — add column:
//   parentNote text          (nullable; ≤500 chars enforced at app layer)
```

Raw SQL migration (Drizzle generates roughly this):

```sql
ALTER TABLE tenants
  ADD COLUMN is_publicly_listed boolean NOT NULL DEFAULT false;
UPDATE tenants SET is_publicly_listed = true WHERE id IN ('nsbh', 'rgsh');

CREATE TABLE parent_children (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id          text NOT NULL
                       REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  tenant_id          text NOT NULL
                       REFERENCES tenants(id) ON DELETE RESTRICT,
  name               text NOT NULL,
  year               text NOT NULL,
  roll_class         text,
  last_confirmed_at  timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parent_children_parent_idx ON parent_children(parent_id);

ALTER TABLE orders
  ADD COLUMN parent_note text;

-- Fix existing FK: today orders.user_id has no ON DELETE action, which would
-- block Stack Auth account-deletion. Set to SET NULL so deleted accounts
-- de-link orders without removing the school's record.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_user_id_fk;
ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_user_id_fk
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;
```

**Key decisions:**

- `parent_id` is `text` (not `uuid`) to match `neon_auth.user(id)` which is `text` in this codebase.
- `ON DELETE CASCADE` on parent_id — Stack Auth's account-deletion path automatically clears saved children. Matches APP 11 retention expectations.
- `ON DELETE RESTRICT` on tenant_id — prevents accidental orphaning if a tenant is removed; super-admin must explicitly handle. Tenant deletion is rare and should be deliberate.
- `year` as `text` — future-flexible (Prep, K, mixed-stage, special programs).
- No `unique(parent_id, tenant_id, name)` constraint — a parent could legitimately have two kids named "Alex" at the same school. Dedup is a UX concern, not a schema one.
- `is_publicly_listed` is **separate** from the existing `platformApprovalStatus` column. Approval is about Stripe Connect KYC; listing is about marketplace visibility. A school can be approved-but-not-listed (URL-only entry) or unapproved-and-not-listed (still being onboarded).
- `orders.parent_note` is nullable; existing rows backfill to `NULL` (no migration data needed). 500-char cap enforced at API + client; no DB constraint (allows future schema-free expansion).

---

## Picker flow (`apps/web/src/app/page.tsx`)

Convert to a server component. Replace mock-data branch with DB-driven flow.

```tsx
// page.tsx (server component, sketch)
export default async function Home() {
  const user = await getSessionUser();

  if (!user) {
    return <PickerLoggedOut />;
  }

  const children = await getChildrenForParent(user.id);
  const tenants = await getPubliclyListedTenants();

  return (
    <PickerLoggedIn
      userName={user.name ?? user.email}
      children={children}
      tenants={tenants}
    />
  );
}
```

**Logged-out state:** unchanged greeting, "You haven't added any children yet" empty card, single dashed "Add a child" CTA → on tap, redirect to `/auth/sign-in?callbackURL=/?action=add-child`. After sign-in, picker re-renders signed-in and the `?action=add-child` query opens the add-child sheet automatically.

**Logged-in state:** list of saved children (each card: name, school, year, "tap to shop" affordance), then the dashed "Add another child" button, then a `<UserButton />` or sign-out link. If a child has `last_confirmed_at < Jan 1 of current year` AND today is past Jan 1, render the inline stale-year pill on that card.

**Tap-a-child:** navigate to `/[tenantId]?child=<uuid>`. The catalog page picks up `?child=` as a server-side query, fetches the child (ownership-checked), and prefills the checkout form's name / year / roll class. (No localStorage for this path.)

**Removal of mock data:** delete `PARENT` const from `lib/data.ts`. Verify no other module imports it (grep before delete).

---

## Add / edit / remove child

**API routes:**

| Method | Path | Body / params | Returns |
|---|---|---|---|
| GET | `/api/parent/children` | (cookie auth) | `{ children: ChildRow[] }` |
| POST | `/api/parent/children` | `{ tenantId, name, year, rollClass? }` | `201 { child }` |
| PATCH | `/api/parent/children/[id]` | `{ name?, year?, rollClass? }` | `200 { child }` |
| DELETE | `/api/parent/children/[id]` | — | `204` |
| POST | `/api/parent/children/[id]/confirm` | — | `200 { child }` (updates `last_confirmed_at = now()`) |

All routes:
- `await getSessionUser()`; 401 if missing.
- Path `[id]` routes verify the row's `parent_id === user.id`; 404 (not 403) on mismatch to prevent ID enumeration.
- Validation: `name` 1–60 chars, `year` ∈ ["7","8","9","10","11","12"] for v1 (high-school launch tenants), `rollClass` 0–20 chars, `tenantId` ∈ publicly-listed tenants only on POST. PATCH cannot change `tenantId` (force a remove-and-re-add for that intent).

**Add sheet UI:**

```
┌──────────────────────────────────────┐
│ Add a child                          │
├──────────────────────────────────────┤
│ School        [▾ NSBH / RGHS …]      │  ← only is_publicly_listed
│ Name          [____________________] │
│ Year          [▾ Year 7 … Year 12]   │
│ Roll class    [_________ optional]   │
│                                      │
│ We save this so you can re-order     │
│ quickly. Edit or remove anytime.     │
│ [Privacy notice ↗]                   │
│                                      │
│ [Cancel]              [Save]         │
└──────────────────────────────────────┘
```

**Edit sheet:** same layout, school field disabled (greyed) with help text "Remove and re-add to change school." Submit button disabled until something changes.

**Remove confirm:** modal — *"Remove Riley from your saved children? Past orders are not affected."* — destructive button.

---

## Order-level note (`parent_note`)

**Schema:** `orders.parent_note text` (nullable).

**Checkout (`apps/web/src/app/[tenant]/checkout/checkout-screen.tsx`):**

New field rendered after the delivery section, before refund-policy consent:

```
Note for the school (optional)
┌────────────────────────────────────────┐
│                                        │
│                                        │
└────────────────────────────────────────┘
0 / 500
```

- `<textarea>` with `maxLength={500}`, character counter live-updates.
- Sent as `parentNote: string | null` in the existing POST body to `/api/orders`.
- Server-side: trim, treat empty as `null`, cap to 500 chars (defence in depth).

**Operator order detail (`app/admin/[tenant]/orders/[orderId]/...`):** if `parent_note` is non-null, render a callout above the line items:

```
┌────────────────────────────────────────┐
│ 📝 Note from parent                    │
│ "Please prioritise — collecting Friday."│
└────────────────────────────────────────┘
```

**Pick slip (printable):** include the note in a bordered box at the top so it cannot be missed during physical fulfilment.

**Parent order detail:** echo the note back to the parent on `/orders/[orderId]` so they can confirm what was sent.

---

## Stale-year guard

On picker render (server-side, for signed-in user):

```ts
const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
children.forEach(c => {
  c.needsYearConfirm =
    c.lastConfirmedAt < currentYearStart && new Date() >= currentYearStart;
});
```

UI on each child card with `needsYearConfirm`:

```
┌──────────────────────────────────────────────┐
│ 👤 Riley · NSBH · Year 9                     │
│   ⓘ Still in Year 9 this year? [Yes] [Edit]  │
└──────────────────────────────────────────────┘
```

- **Yes** → `POST /api/parent/children/[id]/confirm` → updates `last_confirmed_at = now()`. Pill disappears on re-render.
- **Edit** → opens edit sheet pre-filled.

A child added in November 2026 won't be prompted until after Jan 1 2027. No monthly nags.

---

## `/privacy` page expansion

The existing page (`app/privacy/page.tsx`) is a one-paragraph stub. Expand to cover:

1. **What we collect** — parent identity (email, display name from Google sign-in if used), saved children profiles (name, year, roll class, school), order details (line items, pickup/shipping, payment metadata via Stripe), order notes.
2. **Why** — fulfilling uniform purchases; remembering profiles for re-ordering.
3. **Where it's stored** — Neon (US-hosted Postgres); Stripe (US-hosted) for payment metadata; Resend for transactional email.
4. **How long** — saved children retained until you delete them or your account; orders retained for 7 years for tax/accounting (Australian record-keeping requirements). Account deletion via the user menu cascades children; orders are de-linked but retained.
5. **Your rights** — access, correction, deletion (links to user-settings page).
6. **Contact** — platform support email.

Linked from: picker footer, sign-in modal (already), add-child sheet (collection notice link). The previous decision to defer a platform `/terms` page (per `Refund_Policy/2026-05-07-refund-policy-ownership.md`) is unchanged — `/privacy` is a privacy notice, not terms of service.

---

## Edge cases

| Case | Behaviour |
|---|---|
| Same email used for both magic-link and Google | Stack Auth dedupes by primary email. Implementation plan must verify on staging before merge; if dedup is off, raise as a Neon Auth project setting before launch. |
| Tenant flips `is_publicly_listed` to false after a parent saved a child for it | Child remains visible on the picker (don't punish parents for school's listing change). Child can still be edited/removed. New "Add a child" sheet hides that tenant. |
| Tenant deleted | Blocked by `RESTRICT` FK; super-admin must reassign or delete dependent rows first. |
| Parent deletes account | `parent_children` cascades. **Concrete fix bundled in this PR:** `orders.userId` today is declared without an `onDelete` action (`db/schema.ts:131`), which defaults to `NO ACTION` and would block Stack Auth's account-delete with an FK violation as soon as a parent has any order. Change the FK to `ON DELETE SET NULL` (matching `orderRefunds.operatorUserId` at `db/schema.ts:168`). De-linked orders remain on the school's records — required for tax / fulfilment audit. |
| Guest checkout | Not possible today — checkout requires sign-in. Out of scope. |
| Child name is a nickname / preferred name | Allowed and intentional. Field is "name as it should appear on the order," not "legal name." |
| Parent edits a child the night before pickup of an in-flight order | Edit only affects future orders. The in-flight order has its own snapshot of `studentName / studentYear / studentRoll` from when it was placed (`orders.studentName`, etc.); editing the child profile does not retroactively mutate orders. |
| Parent has two kids with the same first name | Allowed. UI shows school + year as disambiguators. |
| Year-rollover prompt fires at midnight Jan 1 in user's timezone | Prompt is calendar-year based (`Date.getFullYear()`), evaluated server-side at picker render. Acceptable approximation. |

---

## Testing

| Layer | Approach |
|---|---|
| **Unit** | Drizzle query functions: `getChildrenForParent`, `createChild`, `updateChild`, `deleteChild`, `confirmChild`, `getPubliclyListedTenants`. Direct DB tests with seeded `neon_auth.user` rows. |
| **API** | Route-level tests for the five new `/api/parent/children/*` endpoints — auth gate, ownership scoping, validation rejects, success paths. |
| **Integration (Playwright)** | Mock Neon Auth session via cookie injection. Cover: signed-out picker shows empty state with sign-in CTA → sign-in callback resumes add-child sheet → create / list / edit / remove → tap-saved-child opens prefilled checkout → stale-year prompt visible after fast-forwarding system date past Jan 1 → tenant filter hides un-listed tenants in the sheet. |
| **Order note** | Unit: API trim+null+cap. Integration: type into checkout textarea → place order → see note on operator detail and on parent's `/orders/[id]` echo. |
| **Manual on staging** | Real magic-link and Google sign-in (verify both providers are configured on Neon Auth project). Real picker flow on a fresh device. `/privacy` page renders. Operator pick slip includes the note. |

---

## Cross-references

- `my_doc/Legal/Parent_Children_Onboarding/2026-05-07-parent-school-linking.md` — legal posture; lawful basis for storing children's profiles server-side; school-side privacy rationale; `is_publicly_listed` flag motivation.
- `my_doc/Legal/Refund_Policy/2026-05-07-refund-policy-ownership.md` — sister legal doc; explains why platform `/terms` is deferred and `/privacy` is the only platform-authored legal surface for now.
- `docs/superpowers/specs/2026-05-07-parent-order-detail-design.md` — adjacent spec (§3.4); both pages now share the same authenticated-parent identity and will surface `parent_note` consistently.
- `docs/remaining_work.md` §3.3 — feature ticket this spec resolves.
- `docs/remaining_work.md` §3.10 follow-up #4 — `/privacy` expansion supersedes the deferred `/terms` page to the extent that data-storage disclosure is now in scope.

---

## Out-of-scope follow-ups (file as separate tickets)

1. **Auto-import children from past orders** — first-time signed-in parent could see "Add the children from your past 2 orders to your account?" with prefilled cards. Nice DX, but not v1.
2. **Photo / avatar per child** — explicit out (see legal doc — APP 3 minimisation).
3. **Per-item `requires_staff_approval` flag** — for branded/leadership-restricted items. Out of scope; tracked as future work in legal doc.
4. **Privacy-notice version history** — when `/privacy` content materially changes, force a re-acknowledgement. Future work.
