import { notFound, redirect } from "next/navigation";
import { getTenant, getTenantSettings, toTenantBrand } from "@/db/queries";
import { MobileShell } from "@/components/mobile-shell";
import { TenantFooter } from "@/components/tenant-footer";
import { CheckoutScreen } from "./checkout-screen";
import { getSessionUser } from "@/lib/auth/authorization";
import { getActiveChild } from "@/lib/active-child.server";

export default async function CheckoutPage({ params }: PageProps<"/[tenant]/checkout">) {
  const { tenant: slug } = await params;
  const tenantRecord = await getTenant(slug);
  if (!tenantRecord) notFound();

  const [user, active, settings] = await Promise.all([
    getSessionUser(),
    getActiveChild(),
    getTenantSettings(tenantRecord.id),
  ]);
  if (!user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent(`/${slug}/checkout`)}`);
  }

  const tenant = toTenantBrand(tenantRecord);

  const prefill =
    active && active.tenantId === slug
      ? {
          studentName: active.name,
          year: `Year ${active.year}`,
          rollClass: active.rollClass ?? "",
        }
      : null;

  return (
    <MobileShell bg="var(--color-paper)" logoUrl={tenantRecord.logoUrl ?? undefined}>
      <CheckoutScreen
        tenant={tenant}
        prefill={prefill}
        shippingEnabled={settings.shippingEnabled}
        pickupEnabled={settings.pickupEnabled}
      />
      <TenantFooter tenant={tenantRecord} />
    </MobileShell>
  );
}
