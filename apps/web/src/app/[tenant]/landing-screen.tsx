// apps/web/src/app/[tenant]/landing-screen.tsx
"use client";

import { useRouter } from "next/navigation";
import { Crest } from "@/components/crest";
import { GarmentVector } from "@/components/garment";
import { TenantFooter } from "@/components/tenant-footer";
import { BottomNav } from "@/components/bottom-nav";
import { setVisitedCookie } from "@/lib/landing-visit.client";
import { type TenantRow } from "@/db/schema";
import { type PopularItem } from "@/db/queries";

export function LandingScreen({
  tenant,
  popularItems,
  accent,
}: {
  tenant: TenantRow;
  popularItems: PopularItem[];
  accent: string;
}) {
  const router = useRouter();

  // CTA: already at /<slug>, so refresh the RSC to re-read the cookie
  function visitCatalogue() {
    setVisitedCookie(tenant.id);
    router.refresh();
  }

  // Item tiles: navigate to a different URL, so push works fine
  function visitItem(itemId: string) {
    setVisitedCookie(tenant.id);
    router.push(`/${tenant.id}/${itemId}`);
  }

  return (
    <>
      {/* Header strip — crest + name only, no child/cart ornaments */}
      <div
        className="text-white px-4 pt-1 pb-3.5 flex-shrink-0 flex items-center gap-2.5 py-1.5"
        style={{ background: accent }}
      >
        <Crest tenant={tenant} size={28} ring={false} />
        <span className="text-sm font-medium leading-tight opacity-90">
          {tenant.name}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 flex flex-col gap-5">

        {/* Hero: large crest + name + motto */}
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <Crest tenant={tenant} size={80} ring />
          <div>
            <p
              className="font-serif text-lg font-bold leading-snug"
              style={{ color: "var(--color-navy-deep)" }}
            >
              {tenant.name}
            </p>
            {tenant.motto && (
              <p
                className="font-serif italic text-xs mt-1 tracking-wide"
                style={{ color: "var(--color-gold)" }}
              >
                {tenant.motto}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: "var(--color-rule)" }} />

        {/* Shop hours card */}
        {tenant.shopHours && (
          <div
            className="rounded-[10px] border px-4 py-3 flex flex-col gap-1.5"
            style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
          >
            <p
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--color-gold)" }}
            >
              Uniform Shop
            </p>
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--color-navy-deep)" }}
            >
              {tenant.shopHours}
            </p>
            {tenant.collectionInstructions && (
              <p className="text-xs leading-relaxed" style={{ color: "#4a5060" }}>
                {tenant.collectionInstructions}
              </p>
            )}
          </div>
        )}

        {/* Popular this term */}
        {popularItems.length > 0 && (
          <div>
            <p
              className="text-[10px] font-bold tracking-widest uppercase mb-3"
              style={{ color: "var(--color-gold)" }}
            >
              Popular this term
            </p>
            <div className="grid grid-cols-3 gap-2">
              {popularItems.map((item) => (
                <button
                  type="button"
                  key={item.itemId}
                  onClick={() => visitItem(item.itemId)}
                  className="flex flex-col items-center rounded-[8px] border p-2.5 text-center cursor-pointer hover:border-current transition-colors"
                  style={{ background: "var(--color-paper)", borderColor: "var(--color-rule)" }}
                >
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center mb-1.5 overflow-hidden"
                    style={{ background: "var(--color-parchment)" }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <GarmentVector
                        itemId={item.itemId}
                        accent={accent}
                        size={32}
                        className="block"
                      />
                    )}
                  </div>
                  <span
                    className="text-[10.5px] font-semibold leading-tight"
                    style={{ color: "var(--color-navy-deep)" }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[10.5px] font-medium mt-0.5 tnum"
                    style={{ color: "var(--color-gold)" }}
                  >
                    ${item.minPrice % 1 === 0
                      ? item.minPrice.toFixed(0)
                      : item.minPrice.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CTA — uses router.refresh() not router.push() because we're already at /<slug> */}
        <button
          type="button"
          onClick={visitCatalogue}
          className="w-full rounded-[9px] py-3.5 text-sm font-semibold text-white tracking-wide"
          style={{ background: accent }}
        >
          Browse Catalogue →
        </button>

        {/* Footer note */}
        <p className="text-center text-[10px] opacity-50">
          This welcome screen won&apos;t show again for 30 days
        </p>

      </div>

      <TenantFooter tenant={tenant} />
      <div className="pb-16" />
      <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={accent} />
    </>
  );
}
