import { machines as seedMachines } from "@/data/machines";
import { HOURS_PER_WELD_SHIFT } from "@/lib/machineRunSchedulesDb";
import { formatWeldWorkHours, weldWorkHours } from "@/lib/weldReportData";
import { supabase } from "@lwr/lib/supabase";
import type { JournalWeld } from "@lwr/types/weld";

/**
 * Một ngày làm việc trên sơ đồ: bôi màu cả đoạn lý trình có mối hàn,
 * chỉ hiện 1 ảnh máy đại diện (không chồng từng mối).
 */
export type MachineOnTrack = {
  id: string;
  machineId: string | null;
  machineCode: string;
  machineName: string;
  /** Điểm đặt ảnh = lý trình mối hàn cuối cùng trong ngày. */
  metres: number;
  startMetres: number;
  endMetres: number;
  chainage: string | null;
  imageUrl: string | null;
  /** Thợ hàn / công nhân gắn mối cuối ngày — ảnh cạnh máy. */
  welderId: string | null;
  welderName: string;
  welderImageUrl: string | null;
  /** Mã mối hàn cuối ngày (điểm gióng ảnh). */
  weldCode: string;
  weldCount: number;
  /** Tên dự án (nhật ký) — dùng bộ lọc. */
  project: string;
  /** YYYY-MM-DD; null = không rõ ngày. */
  date: string | null;
  /** Giờ hoạt động trong ngày (ước lượng từ giờ BĐ→KT hoặc 8h/ca). */
  operatingHours: number;
  /** Khoảng giờ làm hiển thị, vd. 07:00–16:00. */
  workTimeRange: string | null;
};

export function formatMachineDayHours(hours: number): string {
  return formatWeldWorkHours(hours) || `${hours} tiếng`;
}

/**
 * Cloudinary delivery: chèn e_background_removal để xóa nền (ảnh trong suốt).
 * Ảnh local / không phải Cloudinary giữ nguyên URL.
 */
export function machineCutoutUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith("cloudinary.com")) return raw;
    const parts = u.pathname.split("/");
    const uploadIdx = parts.findIndex((part) => part === "upload");
    if (uploadIdx < 0) return raw;
    const after = parts.slice(uploadIdx + 1);
    if (after.some((part) => part.includes("e_background_removal"))) return raw;
    const versionIdx = after.findIndex((part) => /^v\d+$/.test(part));
    const rest = versionIdx >= 0 ? after.slice(versionIdx) : after;
    parts.splice(uploadIdx + 1, after.length, "e_background_removal", "f_png", ...rest);
    u.pathname = parts.join("/");
    return u.toString();
  } catch {
    return raw;
  }
}

/** Cho phép URL máy từ Cloudinary hoặc ảnh tĩnh trong /may-han. */
export function safeMachineImageUrl(url: string | null | undefined): string | null {
  const cut = machineCutoutUrl(url);
  if (!cut) return null;
  if (cut.startsWith("/may-han/")) return cut;
  try {
    const u = new URL(cut);
    if (u.protocol === "https:" && u.hostname.endsWith("cloudinary.com")) return cut;
    return null;
  } catch {
    return null;
  }
}

/** Map id máy + mã máy → URL ảnh cover (đã sẵn sàng cutout). */
export async function loadMachineImageMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const seed of seedMachines) {
    const url = seed.weldingUnit?.coverImage || seed.image;
    if (!url) continue;
    if (seed.id) map[seed.id] = url;
    if (seed.code) map[seed.code] = url;
  }
  if (!supabase) return map;
  const { data, error } = await supabase
    .from("thiet_bi")
    .select("id,ma_may,hinh_anh");
  if (error || !data) return map;
  for (const row of data as { id: string; ma_may: string | null; hinh_anh: string | null }[]) {
    const url = (row.hinh_anh ?? "").trim();
    if (!url || url.endsWith(".svg") || url.includes("unsplash.com")) continue;
    if (row.id) map[row.id] = url;
    const code = (row.ma_may ?? "").trim();
    if (code) map[code] = url;
  }
  return map;
}

/** Cho phép URL ảnh nhân sự (https / data / đường dẫn tĩnh). */
export function safeWelderImageUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  if (raw.startsWith("data:image/")) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return raw;
    return null;
  } catch {
    return null;
  }
}

