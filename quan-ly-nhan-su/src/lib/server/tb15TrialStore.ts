import "server-only";

import { checkTb15Ground, type GroundCheckInput } from "@/features/lwr/lib/tb15-ground";
import type { Step10Origin } from "@/features/lwr/lib/tb15-step10";
import type { Tb15Trial, Tb15TrialForm, Tb15TrialParameter, Tb15TrialSummary } from "@/features/lwr/lib/tb15-trial";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE = "tb15_tinh_thu";
const MISSING =
  "Bảng tb15_tinh_thu chưa có. Hãy chạy supabase/migration_20261127_tb15_tinh_thu.sql trong Supabase SQL Editor rồi thử lại.";
const SUMMARY_COLUMNS = "id, tieu_de, dat, nhiet_do_khoa, khi_hau, created_at";
const ORIGIN_KEYS = ["climate", "rail", "steel", "track", "seat", "scheme", "factor", "ballast", "fastener", "speed"] as const;

type TrialRow = {
  id: string;
  tieu_de: string;
  dat: boolean;
  nhiet_do_khoa: number | string | null;
  khi_hau: string | null;
  du_lieu_gan?: unknown;
  dau_vao?: unknown;
  ket_qua?: unknown;
  nguon?: unknown;
  thong_so?: unknown;
  created_at: string;
};

function missingTable(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message || "";
  const namesThisTable = new RegExp(TABLE, "i").test(message) && /schema cache|does not exist/i.test(message);
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist/i.test(message) ||
    /could not find the table/i.test(message) ||
    namesThisTable
  );
}

function raise(error: { message?: string; code?: string } | null): never {
  if (missingTable(error)) throw new Error(MISSING);
  const message = error?.message || "";
  if (error?.code === "PGRST204" || /thong_so/i.test(message)) {
    throw new Error("Bảng tb15_tinh_thu chưa có cột thông số đầu vào. Hãy chạy lại supabase/migration_20261127_tb15_tinh_thu.sql trong Supabase SQL Editor rồi thử lại.");
  }
  throw new Error(message || "Không ghi được bản lưu.");
}

function parametersFrom(value: unknown): Tb15TrialParameter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const text = typeof row.value === "string" ? row.value.trim() : "";
    if (!label || !text) return [];
    return [{ label: label.slice(0, 80), value: text.slice(0, 500) }];
  }).slice(0, 80);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function summaryOf(row: TrialRow): Tb15TrialSummary {
  return {
    id: row.id,
    title: row.tieu_de,
    createdAt: row.created_at,
    passed: Boolean(row.dat),
    lockTemperature: asNumber(row.nhiet_do_khoa),
    climate: row.khi_hau ?? "",
  };
}

