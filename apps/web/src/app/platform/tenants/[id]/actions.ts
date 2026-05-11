"use server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, parseInput } from "@/lib/platform/action-helpers";
import { brandingEditSchema } from "@/lib/platform/schema";
import { logAuditEvent } from "@/lib/audit/log";

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

  await logAuditEvent({
    tenantId: id,
    actorEmail: user.email,
    actorRole: "platform_admin",
    action: "tenant.branding_updated",
    targetType: "tenant",
    targetId: id,
    payload: { changedFields },
  });

  revalidatePath(`/platform/tenants/${id}`);
  if (existing.status === "approved") revalidatePath(`/${id}`, "layout");

  return { ok: true as const };
}
