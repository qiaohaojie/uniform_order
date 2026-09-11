import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { DonationInboxClient } from "./inbox-client";

export default async function AdminPrelovedInboxPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();

  const settings = await getPrelovedSettings(tenantRecord.id);
  if (!settings.prelovedEnabled) notFound();

  const tenant = toTenantBrand(tenantRecord);

  return <DonationInboxClient tenantId={tid} timeZone={tenant.timezone} />;
}
