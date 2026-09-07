import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getTenant, toTenantBrand } from "@/db/queries";
import { getPrelovedSettings, getShopPrelovedSku } from "@/db/preloved-queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { PRELOVED_REFUND_CLAUSE } from "@/lib/preloved-refund-policy";
import { formatPrelovedCondition } from "@/lib/preloved";
import { parseItemCategory } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import { PrelovedSkuInteractive } from "./interactive";

function defectCopy(note: string | null): string {
  const trimmed = note?.trim();
  return trimmed ? trimmed : "None listed.";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; skuId: string }>;
}): Promise<Metadata> {
  const { tenant: slug, skuId } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Preloved item" };
  const sku = await getShopPrelovedSku(tenant.id, skuId);
  if (!sku) return { title: `Preloved — ${tenant.name}` };
  return {
    title: `${sku.itemName} — Preloved — ${tenant.name}`,
    description: `Preloved ${sku.itemName} in ${formatPrelovedCondition(sku.condition)} condition from ${tenant.name}`,
    robots: { index: true },
  };
}

export default async function PrelovedSkuPage({
  params,
}: {
  params: Promise<{ tenant: string; skuId: string }>;
}) {
  const { tenant: slug, skuId } = await params;
  const tenantRecord = await getTenant(slug);
  if (!tenantRecord) notFound();

  // Same browsing gate as [tenant]/item/[itemId]: hidden/pending tenants 404
  // for public visitors; platform admins keep preview access.
  const isVisibleToPublic =
    tenantRecord.isPubliclyListed &&
    tenantRecord.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  const [settings, sku] = await Promise.all([
    getPrelovedSettings(tenantRecord.id),
    getShopPrelovedSku(tenantRecord.id, skuId),
  ]);
  if (!settings.prelovedEnabled) notFound();
  if (!sku) notFound();

  const tenant = toTenantBrand(tenantRecord);
  const conditionLabel = formatPrelovedCondition(sku.condition);
  const category = parseItemCategory(sku.category);

  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
      <PrelovedSkuInteractive
        tenant={tenant}
        sku={sku}
        garment={
          <div
            className="flex justify-center py-1 pb-2.5"
            style={{ background: "var(--color-parchment)" }}
          >
            {sku.imageUrl ? (
              <Image
                src={sku.imageUrl}
                alt={sku.itemName}
                width={210}
                height={210}
                priority
                className="object-contain"
              />
            ) : (
              <GarmentVector
                itemId={sku.sourceItemId}
                category={category}
                accent={tenant.accent}
                size={210}
              />
            )}
          </div>
        }
      >
        <div className="px-5 pt-4 pb-2.5" data-testid="preloved-sku-page">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="gold">Preloved</Chip>
            <Chip tone={sku.condition === "good" ? "success" : "warn"}>
              <span data-testid="preloved-condition">{conditionLabel}</span>
            </Chip>
          </div>
          <h2 className="font-serif text-[22px] font-medium mt-2.5 mb-1.5 leading-[1.2]">
            {sku.itemName}
          </h2>
          <p
            className="text-[13px] leading-[1.5] m-0 mb-1"
            style={{ color: "var(--color-ink-dim)" }}
          >
            Size {sku.size}
          </p>
          <p
            className="text-[18px] font-semibold tnum m-0 mb-3.5"
            style={{ color: "var(--color-ink)" }}
          >
            ${sku.price}
          </p>

          <section className="mb-3.5">
            <div
              className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-1"
              style={{ color: "var(--color-ink)" }}
            >
              Known defects
            </div>
            <p
              className="text-[13px] leading-[1.5] m-0"
              style={{ color: "var(--color-ink)" }}
              data-testid="preloved-defect-note"
            >
              {defectCopy(sku.defectNote)}
            </p>
          </section>

          <section>
            <div
              className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-1"
              style={{ color: "var(--color-ink)" }}
            >
              Sold as worn
            </div>
            <p
              className="text-[13px] leading-[1.5] m-0"
              style={{ color: "var(--color-ink-dim)" }}
              data-testid="preloved-refund-clause"
            >
              {PRELOVED_REFUND_CLAUSE}
            </p>
          </section>
        </div>
      </PrelovedSkuInteractive>
      <TenantFooter tenant={tenantRecord} />
    </MobileShell>
  );
}
