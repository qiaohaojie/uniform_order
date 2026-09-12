import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { isConsignmentIntakeMode } from "@/lib/preloved-consignment";
import { ConsignmentsClient } from "./consignments-client";

export default async function AdminPrelovedConsignmentsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();

  const settings = await getPrelovedSettings(tenantRecord.id);
  if (!settings.prelovedEnabled || !isConsignmentIntakeMode(settings.intakeMode)) {
    notFound();
  }

  const tenant = toTenantBrand(tenantRecord);

  return <ConsignmentsClient tenantId={tid} timeZone={tenant.timezone} />;
}
