"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/analytics";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addonSchema,
  adjustPointsSchema,
  allocationSchema,
  categorySchema,
  createBaristaSchema,
  idSchema,
  ingredientSchema,
  productSchema,
  recipeDeleteSchema,
  recipeSchema,
  setActiveSchema,
  variantSchema,
  vendorActiveSchema,
  vendorSchema,
  voucherSchema,
  voucherToggleSchema,
} from "@/lib/validators/admin";

export type AdminResult = { error?: string; message?: string; id?: string; url?: string };

async function guard() {
  return requireRole("admin");
}

async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await createAdminClient()
    .from("audit_logs")
    .insert({ actor_id: actorId, action, entity, entity_id: entityId ?? null, metadata });
}

const csvToArray = (s?: string) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);

function dbError(e: { code?: string; message: string }): AdminResult {
  if (e.code === "23505") return { error: "A record with the same unique value already exists." };
  if (e.code === "23503") return { error: "This record is still referenced by other data." };
  return { error: e.message };
}

export async function createBaristaAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = createBaristaSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: p.data.email,
    password: p.data.password,
    email_confirm: true,
    user_metadata: { full_name: p.data.full_name, phone: p.data.phone || null },
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create user" };

  const uid = data.user.id;
  const { error: pErr } = await admin
    .from("profiles")
    .update({ role: "barista", full_name: p.data.full_name, phone: p.data.phone || null })
    .eq("id", uid);
  if (pErr) return dbError(pErr);
  await admin.from("customers").delete().eq("profile_id", uid);
  await admin.from("loyalty_accounts").delete().eq("customer_id", uid);

  if (p.data.vendorId) {
    const { error: vErr } = await admin
      .from("vendors")
      .update({ barista_id: uid })
      .eq("id", p.data.vendorId)
      .is("barista_id", null);
    if (vErr) return dbError(vErr);
  }
  await audit(s.id, "barista.created", "profiles", uid, { email: p.data.email });
  revalidatePath("/admin/baristas");
  revalidatePath("/admin/vendors");
  return { message: `Barista ${p.data.email} created`, id: uid };
}

export async function setProfileActiveAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = setActiveSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  if (p.data.profileId === s.id) return { error: "You cannot deactivate your own account." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: p.data.isActive })
    .eq("id", p.data.profileId);
  if (error) return dbError(error);
  await audit(
    s.id,
    p.data.isActive ? "profile.activated" : "profile.deactivated",
    "profiles",
    p.data.profileId,
  );
  revalidatePath("/admin/customers");
  revalidatePath("/admin/baristas");
  return { message: p.data.isActive ? "Account activated" : "Account deactivated" };
}

export async function saveVendorAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = vendorSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const row = {
    code: p.data.code.toUpperCase(),
    name: p.data.name,
    vehicle_label: p.data.vehicle_label || null,
    description: p.data.description || null,
    barista_id: p.data.barista_id ?? null,
  };
  const res = p.data.id
    ? await supabase.from("vendors").update(row).eq("id", p.data.id).select("id").single()
    : await supabase.from("vendors").insert(row).select("id").single();
  if (res.error) return dbError(res.error);
  await audit(s.id, p.data.id ? "vendor.updated" : "vendor.created", "vendors", res.data.id, {
    code: row.code,
  });
  revalidatePath("/admin/vendors");
  revalidatePath("/admin/baristas");
  return { message: "Vendor saved" };
}

export async function setVendorActiveAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = vendorActiveSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const update: Record<string, unknown> = { is_active: p.data.isActive };
  if (!p.data.isActive) update.status = "OFFLINE";
  const { error } = await supabase.from("vendors").update(update).eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, p.data.isActive ? "vendor.enabled" : "vendor.disabled", "vendors", p.data.id);
  revalidatePath("/admin/vendors");
  revalidatePath("/admin/fleet");
  return { message: p.data.isActive ? "Vendor enabled" : "Vendor disabled and set offline" };
}

