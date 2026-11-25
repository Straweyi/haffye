import {
  getCatalogProducts,
  getCategories,
  getOperationalVendors,
} from "@/lib/queries/customer";
import { MenuView } from "@/components/customer/menu-view";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; vendor?: string }>;
}) {
  const { category, vendor } = await searchParams;
  const [vendors, categories, products] = await Promise.all([
    getOperationalVendors(),
    getCategories(),
    getCatalogProducts(vendor),
  ]);

  return (
    <MenuView
      initialVendors={vendors}
      categories={categories}
      products={products}
      initialCategorySlug={category}
      queryVendorId={vendor}
    />
  );
}
