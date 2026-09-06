import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings, insertDonationNote } from "@/db/preloved-queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import {
  MAX_DONATION_BAG_COUNT,
  MIN_DONATION_BAG_COUNT,
} from "@/lib/preloved-donate";
import { applyRateLimit } from "@/lib/rate-limit";

const DonateSchema = z
  .object({
    parentName: z.string().trim().min(1).max(80),
    studentName: z.string().trim().min(1).max(80),
    bagCount: z
      .number()
      .int()
      .min(MIN_DONATION_BAG_COUNT)
      .max(MAX_DONATION_BAG_COUNT),
  })
  .strict();

// POST /api/tenant/:tenantId/preloved/donate — public bag note. No SKU, no listing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  try {
    const rateLimitResponse = applyRateLimit(
      req,
      `preloved-donate:${tenantId}:anon`,
      { limit: 10, windowMs: 60_000 },
    );
    if (rateLimitResponse) return rateLimitResponse;

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Same public gate as /[tenant]/preloved/donate: hidden/pending 404 for
    // anonymous callers; platform admins may preview-submit.
    const isVisibleToPublic =
      tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
    if (!isVisibleToPublic) {
      const user = await getSessionUser();
      if (!user || !isPlatformAdminEmail(user.email)) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
    }

    const settings = await getPrelovedSettings(tenantId);
    if (!settings.prelovedEnabled) {
      return NextResponse.json({ error: "Preloved is not enabled" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = DonateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid donation note", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await insertDonationNote({
      tenantId,
      parentName: parsed.data.parentName,
      studentName: parsed.data.studentName,
      bagCount: parsed.data.bagCount,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tenant/[tenantId]/preloved/donate error:", err);
    return NextResponse.json({ error: "Failed to record donation note" }, { status: 500 });
  }
}
