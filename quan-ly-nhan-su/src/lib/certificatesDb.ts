import type { Certificate, CertificateImageKey } from "@/data/certificates";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import { parseCertificateList } from "@/lib/weldingCertificates";

type CertificateDbStatus = "Còn hiệu lực" | "Hết hạn" | "Thu hồi";

export type CertificateDbRow = {
  id: string;
  ten_chung_chi: string;
  ngay_cap: string | null;
  ngay_het_han: string | null;
  file_chung_chi: string | null;
  trang_thai: CertificateDbStatus;
  employee_id: string;
  nhom_id?: string | null;
  don_vi_cap?: string | null;
  so_chung_chi?: string | null;
  may_ap_dung?: string | null;
  ghi_chu?: string | null;
  cloudinary_public_id?: string | null;
  secure_url?: string | null;
  kich_thuoc?: number | null;
  source_url?: string | null;
  license?: string | null;
};

export type CertificatePersonnelOption = {
  id: string;
  code: string;
  name: string;
  team: string;
  certificates: string[];
};

export type CertificateRegistry = {
  certificates: Certificate[];
  personnel: CertificatePersonnelOption[];
};

export type CreatePersonnelCertificateInput = {
  title: string;
  employeeIds: string[];
  issuedAt: string;
  expiresAt: string;
  status: Certificate["status"];
  imageUrl?: string;
  cloudinaryPublicId?: string;
  organization?: string;
  machine?: string;
  certificateNumber?: string;
  notes?: string;
  nhomId?: string;
  fileSize?: number;
  sourceUrl?: string;
  license?: string;
};

export type UpdateCertificateInput = {
  id: string;
  title: string;
  issuedAt?: string;
  expiresAt?: string;
  status: Certificate["status"];
  imageUrl?: string;
  cloudinaryPublicId?: string;
  organization?: string;
  machine?: string;
  certificateNumber?: string;
  notes?: string;
  fileSize?: number;
  sourceUrl?: string;
  license?: string;
};

const CERTIFICATE_COLUMNS = [
  "id",
  "ten_chung_chi",
  "ngay_cap",
  "ngay_het_han",
  "file_chung_chi",
  "trang_thai",
  "employee_id",
  "nhom_id",
  "don_vi_cap",
  "so_chung_chi",
  "may_ap_dung",
  "ghi_chu",
  "cloudinary_public_id",
  "secure_url",
  "kich_thuoc",
  "source_url",
  "license",
].join(",");

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, "");
}

