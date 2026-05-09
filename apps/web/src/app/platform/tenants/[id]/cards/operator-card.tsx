import type { tenants } from "@/db/schema";

type TenantRow = typeof tenants.$inferSelect;

export function OperatorCard({ tenant }: { tenant: TenantRow }) {
  return (
    <section className="bg-paper rounded-[10px] border border-rule p-5">
      <header className="flex items-start justify-between mb-4">
        <h2 className="font-serif text-lg font-semibold">Operator & shop contact</h2>
      </header>

      <dl className="grid grid-cols-[140px_1fr] gap-y-2.5 text-sm">
        <dt className="text-ink-dim">Operator email</dt>
        <dd className="font-mono">{tenant.shopEmail ?? "—"}</dd>

        <dt className="text-ink-dim">Address</dt>
        <dd>{tenant.address ?? "—"}</dd>

        <dt className="text-ink-dim">Shop hours</dt>
        <dd>{tenant.shopHours ?? "—"}</dd>

        <dt className="text-ink-dim">Pickup instructions</dt>
        <dd className="whitespace-pre-line">{tenant.collectionInstructions ?? "—"}</dd>
      </dl>
    </section>
  );
}
