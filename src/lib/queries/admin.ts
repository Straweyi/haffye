import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  REVENUE_STATUSES,
  bestSellers,
  dailySeries,
  isRevenue,
  monthlySeries,
  peakHours,
  statusDistribution,
  vendorPerformance,
  weeklySeries,
  type OrderLite,
} from "@/lib/analytics";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function emailMap(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users ?? []) map.set(u.id, u.email ?? "");
  return map;
}

function toLite(rows: any[]): OrderLite[] {
  return rows.map((r) => ({
    id: r.id,
    total: Number(r.total),
    status: r.status,
    created_at: r.created_at,
    vendor_id: r.vendor_id,
  }));
}

export async function getOverview() {
  const supabase = await createClient();
  const [{ data: orders }, { count: customers }, { count: activeVendors }, { data: recent }, { data: logs }] =
    await Promise.all([
      supabase.from("orders").select("id,total,status,created_at,vendor_id").limit(20000),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabase
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .in("status", ["ACTIVE", "BUSY"]),
      supabase
        .from("orders")
        .select("id,order_number,total,status,created_at,vendors(code,name)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("audit_logs")
        .select("id,action,entity,entity_id,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const lite = toLite(orders ?? []);
  const paid = lite.filter(isRevenue);
  const totalRevenue = paid.reduce((s, o) => s + o.total, 0);
  const completed = lite.filter((o) => o.status === "COMPLETED").length;

  return {
    totalRevenue,
    totalOrders: lite.filter((o) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED").length,
    activeVendors: activeVendors ?? 0,
    totalCustomers: customers ?? 0,
    avgOrderValue: paid.length ? Math.round(totalRevenue / paid.length) : 0,
    completedOrders: completed,
    daily: dailySeries(lite, 14),
    recentOrders: (recent ?? []).map((r: any) => ({
      id: r.id as string,
      order_number: r.order_number as string,
      total: Number(r.total),
      status: r.status as string,
      created_at: r.created_at as string,
      vendor: (Array.isArray(r.vendors) ? r.vendors[0]?.code : r.vendors?.code) ?? "",
    })),
    logs: (logs ?? []) as {
      id: string;
      action: string;
      entity: string;
      entity_id: string | null;
      created_at: string;
    }[],
  };
}

export async function getAnalytics(days: number) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: orders }, { data: items }, { data: vendors }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,total,status,created_at,vendor_id")
      .gte("created_at", since)
      .limit(20000),
    supabase
      .from("order_items")
      .select("product_name,quantity,line_total,orders!inner(status,created_at)")
      .gte("orders.created_at", since)
      .limit(50000),
    supabase.from("vendors").select("id,code,name"),
  ]);

  const lite = toLite(orders ?? []);
  const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));
  const flatItems = (items ?? []).map((i: any) => ({
    product_name: i.product_name as string,
    quantity: i.quantity as number,
    line_total: Number(i.line_total),
    status: (Array.isArray(i.orders) ? i.orders[0]?.status : i.orders?.status) as string,
  }));

  return {
    days,
    daily: dailySeries(lite, Math.min(days, 90)),
    weekly: weeklySeries(lite, days),
    monthly: monthlySeries(lite, days),
    bestSellers: bestSellers(flatItems),
    vendors: vendorPerformance(lite).map((v) => ({
      ...v,
      code: (vMap.get(v.vendor_id) as any)?.code ?? "?",
      name: (vMap.get(v.vendor_id) as any)?.name ?? "Unknown",
    })),
    distribution: statusDistribution(lite),
    peak: peakHours(lite),
    revenue: lite.filter(isRevenue).reduce((s, o) => s + o.total, 0),
  };
}

export async function getCustomersAdmin() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: orders }, { data: loyalty }, emails] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,phone,is_active,created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("customer_id,total,status"),
    supabase.from("loyalty_accounts").select("customer_id,points_balance,lifetime_points"),
    emailMap(),
  ]);
  const spend = new Map<string, { n: number; total: number }>();
  for (const o of orders ?? []) {
    if (!REVENUE_STATUSES.includes(o.status)) continue;
    const b = spend.get(o.customer_id) ?? { n: 0, total: 0 };
    b.n += 1;
    b.total += Number(o.total);
    spend.set(o.customer_id, b);
  }
  const pts = new Map((loyalty ?? []).map((l: any) => [l.customer_id, l]));
  return (profiles ?? []).map((p: any) => ({
    id: p.id as string,
    full_name: p.full_name as string,
    phone: p.phone as string | null,
    email: emails.get(p.id) ?? "",
    is_active: p.is_active as boolean,
    created_at: p.created_at as string,
    orders: spend.get(p.id)?.n ?? 0,
    spent: spend.get(p.id)?.total ?? 0,
    points: (pts.get(p.id) as any)?.points_balance ?? 0,
  }));
}

