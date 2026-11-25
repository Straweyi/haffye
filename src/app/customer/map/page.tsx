import { getOperationalVendors } from "@/lib/queries/customer";
import { MapView } from "@/components/customer/map-view";

export const dynamic = "force-dynamic";

export default async function CustomerMapPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string }>;
}) {
  const [{ vendor }, vendors] = await Promise.all([searchParams, getOperationalVendors()]);
  return <MapView initialVendors={vendors} initialFocusVendorId={vendor} />;
}
