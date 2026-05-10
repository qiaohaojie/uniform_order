"use server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform/action-helpers";

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
