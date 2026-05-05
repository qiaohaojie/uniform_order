import { redirect } from "next/navigation";
import { MobileShell } from "@/components/mobile-shell";
import { BottomNav } from "@/components/bottom-nav";
import { OrdersListClient } from "./orders-list-client";
import { getSessionUser } from "@/lib/auth/authorization";

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/sign-in?callbackURL=%2Forders");
  }

  return (
    <MobileShell bg="var(--color-paper)">
      <div className="px-4 pt-3 pb-3 flex items-center flex-shrink-0">
        <div className="flex-1 text-center font-serif text-[17px] font-semibold" style={{ color: "var(--color-navy)" }}>
          My Orders
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <OrdersListClient parentEmail={user.email} />
      </div>

      <BottomNav active="orders" />
    </MobileShell>
  );
}
