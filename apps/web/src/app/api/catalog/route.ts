import { NextRequest, NextResponse } from "next/server";
import { getCatalogByTenant, addCatalogItem } from "@/db/queries";

// GET /api/catalog?tenantId=imhs
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

// POST /api/catalog — add a new item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, name, category, description, variants } = body;

    if (!tenantId || !name || !category) {
      return NextResponse.json(
        { error: "tenantId, name, and category are required" },
        { status: 400 }
      );
    }

    // Generate a slug ID from the name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    const uniqueId = `${id}-${Date.now().toString(36)}`;

    await addCatalogItem({
      id: uniqueId,
      tenantId,
      name,
      category,
      description,
      variants: variants ?? [],
    });

    return NextResponse.json({ id: uniqueId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
