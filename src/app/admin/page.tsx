import Link from "next/link";
import { getOverview } from "@/lib/queries/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import {
  BarChart,
  EmptyRow,
  PageHeader,
  Section,
  StatCard,
  StatusBadge,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const o = await getOverview();
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Live business metrics from the database. Revenue counts paid orders (excludes pending, cancelled, rejected, refunded)."
      />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <StatCard label="Total Revenue" value={formatIDR(o.totalRevenue)} />
        <StatCard
          label="Total Orders"
          value={String(o.totalOrders)}
          hint="Paid and in-progress orders"
        />
        <StatCard
          label="Active Vendors"
          value={String(o.activeVendors)}
          hint="ACTIVE or BUSY right now"
        />
        <StatCard label="Total Customers" value={String(o.totalCustomers)} />
        <StatCard label="Average Order Value" value={formatIDR(o.avgOrderValue)} />
        <StatCard label="Completed Orders" value={String(o.completedOrders)} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Daily revenue (last 14 days)">
            <BarChart
              data={o.daily.map((d) => ({ label: d.label, value: d.value }))}
              format={formatIDR}
              showEvery={2}
            />
          </Section>
        </div>
        <Section
          title="Recent operational logs"
          right={
            <Link href="/admin/reports" className="text-xs font-semibold text-caramel">
              All logs
            </Link>
          }
        >
          {o.logs.length === 0 ? (
            <EmptyRow />
          ) : (
            <ul className="space-y-2 text-xs">
              {o.logs.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="font-semibold text-espresso">{l.action}</span>
                  <span className="text-coffee">{formatDateTime(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-5">
        <Section
          title="Recent orders"
          right={
            <Link href="/admin/orders" className="text-xs font-semibold text-caramel">
              View all
            </Link>
          }
        >
          {o.recentOrders.length === 0 ? (
            <EmptyRow />
          ) : (
            <ul className="divide-y divide-coffee/10">
              {o.recentOrders.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/orders/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs hover:bg-cream/50"
                  >
                    <span className="font-bold text-espresso">
                      {r.order_number} <span className="font-normal text-coffee">· {r.vendor}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge status={r.status} />
                      <b>{formatIDR(r.total)}</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
