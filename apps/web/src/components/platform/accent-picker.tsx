"use client";

export const ACCENT_PRESETS = [
  "#7A1F2B",
  "#0F4C5C",
  "#2F5D50",
  "#1F3A6E",
  "#4A2238",
  "#7A5418",
  "#0E2A47",
] as const;

export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2.5 items-center">
      {ACCENT_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Select accent ${c}`}
          onClick={() => onChange(c)}
          className={`w-11 h-11 rounded-full border ${
            value.toLowerCase() === c.toLowerCase()
              ? "border-ink ring-2 ring-white"
              : "border-rule"
          }`}
          style={{ background: c }}
        />
      ))}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-2 h-9 w-28 px-2 border border-rule rounded-md text-xs font-mono"
        aria-label="Custom hex colour"
      />
    </div>
  );
}
