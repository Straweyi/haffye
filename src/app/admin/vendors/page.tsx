import { getVendorsAdmin } from "@/lib/queries/admin";
import { saveVendorAction, setVendorActiveAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";
import { ActionButton, SimpleForm, type FieldDef } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const { vendors, freeBaristas, allBaristas } = await getVendorsAdmin();

  const fields = (current?: {
    barista_id: string | null;
    code: string;
    name: string;
    vehicle_label: string | null;
    description: string | null;
  }): FieldDef[] => {
    const options = [
      { value: "", label: "— unassigned —" },
      ...(current?.barista_id ? allBaristas.filter((b) => b.id === current.barista_id) : []).map(
        (b) => ({ value: b.id, label: b.full_name }),
      ),
      ...freeBaristas.map((b) => ({ value: b.id, label: b.full_name })),
    ];
    return [
      {
        name: "code",
        label: "Vendor code",
        defaultValue: current?.code,
        required: true,
        placeholder: "HAF-003",
      },
      { name: "name", label: "Name", defaultValue: current?.name, required: true },
      { name: "vehicle_label", label: "Vehicle label", defaultValue: current?.vehicle_label },
      {
        name: "barista_id",
        label: "Barista",
        type: "select",
        nullable: true,
        defaultValue: current?.barista_id ?? "",
        options,
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        defaultValue: current?.description,
      },
    ];
  };

  return (
    <>
      <PageHeader
        title="Vendor Management"
        subtitle="Mobile coffee units. Disabling a vendor sets it OFFLINE and removes it from the live map."
      />
      <div className="space-y-5">
        <Section title="Add vendor unit">
          <SimpleForm action={saveVendorAction} fields={fields()} submitLabel="Create vendor" resetOnSuccess />
        </Section>

        <Section title={`Vendor units (${vendors.length})`}>
          {vendors.length === 0 ? (
            <EmptyRow />
          ) : (
            <div className="space-y-3">
              {vendors.map((v) => (
                <div key={v.id} className="rounded-xl border border-coffee/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-espresso">
                        {v.code} · {v.name}
                      </p>
                      <p className="text-xs text-coffee">
                        {v.vehicle_label ?? "No vehicle label"} · Barista:{" "}
                        {v.barista_name ?? "unassigned"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-coffee">
                        {v.location
                          ? `GPS ${v.location.latitude.toFixed(4)}, ${v.location.longitude.toFixed(4)} · ${formatDateTime(v.location.updated_at)}`
                          : "No live location"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={v.status} />
                      {!v.is_active && <Badge variant="offline">Disabled</Badge>}
                      <ActionButton
                        action={setVendorActiveAction}
                        payload={{ id: v.id, isActive: !v.is_active }}
                        label={v.is_active ? "Disable" : "Enable"}
                        confirm={v.is_active ? `Disable ${v.code}? It will go offline.` : undefined}
                      />
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-caramel">
                      Edit details
                    </summary>
                    <div className="mt-3">
                      <SimpleForm action={saveVendorAction} extra={{ id: v.id }} fields={fields(v)} />
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

