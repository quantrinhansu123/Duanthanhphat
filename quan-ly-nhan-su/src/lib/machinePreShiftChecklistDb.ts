import {
  CHECKLIST_SHIFTS,
  emptyChecklistResults,
  mergeChecklistResults,
  type ChecklistConclusion,
  type ChecklistResults,
  type ChecklistShift,
} from "@/data/machinePreShiftChecklist";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

const LOCAL_KEY = "tp_kiem_tra_may_truoc_ca_v1";
const TABLE = "kiem_tra_may_truoc_ca";

export type PreShiftChecklistRecord = {
  id: string;
  date: string;
  shift: ChecklistShift;
  machineId: string;
  machineCode: string;
  machineName: string;
  projectId: string;
  projectName: string;
  location: string;
  chainage: string;
  inspectorId: string;
  inspectorName: string;
  shiftLeadId: string;
  shiftLeadName: string;
  results: ChecklistResults;
  naReason: string;
  failItemCode: string;
  failDescription: string;
  remedy: string;
  recheckAt: string;
  conclusion: ChecklistConclusion | "";
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PreShiftChecklistFormValues = Omit<
  PreShiftChecklistRecord,
  "id" | "createdAt" | "updatedAt"
>;

type TableRow = {
  id: string;
  ngay: string;
  ca: string;
  may_id: string;
  may_ma: string | null;
  may_ten: string | null;
  du_an_id: string | null;
  du_an_ten: string | null;
  dia_diem: string | null;
  ly_trinh: string | null;
  nguoi_kiem_tra_id: string | null;
  nguoi_kiem_tra_ten: string | null;
  truong_ca_id: string | null;
  truong_ca_ten: string | null;
  ket_qua: unknown;
  ly_do_na: string | null;
  xu_ly_ma_muc: string | null;
  xu_ly_mo_ta: string | null;
  bien_phap_khac_phuc: string | null;
  kiem_tra_lai_luc: string | null;
  ket_luan: string | null;
  ghi_chu: string | null;
  created_at: string;
  updated_at: string;
};

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeShift(value: string | null | undefined): ChecklistShift {
  const raw = (value ?? "").trim();
  if ((CHECKLIST_SHIFTS as readonly string[]).includes(raw)) return raw as ChecklistShift;
  if (raw === "C1" || raw === "1") return "Ca 1";
  if (raw === "C2" || raw === "2" || raw === "C3" || raw === "3" || raw === "Ca 3") return "Ca 2";
  return "Ca 1";
}

function normalizeConclusion(value: string | null | undefined): ChecklistConclusion | "" {
  if (value === "du_dieu_kien" || value === "dung_van_hanh" || value === "cho_khac_phuc") return value;
  return "";
}

function rowToRecord(row: TableRow): PreShiftChecklistRecord {
  return {
    id: row.id,
    date: String(row.ngay ?? "").slice(0, 10),
    shift: normalizeShift(row.ca),
    machineId: row.may_id,
    machineCode: row.may_ma?.trim() || "—",
    machineName: row.may_ten?.trim() || "",
    projectId: row.du_an_id?.trim() || "",
    projectName: row.du_an_ten?.trim() || "",
    location: row.dia_diem?.trim() || "",
    chainage: row.ly_trinh?.trim() || "",
    inspectorId: row.nguoi_kiem_tra_id?.trim() || "",
    inspectorName: row.nguoi_kiem_tra_ten?.trim() || "",
    shiftLeadId: row.truong_ca_id?.trim() || "",
    shiftLeadName: row.truong_ca_ten?.trim() || "",
    results: mergeChecklistResults(row.ket_qua),
    naReason: row.ly_do_na?.trim() || "",
    failItemCode: row.xu_ly_ma_muc?.trim() || "",
    failDescription: row.xu_ly_mo_ta?.trim() || "",
    remedy: row.bien_phap_khac_phuc?.trim() || "",
    recheckAt: toDatetimeLocal(row.kiem_tra_lai_luc),
    conclusion: normalizeConclusion(row.ket_luan),
    note: row.ghi_chu?.trim() || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function uuidOrNull(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
}

function valuesToPayload(values: PreShiftChecklistFormValues) {
  return {
    ngay: values.date,
    ca: normalizeShift(values.shift),
    may_id: values.machineId,
    may_ma: values.machineCode.trim() || null,
    may_ten: values.machineName.trim() || null,
    du_an_id: uuidOrNull(values.projectId),
    du_an_ten: values.projectName.trim() || null,
    dia_diem: values.location.trim() || null,
    ly_trinh: values.chainage.trim() || null,
    nguoi_kiem_tra_id: uuidOrNull(values.inspectorId),
    nguoi_kiem_tra_ten: values.inspectorName.trim() || null,
    truong_ca_id: uuidOrNull(values.shiftLeadId),
    truong_ca_ten: values.shiftLeadName.trim() || null,
    ket_qua: values.results,
    ly_do_na: values.naReason.trim() || null,
    xu_ly_ma_muc: values.failItemCode.trim() || null,
    xu_ly_mo_ta: values.failDescription.trim() || null,
    bien_phap_khac_phuc: values.remedy.trim() || null,
    kiem_tra_lai_luc: toDatetimeLocal(values.recheckAt) || null,
    ket_luan: values.conclusion || null,
    ghi_chu: values.note.trim() || null,
  };
}

function isMissingTable(message: string) {
  return /kiem_tra_may_truoc_ca|relation|does not exist|42P01|schema cache/i.test(message);
}

function readLocal(): PreShiftChecklistRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreShiftChecklistRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      ...row,
      shift: normalizeShift(row.shift),
      results: mergeChecklistResults(row.results),
      conclusion: normalizeConclusion(row.conclusion),
    }));
  } catch {
    return [];
  }
}

