import { formatScheduleDate, type MachineRunSchedule } from "@/data/machineAssignments";
import type { DailyFuelRow } from "@/lib/dailyFuelDb";

/** Số giờ hoạt động định mức trước khi cần chú ý thay dầu động cơ. */
export const ENGINE_OIL_BASE_HOURS = 250;

/** Tỷ lệ cộng thêm cho phép (+10% định mức → 275 giờ). */
export const ENGINE_OIL_ALLOWANCE_RATIO = 0.1;

/** Mốc giờ hoạt động cho phép tối đa để đổ dầu động cơ (+10% của 250 giờ = 275 giờ). */
export const ENGINE_OIL_MAX_HOURS = Math.round(
  ENGINE_OIL_BASE_HOURS * (1 + ENGINE_OIL_ALLOWANCE_RATIO),
);

/** Năng suất trung bình quy đổi (21 mối/ngày). */
export const ENGINE_OIL_AVG_WELDS_PER_DAY = 21;

/** Số giờ máy hoạt động trung bình trong ngày (8 giờ). */
export const ENGINE_OIL_HOURS_PER_DAY = 8;

/** Năng suất trung bình theo giờ (21 / 8 = 2.625, làm tròn hiển thị ~3 mối/giờ). */
export const ENGINE_OIL_WELDS_PER_HOUR =
  ENGINE_OIL_AVG_WELDS_PER_DAY / ENGINE_OIL_HOURS_PER_DAY;

/** Ngưỡng cảnh báo đỏ theo số mối tích lũy (250 giờ × 21/8 = 656.25 → 656 mối). */
export const ENGINE_OIL_RED_ALERT_WELDS = Math.floor(
  ENGINE_OIL_BASE_HOURS * ENGINE_OIL_WELDS_PER_HOUR,
);

/** Ngưỡng cảnh báo vàng sớm theo số mối (~91% mốc đỏ 656 mối). */
export const ENGINE_OIL_WARN_WELDS = 600;

/** Số mối tương đương tại mốc tối đa 275 giờ (~722 mối). */
export const ENGINE_OIL_MAX_WELDS = Math.round(
  ENGINE_OIL_MAX_HOURS * ENGINE_OIL_WELDS_PER_HOUR,
);

/** Alias giữ tương thích với mã gọi cũ. */
export const ENGINE_OIL_INTERVAL_HOURS = ENGINE_OIL_MAX_HOURS;
export const ENGINE_OIL_WARN_HOURS = ENGINE_OIL_BASE_HOURS;

export type EngineOilAlertLevel = "ok" | "warning" | "danger";

export type EngineOilMachineStatus = {
  machineId: string;
  machineCode: string;
  machineLabel: string;
  /** Tổng giờ hoạt động tích lũy sau lần đổ dầu động cơ gần nhất. */
  hours: number;
  /** Tổng số mối hàn tích lũy sau lần đổ dầu động cơ gần nhất. */
  welds: number;
  /** Số giờ quy đổi tương đương từ số mối hàn (số mối / 2.625). */
  estimatedHoursFromWelds: number;
  /** Ngày đổ dầu động cơ gần nhất (YYYY-MM-DD), null nếu chưa ghi nhận lần nào. */
  since: string | null;
  /** Số lít dầu động cơ của lần đổ gần nhất. */
  lastEngineOilLiters: number | null;
  /** Số giờ máy phát báo tại lần đổ dầu động cơ gần nhất. */
  lastGeneratorHours: number | null;
  /** Mức cảnh báo: ok (bình thường), warning (sắp đến hạn), danger (cảnh báo đỏ). */
  level: EngineOilAlertLevel;
  /** true khi chạm cảnh báo đỏ (>= 656 mối hoặc >= 275 giờ). */
  overdue: boolean;
  reachedRedWelds: boolean;
  reachedBaseHours: boolean;
  reachedMaxHours: boolean;
  /** % tiến độ theo tiêu chí cao hơn giữa giờ/275 và mối/656. */
  progressPercent: number;
  /** Mô tả ngắn lý do cảnh báo để hiển thị trên UI / bản in. */
  reason: string;
};

export type EngineOilWarning = EngineOilMachineStatus;

export function buildCodeToMachineIdMap(
  machines: Array<{ id: string; code: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of machines) {
    const code = item.code?.trim().toLowerCase();
    if (code && item.id) map.set(code, item.id);
  }
  return map;
}