/** Map employee_id + tên (không phân biệt hoa thường) → ảnh hồ sơ. */
export async function loadWelderImageMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!supabase) return map;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select("employee_id,ho_ten,hinh_anh")
      .order("ho_ten", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error || !data) return map;
    const page = data as { employee_id: string; ho_ten: string | null; hinh_anh: string | null }[];
    for (const row of page) {
      const url = (row.hinh_anh ?? "").trim();
      if (!url || url.endsWith(".svg")) continue;
      if (row.employee_id) map[row.employee_id] = url;
      const name = (row.ho_ten ?? "").trim().toLocaleLowerCase("vi");
      if (name && !map[name]) map[name] = url;
    }
    if (page.length < pageSize) break;
  }
  return map;
}

type DayWeldPoint = {
  metres: number;
  code: string;
  startTime: string | null;
  endTime: string | null;
  welderId: string | null;
  welderName: string;
};

type DayBucket = {
  date: string | null;
  project: string;
  points: DayWeldPoint[];
  machineVotes: Map<string, { count: number; machineId: string | null; machineCode: string; machineName: string }>;
  welderVotes: Map<string, { count: number; welderId: string | null; welderName: string }>;
  startTimes: string[];
  endTimes: string[];
  lunchHours: number;
};

/** Mối cuối ngày: lý trình lớn nhất; cùng lý trình thì giờ kết thúc/bắt đầu muộn hơn. */
function pickLastWeldOfDay(points: DayWeldPoint[]): DayWeldPoint {
  return [...points].sort((a, b) => {
    if (a.metres !== b.metres) return a.metres - b.metres;
    const aTime = a.endTime || a.startTime || "";
    const bTime = b.endTime || b.startTime || "";
    return aTime.localeCompare(bTime);
  }).at(-1)!;
}

function dayOperatingHours(bucket: DayBucket): { hours: number; range: string | null } {
  const starts = [...bucket.startTimes].sort();
  const ends = [...bucket.endTimes].sort();
  if (starts.length > 0 && ends.length > 0) {
    const from = starts[0];
    const to = ends[ends.length - 1];
    const gross = weldWorkHours(from, to);
    if (gross != null && gross > 0) {
      const hours = Math.max(0, Math.round((gross - (bucket.lunchHours || 0)) * 100) / 100);
      return { hours: hours > 0 ? hours : HOURS_PER_WELD_SHIFT, range: `${from}–${to}` };
    }
  }
  return { hours: HOURS_PER_WELD_SHIFT, range: null };
}

/**
 * Gom theo ngày (+ dự án): mỗi ngày 1 ảnh máy + ảnh công nhân đại diện + đoạn lý trình.
 */
