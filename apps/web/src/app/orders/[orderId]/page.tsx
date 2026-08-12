import { notFound, redirect } from "next/navigation";
import {
  getSessionUser,
  ensureParentEmailAccess,
} from "@/lib/auth/authorization";
import {
  getOrderById,
  getOrderRefunds,
  getTotalRefunded,
  getTenant,
} from "@/db/queries";
import { OrderDetailClient } from "./order-detail-client";

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;

  const user = await getSessionUser();
  if (!user) {
    redirect(
      `/auth/sign-in?callbackURL=${encodeURIComponent(`/orders/${orderId}`)}`
    );
  }

  const order = await getOrderById(orderId);
  if (!order) notFound();

  if (ensureParentEmailAccess(user, order.parentEmail)) notFound();

  const dbTenant = await getTenant(order.tenantId);
  if (!dbTenant) notFound();

  // Crest only needs id/accent/short — always build from DB so demo tenants
  // (and any non-static tenant) render without a static TENANTS lookup.
  const crestTenant = {
    id: dbTenant.id,
    accent: dbTenant.accent,
    short: dbTenant.short,
  };

  const refunds = await getOrderRefunds(orderId);
  const totalRefunded = await getTotalRefunded(orderId);

  return (
    <OrderDetailClient
      order={order}
      crestTenant={crestTenant}
      dbTenant={dbTenant}
      refunds={refunds}
      totalRefunded={totalRefunded}
    />
  );
}
