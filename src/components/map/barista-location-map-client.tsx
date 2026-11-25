"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_LOCATION } from "@/lib/geo";

interface BaristaLocationMapClientProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  vendorCode: string;
  isTracking: boolean;
}

export default function BaristaLocationMapClient({
  latitude,
  longitude,
  accuracy,
  vendorCode,
  isTracking,
}: BaristaLocationMapClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  const lat = latitude ?? DEFAULT_LOCATION.lat;
  const lng = longitude ?? DEFAULT_LOCATION.lng;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: [lat, lng], zoom: 16 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      return;
    }

    const pos: L.LatLngExpression = [latitude, longitude];
    const icon = L.divIcon({
      className: "haffye-vendor-marker",
      html: `<div style="transform:translate(-50%,-50%);background:${
        isTracking ? "#15803d" : "#3B2418"
      };color:#FFFDF9;border:2px solid #FFFDF9;padding:5px 10px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.25);">☕ ${vendorCode}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng(pos).setIcon(icon);
    } else {
      markerRef.current = L.marker(pos, { icon }).addTo(map);
    }

    const rad = Math.max(5, accuracy ?? 20);
    if (circleRef.current) {
      circleRef.current.setLatLng(pos).setRadius(rad);
    } else {
      circleRef.current = L.circle(pos, {
        radius: rad,
        color: "#C58B55",
        weight: 1.5,
        fillColor: "#C58B55",
        fillOpacity: 0.14,
      }).addTo(map);
    }

    map.panTo(pos, { animate: true });
  }, [latitude, longitude, accuracy, vendorCode, isTracking]);

  return (
    <div
      ref={containerRef}
      className="h-[320px] w-full overflow-hidden rounded-2xl border border-coffee/15 shadow-soft"
    />
  );
}
