export type ExportOrderStatus =
  | "to_prepare"
  | "ready"
  | "needs_attention"
  | "completed";

export type ExportStatusFilter = ExportOrderStatus | "all";

export const EXPORT_STATUS_OPTIONS: ExportStatusFilter[] = [
  "all",
  "to_prepare",
  "ready",
  "needs_attention",
  "completed",
];

export const CSV_HEADERS = [
  "Order ID",
  "Created at (tenant tz)",
  "Parent name",
  "Parent email",
  "Student name",
  "Student year",
  "Fulfilment method",
  "Fulfilment status",
  "Payment status",
  "Completion type",
  "Subtotal",
  "GST",
  "Total",
  "Refunded amount",
  "Ready at (tenant tz)",
  "Completed at (tenant tz)",
  "Pick slip printed at (tenant tz)",
] as const;

// Refunded amount: always 2dp from cents to avoid 45.5 / 45.50 drift.
export function formatRefundedCents(cents: number | null | undefined): string {
  const n = typeof cents === "number" ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

// Format a Date+time in tenant tz, or empty string when null.
export function formatExportDateTime(
  date: Date | null,
  timezone: string,
): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

// RFC 4180: wrap in quotes if the field contains comma, quote, CR, or LF.
// Embedded double-quotes are doubled.
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Serialize a header row + data rows to a CSV string with UTF-8 BOM and \r\n line endings.
export function serializeCsv(headers: readonly string[], rows: readonly string[][]): string {
  const BOM = "﻿";
  const lines = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ];
  return BOM + lines.join("\r\n");
}

// Format a Date in DD/MM/YYYY for a specific IANA timezone, pinned to en-AU locale.
// Locale is explicit so the format doesn't drift if the host's default locale changes.
export function formatExportDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

// Format a numeric total (stored as dollars, e.g. "27.50") as "$27.50".
// Accepts either a string (Drizzle numeric) or number.
export function formatExportTotal(total: string | number): string {
  const n = typeof total === "string" ? Number(total) : total;
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

// Build the items summary string for a single order's line items.
// Format: variant + size → "{itemName} ({variantLabel} / {size}) ×{qty}"
//         variant only   → "{itemName} ({variantLabel}) ×{qty}"
//         size only      → "{itemName} ({size}) ×{qty}"
//         neither        → "{itemName} ×{qty}"
// Lines joined with "; ". Callers pass them in alphabetical (itemName, variantLabel, size)
// order for deterministic output across exports.
export function formatItemsSummary(
  lines: ReadonlyArray<{
    itemName: string;
    variantLabel: string;
    size: string | null;
    qty: number;
  }>
): string {
  return lines
    .map((line) => {
      const variant = line.variantLabel.trim();
      const size = line.size?.trim() ?? "";
      let parens = "";
      if (variant && size) parens = `(${variant} / ${size})`;
      else if (variant) parens = `(${variant})`;
      else if (size) parens = `(${size})`;
      const parensSuffix = parens ? ` ${parens}` : "";
      return `${line.itemName}${parensSuffix} ×${line.qty}`;
    })
    .join("; ");
}

// Build the filename: "<tenant>-orders-<status>-<YYYY-MM-DD>.csv".
// Date is computed in the tenant's timezone using en-CA locale for YYYY-MM-DD format.
export function buildExportFilename(
  tenantSlug: string,
  status: ExportStatusFilter,
  now: Date,
  timezone: string
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(now); // en-CA gives YYYY-MM-DD
  return `${tenantSlug}-orders-${status}-${parts}.csv`;
}
