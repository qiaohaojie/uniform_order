import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenant } from "@/db/queries";
import {
  getPrelovedSettings,
  insertConsignmentLot,
} from "@/db/preloved-queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import {
  CONSIGNMENT_PAYOUT_PREFERENCES,
  CONSIGNMENT_UNSOLD_PREFERENCES,
  isConsignmentIntakeMode,
  isValidBsb,
  MAX_CONSIGNMENT_ITEMS,
  MIN_CONSIGNMENT_ITEMS,
  normalizeBsb,
} from "@/lib/preloved-consignment";
import { applyRateLimit } from "@/lib/rate-limit";

const ItemSchema = z
  .object({
    garment: z.string().trim().min(1).max(120),
    size: z.string().trim().min(1).max(40),
  })
  .strict();

const ConsignSchema = z
  .object({
    familyName: z.string().trim().min(1).max(80),
    studentName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(120),
    mobile: z.string().trim().min(8).max(40),
    payoutPreference: z.enum(CONSIGNMENT_PAYOUT_PREFERENCES),
    bankBsb: z.string().trim().max(20).optional().nullable(),
    bankAccountName: z.string().trim().max(80).optional().nullable(),
    bankAccountNumber: z.string().trim().max(40).optional().nullable(),
    unsoldPreference: z.enum(CONSIGNMENT_UNSOLD_PREFERENCES),
    items: z.array(ItemSchema).min(MIN_CONSIGNMENT_ITEMS).max(MAX_CONSIGNMENT_ITEMS),
    termsAccepted: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.payoutPreference !== "eft") return;
    const bsb = value.bankBsb ? normalizeBsb(value.bankBsb) : "";
    if (!isValidBsb(bsb)) {
      ctx.addIssue({
        code: "custom",
        path: ["bankBsb"],
        message: "BSB must be 6 digits for EFT payout",
      });
    }
    if (!value.bankAccountName?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountName"],
        message: "Account name is required for EFT payout",
      });
    }
    if (!value.bankAccountNumber?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountNumber"],
        message: "Account number is required for EFT payout",
      });
    }
  });

// POST /api/tenant/:tenantId/preloved/consign — public lot form. No SKU yet.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  try {
    const rateLimitResponse = applyRateLimit(
      req,
      `preloved-consign:${tenantId}:anon`,
      { limit: 10, windowMs: 60_000 },
    );
    if (rateLimitResponse) return rateLimitResponse;

    const tenant = await getTenant(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const isVisibleToPublic =
      tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
    if (!isVisibleToPublic) {
      const user = await getSessionUser();
      if (!user || !isPlatformAdminEmail(user.email)) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
    }

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

    const parsed = ConsignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid consignment form", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const lot = await insertConsignmentLot({
      tenantId,
      familyName: data.familyName,
      studentName: data.studentName,
      email: data.email,
      mobile: data.mobile,
      payoutPreference: data.payoutPreference,
      bankBsb:
        data.payoutPreference === "eft" && data.bankBsb
          ? normalizeBsb(data.bankBsb)
          : null,
      bankAccountName:
        data.payoutPreference === "eft" ? data.bankAccountName?.trim() ?? null : null,
      bankAccountNumber:
        data.payoutPreference === "eft"
          ? data.bankAccountNumber?.trim() ?? null
          : null,
      unsoldPreference: data.unsoldPreference,
      items: data.items,
    });

    return NextResponse.json(
      { ok: true, ticketCode: lot.ticketCode, id: lot.id },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/tenant/[tenantId]/preloved/consign error:", err);
    return NextResponse.json(
      { error: "Failed to record consignment lot" },
      { status: 500 },
    );
  }
}
