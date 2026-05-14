"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, orders, orderLines, tenants } from "@/db";
import {
  getSessionUser,
  isPlatformAdminEmail,
  isTenantOperatorEmail,
} from "@/lib/auth/authorization";
import {
  buildExportFilename,
  CSV_HEADERS,
  EXPORT_STATUS_OPTIONS,
  formatExportDate,
  formatExportTotal,
  formatItemsSummary,
  serializeCsv,
  type ExportStatusFilter,
} from "./csv";

export type ExportOrdersResult = {
  csv: string;
  filename: string;
  rowCount: number;
};

export async function exportOrdersCsv(
  tenantId: string,
  status: ExportStatusFilter
): Promise<ExportOrdersResult> {
  // Validate the status input — never trust client-supplied enums.
  if (!EXPORT_STATUS_OPTIONS.includes(status)) {
    throw new Error("Invalid status filter");
  }

  // Auth: must be a signed-in user.
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Authentication required");
  }

  // Load the tenant row so we can (a) check operator access and (b) read timezone.
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Authorization: platform admin OR this tenant's operator.
  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) {
    throw new Error("Forbidden");
  }

  // Fetch orders for the tenant, optionally filtered by status.
  const orderRows = await db
    .select({
      id: orders.id,
      status: orders.status,
      parentName: orders.parentName,
      parentEmail: orders.parentEmail,
      parentMobile: orders.parentMobile,
      studentName: orders.studentName,
      studentYear: orders.studentYear,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      status === "all"
        ? eq(orders.tenantId, tenantId)
        : and(eq(orders.tenantId, tenantId), eq(orders.status, status))
    )
    .orderBy(desc(orders.createdAt));

  // Fetch all line items for these orders in one query (avoids N+1).
  // Sort alphabetically — orderLines.id is a random UUID and can't drive a meaningful sort.
  const orderIds = orderRows.map((o) => o.id);
  const lineRows = orderIds.length
    ? await db
        .select({
          orderId: orderLines.orderId,
          itemName: orderLines.itemName,
          variantLabel: orderLines.variantLabel,
          size: orderLines.size,
          qty: orderLines.qty,
        })
        .from(orderLines)
        .where(inArray(orderLines.orderId, orderIds))
        .orderBy(asc(orderLines.itemName), asc(orderLines.variantLabel), asc(orderLines.size))
    : [];

  // Group lines by orderId, preserving the alphabetical order from the query.
  const linesByOrder = new Map<string, typeof lineRows>();
  for (const line of lineRows) {
    const bucket = linesByOrder.get(line.orderId) ?? [];
    bucket.push(line);
    linesByOrder.set(line.orderId, bucket);
  }

  // Build CSV rows in the order the headers declare.
  const tz = tenant.timezone ?? "Australia/Sydney";
  const dataRows: string[][] = orderRows.map((o) => [
    o.id,
    o.createdAt ? formatExportDate(o.createdAt, tz) : "",
    o.status,
    o.parentName,
    o.parentEmail,
    o.parentMobile,
    o.studentName,
    o.studentYear,
    formatExportTotal(o.total),
    formatItemsSummary(linesByOrder.get(o.id) ?? []),
  ]);

  const csv = serializeCsv(CSV_HEADERS, dataRows);

  // Filename uses today's date in the tenant's timezone.
  const filename = buildExportFilename(tenantId, status, new Date(), tz);

  return {
    csv,
    filename,
    rowCount: dataRows.length,
  };
}
