import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenant } from "@/db/queries";
import {
  acceptAndPool,
  getPrelovedSettings,
  rejectPrelovedIntake,
} from "@/db/preloved-queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import {
  PRELOVED_CONDITIONS,
  PrelovedCatalogMatchError,
  PrelovedExpiredStockError,
} from "@/lib/preloved";

const AcceptedSchema = z
  .object({
    action: z.literal("accepted"),
    sourceItemId: z.string().trim().min(1).max(80),
    size: z.string().trim().min(1).max(20),
    condition: z.enum(PRELOVED_CONDITIONS),
    price: z.number().finite().positive().max(10000).optional(),
    defectNote: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

const RejectedSchema = z
  .object({
    action: z.literal("rejected"),
    sourceItemId: z.string().trim().min(1).max(80).optional(),
    size: z.string().trim().min(1).max(20).optional(),
    condition: z.enum(PRELOVED_CONDITIONS).optional(),
    rejectReason: z.string().trim().min(1).max(500),
  })
  .strict();

const IntakeSchema = z.discriminatedUnion("action", [AcceptedSchema, RejectedSchema]);

function mapSku(row: {
  id: string;
  sourceItemId: string;
  size: string;
  condition: "good" | "fair";
  price: string;
  qtyOnHand: number;
  gstFree: boolean;
  listedAt: Date;
  expiresAt: Date | null;
  defectNote: string | null;
}) {
  return {
    id: row.id,
    sourceItemId: row.sourceItemId,
    size: row.size,
    condition: row.condition,
    price: Number(row.price),
    qtyOnHand: row.qtyOnHand,
    gstFree: row.gstFree,
    listedAt: row.listedAt,
    expiresAt: row.expiresAt,
    defectNote: row.defectNote,
  };
}

// POST /api/tenant/:tenantId/preloved/intake — operator accept/reject. Donation only.
export async function POST(
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

    const parsed = IntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid intake", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.action === "rejected") {
      const event = await rejectPrelovedIntake({
        tenantId,
        actorId: authResult.user.id,
        sourceItemId: parsed.data.sourceItemId ?? null,
        size: parsed.data.size ?? null,
        condition: parsed.data.condition ?? null,
        rejectReason: parsed.data.rejectReason,
      });
      return NextResponse.json({
        ok: true,
        event: {
          id: event.id,
          action: event.action,
          qty: event.qty,
          rejectReason: event.rejectReason,
          prelovedSkuId: event.prelovedSkuId,
        },
      });
    }

    const result = await acceptAndPool({
      tenantId,
      sourceItemId: parsed.data.sourceItemId,
      size: parsed.data.size,
      condition: parsed.data.condition,
      price: parsed.data.price,
      defectNote: parsed.data.defectNote,
      actorId: authResult.user.id,
    });

    return NextResponse.json({
      ok: true,
      sku: mapSku(result.sku),
      defaultPrice: result.defaultPrice,
      priceAboveCap: result.priceAboveCap,
      event: {
        id: result.event.id,
        action: result.event.action,
        qty: result.event.qty,
        prelovedSkuId: result.event.prelovedSkuId,
      },
    });
  } catch (err) {
    if (err instanceof PrelovedCatalogMatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PrelovedExpiredStockError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 },
      );
    }
    console.error("POST /api/tenant/[tenantId]/preloved/intake error:", err);
    return NextResponse.json({ error: "Failed to record intake" }, { status: 500 });
  }
}
