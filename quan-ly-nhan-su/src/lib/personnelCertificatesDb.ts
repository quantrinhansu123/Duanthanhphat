import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import { parseCertificateList } from "@/lib/weldingCertificates";
import type { CertifiedWelderOption } from "@/lib/weldReportData";

export type PersonnelCertificateRow = {
  employee_id: string;
  ma_nhan_su: string | null;
  ho_ten: string;
  chuc_vu: string | null;
  don_vi: string | null;
  to_han: string | null;
  chung_chi: string[] | null;
  kinh_nghiem: string | null;
  cap_bac: string | null;
  loai_ray: string | null;
  loai_may: string | null;
  hinh_anh: string | null;
  trang_thai: string | null;
};

const PERSONNEL_CERTIFICATE_COLUMNS = [
  "employee_id",
  "ma_nhan_su",
  "ho_ten",
  "chuc_vu",
  "don_vi",
  "to_han",
  "chung_chi",
  "kinh_nghiem",
  "cap_bac",
  "loai_ray",
  "loai_may",
  "hinh_anh",
  "trang_thai",
].join(",");

export async function loadPersonnelCertificateRows(): Promise<PersonnelCertificateRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createClient();
  const rows: PersonnelCertificateRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select(PERSONNEL_CERTIFICATE_COLUMNS)
      .order("ho_ten", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as unknown as PersonnelCertificateRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function loadPersonnelCertificateOptions(): Promise<CertifiedWelderOption[]> {
  const rows = await loadPersonnelCertificateRows();
  return rows.map((row) => ({
    id: row.employee_id,
    label: row.ho_ten,
    certificates: parseCertificateList(row.chung_chi),
  }));
}

export async function updatePersonnelCertificates(employeeId: string, certificates: string[]) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể lưu chứng chỉ.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("nhan_su")
    .update({ chung_chi: parseCertificateList(certificates) })
    .eq("employee_id", employeeId);

  if (error) throw new Error(formatSupabaseError(error));
}

/** Gán / cập nhật danh sách máy đã đào tạo (loai_may) cho nhân sự. */
export async function updatePersonnelTrainedMachines(employeeId: string, trainedMachines: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể lưu máy đã đào tạo.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("nhan_su")
    .update({ loai_may: trainedMachines.trim() || null })
    .eq("employee_id", employeeId);

  if (error) throw new Error(formatSupabaseError(error));
}

export type PersonnelUpsertInput = {
  employeeId?: string;
  maNhanSu: string;
  hoTen: string;
  chucVu?: string;
  donVi?: string;
  toHan?: string;
  capBac?: string;
  loaiRay?: string;
  chungChi?: string[];
  loaiMay?: string;
  kinhNghiem?: string;
  hinhAnh?: string;
  trangThai?: string;
};

function toNullable(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function upsertPersonnel(input: PersonnelUpsertInput): Promise<PersonnelCertificateRow> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể lưu hồ sơ thợ hàn.");
  }

  const hoTen = input.hoTen.trim();
  const maNhanSu = input.maNhanSu.trim();
  if (!hoTen) throw new Error("Vui lòng nhập họ tên thợ hàn.");
  if (!maNhanSu) throw new Error("Vui lòng nhập mã Welding ID.");

  const payload = {
    ma_nhan_su: maNhanSu,
    ho_ten: hoTen,
    chuc_vu: toNullable(input.chucVu) ?? "Thợ hàn",
    don_vi: toNullable(input.donVi),
    to_han: toNullable(input.toHan),
    cap_bac: toNullable(input.capBac),
    loai_ray: toNullable(input.loaiRay),
    ...(input.chungChi !== undefined ? { chung_chi: parseCertificateList(input.chungChi) } : {}),
    loai_may: toNullable(input.loaiMay),
    kinh_nghiem: toNullable(input.kinhNghiem),
    hinh_anh: toNullable(input.hinhAnh),
    trang_thai: input.trangThai === "Khóa" ? "Khóa" : "Hoạt động",
  };

  const supabase = createClient();
  const employeeId = input.employeeId?.trim() || crypto.randomUUID();

  if (input.employeeId?.trim()) {
    const { data, error } = await supabase
      .from("nhan_su")
      .update(payload)
      .eq("employee_id", employeeId)
      .select(PERSONNEL_CERTIFICATE_COLUMNS)
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return data as unknown as PersonnelCertificateRow;
  }

  const { data, error } = await supabase
    .from("nhan_su")
    .insert({ employee_id: employeeId, ...payload })
    .select(PERSONNEL_CERTIFICATE_COLUMNS)
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as unknown as PersonnelCertificateRow;
}

