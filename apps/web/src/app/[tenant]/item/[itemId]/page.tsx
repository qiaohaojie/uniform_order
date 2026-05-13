import { permanentRedirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getTenant, getCatalogItemForPDP, toTenantBrand } from "@/db/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; itemId: string }>;
}): Promise<Metadata> {
  const { tenant: slug, itemId } = await params;
  const [tenant, item] = await Promise.all([getTenant(slug), getCatalogItemForPDP(slug, itemId)]);
  if (!tenant || !item) return { title: "Item" };
  return {
    title: `${item.name} — ${tenant.name}`,
    description: item.description ?? `${item.name} available from ${tenant.name}`,
    alternates: { canonical: `/${tenant.id}/item/${itemId}` },
  };
}
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { GarmentVector } from "@/components/garment";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import { ItemDetailInteractive } from "./interactive";

export default async function ItemDetailPage({ params }: PageProps<"/[tenant]/item/[itemId]">) {
  const { tenant: slug, itemId } = await params;
  const [tenantRecord, item] = await Promise.all([
    getTenant(slug),
    getCatalogItemForPDP(slug, itemId),
  ]);
  if (!tenantRecord) notFound();

  // Browsing gate — see [tenant]/page.tsx for rationale. Mirror the same
  // visibility check; cart/checkout/order-placed deliberately skip it.
  const isVisibleToPublic =
    tenantRecord.isPubliclyListed &&
    tenantRecord.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  let resolvedItem = item;
  if (!resolvedItem) {
    // Legacy-URL fallback: try the prefixed canonical id (Task 1.6 seed shape).
    const canonicalId = `${slug}-${itemId}`;
    if (canonicalId !== itemId) {
      const fallback = await getCatalogItemForPDP(slug, canonicalId);
      if (fallback) {
        // 308 permanent redirect — bookmarks update, search engines learn the new URL.
        permanentRedirect(`/${slug}/item/${canonicalId}`);
      }
    }
    notFound();
  }

  const tenant = toTenantBrand(tenantRecord);

  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
      <ItemDetailInteractive
        tenant={tenant}
        item={resolvedItem}
        garment={
          <div className="flex justify-center py-1 pb-2.5" style={{ background: "var(--color-parchment)" }}>
            {resolvedItem.imageUrl ? (
              <Image
                src={resolvedItem.imageUrl}
                alt={resolvedItem.name}
                width={210}
                height={210}
                priority
                className="object-contain"
              />
            ) : (
              <GarmentVector itemId={resolvedItem.id} accent={tenant.accent} size={210} />
            )}
          </div>
        }
      >
        <div className="px-5 pt-4 pb-2.5">
          <Chip tone="info">{resolvedItem.cat} Uniform</Chip>
          <h2 className="font-serif text-[22px] font-medium mt-2.5 mb-1.5 leading-[1.2]">{resolvedItem.name}</h2>
          {resolvedItem.description && (
            <p className="text-[13px] leading-[1.5] m-0 mb-3.5" style={{ color: "var(--color-ink-dim)" }}>
              {resolvedItem.description}
            </p>
          )}
        </div>
      </ItemDetailInteractive>
      <TenantFooter tenant={tenantRecord} />
    </MobileShell>
  );
}
