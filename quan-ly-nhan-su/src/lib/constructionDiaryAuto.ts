import { parseChainageMeters } from "./weldAcceptance";
import { fieldWeldCode } from "./weldCode";
import { formatChainage, getPlacementSpan, type TrackLayout } from "@lwr/lib/track-editor";

export type DiaryWork = {
  id: string; ma_lich_su: string; cong_nghe_han: string; so_luong_thuc_hien: number;
  ma_diem?: string | null; ly_trinh?: string | null; tho_han_id?: string | null; ma_hien_truong?: string | null;
};

/** Mã in trên nhật ký: «FBW-ddmmyyxxxx» (bỏ PQ-); mối chưa có mã hiện trường lấy mã điểm TT/HT…, không có thì bỏ. */
export function diaryCode(r: Pick<DiaryWork, "ma_hien_truong" | "ma_diem">): string {
  const site = r.ma_hien_truong?.trim();
  return site ? fieldWeldCode(null, site) : r.ma_diem?.trim() || "";
}

/** Máy hàn trên nhật ký: «Máy hàn chảy giáp mép UN5-150ZC2-C6» — bỏ tên cũ và phần ngoặc lặp mã. */
export function diaryMachineName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  const model = /(?:^|[\s(])((?:UN5|KCM|K922)[A-Z0-9./-]*)/i.exec(cleaned)?.[1];
  if (model) return `Máy hàn chảy giáp mép ${model}`;
  if (/máy hàn tiếp xúc|flash\s*butt|đối đầu/i.test(cleaned)) return "Máy hàn chảy giáp mép";
  return cleaned.replace(/^(.+?) \((.+)\)$/, (m, a, b) => a.trim().toLowerCase() === b.trim().toLowerCase() ? a : m);
}

