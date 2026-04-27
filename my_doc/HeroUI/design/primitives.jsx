// primitives.jsx — small, design-system-grade UI primitives shared across all
// personas. Navy + serif accent. Mobile-friendly hit targets (>=44px on touch
// surfaces). No emoji.

const SERIF = '"Newsreader", "Source Serif 4", Georgia, serif';
const SANS = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace';

// Crest — a flat, geometric monogram badge used as a placeholder school logo.
// Uses the tenant's accent color. Engraved-feeling without being too literal.
function Crest({ tenant, size = 56, ring = true }) {
  const s = size, r = s / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <defs>
        <linearGradient id={`cg-${tenant.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tenant.accent} />
          <stop offset="1" stopColor={shade(tenant.accent, -18)} />
        </linearGradient>
      </defs>
      {/* shield */}
      <path d={`M ${r} 2 L ${s-3} 8 L ${s-3} ${s*0.55} Q ${s-3} ${s*0.85} ${r} ${s-2} Q 3 ${s*0.85} 3 ${s*0.55} L 3 8 Z`}
        fill={`url(#cg-${tenant.id})`} stroke={shade(tenant.accent, -28)} strokeWidth="1" />
      {ring && (
        <path d={`M ${r} 6 L ${s-6} 11 L ${s-6} ${s*0.55} Q ${s-6} ${s*0.81} ${r} ${s-5} Q 6 ${s*0.81} 6 ${s*0.55} L 6 11 Z`}
          fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
      )}
      <text x={r} y={r + s*0.10} textAnchor="middle" fill="#fff"
        style={{ fontFamily: SERIF, fontWeight: 700, fontSize: s*0.34, letterSpacing: 0.5 }}>
        {tenant.short.length <= 4 ? tenant.short : tenant.short.slice(0,3)}
      </text>
    </svg>
  );
}

function shade(hex, pct) {
  const h = hex.replace('#','');
  const n = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = pct < 0 ? (1 + pct/100) : pct/100;
  if (pct < 0) { r = Math.round(r*f); g = Math.round(g*f); b = Math.round(b*f); }
  else { r = Math.round(r + (255-r)*f); g = Math.round(g + (255-g)*f); b = Math.round(b + (255-b)*f); }
  return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}

// Mark — the platform brand mark itself ("U·O" — UniformOrder).
function PlatformMark({ size = 28, color = '#0E2A47', stack = false }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: SERIF, color }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M9 9 V18 a3 3 0 0 0 6 0 V9" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="22" cy="14" r="4.5" fill="none" stroke={color} strokeWidth="1.8" />
      </svg>
      {!stack && (
        <span style={{ fontWeight: 600, fontSize: size * 0.62, letterSpacing: 0.2 }}>
          UniformOrder
        </span>
      )}
    </div>
  );
}

// Btn — three variants. Big touch target by default.
// Chip — used for status, tag, category.
// SectionTitle — serif title + thin rule beneath, for the institutional feel.
// DoubleRule — old printed-form decorative double line.
// Spark — tiny line chart.
// GarmentVector — flat-vector silhouette of a uniform piece, keyed by item id.
//   Map from item.id → shape: shirt-ss/shirt-ls/polo → shirt; jumper/hoodie/jacket → jumper;
//   trousers/shorts-sport/tracks → pants; cap → cap; sock-* → sock; backpack/sportsbag → bag;
//   blazer → blazer; tie → tie; belt → belt; calc/mathset → misc.

// (Full source vendored from claude.ai/design — see actual implementation in apps/web)
