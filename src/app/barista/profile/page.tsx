import { requireRole } from "@/lib/auth";
import { getBaristaProfileData, getMyVendor } from "@/lib/queries/barista";
import { BaristaProfileView } from "@/components/barista/profile-view";

export const dynamic = "force-dynamic";

export default async function BaristaProfilePage() {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);
  const data = await getBaristaProfileData(session.id, vendor?.id ?? null);

  return (
    <BaristaProfileView
      email={session.email}
      initialFullName={data.fullName}
      initialPhone={data.phone}
      history={data.history}
    />
  );
}
