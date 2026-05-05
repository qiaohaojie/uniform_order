import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTenant } from "@/db/queries";

// POST /api/stripe/payment-intent
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { tenantId, amount, currency = "aud", metadata } = await req.json();

    if (!tenantId || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "tenantId and amount required" },
        { status: 400 }
      );
    }

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (!tenant.stripeAccountId) {
      return NextResponse.json(
        { error: "Tenant has no connected Stripe account" },
        { status: 409 }
      );
    }
    if (tenant.stripeChargesEnabled !== true) {
      return NextResponse.json(
        { error: "Tenant Stripe account is not ready to accept charges" },
        { status: 409 }
      );
    }

    const amountInCents = Math.round(amountNumber * 100);
    const feeBps = Number(process.env.STRIPE_APPLICATION_FEE_BPS ?? 0);
    let applicationFeeAmount: number | undefined;
    if (Number.isFinite(feeBps) && feeBps > 0) {
      const fee = Math.floor((amountInCents * feeBps) / 10_000);
      if (fee > 0 && fee < amountInCents) {
        applicationFeeAmount = fee;
      }
    }

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency,
      metadata: {
        tenantId,
        stripeAccountId: tenant.stripeAccountId,
        ...metadata,
      },
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: tenant.stripeAccountId },
      on_behalf_of: tenant.stripeAccountId,
      ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
    };

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("POST /api/stripe/payment-intent error:", err);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
