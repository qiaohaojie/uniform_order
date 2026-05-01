import { NextRequest, NextResponse } from "next/server";
import { deleteCatalogItem, updateCatalogItemName } from "@/db/queries";

// PATCH /api/catalog/:itemId — update item name
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    await updateCatalogItemName(itemId, name);
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
    await deleteCatalogItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/catalog/[itemId] error:", err);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