export async function saveCategoryAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = categorySchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const row = {
    name: p.data.name,
    slug: slugify(p.data.name),
    sort_order: p.data.sort_order,
    is_active: p.data.is_active,
  };
  const res = p.data.id
    ? await supabase.from("product_categories").update(row).eq("id", p.data.id).select("id").single()
    : await supabase.from("product_categories").insert(row).select("id").single();
  if (res.error) return dbError(res.error);
  await audit(
    s.id,
    p.data.id ? "category.updated" : "category.created",
    "product_categories",
    res.data.id,
  );
  revalidatePath("/admin/categories");
  revalidatePath("/customer/menu");
  return { message: "Category saved" };
}

export async function deleteCategoryAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = idSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "category.deleted", "product_categories", p.data.id);
  revalidatePath("/admin/categories");
  return { message: "Category deleted (its products are now uncategorized)" };
}

export async function saveProductAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = productSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();

  const row = {
    category_id: p.data.category_id ?? null,
    name: p.data.name,
    description: p.data.description,
    image_url: p.data.image_url || null,
    base_price: p.data.base_price,
    sweetness_options: csvToArray(p.data.sweetness_options),
    ice_options: csvToArray(p.data.ice_options),
    is_available: p.data.is_available,
  };

  let res;
  if (p.data.id) {
    res = await supabase.from("products").update(row).eq("id", p.data.id).select("id").single();
  } else {
    let slug = slugify(p.data.name) || "product";
    const { data: clash } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    res = await supabase.from("products").insert({ ...row, slug }).select("id").single();
  }
  if (res.error) return dbError(res.error);

  await audit(s.id, p.data.id ? "product.updated" : "product.created", "products", res.data.id, {
    price: row.base_price,
  });
  revalidatePath("/admin/products");
  revalidatePath("/customer/menu");
  return { message: "Product saved", id: res.data.id };
}

export async function deleteProductAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = idSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "product.deleted", "products", p.data.id);
  revalidatePath("/admin/products");
  revalidatePath("/customer/menu");
  return { message: "Product deleted (past orders keep their historical names and prices)" };
}

export async function toggleProductAvailabilityAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = vendorActiveSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: p.data.isActive })
    .eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "product.availability", "products", p.data.id, { available: p.data.isActive });
  revalidatePath("/admin/products");
  revalidatePath("/customer/menu");
  return { message: "Availability updated" };
}

export async function uploadProductImageAction(formData: FormData): Promise<AdminResult> {
  const s = await guard();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "Only JPG, PNG, or WebP images." };
  }
  if (file.size > 2 * 1024 * 1024) return { error: "Image must be 2 MB or smaller." };

  const admin = createAdminClient();
  await admin.storage
    .createBucket("product-images", { public: true, fileSizeLimit: 2 * 1024 * 1024 })
    .catch(() => undefined);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await admin.storage
    .from("product-images")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return { error: `Upload failed: ${error.message}` };

  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  await audit(s.id, "product.image_uploaded", "storage", path);
  return { url: data.publicUrl, message: "Image uploaded" };
}

export async function addVariantAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = variantSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  if (p.data.is_default) {
    await supabase
      .from("product_variants")
      .update({ is_default: false })
      .eq("product_id", p.data.product_id);
  }
  const { error } = await supabase.from("product_variants").insert(p.data);
  if (error) return dbError(error);
  await audit(s.id, "variant.created", "products", p.data.product_id, { name: p.data.name });
  revalidatePath(`/admin/products/${p.data.product_id}`);
  return { message: "Size added" };
}

export async function deleteVariantAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = idSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "variant.deleted", "product_variants", p.data.id);
  revalidatePath("/admin/products");
  return { message: "Size removed" };
}

export async function addAddonAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = addonSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("product_addons").insert(p.data);
  if (error) return dbError(error);
  await audit(s.id, "addon.created", "products", p.data.product_id, { name: p.data.name });
  revalidatePath(`/admin/products/${p.data.product_id}`);
  return { message: "Add-on added" };
}

export async function deleteAddonAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = idSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.from("product_addons").delete().eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "addon.deleted", "product_addons", p.data.id);
  revalidatePath("/admin/products");
  return { message: "Add-on removed" };
}

