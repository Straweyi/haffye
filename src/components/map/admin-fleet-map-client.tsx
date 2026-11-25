"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_LOCATION, isLocationStale } from "@/lib/geo";

export interface FleetVendor {
  id: string;
  code: string;
  name: string;
  status: string;
  vehicle_label: string | null;
  is_active: boolean;
  barista_name: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    updated_at: string;
  } | null;
}

interface AdminFleetMapClientProps {
  vendors: FleetVendor[];
  selectedVendorId: string | null;
  onSelectVendor: (id: string) => void;
  nowMs: number;
}

function buildFleetIcon(v: FleetVendor, selected: boolean, stale: boolean) {
  const bg = stale ? "#78716c" : v.status === "ACTIVE" ? "#15803d" : "#d97706";
  const ring = selected ? "0 0 0 4px rgba(197,139,85,0.65)" : "0 4px 12px rgba(36,32,29,0.3)";

  return L.divIcon({
    className: "haffye-vendor-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="background:${bg};color:#FFFDF9;border:2px solid #FFFDF9;box-shadow:${ring};padding:5px 9px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;">
          ☕ ${v.code}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function AdminFleetMapClient({
  vendors,
  selectedVendorId,
  onSelectVendor,
  nowMs,
}: AdminFleetMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fittedOnceRef = useRef(false);
  const onSelectRef = useRef(onSelectVendor);
  onSelectRef.current = onSelectVendor;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng],
      zoom: 13,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      markers.clear();
      map.remove();
      mapRef.current = null;
      fittedOnceRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const liveIds = new Set<string>();
    const coords: [number, number][] = [];

    for (const v of vendors) {
      if (!v.location || (v.status !== "ACTIVE" && v.status !== "BUSY")) continue;
      liveIds.add(v.id);
      const pos: [number, number] = [v.location.latitude, v.location.longitude];
      coords.push(pos);
      const stale = isLocationStale(v.location.updated_at, nowMs);
      const icon = buildFleetIcon(v, v.id === selectedVendorId, stale);

      const existing = markersRef.current.get(v.id);
      if (existing) {
        existing.setLatLng(pos).setIcon(icon);
      } else {
        const marker = L.marker(pos, { icon }).addTo(map);
        marker.on("click", () => onSelectRef.current(v.id));
        markersRef.current.set(v.id, marker);
      }
    }

    for (const [id, marker] of markersRef.current.entries()) {
      if (!liveIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    if (!fittedOnceRef.current && coords.length > 0) {
      fittedOnceRef.current = true;
      if (coords.length === 1) map.setView(coords[0], 14);
      else map.fitBounds(coords, { padding: [40, 40], maxZoom: 15 });
    }
  }, [vendors, selectedVendorId, nowMs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVendorId) return;
    const target = vendors.find((v) => v.id === selectedVendorId);
    if (target?.location) {
      map.panTo([target.location.latitude, target.location.longitude], { animate: true });
    }
  }, [selectedVendorId, vendors]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-2xl border border-coffee/15 shadow-soft"
    />
  );
}
