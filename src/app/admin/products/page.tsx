import Link from "next/link";
import { getCategoryOptions, getProductsAdmin } from "@/lib/queries/admin";
import { deleteProductAction, toggleProductAvailabilityAction } from "@/app/actions/admin";
import { formatIDR } from "@/lib/format";
import { ActionButton } from "@/components/admin/forms";
import { ProductForm } from "@/components/admin/product-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import { EmptyRow, PageHeader, Section, TableWrap, tableCls, tdCls, thCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getProductsAdmin(), getCategoryOptions()]);

  return (
    <>
      <PageHeader
        title="Product Management"
        subtitle="Manage catalog items, pricing, images, sizes, and add-ons."
      />
      <div className="space-y-5">
        <Section title="Add new product">
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-caramel">
              + Open create product form
            </summary>
            <div className="mt-4">
              <ProductForm categories={categories} />
            </div>
          </details>
        </Section>

        <Section title={`Catalog (${products.length})`}>
          {products.length === 0 ? (
            <EmptyRow />
          ) : (
            <TableWrap>
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={thCls}>Product</th>
                    <th className={thCls}>Category</th>
                    <th className={thCls}>Base Price</th>
                    <th className={thCls}>Options</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-coffee/10">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cream">
                            <ProductImage src={p.image_url} alt={p.name} sizes="40px" />
                          </div>
                          <div>
                            <p className="font-bold text-espresso">{p.name}</p>
                            <p className="text-[11px] text-coffee">{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tdCls}>{p.category}</td>
                      <td className={`${tdCls} font-semibold`}>{formatIDR(p.base_price)}</td>
                      <td className={tdCls}>
                        {p.variants} sizes · {p.addons} add-ons
                      </td>
                      <td className={tdCls}>
                        <Badge variant={p.is_available ? "active" : "offline"}>
                          {p.is_available ? "Available" : "Hidden"}
                        </Badge>
                      </td>
                      <td className={tdCls}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/admin/products/${p.id}`}>
                            <Button size="sm" variant="outline">
                              Edit
                            </Button>
                          </Link>
                          <ActionButton
                            action={toggleProductAvailabilityAction}
                            payload={{ id: p.id, isActive: !p.is_available }}
                            label={p.is_available ? "Disable" : "Enable"}
                          />
                          <ActionButton
                            action={deleteProductAction}
                            payload={{ id: p.id }}
                            label="Delete"
                            variant="destructive"
                            confirm={`Delete ${p.name}? Past order items retain historical snapshots.`}
                          />
                        </div>
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
