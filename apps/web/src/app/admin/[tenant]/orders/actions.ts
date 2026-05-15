"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, orders, tenants } from "@/db";
import { orderEvents } from "@/db/schema";
import {
  getSessionUser,
  isPlatformAdminEmail,
  isTenantOperatorEmail,
  requireSessionUser,
  type SessionUser,
} from "@/lib/auth/authorization";
import {
  getTenantSettings,
  type FulfilmentStatus,
  type CompletionType,
  type WorkflowMode,
} from "@/db/queries";
import {
  sendOrderReadyEmail,
  sendOrderHoldEmail,
} from "@/lib/email";
import { serverCapture } from "@/lib/analytics/server";
import {
  buildExportFilename,
  CSV_HEADERS,
  EXPORT_STATUS_OPTIONS,
  formatExportDate,
  formatExportDateTime,
  formatExportTotal,
  formatRefundedCents,
  serializeCsv,
  type ExportStatusFilter,
} from "./csv";

// ─── CSV export ──────────────────────────────────────────────────────────────

export type ExportOrdersResult = {
  csv: string;
  filename: string;
  rowCount: number;
};

export async function exportOrdersCsv(
  tenantId: string,
  status: ExportStatusFilter,
): Promise<ExportOrdersResult> {
  if (!EXPORT_STATUS_OPTIONS.includes(status)) {
    throw new Error("Invalid status filter");
  }

  const user = await getSessionUser();
  if (!user) {
    throw new Error("Authentication required");
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) {
    throw new Error("Forbidden");
  }

  const orderRows = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      parentName: orders.parentName,
      parentEmail: orders.parentEmail,
      studentName: orders.studentName,
      studentYear: orders.studentYear,
      fulfilmentMethod: orders.fulfilmentMethod,
      fulfilmentStatus: orders.fulfilmentStatus,
      paymentStatus: orders.paymentStatus,
      completionType: orders.completionType,
      subtotal: orders.subtotal,
      gst: orders.gst,
      total: orders.total,
      refundedAmountCents: orders.refundedAmountCents,
      readyAt: orders.readyAt,
      completedAt: orders.completedAt,
      pickSlipPrintedAt: orders.pickSlipPrintedAt,
    })
    .from(orders)
    .where(
      status === "all"
        ? eq(orders.tenantId, tenantId)
        : and(eq(orders.tenantId, tenantId), eq(orders.fulfilmentStatus, status)),
    )
    .orderBy(desc(orders.createdAt));

  const tz = tenant.timezone ?? "Australia/Sydney";
  const dataRows: string[][] = orderRows.map((o) => [
    o.id,
    o.createdAt ? formatExportDate(o.createdAt, tz) : "",
    o.parentName,
    o.parentEmail,
    o.studentName,
    o.studentYear,
    o.fulfilmentMethod,
    o.fulfilmentStatus,
    o.paymentStatus,
    o.completionType ?? "",
    formatExportTotal(o.subtotal),
    formatExportTotal(o.gst),
    formatExportTotal(o.total),
    formatRefundedCents(o.refundedAmountCents),
    formatExportDateTime(o.readyAt, tz),
    formatExportDateTime(o.completedAt, tz),
    formatExportDateTime(o.pickSlipPrintedAt, tz),
  ]);

  const csv = serializeCsv(CSV_HEADERS, dataRows);
  const filename = buildExportFilename(tenantId, status, new Date(), tz);

  return { csv, filename, rowCount: dataRows.length };
}

// ─── Fulfilment transitions ──────────────────────────────────────────────────

const STANDARD_ALLOWED: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  to_prepare: ["ready", "needs_attention", "completed"],
  ready: ["needs_attention", "completed"],
  needs_attention: ["ready", "completed"],
  completed: ["to_prepare"],
};

const SIMPLE_ALLOWED: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  to_prepare: ["completed"],
  ready: ["completed"],
  needs_attention: ["completed"],
  completed: ["to_prepare"],
};

function assertAllowed(
  mode: WorkflowMode,
  from: FulfilmentStatus,
  to: FulfilmentStatus,
) {
  const map = mode === "simple" ? SIMPLE_ALLOWED : STANDARD_ALLOWED;
  if (!map[from]?.includes(to)) {
    throw new Error(`Transition ${from} → ${to} not allowed in ${mode} mode`);
  }
}

async function getActor(): Promise<SessionUser> {
  const result = await requireSessionUser();
  if ("response" in result) throw new Error("Authentication required");
  return result.user;
}

async function loadContext(tenantId: string, orderId: string) {
  const user = await getActor();

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.tenantId !== tenantId) throw new Error("Order not found");

  if (order.paymentStatus === "pending") {
    throw new Error("Cannot transition an unpaid order");
  }

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");

  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) throw new Error("Forbidden");

  const settings = await getTenantSettings(tenantId);
  return { user, order, tenant, settings };
}