function writeLocal(rows: PreShiftChecklistRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

export function emptyPreShiftForm(partial?: Partial<PreShiftChecklistFormValues>): PreShiftChecklistFormValues {
  return {
    date: todayIsoLocal(),
    shift: "Ca 1",
    machineId: "",
    machineCode: "",
    machineName: "",
    projectId: "",
    projectName: "",
    location: "",
    chainage: "",
    inspectorId: "",
    inspectorName: "",
    shiftLeadId: "",
    shiftLeadName: "",
    results: emptyChecklistResults(),
    naReason: "",
    failItemCode: "",
    failDescription: "",
    remedy: "",
    recheckAt: "",
    conclusion: "",
    note: "",
    ...partial,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayIsoLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function nowDatetimeLocal() {
  return toDatetimeLocal(new Date());
}

export function toDatetimeLocal(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}T${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDatetimeLocal(parsed);
}

export function formatChecklistDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatChecklistTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatChecklistDateTime(value?: string) {
  const local = toDatetimeLocal(value);
  if (!local) return "";
  const [day, time] = local.split("T");
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y} ${time}`;
}

export async function loadPreShiftChecklists(): Promise<{
  rows: PreShiftChecklistRecord[];
  source: "supabase" | "local";
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { rows: readLocal(), source: "local" };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("ngay", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      const message = formatSupabaseError(error);
      if (isMissingTable(message)) {
        return {
          rows: readLocal(),
          source: "local",
          error:
            "Chưa đồng bộ Supabase — phiếu đang lưu trên máy này. Chạy migration_20261021_kiem_tra_may_truoc_ca.sql để lưu chung.",
        };
      }
      return { rows: readLocal(), source: "local", error: message };
    }
    return { rows: ((data ?? []) as TableRow[]).map(rowToRecord), source: "supabase" };
  } catch (error) {
    return { rows: readLocal(), source: "local", error: formatSupabaseError(error) };
  }
}

export async function upsertPreShiftChecklist(
  values: PreShiftChecklistFormValues,
  id?: string,
): Promise<PreShiftChecklistRecord> {
  const payload = valuesToPayload(values);
  if (!values.machineId) throw new Error("Chưa chọn máy");
  if (!values.date) throw new Error("Chưa chọn ngày");

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      if (id) {
        const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select("*").single();
        if (error) throw new Error(formatSupabaseError(error));
        return rowToRecord(data as TableRow);
      }
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(payload, { onConflict: "may_id,ngay,ca" })
        .select("*")
        .single();
      if (error) throw new Error(formatSupabaseError(error));
      return rowToRecord(data as TableRow);
    } catch (error) {
      const message = formatSupabaseError(error);
      if (!isMissingTable(message)) throw new Error(message);
    }
  }

  const now = new Date().toISOString();
  const local = readLocal();
  const existing = id
    ? local.find((row) => row.id === id)
    : local.find((row) => row.machineId === values.machineId && row.date === values.date && row.shift === values.shift);
  const record: PreShiftChecklistRecord = {
    ...values,
    id: existing?.id || uid(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  writeLocal([record, ...local.filter((row) => row.id !== record.id)]);
  return record;
}

export async function deletePreShiftChecklist(id: string) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) {
        const message = formatSupabaseError(error);
        if (!isMissingTable(message)) throw new Error(message);
      } else {
        return;
      }
    } catch (error) {
      const message = formatSupabaseError(error);
      if (!isMissingTable(message)) throw new Error(message);
    }
  }
  writeLocal(readLocal().filter((row) => row.id !== id));
}

export function recordToForm(row: PreShiftChecklistRecord): PreShiftChecklistFormValues {
  const { id: _id, createdAt: _created, updatedAt: _updated, ...form } = row;
  return {
    ...form,
    results: mergeChecklistResults(row.results),
  };
}
