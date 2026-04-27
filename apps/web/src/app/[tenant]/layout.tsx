import { notFound } from "next/navigation";
import { TENANTS } from "@/lib/data";

export default async function TenantLayout({ params, children }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  if (!(tenant in TENANTS)) notFound();
  return <>{children}</>;
}
