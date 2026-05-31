// primitives.jsx — small, design-system-grade UI primitives shared across all
// personas. Navy + serif accent. Mobile-friendly hit targets (>=44px on touch
// surfaces). No emoji.

import { NAVY, NAVY_SOFT, INK, INK_DIM, RULE, GOLD, ALERT, SUCCESS } from "./tokens.jsx";

const SERIF = '"Newsreader", "Source Serif 4", Georgia, serif';
const SANS  = '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO  = '"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace';

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

// Button — three variants. Big touch target by default.
function Btn({ variant = 'primary', size = 'md', children, onClick, fullWidth, disabled, accent, style, leading, trailing, type = 'button', href, target }) {
  const sizes = {
    sm: { h: 34, px: 12, fs: 13 },
    md: { h: 44, px: 18, fs: 14 },
    lg: { h: 52, px: 22, fs: 15 },
  }[size];
  const A = accent || NAVY;
  const palettes = {
    primary:   { bg: A, fg: '#fff', bd: A, hover: shade(A,-12) },
    secondary: { bg: '#fff', fg: NAVY, bd: '#D9D2C2', hover: '#FAF6EE' },
    ghost:     { bg: 'transparent', fg: NAVY, bd: 'transparent', hover: '#F4EFE3' },
    danger:    { bg: ALERT, fg: '#fff', bd: ALERT, hover: shade(ALERT,-10) },
  }[variant];
  const sharedStyle = {
    height: sizes.h, padding: `0 ${sizes.px}px`, fontSize: sizes.fs,
    background: palettes.bg, color: palettes.fg, border: `1px solid ${palettes.bd}`,
    borderRadius: 6, fontFamily: SANS, fontWeight: 600, letterSpacing: 0.1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    width: fullWidth ? '100%' : 'auto', whiteSpace: 'nowrap', textDecoration: 'none',
    transition: 'background .12s ease, transform .04s ease',
    ...style,
  };
  // When an href is supplied, render a styled anchor so CTAs are real links
  // (matters for a static marketing page — crawlable, middle-click, no JS).
  if (href && !disabled) {
    return (
      <a href={href} target={target} rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        onClick={onClick} className="btn" style={sharedStyle}>
        {leading}
        <span>{children}</span>
        {trailing}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="btn" style={sharedStyle}>
      {leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
}

// Pill / Chip — used for status, tag, category.
function Chip({ children, tone = 'neutral', size = 'md' }) {
  const tones = {
    neutral: { bg: '#F1ECE0', fg: INK, bd: '#E5DFD2' },
    navy:    { bg: NAVY, fg: '#fff', bd: NAVY },
    success: { bg: '#E5F0E7', fg: SUCCESS, bd: '#C6DECB' },
    warn:    { bg: '#F8EBD2', fg: '#7A5418', bd: '#E5D5AE' },
    info:    { bg: '#E2EAF3', fg: NAVY_SOFT, bd: '#C7D4E3' },
    danger:  { bg: '#F4DAD4', fg: ALERT, bd: '#E5BDB4' },
    gold:    { bg: '#F5EAD0', fg: GOLD, bd: '#E5D5A8' },
  }[tone];
  const sizes = { sm: { h: 20, px: 8, fs: 11 }, md: { h: 24, px: 10, fs: 12 } }[size];
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: sizes.h, padding: `0 ${sizes.px}px`,
    background: tones.bg, color: tones.fg, border: `1px solid ${tones.bd}`, borderRadius: 999,
    fontFamily: SANS, fontWeight: 600, fontSize: sizes.fs, letterSpacing: 0.3, textTransform: 'uppercase' }}>
    {children}
  </span>;
}

// Section header w/ serif title + thin rule beneath, for the institutional feel.
function SectionTitle({ kicker, title, sub, accent = NAVY }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {kicker && <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: accent }}>{kicker}</div>}
      <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 28, color: INK, margin: '6px 0 6px', letterSpacing: -0.3 }}>{title}</h2>
      {sub && <div style={{ fontFamily: SANS, fontSize: 13, color: INK_DIM, lineHeight: 1.5 }}>{sub}</div>}
      <div style={{ height: 1, background: RULE, marginTop: 12 }} />
    </div>
  );
}

// Decorative double-rule — used a lot in old school printed forms; gives the
// product a "school office" feel.
function DoubleRule({ color = RULE, gap = 3 }) {
  return (
    <div>
      <div style={{ height: 1, background: color }} />
      <div style={{ height: gap }} />
      <div style={{ height: 1, background: color }} />
    </div>
  );
}

