import { notFound } from "next/navigation";
import { getTenant, toTenantBrand } from "@/db/queries";
import { listInStockPrelovedSkus } from "@/db/preloved-queries";
import { formatPrelovedCondition, type PrelovedStockListItem } from "@/lib/preloved";

const COLUMNS = ["Item", "Lot", "Size", "Condition", "Qty", "Price", "Expiry"] as const;

export default async function AdminPrelovedStockPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tid } = await params;
  const tenantRecord = await getTenant(tid);
  if (!tenantRecord) notFound();
  const tenant = toTenantBrand(tenantRecord);
  const rows = await listInStockPrelovedSkus(tenantRecord.id);
  const now = new Date();

  return (
    <div className="flex-1 overflow-y-auto p-7" data-testid="preloved-stock-page">
      {rows.length === 0 ? (
        <EmptyStockState />
      ) : (
        <div
          className="bg-white rounded-[10px] border overflow-hidden"
          style={{ borderColor: "var(--color-rule)" }}
          data-testid="stock-list"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr
                className="text-[10.5px] uppercase tracking-[0.6px]"
                style={{ color: "var(--color-ink-dim)" }}
              >
                {COLUMNS.map((label) => (
                  <th
                    key={label}
                    className={`py-2.5 px-4 font-bold border-b ${
                      label === "Qty" || label === "Price" ? "text-right" : "text-left"
                    }`}
                    style={{ borderColor: "var(--color-rule)" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <StockRow
                  key={row.id}
                  row={row}
                  timeZone={tenant.timezone}
                  now={now}
                  last={i === rows.length - 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StockRow({
  row,
  timeZone,
  now,
  last,
}: {
  row: PrelovedStockListItem;
  timeZone: string;
  now: Date;
  last: boolean;
}) {
  const expired = isPastHold(row.expiresAt, now);

  return (
    <tr
      className="border-b"
      style={{ borderColor: last ? "transparent" : "var(--color-rule)" }}
      data-testid="stock-row"
      data-source-item-id={row.sourceItemId}
      data-size={row.size}
      data-condition={row.condition}
    >
      <td className="py-3 px-4 font-medium" style={{ color: "var(--color-ink)" }}>
        {row.itemName}
      </td>
      <td
        className="py-3 px-4 tnum"
        style={{ color: "var(--color-ink)" }}
        data-testid="stock-lot-tickets"
        data-lot-tickets={row.lotTickets.join(",")}
      >
        {row.lotTickets.length > 0 ? row.lotTickets.join(", ") : "—"}
      </td>
      <td className="py-3 px-4" style={{ color: "var(--color-ink)" }}>
        {row.size}
      </td>
      <td className="py-3 px-4" style={{ color: "var(--color-ink)" }}>
        {formatPrelovedCondition(row.condition)}
      </td>
      <td
        className="py-3 px-4 text-right tnum"
        style={{ color: "var(--color-ink)" }}
        data-testid="stock-qty"
      >
        {row.qtyOnHand}
      </td>
      <td className="py-3 px-4 text-right font-semibold tnum" style={{ color: "var(--color-ink)" }}>
        {formatPrice(row.price)}
      </td>
      <td
        className="py-3 px-4 tnum"
        style={{ color: expired ? "var(--color-alert)" : "var(--color-ink-dim)" }}
      >
        {formatExpiry(row.expiresAt, timeZone)}
        {expired ? " · Past hold" : null}
      </td>
    </tr>
  );
}

function EmptyStockState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-6"
      data-testid="stock-empty"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-parchment)", color: "var(--color-gold)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10 H21" />
          <path d="M8 14 H10" />
          <path d="M14 14 H16" />
        </svg>
      </div>
      <h2 className="font-serif text-[22px] font-medium leading-[1.2] mb-2" style={{ color: "var(--color-ink)" }}>
        No preloved stock on the rack
      </h2>
      <p className="text-[13.5px] leading-[1.5] max-w-md" style={{ color: "var(--color-ink-dim)" }}>
        Accepted donations and consigned garments pool here by item, size, and
        condition. Linked tickets show in the Lot column. Written-off garments
        with quantity 0 are omitted. Use Intake to accept a washed garment.
      </p>
    </div>
  );
}

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatExpiry(date: Date | null, timeZone: string): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
}

function isPastHold(expiresAt: Date | null, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() < now.getTime();
}
