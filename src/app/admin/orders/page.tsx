import Link from "next/link";
import { getOrdersAdmin, getVendorsAdmin } from "@/lib/queries/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import { EmptyRow, PageHeader, Section, StatusBadge, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vendor?: string }>;
}) {
  const sp = await searchParams;
  const [orders, { vendors }] = await Promise.all([
    getOrdersAdmin({ status: sp.status, vendor: sp.vendor }),
    getVendorsAdmin(),
  ]);

  const buildHref = (next: { status?: string; vendor?: string }) => {
    const q = new URLSearchParams();
    if (next.status) q.set("status", next.status);
    if (next.vendor) q.set("vendor", next.vendor);
    const s = q.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader title="Orders" subtitle={`${orders.length} order(s) matching filter`} />

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={buildHref({ vendor: sp.vendor })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !sp.status ? "bg-espresso text-cream" : "bg-cream text-coffee"
            }`}
          >
            All Statuses
          </Link>
          {ORDER_STATUSES.map((st) => (
            <Link
              key={st}
              href={buildHref({ status: st, vendor: sp.vendor })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                sp.status === st ? "bg-espresso text-cream" : "bg-cream text-coffee"
              }`}
            >
              {st}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Link
            href={buildHref({ status: sp.status })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              !sp.vendor ? "bg-caramel text-espresso" : "bg-cream text-coffee"
            }`}
          >
            All Carts
          </Link>
          {vendors.map((v) => (
            <Link
              key={v.id}
              href={buildHref({ status: sp.status, vendor: v.id })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                sp.vendor === v.id ? "bg-caramel text-espresso" : "bg-cream text-coffee"
              }`}
            >
              {v.code}
            </Link>
          ))}
        </div>
      </div>

      <Section title="Order List">
        {orders.length === 0 ? (
          <EmptyRow />
        ) : (
          <TableWrap>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Order #</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Vendor</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Total</th>
                  <th className={thCls}>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-coffee/10">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={`${tdCls} font-bold`}>
                      <Link href={`/admin/orders/${o.id}`} className="text-espresso hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className={tdCls}>{o.customer}</td>
                    <td className={tdCls}>{o.vendor}</td>
                    <td className={tdCls}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className={`${tdCls} font-semibold`}>{formatIDR(o.total)}</td>
                    <td className={tdCls}>{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
