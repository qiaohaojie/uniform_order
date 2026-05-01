import { notFound } from "next/navigation";
import { TENANTS } from "@/lib/data";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminTenantLayout({
  params,
  children,
}: { params: Promise<{ tenant: string }>; children: React.ReactNode }) {
  const { tenant } = await params;
  if (!(tenant in TENANTS)) notFound();
  return <AdminShell tenantId={tenant}>{children}</AdminShell>;
}
