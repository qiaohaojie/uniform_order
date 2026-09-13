import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenant, getTenantLegalVersion } from "@/db/queries";
import { deriveTenantStatus, type TenantStatus } from "@/lib/platform/queries";
import { loadTenantActivity } from "@/lib/audit/load-tenant-activity";
import { TenantActivityFeed } from "@/components/platform/tenant-activity-feed";
import { BrandingCard } from "./cards/branding-card";
import { LegalCard } from "./cards/legal-card";
import { OperatorCard } from "./cards/operator-card";
import { StripeCard } from "./cards/stripe-card";
import { DangerCard } from "./cards/danger-card";
import { ShopStatusCard } from "./cards/shop-status-card";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { count, eq } from "drizzle-orm";

const STATUS_LABEL: Record<TenantStatus, string> = {
  pending: "Pending approval",
  active: "Live",
  hidden: "Approved · shop off",
  disabled: "Disabled",
};

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const status = deriveTenantStatus(tenant);
  const currentLegalVersion = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;
  const activity = await loadTenantActivity(id);
  const [orderRow] = await db.select({ n: count() }).from(orders).where(eq(orders.tenantId, id));
  const canDelete = Number(orderRow?.n ?? 0) === 0;

  return (
    <>
      <header className="px-7 py-5 border-b border-rule flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-ink-dim mt-1">
            <span className="font-mono">{tenant.id}.uniformorder.online</span> · Status:{" "}
            <strong>{STATUS_LABEL[status]}</strong>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/platform/tenants/${tenant.id}/settings`}
            className="text-sm font-semibold text-navy-deep underline"
          >
            Workflow settings →
          </Link>
          <Link href={`/${tenant.id}`} className="text-sm font-semibold text-navy-deep underline">
            Open parent shop ↗
          </Link>
        </div>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto space-y-4 max-w-4xl">
        <ShopStatusCard tenant={tenant} status={status} />
        {!currentLegalVersion ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-[10px] px-5 py-4 text-sm">
            <strong className="font-semibold text-yellow-900">Refund policy not set.</strong>{" "}
            <span className="text-yellow-900/90">
              Add it to enable a per-tenant refund-policy link in confirmation emails.
            </span>
          </div>
        ) : null}
        <BrandingCard tenant={tenant} />
        <LegalCard tenant={tenant} currentVersion={currentLegalVersion} />
        <TenantActivityFeed events={activity} />
        <OperatorCard tenant={tenant} />
        <StripeCard tenant={tenant} />
        <DangerCard tenant={tenant} status={status} canDelete={canDelete} />
      </div>
    </>
  );
}
