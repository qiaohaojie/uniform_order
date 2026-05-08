import * as React from "react";

type Props = { accent: string; stroke: string; size: number };

const wrap = (props: Props, body: React.ReactNode) => (
  <svg width={props.size} height={props.size} viewBox="0 0 120 120" aria-hidden="true">
    <rect x="0" y="0" width="120" height="120" fill="#F1ECE0" />
    {body}
  </svg>
);

export function SummerDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M30 26 L48 18 L60 24 L72 18 L90 26 L96 40 L86 46 L86 96 L34 96 L34 46 L24 40 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function WinterDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M28 24 L48 16 Q60 30 72 16 L92 24 L100 44 L86 50 L86 102 L34 102 L34 50 L20 44 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function SportsDefault(p: Props) {
  return wrap(p,
    <g>
      <circle cx="60" cy="60" r="34" fill={p.accent} stroke={p.stroke} strokeWidth="1.6" />
      <path d="M26 60 H94 M60 26 V94 M40 36 Q60 60 80 36 M40 84 Q60 60 80 84" fill="none" stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function FormalDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M24 22 L48 16 L60 28 L72 16 L96 22 L92 102 L68 102 L60 90 L52 102 L28 102 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M48 16 L60 60 L72 16" stroke={p.stroke} strokeWidth="1" fill="none" />
    </g>
  );
}

export function BagsDefault(p: Props) {
  return wrap(p,
    <g>
      <path d="M30 36 H90 V100 H30 Z" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M44 36 V24 Q60 14 76 24 V36" fill="none" stroke={p.stroke} strokeWidth="1.4" />
    </g>
  );
}

export function StationeryDefault(p: Props) {
  return wrap(p,
    <g>
      <rect x="34" y="22" width="52" height="76" fill={p.accent} stroke={p.stroke} strokeWidth="1.4" />
      <path d="M44 38 H76 M44 50 H76 M44 62 H76 M44 74 H66" stroke={p.stroke} strokeWidth="1.2" fill="none" />
    </g>
  );
}
