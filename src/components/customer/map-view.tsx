"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Crosshair, MapPin, Navigation, Store } from "lucide-react";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { formatDistance, formatRelativeTime, haversineKm, isLocationStale } from "@/lib/geo";
import { LiveVendorMap } from "@/components/map/live-vendor-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { VendorWithLocation } from "@/types/domain";

export function MapView({
  initialVendors,
  initialFocusVendorId,
}: {
  initialVendors: VendorWithLocation[];
  initialFocusVendorId?: string;
}) {
  const router = useRouter();
  const {
    location,
    gpsLoading,
    gpsError,
    setLocation,
    detectGpsLocation,
    searchRadiusKm,
    selectedVendorId,
    selectVendor,
  } = useCustomer();

  const { vendors, realtimeStatus, nowMs } = useLiveVendors(initialVendors);
  const [focusedVendorId, setFocusedVendorId] = useState<string | null>(
    initialFocusVendorId ?? selectedVendorId ?? initialVendors[0]?.id ?? null,
  );
  const [pickLocationMode, setPickLocationMode] = useState(false);

  const vendorsWithCoords = vendors.filter((v) => v.location !== null);
  const focusedVendor = vendors.find((v) => v.id === focusedVendorId) ?? vendors[0] ?? null;

  const focusedDistanceKm =
    focusedVendor?.location
      ? haversineKm(
          location.lat,
          location.lng,
          focusedVendor.location.latitude,
          focusedVendor.location.longitude,
        )
      : null;

  const focusedStale = focusedVendor?.location
    ? isLocationStale(focusedVendor.location.updated_at, nowMs)
    : true;

  return (
    <div className="space-y-4">
      {/* Top status & action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">Live Fleet Map</h1>
          <p className="text-xs text-coffee">
            {vendorsWithCoords.length} operational cart{vendorsWithCoords.length === 1 ? "" : "s"}{" "}
            broadcasting live coordinates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            {realtimeStatus === "live" ? "Realtime Live" : realtimeStatus}
          </Badge>

          <Button size="sm" variant="outline" onClick={detectGpsLocation} disabled={gpsLoading}>
            <Navigation className="h-3.5 w-3.5" />
            {gpsLoading ? "Locating…" : "Use GPS"}
          </Button>

          <Button
            size="sm"
            variant={pickLocationMode ? "caramel" : "outline"}
            onClick={() => setPickLocationMode((prev) => !prev)}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {pickLocationMode ? "Tap Map…" : "Set Pin"}
          </Button>
        </div>
      </div>

      {pickLocationMode && (
        <p className="rounded-xl bg-caramel/20 px-3.5 py-2 text-xs font-medium text-espresso">
          Tap anywhere on the map to set your pickup search location.
        </p>
      )}
      {gpsError && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2 text-xs text-amber-800">{gpsError}</p>
      )}

      {/* Interactive Map */}
      <LiveVendorMap
        customerLocation={location}
        searchRadiusKm={searchRadiusKm}
        vendors={vendors}
        selectedVendorId={focusedVendor?.id ?? null}
        pickLocationMode={pickLocationMode}
        onPickLocation={(lat, lng) => {
          setLocation({ lat, lng, label: "Map pin", source: "manual" }, true);
          setPickLocationMode(false);
        }}
        onSelectMarker={(id) => setFocusedVendorId(id)}
        nowMs={nowMs}
      />

      {/* Quick-jump vendor pills */}
      {vendors.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {vendors.map((v) => {
            const dist = v.location
              ? haversineKm(location.lat, location.lng, v.location.latitude, v.location.longitude)
              : null;
            const active = focusedVendor?.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setFocusedVendorId(v.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-espresso bg-espresso text-cream"
                    : "border-coffee/20 bg-cream text-espresso hover:border-caramel"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    v.status === "ACTIVE" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span>{v.code}</span>
                {dist !== null && (
                  <span className={active ? "text-caramel" : "text-coffee"}>
                    {formatDistance(dist)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Vendor Detail Card */}
      {focusedVendor ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={focusedVendor.status === "ACTIVE" ? "active" : "busy"}>
                    {focusedVendor.status}
                  </Badge>
                  <span className="text-xs font-semibold text-coffee">{focusedVendor.code}</span>
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-espresso">{focusedVendor.name}</h2>
                {focusedVendor.vehicle_label && (
                  <p className="text-xs text-coffee">{focusedVendor.vehicle_label}</p>
                )}
              </div>

              {focusedDistanceKm !== null && (
                <div className="rounded-xl bg-cream px-3 py-2 text-right">
                  <p className="text-sm font-bold text-espresso">
                    {formatDistance(focusedDistanceKm)}
                  </p>
                  <p className="text-[11px] text-coffee">from {location.label}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-coffee">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-caramel" />
                Updated {formatRelativeTime(focusedVendor.location?.updated_at ?? null, nowMs)}
              </span>
              {focusedVendor.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-caramel" />
                  {focusedVendor.location.latitude.toFixed(4)},{" "}
                  {focusedVendor.location.longitude.toFixed(4)}
                </span>
              )}
              {focusedStale && focusedVendor.location && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Stale signal
                </span>
              )}
            </div>

            <div className="mt-4">
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  selectVendor(focusedVendor.id);
                  router.push(`/customer/menu?vendor=${focusedVendor.id}`);
                }}
              >
                <Store className="h-4 w-4" />
                Order from {focusedVendor.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-coffee">
            No operational carts are currently broadcasting on the map.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