export async function getBaristasAdmin() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: vendors }, emails] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,phone,is_active,created_at")
      .eq("role", "barista")
      .order("created_at", { ascending: false }),
    supabase.from("vendors").select("id,code,name,barista_id"),
    emailMap(),
  ]);
  const byBarista = new Map(
    (vendors ?? []).filter((v: any) => v.barista_id).map((v: any) => [v.barista_id, v]),
  );
  return {
    baristas: (profiles ?? []).map((p: any) => ({
      id: p.id as string,
      full_name: p.full_name as string,
      phone: p.phone as string | null,
      email: emails.get(p.id) ?? "",
      is_active: p.is_active as boolean,
      vendor: (byBarista.get(p.id) as any) ?? null,
    })),
    unassignedVendors: (vendors ?? [])
      .filter((v: any) => !v.barista_id)
      .map((v: any) => ({ id: v.id as string, code: v.code as string, name: v.name as string })),
  };
}

export async function getVendorsAdmin() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: baristas }] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "id,code,name,status,vehicle_label,description,is_active,barista_id,vendor_locations(latitude,longitude,accuracy,updated_at)",
      )
      .order("code"),
    supabase.from("profiles").select("id,full_name").eq("role", "barista"),
  ]);
  const bMap = new Map((baristas ?? []).map((b: any) => [b.id, b.full_name]));
  const assigned = new Set((vendors ?? []).map((v: any) => v.barista_id).filter(Boolean));
  return {
    vendors: (vendors ?? []).map((v: any) => {
      const loc = Array.isArray(v.vendor_locations) ? v.vendor_locations[0] : v.vendor_locations;
      return {
        id: v.id as string,
        code: v.code as string,
        name: v.name as string,
        status: v.status as string,
        vehicle_label: v.vehicle_label as string | null,
        description: v.description as string | null,
        is_active: v.is_active as boolean,
        barista_id: v.barista_id as string | null,
        barista_name: v.barista_id ? ((bMap.get(v.barista_id) as string) ?? "—") : null,
        location: loc
          ? {
              latitude: Number(loc.latitude),
              longitude: Number(loc.longitude),
              accuracy: loc.accuracy as number | null,
              updated_at: loc.updated_at as string,
            }
          : null,
      };
    }),
    freeBaristas: (baristas ?? [])
      .filter((b: any) => !assigned.has(b.id))
      .map((b: any) => ({ id: b.id as string, full_name: b.full_name as string })),
    allBaristas: (baristas ?? []).map((b: any) => ({
      id: b.id as string,
      full_name: b.full_name as string,
    })),
  };
}

export async function getCategoriesAdmin() {
  const supabase = await createClient();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("product_categories").select("id,name,slug,sort_order,is_active").order("sort_order"),
    supabase.from("products").select("category_id"),
  ]);
  const count = new Map<string, number>();
  for (const p of prods ?? []) {
    if (p.category_id) count.set(p.category_id, (count.get(p.category_id) ?? 0) + 1);
  }
  return (cats ?? []).map((c: any) => ({ ...c, products: count.get(c.id) ?? 0 })) as {
    id: string;
    name: string;
    slug: string;
    sort_order: number;
    is_active: boolean;
    products: number;
  }[];
}

export async function getProductsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id,name,slug,base_price,image_url,is_available,product_categories(name),product_variants(id),product_addons(id)",
    )
    .order("name");
  return (data ?? []).map((p: any) => ({
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    base_price: Number(p.base_price),
    image_url: p.image_url as string | null,
    is_available: p.is_available as boolean,
    category:
      (Array.isArray(p.product_categories)
        ? p.product_categories[0]?.name
        : p.product_categories?.name) ?? "—",
    variants: (p.product_variants ?? []).length as number,
    addons: (p.product_addons ?? []).length as number,
  }));
}

export async function getProductAdmin(id: string) {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select(
      "id,category_id,name,slug,description,image_url,base_price,sweetness_options,ice_options,is_available,product_variants(id,name,price_delta,is_default),product_addons(id,name,price)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;
  return {
    id: p.id as string,
    category_id: p.category_id as string | null,
    name: p.name as string,
    slug: p.slug as string,
    description: p.description as string,
    image_url: p.image_url as string | null,
    base_price: Number(p.base_price),
    sweetness_options: (p.sweetness_options ?? []) as string[],
    ice_options: (p.ice_options ?? []) as string[],
    is_available: p.is_available as boolean,
    variants: (p.product_variants ?? []).map((v: any) => ({
      id: v.id as string,
      name: v.name as string,
      price_delta: Number(v.price_delta),
      is_default: v.is_default as boolean,
    })),
    addons: (p.product_addons ?? []).map((a: any) => ({
      id: a.id as string,
      name: a.name as string,
      price: Number(a.price),
    })),
  };
}

export async function getCategoryOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("product_categories").select("id,name").order("sort_order");
  return (data ?? []) as { id: string; name: string }[];
}

