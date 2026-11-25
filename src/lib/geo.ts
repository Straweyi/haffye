import type { CustomerLocation } from "@/types/domain";

export const DEFAULT_LOCATION: CustomerLocation = {
  lat: -6.2088,
  lng: 106.8229,
  label: "Sudirman, Jakarta",
  source: "manual",
};

export const PRESET_LOCATIONS: CustomerLocation[] = [
  { lat: -6.2088, lng: 106.8229, label: "Sudirman, Jakarta", source: "manual" },
  { lat: -6.2246, lng: 106.8097, label: "SCBD, Jakarta", source: "manual" },
  { lat: -6.1944, lng: 106.8294, label: "Menteng, Jakarta", source: "manual" },
  { lat: -6.2607, lng: 106.8141, label: "Kemang, Jakarta", source: "manual" },
  { lat: -6.2253, lng: 106.8004, label: "Senayan, Jakarta", source: "manual" },
];

export const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 25] as const;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function getStaleThresholdSeconds(): number {
  const raw = Number(process.env.NEXT_PUBLIC_LOCATION_STALE_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

export function isLocationStale(updatedAt: string | null, nowMs = Date.now()): boolean {
  if (!updatedAt) return true;
  const updatedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return true;
  return (nowMs - updatedMs) / 1000 > getStaleThresholdSeconds();
}

export function formatRelativeTime(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return "No GPS signal";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "Unknown";
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}
