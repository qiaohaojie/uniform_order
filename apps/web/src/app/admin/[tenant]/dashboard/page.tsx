import Link from "next/link";
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
          <Link
            href={`/admin/${tid}/catalog`}
            className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5"
            style={{ background: tenant.accent }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5 V19 M5 12 H19" />
            </svg>
            New product
          </Link>
        }
      />
      <AdminDashboardClient tenant={tenant} dashboard={dashboard} />
    </>
  );
}
