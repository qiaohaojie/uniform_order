"use client";

import { Crest } from "@/components/crest";

const STUB_ITEMS = [
  { name: "Year 7 Blazer", price: "$185" },
  { name: "School Tie", price: "$24" },
];

export function BrandingPreview({
  tenantName,
  short,
  accent,
  logoUrl,
  motto,
}: {
  tenantName: string;
  short: string;
  accent: string;
  logoUrl: string | null;
  motto: string;
}) {
  return (
    <div className="w-full max-w-[300px]">
      <div className="text-[11px] font-bold uppercase tracking-[0.6px] mb-2 text-ink-dim">
        Live preview · parent shop
      </div>
      <div className="rounded-[24px] border-[8px] border-[#222] bg-parchment overflow-hidden">
        {/* header */}
        <div
          className="px-3 py-2.5 flex items-center gap-2 text-white"
          style={{ background: accent }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-6 h-6 rounded-sm bg-white object-contain"
            />
          ) : (
            <Crest tenant={{ id: "preview", accent, short }} size={24} ring={false} />
          )}
          <div className="font-serif text-sm font-semibold truncate">{tenantName}</div>
        </div>

        {/* body */}
        <div className="px-3 py-3 text-[11px] text-ink">
          {motto ? (
            <div className="italic mb-2" style={{ color: accent }}>
              {motto}
            </div>
          ) : null}
          {STUB_ITEMS.map((it) => (
            <div
              key={it.name}
              className="bg-paper border border-rule rounded-md px-2 py-1.5 mb-1.5 flex justify-between"
            >
              <span>{it.name}</span>
              <span className="tnum">{it.price}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-ink-dim mt-1.5">Updates as you edit.</p>
    </div>
  );
}
