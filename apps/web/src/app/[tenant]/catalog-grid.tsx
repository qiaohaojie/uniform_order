"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogItem } from "@/lib/data";
import { CATEGORIES } from "@/lib/data";
import { GarmentVector } from "@/components/garment";
import { SearchIcon, ClearIcon } from "@/components/icons";

type CatalogGridProps = {
  items: CatalogItem[];
  activeCat: string;
  tenantId: string;
  accent: string;
};

export function CatalogGrid({ items, activeCat, tenantId, accent }: CatalogGridProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const clearSearch = () => {
    setQ("");
    inputRef.current?.focus();
  };
  const query = q.trim().toLowerCase();
  const visible = query
    ? items.filter((it) => (it.name + " " + it.cat).toLowerCase().includes(query))
    : items.filter((i) => i.cat === activeCat);

  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounced(query === "" ? "" : `${visible.length} results for ${q.trim()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, query, visible.length]);

  return (
    <>
      {/* Search */}
      <div className="px-4 pt-3.5 pb-1.5 flex-shrink-0">
        <div
          className="h-10 rounded-lg bg-white flex items-center px-3 gap-2 border focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[var(--color-ink)]"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span style={{ color: "var(--color-ink-dim)" }} aria-hidden="true">
            <SearchIcon size={16} />
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search uniforms"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search uniforms"
            className="flex-1 bg-transparent outline-none text-[13px] focus-visible:outline-none placeholder:text-[color:var(--color-ink-dim)]"
          />
          {q.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="w-6 h-6 flex items-center justify-center rounded-full"
              style={{ color: "var(--color-ink-dim)" }}
            >
              <ClearIcon size={14} />
            </button>
          )}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announced}
        </span>
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

      {/* Result-count line (suppressed on empty-match — the empty state below carries the message) */}
      {!(query && visible.length === 0) && (
        <div className="px-4 pt-3 pb-2 flex-shrink-0 flex items-baseline gap-2">
          <h3 className="font-serif text-[18px] font-medium m-0">
            {query ? `Results for "${q.trim()}"` : `${activeCat} Uniform`}
          </h3>
          <span className="text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
            · {visible.length} {visible.length === 1 ? "item" : "items"}
            {query ? " in all categories" : ""}
          </span>
        </div>
      )}

      {/* Grid or empty state */}
      {visible.length === 0 && query ? (
        <div className="flex-1 px-4 pb-3 flex flex-col items-start gap-3 pt-2">
          <p className="text-[13px] m-0" style={{ color: "var(--color-ink)" }}>
            No items match &ldquo;{q.trim()}&rdquo;.
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className="text-[13px] underline font-semibold"
            style={{ color: "var(--color-ink)" }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex-1 px-4 pb-3 grid grid-cols-2 gap-3 content-start">
          {visible.map((it) => {
            const prices = it.variants.map((v) => v.price);
            const minP = prices.length > 0 ? Math.min(...prices) : 0;
            const maxP = prices.length > 0 ? Math.max(...prices) : 0;
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
      )}
    </>
  );
}
