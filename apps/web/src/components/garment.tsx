// Flat-vector silhouettes of uniform pieces, keyed by item id. Avoids stock
// photography while keeping each item recognisable.

import * as React from "react";
import { shade } from "@/lib/ui";
import {
  SummerDefault,
  WinterDefault,
  SportsDefault,
  FormalDefault,
  BagsDefault,
  StationeryDefault,
} from "./garment-defaults";
import type { ItemCategory } from "@/lib/data";

const ITEM_TO_SHAPE: Record<string, string> = {
  "shirt-ss": "shirt", "shirt-ls": "shirt", polo: "shirt",
  jumper: "jumper", hoodie: "jumper", jacket: "jumper",
  trousers: "pants", "shorts-sport": "pants", tracks: "pants",
  cap: "cap",
  "sock-white": "sock", "sock-sport": "sock",
  backpack: "bag", sportsbag: "bag",
  blazer: "blazer", tie: "tie", belt: "belt",
  calc: "misc", mathset: "misc",
};

const CATEGORY_DEFAULT: Record<ItemCategory, React.FC<{ accent: string; stroke: string; size: number }>> = {
  Summer: SummerDefault,
  Winter: WinterDefault,
  Sports: SportsDefault,
  Formal: FormalDefault,
  Bags: BagsDefault,
  Stationery: StationeryDefault,
};

export function GarmentVector({
  itemId,
  category,
  accent = "#1B3A5F",
  size = 120,
  className,
}: {
  itemId?: string;
  category?: ItemCategory;
  accent?: string;
  size?: number;
  className?: string;
}) {
  const a = accent;
  const stroke = shade(a, -18);
  const shape = itemId ? ITEM_TO_SHAPE[itemId] : undefined;

  // Specific id-keyed illustration takes priority for the seeded items.
  // Otherwise, if a category is supplied, render its default glyph.
  if (!shape && category) {
    const Default = CATEGORY_DEFAULT[category];
    return (
      <span className={className} aria-hidden>
        <Default accent={a} stroke={stroke} size={size} />
      </span>
    );
  }

  // Fallback to legacy "misc" silhouette when neither id nor category matches.
  const resolvedShape = shape ?? "misc";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <rect x="0" y="0" width="120" height="120" fill="#F1ECE0" />
      {resolvedShape === "shirt" && (
        <g>
          <path d="M30 22 L48 14 L60 20 L72 14 L90 22 L98 38 L86 44 L86 100 L34 100 L34 44 L22 38 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M48 14 Q60 24 72 14" fill="none" stroke={stroke} strokeWidth="1.4" />
          <path d="M60 24 V64" stroke={stroke} strokeWidth="1" strokeDasharray="2 3" fill="none" />
          <circle cx="60" cy="42" r="1.2" fill={stroke} />
          <circle cx="60" cy="52" r="1.2" fill={stroke} />
        </g>
      )}
      {resolvedShape === "jumper" && (
        <g>
          <path d="M28 24 L48 16 Q60 30 72 16 L92 24 L100 44 L86 50 L86 102 L34 102 L34 50 L20 44 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M52 22 Q60 30 68 22" stroke={stroke} strokeWidth="1.2" fill="none" />
        </g>
      )}
      {resolvedShape === "pants" && (
        <g>
          <path d="M36 14 H84 L86 56 L78 104 L66 104 L62 60 L58 60 L54 104 L42 104 L34 56 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M60 18 V58" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {resolvedShape === "cap" && (
        <g>
          <path d="M22 70 Q60 30 98 70 L98 78 L22 78 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M22 78 Q60 92 98 78" stroke={stroke} strokeWidth="1.4" fill="none" />
          <circle cx="60" cy="46" r="3" fill={stroke} />
        </g>
      )}
      {resolvedShape === "sock" && (
        <g>
          <path d="M44 16 H76 V60 L66 100 H50 L40 60 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M44 20 H76" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {resolvedShape === "bag" && (
        <g>
          <path d="M30 36 H90 V100 H30 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M44 36 V24 Q60 14 76 24 V36" fill="none" stroke={stroke} strokeWidth="1.4" />
          <rect x="44" y="56" width="32" height="20" fill="none" stroke={stroke} strokeWidth="1" />
        </g>
      )}
      {resolvedShape === "blazer" && (
        <g>
          <path d="M24 22 L48 16 L60 28 L72 16 L96 22 L92 102 L68 102 L60 90 L52 102 L28 102 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M48 16 L60 60 L72 16" stroke={stroke} strokeWidth="1" fill="none" />
        </g>
      )}
      {resolvedShape === "tie" && (
        <g>
          <path d="M50 14 H70 L66 36 L78 90 L60 104 L42 90 L54 36 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M54 36 H66" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {resolvedShape === "belt" && (
        <g>
          <path d="M14 54 H106 V70 H14 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <rect x="48" y="50" width="24" height="24" fill={stroke} stroke={stroke} strokeWidth="1.4" />
          <rect x="54" y="58" width="12" height="8" fill={a} />
        </g>
      )}
      {resolvedShape === "misc" && (
        <g>
          <rect x="32" y="22" width="56" height="80" rx="4" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M40 42 H80 M40 56 H80 M40 70 H68" stroke={stroke} strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
