import { requireRole } from "@/lib/auth";
import { getBaristaOrders, getMyVendor } from "@/lib/queries/barista";
import { BaristaOrdersView } from "@/components/barista/orders-view";

export const dynamic = "force-dynamic";

export default async function BaristaOrdersPage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);
  const orders = vendor ? await getBaristaOrders(vendor.id) : [];

  return <BaristaOrdersView initialOrders={orders} />;
}
