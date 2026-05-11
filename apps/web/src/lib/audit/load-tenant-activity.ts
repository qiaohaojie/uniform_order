import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import type { AuditEvent } from "./types";

const MAX_ROWS = 20;

export async function loadTenantActivity(
  tenantId: string
): Promise<AuditEvent[]> {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.tenantId, tenantId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(MAX_ROWS);
}
