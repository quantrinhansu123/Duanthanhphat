import { compareWeldCodes, parseChainageMeters } from "./weldAcceptance";

export type RfiTrackedWeld = {
  moi_han_id: string;
  ma_lich_su: string;
  ma_diem: string | null;
  ly_trinh: string | null;
  ket_qua: string;
  da_ky: boolean;
};
export type RfiTracking = {
  da_nghiem_thu: number;
  khong_dat: number;
  chua_nghiem_thu: number;
  cho_ky: number;
  da_ky: number;
  km_nghiem_thu: string;
  thieu_ly_trinh: number;
  moi: RfiTrackedWeld[];
};

export function weldRoute(code: string | null): string {
  if (/^T[TP]/i.test(code ?? "")) return "Tuyến thượng";
  if (/^H[TP]/i.test(code ?? "")) return "Tuyến hạ";
  return "Chưa rõ tuyến";
}

/** Khoảng chỉ để định vị; danh sách từng mối mới là căn cứ đối soát KM. */
export function acceptedChainage(welds: RfiTrackedWeld[]): string {
  const groups = new Map<string, number[]>();
  for (const w of welds) {
    if (w.ket_qua !== "Đạt") continue;
    const m = parseChainageMeters(w.ly_trinh);
    if (m == null) continue;
    const route = weldRoute(w.ma_diem);
    groups.set(route, [...(groups.get(route) ?? []), m]);
  }
  const km = (m: number) => {
    const [whole, fraction] = (m % 1000).toFixed(3).split(".");
    const decimal = fraction.replace(/0+$/, "");
    return `Km${Math.floor(m / 1000)}+${whole.padStart(3, "0")}${decimal ? `.${decimal}` : ""}`;
  };
  return [...groups].map(([route, values]) => {
    const from = Math.min(...values), to = Math.max(...values);
    return `${route}: ${km(from)}${from === to ? "" : ` – ${km(to)}`}`;
  }).join("; ") || "—";
}

export function summarizeRfiWelds(welds: RfiTrackedWeld[]): RfiTracking {
  // Một mối có thể được hoãn ở đợt trước rồi nghiệm thu trong đợt sau.
  const moi = [...new Map(welds.map((w) => [w.moi_han_id, w])).values()]
    .sort((a, b) => compareWeldCodes(a.ma_lich_su, b.ma_lich_su));
  const accepted = moi.filter((w) => w.ket_qua === "Đạt");
  return {
    da_nghiem_thu: accepted.length,
    khong_dat: moi.filter((w) => w.ket_qua === "Không đạt").length,
    chua_nghiem_thu: moi.filter((w) => w.ket_qua === "Chưa nghiệm thu").length,
    cho_ky: accepted.filter((w) => !w.da_ky).length,
    da_ky: accepted.filter((w) => w.da_ky).length,
    km_nghiem_thu: acceptedChainage(moi),
    thieu_ly_trinh: moi.filter((w) => parseChainageMeters(w.ly_trinh) == null).length,
    moi,
  };
}
