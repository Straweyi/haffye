import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  BaristaInventoryItem,
  BaristaOrderDetail,
  BaristaOrderItem,
  BaristaOrderSummary,
  BaristaProductAvailability,
  BaristaRevenueSummary,
  BaristaVendor,
  InventoryMovementItem,
  MovementType,
  OrderStatus,
  PaymentStatus,
  VendorLocation,
  VendorStatus,
  VendorStatusHistoryItem,
} from "@/types/domain";

export async function getMyVendor(userId: string): Promise<BaristaVendor | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendors")
    .select(
      "id,code,name,status,vehicle_label,description,is_active,vendor_locations(vendor_id,latitude,longitude,accuracy,heading,speed,updated_at)",
    )
    .eq("barista_id", userId)
    .maybeSingle();

  if (!data) return null;
  const rawLoc = Array.isArray(data.vendor_locations)
    ? data.vendor_locations[0] ?? null
    : (data.vendor_locations as VendorLocation | null);

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    status: data.status as VendorStatus,
    vehicle_label: data.vehicle_label,
    description: data.description,
    is_active: data.is_active,
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
}

function mapOrderRow(row: {
  id: string;
  order_number: string;
  customer_id: string;
  vendor_id: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  note: string | null;
  inventory_deducted: boolean;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string | null; phone: string | null } | { full_name: string | null; phone: string | null }[] | null;
  order_items: {
    id: string;
    product_id: string | null;
    product_name: string;
    variant_name: string | null;
    unit_price: number | string;
    quantity: number;
    sweetness: string | null;
    ice: string | null;
    addons: unknown;
    line_total: number | string;
  }[] | null;
  payments: {
    status: string;
    payment_type: string | null;
    gross_amount: number | string;
    paid_at: string | null;
  }[] | null;
}): BaristaOrderSummary {
  const customerProf = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const paymentRow = Array.isArray(row.payments) ? row.payments[0] ?? null : null;

  const items: BaristaOrderItem[] = (row.order_items ?? []).map((it) => ({
    id: it.id,
    product_id: it.product_id,
    product_name: it.product_name,
    variant_name: it.variant_name,
    unit_price: Number(it.unit_price),
    quantity: it.quantity,
    sweetness: it.sweetness,
    ice: it.ice,
    addons: Array.isArray(it.addons)
      ? (it.addons as { name: string; price: number }[]).map((a) => ({
          name: String(a.name ?? ""),
          price: Number(a.price ?? 0),
        }))
      : [],
    line_total: Number(it.line_total),
  }));

  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    customer_name: customerProf?.full_name || "Customer",
    customer_phone: customerProf?.phone ?? null,
    vendor_id: row.vendor_id,
    status: row.status as OrderStatus,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    note: row.note,
    inventory_deducted: row.inventory_deducted,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
    payment: paymentRow
      ? {
          status: paymentRow.status as PaymentStatus,
          payment_type: paymentRow.payment_type,
          gross_amount: Number(paymentRow.gross_amount),
          paid_at: paymentRow.paid_at,
        }
      : null,
  };
}

export async function getBaristaOrders(vendorId: string): Promise<BaristaOrderSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_id,vendor_id,status,subtotal,discount,total,note,inventory_deducted,created_at,updated_at,profiles(full_name,phone),order_items(id,product_id,product_name,variant_name,unit_price,quantity,sweetness,ice,addons,line_total),payments(status,payment_type,gross_amount,paid_at)",
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map(mapOrderRow);
}

export async function getBaristaOrderById(
  vendorId: string,
  orderId: string,
): Promise<BaristaOrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_id,vendor_id,status,subtotal,discount,total,note,inventory_deducted,created_at,updated_at,profiles(full_name,phone),order_items(id,product_id,product_name,variant_name,unit_price,quantity,sweetness,ice,addons,line_total),payments(status,payment_type,gross_amount,paid_at)",
    )
    .eq("vendor_id", vendorId)
    .eq("id", orderId)
    .maybeSingle();

  return data ? mapOrderRow(data) : null;
}

