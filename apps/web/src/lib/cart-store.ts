"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "./data";

const STORAGE_KEY = "uo:cart:v1";

function finiteQtyOnHand(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampQty(qty: number, qtyOnHand: number | undefined): number {
  const next = Math.max(0, qty);
  const cap = finiteQtyOnHand(qtyOnHand);
  return cap === undefined ? next : Math.min(next, cap);
}

/** True when a finite qtyOnHand cap exists and qty is already at/above it. */
export function isAtQtyCap(line: Pick<CartLine, "qty" | "qtyOnHand">): boolean {
  const cap = finiteQtyOnHand(line.qtyOnHand);
  return cap !== undefined && line.qty >= cap;
}

function read(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as CartLine[])
      .map((line) => ({ ...line, qty: clampQty(line.qty, line.qtyOnHand) }))
      .filter((line) => line.qty > 0);
  } catch {
    return [];
  }
}

function write(lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // ignore quota errors — non-critical for demo
  }
}

export function cartLinePrelovedSkuId(
  line: Pick<CartLine, "prelovedSkuId">,
): string | undefined {
  return typeof line.prelovedSkuId === "string" && line.prelovedSkuId.length > 0
    ? line.prelovedSkuId
    : undefined;
}

export function isPrelovedLine(
  line: CartLine,
): line is CartLine & { prelovedSkuId: string } {
  return cartLinePrelovedSkuId(line) !== undefined;
}

function findMergeIndex(prev: CartLine[], line: CartLine): number {
  const incomingSkuId = cartLinePrelovedSkuId(line);
  if (incomingSkuId) {
    return prev.findIndex((existing) => cartLinePrelovedSkuId(existing) === incomingSkuId);
  }
  return prev.findIndex(
    (existing) =>
      !cartLinePrelovedSkuId(existing) &&
      existing.itemId === line.itemId &&
      existing.variantLabel === line.variantLabel &&
      existing.size === line.size,
  );
}

export function useCart(): {
  lines: CartLine[];
  hydrated: boolean;
  setQty: (idx: number, qty: number) => void;
  remove: (idx: number) => void;
  add: (line: CartLine) => void;
  clearCart: () => void;
} {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(read());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) write(lines);
  }, [lines, hydrated]);

  return {
    lines,
    hydrated,
    setQty: (idx, qty) =>
      setLines((prev) => {
        const next = [...prev];
        const existing = next[idx];
        if (existing) {
          next[idx] = { ...existing, qty: clampQty(qty, existing.qtyOnHand) };
        }
        return next.filter((l) => l.qty > 0);
      }),
    remove: (idx) => setLines((prev) => prev.filter((_, i) => i !== idx)),
    add: (line) =>
      setLines((prev) => {
        const i = findMergeIndex(prev, line);
        if (i >= 0) {
          const next = [...prev];
          const existing = next[i]!;
          const cap = finiteQtyOnHand(line.qtyOnHand) ?? finiteQtyOnHand(existing.qtyOnHand);
          next[i] = {
            ...existing,
            qty: clampQty(existing.qty + line.qty, cap),
            ...(cap !== undefined ? { qtyOnHand: cap } : {}),
          };
          return next.filter((l) => l.qty > 0);
        }
        const qty = clampQty(line.qty, line.qtyOnHand);
        if (qty <= 0) return prev;
        return [...prev, { ...line, qty }];
      }),
    clearCart: () => setLines([]),
  };
}
