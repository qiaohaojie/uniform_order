import { NextRequest, NextResponse } from "next/server";
import { addCatalogItem, getCatalogByTenant } from "@/db/queries";
import {
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemInputSchema } from "@/lib/schemas/catalog";
import { applyRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";

// GET /api/catalog?tenantId=nsbh
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    const items = await getCatalogByTenant(tenantId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/catalog error:", err);
    return NextResponse.json({ error: "Failed to fetch catalog" }, { status: 500 });
  }
}

// POST /api/catalog — create a new item
export async function POST(req: NextRequest) {
  try {
    // Pre-auth IP rate limit — generous, just probe-defence.
    const preAuthRl = applyRateLimit(req, "catalog:post:anon", {
      limit: 60,
      windowMs: 60_000,
    });
    if (preAuthRl) return preAuthRl;

    // Auth first — never leak zod schema details to unauthenticated callers.
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    // Post-auth per-user budget — admin bulk work fits comfortably.
    const userRl = applyRateLimit(
      req,
      `catalog:post:${authResult.user.id}`,
      { limit: 30, windowMs: 60_000 },
    );
    if (userRl) return userRl;

    const body = await req.json();
    const parsed = catalogItemInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const approval = await requireTenantApproved(input.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const rawSlug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    // Names with no a-z0-9 characters (e.g. CJK / Cyrillic) strip to "".
    // Fall back to a stable token so the id stays parseable.
    const slug = rawSlug.length > 0 ? rawSlug : "item";
    // crypto.randomUUID avoids the same-millisecond collision risk that
    // Date.now().toString(36) had under concurrent writes.
    const id = `${input.tenantId}-${slug}-${crypto.randomUUID().slice(0, 8)}`;

    await addCatalogItem({
      id,
      tenantId: input.tenantId,
      name: input.name,
      category: input.category,
      description: input.description,
      imageUrl: input.imageUrl,
      active: input.active,
      sortOrder: input.sortOrder,
      sizeGuide: input.sizeGuide ?? null,
      variants: input.variants.map((v) => ({
        label: v.label,
        price: v.price,
        active: v.active,
        sizes: v.sizes ?? [],
      })),
    });

    const variantPricesCents = input.variants.map((v) =>
      Math.round(v.price * 100),
    );
    await logAuditEvent({
      tenantId: input.tenantId,
      actorEmail: authResult.user.email,
      actorRole: isPlatformAdminEmail(authResult.user.email)
        ? "platform_admin"
        : "operator",
      action: "catalog_item.created",
      targetType: "catalog_item",
      targetId: id,
      payload: {
        name: input.name,
        category: input.category,
        variantCount: input.variants.length,
        minPriceCents: Math.min(...variantPricesCents),
        maxPriceCents: Math.max(...variantPricesCents),
      },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
