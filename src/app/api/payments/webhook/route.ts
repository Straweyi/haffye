import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/payments/apply";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Midtrans HTTP notification endpoint. Configure in Midtrans Dashboard:
 * Settings > Configuration > Payment Notification URL = https://<your-domain>/api/payments/webhook
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = getPaymentProvider();

  // 1. Signature validation
  let valid = false;
  try {
    valid = provider.verifyNotificationSignature(payload);
  } catch {
    return NextResponse.json({ error: "Payment provider not configured" }, { status: 500 });
  }
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const orderId = String(payload.order_id);
  const transactionStatus = String(payload.transaction_status ?? "");
  const statusCode = String(payload.status_code ?? "");
  const admin = createAdminClient();

  // 2. Duplicate callback protection (processing below is also idempotent)
  const { data: seen } = await admin
    .from("payment_events")
    .select("id")
    .eq("provider_order_id", orderId)
    .eq("transaction_status", transactionStatus)
    .eq("status_code", statusCode)
    .maybeSingle();
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  // 3. Never trust the payload: re-fetch authoritative status server-to-server
  let tx;
  try {
    tx = await provider.getTransactionStatus(orderId);
  } catch (e) {
    // Unknown order (e.g. Midtrans dashboard "test notification") -> acknowledge, nothing to do
    const { data: known } = await admin
      .from("payments").select("id").eq("provider_order_id", orderId).maybeSingle();
    if (!known) return NextResponse.json({ ok: true, ignored: "unknown_order" });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 }); // Midtrans will retry
  }

  const result = await applyPaymentResult(tx);
  if (!result.ok && result.reason !== "payment_not_found") {
    return NextResponse.json({ error: result.reason }, { status: 422 });
  }

  // 4. Record event once processed
  await admin.from("payment_events").upsert(
    {
      provider_order_id: orderId,
      transaction_status: transactionStatus,
      status_code: statusCode,
      payload,
    },
    { onConflict: "provider_order_id,transaction_status,status_code", ignoreDuplicates: true },
  );

  return NextResponse.json({ ok: true });
}
