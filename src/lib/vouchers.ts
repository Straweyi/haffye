export interface VoucherLike {
  type: "PERCENT" | "FIXED";
  value: number;
  min_order: number;
  max_discount: number | null;
}

/** Shared by client preview and server calculation (server result is authoritative). */
export function calculateDiscount(subtotal: number, v: VoucherLike): number {
  if (subtotal < v.min_order) return 0;
  let d = v.type === "PERCENT" ? (subtotal * v.value) / 100 : v.value;
  if (v.max_discount !== null) d = Math.min(d, v.max_discount);
  return Math.max(0, Math.min(Math.round(d), subtotal));
}
