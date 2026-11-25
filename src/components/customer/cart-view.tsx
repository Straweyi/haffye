"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ui/product-image";
import type { VendorWithLocation } from "@/types/domain";

export function CartView({ initialVendors }: { initialVendors: VendorWithLocation[] }) {
  const { cart, cartSubtotal, updateCartQty, removeCartItem, clearCart } = useCustomer();
  const { vendors } = useLiveVendors(initialVendors);

  const assignedVendor = vendors.find((v) => v.id === cart.vendorId) ?? null;

  if (cart.items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-10 text-center">
          <ShoppingBag className="h-10 w-10 text-caramel" />
          <h1 className="mt-3 text-lg font-bold text-espresso">Your cart is empty</h1>
          <p className="mt-1 text-xs text-coffee">
            Pick a nearby HAFFYE cart and customize your favorite drink.
          </p>
          <div className="mt-5 flex gap-2">
            <Link href="/customer/vendors">
              <Button variant="outline">Find Cart</Button>
            </Link>
            <Link href="/customer/menu">
              <Button>Browse Menu</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-espresso">Your Cart</h1>
        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          Clear Cart
        </button>
      </div>

      {/* Assigned Vendor */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-caramel">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-coffee">Pickup Cart</p>
              <p className="text-sm font-bold text-espresso">
                {assignedVendor ? `${assignedVendor.name} (${assignedVendor.code})` : "Cart Offline / Unavailable"}
              </p>
            </div>
          </div>
          {assignedVendor ? (
            <Badge variant={assignedVendor.status === "ACTIVE" ? "active" : "busy"}>
              {assignedVendor.status}
            </Badge>
          ) : (
            <Badge variant="offline">OFFLINE</Badge>
          )}
        </CardContent>
      </Card>

      {/* Cart Items */}
      <div className="space-y-3">
        {cart.items.map((item) => (
          <Card key={item.lineId}>
            <CardContent className="flex items-center gap-3.5 p-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
                <ProductImage src={item.imageUrl} alt={item.productName} sizes="64px" />
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/customer/products/${item.slug}`}
                  className="line-clamp-1 text-sm font-bold text-espresso hover:underline"
                >
                  {item.productName}
                </Link>
                <p className="mt-0.5 text-[11px] text-coffee">
                  {[
                    item.variantName,
                    item.sweetness,
                    item.ice,
                    ...item.addons.map((a) => `+${a.name}`),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-sm font-bold text-caramel">
                  {formatIDR(item.unitPrice * item.quantity)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => removeCartItem(item.lineId)}
                  className="text-coffee/60 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5 rounded-lg border border-coffee/20 bg-cream px-1.5 py-0.5">
                  <button
                    type="button"
                    aria-label="Decrease"
                    onClick={() => updateCartQty(item.lineId, -1)}
                    className="p-1 text-espresso"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Increase"
                    onClick={() => updateCartQty(item.lineId, 1)}
                    className="p-1 text-espresso"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary & Phase 4 Checkout note */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-coffee">Subtotal</span>
            <span className="text-base font-bold text-espresso">{formatIDR(cartSubtotal)}</span>
          </div>
          <Link href={assignedVendor ? "/customer/checkout" : "/customer/vendors"} className="block">
            <Button className="w-full" size="lg">
              {assignedVendor ? "Proceed to Checkout" : "Cart offline — choose another"}
            </Button>
          </Link>
          <p className="text-center text-[11px] text-coffee">
            Prices are re-verified on the server and paid securely via Midtrans.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
