import { Crest } from "@/components/crest";
import { Chip } from "@/components/chip";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { OrdersListClient } from "./orders-list-client";

export default function OrdersPage() {
  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          My Orders
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <OrdersListClient />
      </div>

      <BottomNav active="orders" />
    </MobileShell>
  );
}
