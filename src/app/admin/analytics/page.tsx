import Link from "next/link";
import { getAnalytics } from "@/lib/queries/admin";
import { formatIDR } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import {
  BarChart,
  EmptyRow,
  HBarList,
  PageHeader,
  Section,
  StatCard,
  TableWrap,
  tableCls,
  tdCls,
  thCls,
} from "@/components/admin/ui";
import type { OrderStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const a = await getAnalytics(days);

  return (
    <>
      <PageHeader
        title="Sales Analytics"
        subtitle="All figures are computed from orders and order items in the database (timezone Asia/Jakarta)."
        actions={
          <div className="flex gap-1.5">
            {[7, 30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/analytics?days=${d}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  d === days ? "bg-espresso text-cream" : "bg-cream text-coffee"
                }`}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={`Revenue (${days}d)`} value={formatIDR(a.revenue)} />
        <StatCard label="Paid orders" value={String(a.daily.reduce((s, d) => s + d.count, 0))} />
        <StatCard
          label="Best seller"
          value={a.bestSellers[0]?.name ?? "—"}
          hint={a.bestSellers[0] ? `${a.bestSellers[0].quantity} sold` : undefined}
        />
        <StatCard
          label="Top vendor"
          value={a.vendors[0]?.code ?? "—"}
          hint={a.vendors[0] ? formatIDR(a.vendors[0].revenue) : undefined}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title={`Daily revenue (last ${Math.min(days, 90)} days)`}>
          <BarChart
            data={a.daily.map((d) => ({ label: d.label, value: d.value }))}
            format={formatIDR}
            showEvery={Math.ceil(a.daily.length / 8)}
          />
        </Section>
        <Section title="Weekly revenue (week starting Monday)">
          <BarChart
            data={a.weekly.map((d) => ({ label: d.label, value: d.value }))}
            format={formatIDR}
            barClass="bg-coffee"
          />
        </Section>
        <Section title="Monthly revenue">
          <BarChart
            data={a.monthly.map((d) => ({ label: d.label, value: d.value }))}
            format={formatIDR}
            barClass="bg-espresso"
          />
        </Section>
        <Section title="Peak ordering hours (WIB)">
          <BarChart
            data={a.peak.map((d) => ({ label: d.label, value: d.value }))}
            showEvery={3}
            barClass="bg-caramel"
          />
        </Section>
        <Section title="Best-selling products">
          <HBarList
            rows={a.bestSellers.map((b) => ({
              label: b.name,
              value: b.quantity,
              sub: formatIDR(b.revenue),
            }))}
            format={(n) => `${n} sold`}
          />
        </Section>
        <Section title="Order distribution">
          <HBarList
            rows={a.distribution.map((d) => ({
              label: ORDER_STATUS_LABELS[d.status as OrderStatus] ?? d.status,
              value: d.count,
            }))}
            format={(n) => `${n} orders`}
          />
        </Section>
      </div>

      <div className="mt-5">
        <Section title="Vendor performance">
          {a.vendors.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Vendor</th>
                    <th className={thCls}>Orders</th>
                    <th className={thCls}>Completed</th>
                    <th className={thCls}>Completion</th>
                    <th className={thCls}>Revenue</th>
                    <th className={thCls}>AOV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {a.vendors.map((v) => (
                    <tr key={v.vendor_id}>
                      <td className={`${tdCls} font-bold`}>
                        {v.code} <span className="font-normal text-coffee">{v.name}</span>
                      </td>
                      <td className={tdCls}>{v.orders}</td>
                      <td className={tdCls}>{v.completed}</td>
                      <td className={tdCls}>{v.completionRate}%</td>
                      <td className={`${tdCls} font-semibold`}>{formatIDR(v.revenue)}</td>
                      <td className={tdCls}>{formatIDR(v.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>
      </div>
    </>
  );
}

