import { requireRole } from "@/lib/auth";
import { getBaristaRevenue, getMyVendor } from "@/lib/queries/barista";
import { BaristaRevenueView } from "@/components/barista/revenue-view";

export const dynamic = "force-dynamic";

export default async function BaristaRevenuePage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);

  const summary = vendor
    ? await getBaristaRevenue(vendor.id)
    : {
        todayCompletedRevenue: 0,
        todayOrderCount: 0,
        totalCompletedRevenue: 0,
        completedCount: 0,
        avgOrderValue: 0,
        transactions: [],
      };

  return <BaristaRevenueView summary={summary} />;
}
