import { getOperationalVendors } from "@/lib/queries/customer";
import { CartView } from "@/components/customer/cart-view";

export const dynamic = "force-dynamic";

export default async function CustomerCartPage() {
  const vendors = await getOperationalVendors();
  return <CartView initialVendors={vendors} />;
}
