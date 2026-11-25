import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedPaymentStatus, ProviderTransactionStatus } from "./types";

export type ApplyResult = { ok: boolean; reason?: string; orderStatus?: string };

const RANK: Record<NormalizedPaymentStatus, number> = {
  PENDING: 0,
  FAILED: 1,
  EXPIRED: 1,
  CANCELLED: 1,
  PAID: 2,
  REFUNDED: 3,
};

/**
 * Idempotently applies an authoritative provider status to payment + order.
 * Safe to call repeatedly (webhook retries, manual sync, cron). Never downgrades PAID.
 */
export async function applyPaymentResult(tx: ProviderTransactionStatus): Promise<ApplyResult> {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id,order_id,status,gross_amount")
    .eq("provider_order_id", tx.providerOrderId)
    .maybeSingle();
  if (!payment) return { ok: false, reason: "payment_not_found" };

  // Amount must match what we created server-side
  if (Math.round(Number(payment.gross_amount)) !== tx.grossAmount) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const current = payment.status as NormalizedPaymentStatus;
  if (RANK[tx.status] < RANK[current] || (RANK[tx.status] === RANK[current] && tx.status === current)) {
    return { ok: true, reason: "no_change" };
  }

  await admin
    .from("payments")
    .update({
      status: tx.status,
      payment_type: tx.paymentType,
      paid_at: tx.status === "PAID" ? new Date().toISOString() : undefined,
    })
    .eq("id", payment.id);

  const { data: order } = await admin
    .from("orders")
    .select("id,order_number,customer_id,vendor_id,status,customer_voucher_id")
    .eq("id", payment.order_id)
    .single();
  if (!order) return { ok: false, reason: "order_not_found" };

  if (tx.status === "PAID") {
    // Conditional update => only the first caller transitions the order (duplicate protection)
    const { data: moved } = await admin
      .from("orders")
      .update({ status: "PAID" })
      .eq("id", order.id)
      .eq("status", "PENDING_PAYMENT")
      .select("id");

    if (moved && moved.length > 0) {
      const { data: vendor } = await admin
        .from("vendors")
        .select("barista_id,name")
        .eq("id", order.vendor_id)
        .single();

      const rows = [
        {
          user_id: order.customer_id,
          title: `Payment received for ${order.order_number}`,
          body: `Your order was sent to ${vendor?.name ?? "the cart"}.`,
          data: { order_id: order.id, status: "PAID" },
        },
      ];
      if (vendor?.barista_id) {
        rows.push({
          user_id: vendor.barista_id,
          title: `New paid order ${order.order_number}`,
          body: "A customer just paid. Open the queue to accept it.",
          data: { order_id: order.id, status: "PAID" },
        });
      }
      await admin.from("notifications").insert(rows);
      await admin.from("audit_logs").insert({
        action: "payment.paid",
        entity: "orders",
        entity_id: order.id,
        metadata: { provider_order_id: tx.providerOrderId, payment_type: tx.paymentType },
      });
    }
    return { ok: true, orderStatus: "PAID" };
  }

  if (tx.status === "EXPIRED" || tx.status === "CANCELLED" || tx.status === "FAILED") {
    const { data: moved } = await admin
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", order.id)
      .eq("status", "PENDING_PAYMENT")
      .select("id");

    if (moved && moved.length > 0) {
      await releaseVoucher(order.id);
      await admin.from("notifications").insert({
        user_id: order.customer_id,
        title: `Order ${order.order_number} cancelled`,
        body: tx.status === "EXPIRED" ? "Payment time expired." : "Payment was not completed.",
        data: { order_id: order.id, status: "CANCELLED" },
      });
    }
    return { ok: true, orderStatus: "CANCELLED" };
  }

  if (tx.status === "REFUNDED") {
    await admin.from("orders").update({ status: "REFUNDED" }).eq("id", order.id);
    return { ok: true, orderStatus: "REFUNDED" };
  }

  return { ok: true };
}

export async function releaseVoucher(orderId: string) {
  const admin = createAdminClient();
  await admin
    .from("customer_vouchers")
    .update({ used_at: null, order_id: null })
    .eq("order_id", orderId);
}
