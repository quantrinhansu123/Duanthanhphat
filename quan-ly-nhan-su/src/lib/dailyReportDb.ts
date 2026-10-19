import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import {
  addHoursToWeldTime,
  DEFAULT_WELD_WORK_HOURS,
  normalizeWeldTime,
} from "@/lib/weldReportData";

export type WorkSection = "hom_nay" | "ngay_tiep_theo";

export type DailyWorkType = {
  id: string;
  ma: string;
  ten: string;
  moTa: string;
  thuTu: number;
  loaiMayMacDinh: string;
  donViMacDinh: string;
  active: boolean;
};

export type DailyWorkMachine = {
  /** Máy trong danh mục thiết bị (thiet_bi.id) — rỗng khi nhật ký chưa gán máy. */
  mayId: string;
  maMay: string;
  tenMay: string;
  soLuong: string;
  gioBatDau: string;
  gioKetThuc: string;
};

export type DailyWorkPerson = {
  id: string;
  ten: string;
};

export type DailyWorkManpower = {
  cht: DailyWorkPerson[];
  kySu: DailyWorkPerson[];
  laiMay: DailyWorkPerson[];
  thoVanHanh: DailyWorkPerson[];
  congNhan: DailyWorkPerson[];
  /** Ngày tiếp theo — người được giao thực hiện. */
  thucHien: DailyWorkPerson[];
};

export type DailyWorkItem = {
  id: string;
  baoCaoId: string;
  phan: WorkSection;
  thuTu: number;
  congViecId: string;
  hangMuc: string;
  tenMoiHan: string;
  tuyenHa: string;
  tuyenThuong: string;
  donVi: string;
  denHomQua: string;
  homNay: string;
  tichLuy: string;
  mayChay: DailyWorkMachine[];
  cht: DailyWorkPerson[];
  kySu: DailyWorkPerson[];
  laiMay: DailyWorkPerson[];
  thoVanHanh: DailyWorkPerson[];
  congNhan: DailyWorkPerson[];
  thucHien: DailyWorkPerson[];
  /** Hiển thị bảng — ghép tên từ danh sách. */
  chtTen: string;
  kySuTen: string;
  laiMayTen: string;
  thoVanHanhTen: string;
  congNhanTen: string;
  thucHienTen: string;
  ghiChu: string;
};

export type DailyEquipmentItem = {
  id: string;
  baoCaoId: string;
  thuTu: number;
  tenThietBi: string;
  soLuong: string;
  boPhan: string;
  nguoiSuDung: string;
  ghiChu: string;
};

export type DailyIncidentItem = {
  id: string;
  baoCaoId: string;
  thuTu: number;
  noiDung: string;
  phuongAnXuLy: string;
  tinhTrangXuLy: string;
  nguoiBaoCao: string;
  boPhanBaoCao: string;
};

export type DailyReportHeader = {
  id: string;
  ngayBaoCao: string;
  ngayTiepTheo: string | null;
  duAnId: string | null;
  nguoiLap: string;
  ghiChu: string;
  trangThai: "Nháp" | "Đã gửi" | "Đã duyệt";
};

export type DailyReportBundle = {
  header: DailyReportHeader | null;
  workTypes: DailyWorkType[];
  workToday: DailyWorkItem[];
  workNext: DailyWorkItem[];
  equipment: DailyEquipmentItem[];
  incidents: DailyIncidentItem[];
  source: "supabase" | "local";
  error?: string;
};

export type WorkItemInput = Omit<DailyWorkItem, "id" | "baoCaoId" | "thuTu" | "phan">;
export type EquipmentItemInput = Omit<DailyEquipmentItem, "id" | "baoCaoId" | "thuTu">;
export type IncidentItemInput = Omit<DailyIncidentItem, "id" | "baoCaoId" | "thuTu">;

type WorkRowDb = {
  id: string;
  bao_cao_id: string;
  phan: WorkSection;
  thu_tu: number;
  cong_viec_id?: string | null;
  hang_muc: string | null;
  ten_moi_han?: string | null;
  tuyen_ha: string | null;
  tuyen_thuong: string | null;
  don_vi: string | null;
  den_hom_qua: number | string | null;
  hom_nay: number | string | null;
  tich_luy: number | string | null;
  thiet_ke: number | string | null;
  loai_may: string | null;
  may_id?: string | null;
  may_bat_dau: string | null;
  may_ket_thuc: string | null;
  may_chay?: unknown;
  nhan_luc?: unknown;
  cht_id: string | null;
  cht_ten: string | null;
  ky_su_id: string | null;
  ky_su_ten: string | null;
  lai_may_id: string | null;
  lai_may_ten: string | null;
  tho_van_hanh_id: string | null;
  tho_van_hanh_ten: string | null;
  cong_nhan_id: string | null;
  cong_nhan_ten: string | null;
  // legacy numeric columns (trước migration)
  so_cht?: number | string | null;
  so_ky_su?: number | string | null;
  so_lai_may?: number | string | null;
  so_tho_van_hanh?: number | string | null;
  so_cong_nhan?: number | string | null;
  ghi_chu: string | null;
};

type WorkTypeRowDb = {
  id: string;
  ma: string;
  ten: string;
  mo_ta: string | null;
  thu_tu: number;
  loai_may_mac_dinh: string | null;
  don_vi_mac_dinh: string | null;
  active: boolean;
};

type EquipmentRowDb = {
  id: string;
  bao_cao_id: string;
  thu_tu: number;
  ten_thiet_bi: string | null;
  so_luong: number | string | null;
  bo_phan?: string | null;
  nguoi_su_dung?: string | null;
  ghi_chu: string | null;
};

type IncidentRowDb = {
  id: string;
  bao_cao_id: string;
  thu_tu: number;
  noi_dung: string | null;
  phuong_an_xu_ly: string | null;
  tinh_trang_xu_ly: string | null;
  nguoi_bao_cao?: string | null;
  bo_phan_bao_cao?: string | null;
};

