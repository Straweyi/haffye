"use client";

import { useState, useTransition } from "react";
import { toggleVendorProductAction } from "@/app/actions/barista";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ui/product-image";
import type { BaristaProductAvailability } from "@/types/domain";

export function BaristaProductsView({
  initialProducts,
}: {
  initialProducts: BaristaProductAvailability[];
}) {
  const [items, setItems] = useState(initialProducts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (productId: string, nextAvailable: boolean) => {
    setError(null);
    setPendingId(productId);
    setItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, vendor_available: nextAvailable } : p)),
    );

    startTransition(async () => {
      const res = await toggleVendorProductAction({ productId, isAvailable: nextAvailable });
      if (res.error) {
        setError(res.error);
        setItems((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, vendor_available: !nextAvailable } : p)),
        );
      }
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-espresso">Cart Menu Availability</h1>
        <p className="text-xs text-coffee">
          Toggle items sold out or available specifically for your cart.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => {
          const disabledByAdmin = !p.global_available;
          const busy = pendingId === p.id;
          return (
            <Card key={p.id} className={!p.vendor_available || disabledByAdmin ? "opacity-75" : ""}>
              <CardContent className="flex items-center gap-3.5 p-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
                  <ProductImage src={p.image_url} alt={p.name} sizes="64px" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-coffee">{p.category_name}</p>
                  <p className="truncate text-sm font-bold text-espresso">{p.name}</p>
                  <p className="text-xs font-semibold text-caramel">{formatIDR(p.base_price)}</p>
                  {disabledByAdmin && (
                    <Badge variant="offline" className="mt-1">
                      Disabled globally
                    </Badge>
                  )}
                </div>

                <button
                  type="button"
                  disabled={disabledByAdmin || busy}
                  onClick={() => handleToggle(p.id, !p.vendor_available)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    p.vendor_available && !disabledByAdmin
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  } disabled:opacity-50`}
                >
                  {p.vendor_available ? "Available" : "Sold Out"}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
