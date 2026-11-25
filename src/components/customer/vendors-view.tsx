"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Compass, MapPin, Navigation, SlidersHorizontal, Store } from "lucide-react";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import {
  PRESET_LOCATIONS,
  RADIUS_OPTIONS_KM,
  formatDistance,
  formatRelativeTime,
  haversineKm,
  isLocationStale,
} from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { VendorWithLocation } from "@/types/domain";

type AvailabilityFilter = "ALL" | "ACTIVE" | "BUSY";

export function VendorsView({ initialVendors }: { initialVendors: VendorWithLocation[] }) {
  const router = useRouter();
  const {
    location,
    gpsLoading,
    gpsError,
    setLocation,
    detectGpsLocation,
    searchRadiusKm,
    setSearchRadiusKm,
    selectedVendorId,
    selectVendor,
  } = useCustomer();

  const { vendors, realtimeStatus, nowMs } = useLiveVendors(initialVendors);
  const [statusFilter, setStatusFilter] = useState<AvailabilityFilter>("ALL");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [manualLat, setManualLat] = useState(String(location.lat));
  const [manualLng, setManualLng] = useState(String(location.lng));
  const [manualError, setManualError] = useState<string | null>(null);

  const enriched = vendors
    .filter((v) => v.status === "ACTIVE" || v.status === "BUSY")
    .filter((v) => (statusFilter === "ALL" ? true : v.status === statusFilter))
    .map((v) => {
      const distanceKm = v.location
        ? haversineKm(location.lat, location.lng, v.location.latitude, v.location.longitude)
        : null;
      return { ...v, distanceKm };
    })
    .filter((v) => v.distanceKm === null || v.distanceKm <= searchRadiusKm)
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  const applyCustomCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setManualError("Enter valid latitude (-90..90) and longitude (-180..180).");
      return;
    }
    setManualError(null);
    setLocation({ lat, lng, label: "Custom pin", source: "manual" }, true);
    setShowManualCoords(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">Explore Nearby Carts</h1>
          <p className="text-xs text-coffee">
            Only available HAFFYE mobile carts within your radius are shown.
          </p>
        </div>
        <Badge variant="outline">
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeStatus === "live"
                ? "bg-emerald-500"
                : realtimeStatus === "connecting"
                  ? "bg-amber-500"
                  : "bg-stone-400"
            }`}
          />
          {realtimeStatus === "live" ? "Live" : realtimeStatus}
        </Badge>
      </div>

      {/* Location & Radius Controls */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-espresso">
              <MapPin className="h-4 w-4 text-caramel" />
              <span>
                <b>{location.label}</b> ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={detectGpsLocation} disabled={gpsLoading}>
                <Navigation className="h-3.5 w-3.5" />
                {gpsLoading ? "Detecting…" : "Use Current GPS"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManualCoords((prev) => !prev)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Custom Pin
              </Button>
            </div>
          </div>

          {gpsError && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{gpsError}</p>
          )}

          {/* Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-coffee">Quick areas:</span>
            {PRESET_LOCATIONS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setLocation(preset, true);
                  setManualLat(String(preset.lat));
                  setManualLng(String(preset.lng));
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  location.label === preset.label
                    ? "bg-espresso text-cream"
                    : "bg-cream text-espresso hover:bg-caramel/20"
                }`}
              >
                {preset.label.replace(", Jakarta", "")}
              </button>
            ))}
          </div>

          {showManualCoords && (
            <form onSubmit={applyCustomCoords} className="grid grid-cols-1 gap-2 rounded-xl bg-cream p-3 sm:grid-cols-3">
              <Input
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="Latitude (e.g. -6.2088)"
                aria-label="Latitude"
              />
              <Input
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="Longitude (e.g. 106.8229)"
                aria-label="Longitude"
              />
              <Button type="submit" size="default">
                Apply Coordinates
              </Button>
              {manualError && <p className="text-xs text-red-600 sm:col-span-3">{manualError}</p>}
            </form>
          )}

          {/* Radius & Availability Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-coffee/10 pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-coffee">Radius:</span>
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setSearchRadiusKm(km)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    searchRadiusKm === km
                      ? "bg-caramel text-espresso"
                      : "bg-cream text-coffee hover:text-espresso"
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {(["ALL", "ACTIVE", "BUSY"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    statusFilter === st
                      ? "bg-espresso text-cream"
                      : "bg-cream text-coffee hover:text-espresso"
                  }`}
                >
                  {st === "ALL" ? "All Available" : st === "ACTIVE" ? "Active Now" : "Busy"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor List */}
      {enriched.length > 0 ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {enriched.map((vendor) => {
            const isSelected = vendor.id === selectedVendorId;
            const stale = vendor.location
              ? isLocationStale(vendor.location.updated_at, nowMs)
              : true;

            return (
              <Card
                key={vendor.id}
                className={isSelected ? "border-caramel ring-2 ring-caramel/30" : ""}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={vendor.status === "ACTIVE" ? "active" : "busy"}>
                          {vendor.status}
                        </Badge>
                        <span className="text-xs font-semibold text-coffee">{vendor.code}</span>
                        {isSelected && <Badge variant="caramel">Selected</Badge>}
                      </div>
                      <h2 className="mt-1.5 text-base font-bold text-espresso">{vendor.name}</h2>
                      {vendor.vehicle_label && (
                        <p className="text-xs text-coffee">{vendor.vehicle_label}</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-cream px-3 py-1.5 text-right">
                      <p className="text-sm font-bold text-espresso">
                        {vendor.distanceKm !== null ? formatDistance(vendor.distanceKm) : "—"}
                      </p>
                      <p className="text-[11px] text-coffee">distance</p>
                    </div>
                  </div>

                  {vendor.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-coffee">{vendor.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-coffee">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-caramel" />
                      {formatRelativeTime(vendor.location?.updated_at ?? null, nowMs)}
                    </span>
                    {stale && vendor.location && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Stale location
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        selectVendor(vendor.id);
                        router.push(`/customer/menu?vendor=${vendor.id}`);
                      }}
                    >
                      <Store className="h-4 w-4" />
                      Select &amp; Order
                    </Button>
                    <Link href={`/customer/map?vendor=${vendor.id}`}>
                      <Button variant="outline">
                        <Compass className="h-4 w-4" />
                        Map
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center p-8 text-center">
            <Store className="h-9 w-9 text-caramel" />
            <h3 className="mt-2 text-base font-bold text-espresso">
              No available carts within {searchRadiusKm} km
            </h3>
            <p className="mt-1 text-xs text-coffee">
              Try expanding your search radius or switching to another area.
            </p>
            {searchRadiusKm < 25 && (
              <Button className="mt-4" size="sm" onClick={() => setSearchRadiusKm(25)}>
                Expand Radius to 25 km
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
