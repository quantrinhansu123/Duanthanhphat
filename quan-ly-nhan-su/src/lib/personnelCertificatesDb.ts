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
  created_at: string;
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
  "created_at",
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
      .order("created_at", { ascending: false })
      .order("employee_id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as unknown as PersonnelCertificateRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** Danh sách nhẹ cho form chọn nhân sự (dự án) — không kéo chứng chỉ/ảnh. */
export async function loadPersonnelPickerRows(): Promise<
  Pick<PersonnelCertificateRow, "employee_id" | "ho_ten" | "chuc_vu" | "ma_nhan_su" | "to_han">[]
> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const rows: Pick<PersonnelCertificateRow, "employee_id" | "ho_ten" | "chuc_vu" | "ma_nhan_su" | "to_han">[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select("employee_id,ho_ten,chuc_vu,ma_nhan_su,to_han")
      .order("ho_ten", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const page = (data ?? []) as Array<{
      employee_id: string;
      ho_ten: string;
      chuc_vu: string | null;
      ma_nhan_su: string | null;
      to_han: string | null;
    }>;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function loadPersonnelCertificateOptions(): Promise<CertifiedWelderOption[]> {
  const rows = await loadPersonnelCertificateRows();

  // Danh sách chứng chỉ của từng nhân sự đọc trực tiếp từ bảng chung_chi (nguồn "danh sách
  // chứng chỉ" trên trang /chung-chi). Cache nhan_su.chung_chi có thể cũ nên không dùng nữa;
  // chỉ loại chứng chỉ đã Thu hồi hoặc rõ ràng đã hết hạn.
  const byEmployee = await loadCertificateNamesByEmployee();

  return rows
    .map((row) => {
      // Gộp 2 nguồn: bảng chung_chi (chi tiết) + mảng cache nhan_su.chung_chi.
      // Nhiều nhân sự chỉ có chứng chỉ trong cache (import cũ, chưa tạo bản ghi chung_chi).
      const fromTable = byEmployee.map.get(row.employee_id) ?? [];
      const fromCache = parseCertificateList(row.chung_chi);
      const seen = new Set<string>();
      const certificates: string[] = [];
      for (const name of [...fromTable, ...fromCache]) {
        const key = name.trim().toLocaleLowerCase("vi");
        if (!name.trim() || seen.has(key)) continue;
        seen.add(key);
        certificates.push(name.trim());
      }
      certificates.sort((a, b) => a.localeCompare(b, "vi"));
      return { id: row.employee_id, label: row.ho_ten, certificates };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

/**
 * Tên chứng chỉ theo từng nhân sự, gộp từ cả hai bảng hồ sơ chứng chỉ đang tồn tại
 * trong dự án (`chung_chi` và `chung_chi_ho_so`). Bỏ chứng chỉ đã thu hồi / hết hạn.
 */
async function loadCertificateNamesByEmployee(): Promise<{ ok: boolean; map: Map<string, string[]> }> {
  const result = new Map<string, string[]>();
  if (!isSupabaseConfigured()) return { ok: false, map: result };

  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const pageSize = 1000;

  const add = (id: string | null, name: string | null | undefined, status: string | null, expiry: string | null) => {
    const key = id;
    const clean = name?.trim();
    if (!key || !clean) return;
    if (status === "Thu hồi" || status === "Hết hạn") return;
    if (expiry && expiry.slice(0, 10) < today) return;
    const list = result.get(key) ?? [];
    if (!list.some((x) => x.toLocaleLowerCase("vi") === clean.toLocaleLowerCase("vi"))) list.push(clean);
    result.set(key, list);
  };

  type CertRowUnknown = Record<string, unknown>;
  const readTable = async (table: "chung_chi" | "chung_chi_ho_so", idCol: string): Promise<boolean> => {
    try {
      for (let offset = 0; ; offset += pageSize) {
        const res = await supabase
          .from(table)
          .select("*")
          .range(offset, offset + pageSize - 1);
        if (res.error) return false; // bảng có thể không tồn tại trên môi trường này
        const page = (res.data ?? []) as CertRowUnknown[];
        for (const cert of page) {
          add(
            (cert[idCol] as string | null) ?? null,
            (cert.ten_chung_chi as string | null) ?? null,
            (cert.trang_thai as string | null) ?? null,
            (cert.ngay_het_han as string | null) ?? null,
          );
        }
        if (page.length < pageSize) return true;
      }
    } catch {
      return false;
    }
  };

  const okA = await readTable("chung_chi", "employee_id");
  const okB = await readTable("chung_chi_ho_so", "nhan_su_id");
  if (!okA && !okB) return { ok: false, map: new Map() };
  for (const list of result.values()) list.sort((a, b) => a.localeCompare(b, "vi"));
  return { ok: true, map: result };
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
