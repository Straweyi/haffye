import { getVendorsAdmin } from "@/lib/queries/admin";
import { FleetMapView } from "@/components/admin/fleet-map-view";

export const dynamic = "force-dynamic";

export default async function AdminFleetPage() {
  const { vendors } = await getVendorsAdmin();
  return <FleetMapView initialVendors={vendors} />;
}
