import { NextRequest, NextResponse } from "next/server";
import {
  deleteCatalogItem,
  getCatalogItemById,
  updateCatalogItem,
} from "@/db/queries";
import {
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemPatchSchema } from "@/lib/schemas/catalog";
import { applyRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";

// PATCH /api/catalog/:itemId — partial update; if `variants` provided, replace.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const preAuthRl = applyRateLimit(req, "catalog:patch:anon", {
      limit: 60,
      windowMs: 60_000,
    });
    if (preAuthRl) return preAuthRl;

    // Auth first — never leak zod schema details to unauthenticated callers.
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const userRl = applyRateLimit(
      req,
      `catalog:patch:${authResult.user.id}`,
      { limit: 30, windowMs: 60_000 },
    );
    if (userRl) return userRl;

    const item = await getCatalogItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const approval = await requireTenantApproved(item.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const body = await req.json();
    const parsed = catalogItemPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const { variants, ...fields } = input;

    // Diff parsed input vs pre-write DB state. Only diff scalar fields the
    // operator can edit; `variants` is handled separately because the column
    // doesn't live on catalogItems.
    // Diff over every field accepted by catalogItemPatchSchema. Keep this
    // list in sync with the patch schema; a missing entry would mean a real
    // change is treated as a no-op and never persisted.
    const scalarCandidates = [
      "name",
      "category",
      "description",
      "imageUrl",
      "active",
      "sortOrder",
    ] as const;
    const existingRecord = item as Record<string, unknown>;
    const changedFields: string[] = [];
    for (const f of scalarCandidates) {
      if (fields[f] !== undefined && fields[f] !== existingRecord[f]) {
        changedFields.push(f);
      }
    }
    if (fields.sizeGuide !== undefined) {
      const existingJson = JSON.stringify(item.sizeGuide ?? null);
      const incomingJson = JSON.stringify(fields.sizeGuide ?? null);
      if (existingJson !== incomingJson) changedFields.push("sizeGuide");
    }
    if (variants !== undefined) {
      const existingVariantKey = item.variants
        .map((v) => `${v.id}|${v.label}|${String(v.price)}|${v.active}|${[...(v.sizes ?? [])].sort().join(";")}`)
        .sort()
        .join(",");
      const incomingVariantKey = variants
        .map(
          (v) =>
            `${v.id ?? ""}|${v.label}|${String(v.price.toFixed(2))}|${v.active ?? true}|${[...(v.sizes ?? [])].sort().join(";")}`,
        )
        .sort()
        .join(",");
      if (existingVariantKey !== incomingVariantKey) {
        changedFields.push("variants");
      }
    }

    if (changedFields.length === 0) {
      return NextResponse.json(
        { id: itemId, ok: true, noop: true },
        { status: 200 }
      );
    }

    await updateCatalogItem(itemId, fields, variants);

    // H2: clean up old image when imageUrl changed (replace or clear).
    const oldImageUrl = item.imageUrl;
    const newImageUrl = input.imageUrl;
    if (
      newImageUrl !== undefined &&
      oldImageUrl &&
      newImageUrl !== oldImageUrl
    ) {
      try {
        const { deleteUploadthingFileByUrl } = await import(
          "@/lib/uploadthing-cleanup"
        );
        await deleteUploadthingFileByUrl(oldImageUrl);
      } catch (cleanupErr) {
        console.warn(
          `UploadThing cleanup failed for ${oldImageUrl}:`,
          cleanupErr
        );
      }
    }

    await logAuditEvent({
      tenantId: item.tenantId,
      actorEmail: authResult.user.email,
      actorRole: isPlatformAdminEmail(authResult.user.email)
        ? "platform_admin"
        : "operator",
      action: "catalog_item.updated",
      targetType: "catalog_item",
      targetId: itemId,
      payload: { changedFields },
    });

    return NextResponse.json({ id: itemId, ok: true }, { status: 200 });
  } catch (err) {
    console.error(`PATCH /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE /api/catalog/:itemId — hard delete; cascade variants. No 409 path:
// order_lines does not FK catalog_items.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const preAuthRl = applyRateLimit(req, "catalog:delete:anon", {
      limit: 60,
      windowMs: 60_000,
    });
    if (preAuthRl) return preAuthRl;

    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const userRl = applyRateLimit(
      req,
      `catalog:delete:${authResult.user.id}`,
      { limit: 30, windowMs: 60_000 },
    );
    if (userRl) return userRl;

    const item = await getCatalogItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const approval = await requireTenantApproved(item.tenantId);
    if ("response" in approval) return approval.response;
    const { tenant } = approval;

    const accessDenied = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (accessDenied) return accessDenied;

    const [deleted] = await deleteCatalogItem(itemId);

    // Best-effort UploadThing file delete — see Task 8 for the helper.
    if (deleted?.imageUrl) {
      try {
        const { deleteUploadthingFileByUrl } = await import("@/lib/uploadthing-cleanup");
        await deleteUploadthingFileByUrl(deleted.imageUrl);
      } catch (cleanupErr) {
        console.warn(`UploadThing cleanup failed for ${deleted.imageUrl}:`, cleanupErr);
      }
    }

    await logAuditEvent({
      tenantId: item.tenantId,
      actorEmail: authResult.user.email,
      actorRole: isPlatformAdminEmail(authResult.user.email)
        ? "platform_admin"
        : "operator",
      action: "catalog_item.deleted",
      targetType: "catalog_item",
      targetId: itemId,
      payload: {
        name: item.name,
        category: item.category,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(`DELETE /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
