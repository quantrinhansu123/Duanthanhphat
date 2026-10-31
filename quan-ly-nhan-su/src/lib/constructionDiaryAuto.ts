import { parseChainageMeters } from "./weldAcceptance";
import { formatChainage, getPlacementSpan, type TrackLayout } from "@lwr/lib/track-editor";

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
    const codes = ` Mối số: ${group.map((r) => r.ma_diem || r.ma_lich_su).sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).join(", ")}.`;
    return `${task} đoạn ${range}, thuộc ${route}. Khối lượng: ${quantity} mối.${codes}${missing}`;
  }).join("\n");
}

export function diaryStressReleaseText(layout: TrackLayout | null, projectId: string, date: string): string {
  if (!layout) return "";
  return [...new Map(layout.longRails.map((rail) => [rail.id, rail])).values()].flatMap((rail) => {
    if (!rail.completedAt || (rail.projectId && rail.projectId !== projectId)) return [];
    const completedDate = new Date(rail.completedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    if (completedDate !== date) return [];
    const span = getPlacementSpan(layout.rows, rail);
    if (!span) return [];
    return [`Giải tỏa ứng suất đoạn Km${formatChainage(span.startMetres)} – Km${formatChainage(span.endMetres)}, ${span.row.line}, ${span.row.rail}. Đoạn LWR: ${rail.code}. Khối lượng: ${Number((span.endMetres - span.startMetres).toFixed(3))} m ray.`];
  }).join("\n");
}

/** Báo cáo ngày ghi số lượng; nếu chưa nhập thì dùng nhân sự đã gán dự án. */
export function diaryManpowerDefaults(reports: Record<string, unknown>[], personnel: {
  employee_id: string; ho_ten: string; chuc_vu: string | null; trang_thai: string | null;
}[], managerId: string | null) {
  const roster = { cht: [] as string[], ky_su: [] as string[], workers: [] as string[] };
  for (const person of new Map(personnel.map((p) => [p.employee_id, p])).values()) {
    if (person.trang_thai === "Khóa") continue;
    const role = (person.chuc_vu ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (person.employee_id === managerId || /\bcht\b|chi huy/.test(role)) roster.cht.push(person.ho_ten);
    else if (/ky su|ki su|ky thuat|engineer/.test(role)) roster.ky_su.push(person.ho_ten);
    else roster.workers.push(person.ho_ten);
  }
  const count = (role: string): number | null => {
    const names = new Set<string>();
    let quantity: number | null = null;
    for (const row of reports) {
      const bag = row.nhan_luc as Record<string, unknown> | null;
      const people = bag && Array.isArray(bag[role]) ? bag[role] as { id?: string; ten?: string }[] : [];
      const legacy = row[`${role}_ten`] ?? row[`so_${role}`];
      const values = people.length ? people : legacy != null ? [{ ten: String(legacy), id: String(row[`${role}_id`] ?? "") }] : [];
      for (const person of values) {
        if (!person || typeof person !== "object") continue;
        const name = String(person.ten ?? "").trim();
        if (!person.id && /^-?\d+(\.\d+)?$/.test(name)) {
          // shortcut: số lượng không có danh tính lấy mức cao nhất giữa các hạng mục; dùng chấm công khi cần tổng người khác nhau.
          if (Number.isSafeInteger(Number(name)) && Number(name) >= 0) quantity = Math.max(quantity ?? 0, Number(name));
        } else if (person.id) names.add(person.id);
        else for (const part of name.split(/\s*[,;·|/]\s*/).filter(Boolean)) names.add(part.toLocaleLowerCase("vi"));
      }
    }
    return names.size > 0 || quantity !== null ? Math.max(names.size, quantity ?? 0) : null;
  };
  const cht = count("cht"), engineer = count("ky_su");
  const workers = ["lai_may", "tho_van_hanh", "cong_nhan", "vnr"].map(count);
  const fromReports = cht != null || engineer != null || workers.some((n) => n != null);
  return {
    banChiHuy: String(cht ?? roster.cht.length),
    canBoKyThuat: String(engineer ?? roster.ky_su.length),
    congNhan: String(workers.some((n) => n != null) ? workers.reduce<number>((sum, n) => sum + (n ?? 0), 0) : roster.workers.length),
    nhanLucNguon: fromReports
      ? "Theo báo cáo ngày của dự án; vai trò chưa nhập dùng nhân sự được gán. Số lượng lặp giữa hạng mục lấy mức cao nhất từng vai trò."
      : `Theo nhân sự được gán dự án. Ban chỉ huy: ${roster.cht.join(", ") || "chưa gán"}. Kỹ sư: ${roster.ky_su.join(", ") || "chưa gán"}. Mỗi người chỉ tính một nhóm.`,
  };
}
