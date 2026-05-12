import type { InferSelectModel } from "drizzle-orm";
import type { auditEvents } from "@/db/schema";

export type AuditTargetType =
  | "order"
  | "tenant"
  | "catalog_item"
  | "tenant_legal_version"
  | "payment_intent";

export type AuditActorRole = "operator" | "platform_admin" | "system";

/** Drizzle row shape — what reads from `audit_events` give back. */
export type AuditEvent = InferSelectModel<typeof auditEvents>;

export interface LogAuditEventInput {
  tenantId: string | null;
  actorEmail: string;
  actorRole: AuditActorRole;
  /** Dotted event key, e.g. 'order.marked_ready'. Must be past tense. */
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  payload?: Record<string, unknown>;
}
