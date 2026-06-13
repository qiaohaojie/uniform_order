import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenant, updateTenantSettings } from "@/db/queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";

// shopEmail is intentionally NOT settable here: it is the operator authorization key
// (ensureTenantAccess grants access iff session email === tenant.shopEmail). Allowing
// self-service edits would let an operator hand access to any email or lock themselves out.
const PatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().max(300).nullable().optional(),
  shopHours: z.string().trim().max(200).nullable().optional(),
});

// GET /api/tenant/:tenantId
// Public by design for parent-facing shop metadata (name/address/hours/contact).
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
    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      address: tenant.address,
      shopHours: tenant.shopHours,
      shopEmail: tenant.shopEmail,
    });
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
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      // Empty or malformed JSON: return 400 rather than letting req.json()
      // throw into the outer catch (which would surface as a 500).
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const updated = await updateTenantSettings(tenantId, parsed.data);
    if (updated.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/tenant/[tenantId] error:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
