import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenant } from "@/db/queries";
import {
  getPrelovedSettings,
  markConsignmentLotPayout,
} from "@/db/preloved-queries";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import {
  CONSIGNMENT_LOT_PAYOUT_STATUSES,
  isConsignmentIntakeMode,
} from "@/lib/preloved-consignment";

const MarkSchema = z
  .object({
    payoutStatus: z.enum(
      CONSIGNMENT_LOT_PAYOUT_STATUSES.filter((s) => s !== "pending") as [
        "school_fee_credited",
        "eft_paid",
        "donated_proceeds",
      ],
    ),
  })
  .strict();

// PATCH /api/tenant/:tenantId/preloved/consignment-lots/:lotId — manual payout mark.
export async function PATCH(
  req: NextRequest,
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = MarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payout mark", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const lot = await markConsignmentLotPayout({
      tenantId,
      lotId,
      payoutStatus: parsed.data.payoutStatus,
      actorId: authResult.user.id,
    });
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      lot: {
        ...lot,
        createdAt: lot.createdAt.toISOString(),
        payoutMarkedAt: lot.payoutMarkedAt?.toISOString() ?? null,
      },
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
