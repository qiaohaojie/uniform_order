import { NextRequest, NextResponse } from "next/server";
import { getOrderById, updateOrderStatus } from "@/db/queries";

const ORDER_STATUSES = ["new", "packing", "ready", "collected"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function isOrderStatus(status: unknown): status is OrderStatus {
  return typeof status === "string" && ORDER_STATUSES.includes(status as OrderStatus);
}

// GET /api/orders/:orderId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  try {
    const order = await getOrderById(orderId);
    if (!order || (tenantId && order.tenantId !== tenantId)) {
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
    const { status, tenantId } = await req.json();
    if (!isOrderStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const order = await getOrderById(orderId);
    if (!order || (tenantId && order.tenantId !== tenantId)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await updateOrderStatus(orderId, status);
    if (updated.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/orders/[orderId] error:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