export function resolveEngineOilMachineId(
  machineId: string,
  machineCode: string,
  codeToId: Map<string, string>,
): string {
  if (machineId && !machineId.startsWith("code:")) return machineId;
  const fromCode = codeToId.get(machineCode.trim().toLowerCase());
  if (fromCode) return fromCode;
  if (machineId.startsWith("code:")) {
    return codeToId.get(machineId.slice(5).trim().toLowerCase()) || machineId;
  }
  return machineId;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNum(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function buildReason(input: {
  level: EngineOilAlertLevel;
  reachedRedWelds: boolean;
  reachedMaxHours: boolean;
  reachedBaseHours: boolean;
  hours: number;
  welds: number;
}): string {
  if (input.level === "danger") {
    if (input.reachedMaxHours && input.reachedRedWelds) {
      return `Đã đạt ${formatNum(input.welds)}/${ENGINE_OIL_RED_ALERT_WELDS} mối và ${formatNum(input.hours)}/${ENGINE_OIL_MAX_HOURS} giờ — bắt buộc đổ dầu động cơ.`;
    }
    if (input.reachedMaxHours) {
      return `Đã đạt mốc tối đa ${ENGINE_OIL_MAX_HOURS} giờ (${formatNum(input.hours)} giờ) — cần đổ dầu động cơ ngay.`;
    }
    return `Cảnh báo đỏ: đã đạt ${formatNum(input.welds)}/${ENGINE_OIL_RED_ALERT_WELDS} mối — chuẩn bị đổ dầu khi chạm ~${ENGINE_OIL_MAX_HOURS} giờ.`;
  }
  if (input.level === "warning") {
    if (input.reachedBaseHours) {
      return `Đã đạt định mức ${ENGINE_OIL_BASE_HOURS} giờ (${formatNum(input.hours)}/${ENGINE_OIL_MAX_HOURS} giờ) — sắp đến hạn đổ dầu động cơ.`;
    }
    return `Sắp chạm ngưỡng đỏ ${ENGINE_OIL_RED_ALERT_WELDS} mối (${formatNum(input.welds)} mối) — theo dõi đổ dầu động cơ.`;
  }
  return `Bình thường (${formatNum(input.welds)}/${ENGINE_OIL_RED_ALERT_WELDS} mối · ${formatNum(input.hours)}/${ENGINE_OIL_MAX_HOURS} giờ).`;
}

/**
 * Tính trạng thái dầu động cơ cho từng máy dựa trên:
 * - Định mức 250 giờ, tối đa cho phép (+10%) = 275 giờ.
 * - Năng suất 21 mối / 8 giờ (2.625 mối/giờ) → cảnh báo đỏ khi đạt 656 mối.
 * - Chỉ cộng dồn lượt chạy sau ngày đổ dầu động cơ gần nhất (đổ dầu xong tự loại bỏ cảnh báo).
 */
export function computeEngineOilStatuses(
  schedules: MachineRunSchedule[],
  fuelRows: DailyFuelRow[],
  codeToMachineId: Map<string, string> = new Map(),
): EngineOilMachineStatus[] {
  type DailyUsage = { hours: number; welds: number };
  type LastFill = {
    date: string;
    engineOilLiters: number | null;
    generatorHours: number | null;
  };

  const usageByMachine = new Map<string, Map<string, DailyUsage>>();
  const codes = new Map<string, string>();
  const labels = new Map<string, string>();

  for (const row of schedules) {
    const id = resolveEngineOilMachineId(row.machineId, row.machineCode, codeToMachineId);
    const byDate = usageByMachine.get(id) ?? new Map<string, DailyUsage>();
    const prev = byDate.get(row.date) ?? { hours: 0, welds: 0 };
    byDate.set(row.date, {
      hours: prev.hours + (Number(row.operatingHours) || 0),
      welds: prev.welds + (Number(row.weldCount) || 0),
    });
    usageByMachine.set(id, byDate);
    if (!codes.has(id) && row.machineCode?.trim()) codes.set(id, row.machineCode.trim());
    if (!labels.has(id)) labels.set(id, row.machineName?.trim() || row.machineCode?.trim() || id);
  }

  const lastFillByMachine = new Map<string, LastFill>();
  for (const oil of fuelRows) {
    if (!((oil.engineOilLiters ?? 0) > 0)) continue;
    const id = resolveEngineOilMachineId(oil.machineId, oil.machineCode, codeToMachineId);
    const prev = lastFillByMachine.get(id);
    if (!prev || oil.date > prev.date) {
      lastFillByMachine.set(id, {
        date: oil.date,
        engineOilLiters: oil.engineOilLiters,
        generatorHours: oil.generatorHours,
      });
    }
    if (!codes.has(id) && oil.machineCode?.trim() && oil.machineCode !== "—") {
      codes.set(id, oil.machineCode.trim());
    }
    if (!labels.has(id)) {
      labels.set(id, oil.machineName?.trim() || oil.machineCode?.trim() || id);
    }
  }

  const allMachineIds = new Set<string>([
    ...usageByMachine.keys(),
    ...lastFillByMachine.keys(),
  ]);

  const statuses: EngineOilMachineStatus[] = [];

  for (const id of allMachineIds) {
    const byDate = usageByMachine.get(id);
    const lastFill = lastFillByMachine.get(id) ?? null;
    const since = lastFill?.date ?? null;

    let hours = 0;
    let welds = 0;
    if (byDate) {
      for (const [date, daily] of byDate) {
        if (since && date <= since) continue;
        hours += daily.hours;
        welds += daily.welds;
      }
    }

    hours = round1(hours);
    welds = Math.round(welds);
    const estimatedHoursFromWelds = round1(welds / ENGINE_OIL_WELDS_PER_HOUR);

    const reachedMaxHours = hours >= ENGINE_OIL_MAX_HOURS;
    const reachedRedWelds = welds >= ENGINE_OIL_RED_ALERT_WELDS;
    const reachedBaseHours = hours >= ENGINE_OIL_BASE_HOURS;
    const reachedWarnWelds = welds >= ENGINE_OIL_WARN_WELDS;

    const overdue = reachedMaxHours || reachedRedWelds;
    const level: EngineOilAlertLevel = overdue
      ? "danger"
      : reachedBaseHours || reachedWarnWelds
        ? "warning"
        : "ok";

    const progressPercent = Math.round(
      Math.max(
        (hours / ENGINE_OIL_MAX_HOURS) * 100,
        (welds / ENGINE_OIL_RED_ALERT_WELDS) * 100,
      ),
    );

    statuses.push({
      machineId: id,
      machineCode: codes.get(id) || id,
      machineLabel: labels.get(id) || codes.get(id) || id,
      hours,
      welds,
      estimatedHoursFromWelds,
      since,
      lastEngineOilLiters: lastFill?.engineOilLiters ?? null,
      lastGeneratorHours: lastFill?.generatorHours ?? null,
      level,
      overdue,
      reachedRedWelds,
      reachedBaseHours,
      reachedMaxHours,
      progressPercent,
      reason: buildReason({
        level,
        reachedRedWelds,
        reachedMaxHours,
        reachedBaseHours,
        hours,
        welds,
      }),
    });
  }

  const levelRank: Record<EngineOilAlertLevel, number> = {
    danger: 2,
    warning: 1,
    ok: 0,
  };

  return statuses.sort(
    (a, b) =>
      levelRank[b.level] - levelRank[a.level] ||
      b.progressPercent - a.progressPercent ||
      b.welds - a.welds ||
      b.hours - a.hours,
  );
}

/** Danh sách các máy đang có cảnh báo dầu động cơ (cảnh báo đỏ & sắp đến hạn). */
export function engineOilWarnings(
  schedules: MachineRunSchedule[],
  fuelRows: DailyFuelRow[],
  codeToMachineId: Map<string, string> = new Map(),
): EngineOilWarning[] {
  return computeEngineOilStatuses(schedules, fuelRows, codeToMachineId).filter(
    (item) => item.level !== "ok",
  );
}

export function formatEngineOilWarningLine(item: EngineOilWarning): string {
  const sinceText = item.since
    ? `kể từ lần đổ dầu động cơ ${formatScheduleDate(item.since)}`
    : "chưa có lần đổ dầu động cơ";
  return `${item.machineLabel}: ${item.welds.toLocaleString("vi-VN")}/${ENGINE_OIL_RED_ALERT_WELDS} mối · ${item.hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/${ENGINE_OIL_MAX_HOURS} giờ (${sinceText}). ${item.reason}`;
}
