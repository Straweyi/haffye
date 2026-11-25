"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Coffee,
  MapPin,
  Package,
  TrendingUp,
} from "lucide-react";
import { useBarista } from "@/components/providers/barista-provider";
import { useBaristaOrders } from "@/hooks/use-barista-orders";
import { formatIDR } from "@/lib/format";
import { formatRelativeTime } from "@/lib/geo";
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
} from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BaristaOrderSummary, VendorStatus } from "@/types/domain";

const STATUS_OPTIONS: { status: VendorStatus; label: string; desc: string }[] = [
  { status: "ACTIVE", label: "Active", desc: "Accepting orders & GPS ready" },
  { status: "BUSY", label: "Busy", desc: "High queue, still open" },
  { status: "PAUSED", label: "Paused", desc: "Short break, orders paused" },
  { status: "OFFLINE", label: "Offline", desc: "Closed, clears live map pin" },
];

export function BaristaDashboardView({
  baristaName,
  initialOrders,
  todayRevenue,
  completedToday,
  lowStockCount,
}: {
  baristaName: string;
  initialOrders: BaristaOrderSummary[];
  todayRevenue: number;
  completedToday: number;
  lowStockCount: number;
}) {
  const {
    vendor,
    realtimeStatus,
    gpsActive,
    lastSentAt,
    nowMs,
    statusUpdating,
    statusFeedback,
    changeVendorStatus,
  } = useBarista();
  const { orders } = useBaristaOrders(initialOrders);

  if (!vendor) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <h1 className="text-lg font-bold text-espresso">No Vendor Unit Assigned</h1>
          <p className="mt-1 text-sm text-coffee">
            Ask an administrator to link your barista account to a HAFFYE mobile cart.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeQueue = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));

  return (
    <div className="space-y-6">
      {/* Header card & Quick Status Switcher */}
      <section className="rounded-2xl bg-espresso p-5 text-cream shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-caramel">
              {vendor.code} · {vendor.vehicle_label || "Mobile Cart"}
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              {vendor.name}
            </h1>
            <p className="text-xs text-cream/75">Operator: {baristaName || "Barista"}</p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-cream/10 px-3 py-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                realtimeStatus === "live"
                  ? "bg-emerald-400"
                  : realtimeStatus === "connecting"
                    ? "bg-amber-400"
                    : "bg-stone-400"
              }`}
            />
            <span>{realtimeStatus === "live" ? "Orders Live" : realtimeStatus}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUS_OPTIONS.map((opt) => {
            const active = vendor.status === opt.status;
            return (
              <button
                key={opt.status}
                type="button"
                disabled={statusUpdating}
                onClick={() => void changeVendorStatus(opt.status)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-caramel bg-caramel text-espresso"
                    : "border-cream/15 bg-cream/10 text-cream hover:bg-cream/15"
                }`}
              >
                <p className="text-xs font-bold">{opt.label}</p>
                <p className={`text-[10px] ${active ? "text-espresso/80" : "text-cream/70"}`}>
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {statusFeedback && <p className="mt-2.5 text-xs text-caramel">{statusFeedback}</p>}

        {/* GPS quick strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream/10 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-caramel" />
            <span>
              GPS:{" "}
              <b>{gpsActive ? "Broadcasting live" : "Stopped"}</b> · Last sent{" "}
              {formatRelativeTime(lastSentAt, nowMs)}
            </span>
          </div>
          <Link
            href="/barista/location"
            className="rounded-lg bg-caramel px-2.5 py-1 font-semibold text-espresso"
          >
            Manage GPS
          </Link>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-coffee">
              <span className="text-xs font-medium">Today&apos;s Revenue</span>
              <TrendingUp className="h-4 w-4 text-caramel" />
            </div>
            <p className="mt-2 text-lg font-bold text-espresso">{formatIDR(todayRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-coffee">
              <span className="text-xs font-medium">Active Orders</span>
              <ClipboardList className="h-4 w-4 text-caramel" />
            </div>
            <p className="mt-2 text-lg font-bold text-espresso">{activeQueue.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-coffee">
              <span className="text-xs font-medium">Completed Today</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-lg font-bold text-espresso">{completedToday}</p>
          </CardContent>
        </Card>

        <Card className={lowStockCount > 0 ? "border-amber-300 bg-amber-50/70" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-coffee">
              <span className="text-xs font-medium">Low Stock Items</span>
              <AlertTriangle
                className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-600" : "text-caramel"}`}
              />
            </div>
            <p className="mt-2 text-lg font-bold text-espresso">{lowStockCount}</p>
          </CardContent>
        </Card>
      </section>

      {/* Quick Shortcuts */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/barista/orders">
          <Button variant="outline" className="w-full justify-between">
            <span>Order Queue</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/barista/products">
          <Button variant="outline" className="w-full justify-between">
            <span className="inline-flex items-center gap-1.5">
              <Coffee className="h-4 w-4 text-caramel" />
              Menu Stock
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/barista/inventory">
          <Button variant="outline" className="w-full justify-between">
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-4 w-4 text-caramel" />
              Inventory
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/barista/revenue">
          <Button variant="outline" className="w-full justify-between">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-caramel" />
              Revenue
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Live Incoming Orders Preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-espresso">
            Incoming Queue ({activeQueue.length})
          </h2>
          <Link href="/barista/orders" className="text-xs font-semibold text-caramel">
            Open full queue
          </Link>
        </div>

        {activeQueue.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeQueue.slice(0, 4).map((order) => (
              <Link key={order.id} href={`/barista/orders/${order.id}`}>
                <Card className="transition hover:border-caramel">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-espresso">{order.order_number}</span>
                      <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-coffee">
                      {order.customer_name} · {order.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                    </p>
                    <p className="mt-2 text-sm font-bold text-caramel">{formatIDR(order.total)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-sm text-coffee">
              No active orders in queue right now.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