function textOf(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function formFrom(value: unknown): Tb15TrialForm | null {
  const row = asRecord(value);
  const ballast = row.ballast === "khong" ? "khong" : row.ballast === "co" ? "co" : "";
  const place = row.place === "cau" ? "cau" : row.place === "nen" ? "nen" : "";
  const alignment = row.alignment === "cong" ? "cong" : row.alignment === "thang" ? "thang" : "";
  const gauge = row.gauge === 1000 || row.gauge === "1000" ? 1000 : row.gauge === 1435 || row.gauge === "1435" ? 1435 : 0;
  const vehicle = row.vehicle === "toa_xe" ? "toa_xe" : row.vehicle === "dau_may" ? "dau_may" : "";
  const climateMonth = Number(row.climateMonth);
  if (!ballast || !place || !alignment || !gauge || !vehicle || !Number.isInteger(climateMonth) || climateMonth < 1 || climateMonth > 12) {
    return null;
  }
  return {
    ballast, place, alignment, gauge, vehicle, climateMonth,
    radius: textOf(row.radius, 40),
    railCenterMm: textOf(row.railCenterMm, 40),
    cgLocomotiveMm: textOf(row.cgLocomotiveMm, 40),
    cgWagonMm: textOf(row.cgWagonMm, 40),
    khi_hau: textOf(row.khi_hau, 80),
    loai_ray: textOf(row.loai_ray, 80),
    mac_thep: textOf(row.mac_thep, 80),
    ket_cau_duong: textOf(row.ket_cau_duong, 80),
    do_cung_goi: textOf(row.do_cung_goi, 80),
    so_do_tai: textOf(row.so_do_tai, 80),
    mo_men_can: textOf(row.mo_men_can, 80),
    he_so_tai: textOf(row.he_so_tai, 80),
    on_dinh_nen: textOf(row.on_dinh_nen, 80),
    traction: textOf(row.traction, 20),
    riseMethod: textOf(row.riseMethod, 20),
    speed: textOf(row.speed, 40),
    cant: textOf(row.cant, 40),
    tolerance: textOf(row.tolerance, 40),
    adjustment: textOf(row.adjustment, 40),
    gap: textOf(row.gap, 40),
    extra: textOf(row.extra, 40),
    braking: textOf(row.braking, 40),
  };
}

function storedSheet(value: unknown): { parameters: Tb15TrialParameter[]; form: Tb15TrialForm | null } {
  if (Array.isArray(value)) return { parameters: parametersFrom(value), form: null };
  const row = asRecord(value);
  return { parameters: parametersFrom(row.parameters), form: formFrom(row.form) };
}

function trialOf(row: TrialRow): Tb15Trial {
  const sheet = storedSheet(row.thong_so);
  return {
    ...summaryOf(row),
    sourceLines: asLines(row.du_lieu_gan),
    parameters: sheet.parameters,
    form: sheet.form,
    input: asRecord(row.dau_vao) as GroundCheckInput,
    result: asRecord(row.ket_qua) as Tb15Trial["result"],
    origin: asRecord(row.nguon) as Step10Origin,
  };
}

function originFrom(value: unknown): Step10Origin {
  const source = asRecord(value);
  const origin: Step10Origin = {};
  for (const key of ORIGIN_KEYS) {
    const text = source[key];
    if (typeof text === "string" && text.trim()) origin[key] = text.trim().slice(0, 200);
  }
  return origin;
}

export async function listTrials(): Promise<Tb15TrialSummary[]> {
  const db = createAdminClient();
  const { data, error } = await db.from(TABLE).select(SUMMARY_COLUMNS).order("created_at", { ascending: false });
  if (error) raise(error);
  return ((data ?? []) as TrialRow[]).map(summaryOf);
}

export async function readTrial(id: string): Promise<Tb15Trial | null> {
  const db = createAdminClient();
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) raise(error);
  return data ? trialOf(data as TrialRow) : null;
}

export async function createTrial(raw: unknown): Promise<Tb15TrialSummary> {
  if (!raw || typeof raw !== "object") throw new Error("Thiếu dữ liệu tính thử.");
  const body = raw as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 120) throw new Error("Nhập tên bản lưu, tối đa 120 ký tự.");
  if (!body.input || typeof body.input !== "object" || Array.isArray(body.input)) {
    throw new Error("Thiếu đầu vào của phép tính.");
  }
  const sourceLines = asLines(body.sourceLines).map((line) => line.slice(0, 500)).slice(0, 12);
  const input = body.input as GroundCheckInput;
  const result = checkTb15Ground(input);
  const origin = originFrom(body.origin);
  const parameters = parametersFrom(body.parameters);
  const form = formFrom(body.form);
  const db = createAdminClient();
  const { data, error } = await db.from(TABLE).insert({
    tieu_de: title,
    dat: result.lockTemperature !== null,
    nhiet_do_khoa: result.lockTemperature,
    khi_hau: origin.climate ?? "",
    du_lieu_gan: sourceLines,
    dau_vao: input,
    ket_qua: result,
    nguon: origin,
    thong_so: { parameters, form },
  }).select(SUMMARY_COLUMNS).single();
  if (error) raise(error);
  return summaryOf(data as TrialRow);
}

export async function deleteTrial(id: string): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db.from(TABLE).delete().eq("id", id).select("id");
  if (error) raise(error);
  if (!data?.length) throw new Error("Bản lưu không còn.");
}