// Tiny spark line for the operator dashboard.
function Spark({ data, w = 120, h = 32, color = NAVY }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Garment placeholder — flat-vector silhouette of a uniform piece. We don't
// have real photography so use a tasteful vector, never a stock-photo dummy.
function GarmentVector({ kind, accent, size = 120 }) {
  const A = accent || NAVY_SOFT;
  const stroke = shade(A, -18);
  const w = size, h = size;
  // common outline sets keyed by item.id prefix
  const shapes = {
    shirt: (
      <g>
        <path d="M30 22 L48 14 L60 20 L72 14 L90 22 L98 38 L86 44 L86 100 L34 100 L34 44 L22 38 Z"
              fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M48 14 Q60 24 72 14" fill="none" stroke={stroke} strokeWidth="1.4" />
        <path d="M60 24 V64" stroke={stroke} strokeWidth="1" strokeDasharray="2 3" fill="none" />
        <circle cx="60" cy="42" r="1.2" fill={stroke} />
        <circle cx="60" cy="52" r="1.2" fill={stroke} />
      </g>
    ),
    jumper: (
      <g>
        <path d="M28 24 L48 16 Q60 30 72 16 L92 24 L100 44 L86 50 L86 102 L34 102 L34 50 L20 44 Z"
              fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M52 22 Q60 30 68 22" stroke={stroke} strokeWidth="1.2" fill="none" />
      </g>
    ),
    pants: (
      <g>
        <path d="M36 14 H84 L86 56 L78 104 L66 104 L62 60 L58 60 L54 104 L42 104 L34 56 Z"
              fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M60 18 V58" stroke={stroke} strokeWidth="0.8" />
      </g>
    ),
    cap: (
      <g>
        <path d="M22 70 Q60 30 98 70 L98 78 L22 78 Z" fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M22 78 Q60 92 98 78" stroke={stroke} strokeWidth="1.4" fill="none" />
        <circle cx="60" cy="46" r="3" fill={stroke} />
      </g>
    ),
    sock: (
      <g>
        <path d="M44 16 H76 V60 L66 100 H50 L40 60 Z" fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M44 20 H76" stroke={stroke} strokeWidth="0.8" />
      </g>
    ),
    bag: (
      <g>
        <path d="M30 36 H90 V100 H30 Z" fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M44 36 V24 Q60 14 76 24 V36" fill="none" stroke={stroke} strokeWidth="1.4" />
        <rect x="44" y="56" width="32" height="20" fill="none" stroke={stroke} strokeWidth="1" />
      </g>
    ),
    blazer: (
      <g>
        <path d="M24 22 L48 16 L60 28 L72 16 L96 22 L92 102 L68 102 L60 90 L52 102 L28 102 Z"
              fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M48 16 L60 60 L72 16" stroke={stroke} strokeWidth="1" fill="none" />
      </g>
    ),
    tie: (
      <g>
        <path d="M50 14 H70 L66 36 L78 90 L60 104 L42 90 L54 36 Z"
              fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M54 36 H66" stroke={stroke} strokeWidth="0.8" />
      </g>
    ),
    belt: (
      <g>
        <path d="M14 54 H106 V70 H14 Z" fill={A} stroke={stroke} strokeWidth="1.4" />
        <rect x="48" y="50" width="24" height="24" fill={stroke} stroke={stroke} strokeWidth="1.4" />
        <rect x="54" y="58" width="12" height="8" fill={A} />
      </g>
    ),
    misc: (
      <g>
        <rect x="32" y="22" width="56" height="80" rx="4" fill={A} stroke={stroke} strokeWidth="1.4" />
        <path d="M40 42 H80 M40 56 H80 M40 70 H68" stroke={stroke} strokeWidth="1" />
      </g>
    ),
  };
  const map = {
    'shirt-ss': 'shirt', 'shirt-ls': 'shirt', 'polo': 'shirt',
    'jumper': 'jumper', 'hoodie': 'jumper', 'jacket': 'jumper',
    'trousers': 'pants', 'shorts-sport': 'pants', 'tracks': 'pants',
    'cap': 'cap',
    'sock-white': 'sock', 'sock-sport': 'sock',
    'backpack': 'bag', 'sportsbag': 'bag',
    'blazer': 'blazer', 'tie': 'tie', 'belt': 'belt',
    'calc': 'misc', 'mathset': 'misc',
  };
  const shape = shapes[map[kind] || 'misc'];
  return (
    <svg width={w} height={h} viewBox="0 0 120 120" aria-hidden="true">
      <rect x="0" y="0" width="120" height="120" fill="#F1ECE0" />
      {shape}
    </svg>
  );
}

// Phone bezel — tighter & lighter than ios-frame for canvas use.
// Uses the shared IOSDevice when available for the parent screens.

export {
  SERIF, SANS, MONO,
  Crest, PlatformMark, Btn, Chip, SectionTitle, DoubleRule, Spark, GarmentVector,
  shade,
};
