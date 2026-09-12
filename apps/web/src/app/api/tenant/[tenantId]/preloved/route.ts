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
  PRELOVED_INTAKE_MODES,
  roundPriceFractionOfNew,
  type PrelovedSettingsPatch,
} from "@/lib/preloved";
import {
  isValidCommissionBps,
  MAX_COMMISSION_BPS,
  MIN_COMMISSION_BPS,
} from "@/lib/preloved-consignment";

const PatchSchema = z
  .object({
    prelovedEnabled: z.boolean().optional(),
    intakeMode: z.enum(PRELOVED_INTAKE_MODES).optional(),
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
    commissionBps: z
      .number()
      .int()
      .min(MIN_COMMISSION_BPS)
      .max(MAX_COMMISSION_BPS)
      .refine(isValidCommissionBps)
      .optional(),
  })
  .strict();

// PATCH /api/tenant/:tenantId/preloved — operator-only.
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
      patch.intakeMode === undefined &&
      patch.priceFractionOfNew === undefined &&
      patch.holdDays === undefined &&
      patch.donatedGstFree === undefined &&
      patch.refuseList === undefined &&
      patch.commissionBps === undefined
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
