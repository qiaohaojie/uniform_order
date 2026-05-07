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
import { TENANTS, type TenantId } from "@/lib/data";
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

  const crestTenant = TENANTS[order.tenantId as TenantId];
  if (!crestTenant) notFound();

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
