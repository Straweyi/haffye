"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { AdminFleetMap } from "@/components/map/admin-fleet-map";
import type { FleetVendor } from "@/components/map/admin-fleet-map-client";
import { StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelativeTime, isLocationStale } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";

let fleetChannelSeq = 0;

export function FleetMapView({ initialVendors }: { initialVendors: FleetVendor[] }) {
  const [vendors, setVendors] = useState<FleetVendor[]>(initialVendors);
  const [selectedId, setSelectedId] = useState<string | null>(initialVendors[0]?.id ?? null);
  const [realtime, setRealtime] = useState<"connecting" | "live" | "offline">("connecting");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const reloadFleet = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fleet", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { vendors: FleetVendor[] };
      setVendors(json.vendors);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 5000);
    let cancelled = false;
    const supabase = createClient();
    const channel = supabase
      .channel(`haffye-admin-fleet-${++fleetChannelSeq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_locations" }, () => {
        void reloadFleet();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, () => {
        void reloadFleet();
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setRealtime("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtime("offline");
        } else setRealtime("connecting");
      });

    return () => {
      cancelled = true;
      clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, [reloadFleet]);

  const activeCount = vendors.filter((v) => v.status === "ACTIVE").length;
  const busyCount = vendors.filter((v) => v.status === "BUSY").length;
  const offlineCount = vendors.length - activeCount - busyCount;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">Live Fleet Map</h1>
          <p className="text-xs text-coffee">
            Active: {activeCount} · Busy: {busyCount} · Offline/Paused: {offlineCount}
          </p>
        </div>
        <Badge variant="outline">
          <span
            className={`h-2 w-2 rounded-full ${
              realtime === "live"
                ? "bg-emerald-500"
                : realtime === "connecting"
                  ? "bg-amber-500"
                  : "bg-stone-400"
            }`}
          />
          {realtime === "live" ? "Realtime Live" : realtime}
        </Badge>
      </div>

      <AdminFleetMap
        vendors={vendors}
        selectedVendorId={selectedId}
        onSelectVendor={setSelectedId}
        nowMs={nowMs}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => {
          const stale = v.location ? isLocationStale(v.location.updated_at, nowMs) : false;
          const isSelected = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              className="text-left"
            >
              <Card className={isSelected ? "border-caramel ring-2 ring-caramel/30" : ""}>
                <CardContent className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-espresso">
                      {v.code} · {v.name}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-xs text-coffee">
                    Barista: {v.barista_name ?? "Unassigned"} · {v.vehicle_label ?? "Mobile unit"}
                  </p>
                  {v.location ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-coffee">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-caramel" />
                        {v.location.latitude.toFixed(4)}, {v.location.longitude.toFixed(4)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-caramel" />
                        {formatRelativeTime(v.location.updated_at, nowMs)}
                      </span>
                      {stale && <Badge variant="busy">Stale</Badge>}
                    </div>
                  ) : (
                    <p className="pt-1 text-[11px] text-coffee/70">No active GPS coordinates</p>
                  )}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
