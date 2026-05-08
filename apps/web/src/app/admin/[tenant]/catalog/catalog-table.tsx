"use client";

import { useState } from "react";
import Image from "next/image";
import { GarmentVector } from "@/components/garment";
import { ItemDrawer, type ItemDrawerInitial } from "./item-drawer";
import type { Tenant, ItemCategory } from "@/lib/data";

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

export function CatalogTable({
  tenantId,
  initialItems,
  tenant,
}: {
  tenantId: string;
  initialItems: DbItem[];
  tenant: Tenant;
}) {
  const [items, setItems] = useState<DbItem[]>(initialItems);
  const [tableError, setTableError] = useState("");
  const [drawer, setDrawer] = useState<
    | { open: false }
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; item: DbItem }
  >({ open: false });

  const refresh = async () => {
    try {
      const res = await fetch(`/api/catalog?tenantId=${tenantId}`);
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the catalog?`)) return;
    const previous = items;
    setTableError("");
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete item.");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      setItems(previous);
      setTableError(err instanceof Error ? err.message : "Failed to delete item.");
    }
  };

  const initialFromItem = (it: DbItem): ItemDrawerInitial => ({
    name: it.name,
    category: it.category as ItemCategory,
    description: it.description ?? undefined,
    imageUrl: it.imageUrl ?? undefined,
    active: it.active,
    sortOrder: it.sortOrder,
    variants: it.variants.map((v) => ({ label: v.label, price: v.price, active: v.active })),
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {tableError && (
        <div className="mb-3 text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {tableError}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-md border" style={{ borderColor: "var(--color-rule)" }}>
        <table className="w-full text-[13px]">
          <thead className="bg-white sticky top-0">
            <tr className="text-left" style={{ color: "var(--color-ink-dim)" }}>
              <th className="px-3 py-2 w-[60px]">Image</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 w-[110px]">Category</th>
              <th className="px-3 py-2 w-[100px]">Variants</th>
              <th className="px-3 py-2 w-[80px]">Active</th>
              <th className="px-3 py-2 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className="border-t cursor-pointer hover:bg-[var(--color-parchment)]"
                style={{ borderColor: "var(--color-rule)" }}
                onClick={() => setDrawer({ open: true, mode: "edit", item: it })}
              >
                <td className="px-3 py-2">
                  {it.imageUrl ? (
                    <Image
                      src={it.imageUrl}
                      alt={it.name}
                      width={40}
                      height={40}
                      className="rounded-sm object-cover"
                    />
                  ) : (
                    <GarmentVector itemId={it.id} category={it.category as ItemCategory} accent={tenant.accent} size={40} />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{it.name}</td>
                <td className="px-3 py-2">{it.category}</td>
                <td className="px-3 py-2 tnum">{it.variants.length}</td>
                <td className="px-3 py-2">
                  {it.active ? (
                    <span className="text-emerald-700">●</span>
                  ) : (
                    <span style={{ color: "var(--color-ink-dim)" }}>○</span>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="text-[12px] underline"
                    onClick={() => handleDelete(it.id, it.name)}
                    style={{ color: tenant.accent }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--color-ink-dim)" }}>
                  No items yet. Click “Add item” to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {drawer.open && (
        <ItemDrawer
          tenant={tenant}
          open={drawer.open}
          mode={
            drawer.mode === "create"
              ? { kind: "create" }
              : { kind: "edit", itemId: drawer.item.id }
          }
          initial={drawer.mode === "edit" ? initialFromItem(drawer.item) : undefined}
          onClose={() => setDrawer({ open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
