import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/db/queries";
import {
  getPrelovedSettings,
  markConsignmentLotPayout,
} from "@/db/preloved-queries";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";
import { serializeConsignmentLot } from "../serialize";

// PATCH /api/tenant/:tenantId/preloved/consignment-lots/:lotId — manual payout mark.
// Status is derived from the lot payout preference. Client body is ignored.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; lotId: string }> },
) {
  const { tenantId, lotId } = await params;
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
    if (!settings.prelovedEnabled || !isConsignmentIntakeMode(settings.intakeMode)) {
      return NextResponse.json(
        { error: "Consignment is not enabled" },
        { status: 404 },
      );
    }

    const result = await markConsignmentLotPayout({
      tenantId,
      lotId,
      actorId: authResult.user.id,
    });
    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Lot payout already marked",
          code: "already_marked",
          lot: serializeConsignmentLot(result.lot),
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      lot: serializeConsignmentLot(result.lot),
    });
  } catch (err) {
    console.error(
      "PATCH /api/tenant/[tenantId]/preloved/consignment-lots/[lotId] error:",
      err,
    );
    return NextResponse.json(
      { error: "Failed to mark consignment payout" },
      { status: 500 },
    );
  }
}
