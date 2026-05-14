"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UploadDropzone } from "@/components/uploadthing";
import { GarmentVector } from "@/components/garment";
import type { Tenant } from "@/lib/data";
import { ITEM_CATEGORIES } from "@/lib/schemas/catalog";

type ZodFlatten = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

function formatZodErrors(details: ZodFlatten | unknown): string {
  if (!details || typeof details !== "object") return "Invalid input.";
  const { formErrors, fieldErrors } = details as ZodFlatten;
  const lines: string[] = [];
  if (Array.isArray(formErrors)) lines.push(...formErrors);
  if (fieldErrors) {
    for (const [field, msgs] of Object.entries(fieldErrors)) {
      if (msgs?.length) lines.push(`${field}: ${msgs[0]}`);
    }
  }
  return lines.length > 0 ? lines.join("; ") : "Invalid input.";
}

/** Form-level variant state — `sizes` is a raw comma-separated string. */
type Variant = {
  /** Server-assigned id; present only for variants loaded from DB. */
  id?: string;
  label: string;
  price: string;
  /** Comma-separated string in the form; converted to string[] on save. */
  sizes: string;
  active?: boolean;
};

/** Variant shape coming from the DB / parent (sizes is already string[]). */
type InitialVariant = {
  id?: string;
  label: string;
  price: string | number;
  sizes?: string[];
  active?: boolean;
};

type Mode = { kind: "create" } | { kind: "edit"; itemId: string };

export type ItemDrawerInitial = {
  name?: string;
  category?: typeof ITEM_CATEGORIES[number];
  description?: string;
  imageUrl?: string;
  active?: boolean;
  sortOrder?: number;
  variants?: InitialVariant[];
  sizeGuide?: { unit: string; cols: string[]; rows: string[][] } | null;
};

type SizeGuideForm = {
  unit: string;
  colsRaw: string;
  rows: string[][];
};

