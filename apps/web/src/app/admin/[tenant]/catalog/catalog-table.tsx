"use client";

import { Dispatch, SetStateAction, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GarmentVector } from "@/components/garment";
import { ItemDrawer, type ItemDrawerInitial } from "./item-drawer";
import type { Tenant, ItemCategory } from "@/lib/data";
import type { CatalogItemWithVariants } from "@/db/queries";

export function CatalogTable({
  items,
  setItems,
  refresh,
  tenant,
}: {
  items: CatalogItemWithVariants[];
  setItems: Dispatch<SetStateAction<CatalogItemWithVariants[]>>;
  refresh: () => Promise<void>;
  tenant: Tenant;
}) {
  const [tableError, setTableError] = useState("");
  const pendingRef = useRef(false);
  const [drawer, setDrawer] = useState<
    | { open: false }
    | { open: true; mode: "edit"; item: CatalogItemWithVariants }
  >({ open: false });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the catalog?`)) return;
    if (pendingRef.current) {
      setTableError("Another operation is in progress — please wait.");
      return;
    }
    pendingRef.current = true;
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
    } finally {
      pendingRef.current = false;
    }
  };

  const initialFromItem = (it: CatalogItemWithVariants): ItemDrawerInitial => ({
    name: it.name,
    category: it.category as ItemCategory,
    description: it.description ?? undefined,
    imageUrl: it.imageUrl ?? undefined,
    active: it.active,
    sortOrder: it.sortOrder,
    variants: it.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
      sizes: Array.isArray(v.sizes) ? (v.sizes as string[]) : [],
      active: v.active,
    })),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    if (pendingRef.current) return;
    pendingRef.current = true;

    // Snapshot before mutation; safe because handleDelete uses setItems((prev) => ...)
    // and React only batches across await points — no overlap window in synchronous path.
    const previous = items;
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, i) => ({
      ...it,
      sortOrder: i,
    }));
    setItems(reordered);
    setTableError("");

    try {
      const res = await fetch("/api/catalog/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenant.id, // tenant.id is the slug ("nsbh") in this codebase
          orderedIds: reordered.map((it) => it.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const isStale = data?.error === "stale_set";
        const err = new Error(
          isStale
            ? "Catalog changed — please refresh."
            : data?.message ?? data?.error ?? "An unknown error occurred.",
        );
        (err as Error & { isStale?: boolean }).isStale = isStale;
        throw err;
      }
    } catch (err) {
      console.error("Reorder failed:", err);
      const isStale =
        err instanceof Error &&
        (err as Error & { isStale?: boolean }).isStale === true;
      if (isStale) {
        // Server rejected our premise (set membership changed) — previous
        // snapshot is also stale, so let refresh() be the sole source of truth.
        setTableError("Catalog changed — please refresh.");
        await refresh();
      } else {
        // Transient failure — roll back optimistic reorder.
        setTableError(
          err instanceof Error ? `Reorder failed: ${err.message}` : "Reorder failed.",
        );
        setItems(previous);
      }
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {tableError && (
        <div className="mb-3 text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {tableError}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-auto rounded-md border" style={{ borderColor: "var(--color-rule)" }}>
          <table className="w-full text-[13px]">
            <thead className="bg-white sticky top-0">
              <tr className="text-left" style={{ color: "var(--color-ink-dim)" }}>
                <th className="px-2 py-2 w-[28px]" aria-label="Reorder"></th>
                <th className="px-3 py-2 w-[60px]">Image</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 w-[110px]">Category</th>
                <th className="px-3 py-2 w-[100px]">Variants</th>
                <th className="px-3 py-2 w-[80px]">Active</th>
                <th className="px-3 py-2 w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              <SortableContext
                items={items.map((it) => it.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((it) => (
                  <SortableRow
                    key={it.id}
                    item={it}
                    tenant={tenant}
                    onOpenDrawer={(item) => setDrawer({ open: true, mode: "edit", item })}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    No items yet. Click "Add item" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
      {drawer.open && (
        <ItemDrawer
          tenant={tenant}
          open={drawer.open}
          mode={{ kind: "edit", itemId: drawer.item.id }}
          initial={initialFromItem(drawer.item)}
          onClose={() => setDrawer({ open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function SortableRow({
  item,
  tenant,
  onOpenDrawer,
  onDelete,
}: {
  item: CatalogItemWithVariants;
  tenant: Tenant;
  onOpenDrawer: (it: CatalogItemWithVariants) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.12)" : undefined,
    borderColor: "var(--color-rule)",
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t cursor-pointer hover:bg-[var(--color-parchment)]"
      onClick={() => onOpenDrawer(item)}
    >
      <td
        className="px-2 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Reorder ${item.name}`}
          className="inline-flex items-center justify-center w-5 h-5 select-none"
          style={{ color: "var(--color-ink-dim)", cursor: "grab", touchAction: "none" }}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      <td className="px-3 py-2">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            width={40}
            height={40}
            className="rounded-sm object-cover"
          />
        ) : (
          <GarmentVector
            itemId={item.id}
            category={item.category as ItemCategory}
            accent={tenant.accent}
            size={40}
          />
        )}
      </td>
      <td className="px-3 py-2 font-medium">{item.name}</td>
      <td className="px-3 py-2">{item.category}</td>
      <td className="px-3 py-2 tnum">{item.variants.length}</td>
      <td className="px-3 py-2">
        {item.active ? (
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
          onClick={() => onDelete(item.id, item.name)}
          style={{ color: tenant.accent }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
