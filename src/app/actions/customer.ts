"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  createReviewSchema,
  locationPrefsSchema,
  updateProfileSchema,
} from "@/lib/validators/customer";

export type CustomerActionResult = { error?: string; message?: string };

export async function saveLocationPrefsAction(input: unknown): Promise<CustomerActionResult> {
  const session = await requireRole("customer");
  const parsed = locationPrefsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      default_latitude: parsed.data.default_latitude,
      default_longitude: parsed.data.default_longitude,
      search_radius_km: parsed.data.search_radius_km,
    })
    .eq("profile_id", session.id);

  if (error) return { error: error.message };
  revalidatePath("/customer");
  revalidatePath("/customer/vendors");
  return { message: "Location preferences saved" };
}

export async function updateCustomerProfileAction(input: unknown): Promise<CustomerActionResult> {
  const session = await requireRole("customer");
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const [{ error: pErr }, { error: cErr }] = await Promise.all([
    supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
      })
      .eq("id", session.id),
    supabase
      .from("customers")
      .update({ search_radius_km: parsed.data.search_radius_km })
      .eq("profile_id", session.id),
  ]);

  if (pErr) return { error: pErr.message };
  if (cErr) return { error: cErr.message };

  revalidatePath("/customer");
  revalidatePath("/customer/profile");
  return { message: "Profile updated" };
}

export async function submitReviewAction(
  input: unknown,
  slug: string,
): Promise<CustomerActionResult> {
  const session = await requireRole("customer");
  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    customer_id: session.id,
    product_id: parsed.data.product_id,
    order_id: parsed.data.order_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/customer/products/${slug}`);
  revalidatePath("/customer/menu");
  return { message: "Thanks for your review!" };
}
