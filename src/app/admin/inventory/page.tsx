import { getInventoryAdmin } from "@/lib/queries/admin";
import {
  allocateStockAction,
  deleteRecipeAction,
  saveIngredientAction,
  saveRecipeAction,
} from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";
import { ActionButton, SimpleForm } from "@/components/admin/forms";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const data = await getInventoryAdmin();

  const vendorOptions = data.vendors.map((v) => ({ value: v.id, label: `${v.code} · ${v.name}` }));
  const ingOptions = data.ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const prodOptions = data.products.map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <PageHeader
        title="Inventory & Recipes"
        subtitle="Manage raw ingredients, product recipes, and vendor stock allocations. Negative stock is enforced against at the database level."
      />

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-3">
          <Section title="Allocate / Adjust Vendor Stock">
            {vendorOptions.length > 0 && ingOptions.length > 0 ? (
              <SimpleForm
                action={allocateStockAction}
                submitLabel="Apply Stock"
                resetOnSuccess
                fields={[
                  { name: "vendor_id", label: "Vendor", type: "select", options: vendorOptions, required: true, wide: true },
                  { name: "ingredient_id", label: "Ingredient", type: "select", options: ingOptions, required: true },
                  {
                    name: "type",
                    label: "Movement",
                    type: "select",
                    defaultValue: "STOCK_IN",
                    options: [
                      { value: "STOCK_IN", label: "Stock In (+)" },
                      { value: "STOCK_OUT", label: "Stock Out (-)" },
                      { value: "ADJUSTMENT", label: "Adjustment (+/-)" },
                    ],
                  },
                  { name: "quantity", label: "Quantity", type: "number", step: "0.01", required: true },
                  { name: "note", label: "Note", placeholder: "Warehouse dispatch" },
                ]}
              />
            ) : (
              <EmptyRow text="Create vendors and ingredients first." />
            )}
          </Section>

          <Section title="Add Ingredient">
            <SimpleForm
              action={saveIngredientAction}
              submitLabel="Add ingredient"
              resetOnSuccess
              fields={[
                { name: "name", label: "Ingredient name", required: true, placeholder: "e.g. Matcha Powder", wide: true },
                { name: "unit", label: "Unit", required: true, placeholder: "g / ml / pcs" },
                { name: "low_stock_threshold", label: "Low stock alert", type: "number", step: "0.01", defaultValue: 500, required: true },
              ]}
            />
          </Section>

          <Section title="Set Product Recipe Line">
            {prodOptions.length > 0 && ingOptions.length > 0 ? (
              <SimpleForm
                action={saveRecipeAction}
                submitLabel="Save recipe line"
                resetOnSuccess
                fields={[
                  { name: "product_id", label: "Product", type: "select", options: prodOptions, required: true, wide: true },
                  { name: "ingredient_id", label: "Ingredient", type: "select", options: ingOptions, required: true, wide: true },
                  { name: "quantity", label: "Qty per cup/item", type: "number", step: "0.001", required: true, wide: true },
                ]}
              />
            ) : (
              <EmptyRow text="Create products and ingredients first." />
            )}
          </Section>
        </div>

        <Section title={`Vendor Stock Levels (${data.stock.length})`}>
          {data.stock.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Vendor</th>
                    <th className={thCls}>Ingredient</th>
                    <th className={thCls}>Quantity</th>
                    <th className={thCls}>Alert Threshold</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {data.stock.map((s) => (
                    <tr key={s.id}>
                      <td className={`${tdCls} font-bold`}>
                        {s.vendor_code} <span className="font-normal text-coffee">{s.vendor_name}</span>
                      </td>
                      <td className={tdCls}>{s.ingredient}</td>
                      <td className={`${tdCls} font-semibold`}>
                        {s.quantity} {s.unit}
                      </td>
                      <td className={tdCls}>
                        {s.threshold} {s.unit}
                      </td>
                      <td className={tdCls}>
                        <Badge variant={s.low ? "busy" : "active"}>{s.low ? "Low Stock" : "OK"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={`Ingredients (${data.ingredients.length})`}>
            {data.ingredients.length === 0 ? (
              <EmptyRow />
            ) : (
              <div className="space-y-2.5">
                {data.ingredients.map((i) => (
                  <div key={i.id} className="rounded-xl border border-coffee/10 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-espresso">
                        {i.name} ({i.unit})
                      </span>
                      <span className="text-coffee">Alert &le; {i.low_stock_threshold}</span>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold text-caramel">Edit</summary>
                      <div className="mt-2">
                        <SimpleForm
                          action={saveIngredientAction}
                          extra={{ id: i.id }}
                          fields={[
                            { name: "name", label: "Name", defaultValue: i.name, required: true },
                            { name: "unit", label: "Unit", defaultValue: i.unit, required: true },
                            { name: "low_stock_threshold", label: "Low stock alert", type: "number", step: "0.01", defaultValue: i.low_stock_threshold, required: true },
                          ]}
                        />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Product Recipes (${data.recipes.length})`}>
            {data.recipes.length === 0 ? (
              <EmptyRow />
            ) : (
              <div className="divide-y divide-coffee/10">
                {data.recipes.map((r) => (
                  <div
                    key={`${r.product_id}-${r.ingredient_id}`}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-espresso">{r.product}</span>{" "}
                      <span className="text-coffee">
                        uses {r.quantity} {r.unit} {r.ingredient}
                      </span>
                    </div>
                    <ActionButton
                      action={deleteRecipeAction}
                      payload={{ product_id: r.product_id, ingredient_id: r.ingredient_id }}
                      label="Remove"
                      variant="destructive"
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section title="Recent Inventory Movements">
          {data.movements.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Time</th>
                    <th className={thCls}>Vendor</th>
                    <th className={thCls}>Ingredient</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Qty</th>
                    <th className={thCls}>Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {data.movements.map((m) => (
                    <tr key={m.id}>
                      <td className={tdCls}>{formatDateTime(m.created_at)}</td>
                      <td className={`${tdCls} font-semibold`}>{m.vendor}</td>
                      <td className={tdCls}>{m.ingredient}</td>
                      <td className={tdCls}>
                        <Badge variant="outline">{m.type}</Badge>
                      </td>
                      <td className={`${tdCls} font-bold ${m.quantity >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                      </td>
                      <td className={tdCls}>{m.note ?? "—"}</td>
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
