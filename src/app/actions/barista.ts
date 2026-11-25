"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ALLOWED_BARISTA_TRANSITIONS, ORDER_STATUS_LABELS } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  baristaProfileSchema,
  orderTransitionSchema,
  stockMovementSchema,
  toggleProductSchema,
  vendorStatusSchema,
} from "@/lib/validators/barista";
import type { OrderStatus } from "@/types/domain";

export type BaristaActionResult = { error?: string; message?: string };

export async function updateVendorStatusAction(status: unknown): Promise<BaristaActionResult> {
  const session = await requireRole("barista");
  const parsed = vendorStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Invalid operational status" };

  const supabase = await createClient();
  const { data: vendor, error: vErr } = await supabase
    .from("vendors")
    .select("id,is_active")
    .eq("barista_id", session.id)
    .maybeSingle();

  if (vErr || !vendor) return { error: "No vendor unit assigned to your account" };
  if (!vendor.is_active) return { error: "This vendor unit is disabled by administrator" };

  const { error } = await supabase
    .from("vendors")
    .update({ status: parsed.data })
    .eq("id", vendor.id);

  if (error) return { error: error.message };

  revalidatePath("/barista");
  revalidatePath("/barista/location");
  revalidatePath("/barista/profile");
  return { message: `Status changed to ${parsed.data}` };
}

export async function transitionOrderStatusAction(input: unknown): Promise<BaristaActionResult> {
  const session = await requireRole("barista");
  const parsed = orderTransitionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id,name")
    .eq("barista_id", session.id)
    .maybeSingle();
  if (!vendor) return { error: "No vendor unit assigned to your account" };

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id,order_number,customer_id,vendor_id,status")
    .eq("id", parsed.data.orderId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (oErr || !order) return { error: "Order not found for your vendor" };

  const currentStatus = order.status as OrderStatus;
  const nextStatus = parsed.data.nextStatus as OrderStatus;

  if (!ALLOWED_BARISTA_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    return {
      error: `Cannot move order from ${ORDER_STATUS_LABELS[currentStatus]} to ${ORDER_STATUS_LABELS[nextStatus]}`,
    };
  }

  const admin = createAdminClient();

  if (nextStatus === "COMPLETED") {
    // Must use authenticated supabase client so auth.uid() & my_vendor_id() resolve inside complete_order()
    const { error: rpcErr } = await supabase.rpc("complete_order", {
      p_order_id: order.id,
    });
    if (rpcErr) return { error: rpcErr.message };
  } else {
    const { error: updErr } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", order.id)
      .eq("vendor_id", vendor.id);
    if (updErr) return { error: updErr.message };

    await admin.from("audit_logs").insert({
      actor_id: session.id,
      action: `order.${nextStatus.toLowerCase()}`,
      entity: "orders",
      entity_id: order.id,
      metadata: { from: currentStatus, to: nextStatus, order_number: order.order_number },
    });
  }

  await admin.from("notifications").insert({
    user_id: order.customer_id,
    title: `Order ${order.order_number}: ${ORDER_STATUS_LABELS[nextStatus]}`,
    body: `${vendor.name} updated your order to ${ORDER_STATUS_LABELS[nextStatus]}.`,
    data: { order_id: order.id, status: nextStatus },
  });

  revalidatePath("/barista");
  revalidatePath("/barista/orders");
  revalidatePath(`/barista/orders/${order.id}`);
  revalidatePath("/barista/inventory");
  revalidatePath("/barista/revenue");
  return { message: `Order ${order.order_number} marked ${ORDER_STATUS_LABELS[nextStatus]}` };
}

export async function toggleVendorProductAction(input: unknown): Promise<BaristaActionResult> {
  const session = await requireRole("barista");
  const parsed = toggleProductSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("barista_id", session.id)
    .maybeSingle();
  if (!vendor) return { error: "No vendor assigned" };

  const { error } = await supabase.from("vendor_products").upsert(
    {
      vendor_id: vendor.id,
      product_id: parsed.data.productId,
      is_available: parsed.data.isAvailable,
    },
    { onConflict: "vendor_id,product_id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/barista/products");
  revalidatePath("/customer/menu");
  return { message: parsed.data.isAvailable ? "Product enabled" : "Product marked sold out" };
}

export async function recordStockMovementAction(input: unknown): Promise<BaristaActionResult> {
  const session = await requireRole("barista");
  const parsed = stockMovementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("barista_id", session.id)
    .maybeSingle();
  if (!vendor) return { error: "No vendor assigned" };

  // Must use authenticated supabase client so auth.uid() & my_vendor_id() resolve inside apply_stock_movement()
  const { error } = await supabase.rpc("apply_stock_movement", {
    p_vendor_id: vendor.id,
    p_ingredient_id: parsed.data.ingredientId,
    p_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/barista");
  revalidatePath("/barista/inventory");
  return { message: "Stock movement recorded" };
}

export async function updateBaristaProfileAction(input: unknown): Promise<BaristaActionResult> {
  const session = await requireRole("barista");
  const parsed = baristaProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
    })
    .eq("id", session.id);

  if (error) return { error: error.message };
  revalidatePath("/barista");
  revalidatePath("/barista/profile");
  return { message: "Profile updated" };
}