export async function saveIngredientAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = ingredientSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const row = {
    name: p.data.name,
    unit: p.data.unit,
    low_stock_threshold: p.data.low_stock_threshold,
  };
  const res = p.data.id
    ? await supabase.from("ingredients").update(row).eq("id", p.data.id).select("id").single()
    : await supabase.from("ingredients").insert(row).select("id").single();
  if (res.error) return dbError(res.error);
  await audit(
    s.id,
    p.data.id ? "ingredient.updated" : "ingredient.created",
    "ingredients",
    res.data.id,
  );
  revalidatePath("/admin/inventory");
  return { message: "Ingredient saved" };
}

export async function saveRecipeAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = recipeSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_recipes")
    .upsert(p.data, { onConflict: "product_id,ingredient_id" });
  if (error) return dbError(error);
  await audit(s.id, "recipe.saved", "products", p.data.product_id, {
    ingredient_id: p.data.ingredient_id,
    quantity: p.data.quantity,
  });
  revalidatePath("/admin/inventory");
  return { message: "Recipe line saved" };
}

export async function deleteRecipeAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = recipeDeleteSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_recipes")
    .delete()
    .eq("product_id", p.data.product_id)
    .eq("ingredient_id", p.data.ingredient_id);
  if (error) return dbError(error);
  await audit(s.id, "recipe.deleted", "products", p.data.product_id);
  revalidatePath("/admin/inventory");
  return { message: "Recipe line removed" };
}

export async function allocateStockAction(input: unknown): Promise<AdminResult> {
  await guard();
  const p = allocationSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_stock_movement", {
    p_vendor_id: p.data.vendor_id,
    p_ingredient_id: p.data.ingredient_id,
    p_type: p.data.type,
    p_quantity: p.data.quantity,
    p_note: p.data.note || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { message: "Stock updated" };
}

export async function createVoucherAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = voucherSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.type === "PERCENT" && p.data.value > 100) {
    return { error: "Percent value cannot exceed 100." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      code: p.data.code,
      type: p.data.type,
      value: p.data.value,
      min_order: p.data.min_order,
      max_discount: p.data.max_discount || null,
      points_cost: p.data.points_cost,
      usage_limit: p.data.usage_limit || null,
      valid_until: p.data.valid_until ? new Date(p.data.valid_until).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  await audit(s.id, "voucher.created", "vouchers", data.id, { code: p.data.code });
  revalidatePath("/admin/promotions");
  revalidatePath("/customer/rewards");
  return { message: `Voucher ${p.data.code} created` };
}

export async function toggleVoucherAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = voucherToggleSchema.safeParse(input);
  if (!p.success) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("vouchers")
    .update({ is_active: p.data.isActive })
    .eq("id", p.data.id);
  if (error) return dbError(error);
  await audit(s.id, "voucher.toggled", "vouchers", p.data.id, { active: p.data.isActive });
  revalidatePath("/admin/promotions");
  revalidatePath("/customer/rewards");
  return { message: p.data.isActive ? "Voucher activated" : "Voucher deactivated" };
}

export async function adjustPointsAction(input: unknown): Promise<AdminResult> {
  const s = await guard();
  const p = adjustPointsSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const admin = createAdminClient();
  const { data: acc } = await admin
    .from("loyalty_accounts")
    .select("points_balance,lifetime_points")
    .eq("customer_id", p.data.customerId)
    .maybeSingle();
  if (!acc) return { error: "Customer loyalty account not found." };
  const next = acc.points_balance + p.data.points;
  if (next < 0) return { error: "Balance cannot go below zero." };

  const { data: ok } = await admin
    .from("loyalty_accounts")
    .update({
      points_balance: next,
      lifetime_points: acc.lifetime_points + Math.max(0, p.data.points),
    })
    .eq("customer_id", p.data.customerId)
    .eq("points_balance", acc.points_balance)
    .select("customer_id");
  if (!ok?.length) return { error: "Balance changed, please try again." };

  await admin.from("loyalty_transactions").insert({
    customer_id: p.data.customerId,
    points: p.data.points,
    reason: `Admin: ${p.data.reason}`,
  });
  await audit(s.id, "points.adjusted", "loyalty_accounts", p.data.customerId, {
    points: p.data.points,
    reason: p.data.reason,
  });
  revalidatePath("/admin/rewards");
  return { message: "Points adjusted" };
}