export async function deletePersonnel(employeeId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể xóa hồ sơ thợ hàn.");
  }
  if (!employeeId.trim()) throw new Error("Thiếu mã nhân sự để xóa.");

  const supabase = createClient();
  const { error } = await supabase.from("nhan_su").delete().eq("employee_id", employeeId);
  if (error) throw new Error(formatSupabaseError(error));
}

export function parseTrainedMachineTokens(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeRailToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("vi")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Doi chieu danh sach loai ray cua tho han (loai_ray, dang text tu do) voi
 * danh muc cau hinh he thong. Tra ve:
 *  - matched: nhan loai ray dung theo cau hinh
 *  - unmatched: token khong khop danh muc nao (giu nguyen de khong mat du lieu)
 */
export function resolveRailTokensToConfig(
  loaiRay: string | null | undefined,
  configOptions: string[],
): { matched: string[]; unmatched: string[] } {
  const optionByNorm = new Map<string, string>();
  for (const opt of configOptions) {
    const norm = normalizeRailToken(opt);
    if (norm && !optionByNorm.has(norm)) optionByNorm.set(norm, opt);
  }
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const token of parseTrainedMachineTokens(loaiRay)) {
    const norm = normalizeRailToken(token);
    if (!norm || norm === "CHUACAPNHAT") continue;
    const hit = optionByNorm.get(norm);
    if (hit) {
      if (!matched.includes(hit)) matched.push(hit);
    } else if (!unmatched.includes(token)) {
      unmatched.push(token);
    }
  }
  return { matched, unmatched };
}

/** Kiểm tra thợ hàn có được phép hàn loại ray (theo hồ sơ loai_ray). */
export function personAllowedOnRail(
  loaiRay: string | null | undefined,
  railType: string,
): boolean {
  const target = normalizeRailToken(railType);
  if (!target) return false;
  const tokens = parseTrainedMachineTokens(loaiRay)
    .map(normalizeRailToken)
    .filter((token) => token && token !== "CHUACAPNHAT");
  if (tokens.length === 0) return false;
  return tokens.some(
    (token) => token === target || token.includes(target) || target.includes(token),
  );
}

export function personTrainedOnMachine(
  loaiMay: string | null | undefined,
  machine: { code: string; model?: string },
): boolean {
  const tokens = parseTrainedMachineTokens(loaiMay).map((t) => t.toLowerCase());
  if (tokens.length === 0) return false;
  const code = machine.code.trim().toLowerCase();
  const model = machine.model?.trim().toLowerCase() ?? "";
  const modelKey = model.replace(/\(.*?\)/g, "").trim();
  return tokens.some((token) => {
    if (!token || token === "chưa cập nhật") return false;
    if (token === code || (model && token === model) || (modelKey && token === modelKey)) return true;
    if (code.includes(token) || token.includes(code)) return true;
    if (modelKey && (modelKey.includes(token) || token.includes(modelKey))) return true;
    return false;
  });
}

export function appendTrainedMachineToken(existing: string | null | undefined, token: string): string {
  const next = token.trim();
  const current = parseTrainedMachineTokens(existing);
  if (!next) return current.join(", ");
  if (current.some((item) => item.toLowerCase() === next.toLowerCase())) {
    return current.join(", ");
  }
  return [...current, next].join(", ");
}
