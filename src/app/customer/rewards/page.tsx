import { requireRole } from "@/lib/auth";
import { getCustomerContext } from "@/lib/queries/customer";
import { getRewardsData } from "@/lib/queries/orders";
import { RewardsView } from "@/components/customer/rewards-view";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const session = await requireRole("customer");
  const [prefs, rewards] = await Promise.all([getCustomerContext(session.id), getRewardsData(session.id)]);
  return (
    <RewardsView
      points={prefs.pointsBalance}
      lifetime={prefs.lifetimePoints}
      catalog={rewards.catalog}
      wallet={rewards.wallet}
      transactions={rewards.transactions}
    />
  );
}
