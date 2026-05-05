import { NextRequest, NextResponse } from "next/server";
import {
  deleteCatalogItem,
  getCatalogItemById,
  getTenant,
  updateCatalogItemName,
} from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";

// PATCH /api/catalog/:itemId — update item name
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const { name } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const item = await getCatalogItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    const tenant = await getTenant(item.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    const updated = await updateCatalogItemName(itemId, name.trim());
    if (updated.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/catalog/[itemId] error:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE /api/catalog/:itemId
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
    const tenant = await getTenant(item.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    const deleted = await deleteCatalogItem(itemId);
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/catalog/[itemId] error:", err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