export async function getInventoryAdmin() {
  const supabase = await createClient();
  const [
    { data: ingredients },
    { data: recipes },
    { data: inv },
    { data: vendors },
    { data: products },
    { data: moves },
  ] = await Promise.all([
    supabase.from("ingredients").select("id,name,unit,low_stock_threshold").order("name"),
    supabase
      .from("product_recipes")
      .select("product_id,ingredient_id,quantity,products(name),ingredients(name,unit)"),
    supabase.from("inventories").select("id,vendor_id,ingredient_id,quantity"),
    supabase.from("vendors").select("id,code,name").order("code"),
    supabase.from("products").select("id,name").order("name"),
    supabase
      .from("inventory_movements")
      .select("id,inventory_id,type,quantity,note,created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const ingMap = new Map((ingredients ?? []).map((i: any) => [i.id, i]));
  const vMap = new Map((vendors ?? []).map((v: any) => [v.id, v]));
  const invMap = new Map((inv ?? []).map((i: any) => [i.id, i]));

  const stock = (inv ?? []).map((i: any) => {
    const ing = ingMap.get(i.ingredient_id) as any;
    const v = vMap.get(i.vendor_id) as any;
    const qty = Number(i.quantity);
    return {
      id: i.id as string,
      vendor_code: (v?.code ?? "?") as string,
      vendor_name: (v?.name ?? "") as string,
      ingredient: (ing?.name ?? "?") as string,
      unit: (ing?.unit ?? "") as string,
      quantity: qty,
      threshold: Number(ing?.low_stock_threshold ?? 0),
      low: qty <= Number(ing?.low_stock_threshold ?? 0),
    };
  });

  return {
    ingredients: (ingredients ?? []).map((i: any) => ({
      id: i.id as string,
      name: i.name as string,
      unit: i.unit as string,
      low_stock_threshold: Number(i.low_stock_threshold),
    })),
    vendors: (vendors ?? []).map((v: any) => ({
      id: v.id as string,
      code: v.code as string,
      name: v.name as string,
    })),
    products: (products ?? []).map((p: any) => ({ id: p.id as string, name: p.name as string })),
    recipes: (recipes ?? []).map((r: any) => ({
      product_id: r.product_id as string,
      ingredient_id: r.ingredient_id as string,
      quantity: Number(r.quantity),
      product: ((Array.isArray(r.products) ? r.products[0]?.name : r.products?.name) ?? "?") as string,
      ingredient: ((Array.isArray(r.ingredients) ? r.ingredients[0]?.name : r.ingredients?.name) ?? "?") as string,
      unit: ((Array.isArray(r.ingredients) ? r.ingredients[0]?.unit : r.ingredients?.unit) ?? "") as string,
    })),
    stock: stock.sort(
      (a, b) => a.vendor_code.localeCompare(b.vendor_code) || a.ingredient.localeCompare(b.ingredient),
    ),
    movements: (moves ?? []).map((m: any) => {
      const i = invMap.get(m.inventory_id) as any;
      const ing = i ? (ingMap.get(i.ingredient_id) as any) : null;
      const v = i ? (vMap.get(i.vendor_id) as any) : null;
      return {
        id: m.id as string,
        vendor: (v?.code ?? "?") as string,
        ingredient: (ing?.name ?? "?") as string,
        unit: (ing?.unit ?? "") as string,
        type: m.type as string,
        quantity: Number(m.quantity),
        note: m.note as string | null,
        created_at: m.created_at as string,
      };
    }),
  };
}

export async function getOrdersAdmin(filters: { status?: string; vendor?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id,order_number,status,total,created_at,customer_id,vendors(code,name),profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.vendor) q = q.eq("vendor_id", filters.vendor);
  const { data } = await q;
  return (data ?? []).map((o: any) => {
    const v = Array.isArray(o.vendors) ? o.vendors[0] : o.vendors;
    const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
    return {
      id: o.id as string,
      order_number: o.order_number as string,
      status: o.status as string,
      total: Number(o.total),
      created_at: o.created_at as string,
      vendor: (v?.code ?? "?") as string,
      customer: (p?.full_name || "Customer") as string,
    };
  });
}

export async function getOrderAdmin(id: string) {
  const supabase = await createClient();
  const { data: o } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,subtotal,discount,total,note,created_at,inventory_deducted,vendors(code,name),profiles(full_name,phone),order_items(id,product_name,variant_name,quantity,sweetness,ice,addons,line_total),payments(provider,provider_order_id,status,payment_type,gross_amount,paid_at,expires_at)",
    )
    .eq("id", id)
    .maybeSingle();
  return o as any;
}

export async function getPaymentsAdmin(status?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "id,order_id,provider,provider_order_id,status,payment_type,gross_amount,paid_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  const [{ data }, { data: all }] = await Promise.all([
    q,
    supabase.from("payments").select("status,gross_amount"),
  ]);
  const totals = new Map<string, { count: number; amount: number }>();
  for (const p of all ?? []) {
    const b = totals.get(p.status) ?? { count: 0, amount: 0 };
    b.count += 1;
    b.amount += Number(p.gross_amount);
    totals.set(p.status, b);
  }
  return {
    payments: (data ?? []).map((p: any) => ({ ...p, gross_amount: Number(p.gross_amount) })) as {
      id: string;
      order_id: string;
      provider: string;
      provider_order_id: string;
      status: string;
      payment_type: string | null;
      gross_amount: number;
      paid_at: string | null;
      created_at: string;
    }[],
    totals: [...totals.entries()].map(([st, b]) => ({ status: st, ...b })),
  };
}

