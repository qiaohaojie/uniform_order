"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UploadDropzone } from "@/components/uploadthing";
import { GarmentVector } from "@/components/garment";
import type { Tenant } from "@/lib/data";
import { ITEM_CATEGORIES } from "@/lib/schemas/catalog";

type Variant = { label: string; price: string; active?: boolean };

type Mode = { kind: "create" } | { kind: "edit"; itemId: string };

export type ItemDrawerInitial = {
  name?: string;
  category?: typeof ITEM_CATEGORIES[number];
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  variants?: Variant[];
};

export function ItemDrawer({
  tenant,
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  open: boolean;
  mode: Mode;
  initial?: ItemDrawerInitial;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof ITEM_CATEGORIES[number]>("Summer");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([{ label: "", price: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with `initial` when drawer opens
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "Summer");
    setDescription(initial?.description ?? "");
    setImageUrl(initial?.imageUrl);
    setActive(initial?.active ?? true);
    setVariants(
      initial?.variants?.length
        ? initial.variants.map((v) => ({ label: v.label, price: v.price, active: v.active }))
        : [{ label: "", price: "" }]
    );
    setError(null);
  }, [open, initial]);

  const setVariant = (i: number, patch: Partial<Variant>) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVariant = () => setVariants((prev) => [...prev, { label: "", price: "" }]);
  const removeVariant = (i: number) =>
    setVariants((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const isValid =
    name.trim().length > 0 &&
    name.length <= 80 &&
    description.length <= 500 &&
    variants.length >= 1 &&
    variants.every((v) => v.label.trim().length > 0 && Number(v.price) > 0);

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const basePayload = {
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        imageUrl,
        active,
        sortOrder: initial?.sortOrder ?? 0,
        variants: variants.map((v) => ({
          label: v.label.trim(),
          price: Number(v.price),
          active: v.active,
        })),
      };

      const url =
        mode.kind === "create" ? `/api/catalog` : `/api/catalog/${mode.itemId}`;
      const method = mode.kind === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode.kind === "create"
            ? { tenantId: tenant.id, ...basePayload }
            : basePayload
        ),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 403 && body?.code === "tenant_not_approved") {
          setError("This school is not yet approved on the platform.");
        } else {
          setError(body?.error ?? `HTTP ${res.status}`);
        }
        return;
      }

      onSaved();
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Catalog save failed:", err);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode.kind === "create" ? "Add item" : "Edit item"}
        className="relative w-[440px] max-w-full bg-white shadow-xl flex flex-col h-full"
      >
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--color-rule)" }}>
          <div
            className="text-[10.5px] font-bold uppercase tracking-[0.5px]"
            style={{ color: tenant.accent }}
          >
            {mode.kind === "create" ? "Add item" : "Edit item"}
          </div>
          <h2 className="font-serif text-[20px] font-medium mt-1">
            {mode.kind === "create" ? "New catalog item" : initial?.name ?? "Edit"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Image */}
          <section>
            <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-2">
              Image
            </label>
            {imageUrl ? (
              <div className="flex items-start gap-3">
                <Image
                  src={imageUrl}
                  alt="Item preview"
                  width={96}
                  height={96}
                  className="rounded-md border"
                  style={{ borderColor: "var(--color-rule)" }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  className="text-[12px] underline"
                  style={{ color: tenant.accent }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadDropzone
                  endpoint="catalogImage"
                  input={{ tenantId: tenant.id }}
                  onClientUploadComplete={(res) => {
                    const url = res?.[0]?.serverData?.url;
                    if (url) setImageUrl(url);
                  }}
                  onUploadError={(err) => {
                    const msg = err.message;
                    if (msg.includes("tenant_not_approved")) {
                      setError("This school is not yet approved on the platform.");
                    } else {
                      setError(msg);
                    }
                  }}
                />
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                  <span>No image? Parents will see this fallback:</span>
                  <GarmentVector category={category} accent={tenant.accent} size={32} />
                </div>
              </div>
            )}
          </section>

          {/* Name */}
          <section>
            <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full h-9 px-3 text-[13px] rounded-md border"
              style={{ borderColor: "var(--color-rule)" }}
            />
            <div className="text-[10.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
              {name.length} / 80
            </div>
          </section>

          {/* Category */}
          <section>
            <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof ITEM_CATEGORIES[number])}
              className="w-full h-9 px-3 text-[13px] rounded-md border"
              style={{ borderColor: "var(--color-rule)" }}
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </section>

          {/* Description */}
          <section>
            <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Short description shown on the item page"
              className="w-full px-3 py-2 text-[13px] rounded-md border"
              style={{ borderColor: "var(--color-rule)" }}
            />
            <div className="text-[10.5px] mt-1" style={{ color: "var(--color-ink-dim)" }}>
              {description.length} / 500
            </div>
          </section>

          {/* Variants */}
          <section>
            <label className="text-[11px] font-bold uppercase tracking-[0.4px] block mb-2">
              Variants (size + price)
            </label>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_28px] gap-2">
                  <input
                    type="text"
                    placeholder="Label e.g. Size 10"
                    value={v.label}
                    maxLength={40}
                    onChange={(e) => setVariant(i, { label: e.target.value })}
                    className="h-8 px-2 text-[12.5px] rounded-md border"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Price (AUD)"
                    value={v.price}
                    onChange={(e) => setVariant(i, { price: e.target.value })}
                    className="h-8 px-2 text-[12.5px] rounded-md border tnum"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    disabled={variants.length === 1}
                    className="h-8 text-[16px] disabled:opacity-30"
                    aria-label={`Remove variant ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="text-[12px] underline mt-2"
              style={{ color: tenant.accent }}
            >
              + Add variant
            </button>
          </section>

          {/* Active toggle */}
          <section className="flex items-center gap-2">
            <input
              id="item-active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <label htmlFor="item-active" className="text-[13px]">
              Active (visible to parents)
            </label>
          </section>

          {error && (
            <div className="text-[12.5px] px-3 py-2 rounded" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: "var(--color-rule)" }}>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[12.5px] font-semibold rounded-md border"
            style={{ borderColor: "var(--color-rule)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="h-9 px-4 text-[12.5px] font-semibold rounded-md text-white disabled:opacity-50"
            style={{ background: tenant.accent }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
