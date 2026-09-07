"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Tenant } from "@/lib/data";
import { useCart } from "@/lib/cart-store";
import { PRELOVED_VARIANT_LABEL, type ShopPrelovedSku } from "@/lib/preloved";
import { Btn } from "@/components/btn";
import { ShopPhoneNav } from "@/components/shop-phone-nav";
import { posthog } from "@/lib/analytics/client";

export function PrelovedSkuInteractive({
  tenant,
  sku,
  garment,
  children,
}: {
  tenant: Tenant;
  sku: ShopPrelovedSku;
  garment: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { lines, add } = useCart();
  const maxQty = Math.max(1, sku.qtyOnHand);
  const [qty, setQty] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const atMin = qty <= 1;
  const atMax = qty >= maxQty;

  const onAdd = () => {
    const nextQty = Math.min(Math.max(1, qty), maxQty);
    add({
      itemId: sku.sourceItemId,
      variantLabel: PRELOVED_VARIANT_LABEL,
      size: sku.size,
      qty: nextQty,
      price: sku.price,
      name: sku.itemName,
      prelovedSkuId: sku.id,
      condition: sku.condition,
      qtyOnHand: sku.qtyOnHand,
    });
    posthog.capture("item_added_to_cart", {
      item_id: sku.sourceItemId,
      item_name: sku.itemName,
      variant: PRELOVED_VARIANT_LABEL,
      size: sku.size,
      qty: nextQty,
      unit_price: sku.price,
      line_total: sku.price * nextQty,
      tenant_id: tenant.id,
      preloved_sku_id: sku.id,
      condition: sku.condition,
    });
    router.push(`/${tenant.id}/cart`);
  };

  return (
    <>
      <ShopPhoneNav
        tenant={tenant}
        cartCount={cartCount}
        title={sku.itemName.split(" — ")[0] ?? sku.itemName}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {garment}
        {children}
      </div>

      <div
        className="px-4 pt-3 pb-6 border-t bg-white flex items-center gap-2.5 flex-shrink-0"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div
          className="flex items-center border rounded-lg h-11 overflow-hidden"
          style={{ borderColor: "var(--color-rule)" }}
          aria-label={`Quantity, ${sku.qtyOnHand} on hand`}
          data-testid="preloved-qty-stepper"
          data-qty-on-hand={sku.qtyOnHand}
          data-hydrated={hydrated ? "true" : "false"}
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={atMin}
            className="w-9 h-11 flex items-center justify-center text-[18px] disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ color: "var(--color-ink)" }}
            aria-label="Decrease quantity"
            data-testid="preloved-qty-decrease"
          >
            −
          </button>
          <div
            className="w-7 text-center text-[14px] font-bold tnum"
            data-testid="preloved-qty"
          >
            {qty}
          </div>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={atMax}
            className="w-9 h-11 flex items-center justify-center text-[16px] disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ color: "var(--color-ink)" }}
            aria-label="Increase quantity"
            data-testid="preloved-qty-increase"
          >
            +
          </button>
        </div>
        <Btn
          variant="primary"
          size="lg"
          fullWidth
          accent={tenant.accent}
          onClick={onAdd}
          data-testid="preloved-add-to-cart"
        >
          Add to cart · ${sku.price * qty}
        </Btn>
      </div>
    </>
  );
}
