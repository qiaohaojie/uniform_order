"use server";
import { db } from "@/db";
import { tenants, catalogItems } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { step1Schema, step2Schema, step4Schema } from "@/lib/platform/schema";
import { getStripe } from "@/lib/stripe";
import { updateTenantStripe } from "@/db/queries";
import { cloneCatalogFromTenantUnsafe, type CloneResult } from "@/lib/platform/clone-catalog";

async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function createTenantDraft(input: unknown) {
  await requirePlatformAdmin();
  const parsed = step1Schema.parse(input);

  const existing = await db.query.tenants.findFirst({ where: eq(tenants.id, parsed.id) });
  if (existing) {
    return { ok: false as const, error: `Slug "${parsed.id}" is already taken.` };
  }

  await db.insert(tenants).values({
    id: parsed.id,
    name: parsed.name,
    short: parsed.short,
    motto: parsed.motto ?? null,
    address: parsed.address ?? null,
    platformApprovalStatus: "pending",
    isPubliclyListed: false,
  });

  revalidatePath("/platform/tenants");
  return { ok: true as const, id: parsed.id };
}

export async function updateTenantBranding(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = step2Schema.parse(input);

  await db
    .update(tenants)
    .set({
      logoUrl: parsed.logoUrl,
      accent: parsed.accent,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function updateTenantOperator(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = step4Schema.parse(input);

  await db
    .update(tenants)
    .set({
      shopEmail: parsed.shopEmail,
      shopHours: parsed.shopHours ?? null,
      collectionInstructions: parsed.collectionInstructions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id));

  revalidatePath(`/platform/tenants/${id}`);
  return { ok: true as const };
}

export async function createStripeStandardForTenant(id: string) {
  await requirePlatformAdmin();

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
  if (!tenant) return { ok: false as const, error: "Tenant not found" };

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://uniformorder.online";

  let acctId = tenant.stripeAccountId;
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
  await requirePlatformAdmin();
  const result = await cloneCatalogFromTenantUnsafe(srcTenantId, dstTenantId);
  if (result.ok) {
    revalidatePath(`/platform/tenants/${dstTenantId}`);
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
  return {
    ok: true as const,
    publiclyListed: hasCatalog,
    note: hasCatalog ? null : "Approved as Hidden — add catalog items, then enable public listing from the tenant detail page.",
  };
}
