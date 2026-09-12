import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTenant } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { getSessionUser, isPlatformAdminEmail } from "@/lib/auth/authorization";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import { ConsignScreen } from "./consign-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) return { title: "Consign preloved" };
  return { title: `Consign preloved — ${tenant.name}`, robots: { index: true } };
}

export default async function ConsignPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();

  const isVisibleToPublic =
    tenant.isPubliclyListed && tenant.platformApprovalStatus === "approved";
  if (!isVisibleToPublic) {
    const user = await getSessionUser();
    if (!user || !isPlatformAdminEmail(user.email)) notFound();
  }

  const settings = await getPrelovedSettings(tenant.id);
  if (!settings.prelovedEnabled || !isConsignmentIntakeMode(settings.intakeMode)) {
    notFound();
  }

  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenant.logoUrl ?? undefined}>
      <div className="px-5 py-6" data-testid="consign-page">
        <h1
          className="font-serif text-2xl font-semibold pb-2 mb-4 border-b-2"
          style={{ borderColor: tenant.accent, color: "var(--color-navy-deep)" }}
        >
          Consign preloved
        </h1>

        <p className="text-sm leading-6 text-ink mb-5">
          Fill this form, then drop the washed bag at the shop with the ticket
          code on the tag. Volunteers inspect and price each garment — the form
          replaces the paper consignment sheet, not intake.
        </p>

        <section className="rounded-lg border border-rule bg-paper p-4">
          <ConsignScreen
            tenantId={tenant.id}
            accent={tenant.accent}
            commissionBps={settings.commissionBps}
          />
        </section>
      </div>
      <TenantFooter tenant={tenant} />
    </MobileShell>
  );
}
