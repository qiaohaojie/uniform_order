import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getTenant, updateTenantStripe } from "@/db/queries";

// POST /api/stripe/connect — start Stripe Connect onboarding
export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 });
    }

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Create a new connected account if one doesn't exist
    let accountId = tenant.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        business_profile: {
          name: tenant.name,
          url: `${appUrl}/${tenantId}`,
        },
        metadata: { tenantId },
      });
      accountId = account.id;

      // Save the account ID to the tenant
      await updateTenantStripe(tenantId, {
        stripeAccountId: accountId,
        stripePayoutsEnabled: false,
        stripeChargesEnabled: false,
      });
    }

    // Create an account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/admin/${tenantId}/settings?stripe=refresh`,
      return_url: `${appUrl}/admin/${tenantId}/settings?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url, accountId });
  } catch (err) {
    console.error("POST /api/stripe/connect error:", err);
    return NextResponse.json(
      { error: "Failed to start Stripe Connect onboarding" },
      { status: 500 }
    );
  }
}

// GET /api/stripe/connect?tenantId=nsbh — check connect status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    const tenant = await getTenant(tenantId);
    if (!tenant || !tenant.stripeAccountId) {
      return NextResponse.json({ connected: false });
    }

    const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
    const payoutsEnabled = account.payouts_enabled ?? false;
    const chargesEnabled = account.charges_enabled ?? false;

    // Update DB with latest status
    await updateTenantStripe(tenantId, {
      stripeAccountId: tenant.stripeAccountId,
      stripePayoutsEnabled: payoutsEnabled,
      stripeChargesEnabled: chargesEnabled,
    });

    return NextResponse.json({
      connected: true,
      accountId: tenant.stripeAccountId,
      payoutsEnabled,
      chargesEnabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    console.error("GET /api/stripe/connect error:", err);
    return NextResponse.json({ error: "Failed to check connect status" }, { status: 500 });
  }
}
