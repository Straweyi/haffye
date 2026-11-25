"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Search, Star, Store } from "lucide-react";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatIDR } from "@/lib/format";
import { formatDistance, haversineKm } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/ui/product-image";
import type { ProductCategory, ProductListItem, VendorWithLocation } from "@/types/domain";

interface MenuViewProps {
  initialVendors: VendorWithLocation[];
  categories: ProductCategory[];
  products: ProductListItem[];
  initialCategorySlug?: string;
  queryVendorId?: string;
}

export function MenuView({
  initialVendors,
  categories,
  products,
  initialCategorySlug,
  queryVendorId,
}: MenuViewProps) {
  const router = useRouter();
  const { location, selectedVendorId, selectVendor } = useCustomer();
  const { vendors } = useLiveVendors(initialVendors);

  const [categorySlug, setCategorySlug] = useState<string>(initialCategorySlug ?? "all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (queryVendorId && vendors.some((v) => v.id === queryVendorId)) {
      selectVendor(queryVendorId);
    }
  }, [queryVendorId, vendors, selectVendor]);

  const activeVendorId = queryVendorId ?? selectedVendorId;
  const activeVendor = vendors.find((v) => v.id === activeVendorId) ?? null;

  const filtered = products.filter((p) => {
    const matchesCat = categorySlug === "all" || p.category?.slug === categorySlug;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const activeDist =
    activeVendor?.location
      ? haversineKm(
          location.lat,
          location.lng,
          activeVendor.location.latitude,
          activeVendor.location.longitude,
        )
      : null;

  return (
    <div className="space-y-5">
      {/* Active Vendor Banner */}
      {activeVendor ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-espresso p-4 text-cream shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream/10 text-caramel">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-caramel">{activeVendor.code}</span>
                <Badge variant={activeVendor.status === "ACTIVE" ? "active" : "busy"}>
                  {activeVendor.status}
                </Badge>
              </div>
              <p className="text-sm font-bold">{activeVendor.name}</p>
              {activeDist !== null && (
                <p className="text-xs text-cream/75">{formatDistance(activeDist)} away</p>
              )}
            </div>
          </div>

          <Link href="/customer/vendors">
            <Button size="sm" variant="caramel">
              Switch Cart
            </Button>
          </Link>
        </div>
      ) : (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-2.5 text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Select an available cart to order</p>
                <p className="text-xs">
                  Customers can only place orders with an active or busy HAFFYE cart.
                </p>
              </div>
            </div>
            {vendors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vendors.map((v) => (
                  <Button
                    key={v.id}
                    size="sm"
                    variant="default"
                    onClick={() => {
                      selectVendor(v.id);
                      router.replace(`/customer/menu?vendor=${v.id}`);
                    }}
                  >
                    {v.code} · {v.name} ({v.status})
                  </Button>
                ))}
              </div>
            ) : (
              <Link href="/customer/vendors">
                <Button size="sm" variant="outline">
                  Check Vendor Availability
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search & Category Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-coffee/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search espresso, matcha, snacks…"
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategorySlug("all")}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
              categorySlug === "all"
                ? "bg-espresso text-cream"
                : "bg-cream text-espresso hover:bg-caramel/20"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategorySlug(cat.slug)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                categorySlug === cat.slug
                  ? "bg-espresso text-cream"
                  : "bg-cream text-espresso hover:bg-caramel/20"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {filtered.map((p) => {
            const href = activeVendor
              ? `/customer/products/${p.slug}?vendor=${activeVendor.id}`
              : `/customer/products/${p.slug}`;

            return (
              <Link key={p.id} href={href} className="group">
                <Card
                  className={`h-full overflow-hidden transition group-hover:-translate-y-0.5 ${
                    !p.effectiveAvailable ? "opacity-65" : ""
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream">
                    <ProductImage src={p.image_url} alt={p.name} />
                    {!p.effectiveAvailable && (
                      <span className="absolute left-2 top-2 rounded-full bg-charcoal/85 px-2.5 py-0.5 text-[10px] font-semibold text-cream">
                        Unavailable
                      </span>
                    )}
                  </div>
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between gap-1 text-[11px] text-coffee">
                      <span className="truncate">{p.category?.name ?? "Menu"}</span>
                      {p.avgRating !== null && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-espresso">
                          <Star className="h-3 w-3 fill-caramel text-caramel" />
                          {p.avgRating}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 line-clamp-1 text-sm font-bold text-espresso">{p.name}</h2>
                    <p className="mt-0.5 line-clamp-2 text-xs text-coffee">{p.description}</p>
                    <p className="mt-2 text-sm font-bold text-caramel">{formatIDR(p.base_price)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-coffee">
            No menu items match your filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
