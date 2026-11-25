"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Ticket } from "lucide-react";
import { redeemVoucherAction } from "@/app/actions/checkout";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RewardVoucher, WalletVoucher } from "@/lib/queries/orders";

const describe = (v: RewardVoucher) =>
  `${v.type === "PERCENT" ? `${v.value}% off` : `${formatIDR(v.value)} off`}${
    v.min_order > 0 ? ` · min ${formatIDR(v.min_order)}` : ""
  }${v.max_discount ? ` · max ${formatIDR(v.max_discount)}` : ""}`;

export function RewardsView({
  points,
  lifetime,
  catalog,
  wallet,
  transactions,
}: {
  points: number;
  lifetime: number;
  catalog: RewardVoucher[];
  wallet: WalletVoucher[];
  transactions: { id: string; points: number; reason: string; created_at: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fb, setFb] = useState<{ error?: string; message?: string }>({});

  const redeem = (voucherId: string) =>
    start(async () => {
      setFb(await redeemVoucherAction({ voucherId }));
      router.refresh();
    });

  const unused = wallet.filter((w) => !w.used_at);
  const used = wallet.filter((w) => w.used_at);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-espresso">Rewards</h1>

      <Card className="bg-espresso text-cream">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-caramel">Loyalty points</p>
            <p className="mt-1 text-3xl font-bold">{points}</p>
            <p className="text-xs text-cream/75">Lifetime earned: {lifetime} · 1 point per Rp 10.000 spent</p>
          </div>
          <Award className="h-10 w-10 text-caramel" />
        </CardContent>
      </Card>

      {fb.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{fb.error}</p>}
      {fb.message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{fb.message}</p>}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-espresso">Redeem vouchers</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.map((v) => {
            const owned = unused.some((w) => w.id === v.id);
            const afford = points >= v.points_cost;
            return (
              <Card key={v.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-espresso">
                      <Ticket className="h-4 w-4 text-caramel" /> {v.code}
                    </span>
                    <Badge variant="caramel">{v.points_cost === 0 ? "Free" : `${v.points_cost} pts`}</Badge>
                  </div>
                  <p className="text-xs text-coffee">{describe(v)}</p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={pending || owned || !afford}
                    onClick={() => redeem(v.id)}
                  >
                    {owned ? "In your wallet" : afford ? "Redeem" : "Not enough points"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {catalog.length === 0 && <p className="text-xs text-coffee">No vouchers available right now.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-espresso">My vouchers</h2>
        {unused.length === 0 && used.length === 0 && <p className="text-xs text-coffee">Your wallet is empty.</p>}
        {[...unused, ...used].map((w) => (
          <Card key={w.customer_voucher_id} className={w.used_at ? "opacity-60" : ""}>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div>
                <p className="text-sm font-bold text-espresso">{w.code}</p>
                <p className="text-xs text-coffee">{describe(w)}</p>
              </div>
              <Badge variant={w.used_at ? "offline" : "active"}>{w.used_at ? "Used" : "Ready"}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Points history</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-coffee/10">
          {transactions.length === 0 && <p className="text-xs text-coffee">No point activity yet.</p>}
          {transactions.map((t) => (
            <div key={t.id} className="flex justify-between py-2 text-xs">
              <div>
                <p className="font-semibold text-espresso">{t.reason}</p>
                <p className="text-coffee">{new Date(t.created_at).toLocaleString("id-ID")}</p>
              </div>
              <span className={`font-bold ${t.points >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {t.points > 0 ? `+${t.points}` : t.points}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
