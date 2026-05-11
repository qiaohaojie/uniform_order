"use server";
import { db } from "@/db";
import { tenants, tenantLegalVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePlatformAdmin, parseInput } from "@/lib/platform/action-helpers";
import { brandingEditSchema, tenantLegalSchema } from "@/lib/platform/schema";
import { serverCapture } from "@/lib/analytics/server";
import { getTenantLegalVersion, getMaxLegalVersionForTenant } from "@/db/queries";
import { isUniqueConstraintError } from "@/lib/db/unique-constraint";

export async function togglePublicListing(id: string, on: boolean) {
  await requirePlatformAdmin();
  await db.update(tenants).set({ isPubliclyListed: on, updatedAt: new Date() }).where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function disableTenant(id: string) {
  await requirePlatformAdmin();
  await db
    .update(tenants)
    .set({ platformApprovalStatus: "rejected", isPubliclyListed: false, updatedAt: new Date() })
    .where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function reEnableTenant(id: string) {
  await requirePlatformAdmin();
  // Re-enable restores approval but leaves isPubliclyListed=false. Operator
  // must explicitly toggle public listing back on so a parent isn't surprised
  // by the tenant reappearing in the marketplace before catalog/pricing is
  // reconfirmed.
  await db
    .update(tenants)
    .set({ platformApprovalStatus: "approved", updatedAt: new Date() })
    .where(eq(tenants.id, id));
  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  return { ok: true as const };
}

export async function resyncStripeStatus(id: string) {
  await requirePlatformAdmin();
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant?.stripeAccountId) return { ok: false as const, error: "No Stripe account" };

  const { getStripe } = await import("@/lib/stripe");
  const { updateTenantStripe } = await import("@/db/queries");
  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(tenant.stripeAccountId);

  await updateTenantStripe(id, {
    stripeAccountId: tenant.stripeAccountId,
    stripeChargesEnabled: !!acct.charges_enabled,
    stripePayoutsEnabled: !!acct.payouts_enabled,
  });
  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true as const };
}

export async function editTenantBranding(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(brandingEditSchema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [existing] = await db
    .select({
      logoUrl: tenants.logoUrl,
      accent: tenants.accent,
      motto: tenants.motto,
      status: tenants.platformApprovalStatus,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Tenant not found" };

  const nextMotto = parsed.data.motto ?? null;
  const changedFields: string[] = [];
  if (parsed.data.logoUrl !== existing.logoUrl) changedFields.push("logoUrl");
  if (parsed.data.accent.toLowerCase() !== existing.accent.toLowerCase()) {
    changedFields.push("accent");
  }
  if ((nextMotto ?? "") !== (existing.motto ?? "")) changedFields.push("motto");

  if (changedFields.length === 0) return { ok: true as const };

  await db
    .update(tenants)
    .set({
      logoUrl: parsed.data.logoUrl,
      accent: parsed.data.accent,
      motto: nextMotto,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  await serverCapture(user.email, "platform_branding_edited", {
    tenantId: id,
    changedFields,
  });

  revalidatePath(`/platform/tenants/${id}`);
  if (existing.status === "approved") revalidatePath(`/${id}`, "layout");

  return { ok: true as const };
}

export async function editTenantLegal(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(tenantLegalSchema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [tenant] = await db
    .select({
      id: tenants.id,
      currentLegalVersionId: tenants.currentLegalVersionId,
      platformApprovalStatus: tenants.platformApprovalStatus,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const current = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;
  const next = parsed.data;

  // Diff against current to short-circuit no-op saves (mirrors editTenantBranding).
  const sameMode = current?.policyMode === next.mode;
  const sameContent =
    sameMode &&
    (next.mode === "text"
      ? current?.policyText === next.policyText
      : current?.policyUrl === next.policyUrl);
  const sameDeclarant =
    current?.declarantName === next.declarantName &&
    current?.declarantRole === next.declarantRole;

  if (current && sameContent && sameDeclarant) {
    return { ok: true as const };
  }

  const changedFields: string[] = [];
  if (!current) changedFields.push("initial");
  if (!sameMode) changedFields.push("mode");
  if (!sameContent) changedFields.push("policy");
  if (!sameDeclarant) changedFields.push("declarant");

  // Insert new version + flip tenants pointer atomically in one db.batch
  // round-trip (project rule: never db.transaction; neon-http doesn't support
  // it). Generate the row id client-side so both statements can reference it
  // without an interleaved RETURNING. Same pattern db/queries.ts:600/651/700
  // uses for catalog INSERT-then-related-writes.
  //
  // Retry loop guards the (tenant_id, version) unique constraint — narrows
  // the SELECT-MAX/INSERT race but doesn't eliminate it (see queries.ts
  // race-window note above).
  let inserted: { id: string; version: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextVersion = (await getMaxLegalVersionForTenant(id)) + 1;
    const newId = randomUUID();
    try {
      await db.batch([
        db.insert(tenantLegalVersions).values({
          id: newId,
          tenantId: id,
          version: nextVersion,
          policyMode: next.mode,
          policyText: next.mode === "text" ? next.policyText : null,
          policyUrl: next.mode === "url" ? next.policyUrl : null,
          aclAcknowledged: next.aclAcknowledged,
          sellerOfRecordAcknowledged: next.sellerOfRecordAcknowledged,
          declarantName: next.declarantName,
          declarantRole: next.declarantRole,
          enteredByUserId: user.id,
          enteredByEmail: user.email,
        }),
        db
          .update(tenants)
          .set({ currentLegalVersionId: newId, updatedAt: new Date() })
          .where(eq(tenants.id, id)),
      ]);
      inserted = { id: newId, version: nextVersion };
      break;
    } catch (e) {
      if (isUniqueConstraintError(e, "tenant_legal_versions_tenant_version_unique")) {
        if (attempt === 2) throw e;
        continue;
      }
      throw e;
    }
  }
  if (!inserted) {
    return { ok: false as const, error: "Could not allocate a version number; please retry" };
  }

  await serverCapture(user.email, "tenant_legal_edited", {
    tenantId: id,
    mode: next.mode,
    version: inserted.version,
    changedFields,
  });

  revalidatePath(`/platform/tenants/${id}`);
  // Mirror editTenantBranding (actions.ts:108): only cascade the parent-shop
  // layout cache when the tenant is actually approved.
  if (tenant.platformApprovalStatus === "approved") {
    revalidatePath(`/${id}`, "layout");
  }

  return { ok: true as const, version: inserted.version };
}
