"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, Store } from "lucide-react";
import { cancelPendingOrderAction, syncOrderPaymentAction } from "@/app/actions/checkout";
import { formatIDR } from "@/lib/format";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { loadSnap } from "@/lib/snap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerOrder } from "@/lib/queries/orders";
import type { OrderStatus } from "@/types/domain";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PAID", label: "Paid" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY_FOR_PICKUP", label: "Ready" },
  { status: "COMPLETED", label: "Collected" },
];

export function OrderTrackingView({ order, paymentReady }: { order: CustomerOrder; paymentReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<{ error?: string; message?: string }>({});
  const [live, setLive] = useState(false);

  // Realtime: RLS ensures customers only receive their own order changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`haffye-order-${order.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` },
        () => router.refresh(),
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [order.id, router]);

  // While unpaid, poll the server-verified status (webhook may not reach localhost)
  useEffect(() => {
    if (order.status !== "PENDING_PAYMENT" || !paymentReady) return;
    const id = setInterval(() => {
      void syncOrderPaymentAction({ orderId: order.id }).then(() => router.refresh());
    }, 8000);
    return () => clearInterval(id);
  }, [order.id, order.status, paymentReady, router]);

  const stepIdx = STEPS.findIndex((s) => s.status === order.status);
  const expired = order.payment?.expires_at ? new Date(order.payment.expires_at).getTime() < Date.now() : false;
  const canResume =
    order.status === "PENDING_PAYMENT" && order.payment?.status === "PENDING" && order.payment.snap_token && !expired;

  const resume = () => {
    if (!order.payment?.snap_token) return;
    loadSnap()
      .then((snap) =>
        snap.pay(order.payment!.snap_token!, {
          onSuccess: () => router.refresh(),
          onPending: () => router.refresh(),
          onError: () => router.refresh(),
          onClose: () => router.refresh(),
        }),
      )
      .catch((e: Error) => setFb({ error: e.message }));
  };

  const check = () =>
    start(async () => {
      setFb(await syncOrderPaymentAction({ orderId: order.id }));
      router.refresh();
    });

  const cancel = () =>
    start(async () => {
      setFb(await cancelPendingOrderAction({ orderId: order.id }));
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Link href="/customer/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-coffee hover:text-espresso">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">{order.order_number}</h1>
          <p className="text-xs text-coffee">{new Date(order.created_at).toLocaleString("id-ID")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-stone-400"}`} />
            {live ? "Live" : "…"}
          </Badge>
          <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Store className="h-5 w-5 text-caramel" />
          <div>
            <p className="text-xs text-coffee">Collect your order at</p>
            <p className="text-sm font-bold text-espresso">{order.vendor_name} ({order.vendor_code})</p>
          </div>
          <Link href={`/customer/map?vendor=${order.vendor_id}`} className="ml-auto text-xs font-semibold text-caramel">
            Find on map
          </Link>
        </CardContent>
      </Card>

      {stepIdx >= 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {STEPS.map((s, i) => (
                <div key={s.status} className="text-center">
                  <div className={`mx-auto h-2 w-full rounded-full ${i <= stepIdx ? "bg-caramel" : "bg-cream"}`} />
                  <p className={`mt-1.5 text-[10px] font-semibold ${i <= stepIdx ? "text-espresso" : "text-coffee/50"}`}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            {order.status === "READY_FOR_PICKUP" && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Your order is ready. Show {order.order_number} to the barista.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {order.status === "PENDING_PAYMENT" && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Clock className="h-4 w-4" />
              {expired ? "Payment window expired." : "Waiting for payment"}
            </p>
            {order.payment?.expires_at && !expired && (
              <p className="text-xs text-amber-800">
                Pay before {new Date(order.payment.expires_at).toLocaleTimeString("id-ID")}.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {canResume && <Button onClick={resume}>Pay now</Button>}
              <Button variant="outline" disabled={pending || !paymentReady} onClick={check}>
                <RefreshCw className="h-4 w-4" /> Check payment status
              </Button>
              <Button variant="ghost" disabled={pending} onClick={cancel}>
                Cancel order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {order.status === "REJECTED" && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          The cart could not accept this order. Contact HAFFYE support for a refund.
        </p>
      )}

      {fb.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{fb.error}</p>}
      {fb.message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{fb.message}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-espresso">
                  {i.quantity}× {i.product_name}
                  {i.variant_name ? ` (${i.variant_name})` : ""}
                </p>
                <p className="text-[11px] text-coffee">
                  {[i.sweetness, i.ice, ...i.addons.map((a) => `+${a.name}`)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="font-semibold">{formatIDR(i.line_total)}</span>
            </div>
          ))}
          <div className="space-y-1 border-t border-coffee/15 pt-3 text-sm">
            <div className="flex justify-between text-coffee"><span>Subtotal</span><span>{formatIDR(order.subtotal)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Discount</span><span>-{formatIDR(order.discount)}</span></div>
            )}
            <div className="flex justify-between text-base font-bold text-espresso">
              <span>Total</span><span className="text-caramel">{formatIDR(order.total)}</span>
            </div>
            <p className="text-[11px] text-coffee">
              Payment: {order.payment?.status ?? "—"}
              {order.payment?.payment_type ? ` via ${order.payment.payment_type}` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
