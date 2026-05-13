import { NextRequest, NextResponse } from "next/server";
import {
  getCatalogByTenant,
  reorderCatalogItems,
} from "@/db/queries";
import {
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogReorderSchema } from "@/lib/schemas/catalog";
import { applyRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";

// POST /api/catalog/reorder
// Body: { tenantSlug: string, orderedIds: string[] }
// Atomically renumber a tenant's catalog items to dense 0..N-1 order.
export async function POST(req: NextRequest) {
  try {
    const preAuthRl = applyRateLimit(req, "catalog:reorder:anon", {
      limit: 30,
      windowMs: 60_000,
    });
    if (preAuthRl) return preAuthRl;

    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const userRl = applyRateLimit(
      req,
      `catalog:reorder:${authResult.user.id}`,
      { limit: 20, windowMs: 60_000 },
    );
    if (userRl) return userRl;

    const body = await req.json();
    const parsed = catalogReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { tenantSlug, orderedIds } = parsed.data;

    // requireTenantApproved resolves the tenant by slug (the slug doubles as
    // the PK in this codebase) AND enforces approval gating in one round-trip.
    const approval = await requireTenantApproved(tenantSlug);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    // Exhaustive-set check: orderedIds must equal the full set of catalog item
    // IDs for this tenant. This catches concurrent add/delete by another
    // operator and any client/server drift. Use getCatalogByTenant (not the
    // active-only variant) so inactive items participate in ordering.
    const currentItems = await getCatalogByTenant(tenant.id);
    const currentIds = new Set(currentItems.map((it) => it.id));
    const incomingIds = new Set(orderedIds);

    if (incomingIds.size !== orderedIds.length) {
      return NextResponse.json(
        { error: "duplicate_ids" },
        { status: 400 },
      );
    }
    if (orderedIds.length !== currentIds.size) {
      return NextResponse.json(
        { error: "stale_set", message: "Catalog changed — please refresh." },
        { status: 400 },
      );
    }
    for (const id of incomingIds) {
      if (!currentIds.has(id)) {
        return NextResponse.json(
          { error: "stale_set", message: "Catalog changed — please refresh." },
          { status: 400 },
        );
      }
    }

    await reorderCatalogItems(tenant.id, orderedIds);

    await logAuditEvent({
      tenantId: tenant.id,
      actorEmail: authResult.user.email,
      actorRole: isPlatformAdminEmail(authResult.user.email)
        ? "platform_admin"
        : "operator",
      action: "catalog.reordered",
      targetType: "tenant",
      targetId: tenant.id,
      payload: { itemCount: orderedIds.length },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/catalog/reorder failed:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }
}
