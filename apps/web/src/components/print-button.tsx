"use client";

export function PrintButton({ label = "Print pick slip" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
      style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <rect x="6" y="3" width="12" height="6" />
        <rect x="3" y="9" width="18" height="9" rx="1" />
        <rect x="6" y="15" width="12" height="6" />
      </svg>
      {label}
    </button>
  );
}
