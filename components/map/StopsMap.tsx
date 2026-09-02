"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface MapPoint { id: string; lat: number; lng: number; label: string; sub?: string; href?: string; done?: boolean; seq?: number }

/** Leaflet map with OpenStreetMap tiles. No API key. Renders nothing until mounted on the client. */
export function StopsMap({ points, height = 300, className = "" }: { points: MapPoint[]; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
      const bounds = L.latLngBounds([]);
      const pts: [number, number][] = [];
      points.forEach((p) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${p.done ? "#1e8e5a" : "#ffbd15"};color:${p.done ? "#fff" : "#000"};border:2px solid #000;display:grid;place-items:center;font:700 12px Montserrat,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3)">${p.seq ?? "•"}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map!);
        m.bindPopup(`<b>${p.label}</b>${p.sub ? `<br><span style="color:#686867">${p.sub}</span>` : ""}${p.href ? `<br><a href="${p.href}" style="color:#e29f0a;font-weight:700">Open →</a>` : ""}`);
        bounds.extend([p.lat, p.lng]);
        pts.push([p.lat, p.lng]);
      });
      if (pts.length > 1) L.polyline(pts, { color: "#ffbd15", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(map);
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [points]);
  if (points.length === 0) return null;
  return <div ref={ref} style={{ height }} className={`rounded-xl overflow-hidden border border-line z-0 ${className}`} />;
}