type HeaderRowDb = {
  id: string;
  ngay_bao_cao: string;
  ngay_tiep_theo: string | null;
  du_an_id: string | null;
  nguoi_lap: string | null;
  ghi_chu: string | null;
  trang_thai: "Nháp" | "Đã gửi" | "Đã duyệt";
};

const LOCAL_KEY = "bao-cao-ngay-local-v1";

type LocalStore = {
  headers: DailyReportHeader[];
  work: DailyWorkItem[];
  equipment: DailyEquipmentItem[];
  incidents: DailyIncidentItem[];
};

function numStr(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function toNum(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function workMachineKey(machine: Pick<DailyWorkMachine, "mayId" | "maMay">) {
  return machine.mayId || `code:${machine.maMay}`;
}

export function workMachineLabel(machine: Pick<DailyWorkMachine, "maMay" | "tenMay">) {
  return machine.tenMay.trim() || machine.maMay.trim();
}

function legacyMachines(
  loaiMay: string | null | undefined,
  mayId: string | null | undefined,
  batDau: string | null | undefined,
  ketThuc: string | null | undefined,
): DailyWorkMachine[] {
  if (!loaiMay && !mayId && !batDau && !ketThuc) return [];
  return [
    {
      mayId: mayId ?? "",
      maMay: "",
      tenMay: loaiMay ?? "",
      soLuong: "",
      gioBatDau: batDau ?? "",
      gioKetThuc: ketThuc ?? "",
    },
  ];
}

function parseMachines(value: unknown): DailyWorkMachine[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      mayId: String(item.may_id ?? ""),
      maMay: String(item.ma_may ?? ""),
      tenMay: String(item.ten_may ?? ""),
      soLuong: numStr(item.so_luong as number | string | null | undefined),
      gioBatDau: String(item.gio_bat_dau ?? ""),
      gioKetThuc: String(item.gio_ket_thuc ?? ""),
    }));
}

function parsePeopleList(value: unknown): DailyWorkPerson[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? "").trim(),
      ten: String(item.ten ?? "").trim(),
    }))
    .filter((p) => p.id || p.ten);
}

function legacyPeople(id: string | null | undefined, ten: string | null | undefined): DailyWorkPerson[] {
  const rawTen = (ten ?? "").trim();
  if (!rawTen && !id) return [];
  // Legacy cột số lượng (trước khi đổi sang tên nhân sự).
  if (rawTen && /^\d+(\.\d+)?$/.test(rawTen) && !id) return [];
  const names = rawTen
    ? rawTen.split(/\s*[,;·|/]\s*/).map((s) => s.trim()).filter(Boolean)
    : [];
  if (names.length === 0) return id ? [{ id, ten: "" }] : [];
  return names.map((name, index) => ({
    id: index === 0 ? (id ?? "") : "",
    ten: name,
  }));
}

export function formatPeopleNames(people: DailyWorkPerson[]): string {
  return people.map((p) => p.ten.trim()).filter(Boolean).join(", ");
}

function peoplePayload(people: DailyWorkPerson[]) {
  return people
    .filter((p) => p.id || p.ten.trim())
    .map((p) => ({ id: p.id || null, ten: p.ten.trim() || null }));
}

function parseManpower(row: WorkRowDb): DailyWorkManpower {
  const bag =
    row.nhan_luc && typeof row.nhan_luc === "object" && !Array.isArray(row.nhan_luc)
      ? (row.nhan_luc as Record<string, unknown>)
      : null;
  const pick = (key: string, id: string | null, ten: string | null | undefined) => {
    const fromJson = bag ? parsePeopleList(bag[key]) : [];
    return fromJson.length > 0 ? fromJson : legacyPeople(id, ten);
  };
  const thucHien = bag ? parsePeopleList(bag.thuc_hien) : [];
  return {
    cht: pick("cht", row.cht_id, row.cht_ten ?? numStr(row.so_cht)),
    kySu: pick("ky_su", row.ky_su_id, row.ky_su_ten ?? numStr(row.so_ky_su)),
    laiMay: pick("lai_may", row.lai_may_id, row.lai_may_ten ?? numStr(row.so_lai_may)),
    thoVanHanh: pick("tho_van_hanh", row.tho_van_hanh_id, row.tho_van_hanh_ten ?? numStr(row.so_tho_van_hanh)),
    congNhan: pick("cong_nhan", row.cong_nhan_id, row.cong_nhan_ten ?? numStr(row.so_cong_nhan)),
    thucHien,
  };
}

function mapWork(row: WorkRowDb): DailyWorkItem {
  const machines = parseMachines(row.may_chay);
  const manpower = parseManpower(row);
  return {
    id: row.id,
    baoCaoId: row.bao_cao_id,
    phan: row.phan,
    thuTu: row.thu_tu,
    congViecId: row.cong_viec_id ?? "",
    hangMuc: row.hang_muc ?? "",
    tenMoiHan: row.ten_moi_han ?? "",
    tuyenHa: row.tuyen_ha ?? "",
    tuyenThuong: row.tuyen_thuong ?? "",
    donVi: row.don_vi ?? "",
    denHomQua: numStr(row.den_hom_qua),
    homNay: numStr(row.hom_nay),
    tichLuy: numStr(row.tich_luy),
    mayChay:
      machines && machines.length > 0
        ? machines
        : legacyMachines(row.loai_may, row.may_id, row.may_bat_dau, row.may_ket_thuc),
    cht: manpower.cht,
    kySu: manpower.kySu,
    laiMay: manpower.laiMay,
    thoVanHanh: manpower.thoVanHanh,
    congNhan: manpower.congNhan,
    thucHien: manpower.thucHien,
    chtTen: formatPeopleNames(manpower.cht) || (row.cht_ten ?? ""),
    kySuTen: formatPeopleNames(manpower.kySu) || (row.ky_su_ten ?? ""),
    laiMayTen: formatPeopleNames(manpower.laiMay) || (row.lai_may_ten ?? ""),
    thoVanHanhTen: formatPeopleNames(manpower.thoVanHanh) || (row.tho_van_hanh_ten ?? ""),
    congNhanTen: formatPeopleNames(manpower.congNhan) || (row.cong_nhan_ten ?? ""),
    thucHienTen: formatPeopleNames(manpower.thucHien),
    ghiChu: row.ghi_chu ?? "",
  };
}

