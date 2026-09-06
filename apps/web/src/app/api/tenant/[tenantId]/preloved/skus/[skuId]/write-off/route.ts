import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings, writeOffPrelovedSku } from "@/db/preloved-queries";
import { ensureTenantAccess, requireSessionUser } from "@/lib/auth/authorization";
import { PrelovedWriteOffNotEligibleError } from "@/lib/preloved";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapSku(row: {
  id: string;
  sourceItemId: string;
  size: string;
  condition: "good" | "fair";
  price: string;
  qtyOnHand: number;
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
    listedAt: row.listedAt,
    expiresAt: row.expiresAt,
    defectNote: row.defectNote,
  };
}

// POST /api/tenant/:tenantId/preloved/skus/:skuId/write-off
// Operator-only. Sets qty to 0 and records a written_off intake event.
// Donation-only: no parent payout / EFT / commission.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; skuId: string }> },
) {
  const { tenantId, skuId } = await params;
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

    if (!UUID_RE.test(skuId)) {
      return NextResponse.json({ error: "Invalid SKU id" }, { status: 400 });
    }

    const result = await writeOffPrelovedSku({
      tenantId,
      skuId,
      actorId: authResult.user.id,
    });

    return NextResponse.json({
      ok: true,
      sku: mapSku(result.sku),
      qtyWrittenOff: result.qtyWrittenOff,
      event: {
        id: result.event.id,
        action: result.event.action,
        qty: result.event.qty,
        prelovedSkuId: result.event.prelovedSkuId,
      },
    });
  } catch (err) {
    if (err instanceof PrelovedWriteOffNotEligibleError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 },
      );
    }
    console.error("POST /api/tenant/[tenantId]/preloved/skus/[skuId]/write-off error:", err);
    return NextResponse.json({ error: "Failed to write off SKU" }, { status: 500 });
  }
}
