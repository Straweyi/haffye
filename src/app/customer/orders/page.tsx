import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getCustomerOrders } from "@/lib/queries/orders";
import { formatIDR } from "@/lib/format";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CustomerOrdersPage() {
  const session = await requireRole("customer");
  const orders = await getCustomerOrders(session.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-espresso">Order &amp; Transaction History</h1>
        <p className="text-xs text-coffee">Track your orders and review past payments.</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-10 text-center">
            <Receipt className="h-9 w-9 text-caramel" />
            <p className="mt-2 text-sm font-semibold text-espresso">No orders yet</p>
            <Link href="/customer/menu" className="mt-2 text-xs font-semibold text-caramel">
              Browse the menu
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/customer/orders/${o.id}`} className="block">
              <Card className="transition hover:border-caramel">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-espresso">{o.order_number}</span>
                    <Badge variant={ORDER_STATUS_BADGE_VARIANT[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-coffee">
                    {o.vendor_name} · {new Date(o.created_at).toLocaleString("id-ID")}
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-xs text-coffee">
                    {o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-coffee">
                      {o.payment ? `Payment: ${o.payment.status}` : "No payment"}
                      {o.payment?.payment_type ? ` (${o.payment.payment_type})` : ""}
                    </span>
                    <span className="text-sm font-bold text-caramel">{formatIDR(o.total)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