export async function markReady(tenantId: string, orderId: string) {
  const { user, order, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "ready");
  const fromStatus = order.fulfilmentStatus;
  const now = new Date();

  // Atomic update with optimistic-concurrency guard: only flip the row if the
  // status hasn't moved since loadContext. Two operators clicking simultaneously
  // see exactly one win the CAS, the other gets `flipped.length === 0` and
  // bails before sending a duplicate email.
  const flipped = await db
    .update(orders)
    .set({ fulfilmentStatus: "ready", readyAt: now, updatedAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.fulfilmentStatus, fromStatus)))
    .returning({ id: orders.id });
  if (flipped.length === 0) {
    throw new Error("Order status changed concurrently — please refresh");
  }

  await db.insert(orderEvents).values({
    orderId,
    tenantId,
    eventType: "status_changed",
    fromStatus,
    toStatus: "ready",
    actorId: user.id,
  });

  // Idempotency key is deterministic across retries — derived from the
  // transition itself rather than a per-call event id — so the unique index on
  // order_notification_events.idempotency_key actually dedupes a retry.
  await sendOrderReadyEmail({
    orderId,
    tenantId,
    idempotencyKey: `ready:${orderId}:${fromStatus}->ready`,
    triggeredByUserId: user.id,
  });
  await serverCapture(user.id, "order_fulfilment_transition", {
    orderId,
    tenantId,
    from: fromStatus,
    to: "ready",
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function reportIssue(
  tenantId: string,
  orderId: string,
  reason: string,
  options: { notifyParent: boolean },
) {
  if (!reason.trim()) throw new Error("Reason is required");
  const { user, order, tenant, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "needs_attention");
  const fromStatus = order.fulfilmentStatus;
  const wasReady = fromStatus === "ready";
  const now = new Date();

  const flipped = await db
    .update(orders)
    .set({ fulfilmentStatus: "needs_attention", updatedAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.fulfilmentStatus, fromStatus)))
    .returning({ id: orders.id });
  if (flipped.length === 0) {
    throw new Error("Order status changed concurrently — please refresh");
  }

  await db.insert(orderEvents).values({
    orderId,
    tenantId,
    eventType: "status_changed",
    fromStatus,
    toStatus: "needs_attention",
    actorId: user.id,
    reason,
  });

  if (wasReady || options.notifyParent) {
    await sendOrderHoldEmail({
      orderId,
      tenantId,
      tenantName: tenant.name,
      parentName: order.parentName,
      parentEmail: order.parentEmail,
      idempotencyKey: `hold:${orderId}:${fromStatus}->needs_attention`,
      triggeredByUserId: user.id,
    });
  }
  await serverCapture(user.id, "order_fulfilment_transition", {
    orderId,
    tenantId,
    from: fromStatus,
    to: "needs_attention",
    notified: wasReady || options.notifyParent,
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function resolveIssue(tenantId: string, orderId: string) {
  const { user, order, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "ready");
  const fromStatus = order.fulfilmentStatus;
  const now = new Date();

  const flipped = await db
    .update(orders)
    .set({ fulfilmentStatus: "ready", readyAt: now, updatedAt: now })
    .where(and(eq(orders.id, orderId), eq(orders.fulfilmentStatus, fromStatus)))
    .returning({ id: orders.id });
  if (flipped.length === 0) {
    throw new Error("Order status changed concurrently — please refresh");
  }

  await db.insert(orderEvents).values({
    orderId,
    tenantId,
    eventType: "status_changed",
    fromStatus,
    toStatus: "ready",
    actorId: user.id,
  });

  // Distinct idempotency key vs markReady so resolveIssue-after-markReady-after-revert
  // doesn't collide (different fromStatus path).
  await sendOrderReadyEmail({
    orderId,
    tenantId,
    idempotencyKey: `ready:${orderId}:${fromStatus}->ready`,
    triggeredByUserId: user.id,
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function markCompleted(
  tenantId: string,
  orderId: string,
  completionType: CompletionType,
) {
  const { user, order, settings } = await loadContext(tenantId, orderId);
  assertAllowed(settings.workflowMode, order.fulfilmentStatus, "completed");
  const now = new Date();
  await db.batch([
    db
      .update(orders)
      .set({
        fulfilmentStatus: "completed",
        completionType,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId)),
    db.insert(orderEvents).values({
      orderId,
      tenantId,
      eventType: "status_changed",
      fromStatus: order.fulfilmentStatus,
      toStatus: "completed",
      actorId: user.id,
      metadataJson: { completionType },
    }),
  ]);
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function reopenOrder(
  tenantId: string,
  orderId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("Reason is required");
  const { user, order, settings } = await loadContext(tenantId, orderId);
  if (order.fulfilmentStatus !== "completed") {
    throw new Error("Only completed orders can be reopened");
  }
  assertAllowed(settings.workflowMode, "completed", "to_prepare");
  const now = new Date();
  await db.batch([
    db
      .update(orders)
      .set({
        fulfilmentStatus: "to_prepare",
        completionType: null,
        completedAt: null,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId)),
    db.insert(orderEvents).values({
      orderId,
      tenantId,
      eventType: "order_reopened",
      fromStatus: "completed",
      toStatus: "to_prepare",
      actorId: user.id,
      reason,
    }),
  ]);
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function recordPickSlipPrinted(
  tenantId: string,
  orderIds: string[],
) {
  if (orderIds.length === 0) return;
  const user = await getActor();

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant not found");
  const allowed =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenant.shopEmail);
  if (!allowed) throw new Error("Forbidden");

  // Confirm every order id actually belongs to this tenant BEFORE writing —
  // otherwise an operator could mark another tenant's orders by guessing ids.
  const owned = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));
  if (owned.length !== orderIds.length) {
    throw new Error("One or more orders do not belong to this tenant");
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ pickSlipPrintedAt: now, pickSlipPrintedBy: user.id })
    .where(and(inArray(orders.id, orderIds), eq(orders.tenantId, tenantId)));

  await db.insert(orderEvents).values(
    orderIds.map((id) => ({
      orderId: id,
      tenantId,
      eventType: "pick_slip_printed" as const,
      actorId: user.id,
    })),
  );

  revalidatePath(`/admin/${tenantId}/orders`);
}
