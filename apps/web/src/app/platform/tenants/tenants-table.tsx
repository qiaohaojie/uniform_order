"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@heroui/react";
import type { TenantStatsRow, TenantStatus } from "@/lib/platform/queries";
import { approveTenant } from "./[id]/actions";

const FILTERS: Array<{ id: TenantStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Live" },
  { id: "hidden", label: "Shop off" },
  { id: "disabled", label: "Disabled" },
];

export function TenantsTable({ rows }: { rows: TenantStatsRow[] }) {
  const [filter, setFilter] = useState<TenantStatus | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (ql && !(r.name.toLowerCase().includes(ql) || r.id.toLowerCase().includes(ql)))
        return false;
      return true;
    });
  }, [rows, filter, q]);

  return (
    <div className="bg-paper rounded-[10px] border border-rule overflow-hidden" data-testid="platform-tenants-table">
      <div className="px-4 py-3 border-b border-rule flex items-center gap-2.5">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              data-testid={`platform-filter-${f.id}`}
              className={`h-7 px-3 rounded-md text-xs font-semibold ${
                filter === f.id ? "bg-navy-deep text-white" : "text-ink-dim"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or slug"
          className="h-8 w-60 border border-rule rounded-md px-2.5 text-xs"
        />
      </div>
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="bg-parchment">
            {["School", "Parents", "Orders·30d", "Revenue·30d", "Since", "Status", ""].map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-ink-dim border-b border-rule ${
                  i >= 1 && i <= 3 ? "text-right" : i === 6 ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="border-b border-rule last:border-0" data-testid="platform-tenant-row" data-slug={r.id}>
              <td className="px-4 py-3">
                <div className="font-semibold text-[13.5px] font-serif">{r.name}</div>
                <div className="font-mono text-[10.5px] text-ink-dim mt-0.5">
                  {r.id}.uniformorder.online
                </div>
              </td>
              <td className="px-4 py-3 text-right tnum">{r.parents.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tnum">{r.orders30d}</td>
              <td className="px-4 py-3 text-right tnum">${Number(r.revenue30d).toFixed(0)}</td>
              <td className="px-4 py-3 text-ink-dim">
                {r.createdAt?.toLocaleDateString("en-AU", { month: "short", year: "numeric" }) ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusChip status={r.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {r.status === "pending" ? <ApproveButton id={r.id} /> : null}
                  <Link href={`/platform/tenants/${r.id}`} className="text-xs font-semibold text-navy-deep underline">
                    Open →
                  </Link>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-dim" data-testid="platform-tenants-empty-filter">
                {rows.length === 0 ? "No schools yet." : "No tenants match."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ApproveButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        size="sm"
        isPending={pending}
        onPress={() => {
          setError(null);
          startTransition(async () => {
            try {
              const r = await approveTenant(id);
              if (!r.ok) setError(r.error);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Approve failed");
            }
          });
        }}
        data-testid={`platform-approve-${id}`}
      >
        Approve
      </Button>
      {error ? <span className="text-[10px] text-alert mt-1">{error}</span> : null}
    </span>
  );
}

function StatusChip({ status }: { status: TenantStatus }) {
  const map = {
    active: { label: "Live", cls: "bg-green-100 text-green-800" },
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
    hidden: { label: "Shop off", cls: "bg-blue-100 text-blue-800" },
    disabled: { label: "Disabled", cls: "bg-red-100 text-red-800" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}
