"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader, InfoWindowF } from "@react-google-maps/api";
import type { MapBaseLayer, MapPoint, MapViewMode } from "@/data/mapPoints";
import { routeCenter, vietnamCenter, vietnamZoom } from "@/data/mapPoints";

const mapContainerStyle = { width: "100%", height: "100%", minHeight: 420 };

type Props = {
  points: MapPoint[];
  mode: MapViewMode;
  baseLayer?: MapBaseLayer;
  selectedId?: string | null;
  focusSelected?: boolean;
  onSelect?: (id: string) => void;
  apiKey: string;
};

export default function GoogleCoordinateMap({
  points,
  mode,
  baseLayer = "roadmap",
  selectedId,
  focusSelected = false,
  onSelect,
  apiKey,
}: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    language: "vi",
    region: "VN",
  });

  const path = useMemo(
    () => points.map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [points],
  );

  const selected = points.find((p) => p.id === selectedId) ?? null;

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    if (focusSelected && selected) {
      map.panTo({ lat: selected.latitude, lng: selected.longitude });
      map.setZoom(17);
      return;
    }

    if (mode === "vietnam") {
      map.panTo({ lat: vietnamCenter[0], lng: vietnamCenter[1] });
      map.setZoom(vietnamZoom);
      return;
    }

    if (points.length === 0) {
      map.panTo({ lat: routeCenter[0], lng: routeCenter[1] });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
    map.fitBounds(bounds, 48);
  }, [isLoaded, mode, points, focusSelected, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    // hybrid = vệ tinh + nhãn đường (dễ đọc lý trình hơn pure satellite)
    map.setMapTypeId(baseLayer === "satellite" ? "hybrid" : "roadmap");
  }, [isLoaded, baseLayer]);

  useEffect(() => {
    if (!isLoaded) return;
    const onResize = () => {
      const map = mapRef.current;
      if (!map) return;
      google.maps.event.trigger(map, "resize");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isLoaded]);

  if (loadError) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-2 bg-[#fef2f2] px-6 text-center text-[13px] text-[#b91c1c]">
        <strong>Không tải được Google Maps</strong>
        <span>Kiểm tra API key, bật Maps JavaScript API, hoặc hạn chế domain/localhost.</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-[#e8eef8] text-[13px] text-[#64748b]">
        Đang tải Google Maps…
      </div>
    );
  }

  const mapOptions: google.maps.MapOptions = {
    streetViewControl: false,
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.TOP_RIGHT,
      mapTypeIds: ["roadmap", "satellite", "hybrid", "terrain"],
    },
    fullscreenControl: true,
    gestureHandling: "greedy",
    clickableIcons: false,
    mapTypeId: baseLayer === "satellite" ? "hybrid" : "roadmap",
  };

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={{ lat: routeCenter[0], lng: routeCenter[1] }}
      zoom={15}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={mapOptions}
    >
      {path.length > 1 && (
        <PolylineF
          path={path}
          options={{
            strokeColor: "#dc2626",
            strokeOpacity: 0.9,
            strokeWeight: 4,
          }}
        />
      )}

      {points.map((p) => {
        const active = p.id === selectedId;
        return (
          <MarkerF
            key={p.id}
            position={{ lat: p.latitude, lng: p.longitude }}
            title={`${p.code} · ${p.chainage}`}
            label={{
              text: p.code.replace(/^TT0*/, "").slice(-4) || p.code.replace("TT", ""),
              color: "#ffffff",
              fontSize: "8px",
              fontWeight: "700",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: active ? 9 : 7,
              fillColor: active ? "#dc2626" : "#0047AB",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
            zIndex={active ? 999 : 1}
            onClick={() => onSelect?.(p.id)}
          />
        );
      })}

          {selected && (
            <InfoWindowF
              position={{ lat: selected.latitude, lng: selected.longitude }}
              onCloseClick={() => onSelect?.("")}
            >
          <div style={{ minWidth: 150, fontSize: 13, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 700 }}>{selected.code}</div>
            <div>{selected.chainage}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {selected.latitude}, {selected.longitude}
            </div>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}
