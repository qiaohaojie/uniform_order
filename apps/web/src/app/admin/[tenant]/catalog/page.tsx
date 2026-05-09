import { notFound } from "next/navigation";
import { getCatalogByTenant, getTenant, toTenantBrand } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { CatalogPageClient } from "./page-client";
import { PendingApprovalEmptyState } from "./pending-approval-empty-state";

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);

  return (
    <>
      <AdminTopbar kicker={`${tenant.short} · Operator`} title="Catalog" />
      {tenantRecord.platformApprovalStatus !== "approved" ? (
        <PendingApprovalEmptyState tenant={tenant} />
      ) : (
        <CatalogPageClient
          tenantId={tid}
          tenant={tenant}
          initialItems={await getCatalogByTenant(tid)}
        />
      )}
    </>
  );
}
