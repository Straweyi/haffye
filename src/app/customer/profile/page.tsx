import { requireRole } from "@/lib/auth";
import { ProfileView } from "@/components/customer/profile-view";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage() {
  const session = await requireRole("customer");
  return <ProfileView email={session.email} />;
}
