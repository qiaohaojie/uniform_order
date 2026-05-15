import { notFound } from "next/navigation";
import { getTenant, getTenantSettings, toTenantBrand } from "@/db/queries";
import { AdminTopbar } from "@/components/admin-shell";
import { SettingsClient } from "./settings-client";

export default async function AdminSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);
  const workflowSettings = await getTenantSettings(tenantRecord.id);

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Settings"
      />
      <SettingsClient
        tenantId={tid}
        tenant={tenant}
        workflowSettings={workflowSettings}
      />
    </>
  );
}
