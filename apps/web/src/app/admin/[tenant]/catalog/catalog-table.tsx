"use client";
import { useState } from "react";
import type { CatalogItem, ItemCategory, Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";

const CATEGORY_TONE: Record<ItemCategory, "info" | "success" | "warn" | "neutral"> = {
  Summer: "warn",
  Winter: "info",
  Sports: "success",
  Formal: "neutral",
  Bags: "neutral",
  Stationery: "neutral",
};

export function CatalogTable({
  items: initialItems,
  categories,
  tenant,
}: {
  items: CatalogItem[];
  categories: ItemCategory[];
  tenant: Tenant;
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [activeCategory, setActiveCategory] = useState<ItemCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = items.filter((it) => {
    const matchCat = activeCategory === "All" || it.cat === activeCategory;
    const matchSearch =
      !search ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleDelete = (id: string) => {
    if (confirm("Remove this product from the catalog?")) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-9 border rounded-md px-2.5 flex items-center gap-2 bg-white flex-1 max-w-xs"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M20 20 L16 16" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 border-none outline-none text-[12.5px] bg-transparent"
            style={{ fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
          />
        </div>
        <div className="flex gap-1.5">
          {(["All", ...categories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c as ItemCategory | "All")}
              className="h-8 px-3 rounded-full text-[12px] font-semibold border transition-colors"
              style={{
                background: activeCategory === c ? tenant.accent : "#fff",
                color: activeCategory === c ? "#fff" : "var(--color-ink)",
                borderColor: activeCategory === c ? tenant.accent : "var(--color-rule)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        className="flex-1 bg-white rounded-xl border overflow-hidden flex flex-col"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="overflow-y-auto flex-1">
          <table className="w-full border-collapse text-[13px]" style={{ fontFamily: "var(--font-sans)" }}>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: "var(--color-parchment)" }}>
                {["SKU", "Product", "Category", "Variants", "Price range", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className="text-left py-2.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.6px] border-b"
                    style={{
                      color: "var(--color-ink-dim)",
                      borderColor: "var(--color-rule)",
                      textAlign: i >= 4 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((it, idx) => {
                const minP = Math.min(...it.variants.map((v) => v.price));
                const maxP = Math.max(...it.variants.map((v) => v.price));
                const isEditing = editingId === it.id;
                return (
                  <tr
                    key={it.id}
                    className="border-b transition-colors hover:bg-[#FDFBF6]"
                    style={{
                      borderColor: "var(--color-rule)",
                      background: isEditing ? "#F0F7FF" : undefined,
                    }}
                  >
                    <td className="py-2.5 px-3 font-mono text-[11.5px] font-semibold" style={{ color: "var(--color-ink)" }}>
                      {it.id}
                    </td>
                    <td className="py-2.5 px-3 font-medium" style={{ color: "var(--color-ink)" }}>
                      {isEditing ? (
                        <input
                          defaultValue={it.name}
                          className="border rounded px-2 py-1 text-[12.5px] w-full"
                          style={{ borderColor: tenant.accent, outline: "none" }}
                          onBlur={(e) => {
                            setItems((prev) =>
                              prev.map((p) =>
                                p.id === it.id ? { ...p, name: e.target.value } : p
                              )
                            );
                            setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Chip tone={CATEGORY_TONE[it.cat]} size="sm">
                        {it.cat}
                      </Chip>
                    </td>
                    <td className="py-2.5 px-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                      {it.variants.map((v) => v.label).join(", ")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      {minP === maxP ? `$${minP}` : `$${minP} – $${maxP}`}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingId(isEditing ? null : it.id)}
                          className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                          style={{
                            borderColor: isEditing ? tenant.accent : "var(--color-rule)",
                            color: isEditing ? tenant.accent : "var(--color-ink)",
                          }}
                        >
                          {isEditing ? "Save" : "Edit"}
                        </button>
                        <button
                          onClick={() => handleDelete(it.id)}
                          className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                          style={{ borderColor: "#E5BDB4", color: "#B23A2A" }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[13px]" style={{ color: "var(--color-ink-dim)" }}>
                    No products match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div
          className="px-4 py-2.5 flex items-center justify-between text-[11.5px] flex-shrink-0"
          style={{ borderTop: "1px solid var(--color-rule)", color: "var(--color-ink-dim)" }}
        >
          <span>{filtered.length} products</span>
          <span>
            {items.reduce((s, it) => s + it.variants.length, 0)} variants total
          </span>
        </div>
      </div>
    </div>
  );
}
