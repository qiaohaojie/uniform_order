import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs"; // required: edge runtime can't read raw body for Stripe sig

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("missing signature", { status: 400 });

  const rawBody = await req.text(); // MUST be raw text, not req.json()
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe signature verification failed:", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  // Filter: only handle payment_intent.succeeded
  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const pi = event.data.object as Stripe.PaymentIntent;

  // Atomic transition; .returning() gives us orderId only when we actually flipped the row
  // IMPORTANT: Only transition from 'pending_payment' to 'new'
  const flipped = await db
    .update(orders)
    .set({ status: "new" })
    .where(and(eq(orders.stripePaymentIntentId, pi.id), eq(orders.status, "pending_payment")))
    .returning({ id: orders.id });

  if (flipped.length === 1) {
    try {
      await sendOrderConfirmationEmail(flipped[0].id);
    } catch (err) {
      console.error("Confirmation email failed for order", flipped[0].id, err);
    }
  } else {
    console.info("stripe webhook: no pending_payment order matched", pi.id);
  }

  return NextResponse.json({ received: true });
}
