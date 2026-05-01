type SectionTitleProps = {
  title: string;
  kicker?: string;
  sub?: string;
  accent?: string;
};

export function SectionTitle({
  title,
  kicker,
  sub,
  accent = "var(--color-gold)",
}: SectionTitleProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      {kicker && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {kicker}
        </div>
      )}
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 28,
          color: "var(--color-ink)",
          margin: "6px 0",
          letterSpacing: "-0.3px",
        }}
      >
        {title}
      </h2>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            color: "var(--color-ink-dim)",
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      )}
      <div style={{ height: 1, background: "var(--color-rule)", marginTop: 12 }} />
    </div>
  );
}
