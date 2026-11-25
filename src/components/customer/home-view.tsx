"use client";

import Link from "next/link";
import { Award, Clock, Compass, MapPin, Navigation, Star, Store } from "lucide-react";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatIDR } from "@/lib/format";
import { formatDistance, formatRelativeTime, haversineKm, isLocationStale } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImage } from "@/components/ui/product-image";
import type { ProductCategory, ProductListItem, VendorWithLocation } from "@/types/domain";

interface HomeViewProps {
  customerName: string;
  initialVendors: VendorWithLocation[];
  categories: ProductCategory[];
  featuredProducts: ProductListItem[];
}

export function HomeView({
  customerName,
  initialVendors,
  categories,
  featuredProducts,
}: HomeViewProps) {
  const { location, gpsLoading, gpsError, detectGpsLocation, selectVendor, preferences } =
    useCustomer();
  const { vendors, realtimeStatus, nowMs } = useLiveVendors(initialVendors);

  const sortedVendors = [...vendors]
    .map((v) => ({
      ...v,
      distanceKm: v.location
        ? haversineKm(location.lat, location.lng, v.location.latitude, v.location.longitude)
        : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  const nearest = sortedVendors[0] ?? null;
  const nearestStale = nearest?.location ? isLocationStale(nearest.location.updated_at, nowMs) : true;

  return (
    <div className="space-y-6">
      {/* Hero Greeting */}
      <section className="rounded-2xl bg-espresso p-5 text-cream shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-caramel">
              Coffee on the Move
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              Hi, {customerName || "Coffee Lover"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1.5 text-xs font-semibold text-caramel">
            <Award className="h-4 w-4" />
            <span>{preferences.pointsBalance} pts</span>
          </div>
        </div>

        {/* Location strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream/10 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-caramel" />
            <span>
              {location.label}{" "}
              <span className="text-cream/70">
                ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={detectGpsLocation}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1 rounded-lg bg-caramel px-2.5 py-1 font-semibold text-espresso hover:bg-caramel/90 disabled:opacity-60"
            >
              <Navigation className="h-3 w-3" />
              {gpsLoading ? "Locating…" : "Detect GPS"}
            </button>
            <Link
              href="/customer/vendors"
              className="rounded-lg border border-cream/25 px-2.5 py-1 font-medium text-cream hover:bg-cream/10"
            >
              Change
            </Link>
          </div>
        </div>
        {gpsError && <p className="mt-2 text-xs text-amber-200">{gpsError}</p>}
      </section>

      {/* Nearest Live Vendor */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-espresso">Nearest Active Cart</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-coffee">
            <span
              className={`h-2 w-2 rounded-full ${
                realtimeStatus === "live"
                  ? "bg-emerald-500"
                  : realtimeStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-stone-400"
              }`}
            />
            {realtimeStatus === "live" ? "Live tracking" : realtimeStatus}
          </span>
        </div>

        {nearest ? (
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={nearest.status === "ACTIVE" ? "active" : "busy"}>
                      {nearest.status}
                    </Badge>
                    <span className="text-xs font-semibold text-coffee">{nearest.code}</span>
                  </div>
                  <h3 className="text-lg font-bold text-espresso">{nearest.name}</h3>
                  {nearest.vehicle_label && (
                    <p className="text-xs text-coffee">{nearest.vehicle_label}</p>
                  )}
                </div>

                {nearest.distanceKm !== null && (
                  <div className="rounded-xl bg-cream px-3 py-2 text-right">
                    <p className="text-sm font-bold text-espresso">
                      {formatDistance(nearest.distanceKm)}
                    </p>
                    <p className="text-[11px] text-coffee">away</p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-coffee">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-caramel" />
                  Updated {formatRelativeTime(nearest.location?.updated_at ?? null, nowMs)}
                </span>
                {nearestStale && nearest.location && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                    Stale GPS signal
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  href={`/customer/menu?vendor=${nearest.id}`}
                  onClick={() => selectVendor(nearest.id)}
                  className="flex-1"
                >
                  <Button className="w-full">
                    <Store className="h-4 w-4" />
                    Order from this Cart
                  </Button>
                </Link>
                <Link href="/customer/map">
                  <Button variant="outline">
                    <Compass className="h-4 w-4" />
                    Live Map
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <Store className="h-8 w-8 text-caramel" />
              <p className="mt-2 font-semibold text-espresso">No active carts right now</p>
              <p className="mt-1 text-xs text-coffee">
                Check the Live Map or expand your discovery radius.
              </p>
              <Link href="/customer/vendors" className="mt-3">
                <Button size="sm" variant="outline">
                  Explore Vendors
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Categories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-espresso">Browse Categories</h2>
          <Link href="/customer/menu" className="text-xs font-semibold text-caramel">
            View full menu
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/customer/menu"
            className="rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-cream shadow-soft"
          >
            All Menu
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/customer/menu?category=${cat.slug}`}
              className="rounded-full border border-coffee/20 bg-cream px-4 py-2 text-xs font-semibold text-espresso hover:border-caramel"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Menu */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-espresso">Popular Drinks &amp; Bites</h2>
          <Link href="/customer/menu" className="text-xs font-semibold text-caramel">
            See all ({featuredProducts.length})
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
          {featuredProducts.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/customer/products/${p.slug}`} className="group">
              <Card className="h-full overflow-hidden transition group-hover:-translate-y-0.5">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream">
                  <ProductImage src={p.image_url} alt={p.name} />
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
                  <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-espresso">
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-caramel">{formatIDR(p.base_price)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