/** Mỗi dòng tách theo công tác và tuyến; một mối chỉ tính một lần. `title` thay tên công tác (VD «Báo RFI số 3 nghiệm thu hình học»). */
export function diaryWorkText(rows: DiaryWork[], kind: "weld" | "grind" | "accept", title?: string): string {
  const groups = new Map<string, DiaryWork[]>();
  for (const row of new Map(rows.map((r) => [r.id, r])).values()) {
    const code = row.ma_diem?.trim().toUpperCase() ?? "";
    const route = /^(HT|HP)\d+$/.test(code) ? "tuyến hạ" : /^(TT|TP)\d+$/.test(code) ? "tuyến thượng" : "tuyến …";
    const task = title ?? (kind === "grind" ? "Mài ray" : kind === "accept" ? "Nghiệm thu mối hàn" : row.cong_nghe_han === "FBW" ? "Hàn chảy giáp mép" : "Hàn nhiệt nhôm");
    const key = `${task}|${route}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([key, group]) => {
    const [task, route] = key.split("|");
    const km = group.map((r) => parseChainageMeters(r.ly_trinh)).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const format = (m: number) => {
      const [meters, fraction] = String(Number((m % 1000).toFixed(3))).split(".");
      return `Km${Math.floor(m / 1000)}+${meters.padStart(3, "0")}${fraction ? `.${fraction.padEnd(2, "0")}` : ""}`;
    };
    const range = km.length ? `${format(km[0])} – ${format(km[km.length - 1])}` : "Km… – Km…";
    const missing = km.length < group.length ? " (cần bổ sung lý trình)" : "";
    const quantity = group.reduce((sum, r) => sum + r.so_luong_thuc_hien, 0);
    // Chỉ in mã hiện trường (ma_hien_truong, hoặc mã điểm TT/HT…); mối chưa có thì bỏ, không dùng mã hệ thống PQ-….
    const fieldCodes = group.map(diaryCode).filter(Boolean).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    const codes = fieldCodes.length ? ` Mối số: ${fieldCodes.join(", ")}.` : "";
    if (kind === "weld") return `- Thi công ${task.charAt(0).toLowerCase()}${task.slice(1)}, khối lượng ${quantity} mối hàn${fieldCodes.length ? `; bao gồm mối số: ${fieldCodes.join(", ")}` : ""}.`;
    return `- ${task} đoạn ${range}, thuộc ${route}. Khối lượng: ${quantity} mối.${codes}${missing}`;
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
    return [`- Giải tỏa ứng suất đoạn Km${formatChainage(span.startMetres)} – Km${formatChainage(span.endMetres)}, ${span.row.line}, ${span.row.rail}. Đoạn LWR: ${rail.code}. Khối lượng: ${Number((span.endMetres - span.startMetres).toFixed(3))} m ray.`];
  }).join("\n");
}

/** Báo cáo ngày ghi số lượng; nếu chưa nhập thì dùng nhân sự đã gán dự án. */
export function diaryManpowerDefaults(reports: Record<string, unknown>[], personnel: {
  employee_id: string; ho_ten: string; chuc_vu: string | null; trang_thai: string | null;
}[], managerId: string | null, journalWelders = 0, journalPeople: typeof personnel = []) {
  const roster = { cht: [] as string[], ky_su: [] as string[], workers: [] as string[] };
  // Báo cáo ngày chưa ghi nhân lực mà Nhật ký hàn có thợ hàn → chỉ tính những người làm việc trong ngày, không lấy cả danh sách dự án.
  const hasReportPeople = reports.some((row) => { const bag = row.nhan_luc as Record<string, unknown> | null; return bag && Object.values(bag).some((v) => Array.isArray(v) && v.length > 0); });
  const useJournalPeople = !hasReportPeople && journalPeople.length > 0;
  for (const person of new Map((useJournalPeople ? journalPeople : personnel).map((p) => [p.employee_id, p])).values()) {
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
    congNhan: String(Math.max(useJournalPeople ? 0 : journalWelders, workers.some((n) => n != null) ? workers.reduce<number>((sum, n) => sum + (n ?? 0), 0) : roster.workers.length)),
    nhanLucNguon: useJournalPeople
      ? `Theo những người làm việc trong ngày từ nhật ký hàn (${journalPeople.map((p) => p.ho_ten).join(", ")}); xếp nhóm theo chức vụ.`
      : journalWelders > 0
      ? `Công nhân tính từ nhật ký hàn trong ngày (${journalWelders} thợ hàn); lấy số lớn hơn giữa nhật ký và báo cáo ngày.`
      : fromReports
      ? "Theo báo cáo ngày của dự án; vai trò chưa nhập dùng nhân sự được gán. Số lượng lặp giữa hạng mục lấy mức cao nhất từng vai trò."
      : `Theo nhân sự được gán dự án. Ban chỉ huy: ${roster.cht.join(", ") || "chưa gán"}. Kỹ sư: ${roster.ky_su.join(", ") || "chưa gán"}. Mỗi người chỉ tính một nhóm.`,
  };
}

/** Mục 3 theo Báo cáo ngày (phần «Hôm nay»): mỗi hạng mục một dòng. Không có → "". */
export function diaryReportWorkText(reports: Record<string, unknown>[], dayWelds: DiaryWork[] = []): string {
  // Báo cáo ngày lưu mã hệ thống PQ-… (cắt "(+N)"); nhật ký chỉ in mã hiện trường của các mối hàn trong ngày theo công nghệ.
  const fieldCodes = (method: string) => dayWelds.filter((w) => w.cong_nghe_han === method)
    .map(diaryCode).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "vi", { numeric: true })).join(", ");
  return reports.flatMap((row) => {
    const qty = Number(row.hom_nay);
    const stored = String(row.ten_moi_han ?? "").trim();
    // Báo cáo ngày cắt danh sách «PQ-…, … (+N)»: in đủ mã hiện trường của mọi mối trong ngày, hết mối thì chấm.
    const cut = /PQ-|…|\(\+\d+\)/i.test(stored);
    const codes = (cut ? fieldCodes(/FBW/i.test(stored) ? "FBW" : /ATW/i.test(stored) ? "ATW" : "") : "") || stored.replace(/\s*…?\s*\(\+\d+\)/g, "").replace(/PQ-/gi, "");
    const name = String(row.hang_muc ?? "").trim()
      || (/FBW/i.test(stored) ? "Hàn chảy giáp mép" : /ATW/i.test(stored) ? "Hàn nhiệt nhôm" : "Công tác thi công");
    if (!name && !(qty > 0)) return [];
    const unit = String(row.don_vi ?? "").trim() || "mối hàn";
    const task = /^thi công/i.test(name) ? name : `Thi công ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
    return [`- ${task}${qty > 0 ? `, khối lượng ${qty} ${unit === "mối" ? "mối hàn" : unit}` : ""}${codes ? `; bao gồm mối số: ${codes}` : ""}.`];
  }).join("\n");
}

/** Mục 2.2 theo thiết bị đã ghi trong Báo cáo ngày (bo_phan "1. Máy hàn" / "2. …" / "3. Vật tư"). Không có → "". */
export function diaryReportEquipmentText(rows: { ten_thiet_bi: string | null; so_luong: number | string | null; bo_phan: string | null }[]): string {
  if (rows.length === 0) return "";
  const group = (r: { bo_phan: string | null }) => { const p = (r.bo_phan ?? "").trim(); return p.startsWith("1") ? 0 : p.startsWith("3") ? 2 : 1; };
  return ["1. Máy hàn", "2. Máy và thiết bị khác", "3. Vật tư"].map((title, i) => {
    const lines = rows.filter((r) => group(r) === i && (r.ten_thiet_bi ?? "").trim())
      .map((r) => `- ${i === 0 ? diaryMachineName((r.ten_thiet_bi ?? "").trim()) : (r.ten_thiet_bi ?? "").trim().replace(/^(.+?) \((.+)\)$/, (m, a, b) => a.trim().toLowerCase() === b.trim().toLowerCase() ? a : m)}${r.so_luong !== null && r.so_luong !== "" ? `: ${r.so_luong} bộ` : ""}`);
    // Máy hàn và máy / thiết bị khác: mỗi dòng một loại; vật tư gộp một dòng, ngăn bằng "; " (theo bản mẫu).
    if (i !== 2) return `${title}:\n${lines.join("\n")}`;
    return `${title}: ${lines.map((l) => l.slice(2)).join("; ")}`;
  }).join("\n");
}
