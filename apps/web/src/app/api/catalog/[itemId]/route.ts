import { NextRequest, NextResponse } from "next/server";
import {
  deleteCatalogItem,
  getCatalogItemById,
  updateCatalogItem,
} from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemPatchSchema } from "@/lib/schemas/catalog";

// PATCH /api/catalog/:itemId — partial update; if `variants` provided, replace.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    // Auth first — never leak zod schema details to unauthenticated callers.
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

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

    return NextResponse.json({ id: itemId, ok: true }, { status: 200 });
  } catch (err) {
    console.error(`PATCH /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE /api/catalog/:itemId — hard delete; cascade variants. No 409 path:
// order_lines does not FK catalog_items.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error(`DELETE /api/catalog/${itemId} error:`, err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
