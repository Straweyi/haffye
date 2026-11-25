"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Store, Ticket } from "lucide-react";
import { createCheckoutAction } from "@/app/actions/checkout";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatIDR } from "@/lib/format";
import { calculateDiscount } from "@/lib/vouchers";
import { loadSnap } from "@/lib/snap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WalletVoucher } from "@/lib/queries/orders";
import type { VendorWithLocation } from "@/types/domain";

export function CheckoutView({
  initialVendors,
  vouchers,
  paymentReady,
}: {
  initialVendors: VendorWithLocation[];
  vouchers: WalletVoucher[];
  paymentReady: boolean;
}) {
  const router = useRouter();
  const { cart, cartSubtotal, clearCart } = useCustomer();
  const { vendors } = useLiveVendors(initialVendors);
  const [note, setNote] = useState("");
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const vendor = vendors.find((v) => v.id === cart.vendorId) ?? null;

  // A new key per distinct cart/voucher/note content; the same key on double click => one order.
  const signature = useMemo(
    () => JSON.stringify([cart.vendorId, cart.items.map((i) => [i.lineId, i.quantity]), voucherId, note]),
    [cart, voucherId, note],
  );
  const keyRef = useRef<{ sig: string; key: string }>({ sig: "", key: "" });
  if (keyRef.current.sig !== signature) {
    keyRef.current = { sig: signature, key: crypto.randomUUID() };
  }

  useEffect(() => {
    void loadSnap().catch(() => undefined); // warm up
  }, []);

  const selected = vouchers.find((v) => v.customer_voucher_id === voucherId) ?? null;
  const discount = selected ? calculateDiscount(cartSubtotal, selected) : 0;
  const total = cartSubtotal - discount;

  if (cart.items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-coffee">
          Your cart is empty.{" "}
          <Link href="/customer/menu" className="font-semibold text-caramel">
            Browse menu
          </Link>
        </CardContent>
      </Card>
    );
  }

  const pay = () => {
    if (!vendor || !cart.vendorId) return;
    setError(null);
    start(async () => {
      const res = await createCheckoutAction({
        vendorId: cart.vendorId,
        idempotencyKey: keyRef.current.key,
        note,
        customerVoucherId: voucherId,
        items: cart.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          sweetness: i.sweetness,
          ice: i.ice,
          addonIds: i.addons.map((a) => a.id),
          quantity: i.quantity,
        })),
      });

      if (res.error || !res.orderId) {
        setError(res.error ?? "Checkout failed");
        return;
      }

      clearCart(); // order exists server-side now; unpaid orders can be resumed from Orders
      const go = () => router.push(`/customer/orders/${res.orderId}`);
      if (!res.snapToken) return go();

      try {
        const snap = await loadSnap();
        snap.pay(res.snapToken, {
          onSuccess: go,
          onPending: go,
          onError: go,
          onClose: go,
        });
      } catch {
        go(); // Snap failed to load; customer can retry from the order page
      }
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-espresso">Checkout</h1>

      {!paymentReady && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800">
          Payments are not configured yet. Add Midtrans sandbox keys to enable checkout.
        </p>
      )}

      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-caramel" />
            <div>
              <p className="text-xs text-coffee">Pickup at</p>
              <p className="text-sm font-bold text-espresso">
                {vendor ? `${vendor.name} (${vendor.code})` : "Selected cart unavailable"}
              </p>
            </div>
          </div>
          {vendor ? (
            <Badge variant={vendor.status === "ACTIVE" ? "active" : "busy"}>{vendor.status}</Badge>
          ) : (
            <Badge variant="offline">OFFLINE</Badge>
          )}
        </CardContent>
      </Card>

      {!vendor && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          This cart is offline. <Link href="/customer/vendors" className="font-semibold underline">Choose another cart</Link>.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {cart.items.map((i) => (
            <div key={i.lineId} className="flex justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-espresso">
                  {i.quantity}× {i.productName}
                </p>
                <p className="text-[11px] text-coffee">
                  {[i.variantName, i.sweetness, i.ice, ...i.addons.map((a) => `+${a.name}`)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="font-semibold text-espresso">{formatIDR(i.unitPrice * i.quantity)}</span>
            </div>
          ))}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Note for the barista (optional)"
            className="mt-2 w-full rounded-xl border border-coffee/20 bg-warm p-3 text-sm outline-none focus:border-caramel"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-caramel" /> Voucher
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vouchers.length === 0 ? (
            <p className="text-xs text-coffee">
              No vouchers in your wallet.{" "}
              <Link href="/customer/rewards" className="font-semibold text-caramel">Visit Rewards</Link>
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setVoucherId(null)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                  voucherId === null ? "border-espresso bg-espresso text-cream" : "border-coffee/20"
                }`}
              >
                No voucher
              </button>
              {vouchers.map((v) => {
                const ok = cartSubtotal >= v.min_order;
                return (
                  <button
                    key={v.customer_voucher_id}
                    type="button"
                    disabled={!ok}
                    onClick={() => setVoucherId(v.customer_voucher_id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs disabled:opacity-50 ${
                      voucherId === v.customer_voucher_id
                        ? "border-caramel bg-caramel/15"
                        : "border-coffee/20"
                    }`}
                  >
                    <span className="font-bold text-espresso">{v.code}</span>{" "}
                    <span className="text-coffee">
                      {v.type === "PERCENT" ? `${v.value}% off` : `${formatIDR(v.value)} off`}
                      {v.min_order > 0 ? ` · min ${formatIDR(v.min_order)}` : ""}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <div className="flex justify-between text-coffee">
            <span>Subtotal</span>
            <span>{formatIDR(cartSubtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Voucher</span>
              <span>-{formatIDR(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-espresso">
            <span>Total</span>
            <span className="text-caramel">{formatIDR(total)}</span>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <Button className="w-full" size="lg" disabled={pending || !vendor || !paymentReady} onClick={pay}>
            {pending ? "Preparing payment…" : `Pay ${formatIDR(total)}`}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-coffee">
            <ShieldCheck className="h-3.5 w-3.5 text-caramel" />
            Final prices are verified on the server. Secure payment by Midtrans (Sandbox).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
