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

type OrderRow = typeof orders.$inferSelect;
type TenantRow = typeof tenants.$inferSelect;

// Owns auth + workflow assert + atomic CAS update + event insert for every
// fulfilment transition. Side effects (emails, analytics, revalidation) stay
// at the caller — they need fromStatus from the return value for deterministic
// idempotency keys.
async function executeTransition(args: {
  tenantId: string;
  orderId: string;
  to: FulfilmentStatus;
  eventType: "status_changed" | "order_reopened";
  reason?: string;
  setFields?: Partial<typeof orders.$inferInsert>;
  metadataJson?: Record<string, unknown>;
  expectedFrom?: FulfilmentStatus;
}): Promise<{
  user: SessionUser;
  order: OrderRow;
  tenant: TenantRow;
  fromStatus: FulfilmentStatus;
}> {
  const { user, order, tenant, settings } = await loadContext(args.tenantId, args.orderId);
  const fromStatus = order.fulfilmentStatus;

  if (args.expectedFrom && fromStatus !== args.expectedFrom) {
    throw new Error(`Only ${args.expectedFrom} orders can transition to ${args.to}`);
  }
  assertAllowed(settings.workflowMode, fromStatus, args.to);

  const now = new Date();
  // Optimistic-concurrency guard: only flip if the status hasn't moved since
  // loadContext. Two operators clicking simultaneously see exactly one win
  // the CAS; the loser bails before any side effects fire.
  const flipped = await db
    .update(orders)
    .set({
      ...(args.setFields ?? {}),
      fulfilmentStatus: args.to,
      updatedAt: now,
    })
    .where(and(eq(orders.id, args.orderId), eq(orders.fulfilmentStatus, fromStatus)))
    .returning({ id: orders.id });
  if (flipped.length === 0) {
    throw new Error("Order status changed concurrently — please refresh");
  }

  await db.insert(orderEvents).values({
    orderId: args.orderId,
    tenantId: args.tenantId,
    eventType: args.eventType,
    fromStatus,
    toStatus: args.to,
    actorId: user.id,
    ...(args.reason !== undefined ? { reason: args.reason } : {}),
    ...(args.metadataJson !== undefined ? { metadataJson: args.metadataJson } : {}),
  });

  return { user, order, tenant, fromStatus };
}

export async function markReady(tenantId: string, orderId: string) {
  const { user, fromStatus } = await executeTransition({
    tenantId,
    orderId,
    to: "ready",
    eventType: "status_changed",
    setFields: { readyAt: new Date() },
  });

  // Deterministic idempotency key — the unique index on
  // order_notification_events.idempotency_key dedupes retries of the same
  // transition path.
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
  const { user, order, tenant, fromStatus } = await executeTransition({
    tenantId,
    orderId,
    to: "needs_attention",
    eventType: "status_changed",
    reason,
  });
  const wasReady = fromStatus === "ready";

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
  const { user, fromStatus } = await executeTransition({
    tenantId,
    orderId,
    to: "ready",
    eventType: "status_changed",
    setFields: { readyAt: new Date() },
  });

  // Distinct fromStatus path (needs_attention->ready) keeps this key from
  // colliding with markReady's (to_prepare->ready).
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
  await executeTransition({
    tenantId,
    orderId,
    to: "completed",
    eventType: "status_changed",
    setFields: { completionType, completedAt: new Date() },
    metadataJson: { completionType },
  });
  revalidatePath(`/admin/${tenantId}/orders`);
}

export async function reopenOrder(
  tenantId: string,
  orderId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("Reason is required");
  await executeTransition({
    tenantId,
    orderId,
    to: "to_prepare",
    eventType: "order_reopened",
    reason,
    expectedFrom: "completed",
    setFields: { completionType: null, completedAt: null },
  });
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
