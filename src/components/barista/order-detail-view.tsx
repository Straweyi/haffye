"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CreditCard, Phone, User } from "lucide-react";
import { transitionOrderStatusAction } from "@/app/actions/barista";
import { formatIDR } from "@/lib/format";
import {
  ALLOWED_BARISTA_TRANSITIONS,
  NEXT_ACTION_LABEL,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
} from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BaristaOrderDetail, OrderStatus } from "@/types/domain";

const PIPELINE: OrderStatus[] = [
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "COMPLETED",
];

export function BaristaOrderDetailView({ order }: { order: BaristaOrderDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const transitions = ALLOWED_BARISTA_TRANSITIONS[order.status] ?? [];
  const stepIndex = PIPELINE.indexOf(order.status);

  const handleAction = (nextStatus: OrderStatus) => {
    setFeedback({});
    start(async () => {
      const res = await transitionOrderStatusAction({ orderId: order.id, nextStatus });
      setFeedback(res);
      await queryClient.invalidateQueries({ queryKey: ["barista-orders", order.vendor_id] });
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Link
        href="/barista/orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-coffee hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Incoming Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">{order.order_number}</h1>
          <p className="text-xs text-coffee">
            Placed {new Date(order.created_at).toLocaleString("id-ID")}
          </p>
        </div>
        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* Progress strip */}
      {stepIndex >= 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {PIPELINE.map((st, idx) => {
                const done = idx <= stepIndex;
                return (
                  <div key={st} className="text-center">
                    <div
                      className={`mx-auto h-2 w-full rounded-full ${
                        done ? "bg-caramel" : "bg-cream"
                      }`}
                    />
                    <p
                      className={`mt-1.5 text-[10px] font-semibold ${
                        done ? "text-espresso" : "text-coffee/50"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[st].replace(" (Incoming)", "")}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {feedback.error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
          {feedback.error}
        </p>
      )}
      {feedback.message && (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">
          {feedback.message}
        </p>
      )}

      {/* Actions */}
      {transitions.length > 0 && (
        <Card className="border-caramel/40 bg-cream/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-xs font-semibold text-espresso">
              {order.status === "READY_FOR_PICKUP"
                ? "Completing this order deducts recipe ingredients from your cart inventory."
                : "Next operational step:"}
            </p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((next) => (
                <Button
                  key={next}
                  disabled={pending}
                  variant={
                    next === "REJECTED"
                      ? "destructive"
                      : next === "COMPLETED" || next === "ACCEPTED"
                        ? "default"
                        : "caramel"
                  }
                  onClick={() => handleAction(next)}
                >
                  {pending ? "Processing…" : NEXT_ACTION_LABEL[next] ?? next}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer & Payment */}
        <Card>
          <CardHeader>
            <CardTitle>Customer &amp; Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center gap-2 text-espresso">
              <User className="h-4 w-4 text-caramel" />
              <span className="font-semibold">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-coffee">
                <Phone className="h-4 w-4 text-caramel" />
                <span>{order.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-coffee">
              <CreditCard className="h-4 w-4 text-caramel" />
              <span>
                Payment: <b>{order.payment?.status ?? "N/A"}</b>
                {order.payment?.payment_type ? ` (${order.payment.payment_type})` : ""}
              </span>
            </div>
            {order.inventory_deducted && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Recipe inventory deducted
              </div>
            )}
            {order.note && (
              <div className="rounded-xl bg-cream p-3 text-xs text-espresso">
                <b>Customer note:</b> {order.note}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((it) => (
              <div
                key={it.id}
                className="flex items-start justify-between gap-2 border-b border-coffee/10 pb-2.5 text-sm last:border-none last:pb-0"
              >
                <div>
                  <p className="font-semibold text-espresso">
                    {it.quantity}× {it.product_name}
                    {it.variant_name ? ` (${it.variant_name})` : ""}
                  </p>
                  <p className="text-xs text-coffee">
                    {[it.sweetness, it.ice, ...it.addons.map((a) => `+${a.name}`)]
                      .filter(Boolean)
                      .join(" · ") || "Standard"}
                  </p>
                </div>
                <p className="font-bold text-espresso">{formatIDR(it.line_total)}</p>
              </div>
            ))}

            <div className="space-y-1 border-t border-coffee/15 pt-3 text-sm">
              <div className="flex justify-between text-coffee">
                <span>Subtotal</span>
                <span>{formatIDR(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>-{formatIDR(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-espresso">
                <span>Total</span>
                <span className="text-caramel">{formatIDR(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
