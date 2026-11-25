import { requireRole } from "@/lib/auth";
import {
  getBaristaInventory,
  getBaristaOrders,
  getBaristaRevenue,
  getMyVendor,
} from "@/lib/queries/barista";
import { BaristaDashboardView } from "@/components/barista/dashboard-view";

export const dynamic = "force-dynamic";

export default async function BaristaDashboardPage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);

  if (!vendor) {
    return (
      <BaristaDashboardView
        baristaName={session.full_name}
        initialOrders={[]}
        todayRevenue={0}
        completedToday={0}
        lowStockCount={0}
      />
    );
  }

  const [orders, revenue, inventory] = await Promise.all([
    getBaristaOrders(vendor.id),
    getBaristaRevenue(vendor.id),
    getBaristaInventory(vendor.id),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const completedToday = orders.filter(
    (o) => o.status === "COMPLETED" && new Date(o.created_at).getTime() >= startOfToday.getTime(),
  ).length;

  return (
    <BaristaDashboardView
      baristaName={session.full_name}
      initialOrders={orders}
      todayRevenue={revenue.todayCompletedRevenue}
      completedToday={completedToday}
      lowStockCount={inventory.items.filter((i) => i.is_low).length}
    />
  );
}
