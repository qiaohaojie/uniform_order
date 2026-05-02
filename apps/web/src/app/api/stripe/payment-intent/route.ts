import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTenant } from "@/db/queries";

// POST /api/stripe/payment-intent
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { tenantId, amount, currency = "aud", metadata } = await req.json();

    if (!tenantId || !amount) {
      return NextResponse.json(
        { error: "tenantId and amount required" },
        { status: 400 }
      );
    }

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // If tenant has a connected Stripe account, use it
    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // convert to cents
      currency,
      metadata: {
        tenantId,
        ...metadata,
      },
      automatic_payment_methods: { enabled: true },
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
