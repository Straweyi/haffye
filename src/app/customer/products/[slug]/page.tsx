import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getOperationalVendors, getProductBySlug } from "@/lib/queries/customer";
import { ProductDetailView } from "@/components/customer/product-detail-view";

export const dynamic = "force-dynamic";

export default async function CustomerProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vendor?: string }>;
}) {
  const session = await requireRole("customer");
  const [{ slug }, { vendor }] = await Promise.all([params, searchParams]);
  const [product, vendors] = await Promise.all([
    getProductBySlug(slug, session.id, vendor),
    getOperationalVendors(),
  ]);

  if (!product) notFound();

  return <ProductDetailView product={product} initialVendors={vendors} queryVendorId={vendor} />;
}
