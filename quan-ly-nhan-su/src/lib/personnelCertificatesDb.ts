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
].join(",");

export async function loadPersonnelCertificateRows(): Promise<PersonnelCertificateRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("nhan_su")
    .select(PERSONNEL_CERTIFICATE_COLUMNS)
    .order("ho_ten", { ascending: true });

  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as unknown as PersonnelCertificateRow[];
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
