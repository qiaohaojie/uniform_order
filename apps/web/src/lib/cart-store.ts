"use client";

import { useEffect, useState } from "react";
import type { CartLine } from "./data";
import { SAMPLE_CART } from "./data";

const STORAGE_KEY = "uo:cart:v1";

function read(): CartLine[] {
  if (typeof window === "undefined") return SAMPLE_CART;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SAMPLE_CART;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : SAMPLE_CART;
  } catch {
    return SAMPLE_CART;
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

export function useCart(): {
  lines: CartLine[];
  hydrated: boolean;
  setQty: (idx: number, qty: number) => void;
  remove: (idx: number) => void;
  add: (line: CartLine) => void;
  reset: () => void;
} {
  const [lines, setLines] = useState<CartLine[]>(SAMPLE_CART);
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
        if (next[idx]) next[idx] = { ...next[idx], qty: Math.max(0, qty) };
        return next.filter((l) => l.qty > 0);
      }),
    remove: (idx) => setLines((prev) => prev.filter((_, i) => i !== idx)),
    add: (line) =>
      setLines((prev) => {
        const i = prev.findIndex(
          (l) => l.itemId === line.itemId && l.variantLabel === line.variantLabel && l.size === line.size,
        );
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: next[i].qty + line.qty };
          return next;
        }
        return [...prev, line];
      }),
    reset: () => setLines(SAMPLE_CART),
  };
}
