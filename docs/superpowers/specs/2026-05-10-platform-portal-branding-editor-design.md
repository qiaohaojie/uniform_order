# Platform Portal — Branding Editor (design)

**Project:** Uniform Online Order System
**Author:** Engineering
**Date:** 10 May 2026
**Tracks:** `docs/remaining_work.md` §2.2 (last unfinished platform-portal screen)
**Parent spec:** `docs/superpowers/specs/2026-05-09-platform-portal-design.md` §8.1 (card 1) and §7.3 step 2 (wizard preview model)

---

## 1. Goal

Let a platform admin edit a tenant's visual identity — **logo, accent colour, motto** — from the existing tenant detail page (`/platform/tenants/[id]`), with a live preview of the parent shop. Closes out §2.2 of the pre-go-live backlog.

Out of scope (deliberate):

- `name`, `short`, `id`/slug — frozen post-creation. Slug is the URL primary key and the tenant-scoped email link prefix; renaming risks breaking history. If a typo lands, fix via SQL.
- `address`, `shopEmail`, `shopHours`, `collectionInstructions` — already covered by the operator card (`operator-card.tsx`); not branding.
- Public-listing toggle — already shipped on the branding card (`branding-card.tsx`); stays inline, not pulled into the drawer.
- A separate `/edit` route — drawer pattern matches `§8.1` of the parent spec ("per-card drawer edits").

---

## 2. UX

### 2.1 Entry point

Branding card on `/platform/tenants/[id]` gains an **[Edit]** button in its header (currently the card has only the public-listing toggle in the lower section). Clicking opens the drawer.

### 2.2 Drawer layout

Two-pane, right-side drawer (matches catalog-management drawer from PR #9):

- **Left (form):**
  - Logo block — current logo or Crest fallback (56×56), `Upload new` button (UploadThing `tenantLogo` route, already exists), `Remove` button (sets `logoUrl = null` → reverts to Crest). No confirm — cheap to undo by re-uploading.
  - Accent block — 7 preset swatches (same set as wizard step 2: `#7A1F2B`, `#0F4C5C`, `#2F5D50`, `#1F3A6E`, `#4A2238`, `#7A5418`, `#0E2A47`) + free-form hex input validated against `^#[0-9A-Fa-f]{6}$`.
  - Motto — optional `<input>`, max 200 chars (matches `step1Schema.motto`).
  - Footer — `Cancel` / `Save changes`. Save button disabled while pending; success closes drawer and toasts; error renders inline above footer.
- **Right (preview):**
  - Stub `MobileShell` (max-w 300px, framed) rendering accent header, logo/Crest, motto line, and 2 stub catalog rows. Reads form state directly — no DB roundtrip.

### 2.3 No PostHog deep-instrumentation

One event on save: `platform_branding_edited` with `{ tenantId, changedFields: string[] }` where `changedFields` is computed by diffing form state against the initial tenant prop. Matches the wizard's instrumentation cadence; deeper analytics aren't justified for an admin action that runs maybe twice per tenant lifetime.

### 2.4 Save while logo upload is in flight

`UploadButton`'s lifecycle gives us `onUploadBegin` and `onClientUploadComplete`. The drawer tracks an `isUploading` boolean: while true, **Save** is disabled and shows "Uploading…". Prevents the user from saving a stale `logoUrl` while a new image is mid-flight.

---

## 3. Architecture

### 3.1 New / modified files

| File | Change |
|---|---|
| `apps/web/src/app/platform/tenants/[id]/cards/branding-card.tsx` | Add `[Edit]` button to header; wire to drawer state |
| `apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx` | **New** — drawer chrome + form + preview |
| `apps/web/src/components/platform/branding-preview.tsx` | **New** — stub `MobileShell` preview, reusable |
| `apps/web/src/components/platform/accent-picker.tsx` | **New** — extracted from wizard step-2 (presets + hex input) |
| `apps/web/src/app/platform/tenants/[id]/actions.ts` | Add `editTenantBranding(id, input)` server action |
| `apps/web/src/lib/platform/schema.ts` | Add `brandingEditSchema = { logoUrl, accent, motto? }` |
| `apps/web/src/lib/platform/action-helpers.ts` | **New** — extract `requirePlatformAdmin()` and `parseInput()` from `new/actions.ts` so both `[id]/actions.ts` and `new/actions.ts` import them |
| `apps/web/src/app/platform/tenants/new/actions.ts` | Replace local `requirePlatformAdmin` / `parseInput` with imports from the shared helper |
| `apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx` | Refactor to use new `accent-picker.tsx` + `branding-preview.tsx` |

The two extracted components (`accent-picker`, `branding-preview`) are the reuse story: wizard step-2 and the post-creation editor share the same swatches and the same preview frame, so a future tweak to either flows to both.

**Drawer chrome — bespoke, not shared.** The catalog-management drawer (`apps/web/src/app/admin/[tenant]/catalog/item-drawer.tsx`, 399 lines) is catalog-specific (variants, categories, GarmentVector) — not a generic shareable component. The branding drawer is a fresh component that **matches the visual pattern** (right-side overlay, header with title + close, body, footer with Cancel/Save) without trying to share code. If a third drawer-using surface lands later, that's the right time to extract.

### 3.2 Why a new server action (not reuse `updateTenantBranding`)

The wizard's existing `updateTenantBranding(id, step2Schema)` writes `logoUrl + accent` only. Extending it to take `motto?` would silently null `motto` on every wizard step-2 save (Step2Branding doesn't pass motto). Cleaner to keep the wizard action narrow and add a sibling action for the editor:

