import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { getPrelovedSettings, listExpiredPrelovedSkus } from "@/db/preloved-queries";
import { WriteOffsClient, type WriteOffListItem } from "./write-offs-client";

function serializeSku(row: {
  id: string;
  sourceItemId: string;
  itemName: string;
  size: string;
  condition: WriteOffListItem["condition"];
  price: number;
  qtyOnHand: number;
  listedAt: Date;
  expiresAt: Date | null;
  defectNote: string | null;
}): WriteOffListItem {
  return {
    id: row.id,
    sourceItemId: row.sourceItemId,
    itemName: row.itemName,
    size: row.size,
    condition: row.condition,
    price: row.price,
    qtyOnHand: row.qtyOnHand,
    listedAt: row.listedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    defectNote: row.defectNote,
  };
}

export default async function AdminPrelovedWriteOffsPage({
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
  const skus = await listExpiredPrelovedSkus(tenantRecord.id);

  return (
    <WriteOffsClient
      tenantId={tid}
      tenant={tenant}
      holdDays={settings.holdDays}
      initialSkus={skus.map(serializeSku)}
    />
  );
}
