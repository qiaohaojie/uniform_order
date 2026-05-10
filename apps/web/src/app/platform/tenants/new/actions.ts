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
import { serverCapture } from "@/lib/analytics/server";
import type { ZodSchema } from "zod";

async function requirePlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}

function parseInput<T>(schema: ZodSchema<T>, input: unknown):
  | { ok: true; data: T }
  | { ok: false; error: string } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path.join(".");
  return { ok: false, error: path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input") };
}

export async function createTenantDraft(input: unknown) {
  const user = await requirePlatformAdmin();
  const parsed = parseInput(step1Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const existing = await db.query.tenants.findFirst({ where: eq(tenants.id, parsed.data.id) });
  if (existing) {
    return { ok: false as const, error: `Slug "${parsed.data.id}" is already taken.` };
  }

  await db.insert(tenants).values({
    id: parsed.data.id,
    name: parsed.data.name,
    short: parsed.data.short,
    motto: parsed.data.motto ?? null,
    address: parsed.data.address ?? null,
    platformApprovalStatus: "pending",
    isPubliclyListed: false,
  });

  revalidatePath("/platform/tenants");
  await serverCapture(user.email, "platform_tenant_created", {
    tenantId: parsed.data.id,
    name: parsed.data.name,
  });
  return { ok: true as const, id: parsed.data.id };
}

export async function updateTenantBranding(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = parseInput(step2Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [updated] = await db
    .update(tenants)
    .set({
      logoUrl: parsed.data.logoUrl,
      accent: parsed.data.accent,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning({ id: tenants.id });

  if (!updated) return { ok: false as const, error: "Tenant not found" };

  revalidatePath(`/platform/tenants/${id}`);
  revalidatePath(`/${id}`, "layout");
  return { ok: true as const };
}

export async function updateTenantOperator(id: string, input: unknown) {
  await requirePlatformAdmin();
  const parsed = parseInput(step4Schema, input);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const [updated] = await db
    .update(tenants)
    .set({
      shopEmail: parsed.data.shopEmail,
      shopHours: parsed.data.shopHours ?? null,
      collectionInstructions: parsed.data.collectionInstructions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning({ id: tenants.id });

  if (!updated) return { ok: false as const, error: "Tenant not found" };

  revalidatePath(`/platform/tenants/${id}`);
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
    await serverCapture(user.email, "platform_tenant_stripe_created", {
      tenantId: id,
      accountId: acctId,
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
    await serverCapture(user.email, "platform_tenant_catalog_cloned", {
      srcTenantId,
      dstTenantId,
      copied: result.copied,
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
  await serverCapture(user.email, "platform_tenant_went_live", {
    tenantId: id,
    publiclyListed: hasCatalog,
    hasCatalog,
  });
  return {
    ok: true as const,
    publiclyListed: hasCatalog,
    note: hasCatalog ? null : "Approved as Hidden — add catalog items, then enable public listing from the tenant detail page.",
  };
}
