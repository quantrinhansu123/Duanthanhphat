"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapBaseLayer, MapPoint, MapViewMode } from "@/data/mapPoints";
import {
  googleOpenPoint,
  routeCenter,
  sampleMapMarkers,
  vietnamBounds,
  vietnamCenter,
  vietnamZoom,
} from "@/data/mapPoints";
import "leaflet/dist/leaflet.css";

const pinIconCache = new Map<string, L.DivIcon>();

function makePinIcon(label: string, active: boolean) {
  const cacheKey = `${label}:${active ? "active" : "normal"}`;
  const cached = pinIconCache.get(cacheKey);
  if (cached) return cached;
  const bg = active ? "#dc2626" : "#0047AB";
  const size = active ? 22 : 18;
  const short = label.replace(/^TT0*/, "").slice(-4) || label.replace("TT", "");
  const icon = L.divIcon({
    className: "map-pin-wrap",
    iconSize: [size, size + 6],
    iconAnchor: [size / 2, size + 3],
    popupAnchor: [0, -(size + 2)],
    html: `<div class="map-pin" style="--pin-bg:${bg};--pin-size:${size}px" title="${label}">
      <span class="map-pin-dot">${short}</span>
      <span class="map-pin-tail"></span>
    </div>`,
  });
  pinIconCache.set(cacheKey, icon);
  return icon;
}

function MapReady() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t1 = window.setTimeout(fix, 100);
    const t2 = window.setTimeout(fix, 400);
    window.addEventListener("resize", fix);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

function CameraController({
  mode,
  points,
  focusPoint,
}: {
  mode: MapViewMode;
  points: MapPoint[];
  focusPoint?: MapPoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusPoint) {
      map.flyTo([focusPoint.latitude, focusPoint.longitude], 17, { duration: 0.5 });
      return;
    }
    if (mode === "vietnam") {
      map.flyTo(vietnamCenter, vietnamZoom, { duration: 0.5 });
      return;
    }
    if (points.length === 0) {
      map.flyTo(routeCenter, 15, { duration: 0.5 });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.flyToBounds(bounds, { padding: [48, 48], duration: 0.5, maxZoom: 17 });
  }, [map, mode, points, focusPoint]);

  return null;
}

type Props = {
  points: MapPoint[];
  mode: MapViewMode;
  baseLayer?: MapBaseLayer;
  selectedId?: string | null;
  focusSelected?: boolean;
  onSelect?: (id: string) => void;
};

export default function CoordinateLeafletMap({
  points,
  mode,
  baseLayer = "roadmap",
  selectedId,
  focusSelected = false,
  onSelect,
}: Props) {
  const line = useMemo(
    () => points.map((p) => [p.latitude, p.longitude] as [number, number]),
    [points],
  );
  const markerPoints = useMemo(
    () => sampleMapMarkers(points, selectedId),
    [points, selectedId],
  );
  const focusPoint =
    focusSelected && selectedId ? points.find((p) => p.id === selectedId) ?? null : null;

  return (
    <MapContainer
      center={vietnamCenter}
      zoom={vietnamZoom}
      minZoom={5}
      maxZoom={19}
      scrollWheelZoom
      className="leaflet-map-root h-full w-full rounded-xl"
      style={{ height: "100%", width: "100%", minHeight: 420, background: "#c7dff7" }}
      maxBounds={vietnamBounds}
      maxBoundsViscosity={0.85}
      preferCanvas
    >
      {baseLayer === "satellite" ? (
        <>
          <TileLayer
            key="esri-sat"
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            key="esri-labels"
            attribution="Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.9}
          />
        </>
      ) : (
        <TileLayer
          key="osm-road"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      )}
      <MapReady />
      <CameraController mode={mode} points={points} focusPoint={focusPoint} />

      {line.length > 1 && (
        <Polyline
          positions={line}
          pathOptions={{ color: "#dc2626", weight: 4, opacity: 0.85 }}
        />
      )}

      {markerPoints.map((p) => {
        const active = p.id === selectedId;
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={makePinIcon(p.weldCode || p.code, active)}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Popup>
              <div className="min-w-[190px] text-[13px] leading-snug">
                <div className="flex items-center justify-between gap-1 border-b border-slate-200 pb-1 mb-1.5">
                  <span className="font-bold text-[#0047AB]">{p.code}</span>
                  {p.weldCode ? (
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        p.result === "Đạt" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {p.result || "Đạt"}
                    </span>
                  ) : (
                    <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500">
                      Chưa liên kết
                    </span>
                  )}
                </div>

                {p.weldCode && (
                  <div className="mb-1.5 space-y-0.5 text-xs text-slate-700">
                    <div>Mối hàn: <strong className="font-mono text-slate-900">{p.weldCode}</strong></div>
                    {p.welderName && <div>Thợ hàn: <strong>{p.welderName}</strong></div>}
                    {p.machineName && <div>Máy: <span className="text-slate-600">{p.machineName}</span></div>}
                    {p.projectName && <div>Dự án: <span className="text-slate-600">{p.projectName}</span></div>}
                    {p.performedDate && <div>Ngày: <span className="font-mono text-slate-600">{p.performedDate}</span></div>}
                  </div>
                )}

                <div className="text-xs text-slate-600">
                  {p.chainage && <div>Lý trình: <strong>{p.chainage}</strong></div>}
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                  </div>
                </div>

                <a
                  href={googleOpenPoint(p.latitude, p.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-[#0047AB] hover:underline"
                >
                  Mở trên Google Maps →
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
