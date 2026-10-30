import { parseChainageMeters } from "./weldAcceptance";

export type DiaryWork = {
  id: string; ma_lich_su: string; cong_nghe_han: string; so_luong_thuc_hien: number;
  ma_diem?: string | null; ly_trinh?: string | null;
};

/** Mỗi dòng tách theo công tác và tuyến; một mối chỉ tính một lần. */
export function diaryWorkText(rows: DiaryWork[], kind: "weld" | "grind" | "accept"): string {
  const groups = new Map<string, DiaryWork[]>();
  for (const row of new Map(rows.map((r) => [r.id, r])).values()) {
    const code = row.ma_diem?.trim().toUpperCase() ?? "";
    const route = /^(HT|HP)\d+$/.test(code) ? "tuyến hạ" : /^(TT|TP)\d+$/.test(code) ? "tuyến thượng" : "tuyến …";
    const task = kind === "grind" ? "Mài ray" : kind === "accept" ? "Nghiệm thu mối hàn" : row.cong_nghe_han === "FBW" ? "Hàn chảy giáp mép" : "Hàn nhiệt nhôm";
    const key = `${task}|${route}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([key, group]) => {
    const [task, route] = key.split("|");
    const km = group.map((r) => parseChainageMeters(r.ly_trinh)).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const format = (m: number) => {
      const [meters, fraction] = String(Number((m % 1000).toFixed(3))).split(".");
      return `Km${Math.floor(m / 1000)}+${meters.padStart(3, "0")}${fraction ? `.${fraction}` : ""}`;
    };
    const range = km.length ? `${format(km[0])} – ${format(km[km.length - 1])}` : "Km… – Km…";
    const missing = km.length < group.length ? " (cần bổ sung lý trình)" : "";
    const quantity = group.reduce((sum, r) => sum + r.so_luong_thuc_hien, 0);
    const codes = kind === "accept" ? ` Mối số: ${group.map((r) => r.ma_diem || r.ma_lich_su).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).join(", ")}.` : "";
    return `${task} đoạn ${range}, thuộc ${route}. Khối lượng: ${quantity} mối.${codes}${missing}`;
  }).join("\n");
}
