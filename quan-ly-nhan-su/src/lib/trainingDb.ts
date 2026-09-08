import { createClient } from "@/lib/supabase/client";
import type { CloudinaryResourceType } from "@/lib/cloudinaryClient";

export type TrainingAsset = {
  publicId: string;
  secureUrl: string;
  resourceType: CloudinaryResourceType;
  name: string;
  mimeType?: string;
  bytes?: number;
};

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
  createdAt?: string;
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
  manufacturerHours: number;
  selfTrainingHours: number;
  certificateGroupId?: string | null;
  certificateGroupName?: string | null;
  topics: string[];
  attendees?: DbTrainingAttendee[];
  assets: TrainingAsset[];
};

export type CertificateGroupOption = {
  id: string;
  name: string;
  createdAt?: string;
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
  department: string;
};

export type DbTrainingHistoryRecord = {
  id: string;
  createdAt?: string;
  personCode: string;
  personName: string;
  personType: "Thợ hàn" | "Nhân sự khác";
  department: string;
  courseTitle: string;
  trainer: string;
  date: string;
  duration: string;
  result: "Đạt" | "Không đạt" | "Đang học";
  status: "Hoàn thành" | "Đang học" | "Không hoàn thành";
  certificate: string;
  certificateId?: string;
  certificateDate: string;
  manufacturerHours: number;
  selfTrainingHours: number;
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
  manufacturerHours?: number;
  selfTrainingHours?: number;
  participantsCount?: number;
  attendees: {
    employeeId: string;
    result: "Đạt" | "Không đạt" | "Đang học";
    status?: "Hoàn thành" | "Đang học" | "Không hoàn thành";
  }[];
  assets?: TrainingAsset[];
};

interface RawCourseListRow {
  id: string;
  created_at: string;
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
  nguoi_dao_tao_ten?: string | null;
  tai_lieu?: unknown;
  tong_gio_nha_san_xuat?: number | string | null;
  tong_gio_tu_dao_tao?: number | string | null;
  tong_nguoi_tham_gia?: number | string | null;
}

interface RawAttendeeRow {
  id: string;
  created_at: string;
  dao_tao_id: string;
  employee_id: string;
  chung_chi_id?: string | null;
  ket_qua?: string | null;
  trang_thai?: string | null;
}

type RawCourseDetailRow = RawCourseListRow;

const COURSE_COLUMNS_BASE = `
  id,
  created_at,
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
`;
const COURSE_COLUMNS_WITH_ASSETS = `${COURSE_COLUMNS_BASE},nguoi_dao_tao_ten,tai_lieu`;
const COURSE_COLUMNS_FULL = `${COURSE_COLUMNS_WITH_ASSETS},tong_gio_nha_san_xuat,tong_gio_tu_dao_tao,tong_nguoi_tham_gia`;

function toNonNegNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parseTrainingAssets(value: unknown): TrainingAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const publicId = String(row.publicId ?? row.public_id ?? "").trim();
    const secureUrl = String(row.secureUrl ?? row.secure_url ?? "").trim();
    const resourceType = String(row.resourceType ?? row.resource_type ?? "raw");
    if (!publicId || !secureUrl || !["image", "video", "raw"].includes(resourceType)) return [];
    return [{
      publicId,
      secureUrl,
      resourceType: resourceType as CloudinaryResourceType,
      name: String(row.name ?? row.original_filename ?? publicId.split("/").at(-1) ?? "Tài liệu"),
      mimeType: row.mimeType ? String(row.mimeType) : undefined,
      bytes: Number.isFinite(Number(row.bytes)) ? Number(row.bytes) : undefined,
    }];
  });
}

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
    const primary = await supabase
      .from("dao_tao")
      .select(COURSE_COLUMNS_FULL)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    let data: RawCourseListRow[] | null = primary.data as unknown as RawCourseListRow[] | null;
    let error = primary.error;
    if (error && (error.code === "42703" || error.code === "PGRST204" || error.message.includes("column"))) {
      const withAssets = await supabase
        .from("dao_tao")
        .select(COURSE_COLUMNS_WITH_ASSETS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      data = withAssets.data as unknown as RawCourseListRow[] | null;
      error = withAssets.error;
    }
    if (error && (error.code === "42703" || error.code === "PGRST204" || error.message.includes("column"))) {
      const fallback = await supabase
        .from("dao_tao")
        .select(COURSE_COLUMNS_BASE)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      data = fallback.data as unknown as RawCourseListRow[] | null;
      error = fallback.error;
    }
    if (error) throw new Error(error.message);
    const page = data ?? [];
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
      .select("dao_tao_id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
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
      .select("id, dao_tao_id, employee_id, ket_qua, trang_thai, chung_chi_id, created_at")
      .eq("dao_tao_id", courseId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
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
  const byId = new Map<string, CertificateGroupOption>();

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("chung_chi_nhom")
      .select("id, ten_nhom, ma_nhom, don_vi_cap, may_ap_dung, ngay_cap, ngay_het_han, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const r of page) {
      byId.set(r.id, {
        id: r.id,
        name: r.ten_nhom,
        createdAt: r.created_at,
        code: r.ma_nhom ?? undefined,
        issuer: r.don_vi_cap ?? undefined,
        machine: r.may_ap_dung ?? undefined,
        issueDate: r.ngay_cap ?? undefined,
        expiryDate: r.ngay_het_han ?? undefined,
      });
    }
    if (page.length < pageSize) break;
  }

  // Bổ sung nhóm đang dùng trên trang Chứng chỉ (bảng chung_chi)
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("chung_chi")
      .select("nhom_id, ten_chung_chi, don_vi_cap, may_ap_dung, ngay_cap, ngay_het_han, created_at")
      .not("nhom_id", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const r of page) {
      const id = r.nhom_id as string;
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        name: r.ten_chung_chi,
        createdAt: r.created_at,
        issuer: r.don_vi_cap ?? undefined,
        machine: r.may_ap_dung ?? undefined,
        issueDate: r.ngay_cap ?? undefined,
        expiryDate: r.ngay_het_han ?? undefined,
      });
    }
    if (page.length < pageSize) break;
  }

  return Array.from(byId.values()).sort(
    (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id),
  );
}

export async function fetchTrainingPersonnelOptions(): Promise<TrainingPersonnelOption[]> {
  if (!isSupabaseReady()) return [];
  const supabase = createClient();
  const pageSize = 1000;
  const result: TrainingPersonnelOption[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("nhan_su")
      .select("employee_id, ho_ten, ma_nhan_su, to_han, chuc_vu, don_vi")
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
      department: row.don_vi?.trim() || row.to_han?.trim() || "Chưa cập nhật",
    })));
    if (rows.length < pageSize) break;
  }

  return result;
}

async function fetchAllTrainingAttendees(): Promise<RawAttendeeRow[]> {
  const supabase = createClient();
  const pageSize = 1000;
  const attendees: RawAttendeeRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("dao_tao_hoc_vien")
      .select("id, dao_tao_id, employee_id, ket_qua, trang_thai, chung_chi_id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as RawAttendeeRow[];
    attendees.push(...page);
    if (page.length < pageSize) break;
  }

  return attendees;
}

function isWelder(person: TrainingPersonnelOption): boolean {
  const role = person.role.toLocaleLowerCase("vi");
  return role.includes("hàn") || person.team !== "Chưa phân tổ";
}

function formatTrainingDate(date?: string | null): string {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")
    : "Chưa cập nhật";
}

