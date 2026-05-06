"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CatalogItem, Tenant } from "@/lib/data";
import { useCart } from "@/lib/cart-store";
import { Btn } from "@/components/btn";
import { BackIcon, CartIcon, CheckIcon } from "@/components/icons";
import { posthog } from "@/lib/analytics/client";

export function ItemDetailInteractive({
  tenant,
  item,
  garment,
  children,
}: {
  tenant: Tenant;
  item: CatalogItem;
  garment: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { lines, add } = useCart();
  const [variantIdx, setVariantIdx] = useState(0);
  const [size, setSize] = useState(item.variants[0]?.sizes[Math.min(2, item.variants[0].sizes.length - 1)] ?? "");
  const [qty, setQty] = useState(1);
  const [showGuide, setShowGuide] = useState(false);

  const variant = item.variants[variantIdx]!;
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);

  const onAdd = () => {
    add({
      itemId: item.id,
      variantLabel: variant.label,
      size,
      qty,
      price: variant.price,
      name: item.name,
    });
    posthog.capture("item_added_to_cart", {
      item_id: item.id,
      item_name: item.name,
      variant: variant.label,
      size,
      qty,
      unit_price: variant.price,
      line_total: variant.price * qty,
      tenant_id: tenant.id,
    });
    router.push(`/${tenant.id}/cart`);
  };

  return (
    <>
      <PhoneNav tenant={tenant} cartCount={cartCount} title={item.name.split(" — ")[0]} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {garment}
        {children}

        <div className="px-5 pb-3">
          <div className="flex justify-between items-baseline mb-2">
            <div className="font-sans text-[11px] font-bold tracking-[1px] uppercase" style={{ color: "var(--color-ink)" }}>
              Fit
            </div>
            {item.sizeGuide && (
              <button
                type="button"
                onClick={() => setShowGuide((v) => !v)}
                className="text-[11px] font-semibold underline"
                style={{ color: tenant.accent }}
              >
                Size guide
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {item.variants.map((v, i) => {
              const on = i === variantIdx;
              return (
                <button
                  type="button"
                  key={v.label}
                  onClick={() => {
                    setVariantIdx(i);
                    setSize(v.sizes[Math.min(2, v.sizes.length - 1)] ?? "");
                  }}
                  className="h-11 rounded-lg px-3.5 flex items-center justify-between text-left border"
                  style={{
                    borderColor: on ? tenant.accent : "var(--color-rule)",
                    background: on ? "#FBF5F4" : "#fff",
                  }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>{v.label}</span>
                  <span className="text-[13px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>${v.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {showGuide && item.sizeGuide && (
          <div className="px-5 pb-3">
            <div className="rounded-lg border bg-white p-3" style={{ borderColor: "var(--color-rule)" }}>
              <div className="text-[10px] uppercase tracking-[1px] font-bold mb-1.5" style={{ color: "var(--color-ink-dim)" }}>
                Size guide ({item.sizeGuide.unit})
              </div>
              <table className="w-full text-[11px] tnum">
                <thead>
                  <tr style={{ color: "var(--color-ink-dim)" }}>
                    {item.sizeGuide.cols.map((c) => (
                      <th key={c} className="text-left font-semibold py-1 pr-2">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.sizeGuide.rows.map((row, ri) => (
                    <tr key={ri} className="border-t" style={{ borderColor: "var(--color-rule)" }}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-1 pr-2 font-medium" style={{ color: "var(--color-ink)" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="px-5 pt-1.5 pb-2">
          <div className="font-sans text-[11px] font-bold tracking-[1px] uppercase mb-2" style={{ color: "var(--color-ink)" }}>
            Size
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {variant.sizes.map((s) => {
              const on = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className="h-[42px] rounded-md flex items-center justify-center text-[13px] font-bold border"
                  style={{
                    borderColor: on ? tenant.accent : "var(--color-rule)",
                    background: on ? tenant.accent : "#fff",
                    color: on ? "#fff" : "var(--color-ink)",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] flex items-center gap-1.5" style={{ color: "var(--color-ink-dim)" }}>
            <span style={{ color: "var(--color-success)" }}><CheckIcon size={12} /></span>
            <span>Tim wore size 14 last year</span>
          </div>
        </div>
      </div>

      <div
        className="px-4 pt-3 pb-6 border-t bg-white flex items-center gap-2.5 flex-shrink-0"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div
          className="flex items-center border rounded-lg h-11 overflow-hidden"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-9 h-11 flex items-center justify-center text-[18px]"
            style={{ color: "var(--color-ink)" }}
          >
            −
          </button>
          <div className="w-7 text-center text-[14px] font-bold tnum">{qty}</div>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="w-9 h-11 flex items-center justify-center text-[16px]"
            style={{ color: "var(--color-ink)" }}
          >
            +
          </button>
        </div>
        <Btn variant="primary" size="lg" fullWidth accent={tenant.accent} onClick={onAdd}>
          Add to cart · ${variant.price * qty}
        </Btn>
      </div>
    </>
  );
}

function PhoneNav({ tenant, cartCount, title }: { tenant: Tenant; cartCount: number; title: string }) {
  return (
    <div className="px-4 pt-1.5 pb-3 flex items-center gap-2.5 flex-shrink-0">
      <Link
        href={`/${tenant.id}`}
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: "var(--color-parchment)" }}
        aria-label="Back"
      >
        <BackIcon size={18} />
      </Link>
      <div
        className="flex-1 text-center font-serif text-[17px] font-semibold tracking-[0.1px]"
        style={{ color: tenant.accent }}
      >
        {title}
      </div>
      <Link
        href={`/${tenant.id}/cart`}
        className="w-9 flex justify-end relative"
        style={{ color: "var(--color-ink)" }}
        aria-label="Cart"
      >
        <CartIcon size={22} />
        {cartCount > 0 && (
          <span
            className="absolute -top-1 right-0 rounded-[10px] text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center text-white"
            style={{ background: tenant.accent }}
          >
            {cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}
