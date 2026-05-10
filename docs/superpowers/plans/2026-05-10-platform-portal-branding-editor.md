# Platform Portal — Branding Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a drawer-based branding editor to `/platform/tenants/[id]` that lets a platform admin edit logo, accent, and motto, with a live `MobileShell` preview. Closes `docs/remaining_work.md` §2.2.

**Architecture:** Extract shared platform action-helpers (`requirePlatformAdmin`, `parseInput`) so both `[id]/actions.ts` and `new/actions.ts` use the same source. Extract `AccentPicker` and `BrandingPreview` from wizard step-2 into shared components reused by both wizard and editor. Add a new `editTenantBranding` server action (sibling to wizard's `updateTenantBranding`) that writes `logo_url + accent + motto` and revalidates both `/platform/tenants/[id]` and `/[id]` (parent shop layout, when approved). Drawer chrome is bespoke — the catalog item-drawer is 399 lines of catalog-specific code, not shareable.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Drizzle ORM (Neon Postgres, `db.batch` not `db.transaction`), Zod, UploadThing (`tenantLogo` route, already wired), PostHog server capture (3-arg signature), Neon Auth.

**Spec:** `docs/superpowers/specs/2026-05-10-platform-portal-branding-editor-design.md`.

---

## File map

| Path | Change | Why |
|---|---|---|
| `apps/web/src/lib/platform/action-helpers.ts` | **New** | Extract `requirePlatformAdmin`, `parseInput` so both action files share one source |
| `apps/web/src/lib/platform/schema.ts` | Modify | Add `brandingEditSchema` |
| `apps/web/src/app/platform/tenants/new/actions.ts` | Modify | Replace local helpers with imports from `action-helpers.ts` |
| `apps/web/src/components/platform/accent-picker.tsx` | **New** | Presets + hex input, extracted from wizard step-2 |
| `apps/web/src/components/platform/branding-preview.tsx` | **New** | Stub `MobileShell` preview (form-state-driven, no DB) |
| `apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx:7,65-84` | Modify | Use `AccentPicker` (line 7 = `PRESETS` const, lines 65-84 = "Accent colour" outer `<div>`) |
| `apps/web/src/app/platform/tenants/[id]/actions.ts` | Modify | Replace local `requirePlatformAdmin` with import; add `editTenantBranding` |
| `apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx` | **New** | Drawer chrome + form + `BrandingPreview` |
| `apps/web/src/app/platform/tenants/[id]/cards/branding-card.tsx` | Modify | Add `[Edit]` button to header; render drawer when open |

**Repo correctness gate:** `pnpm check-types:web` (no test suite — see `CLAUDE.md`). Run after each task.

**Commit style:** Conventional commits (`feat:`, `refactor:`, `chore:`). Co-author trailer matches recent commits — `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Extract shared platform action-helpers

**Files:**
- Create: `apps/web/src/lib/platform/action-helpers.ts`
- Modify: `apps/web/src/app/platform/tenants/new/actions.ts:14-30` (remove local helpers, import them)
- Modify: `apps/web/src/app/platform/tenants/[id]/actions.ts:8-12` (replace local `requirePlatformAdmin` with import)

This unblocks Task 5: the new `editTenantBranding` action needs `requirePlatformAdmin` and `parseInput`. Doing the extraction first keeps the wizard and editor on a single source.

- [ ] **Step 1: Create the shared helpers file**

```ts
// apps/web/src/lib/platform/action-helpers.ts
import type { ZodSchema } from "zod";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";

export async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export function parseInput<T>(
  schema: ZodSchema<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input"),
  };
}
```

- [ ] **Step 2: Update wizard `new/actions.ts` to import shared helpers**

Replace lines 12 (the `ZodSchema` import) and 14–30 (the local `requirePlatformAdmin` and `parseInput` definitions) with a single import. Concretely:

```ts
// Top of file — after the existing imports.
// REMOVE: import type { ZodSchema } from "zod";
// REMOVE: the local async function requirePlatformAdmin() { ... } (lines 14-20)
// REMOVE: the local function parseInput<T>(...) { ... } (lines 22-30)