function mapWorkType(row: WorkTypeRowDb): DailyWorkType {
  return {
    id: row.id,
    ma: row.ma,
    ten: row.ten,
    moTa: row.mo_ta ?? "",
    thuTu: row.thu_tu,
    loaiMayMacDinh: row.loai_may_mac_dinh ?? "",
    donViMacDinh: row.don_vi_mac_dinh ?? "mối hàn",
    active: row.active,
  };
}

export const DEFAULT_WORK_TYPES: DailyWorkType[] = [
  {
    id: "a1111111-1111-4111-8111-111111111101",
    ma: "HAN-NN",
    ten: "Hàn nhiệt nhôm trên tuyến",
    moTa: "Công việc hàn nhiệt nhôm (ATW) trên tuyến đường sắt",
    thuTu: 1,
    loaiMayMacDinh: "Máy phát điện 5KVA",
    donViMacDinh: "mối hàn",
    active: true,
  },
  {
    id: "a1111111-1111-4111-8111-111111111102",
    ma: "HAN-CGM-TUYEN",
    ten: "Hàn cháy giáp mép trên tuyến",
    moTa: "Hàn tiếp xúc đối đầu (FBW) trên tuyến",
    thuTu: 2,
    loaiMayMacDinh: "Máy hàn ray",
    donViMacDinh: "mối hàn",
    active: true,
  },
  {
    id: "a1111111-1111-4111-8111-111111111103",
    ma: "HAN-CGM-BAI",
    ten: "Hàn cháy giáp mép tại bãi hàn",
    moTa: "Hàn tiếp xúc đối đầu (FBW) tại bãi hàn",
    thuTu: 3,
    loaiMayMacDinh: "Máy hàn ray",
    donViMacDinh: "mối hàn",
    active: true,
  },
];

export async function loadWorkTypes(): Promise<{ types: DailyWorkType[]; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { types: DEFAULT_WORK_TYPES, error: "Chưa cấu hình Supabase — dùng danh mục mẫu" };
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("danh_muc_cong_viec_bao_cao")
      .select("id,ma,ten,mo_ta,thu_tu,loai_may_mac_dinh,don_vi_mac_dinh,active")
      .eq("active", true)
      .order("thu_tu", { ascending: true });
    if (error) throw error;
    const types = (data as WorkTypeRowDb[] | null)?.map(mapWorkType) ?? [];
    return { types: types.length > 0 ? types : DEFAULT_WORK_TYPES };
  } catch (error) {
    return {
      types: DEFAULT_WORK_TYPES,
      error: formatSupabaseError(error),
    };
  }
}

/** Giá trị «Việc cần làm / Nội dung công việc» đã từng lưu — dùng cho combobox chọn hoặc nhập mới. */
export async function loadHangMucSuggestions(): Promise<string[]> {
  const uniq = new Map<string, string>();
  function add(raw: string | null | undefined) {
    const text = (raw ?? "").trim();
    if (!text) return;
    const key = text.toLocaleLowerCase("vi");
    if (!uniq.has(key)) uniq.set(key, text);
  }

  if (!isSupabaseConfigured()) {
    for (const item of readLocal().work) add(item.hangMuc);
    return [...uniq.values()].sort((a, b) => a.localeCompare(b, "vi"));
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bao_cao_ngay_cong_viec")
      .select("hang_muc")
      .not("hang_muc", "is", null)
      .neq("hang_muc", "")
      .order("hang_muc", { ascending: true })
      .limit(500);
    if (error) throw error;
    for (const row of data ?? []) add((row as { hang_muc?: string | null }).hang_muc);
  } catch {
    for (const item of readLocal().work) add(item.hangMuc);
  }
  return [...uniq.values()].sort((a, b) => a.localeCompare(b, "vi"));
}

/** Map danh mục công việc báo cáo ngày → công nghệ hàn trên nhật ký. */
export function workTypeWeldMethod(workType: DailyWorkType | null | undefined): "ATW" | "FBW" | null {
  if (!workType) return null;
  const blob = `${workType.ma} ${workType.ten} ${workType.moTa}`.toLocaleLowerCase("vi");
  if (
    workType.ma === "HAN-NN" ||
    blob.includes("nhiệt nhôm") ||
    blob.includes("nhiet nhom") ||
    blob.includes("atw") ||
    blob.includes("thermit")
  ) {
    return "ATW";
  }
  if (
    workType.ma.startsWith("HAN-CGM") ||
    blob.includes("cháy giáp") ||
    blob.includes("chay giap") ||
    blob.includes("fbw")
  ) {
    return "FBW";
  }
  return null;
}

export type DailyWorkJournalFill = {
  date: string;
  method: "ATW" | "FBW";
  homNay: string;
  tenMoiHan: string;
  mayChay: DailyWorkMachine[];
  ghiChu: string;
  entryCount: number;
};

type JournalFillRow = {
  ma_lich_su?: string | null;
  so_luong_thuc_hien?: number | string | null;
  may_id?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
  gio_bat_dau?: string | null;
  gio_ket_thuc?: string | null;
  gio_han?: string | null;
};

function hhmm(value: string | null | undefined): string {
  return normalizeWeldTime(value) ?? "";
}

/** Giờ bắt đầu / kết thúc từ 1 dòng nhật ký hàn (thiếu kết thúc thì + DEFAULT_WELD_WORK_HOURS). */
function journalWorkRange(row: JournalFillRow): { start: string; end: string } {
  const start = hhmm(row.gio_bat_dau) || hhmm(row.gio_han);
  const end = hhmm(row.gio_ket_thuc) || (start ? addHoursToWeldTime(start, DEFAULT_WELD_WORK_HOURS) : "");
  return { start, end };
}

