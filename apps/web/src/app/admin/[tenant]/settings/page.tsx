import { notFound } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { AdminTopbar } from "@/components/admin-shell";
import { SettingsClient } from "./settings-client";

export default async function AdminSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tid } = await params;
  if (!(tid in TENANTS)) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <>
      <AdminTopbar
        kicker={`${tenant.short} · Operator`}
        title="Settings"
      />
      <SettingsClient tenantId={tid} tenant={tenant} />
    </>
  );
}
