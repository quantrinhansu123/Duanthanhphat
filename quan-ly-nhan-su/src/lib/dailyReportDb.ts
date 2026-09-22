import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

export type WorkSection = "hom_nay" | "ngay_tiep_theo";

export type DailyWorkItem = {
  id: string;
  baoCaoId: string;
  phan: WorkSection;
  thuTu: number;
  hangMuc: string;
  tuyenHa: string;
  tuyenThuong: string;
  donVi: string;
  denHomQua: string;
  homNay: string;
  tichLuy: string;
  thietKe: string;
  loaiMay: string;
  mayBatDau: string;
  mayKetThuc: string;
  chtId: string;
  chtTen: string;
  kySuId: string;
  kySuTen: string;
  laiMayId: string;
  laiMayTen: string;
  thoVanHanhId: string;
  thoVanHanhTen: string;
  congNhanId: string;
  congNhanTen: string;
  nlBatDau: string;
  nlKetThuc: string;
  ghiChu: string;
};

export type DailyEquipmentItem = {
  id: string;
  baoCaoId: string;
  thuTu: number;
  tenThietBi: string;
  soLuong: string;
  ghiChu: string;
};

export type DailyIncidentItem = {
  id: string;
  baoCaoId: string;
  thuTu: number;
  noiDung: string;
  phuongAnXuLy: string;
  tinhTrangXuLy: string;
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
  hang_muc: string | null;
  tuyen_ha: string | null;
  tuyen_thuong: string | null;
  don_vi: string | null;
  den_hom_qua: number | string | null;
  hom_nay: number | string | null;
  tich_luy: number | string | null;
  thiet_ke: number | string | null;
  loai_may: string | null;
  may_bat_dau: string | null;
  may_ket_thuc: string | null;
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
  nl_bat_dau: string | null;
  nl_ket_thuc: string | null;
  ghi_chu: string | null;
};

type EquipmentRowDb = {
  id: string;
  bao_cao_id: string;
  thu_tu: number;
  ten_thiet_bi: string | null;
  so_luong: number | string | null;
  ghi_chu: string | null;
};