export async function fetchWelderTrainingHistory(): Promise<{
  records: DbTrainingHistoryRecord[];
  error?: string;
}> {
  if (!isSupabaseReady()) return { records: [], error: "Chưa cấu hình Supabase env" };

  let courses: RawCourseListRow[];
  let personnel: TrainingPersonnelOption[];
  let attendees: RawAttendeeRow[];
  try {
    [courses, personnel, attendees] = await Promise.all([
      fetchAllCourseRows(),
      fetchTrainingPersonnelOptions(),
      fetchAllTrainingAttendees(),
    ]);
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Không tải được lịch sử đào tạo",
    };
  }

  const certificateIds = [...new Set(
    attendees.map((attendee) => attendee.chung_chi_id).filter((id): id is string => Boolean(id)),
  )];
  const certificateById = new Map<string, { name: string; date: string; employeeId: string }>();
  if (certificateIds.length) {
    const supabase = createClient();
    for (let index = 0; index < certificateIds.length; index += 100) {
      const { data, error } = await supabase
        .from("chung_chi")
        .select("id, ten_chung_chi, ngay_cap, employee_id")
        .in("id", certificateIds.slice(index, index + 100));
      if (error) return { records: [], error: error.message };
      for (const certificate of data ?? []) {
        certificateById.set(certificate.id, {
          name: certificate.ten_chung_chi,
          date: formatTrainingDate(certificate.ngay_cap),
          employeeId: certificate.employee_id,
        });
      }
    }
  }

  const courseById = new Map(courses.map((course) => [course.id, course]));
  const personnelById = new Map(personnel.map((person) => [person.id, person]));
  const records = attendees.flatMap((attendee): DbTrainingHistoryRecord[] => {
    const course = courseById.get(attendee.dao_tao_id);
    const person = personnelById.get(attendee.employee_id);
    if (!course || !person) return [];
    const linkedCertificate = attendee.chung_chi_id ? certificateById.get(attendee.chung_chi_id) : undefined;
    const certificate = linkedCertificate?.employeeId === attendee.employee_id ? linkedCertificate : undefined;
    const trainer = course.nguoi_dao_tao ? personnelById.get(course.nguoi_dao_tao) : undefined;
    return [{
      id: attendee.id,
      createdAt: attendee.created_at,
      personCode: person.code,
      personName: person.name,
      personType: isWelder(person) ? "Thợ hàn" : "Nhân sự khác",
      department: person.department,
      courseTitle: course.ten_khoa_hoc,
      trainer: course.nguoi_dao_tao_ten?.trim() || trainer?.name || "Chưa chỉ định",
      date: formatTrainingDate(course.ngay),
      duration: course.thoi_luong || "0:00",
      manufacturerHours: toNonNegNumber(course.tong_gio_nha_san_xuat),
      selfTrainingHours: toNonNegNumber(course.tong_gio_tu_dao_tao),
      result: (attendee.ket_qua as DbTrainingHistoryRecord["result"]) || "Đang học",
      status: (attendee.trang_thai as DbTrainingHistoryRecord["status"]) || "Đang học",
      certificate: certificate?.name || "Chưa cấp",
      certificateId: certificate ? attendee.chung_chi_id || undefined : undefined,
      certificateDate: certificate?.date || "—",
    }];
  });

  records.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return { records };
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
      createdAt: row.created_at,
      title: row.ten_khoa_hoc,
      trainer: row.nguoi_dao_tao_ten?.trim() || trainer?.name || "Chưa chỉ định",
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
      participantsCount:
        row.tong_nguoi_tham_gia != null
          ? Math.round(toNonNegNumber(row.tong_nguoi_tham_gia))
          : (attendeeCounts.get(row.id) ?? 0),
      manufacturerHours: toNonNegNumber(row.tong_gio_nha_san_xuat),
      selfTrainingHours: toNonNegNumber(row.tong_gio_tu_dao_tao),
      certificateGroupId: row.nhom_chung_chi_id,
      certificateGroupName: certificateGroup?.name,
      topics: row.topics || [],
      attendees: [],
      assets: parseTrainingAssets(row.tai_lieu),
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
  const primary = await supabase
    .from("dao_tao")
    .select(COURSE_COLUMNS_FULL)
    .eq("id", courseId)
    .single();
  let data: RawCourseDetailRow | null = primary.data as unknown as RawCourseDetailRow | null;
  let error = primary.error;

  if (error && (error.code === "42703" || error.code === "PGRST204" || error.message.includes("column"))) {
    const withAssets = await supabase
      .from("dao_tao")
      .select(COURSE_COLUMNS_WITH_ASSETS)
      .eq("id", courseId)
      .single();
    data = withAssets.data as unknown as RawCourseDetailRow | null;
    error = withAssets.error;
  }

  if (error && (error.code === "42703" || error.code === "PGRST204" || error.message.includes("column"))) {
    const fallback = await supabase
      .from("dao_tao")
      .select(COURSE_COLUMNS_BASE)
      .eq("id", courseId)
      .single();
    data = fallback.data as unknown as RawCourseDetailRow | null;
    error = fallback.error;
  }

  if (error || !data) return { error: error?.message || "Không tìm thấy khóa đào tạo" };

  const row = data;
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
    trainer: row.nguoi_dao_tao_ten?.trim() || trainer?.name || "Chưa chỉ định",
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
    participantsCount:
      row.tong_nguoi_tham_gia != null
        ? Math.round(toNonNegNumber(row.tong_nguoi_tham_gia))
        : attendees.length,
    manufacturerHours: toNonNegNumber(row.tong_gio_nha_san_xuat),
    selfTrainingHours: toNonNegNumber(row.tong_gio_tu_dao_tao),
    certificateGroupId: row.nhom_chung_chi_id,
    certificateGroupName: certificateGroup?.name,
    topics: row.topics || [],
    attendees,
    assets: parseTrainingAssets(row.tai_lieu),
  };

  return { course };
}

