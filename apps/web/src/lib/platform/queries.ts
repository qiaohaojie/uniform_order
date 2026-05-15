import { db } from "@/db";
import { sql } from "drizzle-orm";

export type TenantStatus = "setup" | "active" | "hidden" | "disabled";

export type TenantStatsRow = {
  id: string;
  name: string;
  short: string;
  accent: string;
  createdAt: Date | null;
  status: TenantStatus;
  parents: number;
  orders30d: number;
  revenue30d: string;
};

function deriveStatus(t: {
  platformApprovalStatus: string;
  stripeChargesEnabled: boolean | null;
  isPubliclyListed: boolean;
}): TenantStatus {
  if (t.platformApprovalStatus === "rejected") return "disabled";
  if (t.platformApprovalStatus !== "approved" || !t.stripeChargesEnabled) return "setup";
  return t.isPubliclyListed ? "active" : "hidden";
}

export async function listTenantsWithStats(): Promise<TenantStatsRow[]> {
  const rows = await db.execute(sql`
    SELECT
      t.id, t.name, t.short, t.accent, t.created_at,
      t.platform_approval_status, t.stripe_charges_enabled, t.is_publicly_listed,
      COALESCE(stats.parents, 0)       AS parents,
      COALESCE(stats.orders30d, 0)     AS orders_30d,
      COALESCE(stats.revenue30d, 0)::text AS revenue_30d
    FROM tenants t
    LEFT JOIN (
      SELECT
        o.tenant_id,
        COUNT(DISTINCT COALESCE(o.user_id::text, lower(o.parent_email))) AS parents,
        COUNT(*) FILTER (
          WHERE o.payment_status != 'pending'
            AND o.created_at > now() - interval '30 days'
        ) AS orders30d,
        SUM(o.total) FILTER (WHERE o.created_at > now() - interval '30 days')
          - COALESCE(SUM(r.amount) FILTER (WHERE r.created_at > now() - interval '30 days'), 0) AS revenue30d
      FROM orders o
      LEFT JOIN order_refunds r ON r.order_id = o.id
      GROUP BY o.tenant_id
    ) stats ON stats.tenant_id = t.id
    ORDER BY t.created_at DESC
  `);

  return rows.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    short: r.short as string,
    accent: r.accent as string,
    createdAt: r.created_at as Date | null,
    status: deriveStatus({
      platformApprovalStatus: r.platform_approval_status as string,
      stripeChargesEnabled: r.stripe_charges_enabled as boolean | null,
      isPubliclyListed: r.is_publicly_listed as boolean,
    }),
    parents: Number(r.parents),
    orders30d: Number(r.orders_30d),
    revenue30d: String(r.revenue_30d),
  }));
}

export type PlatformKpis = {
  tenants: { total: number; active: number; setup: number };
  parents: number;
  orders30d: { count: number; deltaMom: number | null };
  revenue30d: string;
};

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const list = await listTenantsWithStats();

  const orders30d = list.reduce((s, t) => s + t.orders30d, 0);

  const priorRow = await db.execute(sql`
    SELECT COUNT(*) AS n FROM orders
    WHERE payment_status != 'pending'
      AND created_at > now() - interval '60 days'
      AND created_at <= now() - interval '30 days'
  `);
  const prior = Number(priorRow.rows[0]?.n ?? 0);
  const deltaMom = prior > 0 ? (orders30d - prior) / prior : null;

  return {
    tenants: {
      total: list.length,
      active: list.filter((t) => t.status === "active").length,
      setup: list.filter((t) => t.status === "setup").length,
    },
    parents: list.reduce((s, t) => s + t.parents, 0),
    orders30d: { count: orders30d, deltaMom },
    revenue30d: list.reduce((s, t) => s + Number(t.revenue30d), 0).toFixed(2),
  };
}
