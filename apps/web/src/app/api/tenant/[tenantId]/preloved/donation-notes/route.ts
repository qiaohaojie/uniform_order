import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings, listDonationNotes } from "@/db/preloved-queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";

function mapNote(row: {
  id: string;
  parentName: string;
  studentName: string;
  bagCount: number;
  createdAt: Date;
}) {
  return {
    id: row.id,
    parentName: row.parentName,
    studentName: row.studentName,
    bagCount: row.bagCount,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/tenant/:tenantId/preloved/donation-notes — operator inbox.
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

    const notes = await listDonationNotes(tenantId);
    return NextResponse.json({ notes: notes.map(mapNote) });
  } catch (err) {
    console.error("GET /api/tenant/[tenantId]/preloved/donation-notes error:", err);
    return NextResponse.json({ error: "Failed to load donation notes" }, { status: 500 });
  }
}
