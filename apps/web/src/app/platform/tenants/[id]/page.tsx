import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenant } from "@/db/queries";
import { BrandingCard } from "./cards/branding-card";
import { OperatorCard } from "./cards/operator-card";
import { StripeCard } from "./cards/stripe-card";
import { DangerCard } from "./cards/danger-card";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const status =
    tenant.platformApprovalStatus === "rejected"
      ? "Disabled"
      : tenant.platformApprovalStatus !== "approved" || !tenant.stripeChargesEnabled
        ? "Setup"
        : tenant.isPubliclyListed
          ? "Active"
          : "Hidden";

  return (
    <>
      <header className="px-7 py-5 border-b border-rule flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-ink-dim mt-1">
            <span className="font-mono">{tenant.id}.uniformorder.online</span> · Status: <strong>{status}</strong>
          </div>
        </div>
        <Link href={`/${tenant.id}`} className="text-sm font-semibold text-navy-deep underline">
          Open parent shop ↗
        </Link>
      </header>

      <div className="flex-1 px-7 py-6 overflow-auto space-y-4 max-w-4xl">
        {status === "Setup" ? (
          <ResumeOnboarding tenant={tenant} />
        ) : (
          <>
            <BrandingCard tenant={tenant} />
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
