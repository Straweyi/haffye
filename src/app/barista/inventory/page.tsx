import { requireRole } from "@/lib/auth";
import { getBaristaInventory, getMyVendor } from "@/lib/queries/barista";
import { BaristaInventoryView } from "@/components/barista/inventory-view";

export const dynamic = "force-dynamic";

export default async function BaristaInventoryPage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);

  if (!vendor) {
    return <BaristaInventoryView items={[]} allIngredients={[]} movements={[]} />;
  }

  const data = await getBaristaInventory(vendor.id);
  return (
    <BaristaInventoryView
      items={data.items}
      allIngredients={data.allIngredients}
      movements={data.movements}
    />
  );
}