export function imageKeyForTitle(title: string): CertificateImageKey {
  const value = normalize(title);
  if (value.includes("ndt") || value.includes("sieuam")) return "ndt";
  if (value.includes("antoan")) return "safety";
  if (value.includes("iso9606")) return "iso";
  if (
    value.includes("k922") ||
    value.includes("k920") ||
    value.includes("un5") ||
    value.includes("vanhanhmay")
  ) {
    return "machine";
  }
  if (value.includes("hang2") || value.includes("p50") || value.includes("p43")) return "welding-2";
  if (
    value.includes("thermit") ||
    value.includes("aluminothermic") ||
    value.includes("nhomnhiet") ||
    value.includes("hang1")
  ) {
    return "welding-1";
  }
  return "default";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function certificateStatus(row: CertificateDbRow): Certificate["status"] {
  if (row.trang_thai === "Thu hồi") return "Thu hồi";
  if (row.trang_thai === "Hết hạn") return "Hết hạn";
  if (!row.ngay_het_han) return "Chưa cập nhật";

  const expiry = new Date(`${row.ngay_het_han.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (expiry.getTime() < today.getTime()) return "Hết hạn";
  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + 90);
  return expiry.getTime() <= warningDate.getTime() ? "Sắp hết hạn" : "Còn hiệu lực";
}

function personnelToOption(row: PersonnelCertificateRow): CertificatePersonnelOption {
  return {
    id: row.employee_id,
    code: row.ma_nhan_su?.trim() || "Chưa có mã",
    name: row.ho_ten,
    team: row.to_han?.trim() || "Chưa phân tổ",
    certificates: parseCertificateList(row.chung_chi),
  };
}

function dbRowToCertificate(
  row: CertificateDbRow,
  personnel: CertificatePersonnelOption,
): Certificate {
  return {
    id: row.id,
    title: row.ten_chung_chi,
    holder: personnel.name,
    employeeId: personnel.id,
    employeeCode: personnel.code,
    issuedAt: formatDate(row.ngay_cap),
    expiresAt: formatDate(row.ngay_het_han),
    status: certificateStatus(row),
    imageKey: imageKeyForTitle(row.ten_chung_chi),
    imageUrl: row.secure_url || row.file_chung_chi || undefined,
    cloudinaryPublicId: row.cloudinary_public_id || undefined,
    groupId: row.nhom_id || undefined,
    organization: row.don_vi_cap || undefined,
    machine: row.may_ap_dung || undefined,
    certificateNumber: row.so_chung_chi || undefined,
    notes: row.ghi_chu || undefined,
    fileSize: row.kich_thuoc ? Number(row.kich_thuoc) : undefined,
    sourceUrl: row.source_url || undefined,
    license: row.license || undefined,
  };
}

/** Tải hồ sơ chứng chỉ và luôn ghép bằng employee_id. */
export async function loadCertificateRegistry(): Promise<CertificateRegistry> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể tải liên kết chứng chỉ - nhân sự.");
  }

  const supabase = createClient();
  const [personnelRows, dbRows] = await Promise.all([
    loadPersonnelCertificateRows(),
    (async () => {
      const rows: CertificateDbRow[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("chung_chi")
          .select(CERTIFICATE_COLUMNS)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(formatSupabaseError(error));
        const page = (data ?? []) as unknown as CertificateDbRow[];
        rows.push(...page);
        if (page.length < pageSize) break;
      }
      return rows;
    })(),
  ]);

  const personnel = personnelRows.map(personnelToOption);
  const personnelById = new Map(personnel.map((person) => [person.id, person]));
  const certificates: Certificate[] = [];
  const registeredKeys = new Set<string>();

  for (const row of dbRows) {
    const person = personnelById.get(row.employee_id);
    if (!person) continue;
    registeredKeys.add(`${person.id}:${normalize(row.ten_chung_chi)}`);
    certificates.push(dbRowToCertificate(row, person));
  }

  for (const person of personnel) {
    person.certificates.forEach((title, index) => {
      const key = `${person.id}:${normalize(title)}`;
      if (registeredKeys.has(key)) return;
      certificates.push({
        id: `personnel:${person.id}:${index}`,
        title,
        holder: person.name,
        employeeId: person.id,
        employeeCode: person.code,
        issuedAt: "—",
        expiresAt: "—",
        status: "Chưa cập nhật",
        imageKey: imageKeyForTitle(title),
        inferred: true,
      });
    });
  }

  certificates.sort((a, b) =>
    a.holder.localeCompare(b.holder, "vi") || a.title.localeCompare(b.title, "vi"),
  );
  return { certificates, personnel };
}

/**
 * RPC ghi bảng chung_chi và mảng nhan_su.chung_chi trong cùng transaction.
 */
export async function createPersonnelCertificates(input: CreatePersonnelCertificateInput) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase nên không thể lưu chứng chỉ.");
  if (input.imageUrl && !input.imageUrl.startsWith("https://")) {
    throw new Error("Ảnh chứng chỉ phải là URL HTTPS đã tải lên Cloudinary.");
  }

  if (input.issuedAt && input.expiresAt && input.expiresAt < input.issuedAt) {
    throw new Error("Ngày hết hạn phải từ ngày cấp trở đi.");
  }

  const dbStatus: CertificateDbStatus =
    input.status === "Thu hồi"
      ? "Thu hồi"
      : input.status === "Hết hạn"
        ? "Hết hạn"
        : "Còn hiệu lực";

  const { error } = await createClient().rpc("them_nhom_chung_chi_cho_nhan_su", {
    p_employee_ids: input.employeeIds,
    p_ten_chung_chi: input.title.trim(),
    p_ngay_cap: input.issuedAt || null,
    p_ngay_het_han: input.expiresAt || null,
    p_file_chung_chi: input.imageUrl?.trim() || null,
    p_trang_thai: dbStatus,
    p_cloudinary_public_id: input.cloudinaryPublicId?.trim() || null,
    p_secure_url: input.imageUrl?.trim() || null,
    p_don_vi_cap: input.organization?.trim() || null,
    p_so_chung_chi: input.certificateNumber?.trim() || null,
    p_may_ap_dung: input.machine?.trim() || null,
    p_ghi_chu: input.notes?.trim() || null,
    p_kich_thuoc: input.fileSize || null,
    p_source_url: input.sourceUrl?.trim() || null,
    p_license: input.license?.trim() || null,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

/** Cập nhật chi tiết 1 chứng chỉ */
export async function updateCertificateRecord(input: UpdateCertificateInput) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  if (input.imageUrl && !input.imageUrl.startsWith("https://")) {
    throw new Error("Ảnh chứng chỉ phải là URL HTTPS đã tải lên Cloudinary.");
  }

  if (input.issuedAt && input.expiresAt && input.expiresAt < input.issuedAt) {
    throw new Error("Ngày hết hạn phải từ ngày cấp trở đi.");
  }

  const dbStatus: CertificateDbStatus =
    input.status === "Thu hồi"
      ? "Thu hồi"
      : input.status === "Hết hạn"
        ? "Hết hạn"
        : "Còn hiệu lực";

  const updatePayload: Record<string, unknown> = {
    ten_chung_chi: input.title.trim(),
    ngay_het_han: input.expiresAt || null,
    trang_thai: dbStatus,
    updated_at: new Date().toISOString(),
  };
  if (input.issuedAt !== undefined) updatePayload.ngay_cap = input.issuedAt || null;
  if (input.imageUrl !== undefined) {
    updatePayload.file_chung_chi = input.imageUrl.trim() || null;
    updatePayload.secure_url = input.imageUrl.trim() || null;
  }
  if (input.cloudinaryPublicId !== undefined) {
    updatePayload.cloudinary_public_id = input.cloudinaryPublicId.trim() || null;
  }
  if (input.organization !== undefined) updatePayload.don_vi_cap = input.organization.trim() || null;
  if (input.machine !== undefined) updatePayload.may_ap_dung = input.machine.trim() || null;
  if (input.certificateNumber !== undefined) {
    updatePayload.so_chung_chi = input.certificateNumber.trim() || null;
  }
  if (input.notes !== undefined) updatePayload.ghi_chu = input.notes.trim() || null;
  if (input.fileSize !== undefined) updatePayload.kich_thuoc = input.fileSize || null;
  if (input.sourceUrl !== undefined) updatePayload.source_url = input.sourceUrl.trim() || null;
  if (input.license !== undefined) updatePayload.license = input.license.trim() || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("chung_chi")
    .update(updatePayload)
    .eq("id", input.id);

  if (error) throw new Error(formatSupabaseError(error));
}

export type SyncGroupCertificatesInput = {
  groupId: string;
  title: string;
  employeeIds: string[];
  issuedAt?: string;
  expiresAt?: string;
  status: Certificate["status"];
  imageUrl?: string;
  cloudinaryPublicId?: string;
  organization?: string;
  machine?: string;
  certificateNumber?: string;
  notes?: string;
  fileSize?: number;
  sourceUrl?: string;
  license?: string;
};

/** Đồng bộ danh sách người sở hữu và thông tin của nhóm chứng chỉ */
export async function syncGroupCertificates(input: SyncGroupCertificatesInput) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  if (input.employeeIds.length === 0) {
    throw new Error("Nhóm chứng chỉ phải có ít nhất 1 người sở hữu.");
  }

  const dbStatus: CertificateDbStatus =
    input.status === "Thu hồi"
      ? "Thu hồi"
      : input.status === "Hết hạn"
        ? "Hết hạn"
        : "Còn hiệu lực";

  const { error } = await createClient().rpc("dong_bo_nhan_su_nhom_chung_chi", {
    p_nhom_id: input.groupId,
    p_ten_chung_chi: input.title.trim(),
    p_employee_ids: input.employeeIds,
    p_ngay_cap: input.issuedAt || null,
    p_ngay_het_han: input.expiresAt || null,
    p_file_chung_chi: input.imageUrl?.trim() || null,
    p_trang_thai: dbStatus,
    p_cloudinary_public_id: input.cloudinaryPublicId?.trim() || null,
    p_secure_url: input.imageUrl?.trim() || null,
    p_don_vi_cap: input.organization?.trim() || null,
    p_so_chung_chi: input.certificateNumber?.trim() || null,
    p_may_ap_dung: input.machine?.trim() || null,
    p_ghi_chu: input.notes?.trim() || null,
    p_kich_thuoc: input.fileSize || null,
    p_source_url: input.sourceUrl?.trim() || null,
    p_license: input.license?.trim() || null,
  });

  if (error) throw new Error(formatSupabaseError(error));
}

/** Cập nhật hạn cho toàn bộ người có cùng chứng chỉ / cùng nhóm */
export async function updateGroupExpiry(groupId: string | undefined, title: string, expiresAt: string) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  if (!expiresAt) throw new Error("Vui lòng chọn ngày hết hạn mới.");

  const { error } = await createClient().rpc("cap_nhat_han_nhom_chung_chi", {
    p_nhom_id: groupId || null,
    p_ten_chung_chi: title.trim(),
    p_ngay_het_han: expiresAt,
  });

  if (error) throw new Error(formatSupabaseError(error));
}

/** Thu hồi chứng chỉ (đổi trạng thái sang Thu hồi, không xóa dữ liệu) */
export async function revokeCertificateRecord(id: string) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  const supabase = createClient();
  const { error } = await supabase
    .from("chung_chi")
    .update({
      trang_thai: "Thu hồi",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Xóa hoàn toàn chứng chỉ khỏi DB */
export async function deleteCertificateRecord(id: string) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase.");
  const supabase = createClient();
  const { error } = await supabase.from("chung_chi").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Chỉ cho phép xóa asset khi không còn hồ sơ hoặc nhóm chứng chỉ nào tham chiếu. */
export async function isCertificateAssetReferenced(publicId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !publicId.trim()) return true;
  const supabase = createClient();
  const [certificateResult, groupResult] = await Promise.all([
    supabase.from("chung_chi").select("id").eq("cloudinary_public_id", publicId).limit(1),
    supabase.from("chung_chi_nhom").select("id").eq("cloudinary_public_id", publicId).limit(1),
  ]);
  if (certificateResult.error || groupResult.error) return true;
  return Boolean(certificateResult.data?.length || groupResult.data?.length);
}