```ts
// apps/web/src/app/platform/tenants/[id]/actions.ts
import { requirePlatformAdmin, parseInput } from "@/lib/platform/action-helpers";
import { serverCapture } from "@/lib/analytics/server";
import { brandingEditSchema } from "@/lib/platform/schema";

export async function editTenantBranding(
  id: string,
  input: unknown,
  changedFields: string[],
) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(brandingEditSchema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [updated] = await db
    .update(tenants)
    .set({
      logoUrl: parsed.data.logoUrl,
      accent: parsed.data.accent,
      motto: parsed.data.motto ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning({ id: tenants.id, status: tenants.platformApprovalStatus });

  if (!updated) return { ok: false as const, error: "Tenant not found" };

  await serverCapture(user.email, "platform_branding_edited", {
    tenantId: id,
    changedFields,
  });
  revalidatePath(`/platform/tenants/${id}`);
  if (updated.status === "approved") revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}
```

`changedFields` is computed client-side by diffing form state against the initial tenant values, then passed in (e.g. `["accent", "motto"]`). The action trusts the client list — it's analytics, not authorization.

Same revalidation pattern as `updateTenantBranding`. **Note on the path:** `tenants.id` is `text("id").primaryKey()` (e.g. `"nsbh"`) — the slug *is* the primary key. So `revalidatePath(\`/${id}\`, "layout")` correctly hits `/nsbh`. The wizard's existing `updateTenantBranding` uses the same pattern; not a bug.

### 3.3 Zod schema

```ts
// apps/web/src/lib/platform/schema.ts
export const brandingEditSchema = z.object({
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  motto: z.string().max(200).optional(),
});
```

`motto` is optional in the schema; the action coerces `undefined` → `null` for the DB write, mirroring how `step1Schema.motto` is handled in `createTenantDraft`.

---

## 4. Data flow

```
Drawer open
  └─ form state seeded from tenant prop (logoUrl, accent, motto)
       └─ user edits → form state updates → preview re-renders
            └─ Save (disabled while isUploading)
                 → editTenantBranding(id, form, changedFields) → DB write
                    ├─ revalidatePath(`/platform/tenants/${id}`)              # tenant detail
                    ├─ revalidatePath(`/${id}`, 'layout')                     # parent shop layout (if approved)
                    ├─ serverCapture(user.email, 'platform_branding_edited',  # PostHog
                    │                { tenantId, changedFields })
                    └─ drawer closes, toast on success
```

UploadThing flow is unchanged from the wizard: `UploadButton` posts to `tenantLogo` route, returns a `https://utfs.io/...` URL, form state stores it. Image only persists to `tenants.logo_url` once **Save** is pressed — orphaned uploads are acceptable (UploadThing free tier is generous; cleanup is a post-launch concern).

---

## 5. Error handling

| Failure | Behaviour |
|---|---|
| Zod validation (e.g. invalid hex, motto too long) | Inline error above footer; drawer stays open |
| UploadThing upload fails | UploadButton's `onUploadError` surfaces message inline; logoUrl unchanged; `isUploading` clears |
| Save clicked while upload in flight | Save button disabled; "Uploading…" affordance until upload resolves |
| `editTenantBranding` returns `ok:false` | Inline error above footer; form preserved; user can retry |
| Network/throw | Caught at the form level; same inline error surface |
| Non-admin user reaches the drawer somehow | `requirePlatformAdmin()` throws server-side; client gets generic error toast |

No optimistic UI — Save is a one-click confirm. The drawer closes only after the server action resolves successfully.

---

## 6. Testing

- **Type gate:** `pnpm check-types:web` must pass.
- **Manual smoke (local):**
  1. Open `/platform/tenants/nsbh` → click [Edit] on Branding card → drawer opens with current values.
  2. Pick a different accent preset → preview updates immediately.
  3. Enter custom hex `#123456` → preview updates; save succeeds; navigate to `/nsbh` (parent shop) → header accent matches.
  4. Upload a new logo → preview updates; save → parent shop crest replaced by image.
  5. Click `Remove` on logo → preview reverts to Crest; save → parent shop reverts to Crest.
  6. Edit motto → save → confirm motto persists on detail card and any place it renders.
  7. Submit invalid hex (`#zzz`) → inline validation error; no DB write.
  8. Submit motto > 200 chars → inline error.
  9. Click `Upload new` and immediately mash `Save` mid-upload → Save is disabled, shows "Uploading…", then re-enables once upload resolves; subsequent Save persists the new logo URL (not the stale one).
- **PostHog:** confirm one `platform_branding_edited` event lands per save with the right `tenantId`.

No automated tests added — this repo has no test suite (per CLAUDE.md, `check-types` is the correctness gate).

---

## 7. Open questions / future

- **Audit log** — parent spec §3 already calls out that branding edits are *not* audited in v1 (only approval/rejection is). This spec stays consistent. Revisit when a second platform admin joins.
- **Brand-asset pack** (favicon, social-share image) — not in scope. Logo + accent + motto cover the parent shop's visual surface today. Reopen when we add a tenant-public landing page.
- **Bulk re-theming** — N/A at 2 tenants. Reopen at tenant #5+.

---

## 8. Why now

- Last unfinished platform-portal screen — closes §2.2 of `remaining_work.md`.
- Unblocks self-service for tenant #3 onwards. NSBH/RGSH ship without it (their branding is in seed data), but every new tenant past those two needs to set their own visual identity without engineering involvement.
- Reuse story is already paid for: the wizard's step-2 components become shared (`accent-picker`, `branding-preview`) — net-new code is small (drawer + action + schema).
