import { notFound } from "next/navigation";
import { getLiveDashboardData, getTenant, toTenantBrand } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { AdminDashboardClient } from "./dashboard-client";

export default async function AdminDashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);
  const dashboard = await getLiveDashboardData(tid);

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Dashboard"
        right={
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
            <button
              className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5"
              style={{ background: tenant.accent }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5 V19 M5 12 H19" />
              </svg>
              New product
            </button>
          </div>
        }
      />
      <AdminDashboardClient tenant={tenant} dashboard={dashboard} />
    </>
  );
}
