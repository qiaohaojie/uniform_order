import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings, listConsignmentLots } from "@/db/preloved-queries";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";

// GET /api/tenant/:tenantId/preloved/consignment-lots — operator list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
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

    const settings = await getPrelovedSettings(tenantId);
    if (!settings.prelovedEnabled) {
      return NextResponse.json({ error: "Preloved is not enabled" }, { status: 404 });
    }
    if (!isConsignmentIntakeMode(settings.intakeMode)) {
      return NextResponse.json(
        { error: "Consignment is not enabled" },
        { status: 404 },
      );
    }

    const lots = await listConsignmentLots(tenantId);
    return NextResponse.json({
      ok: true,
      commissionBps: settings.commissionBps,
      lots: lots.map((lot) => ({
        ...lot,
        createdAt: lot.createdAt.toISOString(),
        payoutMarkedAt: lot.payoutMarkedAt?.toISOString() ?? null,
        acceptedUnits: lot.acceptedUnits.map((unit) => ({
          ...unit,
          createdAt: unit.createdAt.toISOString(),
        })),
      })),
    });
  } catch (err) {
    console.error(
      "GET /api/tenant/[tenantId]/preloved/consignment-lots error:",
      err,
    );
    return NextResponse.json(
      { error: "Failed to load consignment lots" },
      { status: 500 },
    );
  }
}
