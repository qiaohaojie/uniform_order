import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { OrdersPageClient } from "./orders-page-client";

export default async function AdminOrdersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  return <OrdersPageClient tenantId={tid} tenant={tenant} />;
}
