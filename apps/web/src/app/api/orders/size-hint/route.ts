import { NextRequest, NextResponse } from "next/server";
import { getPreviousSizeHint, getTenant } from "@/db/queries";
import { requireSessionUser } from "@/lib/auth/authorization";
import { applyRateLimit } from "@/lib/rate-limit";
import { serverCaptureException } from "@/lib/analytics/server";

// GET /api/orders/size-hint?tenantId=&itemId=
// Parent email is derived from the session — never accepted in the URL.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const itemId = searchParams.get("itemId");

  if (!tenantId || !itemId) {
    return NextResponse.json(
      { error: "tenantId and itemId required" },
      { status: 400 },
    );
  }

  try {
    const authResult = await requireSessionUser();
    if ("response" in authResult) return authResult.response;

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const rateLimitResponse = applyRateLimit(
      req,
      `size-hint:${authResult.user.id}`,
      { limit: 60, windowMs: 60_000 },
    );
    if (rateLimitResponse) return rateLimitResponse;

    const hint = await getPreviousSizeHint(
      tenantId,
      authResult.user.email,
      itemId,
    );
    return NextResponse.json({ hint });
  } catch (err) {
    console.error("GET /api/orders/size-hint error:", err);
    await serverCaptureException(
      "api-size-hint-get",
      err instanceof Error ? err : new Error(String(err)),
      { method: "GET", tenantId, itemId },
    );
    return NextResponse.json(
      { error: "Failed to fetch size hint" },
      { status: 500 },
    );
  }
}
