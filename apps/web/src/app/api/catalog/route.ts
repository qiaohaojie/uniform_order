import { NextRequest, NextResponse } from "next/server";
import { addCatalogItem, getCatalogByTenant } from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { requireTenantApproved } from "@/lib/auth/require-tenant-approved";
import { catalogItemInputSchema } from "@/lib/schemas/catalog";

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
    // Auth first — never leak zod schema details to unauthenticated callers.
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

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

    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const id = `${input.tenantId}-${slug}-${Date.now().toString(36)}`;

    await addCatalogItem({
      id,
      tenantId: input.tenantId,
      name: input.name,
      category: input.category,
      description: input.description,
      imageUrl: input.imageUrl,
      active: input.active,
      sortOrder: input.sortOrder,
      variants: input.variants.map((v) => ({
        label: v.label,
        price: v.price,
        active: v.active,
      })),
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/catalog error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
