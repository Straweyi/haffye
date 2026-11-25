import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CustomerPreferences,
  ProductAddon,
  ProductCategory,
  ProductDetail,
  ProductListItem,
  ProductReview,
  ProductVariant,
  VendorLocation,
  VendorStatus,
  VendorWithLocation,
} from "@/types/domain";

export async function getCustomerContext(userId: string): Promise<CustomerPreferences> {
  const supabase = await createClient();
  const [{ data: profile }, { data: customer }, { data: loyalty }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone,avatar_url").eq("id", userId).maybeSingle(),
    supabase
      .from("customers")
      .select("default_latitude,default_longitude,search_radius_km")
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase
      .from("loyalty_accounts")
      .select("points_balance,lifetime_points")
      .eq("customer_id", userId)
      .maybeSingle(),
  ]);

  return {
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    defaultLatitude: customer?.default_latitude ?? null,
    defaultLongitude: customer?.default_longitude ?? null,
    searchRadiusKm: Number(customer?.search_radius_km ?? 3),
    pointsBalance: loyalty?.points_balance ?? 0,
    lifetimePoints: loyalty?.lifetime_points ?? 0,
  };
}

export async function getOperationalVendors(): Promise<VendorWithLocation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select(
      "id,code,name,status,vehicle_label,description,is_active,vendor_locations(vendor_id,latitude,longitude,accuracy,heading,speed,updated_at)",
    )
    .eq("is_active", true)
    .in("status", ["ACTIVE", "BUSY"])
    .order("code");

  if (error || !data) return [];

  return data.map((row) => {
    const rawLoc = Array.isArray(row.vendor_locations)
      ? row.vendor_locations[0] ?? null
      : (row.vendor_locations as VendorLocation | null);

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status as VendorStatus,
      vehicle_label: row.vehicle_label,
      description: row.description,
      is_active: row.is_active,
      location: rawLoc
        ? {
            vendor_id: rawLoc.vendor_id,
            latitude: Number(rawLoc.latitude),
            longitude: Number(rawLoc.longitude),
            accuracy: rawLoc.accuracy !== null ? Number(rawLoc.accuracy) : null,
            heading: rawLoc.heading !== null ? Number(rawLoc.heading) : null,
            speed: rawLoc.speed !== null ? Number(rawLoc.speed) : null,
            updated_at: rawLoc.updated_at,
          }
        : null,
    };
  });
}

export async function getCategories(): Promise<ProductCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_categories")
    .select("id,name,slug,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as ProductCategory[];
}

function mapProductRow(
  row: {
    id: string;
    category_id: string | null;
    name: string;
    slug: string;
    description: string;
    image_url: string | null;
    base_price: number | string;
    sweetness_options: string[] | null;
    ice_options: string[] | null;
    is_available: boolean;
    product_categories: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    product_variants: ProductVariant[] | null;
    product_addons: ProductAddon[] | null;
    reviews: { rating: number }[] | null;
  },
  vendorProductMap: Map<string, boolean>,
): ProductListItem {
  const cat = Array.isArray(row.product_categories)
    ? row.product_categories[0] ?? null
    : row.product_categories;

  const variants: ProductVariant[] = (row.product_variants ?? [])
    .map((v) => ({ ...v, price_delta: Number(v.price_delta) }))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.price_delta - b.price_delta);

  const addons: ProductAddon[] = (row.product_addons ?? [])
    .map((a) => ({ ...a, price: Number(a.price) }))
    .sort((a, b) => a.price - b.price);

  const ratings = (row.reviews ?? []).map((r) => r.rating);
  const reviewCount = ratings.length;
  const avgRating =
    reviewCount > 0 ? Math.round((ratings.reduce((s, r) => s + r, 0) / reviewCount) * 10) / 10 : null;

  const vendorOverride = vendorProductMap.get(row.id);
  const effectiveAvailable = row.is_available && (vendorOverride ?? true);

  return {
    id: row.id,
    category_id: row.category_id,
    category: cat,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image_url: row.image_url,
    base_price: Number(row.base_price),
    sweetness_options: row.sweetness_options ?? [],
    ice_options: row.ice_options ?? [],
    is_available: row.is_available,
    effectiveAvailable,
    variants,
    addons,
    avgRating,
    reviewCount,
  };
}

export async function getCatalogProducts(vendorId?: string): Promise<ProductListItem[]> {
  const supabase = await createClient();
  const [{ data: rows }, vpRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,category_id,name,slug,description,image_url,base_price,sweetness_options,ice_options,is_available,product_categories(id,name,slug),product_variants(id,product_id,name,price_delta,is_default,is_available),product_addons(id,product_id,name,price,is_available),reviews(rating)",
      )
      .order("name"),
    vendorId
      ? supabase.from("vendor_products").select("product_id,is_available").eq("vendor_id", vendorId)
      : Promise.resolve({ data: [] as { product_id: string; is_available: boolean }[] }),
  ]);

  const vpMap = new Map<string, boolean>();
  for (const vp of vpRes.data ?? []) {
    vpMap.set(vp.product_id, vp.is_available);
  }

  return (rows ?? []).map((row) => mapProductRow(row, vpMap));
}

export async function getProductBySlug(
  slug: string,
  userId: string,
  vendorId?: string,
): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("products")
    .select(
      "id,category_id,name,slug,description,image_url,base_price,sweetness_options,ice_options,is_available,product_categories(id,name,slug),product_variants(id,product_id,name,price_delta,is_default,is_available),product_addons(id,product_id,name,price,is_available),reviews(rating)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row) return null;

  const [vpRes, revRes, eligibleRes] = await Promise.all([
    vendorId
      ? supabase
          .from("vendor_products")
          .select("is_available")
          .eq("vendor_id", vendorId)
          .eq("product_id", row.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("reviews")
      .select("id,rating,comment,created_at,customer_id,profiles(full_name)")
      .eq("product_id", row.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select("id,order_items!inner(product_id)")
      .eq("customer_id", userId)
      .eq("status", "COMPLETED")
      .eq("order_items.product_id", row.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const vpMap = new Map<string, boolean>();
  if (vpRes.data) vpMap.set(row.id, vpRes.data.is_available);
  const base = mapProductRow(row, vpMap);

  const reviews: ProductReview[] = (revRes.data ?? []).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      customer_name: prof?.full_name || "HAFFYE Customer",
    };
  });

  // Check if user already reviewed those completed orders
  let eligibleOrderId: string | null = null;
  const candidateOrders = (eligibleRes.data ?? []).map((o) => o.id);
  if (candidateOrders.length > 0) {
    const { data: existing } = await supabase
      .from("reviews")
      .select("order_id")
      .eq("customer_id", userId)
      .eq("product_id", row.id)
      .in("order_id", candidateOrders);
    const reviewedIds = new Set((existing ?? []).map((x) => x.order_id));
    eligibleOrderId = candidateOrders.find((id) => !reviewedIds.has(id)) ?? null;
  }

  return {
    ...base,
    reviews,
    eligibleOrderId,
  };
}
