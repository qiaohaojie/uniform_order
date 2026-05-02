"use client";
import { useState, useEffect } from "react";
import type { ItemCategory, Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";

const CATEGORIES: ItemCategory[] = ["Summer", "Winter", "Sports", "Formal", "Bags", "Stationery"];

const CATEGORY_TONE: Record<ItemCategory, "info" | "success" | "warn" | "neutral"> = {
  Summer: "warn",
  Winter: "info",
  Sports: "success",
  Formal: "neutral",
  Bags: "neutral",
  Stationery: "neutral",
};

interface DbVariant {
  id: string;
  itemId: string;
  label: string;
  price: string;
  active: boolean;
}

interface DbItem {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  variants: DbVariant[];
}

function AddProductModal({
  tenantId,
  accent,
  onClose,
  onAdded,
}: {
  tenantId: string;
  accent: string;
  onClose: () => void;
  onAdded: (item: DbItem) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ItemCategory>("Summer");
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([{ label: "", price: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addVariant = () => setVariants((v) => [...v, { label: "", price: "" }]);
  const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: "label" | "price", val: string) =>
    setVariants((v) => v.map((vv, idx) => (idx === i ? { ...vv, [field]: val } : vv)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Product name is required."); return; }
    if (variants.some((v) => !v.label.trim() || !v.price.trim())) {
      setError("All variant fields are required."); return;
    }
    if (variants.some((v) => !Number.isFinite(Number(v.price)) || Number(v.price) < 0)) {
      setError("Variant prices must be valid positive numbers."); return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: name.trim(),
          category,
          description: description.trim() || undefined,
          variants: variants.map((v) => ({
            label: v.label.trim(),
            price: parseFloat(v.price),
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add product.");
        return;
      }
      const { id } = await res.json();
      // Build a local DbItem to add to the table immediately
      const newItem: DbItem = {
        id,
        tenantId,
        name: name.trim(),
        category,
        description: description.trim() || null,
        active: true,
        sortOrder: 999,
        variants: variants.map((v, i) => ({
          id: `temp-${i}`,
          itemId: id,
          label: v.label.trim(),
          price: v.price,
          active: true,
        })),
      };
      onAdded(newItem);
      onClose();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div
        className="bg-white rounded-xl border shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ borderColor: "var(--color-rule)" }}
      >
        {/* Modal header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-rule)" }}
        >
          <h2 className="font-serif text-[18px] font-semibold" style={{ color: "var(--color-ink)" }}>
            Add product
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[16px]"
            style={{ color: "var(--color-ink-dim)", background: "var(--color-parchment)" }}
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {error}
            </div>
          )}

          <div>
            <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>
              Product name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Navy Shorts"
              className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
              style={{ borderColor: "var(--color-rule)", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none bg-white"
                style={{ borderColor: "var(--color-rule)", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="type-label block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full h-9 border rounded-md px-3 text-[13px] outline-none"
                style={{ borderColor: "var(--color-rule)", fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
              />
            </div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="type-label" style={{ color: "var(--color-ink-dim)" }}>
                Variants (size / price) *
              </label>
              <button
                type="button"
                onClick={addVariant}
                className="text-[11.5px] font-semibold"
                style={{ color: accent }}
              >
                + Add variant
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={v.label}
                    onChange={(e) => updateVariant(i, "label", e.target.value)}
                    placeholder="Label (e.g. Size 10–16)"
                    className="flex-1 h-8 border rounded-md px-2.5 text-[12.5px] outline-none"
                    style={{ borderColor: "var(--color-rule)", fontFamily: "var(--font-sans)" }}
                  />
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>$</span>
                    <input
                      value={v.price}
                      onChange={(e) => updateVariant(i, "price", e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full h-8 border rounded-md pl-6 pr-2 text-[12.5px] outline-none"
                      style={{ borderColor: "var(--color-rule)", fontFamily: "var(--font-sans)" }}
                    />
                  </div>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(i)}
                      className="w-7 h-7 flex items-center justify-center rounded text-[13px]"
                      style={{ color: "#B23A2A", background: "#FEF2F2" }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 text-[13px] font-semibold rounded-md border"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-9 text-[13px] font-semibold rounded-md text-white disabled:opacity-60"
              style={{ background: accent }}
            >
              {saving ? "Saving…" : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  const [activeCategory, setActiveCategory] = useState<ItemCategory | "All">("All");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [tableError, setTableError] = useState("");

  const filtered = items.filter((it) => {
    const matchCat = activeCategory === "All" || it.category === activeCategory;
    const matchSearch =
      !search ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const previousItems = items;
    setTableError("");
    // Optimistic update
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, name: trimmed } : it)));
    setEditingId(null);
    try {
      const res = await fetch(`/api/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update item.");
      }
    } catch (err) {
      console.error("Failed to update item:", err);
      setItems(previousItems);
      setTableError(err instanceof Error ? err.message : "Failed to update item.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this product from the catalog?")) return;
    const previousItems = items;
    setTableError("");
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      const res = await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete item.");
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      setItems(previousItems);
      setTableError(err instanceof Error ? err.message : "Failed to delete item.");
    }
  };

  const handleAdded = (newItem: DbItem) => {
    setTableError("");
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {showAddModal && (
        <AddProductModal
          tenantId={tenantId}
          accent={tenant.accent}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}

      {tableError && (
        <div className="mb-3 text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {tableError}
        </div>
      )}

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
        <div className="flex gap-1.5 flex-1">
          {(["All", ...CATEGORIES] as const).map((c) => (
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
        <button
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 text-[12.5px] font-semibold rounded-md text-white flex items-center gap-1.5 flex-shrink-0"
          style={{ background: tenant.accent }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add product
        </button>
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
              {filtered.map((it) => {
                const prices = it.variants.map((v) => parseFloat(v.price));
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const isEditing = editingId === it.id;
                const cat = it.category as ItemCategory;
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
                      {it.id.length > 20 ? it.id.slice(0, 20) + "…" : it.id}
                    </td>
                    <td className="py-2.5 px-3 font-medium" style={{ color: "var(--color-ink)" }}>
                      {isEditing ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="border rounded px-2 py-1 text-[12.5px] w-full"
                          style={{ borderColor: tenant.accent, outline: "none" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(it.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Chip tone={CATEGORY_TONE[cat] ?? "neutral"} size="sm">
                        {it.category}
                      </Chip>
                    </td>
                    <td className="py-2.5 px-3 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                      {it.variants.map((v) => v.label).join(", ")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                      {prices.length === 0 ? "—" : minP === maxP ? `$${minP}` : `$${minP} – $${maxP}`}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(it.id)}
                              className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                              style={{ borderColor: tenant.accent, color: tenant.accent }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(it.id, it.name)}
                              className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(it.id)}
                              className="h-7 px-2.5 text-[11.5px] font-semibold rounded border"
                              style={{ borderColor: "#E5BDB4", color: "#B23A2A" }}
                            >
                              Remove
                            </button>
                          </>
                        )}
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
          <span>{filtered.length} products shown</span>
          <span>{items.reduce((s, it) => s + it.variants.length, 0)} variants total</span>
        </div>
      </div>
    </div>
  );
}
