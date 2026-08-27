export type MapPoint = {
  id: string;
  code: string;
  longitude: number;
  latitude: number;
  chainage: string;
};

export type MapViewMode = "vietnam" | "route";

/** Nền bản đồ: đường phố hoặc ảnh vệ tinh */
export type MapBaseLayer = "roadmap" | "satellite";

/**
 * Chuỗi tọa độ mẫu quanh Hà Nội (trục gần Ga Hà Nội → phía Nam).
 * Lon ≈ 105.84, Lat ≈ 21.02 → giảm dần về phía Nam.
 */
export const mapPoints: MapPoint[] = [
  { id: "1", code: "TT0001", longitude: 105.8412, latitude: 21.0245, chainage: "Km0+000.00" },
  { id: "2", code: "TT0002", longitude: 105.8415, latitude: 21.0228, chainage: "Km0+025.00" },
  { id: "3", code: "TT0003", longitude: 105.8418, latitude: 21.0211, chainage: "Km0+050.00" },
  { id: "4", code: "TT0004", longitude: 105.8421, latitude: 21.0194, chainage: "Km0+075.00" },
  { id: "5", code: "TT0005", longitude: 105.8424, latitude: 21.0177, chainage: "Km0+100.00" },
  { id: "6", code: "TT0006", longitude: 105.8427, latitude: 21.0160, chainage: "Km0+125.00" },
  { id: "7", code: "TT0007", longitude: 105.8430, latitude: 21.0143, chainage: "Km0+150.00" },
  { id: "8", code: "TT0008", longitude: 105.8433, latitude: 21.0126, chainage: "Km0+175.00" },
  { id: "9", code: "TT0009", longitude: 105.8436, latitude: 21.0109, chainage: "Km0+200.00" },
  { id: "10", code: "TT0010", longitude: 105.8439, latitude: 21.0092, chainage: "Km0+225.00" },
  { id: "11", code: "TT0011", longitude: 105.8442, latitude: 21.0075, chainage: "Km0+250.00" },
  { id: "12", code: "TT0012", longitude: 105.8445, latitude: 21.0058, chainage: "Km0+275.00" },
  { id: "13", code: "TT0013", longitude: 105.8448, latitude: 21.0041, chainage: "Km0+300.00" },
  { id: "14", code: "TT0014", longitude: 105.8451, latitude: 21.0024, chainage: "Km0+325.00" },
];

/** Toàn Việt Nam */
export const vietnamCenter: [number, number] = [16.0, 106.5];
export const vietnamZoom = 5;

export const vietnamBounds: [[number, number], [number, number]] = [
  [8.0, 102.0],
  [23.5, 110.0],
];

export const routeCenter: [number, number] = [
  mapPoints.reduce((s, p) => s + p.latitude, 0) / mapPoints.length,
  mapPoints.reduce((s, p) => s + p.longitude, 0) / mapPoints.length,
];

export function googleOpenPoint(lat: number, lon: number) {
  return `https://www.google.com/maps?q=${lat},${lon}&hl=vi`;
}

export function googleOpenVietnam() {
  return "https://www.google.com/maps/@16,106.5,5z?hl=vi";
}

export function googleOpenRoute(points: MapPoint[]) {
  if (points.length === 0) return googleOpenVietnam();
  const path = points.map((p) => `${p.latitude},${p.longitude}`).join("/");
  return `https://www.google.com/maps/dir/${path}/?hl=vi`;
}
