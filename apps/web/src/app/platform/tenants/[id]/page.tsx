import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenant, getTenantLegalVersion } from "@/db/queries";
import type { TenantStatus } from "@/lib/platform/queries";
import { BrandingCard } from "./cards/branding-card";
import { LegalCard } from "./cards/legal-card";
import { OperatorCard } from "./cards/operator-card";
import { StripeCard } from "./cards/stripe-card";
import { DangerCard } from "./cards/danger-card";

const STATUS_LABEL: Record<TenantStatus, string> = {
  setup: "Setup",
  active: "Active",
  hidden: "Hidden",
  disabled: "Disabled",
};

function deriveStatus(tenant: {
  platformApprovalStatus: string;
  stripeChargesEnabled: boolean | null;
  isPubliclyListed: boolean;
}): TenantStatus {
  if (tenant.platformApprovalStatus === "rejected") return "disabled";
  if (tenant.platformApprovalStatus !== "approved" || !tenant.stripeChargesEnabled) return "setup";
  return tenant.isPubliclyListed ? "active" : "hidden";
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const status = deriveStatus(tenant);
  const currentLegalVersion = tenant.currentLegalVersionId
    ? await getTenantLegalVersion(tenant.currentLegalVersionId)
    : null;

  return (
    <>
      <header className="px-7 py-5 border-b border-rule flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-ink-dim mt-1">
            <span className="font-mono">{tenant.id}.uniformorder.online</span> · Status: <strong>{STATUS_LABEL[status]}</strong>
          </div>
        </div>
        <Link href={`/${tenant.id}`} className="text-sm font-semibold text-navy-deep underline">
          Open parent shop ↗
        </Link>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto space-y-4 max-w-4xl">
        {status === "setup" ? (
          <ResumeOnboarding tenant={tenant} />
        ) : (
          <>
            {!currentLegalVersion ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-[10px] px-5 py-4 flex items-start justify-between gap-4">
                <div className="text-sm">
                  <strong className="font-semibold text-yellow-900">Refund policy not set.</strong>{" "}
                  <span className="text-yellow-900/90">
                    Add it to enable a per-tenant refund-policy link in confirmation emails.
                  </span>
                </div>
              </div>
            ) : null}
            <BrandingCard tenant={tenant} />
            <LegalCard tenant={tenant} currentVersion={currentLegalVersion} />
            <OperatorCard tenant={tenant} />
            <StripeCard tenant={tenant} />
            <DangerCard tenant={tenant} status={status} />
          </>
        )}
      </div>
    </>
  );
}

function ResumeOnboarding({ tenant }: { tenant: { id: string; accent: string | null; stripeAccountId: string | null; shopEmail: string | null; stripeChargesEnabled: boolean | null } }) {
  const step = !tenant.accent
    ? 2
    : !tenant.stripeAccountId
      ? 3
      : !tenant.shopEmail
        ? 4
        : !tenant.stripeChargesEnabled
          ? 3
          : 6;
  return (
    <div className="bg-paper rounded-[10px] border border-rule p-6">
      <h2 className="font-serif text-lg font-semibold">Resume onboarding</h2>
      <p className="text-sm text-ink-dim mt-2">This tenant is pending. Complete onboarding to take it live.</p>
      <Link
        href={`/platform/tenants/new?id=${tenant.id}&step=${step}`}
        className="inline-block mt-4 h-10 px-5 rounded-md bg-navy-deep text-white font-semibold leading-10"
      >
        Resume at step {step} →
      </Link>
    </div>
  );
}
