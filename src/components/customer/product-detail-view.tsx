"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Star, Store } from "lucide-react";
import { submitReviewAction } from "@/app/actions/customer";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ui/product-image";
import type { ProductDetail, VendorWithLocation } from "@/types/domain";

interface ProductDetailViewProps {
  product: ProductDetail;
  initialVendors: VendorWithLocation[];
  queryVendorId?: string;
}

export function ProductDetailView({
  product,
  initialVendors,
  queryVendorId,
}: ProductDetailViewProps) {
  const { selectedVendorId, selectVendor, cart, addToCart } = useCustomer();
  const { vendors } = useLiveVendors(initialVendors);

  const activeVendorId = queryVendorId ?? selectedVendorId;
  const activeVendor = vendors.find((v) => v.id === activeVendorId) ?? null;

  const availableVariants = product.variants.filter((v) => v.is_available);
  const availableAddons = product.addons.filter((a) => a.is_available);

  const defaultVariant =
    availableVariants.find((v) => v.is_default) ?? availableVariants[0] ?? null;

  const [variantId, setVariantId] = useState<string | null>(defaultVariant?.id ?? null);
  const [sweetness, setSweetness] = useState<string | null>(product.sweetness_options[0] ?? null);
  const [ice, setIce] = useState<string | null>(product.ice_options[0] ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [addedBanner, setAddedBanner] = useState(false);
  const [vendorConflict, setVendorConflict] = useState(false);

  // Review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState<{ error?: string; message?: string }>({});
  const [reviewPending, startReview] = useTransition();

  const selectedVariant = availableVariants.find((v) => v.id === variantId) ?? null;
  const selectedAddons = availableAddons.filter((a) => addonIds.includes(a.id));

  const unitPrice =
    product.base_price +
    (selectedVariant?.price_delta ?? 0) +
    selectedAddons.reduce((s, a) => s + a.price, 0);

  const lineTotal = unitPrice * quantity;

  const toggleAddon = (id: string) => {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAdd = (replaceOtherVendor = false) => {
    if (!activeVendor || !product.effectiveAvailable) return;

    const lineId = [
      product.id,
      selectedVariant?.id ?? "base",
      sweetness ?? "none",
      ice ?? "none",
      selectedAddons
        .map((a) => a.id)
        .sort()
        .join(","),
    ].join("|");

    const res = addToCart(
      activeVendor.id,
      {
        lineId,
        productId: product.id,
        slug: product.slug,
        productName: product.name,
        imageUrl: product.image_url,
        variantId: selectedVariant?.id ?? null,
        variantName: selectedVariant?.name ?? null,
        sweetness,
        ice,
        addons: selectedAddons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        unitPrice,
        quantity,
      },
      replaceOtherVendor,
    );

    if (res.conflict) {
      setVendorConflict(true);
      return;
    }

    setVendorConflict(false);
    setAddedBanner(true);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.eligibleOrderId) return;
    startReview(async () => {
      const res = await submitReviewAction(
        {
          product_id: product.id,
          order_id: product.eligibleOrderId,
          rating,
          comment,
        },
        product.slug,
      );
      setReviewFeedback(res);
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={activeVendor ? `/customer/menu?vendor=${activeVendor.id}` : "/customer/menu"}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-coffee hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Menu
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Hero image + summary */}
        <div className="space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-cream shadow-soft">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              {product.category && <Badge variant="caramel">{product.category.name}</Badge>}
              {product.avgRating !== null && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-espresso">
                  <Star className="h-3.5 w-3.5 fill-caramel text-caramel" />
                  {product.avgRating} ({product.reviewCount})
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-espresso">{product.name}</h1>
            <p className="mt-1 text-sm text-coffee">{product.description}</p>
            <p className="mt-2 text-lg font-bold text-caramel">
              From {formatIDR(product.base_price)}
            </p>
          </div>
        </div>

        {/* Customization card */}
        <Card>
          <CardContent className="space-y-5 p-5">
            {/* Active vendor indicator */}
            {activeVendor ? (
              <div className="flex items-center justify-between rounded-xl bg-cream px-3.5 py-2.5 text-xs">
                <span className="flex items-center gap-2 font-medium text-espresso">
                  <Store className="h-4 w-4 text-caramel" />
                  Ordering from <b>{activeVendor.name}</b>
                </span>
                <Badge variant={activeVendor.status === "ACTIVE" ? "active" : "busy"}>
                  {activeVendor.status}
                </Badge>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">No active cart selected</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVendor(v.id)}
                      className="rounded-lg bg-espresso px-2.5 py-1 font-semibold text-cream"
                    >
                      Select {v.code}
                    </button>
                  ))}
                  {vendors.length === 0 && (
                    <Link href="/customer/vendors" className="underline">
                      Find an available cart
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Variants / Size */}
            {availableVariants.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-coffee">Size</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableVariants.map((v) => {
                    const active = v.id === selectedVariant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVariantId(v.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                          active
                            ? "border-espresso bg-espresso text-cream"
                            : "border-coffee/20 bg-warm text-espresso hover:border-caramel"
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className={active ? "text-caramel" : "text-coffee"}>
                          {v.price_delta > 0 ? `+${formatIDR(v.price_delta)}` : "Included"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sweetness */}
            {product.sweetness_options.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-coffee">Sweetness</p>
                <div className="flex flex-wrap gap-2">
                  {product.sweetness_options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSweetness(opt)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        sweetness === opt
                          ? "border-espresso bg-espresso text-cream"
                          : "border-coffee/20 bg-warm text-espresso hover:border-caramel"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ice */}
            {product.ice_options.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-coffee">Ice Level</p>
                <div className="flex flex-wrap gap-2">
                  {product.ice_options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setIce(opt)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        ice === opt
                          ? "border-espresso bg-espresso text-cream"
                          : "border-coffee/20 bg-warm text-espresso hover:border-caramel"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {availableAddons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-coffee">Add-ons</p>
                <div className="space-y-2">
                  {availableAddons.map((addon) => {
                    const checked = addonIds.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
                          checked
                            ? "border-caramel bg-caramel/15 text-espresso"
                            : "border-coffee/15 bg-warm text-espresso hover:border-caramel/60"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              checked
                                ? "border-espresso bg-espresso text-cream"
                                : "border-coffee/30"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          {addon.name}
                        </span>
                        <span className="font-semibold text-coffee">+{formatIDR(addon.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex items-center justify-between gap-3 border-t border-coffee/10 pt-4">
              <div className="flex items-center gap-2 rounded-xl border border-coffee/20 bg-cream px-2 py-1">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="rounded-lg p-1.5 text-espresso hover:bg-warm"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-espresso">{quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  className="rounded-lg p-1.5 text-espresso hover:bg-warm"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                className="flex-1"
                size="lg"
                disabled={!activeVendor || !product.effectiveAvailable}
                onClick={() => handleAdd(false)}
              >
                <ShoppingBag className="h-4 w-4" />
                {!product.effectiveAvailable
                  ? "Unavailable"
                  : !activeVendor
                    ? "Select a Cart First"
                    : `Add · ${formatIDR(lineTotal)}`}
              </Button>
            </div>

            {vendorConflict && cart.vendorId && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">
                  Your cart contains items from another HAFFYE cart.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => handleAdd(true)}>
                    Replace Cart &amp; Add
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setVendorConflict(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {addedBanner && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                <span>Added to cart!</span>
                <Link href="/customer/cart" className="font-bold underline">
                  View Cart
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reviews */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-espresso">
          Customer Reviews ({product.reviews.length})
        </h2>

        {product.eligibleOrderId && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <p className="text-xs font-bold text-espresso">Rate this item</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="rounded-lg p-1"
                      aria-label={`Rate ${n} stars`}
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= rating ? "fill-caramel text-caramel" : "text-coffee/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Share how it tasted…"
                  className="w-full rounded-xl border border-coffee/20 bg-warm p-3 text-sm outline-none focus:border-caramel"
                />
                {reviewFeedback.error && (
                  <p className="text-xs text-red-600">{reviewFeedback.error}</p>
                )}
                {reviewFeedback.message && (
                  <p className="text-xs text-emerald-700">{reviewFeedback.message}</p>
                )}
                <Button type="submit" size="sm" disabled={reviewPending}>
                  {reviewPending ? "Submitting…" : "Submit Review"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {product.reviews.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {product.reviews.map((rev) => (
              <Card key={rev.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-espresso">{rev.customer_name}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-caramel">
                      <Star className="h-3.5 w-3.5 fill-caramel" />
                      {rev.rating}
                    </span>
                  </div>
                  {rev.comment && <p className="mt-1.5 text-xs text-coffee">{rev.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-xs text-coffee">No reviews yet. Reviews unlock after a completed order.</p>
        )}
      </section>
    </div>
  );
}
