import { AdminTopbar } from "@/components/admin-shell";

function Pulse({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "var(--color-rule)" }}
    />
  );
}

export default function AdminReportsLoading() {
  return (
    <>
      <AdminTopbar kicker="Operator" title="Reports" />
      <div
        data-testid="admin-reports-loading"
        className="flex-1 overflow-y-auto p-7"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading live reports</span>
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-white rounded-[10px] border p-4"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <Pulse className="h-3 w-24" />
              <Pulse className="h-7 w-20 mt-3" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-[10px] border p-[18px] min-h-[200px]" style={{ borderColor: "var(--color-rule)" }}>
          <Pulse className="h-5 w-40 mb-4" />
          <Pulse className="h-36 w-full" />
        </div>
      </div>
    </>
  );
}
