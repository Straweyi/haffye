/** Pure, DB-driven aggregation helpers (no hardcoded numbers). Business timezone: Asia/Jakarta. */
export const REVENUE_STATUSES = [
  "PAID",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "COMPLETED",
];
const TZ = "Asia/Jakarta";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

export function localParts(iso: string): { day: string; hour: number } {
  const parts = fmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
  };
}

export function weekStart(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function monthKey(day: string): string {
  return day.slice(0, 7);
}

export function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(localParts(new Date(Date.now() - i * 86_400_000).toISOString()).day);
  }
  return out;
}

export interface OrderLite {
  id: string;
  total: number;
  status: string;
  created_at: string;
  vendor_id: string;
}

export interface SeriesPoint {
  label: string;
  value: number;
  count: number;
}

export function isRevenue(o: { status: string }) {
  return REVENUE_STATUSES.includes(o.status);
}

export function revenueSeries(
  orders: OrderLite[],
  keys: string[],
  keyOf: (day: string) => string,
): SeriesPoint[] {
  const map = new Map(keys.map((k) => [k, { value: 0, count: 0 }]));
  for (const o of orders) {
    if (!isRevenue(o)) continue;
    const k = keyOf(localParts(o.created_at).day);
    const b = map.get(k);
    if (b) {
      b.value += o.total;
      b.count += 1;
    }
  }
  return keys.map((k) => ({ label: k, ...map.get(k)! }));
}

export function dailySeries(orders: OrderLite[], days: number): SeriesPoint[] {
  return revenueSeries(orders, lastDays(days), (d) => d);
}

export function weeklySeries(orders: OrderLite[], days: number): SeriesPoint[] {
  const keys = [...new Set(lastDays(days).map(weekStart))];
  return revenueSeries(orders, keys, weekStart);
}

export function monthlySeries(orders: OrderLite[], days: number): SeriesPoint[] {
  const keys = [...new Set(lastDays(days).map(monthKey))];
  return revenueSeries(orders, keys, monthKey);
}

export function peakHours(orders: OrderLite[]): SeriesPoint[] {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const o of orders) {
    if (o.status === "PENDING_PAYMENT") continue;
    counts[localParts(o.created_at).hour] += 1;
  }
  return counts.map((c, h) => ({ label: `${String(h).padStart(2, "0")}`, value: c, count: c }));
}

export function statusDistribution(orders: OrderLite[]): { status: string; count: number }[] {
  const m = new Map<string, number>();
  for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
  return [...m.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

export interface VendorPerf {
  vendor_id: string;
  orders: number;
  completed: number;
  revenue: number;
  aov: number;
  completionRate: number;
}

export function vendorPerformance(orders: OrderLite[]): VendorPerf[] {
  const m = new Map<string, { orders: number; completed: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "PENDING_PAYMENT" || o.status === "CANCELLED") continue;
    const b = m.get(o.vendor_id) ?? { orders: 0, completed: 0, revenue: 0 };
    b.orders += 1;
    if (o.status === "COMPLETED") b.completed += 1;
    if (isRevenue(o)) b.revenue += o.total;
    m.set(o.vendor_id, b);
  }
  return [...m.entries()]
    .map(([vendor_id, b]) => ({
      vendor_id,
      ...b,
      aov: b.orders > 0 ? Math.round(b.revenue / Math.max(1, b.orders)) : 0,
      completionRate: b.orders > 0 ? Math.round((b.completed / b.orders) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function bestSellers(
  items: { product_name: string; quantity: number; line_total: number; status: string }[],
  limit = 8,
): { name: string; quantity: number; revenue: number }[] {
  const m = new Map<string, { quantity: number; revenue: number }>();
  for (const i of items) {
    if (!REVENUE_STATUSES.includes(i.status)) continue;
    const b = m.get(i.product_name) ?? { quantity: 0, revenue: 0 };
    b.quantity += i.quantity;
    b.revenue += i.line_total;
    m.set(i.product_name, b);
  }
  return [...m.entries()]
    .map(([name, b]) => ({ name, ...b }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

