import { getVouchersAdmin } from "@/lib/queries/admin";
import { createVoucherAction, toggleVoucherAction } from "@/app/actions/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import { ActionButton, SimpleForm } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const vouchers = await getVouchersAdmin();

  return (
    <>
      <PageHeader title="Promotions & Vouchers" subtitle="Create discount vouchers and manage active campaigns." />

      <div className="space-y-5">
        <Section title="Create Voucher">
          <SimpleForm
            action={createVoucherAction}
            submitLabel="Create Voucher"
            resetOnSuccess
            fields={[
              { name: "code", label: "Voucher Code", required: true, placeholder: "e.g. HAFFYE15" },
              {
                name: "type",
                label: "Discount Type",
                type: "select",
                defaultValue: "PERCENT",
                options: [
                  { value: "PERCENT", label: "Percentage (%)" },
                  { value: "FIXED", label: "Fixed Amount (IDR)" },
                ],
              },
              { name: "value", label: "Value (% or IDR)", type: "number", required: true, placeholder: "15 or 5000" },
              { name: "min_order", label: "Minimum Order (IDR)", type: "number", defaultValue: 0 },
              { name: "max_discount", label: "Max Discount (IDR, optional)", type: "number", nullable: true },
              { name: "points_cost", label: "Loyalty Points Cost (0 = free)", type: "number", defaultValue: 0 },
              { name: "usage_limit", label: "Usage Limit (optional)", type: "number", nullable: true },
              { name: "valid_until", label: "Valid Until (optional)", type: "date", nullable: true },
            ]}
          />
        </Section>

        <Section title={`Vouchers (${vouchers.length})`}>
          {vouchers.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Code</th>
                    <th className={thCls}>Discount</th>
                    <th className={thCls}>Points</th>
                    <th className={thCls}>Redeemed / Used</th>
                    <th className={thCls}>Expires</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {vouchers.map((v) => (
                    <tr key={v.id}>
                      <td className={`${tdCls} font-bold`}>{v.code}</td>
                      <td className={tdCls}>
                        {v.type === "PERCENT" ? `${v.value}%` : formatIDR(v.value)}
                        {v.min_order > 0 ? ` (min ${formatIDR(v.min_order)})` : ""}
                        {v.max_discount ? ` · cap ${formatIDR(v.max_discount)}` : ""}
                      </td>
                      <td className={tdCls}>{v.points_cost} pts</td>
                      <td className={tdCls}>
                        {v.redeemed}
                        {v.usage_limit ? ` / ${v.usage_limit}` : ""} ({v.used} used)
                      </td>
                      <td className={tdCls}>{v.valid_until ? formatDateTime(v.valid_until) : "No expiry"}</td>
                      <td className={tdCls}>
                        <Badge variant={v.is_active ? "active" : "offline"}>
                          {v.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className={tdCls}>
                        <ActionButton
                          action={toggleVoucherAction}
                          payload={{ id: v.id, isActive: !v.is_active }}
                          label={v.is_active ? "Deactivate" : "Activate"}
                        />
                      </td>
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
