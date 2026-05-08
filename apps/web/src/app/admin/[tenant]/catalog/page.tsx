import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { getCatalogByTenant, getTenant } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { CatalogPageClient } from "./page-client";
import { PendingApprovalEmptyState } from "./pending-approval-empty-state";

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const staticTenant = TENANTS[tid as TenantId];

  const dbTenant = await getTenant(tid);
  if (!dbTenant) notFound();

  return (
    <>
      <AdminTopbar kicker={`${staticTenant.short} · Operator`} title="Catalog" />
      {dbTenant.platformApprovalStatus !== "approved" ? (
        <PendingApprovalEmptyState tenant={staticTenant} />
      ) : (
        <CatalogPageClient
          tenantId={tid}
          tenant={staticTenant}
          initialItems={await getCatalogByTenant(tid)}
        />
      )}
    </>
  );
}
