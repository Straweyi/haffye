import { getBaristasAdmin } from "@/lib/queries/admin";
import { createBaristaAction, setProfileActiveAction } from "@/app/actions/admin";
import { ActionButton, SimpleForm } from "@/components/admin/forms";
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

export default async function BaristasPage() {
  const { baristas, unassignedVendors } = await getBaristasAdmin();
  return (
    <>
      <PageHeader
        title="Barista Management"
        subtitle="Create barista accounts and link them to vendor units. Public sign-up can never create a barista."
      />
      <div className="space-y-5">
        <Section title="Create barista account">
          <SimpleForm
            action={createBaristaAction}
            submitLabel="Create barista"
            resetOnSuccess
            fields={[
              { name: "full_name", label: "Full name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "password", label: "Temporary password (min 8)", type: "password", required: true },
              { name: "phone", label: "Phone (optional)", placeholder: "08…" },
              {
                name: "vendorId",
                label: "Assign to vendor unit",
                type: "select",
                nullable: true,
                options: [
                  { value: "", label: "— none (assign later) —" },
                  ...unassignedVendors.map((v) => ({
                    value: v.id,
                    label: `${v.code} · ${v.name}`,
                  })),
                ],
              },
            ]}
          />
        </Section>

        <Section title={`Baristas (${baristas.length})`}>
          {baristas.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Name</th>
                    <th className={thCls}>Email</th>
                    <th className={thCls}>Phone</th>
                    <th className={thCls}>Vendor</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {baristas.map((b) => (
                    <tr key={b.id}>
                      <td className={`${tdCls} font-semibold`}>{b.full_name || "—"}</td>
                      <td className={tdCls}>{b.email}</td>
                      <td className={tdCls}>{b.phone ?? "—"}</td>
                      <td className={tdCls}>
                        {b.vendor ? (
                          `${b.vendor.code} · ${b.vendor.name}`
                        ) : (
                          <span className="text-amber-700">Unassigned</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        <Badge variant={b.is_active ? "active" : "offline"}>
                          {b.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className={tdCls}>
                        <ActionButton
                          action={setProfileActiveAction}
                          payload={{ profileId: b.id, isActive: !b.is_active }}
                          label={b.is_active ? "Disable" : "Enable"}
                          confirm={b.is_active ? `Disable ${b.email}?` : undefined}
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

