import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCustomerOrder } from "@/lib/queries/orders";
import { isPaymentConfigured } from "@/lib/payments";
import { OrderTrackingView } from "@/components/customer/order-tracking-view";

export const dynamic = "force-dynamic";

export default async function CustomerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("customer");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const order = await getCustomerOrder(session.id, id);
  if (!order) notFound();
  return <OrderTrackingView order={order} paymentReady={isPaymentConfigured()} />;
}