/** Gom nhật ký hàn theo ngày + công nghệ để điền form báo cáo ngày (phần Hôm nay). */
export async function loadDailyWorkFillFromJournal(
  date: string,
  method: "ATW" | "FBW",
): Promise<DailyWorkJournalFill> {
  if (!date.trim()) throw new Error("Thiếu ngày để lấy nhật ký hàn");
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase — không lấy được Nhật ký hàn");
  }

  const supabase = createClient();
  /** View có ma_may/ten_may từ thiet_bi; bảng gốc chỉ có may_id. */
  const viewSelects = [
    "ma_lich_su,so_luong_thuc_hien,may_id,ma_may,ten_may,gio_bat_dau,gio_ket_thuc,gio_han",
    "ma_lich_su,so_luong_thuc_hien,may_id,ma_may,ten_may,gio_han",
    "ma_lich_su,so_luong_thuc_hien,may_id,ma_may,ten_may",
  ];
  const tableSelects = [
    "ma_lich_su,so_luong_thuc_hien,may_id,gio_bat_dau,gio_ket_thuc,gio_han",
    "ma_lich_su,so_luong_thuc_hien,may_id,gio_han",
    "ma_lich_su,so_luong_thuc_hien,may_id",
  ];
  let rows: JournalFillRow[] = [];

  async function fetchWithSelects(
    table: "bao_cao_moi_han_theo_du_an" | "lich_su_moi_han",
    selects: string[],
  ) {
    let lastError: unknown = null;
    for (const columns of selects) {
      const result = await supabase
        .from(table)
        .select(columns)
        .eq("ngay_thuc_hien", date)
        .eq("cong_nghe_han", method)
        .order("ma_lich_su", { ascending: true })
        .limit(2000);
      if (!result.error) return (result.data as JournalFillRow[] | null) ?? [];
      lastError = result.error;
      const message = result.error.message ?? "";
      if (/does not exist|schema cache|column/i.test(message)) continue;
      throw result.error;
    }
    throw lastError ?? new Error(`Không đọc được ${table}`);
  }

  try {
    rows = await fetchWithSelects("bao_cao_moi_han_theo_du_an", viewSelects);
  } catch {
    try {
      rows = await fetchWithSelects("lich_su_moi_han", tableSelects);
    } catch (error) {
      throw new Error(formatSupabaseError(error));
    }
  }

  // Bảng gốc không có ma_may/ten_may — bổ sung từ thiet_bi khi cần.
  const missingMachineMeta = rows.some((row) => row.may_id && !row.ma_may && !row.ten_may);
  if (missingMachineMeta) {
    const ids = [...new Set(rows.map((row) => (row.may_id ?? "").trim()).filter(Boolean))];
    if (ids.length > 0) {
      const { data: machines } = await supabase
        .from("thiet_bi")
        .select("id,ma_may,ten_may")
        .in("id", ids);
      const byId = new Map(
        ((machines as { id: string; ma_may?: string | null; ten_may?: string | null }[] | null) ?? []).map(
          (m) => [m.id, m] as const,
        ),
      );
      rows = rows.map((row) => {
        const machine = row.may_id ? byId.get(row.may_id) : undefined;
        if (!machine) return row;
        return {
          ...row,
          ma_may: row.ma_may || machine.ma_may || null,
          ten_may: row.ten_may || machine.ten_may || null,
        };
      });
    }
  }

  let weldTotal = 0;
  const codes: string[] = [];
  const machines = new Map<string, DailyWorkMachine & { weldQty: number }>();

  for (const row of rows) {
    const qty = Number(row.so_luong_thuc_hien);
    const weldQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    weldTotal += weldQty;

    const code = (row.ma_lich_su ?? "").trim();
    if (code) codes.push(code);

    const maMay = (row.ma_may ?? "").trim();
    const mayId = (row.may_id ?? "").trim();
    const key = mayId || (maMay ? `code:${maMay}` : "");
    if (!key) continue;

    const { start, end } = journalWorkRange(row);
    const existing = machines.get(key);
    if (!existing) {
      machines.set(key, {
        mayId,
        maMay,
        tenMay: (row.ten_may ?? "").trim(),
        soLuong: "1",
        gioBatDau: start,
        gioKetThuc: end,
        weldQty,
      });
      continue;
    }
    existing.weldQty += weldQty;
    existing.soLuong = String(existing.weldQty);
    if (start && (!existing.gioBatDau || start < existing.gioBatDau)) {
      existing.gioBatDau = start;
      if (!existing.gioKetThuc && end) existing.gioKetThuc = end;
    }
    if (end && (!existing.gioKetThuc || end > existing.gioKetThuc)) existing.gioKetThuc = end;
    if (!existing.tenMay && row.ten_may) existing.tenMay = row.ten_may.trim();
    if (!existing.maMay && maMay) existing.maMay = maMay;
    if (!existing.mayId && mayId) existing.mayId = mayId;
  }

  const mayChay: DailyWorkMachine[] = [...machines.values()].map(({ weldQty: _w, ...machine }) => ({
    ...machine,
    soLuong: machine.soLuong || "1",
  }));

  const tenMoiHan =
    codes.length <= 6 ? codes.join(", ") : `${codes.slice(0, 6).join(", ")}… (+${codes.length - 6})`;

  return {
    date,
    method,
    homNay: weldTotal > 0 ? String(weldTotal) : "",
    tenMoiHan,
    mayChay,
    ghiChu:
      rows.length > 0
        ? `Điền từ Nhật ký hàn · ${method} · ${date} · ${rows.length} bản ghi`
        : `Không có bản ghi Nhật ký hàn ${method} ngày ${date}`,
    entryCount: rows.length,
  };
}

function mapEquipment(row: EquipmentRowDb): DailyEquipmentItem {
  return {
    id: row.id,
    baoCaoId: row.bao_cao_id,
    thuTu: row.thu_tu,
    tenThietBi: row.ten_thiet_bi ?? "",
    soLuong: numStr(row.so_luong),
    boPhan: row.bo_phan ?? "",
    nguoiSuDung: row.nguoi_su_dung ?? "",
    ghiChu: row.ghi_chu ?? "",
  };
}

