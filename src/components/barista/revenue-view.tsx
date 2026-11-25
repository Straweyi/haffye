"use client";

import Link from "next/link";
import { formatIDR } from "@/lib/format";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BaristaRevenueSummary } from "@/types/domain";

export function BaristaRevenueView({ summary }: { summary: BaristaRevenueSummary }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-espresso">Revenue &amp; Transactions</h1>
        <p className="text-xs text-coffee">
          Real-time revenue metrics calculated from completed orders on your cart.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-coffee">Today&apos;s Revenue</p>
            <p className="mt-1.5 text-lg font-bold text-espresso">
              {formatIDR(summary.todayCompletedRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-coffee">Total Completed</p>
            <p className="mt-1.5 text-lg font-bold text-caramel">
              {formatIDR(summary.totalCompletedRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-coffee">Completed Orders</p>
            <p className="mt-1.5 text-lg font-bold text-espresso">{summary.completedCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-coffee">Avg Order Value</p>
            <p className="mt-1.5 text-lg font-bold text-espresso">
              {formatIDR(summary.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History ({summary.transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.transactions.length > 0 ? (
            <div className="divide-y divide-coffee/10">
              {summary.transactions.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/barista/orders/${tx.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:bg-cream/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-espresso">{tx.order_number}</span>
                      <Badge variant={ORDER_STATUS_BADGE_VARIANT[tx.status]}>
                        {ORDER_STATUS_LABELS[tx.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-coffee">
                      {tx.customer_name} · {new Date(tx.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-espresso">{formatIDR(tx.total)}</p>
                    <p className="text-[11px] text-coffee">
                      {tx.payment?.payment_type ?? tx.payment?.status ?? "—"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-coffee">No transactions recorded for this cart yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
