import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCategoryOptions, getProductAdmin } from "@/lib/queries/admin";
import {
  addAddonAction,
  addVariantAction,
  deleteAddonAction,
  deleteVariantAction,
} from "@/app/actions/admin";
import { formatIDR } from "@/lib/format";
import { ActionButton, SimpleForm } from "@/components/admin/forms";
import { ProductForm } from "@/components/admin/product-form";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, PageHeader, Section } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [product, categories] = await Promise.all([
    getProductAdmin(id),
    getCategoryOptions(),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-coffee hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      <PageHeader title={product.name} subtitle={`Slug: ${product.slug}`} />

      <Section title="Product details">
        <ProductForm categories={categories} product={product} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={`Sizes / Variants (${product.variants.length})`}>
          {product.variants.length === 0 ? (
            <EmptyRow text="No size variants yet." />
          ) : (
            <div className="divide-y divide-coffee/10">
              {product.variants.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div>
                    <span className="font-bold text-espresso">{v.name}</span>{" "}
                    <span className="text-coffee">
                      ({v.price_delta >= 0 ? `+${formatIDR(v.price_delta)}` : formatIDR(v.price_delta)})
                    </span>{" "}
                    {v.is_default && <Badge variant="caramel">Default</Badge>}
                  </div>
                  <ActionButton
                    action={deleteVariantAction}
                    payload={{ id: v.id }}
                    label="Remove"
                    variant="destructive"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-coffee/10 pt-3">
            <SimpleForm
              action={addVariantAction}
              extra={{ product_id: product.id }}
              submitLabel="Add size"
              resetOnSuccess
              fields={[
                { name: "name", label: "Size name", required: true, placeholder: "e.g. Large" },
                { name: "price_delta", label: "Price delta (IDR)", type: "number", defaultValue: 0, required: true },
                { name: "is_default", label: "Default size", type: "checkbox", defaultValue: false },
              ]}
            />
          </div>
        </Section>

        <Section title={`Add-ons (${product.addons.length})`}>
          {product.addons.length === 0 ? (
            <EmptyRow text="No add-ons yet." />
          ) : (
            <div className="divide-y divide-coffee/10">
              {product.addons.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <div>
                    <span className="font-bold text-espresso">{a.name}</span>{" "}
                    <span className="text-coffee">(+{formatIDR(a.price)})</span>
                  </div>
                  <ActionButton
                    action={deleteAddonAction}
                    payload={{ id: a.id }}
                    label="Remove"
                    variant="destructive"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-coffee/10 pt-3">
            <SimpleForm
              action={addAddonAction}
              extra={{ product_id: product.id }}
              submitLabel="Add add-on"
              resetOnSuccess
              fields={[
                { name: "name", label: "Add-on name", required: true, placeholder: "e.g. Oat Milk" },
                { name: "price", label: "Price (IDR)", type: "number", defaultValue: 5000, required: true },
              ]}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
