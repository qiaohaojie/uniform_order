import type { AuditEvent } from "./types";

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatCents(cents: number | undefined): string {
  if (typeof cents !== "number") return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Map an audit event row to a one-line human-readable description.
 * Centralised so future event additions or copy tweaks change in one place.
 */
export function formatAuditEvent(event: AuditEvent): string {
  const p = (event.payload as Record<string, unknown>) ?? {};
  switch (event.action) {
    case "order.marked_ready":
      return `Marked order #${shortId(event.targetId)} ready`;
    case "order.refund_issued": {
      const amount = formatCents(safeNum(p.refundAmountCents));
      const items = safeArr<{ name: string }>(p.lineItems);
      const itemsLabel = items.length === 1 ? "1 item" : `${items.length} items`;
      return `Refunded ${amount} (${itemsLabel})`;
    }
    case "catalog_item.created":
      return `Added "${safeStr(p.name) || safeStr(p.sku) || "item"}" to catalog`;
    case "catalog_item.updated": {
      const fields = safeArr<string>(p.changedFields);
      return `Edited catalog item (${fields.length} ${fields.length === 1 ? "field" : "fields"})`;
    }
    case "catalog_item.deleted":
      return `Removed "${safeStr(p.name) || safeStr(p.sku) || "item"}" from catalog`;
    case "tenant.draft_created":
      return `Created tenant draft "${safeStr(p.name) || event.targetId}"`;
    case "tenant.branding_updated": {
      const fields = safeArr<string>(p.changedFields);
      return `Updated branding (${fields.length} ${fields.length === 1 ? "field" : "fields"})`;
    }
    case "tenant.operator_updated": {
      const fields = safeArr<string>(p.changedFields);
      const emailChanged = fields.length === 0 || fields.includes("shopEmail");
      if (emailChanged) {
        return `Changed operator from ${safeStr(p.previousEmail) || "(none)"} to ${safeStr(p.newEmail)}`;
      }
      return `Updated shop details (${fields.length} ${fields.length === 1 ? "field" : "fields"})`;
    }
    case "tenant.legal_updated": {
      const version = safeNum(p.version) ?? 0;
      const mode = safeStr(p.mode) || "text";
      return `Saved legal policy v${version} (${mode} mode)`;
    }
    case "tenant.stripe_account_linked":
      return `Linked Stripe account ${safeStr(p.stripeAccountId) || ""}`.trim();
    case "tenant.catalog_cloned": {
      const source = safeStr(p.sourceTenantId) || "another tenant";
      const count = safeNum(p.itemCount) ?? 0;
      return `Cloned catalog from ${source} (${count} items)`;
    }
    case "tenant.went_live":
      return `Approved tenant for live ordering`;
    default:
      return event.action;
  }
}

/**
 * Format a Date as a short relative time string ("just now", "12m ago", "3d ago").
 * Shared by OrderActivityStrip and TenantActivityFeed.
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