function mapIncident(row: IncidentRowDb): DailyIncidentItem {
  return {
    id: row.id,
    baoCaoId: row.bao_cao_id,
    thuTu: row.thu_tu,
    noiDung: row.noi_dung ?? "",
    phuongAnXuLy: row.phuong_an_xu_ly ?? "",
    tinhTrangXuLy: row.tinh_trang_xu_ly ?? "",
    nguoiBaoCao: row.nguoi_bao_cao ?? "",
    boPhanBaoCao: row.bo_phan_bao_cao ?? "",
  };
}

function mapHeader(row: HeaderRowDb): DailyReportHeader {
  return {
    id: row.id,
    ngayBaoCao: row.ngay_bao_cao,
    ngayTiepTheo: row.ngay_tiep_theo,
    duAnId: row.du_an_id,
    nguoiLap: row.nguoi_lap ?? "",
    ghiChu: row.ghi_chu ?? "",
    trangThai: row.trang_thai,
  };
}

function emptyLocal(): LocalStore {
  return { headers: [], work: [], equipment: [], incidents: [] };
}

type LegacyLocalWork = DailyWorkItem & {
  loaiMay?: string;
  mayId?: string;
  mayBatDau?: string;
  mayKetThuc?: string;
  chtId?: string;
  kySuId?: string;
  laiMayId?: string;
  thoVanHanhId?: string;
  congNhanId?: string;
};

function normalizeLocalWork(item: LegacyLocalWork): DailyWorkItem {
  const mayChay = Array.isArray(item.mayChay)
    ? item.mayChay
    : legacyMachines(item.loaiMay, item.mayId, item.mayBatDau, item.mayKetThuc);
  const cht = Array.isArray(item.cht) ? item.cht : legacyPeople(item.chtId, item.chtTen);
  const kySu = Array.isArray(item.kySu) ? item.kySu : legacyPeople(item.kySuId, item.kySuTen);
  const laiMay = Array.isArray(item.laiMay) ? item.laiMay : legacyPeople(item.laiMayId, item.laiMayTen);
  const thoVanHanh = Array.isArray(item.thoVanHanh)
    ? item.thoVanHanh
    : legacyPeople(item.thoVanHanhId, item.thoVanHanhTen);
  const congNhan = Array.isArray(item.congNhan)
    ? item.congNhan
    : legacyPeople(item.congNhanId, item.congNhanTen);
  const thucHien = Array.isArray(item.thucHien) ? item.thucHien : [];
  return {
    ...item,
    mayChay,
    cht,
    kySu,
    laiMay,
    thoVanHanh,
    congNhan,
    thucHien,
    chtTen: formatPeopleNames(cht) || item.chtTen || "",
    kySuTen: formatPeopleNames(kySu) || item.kySuTen || "",
    laiMayTen: formatPeopleNames(laiMay) || item.laiMayTen || "",
    thoVanHanhTen: formatPeopleNames(thoVanHanh) || item.thoVanHanhTen || "",
    congNhanTen: formatPeopleNames(congNhan) || item.congNhanTen || "",
    thucHienTen: formatPeopleNames(thucHien) || item.thucHienTen || "",
  };
}

function normalizeLocalEquipment(item: DailyEquipmentItem): DailyEquipmentItem {
  return {
    ...item,
    boPhan: item.boPhan ?? "",
    nguoiSuDung: item.nguoiSuDung ?? "",
  };
}

function normalizeLocalIncident(item: DailyIncidentItem): DailyIncidentItem {
  return {
    ...item,
    nguoiBaoCao: item.nguoiBaoCao ?? "",
    boPhanBaoCao: item.boPhanBaoCao ?? "",
  };
}

function readLocal(): LocalStore {
  if (typeof window === "undefined") return emptyLocal();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyLocal();
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      headers: parsed.headers ?? [],
      work: (parsed.work ?? []).map(normalizeLocalWork),
      equipment: (parsed.equipment ?? []).map(normalizeLocalEquipment),
      incidents: (parsed.incidents ?? []).map(normalizeLocalIncident),
    };
  } catch {
    return emptyLocal();
  }
}

function writeLocal(store: LocalStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
}

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const EMPTY_MANPOWER = {
  cht: [] as DailyWorkPerson[],
  kySu: [] as DailyWorkPerson[],
  laiMay: [] as DailyWorkPerson[],
  thoVanHanh: [] as DailyWorkPerson[],
  congNhan: [] as DailyWorkPerson[],
  thucHien: [] as DailyWorkPerson[],
  chtTen: "",
  kySuTen: "",
  laiMayTen: "",
  thoVanHanhTen: "",
  congNhanTen: "",
  thucHienTen: "",
};

function manpowerColumns(input: Pick<WorkItemInput, keyof DailyWorkManpower>) {
  const firstId = (people: DailyWorkPerson[]) => people.find((p) => p.id)?.id || null;
  const names = (people: DailyWorkPerson[]) => formatPeopleNames(people) || null;
  return {
    nhan_luc: {
      cht: peoplePayload(input.cht),
      ky_su: peoplePayload(input.kySu),
      lai_may: peoplePayload(input.laiMay),
      tho_van_hanh: peoplePayload(input.thoVanHanh),
      cong_nhan: peoplePayload(input.congNhan),
      thuc_hien: peoplePayload(input.thucHien),
    },
    cht_id: firstId(input.cht),
    cht_ten: names(input.cht),
    ky_su_id: firstId(input.kySu),
    ky_su_ten: names(input.kySu),
    lai_may_id: firstId(input.laiMay),
    lai_may_ten: names(input.laiMay),
    tho_van_hanh_id: firstId(input.thoVanHanh),
    tho_van_hanh_ten: names(input.thoVanHanh),
    cong_nhan_id: firstId(input.congNhan),
    cong_nhan_ten: names(input.congNhan),
  };
}

