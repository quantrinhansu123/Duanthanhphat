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
  /** Điểm đặt ảnh = giữa đoạn ngày. */
  metres: number;
  startMetres: number;
  endMetres: number;
  chainage: string | null;
  imageUrl: string | null;
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

type DayBucket = {
  date: string | null;
  project: string;
  metres: number[];
  machineVotes: Map<string, { count: number; machineId: string | null; machineCode: string; machineName: string }>;
  weldCodes: string[];
  startTimes: string[];
  endTimes: string[];
  lunchHours: number;
};

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
 * Gom theo ngày (+ dự án): mỗi ngày chỉ 1 ảnh đại diện + đoạn lý trình min→max để bôi màu.
 */
export function buildMachineOnTrack(
  welds: JournalWeld[],
  imageByKey: Record<string, string>,
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
        metres: [],
        machineVotes: new Map(),
        weldCodes: [],
        startTimes: [],
        endTimes: [],
        lunchHours: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.metres.push(weld.metres);
    if (bucket.weldCodes.length < 8) bucket.weldCodes.push(weld.code);
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
  }

  const out: MachineOnTrack[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.metres.length === 0) continue;
    let startMetres = bucket.metres[0];
    let endMetres = bucket.metres[0];
    for (const metres of bucket.metres) {
      if (metres < startMetres) startMetres = metres;
      if (metres > endMetres) endMetres = metres;
    }
    // Một mối đơn → đoạn tối thiểu ~20 m để vẫn nhìn thấy màu.
    if (endMetres - startMetres < 20) {
      const pad = (20 - (endMetres - startMetres)) / 2;
      startMetres = Math.max(0, startMetres - pad);
      endMetres = endMetres + pad;
    }
    const metres = (startMetres + endMetres) / 2;
    let best: { count: number; machineId: string | null; machineCode: string; machineName: string } | null = null;
    for (const vote of bucket.machineVotes.values()) {
      if (!best || vote.count > best.count) best = vote;
    }
    if (!best) continue;
    const imageUrl =
      (best.machineId && imageByKey[best.machineId])
      || (best.machineCode && imageByKey[best.machineCode])
      || null;
    const work = dayOperatingHours(bucket);
    out.push({
      id: `day:${key}`,
      machineId: best.machineId,
      machineCode: best.machineCode,
      machineName: best.machineName,
      metres,
      startMetres,
      endMetres,
      chainage: null,
      imageUrl,
      weldCode: bucket.weldCodes[0] ?? "",
      weldCount: bucket.metres.length,
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
  const tones = [
    { fill: "rgb(245 158 11 / 0.42)", ring: "rgb(217 119 6)" },
    { fill: "rgb(14 165 233 / 0.38)", ring: "rgb(2 132 199)" },
    { fill: "rgb(16 185 129 / 0.38)", ring: "rgb(5 150 105)" },
    { fill: "rgb(168 85 247 / 0.35)", ring: "rgb(126 34 206)" },
    { fill: "rgb(244 63 94 / 0.35)", ring: "rgb(225 29 72)" },
    { fill: "rgb(99 102 241 / 0.38)", ring: "rgb(79 70 229)" },
  ];
  return tones[((index % tones.length) + tones.length) % tones.length];
}
