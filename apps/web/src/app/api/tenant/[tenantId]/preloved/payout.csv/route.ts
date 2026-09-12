import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/db/queries";
import {
  getPrelovedSettings,
  listConsignmentSoldLinesForExport,
} from "@/db/preloved-queries";
import {
  ensureTenantAccess,
  requireSessionUser,
} from "@/lib/auth/authorization";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";
import { buildPayoutCsv, payoutCsvFilename } from "@/lib/preloved-payout";

// GET /api/tenant/:tenantId/preloved/payout.csv — treasurer remittance ledger.
// ?pending=1 limits to lots not yet marked paid / credited / donated.
export async function GET(
  req: NextRequest,
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
    const tenantAccessResponse = ensureTenantAccess(
      authResult.user,
      tenant.shopEmail,
    );
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

    const pendingOnly = req.nextUrl.searchParams.get("pending") === "1";
    const rows = await listConsignmentSoldLinesForExport(tenantId, {
      pendingOnly,
    });
    const csv = buildPayoutCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${payoutCsvFilename(tenantId)}"`,
        "Cache-Control": "no-store",
        "X-Payout-Row-Count": String(rows.length),
      },
    });
  } catch (err) {
    console.error(
      "GET /api/tenant/[tenantId]/preloved/payout.csv error:",
      err,
    );
    return NextResponse.json(
      { error: "Failed to export payout CSV" },
      { status: 500 },
    );
  }
}
