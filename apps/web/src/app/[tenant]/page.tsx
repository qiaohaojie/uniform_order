import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/data";
import { getTenant, getActiveCatalog, toTenantBrand } from "@/db/queries";
import { getActiveChild } from "@/lib/active-child.server";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { Crest } from "@/components/crest";
import { CartIcon } from "@/components/icons";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { TenantFooter } from "@/components/tenant-footer";
import { CatalogGrid } from "./catalog-grid";

const DEFAULT_CATEGORY = "Winter";

export default async function CatalogPage({ params, searchParams }: PageProps<"/[tenant]">) {
  const { tenant: slug } = await params;
  const [tenantRecord, catalog] = await Promise.all([
    getTenant(slug),
    getActiveCatalog(slug),
  ]);
  if (!tenantRecord) notFound();

  // Browsing gate (catalog + item pages only). Hidden/pending tenants 404 for
  // public visitors; platform admins keep access for preview. Receipt and
  // cart/checkout routes deliberately skip this gate so parents retain access
  // to in-flight carts and historical receipts if a tenant later goes hidden.
  const isVisibleToPublic =
    tenantRecord.isPubliclyListed &&
    tenantRecord.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  const tenant = toTenantBrand(tenantRecord);
  const sp = await searchParams;
  const catParam = typeof sp.cat === "string" ? sp.cat : undefined;
  const activeCat = (catParam && CATEGORIES.includes(catParam as never) ? catParam : DEFAULT_CATEGORY) as string;

  const active = await getActiveChild();
  const kid =
    active && active.tenantId === tenant.id
      ? { name: active.name, year: `Year ${active.year}` }
      : null;

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
          <Link href={`/${tenant.id}/cart`} className="w-9 h-9 flex items-center justify-center text-white" aria-label="Cart">
            <span className="relative">
              <CartIcon size={22} />
              <span
                className="absolute -top-1 -right-1.5 rounded-[10px] text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center"
                style={{ background: "#fff", color: tenant.accent }}
              >
                6
              </span>
            </span>
          </Link>
        </div>
      </div>

      <CatalogGrid
        items={catalog}
        activeCat={activeCat}
        tenantId={tenant.id}
        accent={tenant.accent}
      />

      <TenantFooter tenant={tenantRecord} />
      {/* Spacer so footer isn't obscured by the fixed BottomNav */}
      <div className="pb-16" />
      <BottomNav active="shop" shopHref={`/${tenant.id}`} accent={tenant.accent} />
    </MobileShell>
  );
}
