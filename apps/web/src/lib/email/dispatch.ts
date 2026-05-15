import { render } from "@react-email/render";
import React from "react";
import { db } from "@/db";
import { orderNotificationEvents, orders } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "./client";

export type NotificationType = "ready" | "hold" | "refund";

// Keys are limited to the enum values, so the SQL path is one of a fixed,
// hardcoded set — no user input flows into the SQL string.
const EMAILS_SENT_PATH: Record<NotificationType, string> = {
  ready: "{ready}",
  hold: "{hold}",
  refund: "{refund}",
};

export type EnqueueArgs = {
  orderId: string;
  tenantId: string;
  type: NotificationType;
  recipientEmail: string;
  idempotencyKey: string;
  triggeredBy: "staff_action" | "webhook" | "system";
  triggeredByUserId?: string | null;
  subject: string;
  reactBody: React.ReactElement;
  metadata?: Record<string, unknown>;
};

export type EnqueueResult = { eventId: string; status: "sent" | "failed" | "skipped" };

export async function enqueueNotification(args: EnqueueArgs): Promise<EnqueueResult> {
  let inserted: { id: string } | null = null;
  try {
    const [row] = await db
      .insert(orderNotificationEvents)
      .values({
        orderId: args.orderId,
        tenantId: args.tenantId,
        type: args.type,
        status: "queued",
        recipientEmail: args.recipientEmail,
        idempotencyKey: args.idempotencyKey,
        triggeredBy: args.triggeredBy,
        triggeredByUserId: args.triggeredByUserId ?? null,
        metadataJson: args.metadata ?? {},
      })
      .returning({ id: orderNotificationEvents.id });
    inserted = row;
  } catch (err) {
    // ONLY treat Postgres unique-violation (SQLSTATE 23505) as "already enqueued".
    // Any other failure must propagate so the caller sees a real error.
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return { eventId: "", status: "skipped" };
    }
    throw err;
  }

  if (!inserted) {
    return { eventId: "", status: "failed" };
  }

  const path = EMAILS_SENT_PATH[args.type];

  try {
    const html = await render(args.reactBody);
    const text = await render(args.reactBody, { plainText: true });
    const result = await sendEmail({
      to: args.recipientEmail,
      subject: args.subject,
      html,
      text,
    });
    await db
      .update(orderNotificationEvents)
      .set({
        status: "sent",
        sentAt: new Date(),
        providerMessageId: result?.id ?? null,
      })
      .where(eq(orderNotificationEvents.id, inserted.id));

    await db
      .update(orders)
      .set({
        emailsSent: sql`jsonb_set(
          coalesce(${orders.emailsSent}, '{}'::jsonb),
          ${path}::text[],
          to_jsonb('sent'::text),
          true
        )`,
      })
      .where(eq(orders.id, args.orderId));

    return { eventId: inserted.id, status: "sent" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await db
      .update(orderNotificationEvents)
      .set({ status: "failed", failedAt: new Date(), failureReason: reason })
      .where(eq(orderNotificationEvents.id, inserted.id));
    await db
      .update(orders)
      .set({
        emailsSent: sql`jsonb_set(
          coalesce(${orders.emailsSent}, '{}'::jsonb),
          ${path}::text[],
          to_jsonb('failed'::text),
          true
        )`,
      })
      .where(eq(orders.id, args.orderId));
    return { eventId: inserted.id, status: "failed" };
  }
}
