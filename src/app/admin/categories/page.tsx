import { getCategoriesAdmin } from "@/lib/queries/admin";
import { deleteCategoryAction, saveCategoryAction } from "@/app/actions/admin";
import { ActionButton, SimpleForm, type FieldDef } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const fields = (c?: { name: string; sort_order: number; is_active: boolean }): FieldDef[] => [
  { name: "name", label: "Name", defaultValue: c?.name, required: true },
  { name: "sort_order", label: "Sort order", type: "number", defaultValue: c?.sort_order ?? 0 },
  {
    name: "is_active",
    label: "Active (visible to customers)",
    type: "checkbox",
    defaultValue: c?.is_active ?? true,
  },
];

export default async function CategoriesPage() {
  const cats = await getCategoriesAdmin();
  return (
    <>
      <PageHeader title="Product Categories" />
      <div className="space-y-5">
        <Section title="Add category">
          <SimpleForm
            action={saveCategoryAction}
            fields={fields()}
            submitLabel="Add category"
            resetOnSuccess
          />
        </Section>
        <Section title={`Categories (${cats.length})`}>
          {cats.length === 0 ? (
            <EmptyRow />
          ) : (
            <div className="space-y-3">
              {cats.map((c) => (
                <div key={c.id} className="rounded-xl border border-coffee/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-espresso">
                      {c.name}{" "}
                      <span className="text-xs font-normal text-coffee">
                        · {c.products} products · order {c.sort_order}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.is_active ? "active" : "offline"}>
                        {c.is_active ? "Active" : "Hidden"}
                      </Badge>
                      <ActionButton
                        action={deleteCategoryAction}
                        payload={{ id: c.id }}
                        label="Delete"
                        variant="destructive"
                        confirm={`Delete category ${c.name}?`}
                      />
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-caramel">
                      Edit
                    </summary>
                    <div className="mt-3">
                      <SimpleForm action={saveCategoryAction} extra={{ id: c.id }} fields={fields(c)} />
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

