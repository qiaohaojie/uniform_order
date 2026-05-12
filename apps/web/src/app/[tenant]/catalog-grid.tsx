"use client";

import Link from "next/link";
import type { CatalogItem } from "@/lib/data";
import { CATEGORIES } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { SearchIcon } from "@/components/icons";

type CatalogGridProps = {
  items: CatalogItem[];
  activeCat: string;
  tenantId: string;
  accent: string;
};

export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
  const visible = items.filter((i) => i.cat === activeCat);

  return (
    <>
      {/* Search (still static in this task; wired up in Task 3) */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }}><SearchIcon size={16} /></span>
          <span className="text-[13px]" style={{ color: "var(--color-ink-dim)" }}>Search uniforms</span>
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 pt-2.5 pb-1 flex gap-2 overflow-x-auto flex-shrink-0 [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((c) => {
          const on = c === activeCat;
          return (
            <Link
              key={c}
              href={`/${tenantId}?cat=${c}`}
              scroll={false}
              className="h-[30px] px-3 rounded-full inline-flex items-center text-[12px] font-semibold flex-shrink-0 border"
              style={{
                borderColor: on ? accent : "var(--color-rule)",
                background: on ? accent : "#fff",
                color: on ? "#fff" : "var(--color-ink)",
              }}
            >
              {c}
            </Link>
          );
        })}
      </div>

      {/* Result-count line */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
        <h3 className="font-serif text-[18px] font-medium m-0">{activeCat} Uniform</h3>
        <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>· {visible.length} items</span>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
        {visible.map((it) => {
          const minP = Math.min(...it.variants.map((v) => v.price));
          const maxP = Math.max(...it.variants.map((v) => v.price));
          return (
            <Link
              key={it.id}
              href={`/${tenantId}/item/${it.id}`}
              className="bg-white rounded-[10px] border overflow-hidden block"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <GarmentVector itemId={it.id} accent={accent} size={120} className="w-full h-auto block" />
              <div className="px-2.5 pt-2 pb-2.5">
                <div className="font-serif text-[13px] font-medium leading-[1.2] line-clamp-2 min-h-8" style={{ color: "var(--color-ink)" }}>
                  {it.name}
                </div>
                <div className="mt-1.5 text-[12px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>
                  ${minP}
                  {minP !== maxP && (
                    <span className="font-normal" style={{ color: "var(--color-ink-dim)" }}> – ${maxP}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
