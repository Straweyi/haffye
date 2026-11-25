import { requireRole } from "@/lib/auth";
import {
  getCatalogProducts,
  getCategories,
  getOperationalVendors,
} from "@/lib/queries/customer";
import { HomeView } from "@/components/customer/home-view";

export const dynamic = "force-dynamic";

export default async function CustomerHomePage() {
  const session = await requireRole("customer");
  const [vendors, categories, products] = await Promise.all([
    getOperationalVendors(),
    getCategories(),
    getCatalogProducts(),
  ]);

  return (
    <HomeView
      customerName={session.full_name}
      initialVendors={vendors}
      categories={categories}
      featuredProducts={products}
    />
  );
}