function seedWorkToday(baoCaoId: string): DailyWorkItem[] {
  return DEFAULT_WORK_TYPES.map((type, index) => ({
    id: uid(),
    baoCaoId,
    phan: "hom_nay" as const,
    thuTu: index + 1,
    congViecId: type.id,
    hangMuc: type.ten,
    tenMoiHan: "",
    tuyenHa: "",
    tuyenThuong: "",
    donVi: type.donViMacDinh,
    denHomQua: "",
    homNay: "",
    tichLuy: "",
    mayChay: [],
    ...EMPTY_MANPOWER,
    ghiChu: "",
  }));
}

async function ensureHeaderSupabase(
  ngayBaoCao: string,
  ngayTiepTheo?: string | null,
): Promise<DailyReportHeader> {
  const supabase = createClient();
  const existing = await supabase
    .from("bao_cao_ngay")
    .select("id,ngay_bao_cao,ngay_tiep_theo,du_an_id,nguoi_lap,ghi_chu,trang_thai")
    .eq("ngay_bao_cao", ngayBaoCao)
    .is("du_an_id", null)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    if (ngayTiepTheo && existing.data.ngay_tiep_theo !== ngayTiepTheo) {
      const updated = await supabase
        .from("bao_cao_ngay")
        .update({ ngay_tiep_theo: ngayTiepTheo })
        .eq("id", existing.data.id)
        .select("id,ngay_bao_cao,ngay_tiep_theo,du_an_id,nguoi_lap,ghi_chu,trang_thai")
        .single();
      if (updated.error) throw updated.error;
      return mapHeader(updated.data as HeaderRowDb);
    }
    return mapHeader(existing.data as HeaderRowDb);
  }

  const inserted = await supabase
    .from("bao_cao_ngay")
    .insert({
      ngay_bao_cao: ngayBaoCao,
      ngay_tiep_theo: ngayTiepTheo || null,
      trang_thai: "Nháp",
    })
    .select("id,ngay_bao_cao,ngay_tiep_theo,du_an_id,nguoi_lap,ghi_chu,trang_thai")
    .single();
  if (inserted.error) throw inserted.error;
  return mapHeader(inserted.data as HeaderRowDb);
}

function ensureHeaderLocal(ngayBaoCao: string, ngayTiepTheo?: string | null): DailyReportHeader {
  const store = readLocal();
  let header = store.headers.find((h) => h.ngayBaoCao === ngayBaoCao && !h.duAnId);
  if (!header) {
    header = {
      id: uid(),
      ngayBaoCao,
      ngayTiepTheo: ngayTiepTheo || null,
      duAnId: null,
      nguoiLap: "",
      ghiChu: "",
      trangThai: "Nháp",
    };
    store.headers.push(header);
    if (store.work.length === 0 && store.equipment.length === 0 && store.incidents.length === 0) {
      store.work.push(...seedWorkToday(header.id));
    }
    writeLocal(store);
    return header;
  }
  if (ngayTiepTheo && header.ngayTiepTheo !== ngayTiepTheo) {
    header = { ...header, ngayTiepTheo };
    store.headers = store.headers.map((h) => (h.id === header!.id ? header! : h));
    writeLocal(store);
  }
  return header;
}

export async function loadDailyReport(ngayBaoCao: string): Promise<DailyReportBundle> {
  const workTypesBundle = await loadWorkTypes();
  const withTypes = (bundle: Omit<DailyReportBundle, "workTypes">): DailyReportBundle => ({
    ...bundle,
    workTypes: workTypesBundle.types,
    error: bundle.error || workTypesBundle.error,
  });

  if (!isSupabaseConfigured()) {
    const store = readLocal();
    let header = store.headers.find((h) => h.ngayBaoCao === ngayBaoCao && !h.duAnId) ?? null;
    if (!header && store.headers.length === 0 && store.work.length === 0) {
      header = ensureHeaderLocal(ngayBaoCao);
      const refreshed = readLocal();
      return withTypes({
        header,
        workToday: refreshed.work.filter((w) => w.baoCaoId === header!.id && w.phan === "hom_nay"),
        workNext: refreshed.work.filter((w) => w.baoCaoId === header!.id && w.phan === "ngay_tiep_theo"),
        equipment: refreshed.equipment.filter((e) => e.baoCaoId === header!.id),
        incidents: refreshed.incidents.filter((i) => i.baoCaoId === header!.id),
        source: "local",
        error: "Chưa cấu hình Supabase — đang dùng bộ nhớ cục bộ",
      });
    }
    return withTypes({
      header,
      workToday: header
        ? store.work.filter((w) => w.baoCaoId === header!.id && w.phan === "hom_nay")
        : [],
      workNext: header
        ? store.work.filter((w) => w.baoCaoId === header!.id && w.phan === "ngay_tiep_theo")
        : [],
      equipment: header ? store.equipment.filter((e) => e.baoCaoId === header!.id) : [],
      incidents: header ? store.incidents.filter((i) => i.baoCaoId === header!.id) : [],
      source: "local",
      error: "Chưa cấu hình Supabase — đang dùng bộ nhớ cục bộ",
    });
  }

  try {
    const supabase = createClient();
    const headerRes = await supabase
      .from("bao_cao_ngay")
      .select("id,ngay_bao_cao,ngay_tiep_theo,du_an_id,nguoi_lap,ghi_chu,trang_thai")
      .eq("ngay_bao_cao", ngayBaoCao)
      .is("du_an_id", null)
      .maybeSingle();

    if (headerRes.error) throw headerRes.error;
    if (!headerRes.data) {
      return withTypes({
        header: null,
        workToday: [],
        workNext: [],
        equipment: [],
        incidents: [],
        source: "supabase",
      });
    }

    const header = mapHeader(headerRes.data as HeaderRowDb);
    const [workRes, eqRes, incRes] = await Promise.all([
      supabase
        .from("bao_cao_ngay_cong_viec")
        .select("*")
        .eq("bao_cao_id", header.id)
        .order("thu_tu", { ascending: true }),
      supabase
        .from("bao_cao_ngay_thiet_bi")
        .select("*")
        .eq("bao_cao_id", header.id)
        .order("thu_tu", { ascending: true }),
      supabase
        .from("bao_cao_ngay_su_co")
        .select("*")
        .eq("bao_cao_id", header.id)
        .order("thu_tu", { ascending: true }),
    ]);

    if (workRes.error) throw workRes.error;
    if (eqRes.error) throw eqRes.error;
    if (incRes.error) throw incRes.error;

    const work = ((workRes.data ?? []) as WorkRowDb[]).map(mapWork);
    return withTypes({
      header,
      workToday: work.filter((w) => w.phan === "hom_nay"),
      workNext: work.filter((w) => w.phan === "ngay_tiep_theo"),
      equipment: ((eqRes.data ?? []) as EquipmentRowDb[]).map(mapEquipment),
      incidents: ((incRes.data ?? []) as IncidentRowDb[]).map(mapIncident),
      source: "supabase",
    });
  } catch (error) {
    return withTypes({
      header: null,
      workToday: [],
      workNext: [],
      equipment: [],
      incidents: [],
      source: "local",
      error: formatSupabaseError(error),
    });
  }
}

