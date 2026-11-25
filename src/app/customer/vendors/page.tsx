import { getOperationalVendors } from "@/lib/queries/customer";
import { VendorsView } from "@/components/customer/vendors-view";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await getOperationalVendors();
  return <VendorsView initialVendors={vendors} />;
}
