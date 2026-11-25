import { getRewardsAdmin } from "@/lib/queries/admin";
import { adjustPointsAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";
import { SimpleForm } from "@/components/admin/forms";
import { EmptyRow, PageHeader, Section, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const data = await getRewardsAdmin();

  return (
    <>
      <PageHeader title="Rewards & Loyalty" subtitle="Monitor customer loyalty balances and issue manual point adjustments." />

      <div className="space-y-5">
        <Section title="Adjust Customer Points">
          {data.customers.length > 0 ? (
            <SimpleForm
              action={adjustPointsAction}
              submitLabel="Apply Points Adjustment"
              resetOnSuccess
              fields={[
                {
                  name: "customerId",
                  label: "Customer",
                  type: "select",
                  options: data.customers.map((c) => ({ value: c.id, label: c.name })),
                  required: true,
                },
                {
                  name: "points",
                  label: "Points (+ add / - deduct)",
                  type: "number",
                  required: true,
                  placeholder: "e.g. 20 or -10",
                },
                {
                  name: "reason",
                  label: "Reason",
                  required: true,
                  placeholder: "e.g. Compensation / Promo bonus",
                  wide: true,
                },
              ]}
            />
          ) : (
            <EmptyRow text="No customer accounts found." />
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Top Loyalty Accounts">
            {data.top.length === 0 ? (
              <EmptyRow />
            ) : (
              <TableWrap>
                <table className={tableCls}>
                  <thead>
                    <tr>
                      <th className={thCls}>Customer</th>
                      <th className={thCls}>Current Points</th>
                      <th className={thCls}>Lifetime Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-coffee/10">
                    {data.top.map((t) => (
                      <tr key={t.id}>
                        <td className={`${tdCls} font-semibold`}>{t.name}</td>
                        <td className={`${tdCls} font-bold text-caramel`}>{t.balance}</td>
                        <td className={tdCls}>{t.lifetime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Section>

          <Section title="Recent Points Transactions">
            {data.transactions.length === 0 ? (
              <EmptyRow />
            ) : (
              <div className="divide-y divide-coffee/10">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-espresso">
                        {tx.name} · {tx.reason}
                      </p>
                      <p className="text-coffee">{formatDateTime(tx.created_at)}</p>
                    </div>
                    <span className={`font-bold ${tx.points >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                      {tx.points > 0 ? `+${tx.points}` : tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