export async function insertWorkItem(
  ngayBaoCao: string,
  phan: WorkSection,
  input: WorkItemInput,
  ngayTiepTheo?: string | null,
): Promise<DailyWorkItem> {
  if (!isSupabaseConfigured()) {
    const header = ensureHeaderLocal(ngayBaoCao, ngayTiepTheo);
    const store = readLocal();
    const siblings = store.work.filter((w) => w.baoCaoId === header.id && w.phan === phan);
    const item: DailyWorkItem = {
      id: uid(),
      baoCaoId: header.id,
      phan,
      thuTu: siblings.length + 1,
      ...input,
      chtTen: formatPeopleNames(input.cht),
      kySuTen: formatPeopleNames(input.kySu),
      laiMayTen: formatPeopleNames(input.laiMay),
      thoVanHanhTen: formatPeopleNames(input.thoVanHanh),
      congNhanTen: formatPeopleNames(input.congNhan),
      thucHienTen: formatPeopleNames(input.thucHien),
    };
    store.work.push(item);
    writeLocal(store);
    return item;
  }

  const header = await ensureHeaderSupabase(ngayBaoCao, ngayTiepTheo);
  const supabase = createClient();
  const countRes = await supabase
    .from("bao_cao_ngay_cong_viec")
    .select("id", { count: "exact", head: true })
    .eq("bao_cao_id", header.id)
    .eq("phan", phan);
  if (countRes.error) throw countRes.error;

  const machines = input.mayChay;
  const firstMachine = machines[0];
  const payload: Record<string, unknown> = {
    bao_cao_id: header.id,
    phan,
    thu_tu: (countRes.count ?? 0) + 1,
    cong_viec_id: input.congViecId || null,
    hang_muc: input.hangMuc,
    ten_moi_han: input.tenMoiHan.trim() || null,
    tuyen_ha: input.tuyenHa || null,
    tuyen_thuong: input.tuyenThuong || null,
    don_vi: input.donVi || null,
    den_hom_qua: toNum(input.denHomQua),
    hom_nay: toNum(input.homNay),
    tich_luy:
      !input.denHomQua.trim() && !input.homNay.trim()
        ? null
        : (toNum(input.denHomQua) ?? 0) + (toNum(input.homNay) ?? 0),
    loai_may: machines.map(workMachineLabel).filter(Boolean).join(", ") || null,
    may_id: firstMachine?.mayId || null,
    may_bat_dau: firstMachine?.gioBatDau || null,
    may_ket_thuc: firstMachine?.gioKetThuc || null,
    may_chay: machines.map((m) => ({
      may_id: m.mayId || null,
      ma_may: m.maMay,
      ten_may: m.tenMay,
      so_luong: toNum(m.soLuong),
      gio_bat_dau: m.gioBatDau || null,
      gio_ket_thuc: m.gioKetThuc || null,
    })),
    ...manpowerColumns(input),
    ghi_chu: input.ghiChu || null,
  };

  let { data, error } = await supabase
    .from("bao_cao_ngay_cong_viec")
    .insert(payload)
    .select("*")
    .single();
  if (error && /may_chay/.test(error.message ?? "")) {
    if (machines.length > 1) {
      throw new Error(
        "Chưa thể lưu nhiều máy cho một hạng mục vì migration_20261015_bao_cao_ngay_may_chay.sql chưa được chạy trên Supabase.",
      );
    }
    delete payload.may_chay;
    ({ data, error } = await supabase
      .from("bao_cao_ngay_cong_viec")
      .insert(payload)
      .select("*")
      .single());
  }
  if (error && /nhan_luc/.test(error.message ?? "")) {
    const multi =
      input.cht.length > 1 ||
      input.kySu.length > 1 ||
      input.laiMay.length > 1 ||
      input.thoVanHanh.length > 1 ||
      input.congNhan.length > 1 ||
      input.thucHien.length > 0;
    if (multi) {
      throw new Error(
        "Chưa thể lưu nhiều người cho một vai trò vì migration_20261020_bao_cao_ngay_nhan_luc_nhieu.sql chưa được chạy trên Supabase.",
      );
    }
    delete payload.nhan_luc;
    ({ data, error } = await supabase
      .from("bao_cao_ngay_cong_viec")
      .insert(payload)
      .select("*")
      .single());
  }
  if (error && /ten_moi_han|may_id/.test(error.message ?? "")) {
    if (payload.ten_moi_han || payload.may_id) {
      throw new Error(
        "Chưa thể lưu tên mối hàn / máy hàn ray vì migration_20261011_nhat_ky_han_gio_ten_theo_may.sql chưa được chạy trên Supabase.",
      );
    }
    delete payload.ten_moi_han;
    delete payload.may_id;
    ({ data, error } = await supabase
      .from("bao_cao_ngay_cong_viec")
      .insert(payload)
      .select("*")
      .single());
  }
  if (error) throw error;
  return mapWork(data as WorkRowDb);
}

