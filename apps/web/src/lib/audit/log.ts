import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { serverCapture } from "@/lib/analytics/server";
import type { LogAuditEventInput } from "./types";

/**
 * Append an audit row + best-effort PostHog co-emit.
 *
 * Contract:
 * - Called AFTER the business mutation has succeeded (log-after pattern).
 * - Never throws to the caller. Failures are logged + reported to PostHog
 *   under the synthetic event `audit_log_failed`.
 * - The user-facing mutation must not be rolled back if this fails.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: input.payload ?? {},
    });
  } catch (err) {
    console.error(
      "[audit] failed to log",
      { action: input.action, targetId: input.targetId },
      err,
    );
    try {
      await serverCapture(input.actorEmail, "audit_log_failed", {
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* swallow — PostHog is best-effort */
    }
    return;
  }

  // Audit row landed. Best-effort PostHog co-emit; isolated from success signal.
  try {
    await serverCapture(input.actorEmail, input.action, {
      ...input.payload,
      tenantId: input.tenantId,
      targetType: input.targetType,
      targetId: input.targetId,
      actorRole: input.actorRole,
    });
  } catch (err) {
    console.error(
      "[audit] posthog co-emit failed (audit row landed OK)",
      { action: input.action },
      err,
    );
  }
}
