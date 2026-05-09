import { shade } from "@/lib/ui";
import type { Tenant } from "@/lib/data";

// Crest reads a minimal subset of Tenant — exposing the structural shape lets
// callers (admin-shell, orders list) pass DB-derived rows without fabricating
// unused fields like motto/address/shopEmail.
export type CrestTenant = Pick<Tenant, "id" | "accent" | "short">;

export function Crest({ tenant, size = 56, ring = true }: { tenant: CrestTenant; size?: number; ring?: boolean }) {
  const s = size;
  const r = s / 2;
  const gradId = `cg-${tenant.id}-${size}`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tenant.accent} />
          <stop offset="1" stopColor={shade(tenant.accent, -18)} />
        </linearGradient>
      </defs>
      <path
        d={`M ${r} 2 L ${s - 3} 8 L ${s - 3} ${s * 0.55} Q ${s - 3} ${s * 0.85} ${r} ${s - 2} Q 3 ${s * 0.85} 3 ${s * 0.55} L 3 8 Z`}
        fill={`url(#${gradId})`}
        stroke={shade(tenant.accent, -28)}
        strokeWidth="1"
      />
      {ring && (
        <path
          d={`M ${r} 6 L ${s - 6} 11 L ${s - 6} ${s * 0.55} Q ${s - 6} ${s * 0.81} ${r} ${s - 5} Q 6 ${s * 0.81} 6 ${s * 0.55} L 6 11 Z`}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.6"
        />
      )}
      <text
        x={r}
        y={r + s * 0.1}
        textAnchor="middle"
        fill="#fff"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 700,
          fontSize: s * 0.34,
          letterSpacing: 0.5,
        }}
      >
        {tenant.short.length <= 4 ? tenant.short : tenant.short.slice(0, 3)}
      </text>
    </svg>
  );
}