export function buildMachineOnTrack(
  welds: JournalWeld[],
  imageByKey: Record<string, string>,
  welderImageByKey: Record<string, string> = {},
): MachineOnTrack[] {
  const buckets = new Map<string, DayBucket>();

  for (const weld of welds) {
    if (weld.metres == null || !Number.isFinite(weld.metres)) continue;
    const machineId = weld.machineId?.trim() || null;
    const machineCode = weld.machineCode?.trim() || "";
    if (!machineId && !machineCode) continue;
    const date = weld.date?.slice(0, 10) || null;
    const project = weld.project?.trim() || "—";
    const key = `${date ?? "no-date"}|${project}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        date,
        project,
        points: [],
        machineVotes: new Map(),
        welderVotes: new Map(),
        startTimes: [],
        endTimes: [],
        lunchHours: 0,
      };
      buckets.set(key, bucket);
    }
    const welderId = weld.welderId?.trim() || null;
    const welderName = weld.welder?.trim() && weld.welder !== "—" ? weld.welder.trim() : "";
    bucket.points.push({
      metres: weld.metres,
      code: weld.code,
      startTime: weld.startTime ?? null,
      endTime: weld.endTime ?? null,
      welderId,
      welderName,
    });
    if (weld.startTime) bucket.startTimes.push(weld.startTime);
    if (weld.endTime) bucket.endTimes.push(weld.endTime);
    const lunch = Number(weld.lunchHours);
    if (Number.isFinite(lunch) && lunch > bucket.lunchHours) bucket.lunchHours = lunch;
    const voteKey = machineId || machineCode;
    const prev = bucket.machineVotes.get(voteKey);
    if (prev) {
      prev.count += 1;
      if (!prev.machineName && weld.machineName) prev.machineName = weld.machineName.trim();
    } else {
      bucket.machineVotes.set(voteKey, {
        count: 1,
        machineId,
        machineCode: machineCode || machineId || "?",
        machineName: weld.machineName?.trim() || machineCode || "Máy",
      });
    }
    if (welderId || welderName) {
      const welderKey = welderId || welderName.toLocaleLowerCase("vi");
      const prevWelder = bucket.welderVotes.get(welderKey);
      if (prevWelder) {
        prevWelder.count += 1;
        if (!prevWelder.welderName && welderName) prevWelder.welderName = welderName;
        if (!prevWelder.welderId && welderId) prevWelder.welderId = welderId;
      } else {
        bucket.welderVotes.set(welderKey, { count: 1, welderId, welderName: welderName || "Công nhân" });
      }
    }
  }

  const out: MachineOnTrack[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.points.length === 0) continue;
    let startMetres = bucket.points[0].metres;
    let endMetres = bucket.points[0].metres;
    for (const point of bucket.points) {
      if (point.metres < startMetres) startMetres = point.metres;
      if (point.metres > endMetres) endMetres = point.metres;
    }
    const last = pickLastWeldOfDay(bucket.points);
    // Đoạn màu: min→max thực; mối đơn → đệm nhẹ để nhìn thấy.
    let bandStart = startMetres;
    let bandEnd = endMetres;
    if (bandEnd - bandStart < 20) {
      const pad = (20 - (bandEnd - bandStart)) / 2;
      bandStart = Math.max(0, bandStart - pad);
      bandEnd = bandEnd + pad;
    }
    let best: { count: number; machineId: string | null; machineCode: string; machineName: string } | null = null;
    for (const vote of bucket.machineVotes.values()) {
      if (!best || vote.count > best.count) best = vote;
    }
    if (!best) continue;
    const imageUrl =
      (best.machineId && imageByKey[best.machineId])
      || (best.machineCode && imageByKey[best.machineCode])
      || null;
    // Ưu tiên thợ của mối cuối ngày (điểm gióng); không có thì lấy người hàn nhiều nhất.
    let welderId = last.welderId;
    let welderName = last.welderName;
    if (!welderId && !welderName) {
      let bestWelder: { count: number; welderId: string | null; welderName: string } | null = null;
      for (const vote of bucket.welderVotes.values()) {
        if (!bestWelder || vote.count > bestWelder.count) bestWelder = vote;
      }
      welderId = bestWelder?.welderId ?? null;
      welderName = bestWelder?.welderName ?? "";
    }
    const welderImageUrl =
      (welderId && welderImageByKey[welderId])
      || (welderName && welderImageByKey[welderName.toLocaleLowerCase("vi")])
      || null;
    const work = dayOperatingHours(bucket);
    out.push({
      id: `day:${key}`,
      machineId: best.machineId,
      machineCode: best.machineCode,
      machineName: best.machineName,
      metres: last.metres,
      startMetres: bandStart,
      endMetres: bandEnd,
      chainage: null,
      imageUrl,
      welderId,
      welderName: welderName || "—",
      welderImageUrl,
      weldCode: last.code,
      weldCount: bucket.points.length,
      project: bucket.project,
      date: bucket.date,
      operatingHours: work.hours,
      workTimeRange: work.range,
    });
  }

  return out.sort(
    (a, b) =>
      (a.date ?? "").localeCompare(b.date ?? "")
      || a.startMetres - b.startMetres
      || a.project.localeCompare(b.project, "vi"),
  );
}

/** Màu bôi đoạn theo thứ tự ngày (ổn định theo id). */
export function machineDayTone(index: number): { fill: string; ring: string } {
  /** Nhạt hơn để không át thanh LWR / mối hàn trên sơ đồ chính. */
  const tones = [
    { fill: "rgb(245 158 11 / 0.22)", ring: "rgb(217 119 6)" },
    { fill: "rgb(14 165 233 / 0.2)", ring: "rgb(2 132 199)" },
    { fill: "rgb(16 185 129 / 0.2)", ring: "rgb(5 150 105)" },
    { fill: "rgb(168 85 247 / 0.18)", ring: "rgb(126 34 206)" },
    { fill: "rgb(244 63 94 / 0.18)", ring: "rgb(225 29 72)" },
    { fill: "rgb(99 102 241 / 0.2)", ring: "rgb(79 70 229)" },
  ];
  return tones[((index % tones.length) + tones.length) % tones.length];
}
