"use server";
import { db } from "@/db";
import { tenants, catalogItems } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { step1Schema, step2Schema, step4Schema } from "@/lib/platform/schema";
import { getStripe } from "@/lib/stripe";
import { updateTenantStripe } from "@/db/queries";
import { cloneCatalogFromTenantUnsafe, type CloneResult } from "@/lib/platform/clone-catalog";
import { logAuditEvent } from "@/lib/audit/log";
import { requirePlatformAdmin, parseInput } from "@/lib/platform/action-helpers";

export async function createTenantDraft(input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(step1Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  try {
    await db.insert(tenants).values({
      id: parsed.data.id,
      name: parsed.data.name,
      short: parsed.data.short,
      motto: parsed.data.motto ?? null,
      address: parsed.data.address ?? null,
      platformApprovalStatus: "pending",
      isPubliclyListed: false,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
      return { ok: false as const, error: `Slug "${parsed.data.id}" is already taken.` };
    }
    throw e;
  }

  revalidatePath("/platform/tenants");
  await logAuditEvent({
    tenantId: parsed.data.id,
    actorEmail: user.email,
    actorRole: "platform_admin",
    action: "tenant.draft_created",
    targetType: "tenant",
    targetId: parsed.data.id,
    payload: { name: parsed.data.name },
  });
  return { ok: true as const, id: parsed.data.id };
}

export async function updateTenantBranding(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(step2Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [existing] = await db
    .select({ logoUrl: tenants.logoUrl, accent: tenants.accent })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Tenant not found" };

  const changedFields: string[] = [];
  if (existing.logoUrl !== parsed.data.logoUrl) changedFields.push("logoUrl");
  if (existing.accent !== parsed.data.accent) changedFields.push("accent");

  if (changedFields.length === 0) {
    return { ok: true as const };
  }

  const [updated] = await db
    .update(tenants)
    .set({
      logoUrl: parsed.data.logoUrl,
      accent: parsed.data.accent,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning({ id: tenants.id, status: tenants.platformApprovalStatus });

  if (!updated) return { ok: false as const, error: "Tenant not found" };

  revalidatePath(`/platform/tenants/${id}`);
  if (updated.status === "approved") revalidatePath(`/${id}`, "layout");

  await logAuditEvent({
    tenantId: id,
    actorEmail: user.email,
    actorRole: "platform_admin",
    action: "tenant.branding_updated",
    targetType: "tenant",
    targetId: id,
    payload: { changedFields },
  });

  return { ok: true as const };
}

export async function updateTenantOperator(id: string, input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(step4Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [existing] = await db
    .select({
      shopEmail: tenants.shopEmail,
      shopHours: tenants.shopHours,
      collectionInstructions: tenants.collectionInstructions,
    })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Tenant not found" };

  const previousEmail = existing.shopEmail ?? null;
  const nextShopHours = parsed.data.shopHours ?? null;
  const nextCollectionInstructions = parsed.data.collectionInstructions ?? null;

  const changedFields: string[] = [];
  if (previousEmail !== parsed.data.shopEmail) changedFields.push("shopEmail");
  if ((existing.shopHours ?? null) !== nextShopHours) changedFields.push("shopHours");
  if ((existing.collectionInstructions ?? null) !== nextCollectionInstructions)
    changedFields.push("collectionInstructions");

  if (changedFields.length === 0) {
    return { ok: true as const, noop: true as const };
  }

  const [updated] = await db
    .update(tenants)
    .set({
      shopEmail: parsed.data.shopEmail,
      shopHours: nextShopHours,
      collectionInstructions: nextCollectionInstructions,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning({ id: tenants.id });

  if (!updated) return { ok: false as const, error: "Tenant not found" };

  revalidatePath(`/platform/tenants/${id}`);

  await logAuditEvent({
    tenantId: id,
    actorEmail: user.email,
    actorRole: "platform_admin",
    action: "tenant.operator_updated",
    targetType: "tenant",
    targetId: id,
    payload: { previousEmail, newEmail: parsed.data.shopEmail, changedFields },
  });

  return { ok: true as const };
}

export async function createStripeStandardForTenant(id: string) {
  const user = await requirePlatformAdmin();

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";

  let acctId = tenant.stripeAccountId;
  let created = false;
  if (!acctId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: tenant.shopEmail ?? undefined,
      business_profile: {
        name: tenant.name,
        url: `${appUrl}/${tenant.id}`,
      },
      metadata: { tenantId: tenant.id },
    });
    acctId = account.id;
    created = true;
    await updateTenantStripe(id, {
      stripeAccountId: acctId,
      stripePayoutsEnabled: false,
      stripeChargesEnabled: false,
    });
  }

  const link = await stripe.accountLinks.create({
    account: acctId,
    refresh_url: `${appUrl}/platform/tenants/${id}?stripe_refresh=1`,
    return_url: `${appUrl}/platform/tenants/${id}?stripe_return=1`,
    type: "account_onboarding",
  });

  revalidatePath(`/platform/tenants/${id}`);
  if (created) {
    await logAuditEvent({
      tenantId: id,
      actorEmail: user.email,
      actorRole: "platform_admin",
      action: "tenant.stripe_account_linked",
      targetType: "tenant",
      targetId: id,
      payload: { stripeAccountId: acctId },
    });
  }
  return { ok: true as const, accountId: acctId, onboardingUrl: link.url };
}

export async function listCloneSources(excludeId: string) {
  await requirePlatformAdmin();
  const rows = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.platformApprovalStatus, "approved"));
  return rows.filter((r) => r.id !== excludeId);
}

export async function cloneCatalogFromTenant(
  srcTenantId: string,
  dstTenantId: string,
): Promise<CloneResult> {
  const user = await requirePlatformAdmin();
  const result = await cloneCatalogFromTenantUnsafe(srcTenantId, dstTenantId);
  if (result.ok) {
    revalidatePath(`/platform/tenants/${dstTenantId}`);
    await logAuditEvent({
      tenantId: dstTenantId,
      actorEmail: user.email,
      actorRole: "platform_admin",
      action: "tenant.catalog_cloned",
      targetType: "tenant",
      targetId: dstTenantId,
      payload: { sourceTenantId: srcTenantId, itemCount: result.copied },
    });
  }
  return result;
}

export async function finalizeTenantGoLive(id: string) {
  const user = await requirePlatformAdmin();

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const reasons: string[] = [];
  if (!tenant.shopEmail) reasons.push("Shop email is required");
  if (!tenant.stripeAccountId) reasons.push("Stripe account not created");
  if (!tenant.stripeChargesEnabled) reasons.push("Stripe charges not yet enabled");

  if (reasons.length > 0) {
    return { ok: false as const, error: reasons.join("; ") };
  }

  const [countRow] = await db
    .select({ n: count() })
    .from(catalogItems)
    .where(eq(catalogItems.tenantId, id));
  const hasCatalog = Number(countRow?.n ?? 0) > 0;

  const previousStatus = tenant.platformApprovalStatus ?? null;

  await db
    .update(tenants)
    .set({
      platformApprovalStatus: "approved",
      isPubliclyListed: hasCatalog,
      platformApprovedAt: new Date(),
      platformApprovedBy: user.email,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath("/platform/tenants");
  revalidatePath(`/${id}`, "layout");
  await logAuditEvent({
    tenantId: id,
    actorEmail: user.email,
    actorRole: "platform_admin",
    action: "tenant.went_live",
    targetType: "tenant",
    targetId: id,
    payload: { previousStatus, publiclyListed: hasCatalog, hasCatalog },
  });
  return {
    ok: true as const,
    publiclyListed: hasCatalog,
    note: hasCatalog ? null : "Approved as Hidden — add catalog items, then enable public listing from the tenant detail page.",
  };
}
