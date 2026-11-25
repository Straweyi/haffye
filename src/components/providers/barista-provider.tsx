"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { updateVendorStatusAction } from "@/app/actions/barista";
import { isLocationStale } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import type { BaristaVendor, VendorStatus } from "@/types/domain";

export type RealtimeStatus = "connecting" | "live" | "offline";
export type GpsPermissionState = "idle" | "granted" | "denied" | "unsupported";

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface BaristaContextValue {
  vendor: BaristaVendor | null;
  realtimeStatus: RealtimeStatus;
  nowMs: number;
  isOnline: boolean;
  gpsActive: boolean;
  sendingGps: boolean;
  intervalSec: number;
  setIntervalSec: (sec: number) => void;
  permissionState: GpsPermissionState;
  lastFix: GpsFix | null;
  lastSentAt: string | null;
  gpsError: string | null;
  isStale: boolean;
  statusUpdating: boolean;
  statusFeedback: string | null;
  changeVendorStatus: (next: VendorStatus) => Promise<void>;
  startTracking: () => void;
  stopTracking: () => void;
}

const BaristaContext = createContext<BaristaContextValue | null>(null);

let baristaChannelSeq = 0;

function getDefaultInterval(): number {
  const n = Number(process.env.NEXT_PUBLIC_GPS_UPDATE_INTERVAL_SECONDS);
  return Number.isFinite(n) && n >= 5 && n <= 30 ? n : 8;
}

