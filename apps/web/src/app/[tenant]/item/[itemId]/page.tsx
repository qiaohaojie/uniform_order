import { notFound } from "next/navigation";
import { CATALOG, TENANTS, type TenantId, getItem } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { ItemDetailInteractive } from "./interactive";

export function generateStaticParams() {
  const tenants: TenantId[] = ["imhs", "rgsh"];
  return tenants.flatMap((t) => CATALOG.map((c) => ({ tenant: t, itemId: c.id })));
}

export default async function ItemDetailPage({ params }: PageProps<"/[tenant]/item/[itemId]">) {
  const { tenant: tid, itemId } = await params;
  if (!(tid in TENANTS)) notFound();
  const item = getItem(itemId);
  if (!item) notFound();
  const tenant = TENANTS[tid as TenantId];

  return (
    <MobileShell bg="var(--color-paper)">
      <ItemDetailInteractive
        tenant={tenant}
        item={item}
        garment={
          <div className="flex justify-center py-1 pb-2.5" style={{ background: "var(--color-parchment)" }}>
            <GarmentVector itemId={item.id} accent={tenant.accent} size={210} />
          </div>
        }
      >
        <div className="px-5 pt-4 pb-2.5">
          <Chip tone="info">{item.cat} Uniform</Chip>
          <h2 className="font-serif text-[22px] font-medium mt-2.5 mb-1.5 leading-[1.2]">{item.name}</h2>
          {item.description && (
            <p className="text-[13px] leading-[1.5] m-0 mb-3.5" style={{ color: "var(--color-ink-dim)" }}>
              {item.description}
            </p>
          )}
        </div>
      </ItemDetailInteractive>
    </MobileShell>
  );
}
