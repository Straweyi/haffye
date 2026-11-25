import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult, releaseVoucher } from "@/lib/payments/apply";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: stale } = await admin
    .from("payments")
    .select("provider_order_id,order_id")
    .eq("status", "PENDING")
    .lt("expires_at", new Date().toISOString())
    .limit(50);

  let expired = 0;
  for (const p of stale ?? []) {
    try {
      // Ask the provider first: the customer may have paid right before expiry.
      const tx = await getPaymentProvider().getTransactionStatus(p.provider_order_id);
      if (tx.status !== "PENDING") {
        await applyPaymentResult(tx);
        if (tx.status === "EXPIRED") expired++;
        continue;
      }
    } catch {
      // Transaction never opened in Snap -> safe to expire locally
    }
    await admin.from("payments").update({ status: "EXPIRED" }).eq("provider_order_id", p.provider_order_id).eq("status", "PENDING");
    const { data: moved } = await admin
      .from("orders").update({ status: "CANCELLED" }).eq("id", p.order_id).eq("status", "PENDING_PAYMENT").select("id");
    if (moved?.length) await releaseVoucher(p.order_id);
    expired++;
  }
  return NextResponse.json({ ok: true, checked: stale?.length ?? 0, expired });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
