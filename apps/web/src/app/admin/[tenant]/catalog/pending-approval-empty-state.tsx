import type { Tenant } from "@/lib/data";

export function PendingApprovalEmptyState({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--color-parchment)", color: tenant.accent }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 13 16 15" />
        </svg>
      </div>
      <h2 className="font-serif text-[22px] font-medium leading-[1.2] mb-2">
        Awaiting platform approval
      </h2>
      <p className="text-[13.5px] leading-[1.5] max-w-md" style={{ color: "var(--color-ink-dim)" }}>
        {tenant.short} hasn’t been approved on the platform yet. Once approved,
        operators can add and edit catalog items here.
      </p>
      <p className="text-[12.5px] mt-3" style={{ color: "var(--color-ink-dim)" }}>
        Need help? Email{" "}
        <a
          href="mailto:support@uniformorder.online"
          className="underline"
          style={{ color: tenant.accent }}
        >
          support@uniformorder.online
        </a>
        .
      </p>
    </div>
  );
}
