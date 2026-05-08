import { NextResponse } from "next/server";
import { getTenant } from "@/db/queries";

export type LoadedTenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>;

/** For API routes — returns a 404/403 NextResponse on failure. */
export async function requireTenantApproved(
  tenantId: string
): Promise<{ tenant: LoadedTenant } | { response: NextResponse }> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return {
      response: NextResponse.json({ code: "tenant_not_found" }, { status: 404 }),
    };
  }
  if (tenant.platformApprovalStatus !== "approved") {
    return {
      response: NextResponse.json({ code: "tenant_not_approved" }, { status: 403 }),
    };
  }
  return { tenant };
}
