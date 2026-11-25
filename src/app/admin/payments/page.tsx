import Link from "next/link";
import { getPaymentsAdmin } from "@/lib/queries/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import { EmptyRow, PageHeader, Section, StatCard, StatusBadge, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const PAY_STATUSES = ["PENDING", "PAID", "EXPIRED", "CANCELLED", "FAILED", "REFUNDED"];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const { payments, totals } = await getPaymentsAdmin(sp.status);

  return (
    <>
      <PageHeader title="Payments" subtitle="Midtrans transaction status and server-verified payment ledger." />

      <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {totals.map((t) => (
          <StatCard key={t.status} label={t.status} value={formatIDR(t.amount)} hint={`${t.count} tx`} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/admin/payments"
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !sp.status ? "bg-espresso text-cream" : "bg-cream text-coffee"
          }`}
        >
          All
        </Link>
        {PAY_STATUSES.map((st) => (
          <Link
            key={st}
            href={`/admin/payments?status=${st}`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sp.status === st ? "bg-espresso text-cream" : "bg-cream text-coffee"
            }`}
          >
            {st}
          </Link>
        ))}
      </div>

      <Section title={`Transactions (${payments.length})`}>
        {payments.length === 0 ? (
          <EmptyRow />
        ) : (
          <TableWrap>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Provider Order</th>
                  <th className={thCls}>Provider</th>
                  <th className={thCls}>Method</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Amount</th>
                  <th className={thCls}>Paid At</th>
                  <th className={thCls}>Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-coffee/10">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className={`${tdCls} font-bold`}>{p.provider_order_id}</td>
                    <td className={tdCls}>{p.provider}</td>
                    <td className={tdCls}>{p.payment_type ?? "—"}</td>
                    <td className={tdCls}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className={`${tdCls} font-semibold`}>{formatIDR(p.gross_amount)}</td>
                    <td className={tdCls}>{formatDateTime(p.paid_at)}</td>
                    <td className={tdCls}>
                      <Link href={`/admin/orders/${p.order_id}`} className="font-semibold text-caramel hover:underline">
                        View Order
                      </Link>
                    </td>
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
