"use client";

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  accent?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const SIZE: Record<Size, { h: number; px: number; fs: number }> = {
  sm: { h: 34, px: 12, fs: 13 },
  md: { h: 44, px: 18, fs: 14 },
  lg: { h: 52, px: 22, fs: 15 },
};

export function Btn({
  variant = "primary",
  size = "md",
  fullWidth,
  accent,
  leading,
  trailing,
  children,
  style,
  ...rest
}: BtnProps) {
  const s = SIZE[size];
  const a = accent ?? "var(--color-navy)";
  const palette: Record<Variant, CSSProperties> = {
    primary: { background: a, color: "#fff", border: `1px solid ${a}` },
    secondary: { background: "#fff", color: "var(--color-navy)", border: "1px solid #D9D2C2" },
    ghost: { background: "transparent", color: "var(--color-navy)", border: "1px solid transparent" },
    danger: { background: "var(--color-alert)", color: "#fff", border: "1px solid var(--color-alert)" },
  };

  return (
    <button
      {...rest}
      className="inline-flex items-center justify-center gap-2 font-semibold tracking-tight whitespace-nowrap rounded-md transition-[background,transform] duration-100 hover:not(:disabled):brightness-95 disabled:opacity-45 disabled:cursor-not-allowed"
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        width: fullWidth ? "100%" : "auto",
        ...palette[variant],
        ...style,
      }}
    >
      {leading}
      <span>{children}</span>
      {trailing}
    </button>
  );
}