type IncidentRowDb = {
  id: string;
  bao_cao_id: string;
  thu_tu: number;
  noi_dung: string | null;
  phuong_an_xu_ly: string | null;
  tinh_trang_xu_ly: string | null;
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

function mapWork(row: WorkRowDb): DailyWorkItem {
  return {
    id: row.id,
    baoCaoId: row.bao_cao_id,
    phan: row.phan,
    thuTu: row.thu_tu,
    hangMuc: row.hang_muc ?? "",
    tuyenHa: row.tuyen_ha ?? "",
    tuyenThuong: row.tuyen_thuong ?? "",
    donVi: row.don_vi ?? "",
    denHomQua: numStr(row.den_hom_qua),
    homNay: numStr(row.hom_nay),
    tichLuy: numStr(row.tich_luy),
    thietKe: numStr(row.thiet_ke),
    loaiMay: row.loai_may ?? "",
    mayBatDau: row.may_bat_dau ?? "",
    mayKetThuc: row.may_ket_thuc ?? "",
    chtId: row.cht_id ?? "",
    chtTen: row.cht_ten ?? numStr(row.so_cht),
    kySuId: row.ky_su_id ?? "",
    kySuTen: row.ky_su_ten ?? numStr(row.so_ky_su),
    laiMayId: row.lai_may_id ?? "",
    laiMayTen: row.lai_may_ten ?? numStr(row.so_lai_may),
    thoVanHanhId: row.tho_van_hanh_id ?? "",
    thoVanHanhTen: row.tho_van_hanh_ten ?? numStr(row.so_tho_van_hanh),
    congNhanId: row.cong_nhan_id ?? "",
    congNhanTen: row.cong_nhan_ten ?? numStr(row.so_cong_nhan),
    nlBatDau: row.nl_bat_dau ?? "",
    nlKetThuc: row.nl_ket_thuc ?? "",
    ghiChu: row.ghi_chu ?? "",
  };
}

function mapEquipment(row: EquipmentRowDb): DailyEquipmentItem {
  return {
    id: row.id,
    baoCaoId: row.bao_cao_id,
    thuTu: row.thu_tu,
    tenThietBi: row.ten_thiet_bi ?? "",
    soLuong: numStr(row.so_luong),
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

function readLocal(): LocalStore {
  if (typeof window === "undefined") return emptyLocal();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return emptyLocal();
    const parsed = JSON.parse(raw) as LocalStore;
    return {
      headers: parsed.headers ?? [],
      work: parsed.work ?? [],
      equipment: parsed.equipment ?? [],
      incidents: parsed.incidents ?? [],
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
  chtId: "",
  chtTen: "",
  kySuId: "",
  kySuTen: "",
  laiMayId: "",
  laiMayTen: "",
  thoVanHanhId: "",
  thoVanHanhTen: "",
  congNhanId: "",
  congNhanTen: "",
};

function seedWorkToday(baoCaoId: string): DailyWorkItem[] {
  return [
    {
      id: uid(),
      baoCaoId,
      phan: "hom_nay",
      thuTu: 1,
      hangMuc: "Hàn nhiệt nhôm trên tuyến",
      tuyenHa: "",
      tuyenThuong: "",
      donVi: "mối hàn",
      denHomQua: "",
      homNay: "",
      tichLuy: "",
      thietKe: "",
      loaiMay: "Máy phát điện 5KVA",
      mayBatDau: "",
      mayKetThuc: "",
      ...EMPTY_MANPOWER,
      nlBatDau: "",
      nlKetThuc: "",
      ghiChu: "",
    },
    {
      id: uid(),
      baoCaoId,
      phan: "hom_nay",
      thuTu: 2,
      hangMuc: "Hàn cháy giáp mép trên tuyến",
      tuyenHa: "",
      tuyenThuong: "",
      donVi: "mối hàn",
      denHomQua: "",
      homNay: "",
      tichLuy: "",
      thietKe: "",
      loaiMay: "Máy hàn ray",
      mayBatDau: "",
      mayKetThuc: "",
      ...EMPTY_MANPOWER,
      nlBatDau: "",
      nlKetThuc: "",
      ghiChu: "",
    },
    {
      id: uid(),
      baoCaoId,
      phan: "hom_nay",
      thuTu: 3,
      hangMuc: "Hàn cháy giáp mép tại bãi hàn",
      tuyenHa: "",
      tuyenThuong: "",
      donVi: "mối hàn",
      denHomQua: "",
      homNay: "",
      tichLuy: "",
      thietKe: "",
      loaiMay: "Máy hàn ray",
      mayBatDau: "",
      mayKetThuc: "",
      ...EMPTY_MANPOWER,
      nlBatDau: "",
      nlKetThuc: "",
      ghiChu: "",
    },
  ];
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
  if (!isSupabaseConfigured()) {
    const store = readLocal();
    let header = store.headers.find((h) => h.ngayBaoCao === ngayBaoCao && !h.duAnId) ?? null;
    if (!header && store.headers.length === 0 && store.work.length === 0) {
      header = ensureHeaderLocal(ngayBaoCao);
      const refreshed = readLocal();
      return {
        header,
        workToday: refreshed.work.filter((w) => w.baoCaoId === header!.id && w.phan === "hom_nay"),
        workNext: refreshed.work.filter((w) => w.baoCaoId === header!.id && w.phan === "ngay_tiep_theo"),
        equipment: refreshed.equipment.filter((e) => e.baoCaoId === header!.id),
        incidents: refreshed.incidents.filter((i) => i.baoCaoId === header!.id),
        source: "local",
        error: "Chưa cấu hình Supabase — đang dùng bộ nhớ cục bộ",
      };
    }
    return {
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
    };
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
      return {
        header: null,
        workToday: [],
        workNext: [],
        equipment: [],
        incidents: [],
        source: "supabase",
      };
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
    return {
      header,
      workToday: work.filter((w) => w.phan === "hom_nay"),
      workNext: work.filter((w) => w.phan === "ngay_tiep_theo"),
      equipment: ((eqRes.data ?? []) as EquipmentRowDb[]).map(mapEquipment),
      incidents: ((incRes.data ?? []) as IncidentRowDb[]).map(mapIncident),
      source: "supabase",
    };
  } catch (error) {
    return {
      header: null,
      workToday: [],
      workNext: [],
      equipment: [],
      incidents: [],
      source: "local",
      error: formatSupabaseError(error),
    };
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

  const payload = {
    bao_cao_id: header.id,
    phan,
    thu_tu: (countRes.count ?? 0) + 1,
    hang_muc: input.hangMuc,
    tuyen_ha: input.tuyenHa || null,
    tuyen_thuong: input.tuyenThuong || null,
    don_vi: input.donVi || null,
    den_hom_qua: toNum(input.denHomQua),
    hom_nay: toNum(input.homNay),
    tich_luy: toNum(input.tichLuy),
    thiet_ke: toNum(input.thietKe),
    loai_may: input.loaiMay || null,
    may_bat_dau: input.mayBatDau || null,
    may_ket_thuc: input.mayKetThuc || null,
    cht_id: input.chtId || null,
    cht_ten: input.chtTen || null,
    ky_su_id: input.kySuId || null,
    ky_su_ten: input.kySuTen || null,
    lai_may_id: input.laiMayId || null,
    lai_may_ten: input.laiMayTen || null,
    tho_van_hanh_id: input.thoVanHanhId || null,
    tho_van_hanh_ten: input.thoVanHanhTen || null,
    cong_nhan_id: input.congNhanId || null,
    cong_nhan_ten: input.congNhanTen || null,
    nl_bat_dau: input.nlBatDau || null,
    nl_ket_thuc: input.nlKetThuc || null,
    ghi_chu: input.ghiChu || null,
  };

  const { data, error } = await supabase
    .from("bao_cao_ngay_cong_viec")
    .insert(payload)
    .select("*")
    .single();
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

  const { data, error } = await supabase
    .from("bao_cao_ngay_thiet_bi")
    .insert({
      bao_cao_id: header.id,
      thu_tu: (countRes.count ?? 0) + 1,
      ten_thiet_bi: input.tenThietBi,
      so_luong: toNum(input.soLuong),
      ghi_chu: input.ghiChu || null,
    })
    .select("*")
    .single();
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

  const { data, error } = await supabase
    .from("bao_cao_ngay_su_co")
    .insert({
      bao_cao_id: header.id,
      thu_tu: (countRes.count ?? 0) + 1,
      noi_dung: input.noiDung,
      phuong_an_xu_ly: input.phuongAnXuLy || null,
      tinh_trang_xu_ly: input.tinhTrangXuLy || null,
    })
    .select("*")
    .single();
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

export function emptyWorkInput(): WorkItemInput {
  return {
    hangMuc: "",
    tuyenHa: "",
    tuyenThuong: "",
    donVi: "mối hàn",
    denHomQua: "",
    homNay: "",
    tichLuy: "",
    thietKe: "",
    loaiMay: "",
    mayBatDau: "",
    mayKetThuc: "",
    ...EMPTY_MANPOWER,
    nlBatDau: "",
    nlKetThuc: "",
    ghiChu: "",
  };
}

export function emptyEquipmentInput(): EquipmentItemInput {
  return { tenThietBi: "", soLuong: "", ghiChu: "" };
}

export function emptyIncidentInput(): IncidentItemInput {
  return { noiDung: "", phuongAnXuLy: "", tinhTrangXuLy: "" };
}