// ADD:
import { requirePlatformAdmin, parseInput } from "@/lib/platform/action-helpers";
```

Leave every existing call site (`requirePlatformAdmin()`, `parseInput(...)`) unchanged — same names, same signatures.

- [ ] **Step 3: Update `[id]/actions.ts` to import shared helpers**

In `apps/web/src/app/platform/tenants/[id]/actions.ts`, replace lines 6–12:

```ts
// REMOVE these lines:
// import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
//
// async function requirePlatformAdmin() {
//   const user = await getSessionUser();
//   if (!user || !isPlatformAdminEmail(user.email)) throw new Error("Forbidden");
//   return user;
// }

// REPLACE with:
import { requirePlatformAdmin } from "@/lib/platform/action-helpers";
```

(`parseInput` is added in Task 5, so don't import it yet — keeps Task 1's diff minimal.)

- [ ] **Step 4: Type-check**

Run: `pnpm check-types:web`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/platform/action-helpers.ts \
        apps/web/src/app/platform/tenants/new/actions.ts \
        apps/web/src/app/platform/tenants/[id]/actions.ts
git commit -m "$(cat <<'EOF'
refactor: extract requirePlatformAdmin/parseInput to shared helper

Both /platform/tenants/new/actions.ts and /platform/tenants/[id]/actions.ts
defined their own requirePlatformAdmin. Pulled them into one file so the
upcoming editTenantBranding action (in [id]/actions.ts) can reuse the
same admin gate and zod parser as the wizard. No behaviour change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `brandingEditSchema`

**Files:**
- Modify: `apps/web/src/lib/platform/schema.ts` (append after `step2Schema`)

The editor needs a schema covering `logoUrl + accent + motto` (the wizard's `step2Schema` is `logoUrl + accent` only, and widening it would silently null `motto` on every wizard save).

- [ ] **Step 1: Append the schema**

Add after line 23 (end of `step2Schema`):

```ts
export const brandingEditSchema = z.object({
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  motto: z.string().max(200).optional(),
});
```

Add the type export below `Step4`:

```ts
export type BrandingEdit = z.infer<typeof brandingEditSchema>;
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/platform/schema.ts
git commit -m "$(cat <<'EOF'
feat: add brandingEditSchema for tenant branding editor

Sibling to step2Schema (wizard); adds optional motto. Used by the new
editTenantBranding server action. Wizard schema unchanged so wizard saves
still don't touch motto.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract `AccentPicker` shared component

**Files:**
- Create: `apps/web/src/components/platform/accent-picker.tsx`
- Modify: `apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx:7,65-84` (replace inline preset+hex JSX with `<AccentPicker>`)

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/platform/accent-picker.tsx
"use client";

export const ACCENT_PRESETS = [
  "#7A1F2B",
  "#0F4C5C",
  "#2F5D50",
  "#1F3A6E",
  "#4A2238",
  "#7A5418",
  "#0E2A47",
] as const;