async function patchTrainingExtraFields(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  fields: {
    trainerName?: string | null;
    assets?: TrainingAsset[];
    manufacturerHours: number;
    selfTrainingHours: number;
    participantsCount: number;
  },
): Promise<{ error?: string }> {
  const payload: Record<string, unknown> = {
    nguoi_dao_tao_ten: fields.trainerName?.trim() || null,
    tai_lieu: fields.assets ?? [],
    tong_gio_nha_san_xuat: fields.manufacturerHours,
    tong_gio_tu_dao_tao: fields.selfTrainingHours,
    tong_nguoi_tham_gia: fields.participantsCount,
    updated_at: new Date().toISOString(),
  };

  const full = await supabase.from("dao_tao").update(payload).eq("id", courseId);
  if (!full.error) return {};

  if (full.error.code === "42703" || full.error.message.includes("column")) {
    const withoutHours = await supabase
      .from("dao_tao")
      .update({
        nguoi_dao_tao_ten: payload.nguoi_dao_tao_ten,
        tai_lieu: payload.tai_lieu,
        updated_at: payload.updated_at,
      })
      .eq("id", courseId);
    if (!withoutHours.error) {
      return {
        error:
          "Cần chạy migration_20260908_gio_dao_tao_tham_gia.sql trên Supabase để lưu giờ NSX, giờ tự đào tạo và tổng người tham gia.",
      };
    }
    if (withoutHours.error.code === "42703" || withoutHours.error.message.includes("column")) {
      const baseOnly = await supabase
        .from("dao_tao")
        .update({
          tong_gio_nha_san_xuat: fields.manufacturerHours,
          tong_gio_tu_dao_tao: fields.selfTrainingHours,
          tong_nguoi_tham_gia: fields.participantsCount,
          updated_at: payload.updated_at,
        })
        .eq("id", courseId);
      if (!baseOnly.error) return {};
      if (baseOnly.error.code === "42703" || baseOnly.error.message.includes("column")) {
        return {
          error:
            "Cần chạy migration_20260908_gio_dao_tao_tham_gia.sql trên Supabase để lưu giờ NSX, giờ tự đào tạo và tổng người tham gia.",
        };
      }
      return { error: baseOnly.error.message };
    }
    return { error: withoutHours.error.message };
  }

  return { error: full.error.message };
}

