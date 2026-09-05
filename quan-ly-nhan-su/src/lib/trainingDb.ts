import { createClient } from "@/lib/supabase/client";

export type DbTrainingAttendee = {
  id: string; // employee_id
  name: string;
  weldingId: string;
  role: string;
  result: "Đạt" | "Không đạt" | "Đang học";
  status: "Hoàn thành" | "Đang học" | "Không hoàn thành";
  certificateId?: string;
  certificateName?: string;
};

export type DbTrainingCourse = {
  id: string;
  title: string;
  trainer: string;
  trainerId?: string;
  date: string;
  duration: string;
  location: string;
  description: string;
  result: string;
  thumbnail: string;
  cloudinaryPublicId?: string | null;
  participantsCount: number;
  certificateGroupId?: string | null;
  certificateGroupName?: string | null;
  topics: string[];
  attendees?: DbTrainingAttendee[];
};

export type CertificateGroupOption = {
  id: string;
  name: string;
  code?: string;
  issuer?: string;
  machine?: string;
  issueDate?: string;
  expiryDate?: string;
};

export type TrainingPersonnelOption = {
  id: string;
  name: string;
  code: string;
  team: string;
  role: string;
};

export type SaveTrainingCourseInput = {
  id?: string;
  title: string;
  date?: string;
  duration?: string;
  location?: string;
  description?: string;
  trainerId?: string;
  trainerName?: string;
  result?: string;
  thumbnail?: string;
  cloudinaryPublicId?: string;
  certificateGroupId?: string;
  topics?: string[];
  attendees: {
    employeeId: string;
    result: "Đạt" | "Không đạt" | "Đang học";
    status?: "Hoàn thành" | "Đang học" | "Không hoàn thành";
  }[];
};

interface RawCourseListRow {
  id: string;
  ten_khoa_hoc: string;
  ngay?: string | null;
  thoi_luong?: string | null;
  dia_diem?: string | null;
  mo_ta?: string | null;
  ket_qua?: string | null;
  hinh_anh?: string | null;
  cloudinary_public_id?: string | null;
  nhom_chung_chi_id?: string | null;
  topics?: string[] | null;
  nguoi_dao_tao?: string | null;
}

interface RawAttendeeRow {
  id: string;
  employee_id: string;
  chung_chi_id?: string | null;
  ket_qua?: string | null;
  trang_thai?: string | null;
}

type RawCourseDetailRow = RawCourseListRow;

export function isSupabaseReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