export async function getBaristaProducts(
  vendorId: string,
): Promise<BaristaProductAvailability[]> {
  const supabase = await createClient();
  const [{ data: prods }, { data: vpRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,slug,base_price,image_url,is_available,product_categories(name)")
      .order("name"),
    supabase.from("vendor_products").select("product_id,is_available").eq("vendor_id", vendorId),
  ]);

  const vpMap = new Map<string, boolean>();
  for (const row of vpRows ?? []) vpMap.set(row.product_id, row.is_available);

  return (prods ?? []).map((p) => {
    const cat = Array.isArray(p.product_categories)
      ? p.product_categories[0]
      : p.product_categories;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      category_name: cat?.name ?? "Menu",
      base_price: Number(p.base_price),
      image_url: p.image_url,
      global_available: p.is_available,
      vendor_available: vpMap.get(p.id) ?? true,
    };
  });
}

export async function getBaristaInventory(vendorId: string): Promise<{
  items: BaristaInventoryItem[];
  allIngredients: { id: string; name: string; unit: string }[];
  movements: InventoryMovementItem[];
}> {
  const supabase = await createClient();
  const [{ data: invRows }, { data: allIngs }] = await Promise.all([
    supabase
      .from("inventories")
      .select("id,ingredient_id,quantity,updated_at,ingredients(id,name,unit,low_stock_threshold)")
      .eq("vendor_id", vendorId),
    supabase.from("ingredients").select("id,name,unit").order("name"),
  ]);

  const items: BaristaInventoryItem[] = (invRows ?? [])
    .map((r) => {
      const ing = Array.isArray(r.ingredients) ? r.ingredients[0] : r.ingredients;
      const qty = Number(r.quantity);
      const threshold = Number(ing?.low_stock_threshold ?? 0);
      return {
        inventory_id: r.id,
        ingredient_id: r.ingredient_id,
        ingredient_name: ing?.name ?? "Ingredient",
        unit: ing?.unit ?? "",
        quantity: qty,
        low_stock_threshold: threshold,
        is_low: qty <= threshold,
        updated_at: r.updated_at,
      };
    })
    .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));

  const invIds = items.map((i) => i.inventory_id);
  const invNameMap = new Map(
    items.map((i) => [i.inventory_id, { name: i.ingredient_name, unit: i.unit }]),
  );

  let movements: InventoryMovementItem[] = [];
  if (invIds.length > 0) {
    const { data: movRows } = await supabase
      .from("inventory_movements")
      .select("id,inventory_id,type,quantity,note,created_at")
      .in("inventory_id", invIds)
      .order("created_at", { ascending: false })
      .limit(30);

    movements = (movRows ?? []).map((m) => {
      const meta = invNameMap.get(m.inventory_id);
      return {
        id: m.id,
        ingredient_name: meta?.name ?? "Ingredient",
        unit: meta?.unit ?? "",
        type: m.type as MovementType,
        quantity: Number(m.quantity),
        note: m.note,
        created_at: m.created_at,
      };
    });
  }

  return {
    items,
    allIngredients: (allIngs ?? []) as { id: string; name: string; unit: string }[],
    movements,
  };
}

export async function getBaristaRevenue(vendorId: string): Promise<BaristaRevenueSummary> {
  const orders = await getBaristaOrders(vendorId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const completed = orders.filter((o) => o.status === "COMPLETED");
  const todayCompleted = completed.filter((o) => new Date(o.created_at).getTime() >= todayMs);

  const todayCompletedRevenue = todayCompleted.reduce((s, o) => s + o.total, 0);
  const totalCompletedRevenue = completed.reduce((s, o) => s + o.total, 0);
  const completedCount = completed.length;

  return {
    todayCompletedRevenue,
    todayOrderCount: orders.filter(
      (o) => new Date(o.created_at).getTime() >= todayMs && o.status !== "PENDING_PAYMENT",
    ).length,
    totalCompletedRevenue,
    completedCount,
    avgOrderValue: completedCount > 0 ? Math.round(totalCompletedRevenue / completedCount) : 0,
    transactions: orders,
  };
}

export async function getBaristaProfileData(
  userId: string,
  vendorId: string | null,
): Promise<{
  fullName: string;
  phone: string;
  history: VendorStatusHistoryItem[];
}> {
  const supabase = await createClient();
  const [{ data: profile }, histRes] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle(),
    vendorId
      ? supabase
          .from("vendor_status_history")
          .select("id,status,created_at")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] as { id: string; status: string; created_at: string }[] }),
  ]);

  return {
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    history: (histRes.data ?? []).map((h) => ({
      id: h.id,
      status: h.status as VendorStatus,
      created_at: h.created_at,
    })),
  };
}
