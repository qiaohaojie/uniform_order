import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, orderLines } from "@/db";
import { getTenant, getTenantSettings, getOrdersForBoard, toTenantBrand } from "@/db/queries";
import { OrdersPageClient } from "./orders-page-client";

export default async function AdminOrdersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  const [orders, settings] = await Promise.all([
    getOrdersForBoard(tenantRecord.id),
    getTenantSettings(tenantRecord.id),
  ]);

  // Pick slips only print for orders still in to_prepare — load their lines.
  const toPrepareIds = orders
    .filter((o) => o.fulfilmentStatus === "to_prepare")
    .map((o) => o.id);
  const linesRows =
    toPrepareIds.length === 0
      ? []
      : await db
          .select()
          .from(orderLines)
          .where(inArray(orderLines.orderId, toPrepareIds));
  const linesByOrder: Record<string, typeof linesRows> = {};
  for (const line of linesRows) {
    (linesByOrder[line.orderId] ??= []).push(line);
  }

  return (
    <OrdersPageClient
      tenantId={tenantRecord.id}
      tenant={tenant}
      orders={orders}
      workflowMode={settings.workflowMode}
      linesByOrder={linesByOrder}
    />
  );
}
