import { notFound } from "next/navigation";
import { TENANTS } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminTenantLayout({
  params,
  children,
}: LayoutProps<"/admin/[tenant]">) {
  const { tenant } = await params;
  if (!(tenant in TENANTS)) notFound();
  return <AdminShell tenantId={tenant}>{children}</AdminShell>;
}