export async function deleteWorkItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const store = readLocal();
    store.work = store.work.filter((w) => w.id !== id);
    writeLocal(store);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("bao_cao_ngay_cong_viec").delete().eq("id", id);
  if (error) throw error;
}

export async function insertEquipmentItem(
  ngayBaoCao: string,
  input: EquipmentItemInput,
): Promise<DailyEquipmentItem> {
  if (!isSupabaseConfigured()) {
    const header = ensureHeaderLocal(ngayBaoCao);
    const store = readLocal();
    const item: DailyEquipmentItem = {
      id: uid(),
      baoCaoId: header.id,
      thuTu: store.equipment.filter((e) => e.baoCaoId === header.id).length + 1,
      ...input,
    };
    store.equipment.push(item);
    writeLocal(store);
    return item;
  }

  const header = await ensureHeaderSupabase(ngayBaoCao);
  const supabase = createClient();
  const countRes = await supabase
    .from("bao_cao_ngay_thiet_bi")
    .select("id", { count: "exact", head: true })
    .eq("bao_cao_id", header.id);
  if (countRes.error) throw countRes.error;

  const payload = {
    bao_cao_id: header.id,
    thu_tu: (countRes.count ?? 0) + 1,
    ten_thiet_bi: input.tenThietBi,
    so_luong: toNum(input.soLuong),
    bo_phan: input.boPhan.trim() || null,
    nguoi_su_dung: input.nguoiSuDung.trim() || null,
    ghi_chu: input.ghiChu || null,
  };
  let { data, error } = await supabase.from("bao_cao_ngay_thiet_bi").insert(payload).select("*").single();
  if (error && /bo_phan|nguoi_su_dung/i.test(error.message ?? "")) {
    const { bo_phan: _a, nguoi_su_dung: _b, ...legacy } = payload;
    ({ data, error } = await supabase.from("bao_cao_ngay_thiet_bi").insert(legacy).select("*").single());
    if (!error && (input.boPhan.trim() || input.nguoiSuDung.trim())) {
      throw new Error(
        "Chưa thể lưu Bộ phận / Người sử dụng vì migration_20261020_bao_cao_ngay_thiet_bi_bo_phan.sql chưa được chạy trên Supabase.",
      );
    }
  }
  if (error) throw error;
  return mapEquipment(data as EquipmentRowDb);
}

export async function deleteEquipmentItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const store = readLocal();
    store.equipment = store.equipment.filter((e) => e.id !== id);
    writeLocal(store);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("bao_cao_ngay_thiet_bi").delete().eq("id", id);
  if (error) throw error;
}

export async function insertIncidentItem(
  ngayBaoCao: string,
  input: IncidentItemInput,
): Promise<DailyIncidentItem> {
  if (!isSupabaseConfigured()) {
    const header = ensureHeaderLocal(ngayBaoCao);
    const store = readLocal();
    const item: DailyIncidentItem = {
      id: uid(),
      baoCaoId: header.id,
      thuTu: store.incidents.filter((i) => i.baoCaoId === header.id).length + 1,
      ...input,
    };
    store.incidents.push(item);
    writeLocal(store);
    return item;
  }

  const header = await ensureHeaderSupabase(ngayBaoCao);
  const supabase = createClient();
  const countRes = await supabase
    .from("bao_cao_ngay_su_co")
    .select("id", { count: "exact", head: true })
    .eq("bao_cao_id", header.id);
  if (countRes.error) throw countRes.error;

  const payload = {
    bao_cao_id: header.id,
    thu_tu: (countRes.count ?? 0) + 1,
    noi_dung: input.noiDung,
    phuong_an_xu_ly: input.phuongAnXuLy || null,
    tinh_trang_xu_ly: input.tinhTrangXuLy || null,
    nguoi_bao_cao: input.nguoiBaoCao.trim() || null,
    bo_phan_bao_cao: input.boPhanBaoCao.trim() || null,
  };
  let { data, error } = await supabase.from("bao_cao_ngay_su_co").insert(payload).select("*").single();
  if (
    error &&
    /nguoi_bao_cao|bo_phan_bao_cao/i.test(error.message ?? "")
  ) {
    const { nguoi_bao_cao: _a, bo_phan_bao_cao: _b, ...legacy } = payload;
    ({ data, error } = await supabase.from("bao_cao_ngay_su_co").insert(legacy).select("*").single());
    if (!error && (input.nguoiBaoCao.trim() || input.boPhanBaoCao.trim())) {
      throw new Error(
        "Chưa thể lưu Người báo cáo / Bộ phận báo cáo vì migration_20261020_bao_cao_ngay_su_co_bao_cao.sql chưa được chạy trên Supabase.",
      );
    }
  }
  if (error) throw error;
  return mapIncident(data as IncidentRowDb);
}

export async function deleteIncidentItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const store = readLocal();
    store.incidents = store.incidents.filter((i) => i.id !== id);
    writeLocal(store);
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("bao_cao_ngay_su_co").delete().eq("id", id);
  if (error) throw error;
}

export function emptyWorkInput(workType?: DailyWorkType | null): WorkItemInput {
  return {
    congViecId: workType?.id ?? "",
    hangMuc: workType?.ten ?? "",
    tenMoiHan: "",
    tuyenHa: "",
    tuyenThuong: "",
    donVi: workType?.donViMacDinh || "mối hàn",
    denHomQua: "",
    homNay: "",
    tichLuy: "",
    mayChay: [],
    ...EMPTY_MANPOWER,
    ghiChu: "",
  };
}

export function emptyEquipmentInput(): EquipmentItemInput {
  return { tenThietBi: "", soLuong: "", boPhan: "", nguoiSuDung: "", ghiChu: "" };
}

export function emptyIncidentInput(): IncidentItemInput {
  return { noiDung: "", phuongAnXuLy: "", tinhTrangXuLy: "", nguoiBaoCao: "", boPhanBaoCao: "" };
}
