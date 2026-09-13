import { Spinner } from "@heroui/react";

export default function PlatformLoading() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center py-24"
      data-testid="platform-loading"
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" color="current" className="mb-4 text-[var(--color-gold)]" />
      <p className="text-sm text-ink-dim">Loading platform console…</p>
    </div>
  );
}
