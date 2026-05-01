import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { OrdersPageClient } from "./orders-page-client";

export default async function AdminOrdersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return <OrdersPageClient tenantId={tid} tenant={tenant} />;
}
