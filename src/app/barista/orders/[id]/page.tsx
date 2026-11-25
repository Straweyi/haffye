import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getBaristaOrderById, getMyVendor } from "@/lib/queries/barista";
import { BaristaOrderDetailView } from "@/components/barista/order-detail-view";

export const dynamic = "force-dynamic";

export default async function BaristaOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole("barista");
  const [{ id }, vendor] = await Promise.all([params, getMyVendor(session.id)]);
  if (!vendor) notFound();

  const order = await getBaristaOrderById(vendor.id, id);
  if (!order) notFound();

  return <BaristaOrderDetailView order={order} />;
}
