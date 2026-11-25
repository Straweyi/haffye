"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isLocationStale } from "@/lib/geo";
import type { CustomerLocation, VendorWithLocation } from "@/types/domain";

interface LiveVendorMapClientProps {
  customerLocation: CustomerLocation;
  searchRadiusKm: number;
  vendors: VendorWithLocation[];
  selectedVendorId: string | null;
  pickLocationMode?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
  onSelectMarker?: (vendorId: string) => void;
  nowMs: number;
  heightClassName?: string;
}

function buildVendorIcon(vendor: VendorWithLocation, isSelected: boolean, stale: boolean) {
  const bg = stale
    ? "#78716c"
    : vendor.status === "ACTIVE"
      ? "#15803d"
      : "#d97706";
  const ring = isSelected ? "0 0 0 4px rgba(197,139,85,0.65)" : "0 4px 12px rgba(36,32,29,0.3)";

  return L.divIcon({
    className: "haffye-vendor-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="background:${bg};color:#FFFDF9;border:2px solid #FFFDF9;box-shadow:${ring};padding:5px 9px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          <span>☕</span>
          <span>${vendor.code}</span>
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function buildCustomerIcon() {
  return L.divIcon({
    className: "haffye-customer-marker",
    html: `<div class="haffye-customer-dot" style="width:16px;height:16px;border-radius:9999px;background:#3B2418;border:3px solid #FFFDF9;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function LiveVendorMapClient({
  customerLocation,
  searchRadiusKm,
  vendors,
  selectedVendorId,
  pickLocationMode = false,
  onPickLocation,
  onSelectMarker,
  nowMs,
  heightClassName = "h-[440px] md:h-[520px]",
}: LiveVendorMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const vendorMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const pickModeRef = useRef(pickLocationMode);
  const onPickRef = useRef(onPickLocation);
  const onSelectRef = useRef(onSelectMarker);

  pickModeRef.current = pickLocationMode;
  onPickRef.current = onPickLocation;
  onSelectRef.current = onSelectMarker;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [customerLocation.lat, customerLocation.lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    customerMarkerRef.current = L.marker([customerLocation.lat, customerLocation.lng], {
      icon: buildCustomerIcon(),
    })
      .bindTooltip("Your location", { direction: "top", offset: [0, -10] })
      .addTo(map);

    radiusCircleRef.current = L.circle([customerLocation.lat, customerLocation.lng], {
      radius: searchRadiusKm * 1000,
      color: "#C58B55",
      weight: 1.5,
      fillColor: "#C58B55",
      fillOpacity: 0.08,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onPickRef.current) {
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;
    const markersMap = vendorMarkersRef.current;

    return () => {
      markersMap.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update customer marker, radius circle & center when customer location or radius changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const latLng: L.LatLngExpression = [customerLocation.lat, customerLocation.lng];
    customerMarkerRef.current?.setLatLng(latLng);
    radiusCircleRef.current?.setLatLng(latLng);
    radiusCircleRef.current?.setRadius(searchRadiusKm * 1000);
    map.panTo(latLng, { animate: true });
  }, [customerLocation.lat, customerLocation.lng, searchRadiusKm]);

  // Update cursor hint in pickLocationMode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = pickLocationMode ? "crosshair" : "";
  }, [pickLocationMode]);

  // Sync vendor markers smoothly without remounting the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set<string>();
    for (const vendor of vendors) {
      if (!vendor.location) continue;
      activeIds.add(vendor.id);

      const pos: L.LatLngExpression = [vendor.location.latitude, vendor.location.longitude];
      const stale = isLocationStale(vendor.location.updated_at, nowMs);
      const icon = buildVendorIcon(vendor, vendor.id === selectedVendorId, stale);

      const existing = vendorMarkersRef.current.get(vendor.id);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(icon);
      } else {
        const marker = L.marker(pos, { icon }).addTo(map);
        marker.on("click", () => {
          onSelectRef.current?.(vendor.id);
        });
        vendorMarkersRef.current.set(vendor.id, marker);
      }
    }

    for (const [id, marker] of vendorMarkersRef.current.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        vendorMarkersRef.current.delete(id);
      }
    }
  }, [vendors, selectedVendorId, nowMs]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-2xl border border-coffee/15 shadow-soft ${heightClassName}`}
    />
  );
}