function parseCols(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function syncRows(rows: string[][], newColCount: number): string[][] {
  return rows.map((row) => {
    if (row.length === newColCount) return row;
    if (row.length < newColCount) {
      return [...row, ...Array(newColCount - row.length).fill("") as string[]];
    }
    return row.slice(0, newColCount);
  });
}

function toSizeGuidePayload(
  form: SizeGuideForm,
): { unit: string; cols: string[]; rows: string[][] } | null {
  const cols = parseCols(form.colsRaw);
  if (cols.length === 0 || form.rows.length === 0) return null;
  const rows = form.rows.map((r) => syncRows([r], cols.length)[0]);
  return { unit: form.unit.trim() || "cm", cols, rows };
}

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
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<typeof ITEM_CATEGORIES[number]>("Summer");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [variants, setVariants] = useState<Variant[]>([{ label: "", price: "", sizes: "" }]);
  const [sizeGuide, setSizeGuide] = useState<SizeGuideForm>({
    unit: "cm",
    colsRaw: "",
    rows: [],
  });
  const [sizeGuideOpen, setSizeGuideOpen] = useState<boolean>(false);
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
        ? initial.variants.map((v) => ({
            id: v.id,
            label: v.label,
            price: String(v.price),
            sizes: v.sizes?.length ? v.sizes.join(", ") : "",
            active: v.active,
          }))
        : [{ label: "", price: "", sizes: "" }]
    );
    setError(null);
    const sg = initial?.sizeGuide;
    if (sg) {
      setSizeGuide({
        unit: sg.unit,
        colsRaw: sg.cols.join(", "),
        rows: sg.rows.map((r) => [...r]),
      });
      setSizeGuideOpen(true);
    } else {
      setSizeGuide({ unit: "cm", colsRaw: "", rows: [] });
      setSizeGuideOpen(false);
    }
  }, [open, initial]);

  const setVariant = (i: number, patch: Partial<Variant>) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVariant = () => setVariants((prev) => [...prev, { label: "", price: "", sizes: "" }]);
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
      // Use explicit `null` for cleared fields — `undefined` is dropped by
      // JSON.stringify, which makes "Remove image" or a cleared description
      // a no-op on PATCH. The API schema accepts `null | string`.
      const trimmedDesc = description.trim();
      const basePayload = {
        name: name.trim(),
        category,
        description: trimmedDesc.length > 0 ? trimmedDesc : null,
        imageUrl: imageUrl ?? null,
        active,
        sortOrder: initial?.sortOrder ?? 0,
        variants: variants.map((v) => ({
          id: v.id,
          label: v.label.trim(),
          price: Number(v.price),
          sizes: (v.sizes || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          active: v.active,
        })),
        sizeGuide: toSizeGuidePayload(sizeGuide),
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
        } else if (body?.error === "validation_failed" && body?.details) {
          setError(formatZodErrors(body.details));
        } else if (res.status === 429) {
          setError("Too many requests. Wait a moment and try again.");
        } else {
          setError(body?.error ?? `HTTP ${res.status}`);
        }
        return;
      }

      await Promise.resolve(onSaved());
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
                  // mode: "auto" uploads immediately on file pick/drop. The
                  // default "manual" mode requires a second "Upload N file(s)"
                  // click and its queue state has been observed to get stuck
                  // after re-mount cycles (e.g. dev-mode HMR, or open→Remove
                  // →pick within one drawer session).
                  config={{ mode: "auto" }}
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
                <div key={i} className="grid grid-cols-[1fr_100px_1fr_28px] gap-2">
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
                  <input
                    type="text"
                    placeholder="Sizes e.g. 10, 12, 14"
                    value={v.sizes}
                    onChange={(e) => setVariant(i, { sizes: e.target.value })}
                    className="h-8 px-2 text-[12.5px] rounded-md border"
                    style={{ borderColor: "var(--color-rule)" }}
                    aria-label={`Sizes for variant ${i + 1}`}
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

          {/* Size guide */}
          <section>
            <button
              type="button"
              onClick={() => setSizeGuideOpen((v) => !v)}
              aria-expanded={sizeGuideOpen}
              className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.4px]"
            >
              <span>Size guide (optional)</span>
              <span aria-hidden style={{ color: "var(--color-ink-dim)" }}>
                {sizeGuideOpen ? "−" : "+"}
              </span>
            </button>

            {sizeGuideOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-[11px] block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={sizeGuide.unit}
                    onChange={(e) =>
                      setSizeGuide((s) => ({ ...s, unit: e.target.value }))
                    }
                    placeholder="cm"
                    className="w-full border rounded px-2 py-1 text-[13px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                </div>

                <div>
                  <label className="text-[11px] block mb-1" style={{ color: "var(--color-ink-dim)" }}>
                    Columns (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={sizeGuide.colsRaw}
                    onChange={(e) => {
                      const newRaw = e.target.value;
                      setSizeGuide((s) => {
                        const newCount = parseCols(newRaw).length;
                        return {
                          ...s,
                          colsRaw: newRaw,
                          rows: syncRows(s.rows, newCount),
                        };
                      });
                    }}
                    placeholder="Size, Chest, Length"
                    className="w-full border rounded px-2 py-1 text-[13px]"
                    style={{ borderColor: "var(--color-rule)" }}
                  />
                </div>

                {(() => {
                  const cols = parseCols(sizeGuide.colsRaw);
                  if (cols.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <div className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                        Rows
                      </div>
                      <table className="w-full text-[12px] tnum">
                        <thead>
                          <tr style={{ color: "var(--color-ink-dim)" }}>
                            {cols.map((c, ci) => (
                              <th key={ci} className="text-left font-semibold py-1 pr-2">{c}</th>
                            ))}
                            <th aria-hidden />
                          </tr>
                        </thead>
                        <tbody>
                          {sizeGuide.rows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="py-1 pr-2">
                                  <input
                                    type="text"
                                    value={cell}
                                    aria-label={`${cols[ci] ?? `Column ${ci + 1}`}, row ${ri + 1}`}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setSizeGuide((s) => {
                                        const rows = s.rows.map((r) => [...r]);
                                        rows[ri][ci] = newVal;
                                        return { ...s, rows };
                                      });
                                    }}
                                    className="w-full border rounded px-2 py-1 text-[12px]"
                                    style={{ borderColor: "var(--color-rule)" }}
                                  />
                                </td>
                              ))}
                              <td className="py-1 pl-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSizeGuide((s) => ({
                                      ...s,
                                      rows: s.rows.filter((_, i) => i !== ri),
                                    }))
                                  }
                                  aria-label={`Remove row ${ri + 1}`}
                                  className="text-[14px]"
                                  style={{ color: "var(--color-ink-dim)" }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        type="button"
                        onClick={() =>
                          setSizeGuide((s) => {
                            const colCount = parseCols(s.colsRaw).length;
                            return {
                              ...s,
                              rows: [...s.rows, Array(colCount).fill("") as string[]],
                            };
                          })
                        }
                        className="text-[12px] underline mt-1"
                        style={{ color: tenant.accent }}
                      >
                        + Add row
                      </button>
                    </div>
                  );
                })()}

                {(sizeGuide.colsRaw.length > 0 || sizeGuide.rows.length > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      setSizeGuide({ unit: "cm", colsRaw: "", rows: [] })
                    }
                    className="text-[12px] underline"
                    style={{ color: "var(--color-ink-dim)" }}
                  >
                    Remove size guide
                  </button>
                )}
              </div>
            )}
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