export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2.5 items-center">
      {ACCENT_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Select accent ${c}`}
          onClick={() => onChange(c)}
          className={`w-11 h-11 rounded-full border ${
            value.toLowerCase() === c.toLowerCase()
              ? "border-ink ring-2 ring-white"
              : "border-rule"
          }`}
          style={{ background: c }}
        />
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 h-9 w-28 px-2 border border-rule rounded-md text-xs font-mono"
        aria-label="Custom hex colour"
      />
    </div>
  );
}
```

- [ ] **Step 2: Refactor wizard step-2 to use it**

In `apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx`:

Remove the local `PRESETS` constant (line 7).

Add the import near the top:

```ts
import { AccentPicker } from "@/components/platform/accent-picker";
```

Replace the entire accent JSX block (lines 65-84 — the outer `<div>` wrapping the "Accent colour" label, the preset swatches `.map`, and the hex `<input>`):

```tsx
<div>
  <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">Accent colour</div>
  <AccentPicker value={accent} onChange={onAccentChange} />
</div>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 4: Smoke-check the wizard**

Run: `pnpm dev:web`
Open `/platform/tenants/new`, click through to step 2. Confirm: the swatches still render, clicking one updates the form state, the hex input still works. Expected: no visual regression.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/platform/accent-picker.tsx \
        apps/web/src/app/platform/tenants/new/steps/step-2-branding.tsx
git commit -m "$(cat <<'EOF'
refactor: extract AccentPicker to components/platform/

Shared between wizard step-2 and the upcoming branding editor drawer.
Same swatches, same hex input — single source for both.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `BrandingPreview` shared component

**Files:**
- Create: `apps/web/src/components/platform/branding-preview.tsx`

Stub `MobileShell` showing accent header, logo or `Crest` fallback, motto, and 2 stub catalog rows. Pure client component; reads form state via props — no DB roundtrip.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/platform/branding-preview.tsx
"use client";

import { Crest } from "@/components/crest";

const STUB_ITEMS = [
  { name: "Year 7 Blazer", price: "$185" },
  { name: "School Tie", price: "$24" },
];

export function BrandingPreview({
  tenantName,
  short,
  accent,
  logoUrl,
  motto,
}: {
  tenantName: string;
  short: string;
  accent: string;
  logoUrl: string | null;
  motto: string;
}) {
  return (
    <div className="w-full max-w-[300px]">
      <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 text-ink-dim">
        Live preview · parent shop
      </div>
      <div className="rounded-[24px] border-[8px] border-[#222] bg-parchment overflow-hidden">
        {/* header */}
        <div
          className="px-3 py-2.5 flex items-center gap-2 text-white"
          style={{ background: accent }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-6 h-6 rounded-sm bg-white object-contain"
            />
          ) : (
            <Crest tenant={{ id: "preview", accent, short }} size={24} ring={false} />
          )}
          <div className="font-serif text-sm font-semibold truncate">{tenantName}</div>
        </div>

        {/* body */}
        <div className="px-3 py-3 text-[11px] text-ink">
          {motto ? (
            <div className="italic mb-2" style={{ color: accent }}>
              {motto}
            </div>
          ) : null}
          {STUB_ITEMS.map((it) => (
            <div
              key={it.name}
              className="bg-paper border border-rule rounded-md px-2 py-1.5 mb-1.5 flex justify-between"
            >
              <span>{it.name}</span>
              <span className="tnum">{it.price}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-dim mt-1.5">Updates as you edit.</p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/platform/branding-preview.tsx
git commit -m "$(cat <<'EOF'
feat: add BrandingPreview component

Stub MobileShell-style preview that renders accent header, logo (or Crest
fallback), motto, and two stub catalog rows from props. Used by the
upcoming branding editor drawer; designed so wizard step-2 can adopt it
later for the right-rail preview described in the platform-portal spec.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add `editTenantBranding` server action

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/actions.ts` (top imports + append new export)

- [ ] **Step 1: Update imports + add the action**

At the top of `[id]/actions.ts`, add (alongside the `requirePlatformAdmin` import from Task 1):

```ts
import { parseInput } from "@/lib/platform/action-helpers";
import { brandingEditSchema } from "@/lib/platform/schema";
import { serverCapture } from "@/lib/analytics/server";
```

Append the new server action at the end of the file:

```ts
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

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/actions.ts
git commit -m "$(cat <<'EOF'
feat: add editTenantBranding server action

Sibling to wizard's updateTenantBranding — covers logoUrl + accent + motto
(motto is in step1Schema in the wizard, so we don't widen step2Schema).
Captures one PostHog event with changedFields, revalidates the tenant
detail page and the parent-shop layout (when approved).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `BrandingEditDrawer` component

**Files:**
- Create: `apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx`

Drawer is a right-side overlay (fixed positioned `<aside>` + scrim). Form state seeded from the tenant prop. Computes `changedFields` by diffing current state vs. seed before save. `Save` is disabled while UploadThing is uploading.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx
"use client";

import { useEffect, useState } from "react";
import { UploadButton } from "@/components/uploadthing";
import { Crest } from "@/components/crest";
import { AccentPicker } from "@/components/platform/accent-picker";
import { BrandingPreview } from "@/components/platform/branding-preview";
import { editTenantBranding } from "../actions";
import type { TenantRow } from "@/db/schema";

export function BrandingEditDrawer({
  tenant,
  onClose,
}: {
  tenant: TenantRow;
  onClose: () => void;
}) {
  const initial = {
    logoUrl: tenant.logoUrl,
    accent: tenant.accent,
    motto: tenant.motto ?? "",
  };

  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [accent, setAccent] = useState(initial.accent);
  const [motto, setMotto] = useState<string>(initial.motto);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Esc-to-close + lock body scroll while drawer is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Whitespace-only motto edits are intentionally treated as no-op
  // (`.trim()` both sides) so we don't burn a DB write or PostHog event.
  function diffChanged(): string[] {
    const out: string[] = [];
    if (logoUrl !== initial.logoUrl) out.push("logoUrl");
    if (accent.toLowerCase() !== initial.accent.toLowerCase()) out.push("accent");
    if (motto.trim() !== initial.motto.trim()) out.push("motto");
    return out;
  }

  async function save() {
    setError(null);
    const changed = diffChanged();
    if (changed.length === 0) {
      onClose();
      return;
    }
    setPending(true);
    const r = await editTenantBranding(
      tenant.id,
      {
        logoUrl,
        accent,
        motto: motto.trim() === "" ? undefined : motto.trim(),
      },
      changed,
    );
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onClose();
  }

  const saveDisabled = pending || isUploading;

  return (
    <div className="fixed inset-0 z-40">
      {/* scrim */}
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit branding"
        className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-paper shadow-xl flex flex-col"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="font-serif text-lg font-semibold">Edit branding</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-dim hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
          {/* form */}
          <div className="space-y-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">School logo</div>
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-md border border-rule bg-parchment flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Crest tenant={{ id: tenant.id, accent, short: tenant.short }} size={48} ring={false} />
                  )}
                </div>
                <UploadButton
                  endpoint="tenantLogo"
                  input={{ tenantId: tenant.id }}
                  onUploadBegin={() => {
                    setError(null);
                    setIsUploading(true);
                  }}
                  onClientUploadComplete={(res) => {
                    setIsUploading(false);
                    const url = res?.[0]?.url ?? null;
                    if (url) setLogoUrl(url);
                  }}
                  onUploadError={(e) => {
                    setIsUploading(false);
                    setError(e.message);
                  }}
                />
                {logoUrl ? (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="text-xs text-ink-dim hover:text-ink underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2">Accent colour</div>
              <AccentPicker value={accent} onChange={setAccent} />
            </div>

            <div>
              <label
                htmlFor="motto-input"
                className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 block"
              >
                Motto <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input
                id="motto-input"
                type="text"
                maxLength={200}
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                className="w-full h-9 px-2 border border-rule rounded-md text-sm"
                placeholder="e.g. Veritas et Virtus"
              />
            </div>
          </div>

          {/* preview */}
          <BrandingPreview
            tenantName={tenant.name}
            short={tenant.short}
            accent={accent}
            logoUrl={logoUrl}
            motto={motto.trim()}
          />
        </div>

        <footer className="px-5 py-4 border-t border-rule flex flex-col gap-2">
          {error ? <div className="text-sm text-alert">{error}</div> : null}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md border border-rule text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saveDisabled}
              className="h-10 px-5 rounded-md bg-navy-deep text-white font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : isUploading ? "Uploading…" : "Save changes"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/cards/branding-edit-drawer.tsx
git commit -m "$(cat <<'EOF'
feat: BrandingEditDrawer for tenant detail page

Right-side overlay drawer. Form on left (logo upload + remove, accent
picker, motto), live BrandingPreview on right. Save is disabled while
UploadThing is uploading so we can't persist a stale URL. Computes
changedFields client-side and ships them to editTenantBranding for
PostHog. A11y: aria-modal, Esc-to-close, body-scroll-lock; full focus
trap deferred.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire `[Edit]` button into `BrandingCard`

**Files:**
- Modify: `apps/web/src/app/platform/tenants/[id]/cards/branding-card.tsx` (entire file)

Add an `[Edit]` button to the card header that opens `BrandingEditDrawer`. Keep the public-listing toggle inline (already shipped — don't move it).

- [ ] **Step 1: Replace the file**

Full contents of `branding-card.tsx`:

```tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { Crest } from "@/components/crest";
import { togglePublicListing } from "../actions";
import type { TenantRow } from "@/db/schema";
import { BrandingEditDrawer } from "./branding-edit-drawer";

export function BrandingCard({ tenant }: { tenant: TenantRow }) {
  const [listed, setListed] = useState(tenant.isPubliclyListed);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  // Resync local state when the RSC re-renders with a fresh tenant prop
  // (e.g. after revalidatePath from any sibling action).
  useEffect(() => {
    setListed(tenant.isPubliclyListed);
  }, [tenant.isPubliclyListed]);

  const onToggle = (next: boolean) => {
    setError(null);
    setListed(next);
    startTransition(async () => {
      try {
        await togglePublicListing(tenant.id, next);
      } catch (e) {
        setListed(!next);
        setError(e instanceof Error ? e.message : "Failed to update");
      }
    });
  };

  return (
    <>
      <section className="bg-paper rounded-[10px] border border-rule p-5">
        <header className="flex items-start justify-between mb-4">
          <h2 className="font-serif text-lg font-semibold">Branding</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-ink-dim hover:text-ink underline"
          >
            Edit
          </button>
        </header>

        <div className="flex items-center gap-4">
          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} alt="" className="w-14 h-14 rounded-md object-cover border border-rule" />
          ) : (
            <Crest tenant={{ id: tenant.id, accent: tenant.accent, short: tenant.short }} size={56} />
          )}
          <div>
            <div className="font-serif text-base font-semibold">{tenant.name}</div>
            <div className="text-sm text-ink-dim">{tenant.short} · {tenant.accent}</div>
            {tenant.motto ? <div className="text-xs text-ink-dim italic mt-0.5">{tenant.motto}</div> : null}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-rule flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Publicly listed</div>
            <div className="text-xs text-ink-dim mt-0.5">
              When on, this tenant appears on the public school picker at uniformorder.online.
            </div>
            {error ? <div className="text-xs text-alert mt-1">{error}</div> : null}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={listed}
            disabled={pending}
            onClick={() => onToggle(!listed)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              listed ? "bg-navy-deep" : "bg-rule"
            } ${pending ? "opacity-60" : ""}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                listed ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {editing ? (
        <BrandingEditDrawer tenant={tenant} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check-types:web`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform/tenants/[id]/cards/branding-card.tsx
git commit -m "$(cat <<'EOF'
feat: wire Edit button on BrandingCard to open drawer

Header gains an Edit link that opens BrandingEditDrawer. Public-listing
toggle stays inline on the card — common operation, low blast radius,
not worth the drawer round-trip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Manual smoke test against dev server

This is the gate before merging the PR. Repo has no automated tests; this list covers the spec's §6 testing section plus the upload race fix.

**Files:** none (verification only).

- [ ] **Step 1: Start dev server**

Run: `pnpm dev:web`
Open `http://localhost:3000`.

- [ ] **Step 2: Sign in as a platform admin**

Use a Neon Auth identity whose email is in `PLATFORM_ADMIN_EMAILS`. If the env var isn't set locally, set it and restart: see `apps/web/.env.local`.

- [ ] **Step 3: Open `/platform/tenants/nsbh`**

Confirm the Branding card now shows an `Edit` link in its header. Click it.

- [ ] **Step 4: Smoke-test each editable field**

Run through each scenario; expected behaviour after each Save is in parens.

  1. **Accent preset:** click a non-NSBH preset → preview header + motto colour update → Save → drawer closes → navigate to `/nsbh` → header accent matches the new value.
  2. **Custom hex:** type `#123456` → preview updates → Save → `/nsbh` header matches; refresh `/platform/tenants/nsbh` and confirm card subtitle reads the new hex.
  3. **Logo upload:** click Upload, pick a small PNG → preview header swaps from Crest to image → Save → `/nsbh` header crest replaced by image.
  4. **Logo remove:** open drawer again → click Remove → preview reverts to Crest → Save → `/nsbh` reverts to Crest.
  5. **Motto edit:** type a new motto → preview shows it under the header in the new accent colour → Save → confirm motto persists on the Branding card.
  6. **Empty motto:** clear the field → Save → motto disappears from card and any place it renders.
  7. **Invalid hex:** type `#zzz` → Save → inline error above footer reads something containing "accent" → no DB write (refresh card to confirm).
  8. **Motto > 200 chars:** paste 250 chars → the input's `maxLength={200}` truncates entry; if you bypass it via DevTools and Save, expect inline "motto: …" error.
  9. **Upload race:** click Upload, pick a 2MB image, immediately mash Save → Save button shows "Uploading…" and is disabled → once upload resolves, Save re-enables → click Save → DB stores the new URL (not the old one).
  10. **No-op save:** open drawer, change nothing, click Save → drawer closes (no DB roundtrip, no PostHog event).

- [ ] **Step 5: Verify PostHog event**

In the PostHog dashboard, confirm `platform_branding_edited` events landed with `tenantId: "nsbh"` and a sensible `changedFields` array per save in step 4. Skip if `POSTHOG_KEY` isn't set locally — production smoke covers it.

- [ ] **Step 6: Verify `revalidatePath` actually flushes**

**Precondition:** the tenant must be `platformApprovalStatus = 'approved'` — the action only revalidates `/${id}` (parent-shop layout) for approved tenants. If `nsbh` is still `pending` or `rejected` locally, skip this step (the parent shop wouldn't be reachable anyway). Check with: `psql $DATABASE_URL -c "select id, platform_approval_status from tenants where id='nsbh'"`.

After a Save in step 4, `/nsbh` should reflect the change without a manual refresh of any cache layer (the action calls `revalidatePath('/${id}', 'layout')`). If the parent shop still shows the old accent, that's a regression — investigate before merging.

- [ ] **Step 7: Type-check + final commit if any fixes**

Run: `pnpm check-types:web`
Expected: PASS. If smoke testing surfaced fixes, commit them now.

---

## Self-review summary

**Spec coverage:**
- §1 goal — covered by Tasks 5–7 (server action + drawer + card wiring).
- §2.1 entry point — Task 7.
- §2.2 drawer layout — Task 6.
- §2.3 PostHog event — Task 5.
- §2.4 upload race fix — Task 6 (`isUploading`) + Task 8 step 4.9.
- §3.1 file map — every row maps to a task above.
- §3.2 sibling action / why not reuse — Task 5 implements the new action; existing `updateTenantBranding` untouched.
- §3.3 schema — Task 2.
- §4 data flow — Tasks 5–7 in combination.
- §5 error handling — Task 6 (error state, isUploading guard, Cancel/Save) + Task 5 (`Tenant not found`).
- §6 testing — Task 8.
- §7 open questions — out of scope, no task needed.

**Known divergences from spec (deferred — see Out-of-plan follow-ups):**
- §2.2 footer "success closes drawer **and toasts**" — drawer closes silently; no toast primitive in repo yet.
- Drawer a11y — Esc-to-close, body-scroll-lock, and `aria-modal="true"` are wired in Task 6; full focus trap deferred.

**Placeholder scan:** none — every step contains the actual code or command.

**Type consistency:** `editTenantBranding` signature `(id, input, changedFields)` matches the call site in `BrandingEditDrawer.save()`. `brandingEditSchema` field names match what the drawer ships and what the action `.set()` writes. `AccentPicker` props (`value`, `onChange`) match wizard step-2 refactor. `BrandingPreview` prop names (`tenantName`, `short`, `accent`, `logoUrl`, `motto`) match the drawer's call site.

---

## Out-of-plan follow-ups

- **Success toast on save** — spec §2.2 mentions toasting on success, but the codebase has no toast primitive yet (`grep -r "toast\|sonner\|addToast" apps/web/src` is empty). Drawer just closes silently on success. Wire `@heroui/react`'s toast (or whatever the team picks) in a follow-up PR; closing the drawer is sufficient feedback for now.
- Wizard step-2 right-rail preview (parent spec §7.3 step 2 mentions a preview that the current implementation doesn't render). `BrandingPreview` is now reusable so that's a tiny follow-up PR; not in scope here.
- Audit log — parent spec already defers this to "second platform admin joins". No task.
- Drawer focus trap — `aria-modal` + Esc + body-scroll-lock are wired, but no `focus-trap-react`-style trap. Acceptable for an admin-only tool; revisit if non-admin surfaces adopt the same drawer.
