import { notFound } from "next/navigation";
import { TENANTS, CATALOG, CATEGORIES, type TenantId } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";
import { CatalogTable } from "./catalog-table";

export default async function AdminCatalogPage({ params }: PageProps<"/admin/[tenant]/catalog">) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Catalog"
        right={
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Bulk upload CSV
            </button>
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5"
              style={{ background: tenant.accent }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5 V19 M5 12 H19" />
              </svg>
              Add product
            </button>
          </div>
        }
      />
      <CatalogTable items={CATALOG} categories={CATEGORIES} tenant={tenant} />
    </>
  );
}
