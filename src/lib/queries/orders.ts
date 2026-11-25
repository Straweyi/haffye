import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BaristaOrderItem, OrderStatus, PaymentStatus } from "@/types/domain";

export interface CustomerOrder {
  id: string;
  order_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  created_at: string;
  items: BaristaOrderItem[];
  payment: {
    status: PaymentStatus;
    payment_type: string | null;
    snap_token: string | null;
    redirect_url: string | null;
    expires_at: string | null;
    paid_at: string | null;
  } | null;
}

export interface RewardVoucher {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  min_order: number;
  max_discount: number | null;
  points_cost: number;
  valid_until: string | null;
}

export interface WalletVoucher extends RewardVoucher {
  customer_voucher_id: string;
  used_at: string | null;
}

const ORDER_SELECT =
  "id,order_number,vendor_id,status,subtotal,discount,total,note,created_at,vendors(name,code),order_items(id,product_id,product_name,variant_name,unit_price,quantity,sweetness,ice,addons,line_total),payments(status,payment_type,snap_token,redirect_url,expires_at,paid_at)";

type Row = {
  id: string;
  order_number: string;
  vendor_id: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  note: string | null;
  created_at: string;
  vendors: { name: string; code: string } | { name: string; code: string }[] | null;
  order_items:
    | {
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
      }[]
    | null;
  payments:
    | {
        status: string;
        payment_type: string | null;
        snap_token: string | null;
        redirect_url: string | null;
        expires_at: string | null;
        paid_at: string | null;
      }[]
    | null;
};

function mapRow(r: Row): CustomerOrder {
  const v = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
  const p = r.payments?.[0] ?? null;
  return {
    id: r.id,
    order_number: r.order_number,
    vendor_id: r.vendor_id,
    vendor_name: v?.name ?? "HAFFYE Cart",
    vendor_code: v?.code ?? "",
    status: r.status as OrderStatus,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    note: r.note,
    created_at: r.created_at,
    items: (r.order_items ?? []).map((it) => ({
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      variant_name: it.variant_name,
      unit_price: Number(it.unit_price),
      quantity: it.quantity,
      sweetness: it.sweetness,
      ice: it.ice,
      addons: Array.isArray(it.addons)
        ? (it.addons as { name: string; price: number }[]).map((a) => ({ name: String(a.name), price: Number(a.price) }))
        : [],
      line_total: Number(it.line_total),
    })),
    payment: p
      ? {
          status: p.status as PaymentStatus,
          payment_type: p.payment_type,
          snap_token: p.snap_token,
          redirect_url: p.redirect_url,
          expires_at: p.expires_at,
          paid_at: p.paid_at,
        }
      : null,
  };
}

export async function getCustomerOrders(userId: string): Promise<CustomerOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function getCustomerOrder(userId: string, orderId: string): Promise<CustomerOrder | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", userId)
    .eq("id", orderId)
    .maybeSingle();
  return data ? mapRow(data as unknown as Row) : null;
}

type VRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number | string;
  min_order: number | string;
  max_discount: number | string | null;
  points_cost: number;
  valid_until: string | null;
};

function mapVoucher(v: VRow): RewardVoucher {
  return {
    id: v.id,
    code: v.code,
    type: v.type,
    value: Number(v.value),
    min_order: Number(v.min_order),
    max_discount: v.max_discount !== null ? Number(v.max_discount) : null,
    points_cost: v.points_cost,
    valid_until: v.valid_until,
  };
}

export async function getRewardsData(userId: string) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: catalog }, { data: wallet }, { data: txs }] = await Promise.all([
    supabase
      .from("vouchers")
      .select("id,code,type,value,min_order,max_discount,points_cost,valid_until")
      .eq("is_active", true)
      .lte("valid_from", nowIso)
      .order("points_cost"),
    supabase
      .from("customer_vouchers")
      .select("id,used_at,vouchers(id,code,type,value,min_order,max_discount,points_cost,valid_until)")
      .eq("customer_id", userId)
      .order("redeemed_at", { ascending: false }),
    supabase
      .from("loyalty_transactions")
      .select("id,points,reason,created_at")
      .eq("customer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const walletVouchers: WalletVoucher[] = (wallet ?? [])
    .map((w) => {
      const v = Array.isArray(w.vouchers) ? w.vouchers[0] : w.vouchers;
      return v ? { ...mapVoucher(v as VRow), customer_voucher_id: w.id, used_at: w.used_at } : null;
    })
    .filter((x): x is WalletVoucher => x !== null);

  return {
    catalog: ((catalog ?? []) as VRow[])
      .map(mapVoucher)
      .filter((v) => !v.valid_until || v.valid_until > nowIso),
    wallet: walletVouchers,
    transactions: (txs ?? []) as { id: string; points: number; reason: string; created_at: string }[],
  };
}

/** Unused, still-valid vouchers the customer can apply at checkout. */
export async function getUsableVouchers(userId: string): Promise<WalletVoucher[]> {
  const { wallet } = await getRewardsData(userId);
  const nowIso = new Date().toISOString();
  return wallet.filter((w) => !w.used_at && (!w.valid_until || w.valid_until > nowIso));
}