async function fetchAllCourseRows(): Promise<RawCourseListRow[]> {
  const supabase = createClient();
  const pageSize = 1000;
  const rows: RawCourseListRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("dao_tao")
      .select(`
        id,
        ten_khoa_hoc,
        ngay,
        thoi_luong,
        dia_diem,
        mo_ta,
        ket_qua,
        hinh_anh,
        cloudinary_public_id,
        topics,
        nhom_chung_chi_id,
        nguoi_dao_tao
      `)
      .order("ngay", { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as RawCourseListRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

async function fetchAllAttendeeCourseIds(): Promise<string[]> {
  const supabase = createClient();
  const pageSize = 1000;
  const courseIds: string[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("dao_tao_hoc_vien")
      .select("dao_tao_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    courseIds.push(...page.map((row) => row.dao_tao_id));
    if (page.length < pageSize) break;
  }

  return courseIds;
}

async function fetchCourseAttendeeRows(courseId: string): Promise<RawAttendeeRow[]> {
  const supabase = createClient();
  const pageSize = 1000;
  const attendees: RawAttendeeRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("dao_tao_hoc_vien")
      .select("id, employee_id, ket_qua, trang_thai, chung_chi_id")
      .eq("dao_tao_id", courseId)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as RawAttendeeRow[];
    attendees.push(...page);
    if (page.length < pageSize) break;
  }

  return attendees;
}

export async function fetchCertificateGroups(): Promise<CertificateGroupOption[]> {
  if (!isSupabaseReady()) return [];
  const supabase = createClient();
  const pageSize = 1000;
  const rows: {
    id: string;
    ten_nhom: string;
    ma_nhom: string | null;
    don_vi_cap: string | null;
    may_ap_dung: string | null;
    ngay_cap: string | null;
    ngay_het_han: string | null;
  }[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("chung_chi_nhom")
      .select("id, ten_nhom, ma_nhom, don_vi_cap, may_ap_dung, ngay_cap, ngay_het_han")
      .order("ten_nhom", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.ten_nhom,
    code: r.ma_nhom ?? undefined,
    issuer: r.don_vi_cap ?? undefined,
    machine: r.may_ap_dung ?? undefined,
    issueDate: r.ngay_cap ?? undefined,
    expiryDate: r.ngay_het_han ?? undefined,
  }));
}

export async function fetchTrainingPersonnelOptions(): Promise<TrainingPersonnelOption[]> {
  if (!isSupabaseReady()) return [];
  const supabase = createClient();
  const pageSize = 1000;
  const result: TrainingPersonnelOption[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select("employee_id, ho_ten, ma_nhan_su, to_han, chuc_vu")
      .order("ho_ten", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    result.push(...rows.map((row) => ({
      id: row.employee_id,
      name: row.ho_ten,
      code: row.ma_nhan_su?.trim() || "Chưa có mã",
      team: row.to_han?.trim() || "Chưa phân tổ",
      role: row.chuc_vu?.trim() || "Nhân sự",
    })));
    if (rows.length < pageSize) break;
  }

  return result;
}

export async function fetchTrainingCourses(): Promise<{
  courses: DbTrainingCourse[];
  error?: string;
}> {
  if (!isSupabaseReady()) {
    return { courses: [], error: "Chưa cấu hình Supabase env" };
  }

  let rawList: RawCourseListRow[];
  let personnel: TrainingPersonnelOption[];
  let certificateGroups: CertificateGroupOption[];
  let attendeeCourseIds: string[];
  try {
    [rawList, personnel, certificateGroups, attendeeCourseIds] = await Promise.all([
      fetchAllCourseRows(),
      fetchTrainingPersonnelOptions(),
      fetchCertificateGroups(),
      fetchAllAttendeeCourseIds(),
    ]);
  } catch (error) {
    return { courses: [], error: error instanceof Error ? error.message : "Không tải được dữ liệu đào tạo" };
  }

  const personnelById = new Map(personnel.map((person) => [person.id, person]));
  const groupById = new Map(certificateGroups.map((group) => [group.id, group]));
  const attendeeCounts = new Map<string, number>();
  for (const courseId of attendeeCourseIds) {
    attendeeCounts.set(courseId, (attendeeCounts.get(courseId) ?? 0) + 1);
  }

  const courses: DbTrainingCourse[] = rawList.map((row) => {
    const trainer = row.nguoi_dao_tao ? personnelById.get(row.nguoi_dao_tao) : undefined;
    const certificateGroup = row.nhom_chung_chi_id
      ? groupById.get(row.nhom_chung_chi_id)
      : undefined;

    return {
      id: row.id,
      title: row.ten_khoa_hoc,
      trainer: trainer?.name ?? "Chưa chỉ định",
      trainerId: trainer?.id,
      date: row.ngay ? new Date(row.ngay + "T00:00:00").toLocaleDateString("vi-VN") : "Chưa cập nhật",
      duration: row.thoi_luong || "0:00",
      location: row.dia_diem || "Chưa cập nhật",
      description: row.mo_ta || "",
      result: row.ket_qua || "Đạt",
      thumbnail:
        row.hinh_anh ||
        "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
      cloudinaryPublicId: row.cloudinary_public_id,
      participantsCount: attendeeCounts.get(row.id) ?? 0,
      certificateGroupId: row.nhom_chung_chi_id,
      certificateGroupName: certificateGroup?.name,
      topics: row.topics || [],
      attendees: [],
    };
  });

  return { courses };
}

export async function fetchTrainingCourseDetail(courseId: string): Promise<{
  course?: DbTrainingCourse;
  error?: string;
}> {
  if (!isSupabaseReady()) return { error: "Chưa cấu hình Supabase" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("dao_tao")
    .select(`
      id,
      ten_khoa_hoc,
      ngay,
      thoi_luong,
      dia_diem,
      mo_ta,
      ket_qua,
      hinh_anh,
      cloudinary_public_id,
      topics,
      nhom_chung_chi_id,
      nguoi_dao_tao
    `)
    .eq("id", courseId)
    .single();

  if (error || !data) return { error: error?.message || "Không tìm thấy khóa đào tạo" };

  const row = data as unknown as RawCourseDetailRow;
  let rawAttendees: RawAttendeeRow[];
  let personnel: TrainingPersonnelOption[];
  let certificateGroups: CertificateGroupOption[];
  try {
    [rawAttendees, personnel, certificateGroups] = await Promise.all([
      fetchCourseAttendeeRows(courseId),
      fetchTrainingPersonnelOptions(),
      fetchCertificateGroups(),
    ]);
  } catch (detailError) {
    return {
      error: detailError instanceof Error
        ? detailError.message
        : "Không tải được chi tiết khóa đào tạo",
    };
  }

  const certificateIds = rawAttendees
    .map((attendee) => attendee.chung_chi_id)
    .filter((id): id is string => Boolean(id));
  const certificates: { id: string; ten_chung_chi: string }[] = [];
  const uniqueCertificateIds = [...new Set(certificateIds)];
  for (let index = 0; index < uniqueCertificateIds.length; index += 100) {
    const { data: certificatePage, error: certificateError } = await supabase
      .from("chung_chi")
      .select("id, ten_chung_chi")
      .in("id", uniqueCertificateIds.slice(index, index + 100));
    if (certificateError) return { error: certificateError.message };
    certificates.push(...(certificatePage ?? []));
  }

  const personnelById = new Map(personnel.map((person) => [person.id, person]));
  const certificateById = new Map(
    certificates.map((certificate) => [certificate.id, certificate.ten_chung_chi]),
  );
  const groupById = new Map(certificateGroups.map((group) => [group.id, group]));
  const attendees: DbTrainingAttendee[] = rawAttendees.map((attendee) => {
    const person = personnelById.get(attendee.employee_id);
    return {
      id: attendee.employee_id,
      name: person?.name || "—",
      weldingId: person?.code || "—",
      role: person?.role || "Nhân sự",
      result: (attendee.ket_qua as DbTrainingAttendee["result"]) || "Đang học",
      status: (attendee.trang_thai as DbTrainingAttendee["status"]) || "Đang học",
      certificateId: attendee.chung_chi_id || undefined,
      certificateName: attendee.chung_chi_id
        ? certificateById.get(attendee.chung_chi_id)
        : undefined,
    };
  });
  const trainer = row.nguoi_dao_tao ? personnelById.get(row.nguoi_dao_tao) : undefined;
  const certificateGroup = row.nhom_chung_chi_id
    ? groupById.get(row.nhom_chung_chi_id)
    : undefined;

  const course: DbTrainingCourse = {
    id: row.id,
    title: row.ten_khoa_hoc,
    trainer: trainer?.name ?? "Chưa chỉ định",
    trainerId: trainer?.id,
    date: row.ngay ? new Date(row.ngay + "T00:00:00").toLocaleDateString("vi-VN") : "Chưa cập nhật",
    duration: row.thoi_luong || "0:00",
    location: row.dia_diem || "Chưa cập nhật",
    description: row.mo_ta || "",
    result: row.ket_qua || "Đạt",
    thumbnail:
      row.hinh_anh ||
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=480&h=270&q=80",
    cloudinaryPublicId: row.cloudinary_public_id,
    participantsCount: attendees.length,
    certificateGroupId: row.nhom_chung_chi_id,
    certificateGroupName: certificateGroup?.name,
    topics: row.topics || [],
    attendees,
  };

  return { course };
}

export async function saveTrainingCourse(input: SaveTrainingCourseInput): Promise<{
  id?: string;
  error?: string;
}> {
  if (!isSupabaseReady()) return { error: "Chưa cấu hình Supabase" };
  if (input.thumbnail && !input.thumbnail.startsWith("https://")) {
    return { error: "Ảnh khóa đào tạo phải là URL HTTPS đã tải lên Cloudinary." };
  }

  const supabase = createClient();

  // Gọi RPC transaction luu_khoa_dao_tao_va_cap_chung_chi
  const formattedAttendees = input.attendees.map((a) => ({
    employee_id: a.employeeId,
    ket_qua: a.result,
    trang_thai:
      a.status ||
      (a.result === "Đạt" ? "Hoàn thành" : a.result === "Không đạt" ? "Không hoàn thành" : "Đang học"),
  }));

  const { data, error } = await supabase.rpc("luu_khoa_dao_tao_va_cap_chung_chi", {
    p_dao_tao_id: input.id || null,
    p_ten_khoa_hoc: input.title.trim(),
    p_ngay: input.date || null,
    p_thoi_luong: input.duration?.trim() || null,
    p_dia_diem: input.location?.trim() || null,
    p_mo_ta: input.description?.trim() || null,
    p_nguoi_dao_tao: input.trainerId || null,
    p_ket_qua_khoa: input.result || "Đạt",
    p_hinh_anh: input.thumbnail || null,
    p_cloudinary_public_id: input.cloudinaryPublicId || null,
    p_secure_url: input.thumbnail || null,
    p_nhom_chung_chi_id: input.certificateGroupId || null,
    p_topics: input.topics || [],
    p_hoc_vien: formattedAttendees,
  });

  if (error) {
    return { error: error.message };
  }

  return { id: data as string };
}

export async function deleteTrainingCourse(courseId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isSupabaseReady()) return { success: false, error: "Chưa cấu hình Supabase" };

  const supabase = createClient();
  const { error } = await supabase.from("dao_tao").delete().eq("id", courseId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function isTrainingAssetReferenced(publicId: string): Promise<boolean> {
  if (!isSupabaseReady() || !publicId.trim()) return true;
  const { data, error } = await createClient()
    .from("dao_tao")
    .select("id")
    .eq("cloudinary_public_id", publicId)
    .limit(1);
  if (error) return true;
  return Boolean(data?.length);
}
