import { getCustomersAdmin } from "@/lib/queries/admin";
import { setProfileActiveAction } from "@/app/actions/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import { ActionButton } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import {
  EmptyRow,
  PageHeader,
  Section,
  TableWrap,
  tableCls,
  tdCls,
  thCls,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const rows = await getCustomersAdmin();
  return (
    <>
      <PageHeader title="Customer Management" subtitle={`${rows.length} registered customers`} />
      <Section title="Customers">
        {rows.length === 0 ? (
          <EmptyRow />
        ) : (
          <TableWrap>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Email</th>
                  <th className={thCls}>Phone</th>
                  <th className={thCls}>Paid orders</th>
                  <th className={thCls}>Spent</th>
                  <th className={thCls}>Points</th>
                  <th className={thCls}>Joined</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-coffee/10">
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className={`${tdCls} font-semibold`}>{c.full_name || "—"}</td>
                    <td className={tdCls}>{c.email}</td>
                    <td className={tdCls}>{c.phone ?? "—"}</td>
                    <td className={tdCls}>{c.orders}</td>
                    <td className={tdCls}>{formatIDR(c.spent)}</td>
                    <td className={tdCls}>{c.points}</td>
                    <td className={tdCls}>{formatDateTime(c.created_at)}</td>
                    <td className={tdCls}>
                      <Badge variant={c.is_active ? "active" : "offline"}>
                        {c.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className={tdCls}>
                      <ActionButton
                        action={setProfileActiveAction}
                        payload={{ profileId: c.id, isActive: !c.is_active }}
                        label={c.is_active ? "Disable" : "Enable"}
                        confirm={
                          c.is_active
                            ? `Disable ${c.email}? They will not be able to log in.`
                            : undefined
                        }
                      />
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