/** Lưu khóa khi không cấp chứng chỉ — tránh RPC lỗi v_nhom chưa gán. */
async function saveTrainingCourseDirect(input: SaveTrainingCourseInput): Promise<{
  id?: string;
  error?: string;
}> {
  const supabase = createClient();
  const manufacturerHours = toNonNegNumber(input.manufacturerHours);
  const selfTrainingHours = toNonNegNumber(input.selfTrainingHours);
  const participantsCount = Math.round(toNonNegNumber(input.participantsCount));

  const row: Record<string, unknown> = {
    ten_khoa_hoc: input.title.trim(),
    ngay: input.date || null,
    thoi_luong: input.duration?.trim() || null,
    dia_diem: input.location?.trim() || null,
    mo_ta: input.description?.trim() || null,
    nguoi_dao_tao: input.trainerId || null,
    ket_qua: input.result || "Đạt",
    hinh_anh: input.thumbnail || null,
    cloudinary_public_id: input.cloudinaryPublicId || null,
    secure_url: input.thumbnail || null,
    nhom_chung_chi_id: null,
    topics: input.topics || [],
    nguoi_dao_tao_ten: input.trainerName?.trim() || null,
    tai_lieu: input.assets ?? [],
    tong_gio_nha_san_xuat: manufacturerHours,
    tong_gio_tu_dao_tao: selfTrainingHours,
    tong_nguoi_tham_gia: participantsCount,
    nguoi_tham_gia: input.attendees.map((a) => a.employeeId),
    updated_at: new Date().toISOString(),
  };

  let courseId = input.id;

  const tryWrite = async (payload: Record<string, unknown>) => {
    if (courseId) {
      return supabase.from("dao_tao").update(payload).eq("id", courseId).select("id").single();
    }
    return supabase.from("dao_tao").insert(payload).select("id").single();
  };

  let result = await tryWrite(row);
  if (result.error && (result.error.code === "42703" || result.error.message.includes("column"))) {
    const {
      tong_gio_nha_san_xuat: _a,
      tong_gio_tu_dao_tao: _b,
      tong_nguoi_tham_gia: _c,
      nguoi_dao_tao_ten: _d,
      tai_lieu: _e,
      ...baseRow
    } = row;
    result = await tryWrite(baseRow);
    if (!result.error) {
      courseId = (result.data as { id: string }).id;
      const patch = await patchTrainingExtraFields(supabase, courseId, {
        trainerName: input.trainerName,
        assets: input.assets,
        manufacturerHours,
        selfTrainingHours,
        participantsCount,
      });
      // Nếu thiếu cột giờ thì vẫn cho lưu khóa; báo lỗi cột ở bước sau chỉ khi cần
      if (patch.error?.includes("migration_20260908")) {
        // tiếp tục sync học viên, trả cảnh báo sau nếu muốn — ưu tiên lưu được khóa
      } else if (patch.error) {
        return { error: patch.error };
      }
    }
  }

  if (result.error) return { error: result.error.message };
  courseId = (result.data as { id: string }).id;

  const employeeIds = input.attendees.map((a) => a.employeeId);
  const { error: clearError } = await supabase.from("dao_tao_hoc_vien").delete().eq("dao_tao_id", courseId);
  if (clearError) return { error: clearError.message };

  if (employeeIds.length === 0) {
    return { id: courseId };
  }

  const attendeeRows = input.attendees.map((a) => ({
    dao_tao_id: courseId,
    employee_id: a.employeeId,
    ket_qua: a.result,
    trang_thai:
      a.status ||
      (a.result === "Đạt" ? "Hoàn thành" : a.result === "Không đạt" ? "Không hoàn thành" : "Đang học"),
    chung_chi_id: null,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase.from("dao_tao_hoc_vien").insert(attendeeRows);
  if (upsertError) return { error: upsertError.message };

  return { id: courseId };
}

export async function saveTrainingCourse(input: SaveTrainingCourseInput): Promise<{
  id?: string;
  error?: string;
}> {
  if (!isSupabaseReady()) return { error: "Chưa cấu hình Supabase" };
  if (input.thumbnail && !input.thumbnail.startsWith("https://")) {
    return { error: "Ảnh khóa đào tạo phải là URL HTTPS đã tải lên Cloudinary." };
  }

  // Không cấp chứng chỉ: lưu trực tiếp để tránh lỗi RPC "record v_nhom is not assigned yet"
  if (!input.certificateGroupId) {
    return saveTrainingCourseDirect(input);
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

  const rpcParams = {
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
  };

  const manufacturerHours = toNonNegNumber(input.manufacturerHours);
  const selfTrainingHours = toNonNegNumber(input.selfTrainingHours);
  const participantsCount = Math.round(toNonNegNumber(input.participantsCount));

  const v2 = await supabase.rpc("luu_khoa_dao_tao_va_cap_chung_chi_v2", {
    ...rpcParams,
    p_nguoi_dao_tao_ten: input.trainerName?.trim() || null,
    p_tai_lieu: input.assets ?? [],
    p_tong_gio_nha_san_xuat: manufacturerHours,
    p_tong_gio_tu_dao_tao: selfTrainingHours,
    p_tong_nguoi_tham_gia: participantsCount,
  });

  if (!v2.error) return { id: v2.data as string };

  // Không bỏ nhóm chứng chỉ đã chọn khi RPC lỗi: transaction phải báo thất bại.
  if (/v_nhom/i.test(v2.error.message)) {
    return { error: "Chưa lưu khóa và cấp chứng chỉ. Cần chạy migration_20260908_fix_v_nhom_dao_tao.sql trên Supabase rồi lưu lại." };
  }

  // RPC cũ chưa có 3 tham số mới — lưu khóa rồi cập nhật cột riêng
  if (v2.error.code === "PGRST202") {
    const legacyV2 = await supabase.rpc("luu_khoa_dao_tao_va_cap_chung_chi_v2", {
      ...rpcParams,
      p_nguoi_dao_tao_ten: input.trainerName?.trim() || null,
      p_tai_lieu: input.assets ?? [],
    });
    if (!legacyV2.error) {
      const courseId = legacyV2.data as string;
      const patch = await patchTrainingExtraFields(supabase, courseId, {
        trainerName: input.trainerName,
        assets: input.assets,
        manufacturerHours,
        selfTrainingHours,
        participantsCount,
      });
      if (patch.error?.includes("migration_20260908")) return { id: courseId };
      if (patch.error) return { error: patch.error };
      return { id: courseId };
    }
    if (/v_nhom/i.test(legacyV2.error.message)) {
      return { error: "Chưa lưu khóa và cấp chứng chỉ. Cần chạy migration_20260908_fix_v_nhom_dao_tao.sql trên Supabase rồi lưu lại." };
    }
    if (legacyV2.error.code !== "PGRST202") return { error: legacyV2.error.message };
  } else {
    return { error: v2.error.message };
  }

  if (input.trainerName?.trim() || input.assets?.length) {
    return {
      error: "Cần chạy migration_20260906_tai_lieu_khoa_dao_tao.sql trên Supabase để lưu người đào tạo và nhiều tài liệu/video.",
    };
  }

  const { data, error } = await supabase.rpc("luu_khoa_dao_tao_va_cap_chung_chi", rpcParams);

  if (error) {
    if (/v_nhom/i.test(error.message)) {
      return { error: "Chưa lưu khóa và cấp chứng chỉ. Cần chạy migration_20260908_fix_v_nhom_dao_tao.sql trên Supabase rồi lưu lại." };
    }
    return { error: error.message };
  }

  const courseId = data as string;
  const patch = await patchTrainingExtraFields(supabase, courseId, {
    trainerName: input.trainerName,
    assets: input.assets,
    manufacturerHours,
    selfTrainingHours,
    participantsCount,
  });
  if (patch.error?.includes("migration_20260908")) return { id: courseId };
  if (patch.error) return { error: patch.error };

  return { id: courseId };
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dao_tao")
    .select("id")
    .eq("cloudinary_public_id", publicId)
    .limit(1);
  if (error) return true;
  if (data?.length) return true;

  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const attachments = await supabase
      .from("dao_tao")
      .select("tai_lieu")
      .range(offset, offset + pageSize - 1);
    if (attachments.error) {
      if (
        attachments.error.code === "42703" ||
        attachments.error.code === "PGRST204" ||
        attachments.error.message.includes("column")
      ) {
        return false;
      }
      return true;
    }
    const page = attachments.data ?? [];
    if (page.some((row) => parseTrainingAssets(row.tai_lieu).some((asset) => asset.publicId === publicId))) {
      return true;
    }
    if (page.length < pageSize) return false;
  }
}
