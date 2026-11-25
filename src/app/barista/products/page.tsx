import { requireRole } from "@/lib/auth";
import { getBaristaProducts, getMyVendor } from "@/lib/queries/barista";
import { BaristaProductsView } from "@/components/barista/products-view";

export const dynamic = "force-dynamic";

export default async function BaristaProductsPage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);
  const products = vendor ? await getBaristaProducts(vendor.id) : [];

  return <BaristaProductsView initialProducts={products} />;
}
