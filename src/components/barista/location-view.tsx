"use client";

import { AlertTriangle, Clock, Info, MapPin, Navigation, Radio, Wifi, WifiOff } from "lucide-react";
import { useBarista } from "@/components/providers/barista-provider";
import { BaristaLocationMap } from "@/components/map/barista-location-map";
import { formatRelativeTime } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { VendorStatus } from "@/types/domain";

const STATUSES: VendorStatus[] = ["ACTIVE", "BUSY", "PAUSED", "OFFLINE"];
const INTERVAL_OPTIONS = [5, 8, 10] as const;

export function BaristaLocationView() {
  const {
    vendor,
    realtimeStatus,
    isOnline,
    gpsActive,
    sendingGps,
    intervalSec,
    setIntervalSec,
    permissionState,
    lastFix,
    lastSentAt,
    gpsError,
    isStale,
    nowMs,
    statusUpdating,
    statusFeedback,
    changeVendorStatus,
    startTracking,
    stopTracking,
  } = useBarista();

  if (!vendor) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-coffee">
          No vendor unit assigned to your account.
        </CardContent>
      </Card>
    );
  }

  const canTrack = vendor.status === "ACTIVE" || vendor.status === "BUSY";
  const maxAcc = Number(process.env.NEXT_PUBLIC_GPS_MAX_ACCURACY_METERS) || 100;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-espresso">Operational Status &amp; Live GPS</h1>
          <p className="text-xs text-coffee">
            Customers only see your cart on the map while status is ACTIVE or BUSY.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5 text-red-600" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Badge variant="outline">Realtime: {realtimeStatus}</Badge>
        </div>
      </div>

      {/* Operational Status Selector */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-coffee">
            1. Operational Status
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {STATUSES.map((st) => {
              const active = vendor.status === st;
              return (
                <Button
                  key={st}
                  type="button"
                  disabled={statusUpdating}
                  variant={active ? "default" : "outline"}
                  onClick={() => void changeVendorStatus(st)}
                >
                  {st}
                </Button>
              );
            })}
          </div>
          {statusFeedback && <p className="text-xs font-medium text-coffee">{statusFeedback}</p>}
        </CardContent>
      </Card>

      {/* GPS Controls & Telemetry */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-coffee">
                2. Live GPS Broadcaster
              </p>
              <p className="mt-0.5 text-xs text-coffee">
                {canTrack
                  ? "Ready to broadcast GPS coordinates to Supabase Realtime."
                  : "Switch status to ACTIVE or BUSY to enable GPS tracking."}
              </p>
            </div>

            {gpsActive ? (
              <Button variant="destructive" onClick={stopTracking}>
                <Radio className="h-4 w-4 animate-pulse" />
                Stop GPS Tracking
              </Button>
            ) : (
              <Button variant="caramel" disabled={!canTrack} onClick={startTracking}>
                <Navigation className="h-4 w-4" />
                Start GPS Tracking
              </Button>
            )}
          </div>

          {/* Interval Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-coffee">Broadcast interval:</span>
            {INTERVAL_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setIntervalSec(sec)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  intervalSec === sec
                    ? "bg-espresso text-cream"
                    : "bg-cream text-coffee hover:text-espresso"
                }`}
              >
                Every {sec}s
              </button>
            ))}
          </div>

          {/* Telemetry grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] text-coffee">Coordinates</p>
              <p className="mt-1 text-xs font-bold text-espresso">
                {lastFix
                  ? `${lastFix.latitude.toFixed(5)}, ${lastFix.longitude.toFixed(5)}`
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] text-coffee">GPS Accuracy</p>
              <p className="mt-1 text-xs font-bold text-espresso">
                {lastFix ? `±${Math.round(lastFix.accuracy)} m` : "—"}
                <span className="ml-1 font-normal text-coffee">(max {maxAcc}m)</span>
              </p>
            </div>

            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] text-coffee">Last Server Update</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-bold text-espresso">
                <Clock className="h-3.5 w-3.5 text-caramel" />
                {sendingGps ? "Sending…" : formatRelativeTime(lastSentAt, nowMs)}
              </p>
            </div>

            <div className="rounded-xl bg-cream p-3">
              <p className="text-[11px] text-coffee">Signal Health</p>
              <p className="mt-1 text-xs font-bold">
                {!lastSentAt ? (
                  <span className="text-coffee">Idle</span>
                ) : isStale ? (
                  <span className="text-amber-700">Stale location</span>
                ) : (
                  <span className="text-emerald-700">Fresh</span>
                )}
              </p>
            </div>
          </div>

          {permissionState === "denied" && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Browser location permission was denied. Allow location access in your browser site
                settings, then click Start GPS Tracking again.
              </span>
            </div>
          )}

          {gpsError && permissionState !== "denied" && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-coffee/15 bg-cream/70 p-3 text-xs text-coffee">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-caramel" />
            <span>
              Browser GPS tracking only runs reliably while this app remains open in the
              foreground. Minimizing the browser or locking the phone pauses location broadcasts,
              and customers will see a stale-location warning.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Map Preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-coffee">
          <MapPin className="h-4 w-4 text-caramel" />
          <span>Current Cart Position Preview</span>
        </div>
        <BaristaLocationMap
          latitude={lastFix?.latitude ?? null}
          longitude={lastFix?.longitude ?? null}
          accuracy={lastFix?.accuracy ?? null}
          vendorCode={vendor.code}
          isTracking={gpsActive}
        />
      </div>
    </div>
  );
}
