"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getPaymentProvider, isPaymentConfigured } from "@/lib/payments";
import { applyPaymentResult, releaseVoucher } from "@/lib/payments/apply";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateDiscount } from "@/lib/vouchers";
import {
  checkoutSchema,
  orderIdSchema,
  redeemVoucherSchema,
} from "@/lib/validators/checkout";

const PAYMENT_EXPIRY_MINUTES = 30;
const MAX_ORDERS_PER_MINUTE = 5;

export type CheckoutResult = {
  error?: string;
  orderId?: string;
  snapToken?: string;
  redirectUrl?: string;
};

function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `HAF-${ymd}-${rand}`;
}

/**
 * Server-side checkout. The client only sends product ids + options; every price,
 * availability rule, voucher and total is recomputed here from the database.
 */
export async function createCheckoutAction(input: unknown): Promise<CheckoutResult> {
  const session = await requireRole("customer");
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  if (!isPaymentConfigured()) {
    return { error: "Payment gateway is not configured yet (missing MIDTRANS_SERVER_KEY)." };
  }

  const admin = createAdminClient();

  // Duplicate submission protection: same idempotency key returns the same order.
  const { data: existing } = await admin
    .from("orders")
    .select("id,status")
    .eq("customer_id", session.id)
    .eq("idempotency_key", data.idempotencyKey)
    .maybeSingle();
  if (existing) {
    const { data: pay } = await admin
      .from("payments")
      .select("snap_token,redirect_url,status")
      .eq("order_id", existing.id)
      .maybeSingle();
    return {
      orderId: existing.id,
      snapToken: existing.status === "PENDING_PAYMENT" ? pay?.snap_token ?? undefined : undefined,
      redirectUrl: existing.status === "PENDING_PAYMENT" ? pay?.redirect_url ?? undefined : undefined,
    };
  }

  // Serverless-safe rate limit (database based, no in-memory state)
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_ORDERS_PER_MINUTE) {
    return { error: "Too many orders in a short time. Please wait a moment." };
  }

  // Vendor must be operational
  const { data: vendor } = await admin
    .from("vendors")
    .select("id,name,status,is_active")
    .eq("id", data.vendorId)
    .maybeSingle();
  if (!vendor || !vendor.is_active || (vendor.status !== "ACTIVE" && vendor.status !== "BUSY")) {
    return { error: "This cart is not available right now. Please choose another cart." };
  }

  // Load catalog data
  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const [{ data: products }, { data: variants }, { data: addons }, { data: vps }] = await Promise.all([
    admin.from("products").select("id,name,base_price,sweetness_options,ice_options,is_available").in("id", productIds),
    admin.from("product_variants").select("id,product_id,name,price_delta,is_available").in("product_id", productIds),
    admin.from("product_addons").select("id,product_id,name,price,is_available").in("product_id", productIds),
    admin.from("vendor_products").select("product_id,is_available").eq("vendor_id", vendor.id).in("product_id", productIds),
  ]);

  const pMap = new Map((products ?? []).map((p) => [p.id, p]));
  const vMap = new Map((variants ?? []).map((v) => [v.id, v]));
  const aMap = new Map((addons ?? []).map((a) => [a.id, a]));
  const vpMap = new Map((vps ?? []).map((v) => [v.product_id, v.is_available]));

  const orderItems: {
    product_id: string;
    product_name: string;
    variant_name: string | null;
    unit_price: number;
    quantity: number;
    sweetness: string | null;
    ice: string | null;
    addons: { name: string; price: number }[];
    line_total: number;
  }[] = [];

  for (const it of data.items) {
    const p = pMap.get(it.productId);
    if (!p) return { error: "A product in your cart no longer exists." };
    if (!p.is_available || vpMap.get(p.id) === false) {
      return { error: `${p.name} is currently unavailable at this cart.` };
    }

    let variantName: string | null = null;
    let delta = 0;
    if (it.variantId) {
      const v = vMap.get(it.variantId);
      if (!v || v.product_id !== p.id || !v.is_available) {
        return { error: `Selected size for ${p.name} is unavailable.` };
      }
      variantName = v.name;
      delta = Number(v.price_delta);
    }

    if (it.sweetness && !(p.sweetness_options ?? []).includes(it.sweetness)) {
      return { error: `Invalid sweetness option for ${p.name}.` };
    }
    if (it.ice && !(p.ice_options ?? []).includes(it.ice)) {
      return { error: `Invalid ice option for ${p.name}.` };
    }

    const chosenAddons: { name: string; price: number }[] = [];
    for (const aid of new Set(it.addonIds)) {
      const a = aMap.get(aid);
      if (!a || a.product_id !== p.id || !a.is_available) {
        return { error: `An add-on for ${p.name} is unavailable.` };
      }
      chosenAddons.push({ name: a.name, price: Number(a.price) });
    }

    const unit = Math.round(
      Number(p.base_price) + delta + chosenAddons.reduce((s, a) => s + a.price, 0),
    );
    orderItems.push({
      product_id: p.id,
      product_name: p.name,
      variant_name: variantName,
      unit_price: unit,
      quantity: it.quantity,
      sweetness: it.sweetness,
      ice: it.ice,
      addons: chosenAddons,
      line_total: unit * it.quantity,
    });
  }

  const subtotal = orderItems.reduce((s, i) => s + i.line_total, 0);

  // Voucher validation
  let discount = 0;
  let customerVoucherId: string | null = null;
  if (data.customerVoucherId) {
    const { data: cv } = await admin
      .from("customer_vouchers")
      .select("id,used_at,customer_id,vouchers(type,value,min_order,max_discount,is_active,valid_from,valid_until)")
      .eq("id", data.customerVoucherId)
      .eq("customer_id", session.id)
      .maybeSingle();
    const v = Array.isArray(cv?.vouchers) ? cv?.vouchers[0] : cv?.vouchers;
    const nowIso = new Date().toISOString();
    if (!cv || cv.used_at || !v || !v.is_active || v.valid_from > nowIso || (v.valid_until && v.valid_until < nowIso)) {
      return { error: "Voucher is invalid or already used." };
    }
    if (subtotal < Number(v.min_order)) {
      return { error: `Voucher requires a minimum order of Rp ${Number(v.min_order).toLocaleString("id-ID")}.` };
    }
    discount = calculateDiscount(subtotal, {
      type: v.type,
      value: Number(v.value),
      min_order: Number(v.min_order),
      max_discount: v.max_discount !== null ? Number(v.max_discount) : null,
    });
    customerVoucherId = cv.id;
  }

  const total = subtotal - discount;
  if (total < 1000) return { error: "Order total is below the minimum payable amount." };

  const orderNumber = newOrderNumber();
  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_id: session.id,
      vendor_id: vendor.id,
      status: "PENDING_PAYMENT",
      subtotal,
      discount,
      total,
      note: data.note || null,
      idempotency_key: data.idempotencyKey,
      customer_voucher_id: customerVoucherId,
    })
    .select("id")
    .single();
  if (oErr || !order) {
    // Unique violation => concurrent duplicate submit; client should retry to fetch the existing order
    return { error: oErr?.code === "23505" ? "Duplicate submission detected. Please retry." : "Could not create order." };
  }

  const { error: iErr } = await admin
    .from("order_items")
    .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
  if (iErr) {
    await admin.from("orders").delete().eq("id", order.id);
    return { error: "Could not save order items." };
  }

  if (customerVoucherId) {
    const { data: claimed } = await admin
      .from("customer_vouchers")
      .update({ used_at: new Date().toISOString(), order_id: order.id })
      .eq("id", customerVoucherId)
      .is("used_at", null)
      .select("id");
    if (!claimed?.length) {
      await admin.from("orders").delete().eq("id", order.id);
      return { error: "Voucher was just used. Please review your order." };
    }
  }

  // Create the payment with the provider
  const items = orderItems.map((i, idx) => ({
    id: `${idx + 1}-${i.product_id.slice(0, 8)}`,
    name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`,
    price: i.unit_price,
    quantity: i.quantity,
  }));
  if (discount > 0) items.push({ id: "discount", name: "Voucher discount", price: -discount, quantity: 1 });

  try {
    const provider = getPaymentProvider();
    const { data: prof } = await admin.from("profiles").select("full_name,phone").eq("id", session.id).single();
    const pay = await provider.createPayment({
      orderId: orderNumber,
      grossAmount: total,
      items,
      customer: { name: prof?.full_name || "Customer", email: session.email, phone: prof?.phone },
      expiryMinutes: PAYMENT_EXPIRY_MINUTES,
    });

    await admin.from("payments").insert({
      order_id: order.id,
      provider: provider.name,
      provider_order_id: orderNumber,
      status: "PENDING",
      gross_amount: total,
      snap_token: pay.token,
      redirect_url: pay.redirectUrl,
      expires_at: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000).toISOString(),
    });

    revalidatePath("/customer/orders");
    return { orderId: order.id, snapToken: pay.token, redirectUrl: pay.redirectUrl };
  } catch (e) {
    await admin.from("orders").update({ status: "CANCELLED" }).eq("id", order.id);
    await releaseVoucher(order.id);
    return { error: `Payment could not be started: ${(e as Error).message}` };
  }
}

/** Customer-triggered verification (useful when the webhook cannot reach localhost). Server verifies with provider. */
export async function syncOrderPaymentAction(input: unknown): Promise<{ error?: string; message?: string }> {
  const session = await requireRole("customer");
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };
  if (!isPaymentConfigured()) return { error: "Payment gateway is not configured." };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,order_number,customer_id")
    .eq("id", parsed.data.orderId)
    .maybeSingle();
  if (!order || order.customer_id !== session.id) return { error: "Order not found" };

  try {
    const tx = await getPaymentProvider().getTransactionStatus(order.order_number);
    const res = await applyPaymentResult(tx);
    revalidatePath(`/customer/orders/${order.id}`);
    revalidatePath("/customer/orders");
    if (!res.ok) return { error: `Verification failed: ${res.reason}` };
    return { message: `Payment status: ${tx.status}` };
  } catch (e) {
    return { error: `Payment not confirmed yet (${(e as Error).message}).` };
  }
}

export async function cancelPendingOrderAction(input: unknown): Promise<{ error?: string; message?: string }> {
  const session = await requireRole("customer");
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };

  const admin = createAdminClient();
  const { data: moved } = await admin
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("id", parsed.data.orderId)
    .eq("customer_id", session.id)
    .eq("status", "PENDING_PAYMENT")
    .select("id");
  if (!moved?.length) return { error: "Only unpaid orders can be cancelled." };

  await admin.from("payments").update({ status: "CANCELLED" }).eq("order_id", parsed.data.orderId).eq("status", "PENDING");
  await releaseVoucher(parsed.data.orderId);
  revalidatePath("/customer/orders");
  revalidatePath(`/customer/orders/${parsed.data.orderId}`);
  return { message: "Order cancelled" };
}

/** Redeem a catalog voucher with loyalty points. Compare-and-swap keeps the balance consistent. */
export async function redeemVoucherAction(input: unknown): Promise<{ error?: string; message?: string }> {
  const session = await requireRole("customer");
  const parsed = redeemVoucherSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid voucher" };

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: v } = await admin
    .from("vouchers")
    .select("id,code,points_cost,usage_limit,valid_from,valid_until,is_active")
    .eq("id", parsed.data.voucherId)
    .maybeSingle();
  if (!v || !v.is_active || v.valid_from > nowIso || (v.valid_until && v.valid_until < nowIso)) {
    return { error: "Voucher is not available." };
  }

  const { count: owned } = await admin
    .from("customer_vouchers")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.id)
    .eq("voucher_id", v.id)
    .is("used_at", null);
  if ((owned ?? 0) > 0) return { error: "You already own an unused copy of this voucher." };

  if (v.usage_limit !== null) {
    const { count: total } = await admin
      .from("customer_vouchers")
      .select("id", { count: "exact", head: true })
      .eq("voucher_id", v.id);
    if ((total ?? 0) >= v.usage_limit) return { error: "This voucher is fully redeemed." };
  }

  if (v.points_cost > 0) {
    const { data: acc } = await admin
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_id", session.id)
      .single();
    if (!acc || acc.points_balance < v.points_cost) return { error: "Not enough points." };

    const { data: debited } = await admin
      .from("loyalty_accounts")
      .update({ points_balance: acc.points_balance - v.points_cost })
      .eq("customer_id", session.id)
      .eq("points_balance", acc.points_balance) // CAS
      .select("customer_id");
    if (!debited?.length) return { error: "Balance changed, please try again." };

    await admin.from("loyalty_transactions").insert({
      customer_id: session.id,
      points: -v.points_cost,
      reason: `Redeemed voucher ${v.code}`,
    });
  }

  const { error } = await admin.from("customer_vouchers").insert({ customer_id: session.id, voucher_id: v.id });
  if (error) return { error: "Could not redeem voucher." };

  revalidatePath("/customer/rewards");
  revalidatePath("/customer/profile");
  return { message: `Voucher ${v.code} added to your wallet` };
}
