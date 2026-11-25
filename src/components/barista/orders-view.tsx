"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock, RefreshCw } from "lucide-react";
import { transitionOrderStatusAction } from "@/app/actions/barista";
import { useBarista } from "@/components/providers/barista-provider";
import { useBaristaOrders } from "@/hooks/use-barista-orders";
import { formatIDR } from "@/lib/format";
import { formatRelativeTime } from "@/lib/geo";
import {
  ACTIVE_ORDER_STATUSES,
  ALLOWED_BARISTA_TRANSITIONS,
  NEXT_ACTION_LABEL,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
} from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BaristaOrderSummary, OrderStatus } from "@/types/domain";

type OrderTab = "ACTIVE" | "PENDING" | "HISTORY";

export function BaristaOrdersView({
  initialOrders,
}: {
  initialOrders: BaristaOrderSummary[];
}) {
  const queryClient = useQueryClient();
  const { vendor, realtimeStatus, nowMs } = useBarista();
  const { orders, refetch } = useBaristaOrders(initialOrders);

  const [tab, setTab] = useState<OrderTab>("ACTIVE");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const filtered = orders.filter((o) => {
    if (tab === "ACTIVE") return ACTIVE_ORDER_STATUSES.includes(o.status);
    if (tab === "PENDING") return o.status === "PENDING_PAYMENT";
    return !ACTIVE_ORDER_STATUSES.includes(o.status) && o.status !== "PENDING_PAYMENT";
  });

  const handleTransition = (orderId: string, nextStatus: OrderStatus) => {
    setPendingId(orderId);
    setFeedback({});
    startTransition(async () => {
      const res = await transitionOrderStatusAction({ orderId, nextStatus });
      setFeedback(res);
      setPendingId(null);
      await queryClient.invalidateQueries({ queryKey: ["barista-orders", vendor?.id ?? "none"] });
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">Incoming Orders</h1>
          <p className="text-xs text-coffee">
            Accept paid orders, update preparation progress, and complete customer handovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">Realtime: {realtimeStatus}</Badge>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ACTIVE", "Active Queue", orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length],
            ["PENDING", "Pending Payment", orders.filter((o) => o.status === "PENDING_PAYMENT").length],
            ["HISTORY", "History", orders.filter((o) => !ACTIVE_ORDER_STATUSES.includes(o.status) && o.status !== "PENDING_PAYMENT").length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              tab === key
                ? "bg-espresso text-cream"
                : "bg-cream text-espresso hover:bg-caramel/20"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Order Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((order) => {
            const transitions = ALLOWED_BARISTA_TRANSITIONS[order.status] ?? [];
            const busy = isPending && pendingId === order.id;

            return (
              <Card key={order.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-espresso">
                          {order.order_number}
                        </span>
                        <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-coffee">
                        {order.customer_name}
                        {order.customer_phone ? ` · ${order.customer_phone}` : ""} ·{" "}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="inline h-3 w-3" />
                          {formatRelativeTime(order.created_at, nowMs)}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-bold text-caramel">{formatIDR(order.total)}</p>
                      <Link
                        href={`/barista/orders/${order.id}`}
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-espresso hover:underline"
                      >
                        Details <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="rounded-xl bg-cream/70 p-3 text-xs text-espresso">
                    {order.items.map((it) => (
                      <div key={it.id} className="flex justify-between gap-2 py-0.5">
                        <span>
                          <b>{it.quantity}×</b> {it.product_name}
                          {it.variant_name ? ` (${it.variant_name})` : ""}
                          {[it.sweetness, it.ice, ...it.addons.map((a) => `+${a.name}`)]
                            .filter(Boolean)
                            .length > 0 && (
                            <span className="text-coffee">
                              {" "}
                              —{" "}
                              {[it.sweetness, it.ice, ...it.addons.map((a) => `+${a.name}`)]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">{formatIDR(it.line_total)}</span>
                      </div>
                    ))}
                    {order.note && (
                      <p className="mt-1.5 border-t border-coffee/10 pt-1.5 italic text-coffee">
                        Note: &ldquo;{order.note}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {transitions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {transitions.map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          disabled={busy}
                          variant={
                            next === "REJECTED"
                              ? "destructive"
                              : next === "COMPLETED" || next === "ACCEPTED"
                                ? "default"
                                : "caramel"
                          }
                          onClick={() => handleTransition(order.id, next)}
                        >
                          {busy ? "Updating…" : NEXT_ACTION_LABEL[next] ?? next}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-coffee">
            No orders in this tab.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
