import { NextRequest, NextResponse } from "next/server";
import { db, orders, orderLines } from "@/db";
import { getOrdersByTenant } from "@/db/queries";
import { nanoid } from "nanoid";

// GET /api/orders?tenantId=imhs&email=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const email = searchParams.get("email");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    const rows = await getOrdersByTenant(tenantId);
    // Optionally filter by parent email
    const filtered = email
      ? rows.filter((o) => o.parentEmail === email)
      : rows;
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST /api/orders — place a new order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId,
      parentName,
      parentEmail,
      parentMobile,
      studentName,
      studentYear,
      studentRoll,
      delivery,
      deliveryFee,
      subtotal,
      gst,
      total,
      stripePaymentIntentId,
      lines,
    } = body;

    // Generate order ID: TENANT-XXXXX
    const prefix = tenantId.toUpperCase();
    const num = Math.floor(10000 + Math.random() * 90000);
    const orderId = `${prefix}-${num}`;

    await db.insert(orders).values({
      id: orderId,
      tenantId,
      parentName,
      parentEmail,
      parentMobile,
      studentName,
      studentYear,
      studentRoll,
      delivery: delivery ?? "pickup",
      deliveryFee: String(deliveryFee ?? 0),
      subtotal: String(subtotal),
      gst: String(gst),
      total: String(total),
      stripePaymentIntentId,
      stripeRef: stripePaymentIntentId,
      status: "new",
    });

    if (lines && Array.isArray(lines)) {
      for (const line of lines) {
        await db.insert(orderLines).values({
          orderId,
          itemId: line.itemId,
          itemName: line.itemName,
          variantLabel: line.variantLabel,
          qty: line.qty,
          unitPrice: String(line.unitPrice),
          lineTotal: String(line.lineTotal),
        });
      }
    }

    return NextResponse.json({ orderId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
