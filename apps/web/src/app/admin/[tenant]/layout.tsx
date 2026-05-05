import { notFound, redirect } from "next/navigation";
import { TENANTS, type TenantId } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";
import { getTenant } from "@/db/queries";
import {
  getSessionUser,
  isPlatformAdminEmail,
  isTenantOperatorEmail,
} from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function AdminTenantLayout({
  params,
  children,
}: { params: Promise<{ tenant: string }>; children: React.ReactNode }) {
  const { tenant } = await params;
  if (!(tenant in TENANTS)) notFound();

  const user = await getSessionUser();
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/admin/${tenant}`)}`);
  }

  const tenantRecord = await getTenant(tenant);
  if (!tenantRecord) notFound();

  const tenantOperatorEmail = tenantRecord.shopEmail ?? TENANTS[tenant as TenantId].shopEmail;
  const canAccessTenant =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenantOperatorEmail);

  if (!canAccessTenant) {
    redirect(`/${tenant}`);
  }

  return <AdminShell tenantId={tenant} userName={user.name} userEmail={user.email}>{children}</AdminShell>;
}
