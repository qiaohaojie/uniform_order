// Flat-vector silhouettes of uniform pieces, keyed by item id. Avoids stock
// photography while keeping each item recognisable.

function shade(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = pct < 0 ? 1 + pct / 100 : pct / 100;
  if (pct < 0) {
    r = Math.round(r * f);
    g = Math.round(g * f);
    b = Math.round(b * f);
  } else {
    r = Math.round(r + (255 - r) * f);
    g = Math.round(g + (255 - g) * f);
    b = Math.round(b + (255 - b) * f);
  }
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

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

export function GarmentVector({
  itemId,
  accent = "#1B3A5F",
  size = 120,
  className,
}: {
  itemId: string;
  accent?: string;
  size?: number;
  className?: string;
}) {
  const a = accent;
  const stroke = shade(a, -18);
  const shape = ITEM_TO_SHAPE[itemId] ?? "misc";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <rect x="0" y="0" width="120" height="120" fill="#F1ECE0" />
      {shape === "shirt" && (
        <g>
          <path d="M30 22 L48 14 L60 20 L72 14 L90 22 L98 38 L86 44 L86 100 L34 100 L34 44 L22 38 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M48 14 Q60 24 72 14" fill="none" stroke={stroke} strokeWidth="1.4" />
          <path d="M60 24 V64" stroke={stroke} strokeWidth="1" strokeDasharray="2 3" fill="none" />
          <circle cx="60" cy="42" r="1.2" fill={stroke} />
          <circle cx="60" cy="52" r="1.2" fill={stroke} />
        </g>
      )}
      {shape === "jumper" && (
        <g>
          <path d="M28 24 L48 16 Q60 30 72 16 L92 24 L100 44 L86 50 L86 102 L34 102 L34 50 L20 44 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M52 22 Q60 30 68 22" stroke={stroke} strokeWidth="1.2" fill="none" />
        </g>
      )}
      {shape === "pants" && (
        <g>
          <path d="M36 14 H84 L86 56 L78 104 L66 104 L62 60 L58 60 L54 104 L42 104 L34 56 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M60 18 V58" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {shape === "cap" && (
        <g>
          <path d="M22 70 Q60 30 98 70 L98 78 L22 78 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M22 78 Q60 92 98 78" stroke={stroke} strokeWidth="1.4" fill="none" />
          <circle cx="60" cy="46" r="3" fill={stroke} />
        </g>
      )}
      {shape === "sock" && (
        <g>
          <path d="M44 16 H76 V60 L66 100 H50 L40 60 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M44 20 H76" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {shape === "bag" && (
        <g>
          <path d="M30 36 H90 V100 H30 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M44 36 V24 Q60 14 76 24 V36" fill="none" stroke={stroke} strokeWidth="1.4" />
          <rect x="44" y="56" width="32" height="20" fill="none" stroke={stroke} strokeWidth="1" />
        </g>
      )}
      {shape === "blazer" && (
        <g>
          <path d="M24 22 L48 16 L60 28 L72 16 L96 22 L92 102 L68 102 L60 90 L52 102 L28 102 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M48 16 L60 60 L72 16" stroke={stroke} strokeWidth="1" fill="none" />
        </g>
      )}
      {shape === "tie" && (
        <g>
          <path d="M50 14 H70 L66 36 L78 90 L60 104 L42 90 L54 36 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M54 36 H66" stroke={stroke} strokeWidth="0.8" />
        </g>
      )}
      {shape === "belt" && (
        <g>
          <path d="M14 54 H106 V70 H14 Z" fill={a} stroke={stroke} strokeWidth="1.4" />
          <rect x="48" y="50" width="24" height="24" fill={stroke} stroke={stroke} strokeWidth="1.4" />
          <rect x="54" y="58" width="12" height="8" fill={a} />
        </g>
      )}
      {shape === "misc" && (
        <g>
          <rect x="32" y="22" width="56" height="80" rx="4" fill={a} stroke={stroke} strokeWidth="1.4" />
          <path d="M40 42 H80 M40 56 H80 M40 70 H68" stroke={stroke} strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}
