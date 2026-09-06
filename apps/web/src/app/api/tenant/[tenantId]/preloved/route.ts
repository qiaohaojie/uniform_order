import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenant } from "@/db/queries";
import {
  ensurePrelovedRefundClauseOnLegalVersion,
  upsertPrelovedSettings,
} from "@/db/preloved-queries";
import {
  ensureTenantAccess,
  isPlatformAdminEmail,
  requireSessionUser,
} from "@/lib/auth/authorization";
import {
  isPersistablePriceFractionOfNew,
  roundPriceFractionOfNew,
  type PrelovedSettingsPatch,
} from "@/lib/preloved";

// Operator-writable fields only. intakeMode and commissionBps are not accepted
// (Phase 1 is donation-only; commission is unused until Phase 2).
const PatchSchema = z
  .object({
    prelovedEnabled: z.boolean().optional(),
    priceFractionOfNew: z
      .number()
      .finite()
      .transform(roundPriceFractionOfNew)
      .refine(isPersistablePriceFractionOfNew, {
        message: "priceFractionOfNew must round to between 0.01 and 2",
      })
      .optional(),
    holdDays: z.number().int().min(1).max(3650).optional(),
    donatedGstFree: z.boolean().optional(),
    refuseList: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .strict();

// PATCH /api/tenant/:tenantId/preloved — operator-only. Values above 0.50 are allowed.
export async function PATCH(
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
    const tenantAccessResponse = ensureTenantAccess(authResult.user, tenant.shopEmail);
    if (tenantAccessResponse) return tenantAccessResponse;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preloved settings", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const patch = parsed.data as PrelovedSettingsPatch;
    if (
      patch.prelovedEnabled === undefined &&
      patch.priceFractionOfNew === undefined &&
      patch.holdDays === undefined &&
      patch.donatedGstFree === undefined &&
      patch.refuseList === undefined
    ) {
      return NextResponse.json({ error: "No preloved settings to update" }, { status: 400 });
    }

    const settings = await upsertPrelovedSettings(tenantId, patch);
    if (settings.prelovedEnabled) {
      const bumped = await ensurePrelovedRefundClauseOnLegalVersion({
        tenantId,
        actorEmail: authResult.user.email,
        actorUserId: authResult.user.id,
        actorRole: isPlatformAdminEmail(authResult.user.email)
          ? "platform_admin"
          : "operator",
      });
      if (bumped) {
        revalidatePath(`/${tenantId}/refund-policy`);
        if (tenant.platformApprovalStatus === "approved") {
          revalidatePath(`/${tenantId}`, "layout");
        }
      }
    }
    return NextResponse.json({ ok: true, ...settings });
  } catch (err) {
    console.error("PATCH /api/tenant/[tenantId]/preloved error:", err);
    return NextResponse.json({ error: "Failed to update preloved settings" }, { status: 500 });
  }
}
