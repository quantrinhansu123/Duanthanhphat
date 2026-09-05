import type { Certificate, CertificateImageKey } from "@/data/certificates";
import {
  loadPersonnelCertificateRows,
  type PersonnelCertificateRow,
} from "@/lib/personnelCertificatesDb";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import { parseCertificateList } from "@/lib/weldingCertificates";

type CertificateDbStatus = "Còn hiệu lực" | "Hết hạn" | "Thu hồi";

type CertificateDbRow = {
  id: string;
  ten_chung_chi: string;
  ngay_cap: string | null;
  ngay_het_han: string | null;
  file_chung_chi: string | null;
  trang_thai: CertificateDbStatus;
  employee_id: string;
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
};

const CERTIFICATE_COLUMNS = [
  "id",
  "ten_chung_chi",
  "ngay_cap",
  "ngay_het_han",
  "file_chung_chi",
  "trang_thai",
  "employee_id",
].join(",");

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, "");
}

function imageKeyForTitle(title: string): CertificateImageKey {
  const value = normalize(title);
  if (value.includes("ndt") || value.includes("sieuam")) return "ndt";
  if (value.includes("antoan")) return "safety";
  if (value.includes("iso9606")) return "iso";
  if (value.includes("k922") || value.includes("k920") || value.includes("un5") || value.includes("vanhanhmay")) {
    return "machine";
  }
  if (value.includes("hang2") || value.includes("p50") || value.includes("p43")) return "welding-2";
  if (value.includes("thermit") || value.includes("aluminothermic") || value.includes("nhomnhiet") || value.includes("hang1")) {
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
    imageUrl: row.file_chung_chi || undefined,
  };
}

/** Tải hồ sơ chứng chỉ và luôn ghép bằng employee_id, không ghép bằng tên. */
export async function loadCertificateRegistry(): Promise<CertificateRegistry> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể tải liên kết chứng chỉ - nhân sự.");
  }

  const [personnelRows, certificateResult] = await Promise.all([
    loadPersonnelCertificateRows(),
    createClient().from("chung_chi").select(CERTIFICATE_COLUMNS).order("created_at", { ascending: false }),
  ]);
  if (certificateResult.error) throw new Error(formatSupabaseError(certificateResult.error));

  const personnel = personnelRows.map(personnelToOption);
  const personnelById = new Map(personnel.map((person) => [person.id, person]));
  const dbRows = (certificateResult.data ?? []) as unknown as CertificateDbRow[];
  const certificates: Certificate[] = [];
  const registeredKeys = new Set<string>();

  for (const row of dbRows) {
    const person = personnelById.get(row.employee_id);
    if (!person) continue;
    registeredKeys.add(`${person.id}:${normalize(row.ten_chung_chi)}`);
    certificates.push(dbRowToCertificate(row, person));
  }

  // Giữ lại toàn bộ chứng chỉ đang có trên hồ sơ nhân sự, kể cả khi migration
  // chuẩn hóa sang bảng chung_chi chưa được chạy.
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
 * Migration bắt buộc: supabase/lien_ket_chung_chi_nhan_su_moi_han.sql.
 */
export async function createPersonnelCertificates(input: CreatePersonnelCertificateInput) {
  if (!isSupabaseConfigured()) throw new Error("Chưa cấu hình Supabase nên không thể lưu chứng chỉ.");
  const dbStatus: CertificateDbStatus =
    input.status === "Thu hồi"
      ? "Thu hồi"
      : input.status === "Hết hạn"
        ? "Hết hạn"
        : "Còn hiệu lực";
  const { error } = await createClient().rpc("them_chung_chi_cho_nhan_su", {
    p_employee_ids: input.employeeIds,
    p_ten_chung_chi: input.title.trim(),
    p_ngay_cap: input.issuedAt || null,
    p_ngay_het_han: input.expiresAt || null,
    p_file_chung_chi: input.imageUrl?.trim() || null,
    p_trang_thai: dbStatus,
  });
  if (error) throw new Error(formatSupabaseError(error));
}
