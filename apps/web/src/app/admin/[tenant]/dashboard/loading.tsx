import { AdminTopbar } from "@/components/admin-shell";

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "var(--color-rule)" }}
    />
  );
}

export default function AdminDashboardLoading() {
  return (
    <>
      <AdminTopbar kicker="Operator" title="Dashboard" />
      <div
        data-testid="admin-dashboard-loading"
        className="flex-1 overflow-y-auto p-7"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading live dashboard</span>
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-white rounded-[10px] border p-4"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <Pulse className="h-3 w-24" />
              <Pulse className="h-7 w-20 mt-3" />
              <Pulse className="h-3 w-16 mt-2" />
            </div>
          ))}
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <div className="bg-white rounded-[10px] border p-[18px] min-h-[220px]" style={{ borderColor: "var(--color-rule)" }}>
            <Pulse className="h-5 w-40 mb-4" />
            <Pulse className="h-32 w-full" />
          </div>
          <div className="bg-white rounded-[10px] border p-[18px] min-h-[220px]" style={{ borderColor: "var(--color-rule)" }}>
            <Pulse className="h-5 w-32 mb-4" />
            <Pulse className="h-32 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
