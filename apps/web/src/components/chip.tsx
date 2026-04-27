import type { ReactNode, CSSProperties } from "react";

type Tone = "neutral" | "navy" | "success" | "warn" | "info" | "danger" | "gold";
type Size = "sm" | "md";

const TONES: Record<Tone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: "#F1ECE0", fg: "var(--color-ink)", bd: "#E5DFD2" },
  navy: { bg: "var(--color-navy)", fg: "#fff", bd: "var(--color-navy)" },
  success: { bg: "#E5F0E7", fg: "var(--color-success)", bd: "#C6DECB" },
  warn: { bg: "#F8EBD2", fg: "#7A5418", bd: "#E5D5AE" },
  info: { bg: "#E2EAF3", fg: "var(--color-navy-soft)", bd: "#C7D4E3" },
  danger: { bg: "#F4DAD4", fg: "var(--color-alert)", bd: "#E5BDB4" },
  gold: { bg: "#F5EAD0", fg: "var(--color-gold)", bd: "#E5D5A8" },
};

const SIZES: Record<Size, { h: number; px: number; fs: number }> = {
  sm: { h: 20, px: 8, fs: 11 },
  md: { h: 24, px: 10, fs: 12 },
};

export function Chip({ children, tone = "neutral", size = "md" }: { children: ReactNode; tone?: Tone; size?: Size }) {
  const t = TONES[tone];
  const s = SIZES[size];
  const style: CSSProperties = {
    height: s.h,
    padding: `0 ${s.px}px`,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.bd}`,
    fontSize: s.fs,
  };
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold tracking-wider uppercase"
      style={style}
    >
      {children}
    </span>
  );
}
