"use client";

import { useCart } from "@/lib/cart-store";

export function CartBadge({ accent }: { accent?: string }) {
  const { lines, hydrated } = useCart();
  const count = lines.reduce((sum, line) => sum + line.qty, 0);

  if (!hydrated || count === 0) return null;

  return (
    <span
      className="absolute -top-1 -right-1.5 rounded-[10px] text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center"
      style={{ background: "#fff", color: accent || "var(--color-navy)" }}
    >
      {count}
    </span>
  );
}
