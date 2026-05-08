"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CatalogTable } from "./catalog-table";
import { ItemDrawer } from "./item-drawer";
import type { Tenant } from "@/lib/data";
import type { CatalogItemWithVariants } from "@/db/queries";

export function CatalogPageClient({
  tenantId,
  tenant,
  initialItems,
}: {
  tenantId: string;
  tenant: Tenant;
  initialItems: CatalogItemWithVariants[];
}) {
  const [items, setItems] = useState<CatalogItemWithVariants[]>(initialItems);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalog?tenantId=${tenantId}`);
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  }, [tenantId]);

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-6 pt-4">
        <Link
          href={`/admin/${tenantId}/upload`}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        >
          Bulk upload CSV
        </Link>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white"
          style={{ background: tenant.accent }}
        >
          + Add item
        </button>
      </div>
      <CatalogTable
        tenant={tenant}
        items={items}
        setItems={setItems}
        refresh={refresh}
      />
      <ItemDrawer
        tenant={tenant}
        open={addOpen}
        mode={{ kind: "create" }}
        onClose={() => setAddOpen(false)}
        onSaved={async () => {
          await refresh();
          setAddOpen(false);
        }}
      />
    </>
  );
}
