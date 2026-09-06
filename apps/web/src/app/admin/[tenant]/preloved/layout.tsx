import { notFound } from "next/navigation";
import { AdminTopbar } from "@/components/admin-shell";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { PrelovedSectionTabs } from "./preloved-section-tabs";

export default async function AdminPrelovedLayout({
  params,
  children,
}: {
  params: Promise<{ tenant: string }>;
  children: React.ReactNode;
}) {
  const { tenant } = await params;
  const [tenantRecord, settings] = await Promise.all([
    getTenant(tenant),
    getPrelovedSettings(tenant),
  ]);

  if (!tenantRecord || !settings.prelovedEnabled) {
    notFound();
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <AdminTopbar kicker={`${tenantRecord.short} · Operator`} title="Preloved" flush />
      <div
        className="px-7 bg-white"
        style={{ borderBottom: "1px solid var(--color-rule)" }}
      >
        <PrelovedSectionTabs tenantId={tenant} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