export async function getVouchersAdmin() {
  const supabase = await createClient();
  const [{ data: vouchers }, { data: cv }] = await Promise.all([
    supabase.from("vouchers").select("*").order("created_at", { ascending: false }),
    supabase.from("customer_vouchers").select("voucher_id,used_at"),
  ]);
  const stats = new Map<string, { redeemed: number; used: number }>();
  for (const r of cv ?? []) {
    const b = stats.get(r.voucher_id) ?? { redeemed: 0, used: 0 };
    b.redeemed += 1;
    if (r.used_at) b.used += 1;
    stats.set(r.voucher_id, b);
  }
  return (vouchers ?? []).map((v: any) => ({
    id: v.id as string,
    code: v.code as string,
    type: v.type as "PERCENT" | "FIXED",
    value: Number(v.value),
    min_order: Number(v.min_order),
    max_discount: v.max_discount !== null ? Number(v.max_discount) : null,
    points_cost: v.points_cost as number,
    usage_limit: v.usage_limit as number | null,
    valid_until: v.valid_until as string | null,
    is_active: v.is_active as boolean,
    redeemed: stats.get(v.id)?.redeemed ?? 0,
    used: stats.get(v.id)?.used ?? 0,
  }));
}

export async function getRewardsAdmin() {
  const supabase = await createClient();
  const [{ data: top }, { data: txs }, { data: profiles }] = await Promise.all([
    supabase
      .from("loyalty_accounts")
      .select("customer_id,points_balance,lifetime_points")
      .order("lifetime_points", { ascending: false })
      .limit(15),
    supabase
      .from("loyalty_transactions")
      .select("id,customer_id,points,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("profiles").select("id,full_name").eq("role", "customer"),
  ]);
  const names = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || "Customer"]));
  return {
    customers: (profiles ?? []).map((p: any) => ({
      id: p.id as string,
      name: (p.full_name || "Customer") as string,
    })),
    top: (top ?? []).map((t: any) => ({
      id: t.customer_id as string,
      name: (names.get(t.customer_id) ?? "Customer") as string,
      balance: t.points_balance as number,
      lifetime: t.lifetime_points as number,
    })),
    transactions: (txs ?? []).map((t: any) => ({
      id: t.id as string,
      name: (names.get(t.customer_id) ?? "Customer") as string,
      points: t.points as number,
      reason: t.reason as string,
      created_at: t.created_at as string,
    })),
  };
}

export async function getAuditLogs(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id,actor_id,action,entity,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = [...new Set((data ?? []).map((l: any) => l.actor_id).filter(Boolean))];
  const { data: actors } = ids.length
    ? await supabase.from("profiles").select("id,full_name,role").in("id", ids)
    : { data: [] as any[] };
  const aMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
  return (data ?? []).map((l: any) => ({
    id: l.id as string,
    action: l.action as string,
    entity: l.entity as string,
    entity_id: l.entity_id as string | null,
    metadata: l.metadata as Record<string, unknown>,
    created_at: l.created_at as string,
    actor: l.actor_id ? ((aMap.get(l.actor_id) as any)?.full_name ?? "User") : "System",
  }));
}

