export function DoubleRule({ color = "var(--color-rule)", gap = 3 }: { color?: string; gap?: number }) {
  return (
    <div>
      <div style={{ height: 1, background: color }} />
      <div style={{ height: gap }} />
      <div style={{ height: 1, background: color }} />
    </div>
  );
}
