import { NextRequest, NextResponse } from "next/server";
import { getTenant, updateTenantSettings } from "@/db/queries";

// GET /api/tenant/:tenantId
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  try {
    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    return NextResponse.json(tenant);
  } catch (err) {
    console.error("GET /api/tenant/[tenantId] error:", err);
    return NextResponse.json({ error: "Failed to fetch tenant" }, { status: 500 });
  }
}

// PATCH /api/tenant/:tenantId — update shop settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  try {
    const body = await req.json();
    const { name, address, shopHours, shopEmail } = body;
    const updated = await updateTenantSettings(tenantId, { name, address, shopHours, shopEmail });
    if (updated.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/tenant/[tenantId] error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
