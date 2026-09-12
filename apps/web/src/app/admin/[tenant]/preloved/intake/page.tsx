import { notFound } from "next/navigation";
import { getCatalogByTenant, getTenant, toTenantBrand } from "@/db/queries";
import { getPrelovedSettings } from "@/db/preloved-queries";
import { IntakeClient, type IntakeCatalogItem } from "./intake-client";

function toMoney(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIntakeItems(
  rows: Awaited<ReturnType<typeof getCatalogByTenant>>,
): IntakeCatalogItem[] {
  return rows
    .filter((item) => item.active)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      variants: item.variants
        .filter(
          (variant) =>
            variant.active &&
            Array.isArray(variant.sizes) &&
            variant.sizes.length > 0,
        )
        .map((variant) => ({
          id: variant.id,
          label: variant.label,
          price: toMoney(variant.price),
          sizes: variant.sizes.map((size) => String(size)),
        })),
    }))
    .filter((item) => item.variants.length > 0);
}

export default async function AdminPrelovedIntakePage({
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
  const catalog = toIntakeItems(await getCatalogByTenant(tenantRecord.id));

  return (
    <IntakeClient
      tenantId={tid}
      tenant={tenant}
      catalog={catalog}
      priceFractionOfNew={settings.priceFractionOfNew}
      refuseList={settings.refuseList}
      intakeMode={settings.intakeMode}
    />
  );
}