function BaristaContextInner({
  initialVendor,
  children,
}: {
  initialVendor: BaristaVendor | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [vendor, setVendor] = useState<BaristaVendor | null>(initialVendor);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState(true);

  const [gpsActive, setGpsActive] = useState(false);
  const [sendingGps, setSendingGps] = useState(false);
  const [intervalSec, setIntervalSec] = useState<number>(getDefaultInterval);
  const [permissionState, setPermissionState] = useState<GpsPermissionState>("idle");
  const [lastFix, setLastFix] = useState<GpsFix | null>(() =>
    initialVendor?.location
      ? {
          latitude: initialVendor.location.latitude,
          longitude: initialVendor.location.longitude,
          accuracy: initialVendor.location.accuracy ?? 0,
          heading: initialVendor.location.heading,
          speed: initialVendor.location.speed,
          timestamp: new Date(initialVendor.location.updated_at).getTime(),
        }
      : null,
  );
  const [lastSentAt, setLastSentAt] = useState<string | null>(
    initialVendor?.location?.updated_at ?? null,
  );
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const latestFixRef = useRef<GpsFix | null>(null);
  const lastPostMsRef = useRef<number>(0);

  useEffect(() => {
    setVendor(initialVendor);
  }, [initialVendor]);

  // Network online/offline listeners
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Single Realtime subscription for barista's vendor & orders + 5s timestamp ticker
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 5000);
    if (!vendor?.id) {
      setRealtimeStatus("offline");
      return () => clearInterval(ticker);
    }

    let cancelled = false;
    const supabase = createClient();
    const topic = `haffye-barista-${vendor.id}-${++baristaChannelSeq}`;

    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `vendor_id=eq.${vendor.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["barista-orders", vendor.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendors", filter: `id=eq.${vendor.id}` },
        (payload) => {
          const nextRow = payload.new as Partial<BaristaVendor> | undefined;
          if (nextRow?.status) {
            setVendor((prev) => (prev ? { ...prev, status: nextRow.status as VendorStatus } : prev));
          }
          void queryClient.invalidateQueries({ queryKey: ["barista-orders", vendor.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_locations",
          filter: `vendor_id=eq.${vendor.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["barista-orders", vendor.id] });
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("offline");
        } else {
          setRealtimeStatus("connecting");
        }
      });

    return () => {
      cancelled = true;
      clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, [vendor?.id, queryClient]);

  const postLocationFix = useCallback(async (fix: GpsFix) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setGpsError("Connection lost. Waiting to reconnect before broadcasting GPS.");
      return;
    }

    setSendingGps(true);
    try {
      const res = await fetch("/api/vendor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          heading: fix.heading,
          speed: fix.speed,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        location?: { updated_at: string };
      };

      if (!res.ok) {
        if (res.status !== 429) {
          setGpsError(json.error || "Failed to broadcast location");
        }
        return;
      }

      lastPostMsRef.current = Date.now();
      setLastSentAt(json.location?.updated_at ?? new Date().toISOString());
      setGpsError(null);
    } catch {
      setGpsError("Network error while broadcasting GPS coordinates.");
    } finally {
      setSendingGps(false);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setGpsActive(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!vendor) {
      setGpsError("No vendor unit assigned to your account.");
      return;
    }
    if (vendor.status !== "ACTIVE" && vendor.status !== "BUSY") {
      setGpsError("Set operational status to ACTIVE or BUSY before starting GPS tracking.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      setGpsError("Browser Geolocation API is not supported on this device.");
      return;
    }

    stopTracking();
    setGpsError(null);
    setGpsActive(true);
    lastPostMsRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermissionState("granted");
        const fix: GpsFix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        latestFixRef.current = fix;
        setLastFix(fix);

        if (Date.now() - lastPostMsRef.current >= intervalSec * 1000) {
          lastPostMsRef.current = Date.now();
          void postLocationFix(fix);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
          setGpsError("GPS permission denied. Enable location access in browser settings.");
          stopTracking();
        } else if (err.code === err.TIMEOUT) {
          setGpsError("GPS fix timed out. Waiting for clearer satellite/network signal…");
        } else {
          setGpsError("Location unavailable. Check device GPS settings.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, [vendor, intervalSec, postLocationFix, stopTracking]);

  // Periodic interval sender using the latest watched fix while active
  useEffect(() => {
    if (!gpsActive) return;
    const id = setInterval(() => {
      const fix = latestFixRef.current;
      if (fix && Date.now() - lastPostMsRef.current >= intervalSec * 1000 - 250) {
        lastPostMsRef.current = Date.now();
        void postLocationFix(fix);
      }
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [gpsActive, intervalSec, postLocationFix]);

  // Automatically stop GPS tracking if vendor goes OFFLINE or PAUSED or unmounts
  useEffect(() => {
    if (vendor && vendor.status !== "ACTIVE" && vendor.status !== "BUSY" && gpsActive) {
      stopTracking();
    }
  }, [vendor, gpsActive, stopTracking]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const changeVendorStatus = useCallback(
    async (next: VendorStatus) => {
      if (!vendor) return;
      setStatusUpdating(true);
      setStatusFeedback(null);
      const res = await updateVendorStatusAction(next);
      if (res.error) {
        setStatusFeedback(res.error);
      } else {
        setVendor((prev) =>
          prev
            ? {
                ...prev,
                status: next,
                location: next === "OFFLINE" || next === "PAUSED" ? null : prev.location,
              }
            : prev,
        );
        if (next === "OFFLINE" || next === "PAUSED") {
          stopTracking();
          setLastSentAt(null);
        }
        setStatusFeedback(res.message ?? `Status updated to ${next}`);
      }
      setStatusUpdating(false);
    },
    [vendor, stopTracking],
  );

  const isStale = useMemo(() => isLocationStale(lastSentAt, nowMs), [lastSentAt, nowMs]);

  const value = useMemo<BaristaContextValue>(
    () => ({
      vendor,
      realtimeStatus,
      nowMs,
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
      statusUpdating,
      statusFeedback,
      changeVendorStatus,
      startTracking,
      stopTracking,
    }),
    [
      vendor,
      realtimeStatus,
      nowMs,
      isOnline,
      gpsActive,
      sendingGps,
      intervalSec,
      permissionState,
      lastFix,
      lastSentAt,
      gpsError,
      isStale,
      statusUpdating,
      statusFeedback,
      changeVendorStatus,
      startTracking,
      stopTracking,
    ],
  );

  return <BaristaContext.Provider value={value}>{children}</BaristaContext.Provider>;
}

export function BaristaProvider({
  initialVendor,
  children,
}: {
  initialVendor: BaristaVendor | null;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BaristaContextInner initialVendor={initialVendor}>{children}</BaristaContextInner>
    </QueryClientProvider>
  );
}

export function useBarista() {
  const ctx = useContext(BaristaContext);
  if (!ctx) throw new Error("useBarista must be used inside BaristaProvider");
  return ctx;
}
