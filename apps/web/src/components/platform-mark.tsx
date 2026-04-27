export function PlatformMark({
  size = 28,
  color = "var(--color-navy)",
  showWordmark = true,
}: {
  size?: number;
  color?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 font-serif" style={{ color }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 9 V18 a3 3 0 0 0 6 0 V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="22" cy="14" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      {showWordmark && (
        <span style={{ fontWeight: 600, fontSize: size * 0.62, letterSpacing: 0.2 }}>
          UniformOrder
        </span>
      )}
    </span>
  );
}
