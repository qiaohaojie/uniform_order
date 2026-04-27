import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG, CATEGORIES, PARENT, TENANTS, type TenantId } from "@/lib/data";
import { Crest } from "@/components/crest";
import { GarmentVector } from "@/components/garment";
import { CartIcon, SearchIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";

const DEFAULT_CATEGORY = "Winter";

export default async function CatalogPage({ params, searchParams }: PageProps<"/[tenant]">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];
  const sp = await searchParams;
  const catParam = typeof sp.cat === "string" ? sp.cat : undefined;
  const activeCat = (catParam && CATEGORIES.includes(catParam as never) ? catParam : DEFAULT_CATEGORY) as string;

  const kid = PARENT.kids.find((k) => k.tenantId === tenant.id);
  const items = CATALOG.filter((i) => i.cat === activeCat);

  return (
    <MobileShell bg="var(--color-paper)">
      {/* Tenant-themed header strip */}
      <div className="text-white px-4 pt-1 pb-3.5 flex-shrink-0" style={{ background: tenant.accent }}>
        <div className="flex items-center gap-2.5 py-1.5">
          <div className="rounded-lg p-1" style={{ background: "rgba(255,255,255,0.12)" }}>
            <Crest tenant={tenant} size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[14px] font-semibold leading-[1.1]">{tenant.short} Uniform Shop</div>
            {kid && (
              <div className="text-[10.5px] opacity-[0.78] mt-px">
                Shopping for · <b className="font-semibold">{kid.name}, {kid.year}</b>
              </div>
            )}
          </div>
          <Link href={`/${tenant.id}/cart`} className="relative text-white" aria-label="Cart">
            <CartIcon size={22} />
            <span
              className="absolute -top-1 -right-1.5 rounded-[10px] text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center"
              style={{ background: "#fff", color: tenant.accent }}
            >
              6
            </span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }}><SearchIcon size={16} /></span>
          <span className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>Search uniforms</span>
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 pt-2.5 pb-1 flex gap-2 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => {
          const on = c === activeCat;
          return (
            <Link
              key={c}
              href={`/${tenant.id}?cat=${c}`}
              scroll={false}
              className="h-[30px] px-3 rounded-full inline-flex items-center text-[12px] font-semibold flex-shrink-0 border"
              style={{
                borderColor: on ? tenant.accent : "var(--color-rule)",
                background: on ? tenant.accent : "#fff",
                color: on ? "#fff" : "var(--color-ink)",
              }}
            >
              {c}
            </Link>
          );
        })}
      </div>

      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {items.length} items</span>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
        {items.map((it) => {
          const minP = Math.min(...it.variants.map((v) => v.price));
          const maxP = Math.max(...it.variants.map((v) => v.price));
          return (
            <Link
              key={it.id}
              href={`/${tenant.id}/item/${it.id}`}
              className="bg-white rounded-[10px] border overflow-hidden block"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <GarmentVector itemId={it.id} accent={tenant.accent} size={120} className="w-full h-auto block" />
              <div className="px-2.5 pt-2 pb-2.5">
                <div className="font-serif text-[13px] font-medium leading-[1.2] line-clamp-2 min-h-8" style={{ color: "var(--color-ink)" }}>
                  {it.name}
                </div>
                <div className="mt-1.5 text-[12px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                  ${minP}
                  {minP !== maxP && (
                    <span className="font-normal" style={{ color: "var(--color-ink-dim)" }}> – ${maxP}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={tenant.accent} />
    </MobileShell>
  );
}
