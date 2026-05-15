import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getTenant, countToPrepare } from "@/db/queries";
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

  const tenantRecord = await getTenant(tenant);
  if (!tenantRecord || tenantRecord.platformApprovalStatus === "rejected") {
    notFound();
  }

  const user = await getSessionUser();

  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/admin/${tenant}`)}`);
  }

  const canAccessTenant =
    isPlatformAdminEmail(user.email) ||
    isTenantOperatorEmail(user.email, tenantRecord.shopEmail);

  if (!canAccessTenant) {
    redirect(`/${tenant}`);
  }

  const newOrderCount = await countToPrepare(tenant);

  return (
    <AdminShell
      tenantId={tenant}
      tenant={{ id: tenantRecord.id, name: tenantRecord.name, short: tenantRecord.short, accent: tenantRecord.accent }}
      userName={user.name}
      userEmail={user.email}
      newOrderCount={newOrderCount}
    >
      {children}
    </AdminShell>
  );
}
