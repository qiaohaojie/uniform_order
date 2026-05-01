import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/db/queries";

// GET /api/orders/:orderId
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err) {
    console.error("GET /api/orders/[orderId] error:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

// PATCH /api/orders/:orderId — update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  try {
    const { status } = await req.json();
    if (!["new", "packing", "ready", "collected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await updateOrderStatus(orderId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/orders/[orderId] error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
