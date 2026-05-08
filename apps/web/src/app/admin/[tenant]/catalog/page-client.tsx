"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CatalogTable } from "./catalog-table";
import { ItemDrawer } from "./item-drawer";
import type { Tenant } from "@/lib/data";

type DbVariant = { id: string; itemId: string; label: string; price: string; active: boolean };
type DbItem = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
  variants: DbVariant[];
};

export function CatalogPageClient({
  tenantId,
  tenant,
  initialItems,
}: {
  tenantId: string;
  tenant: Tenant;
  initialItems: DbItem[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);

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
      <CatalogTable tenantId={tenantId} tenant={tenant} initialItems={initialItems} />
      <ItemDrawer
        tenant={tenant}
        open={addOpen}
        mode={{ kind: "create" }}
        onClose={() => setAddOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
