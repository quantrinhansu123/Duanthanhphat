import {
  machines as seedMachines,
  type Machine,
} from "@/data/machines";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

const LOCAL_STORAGE_MACHINES_KEY = "tp_machines_extended_v2";

type MachineCatalogRow = {
  id: string;
  ma_may: string;
  ten_may: string;
  vi_tri_hien_tai: string | null;
  hinh_anh: string | null;
  trang_thai: string;
  model?: string | null;
  loai_may?: string | null;
  so_serial?: string | null;
  nam_san_xuat?: number | null;
  cong_nghe_han?: string | null;
  loai_ray_ho_tro?: string | null;
  nang_suat_han?: string | null;
  gio_hoat_dong?: number | null;
  tong_moi_han?: number | null;
  du_an_hien_tai?: string | null;
  nguoi_phu_trach?: string | null;
  to_van_hanh?: string | null;
  ngay_bao_tri_gan_nhat?: string | null;
  ngay_bao_tri_tiep_theo?: string | null;
  ghi_chu?: string | null;
  thong_so?: Record<string, unknown> | null;
  hinh_anh_chi_tiet?: string[] | null;
};

const validStatuses = new Set<Machine["status"]>([
  "Đang làm việc",
  "Sẵn sàng",
  "Bảo trì",
  "Hỏng",
]);

function normalizeStatus(status: string): Machine["status"] {
  if (validStatuses.has(status as Machine["status"])) return status as Machine["status"];
  if (status === "Hoạt động") return "Đang làm việc";
  return status === "Bảo trì" ? "Bảo trì" : status === "Hỏng" ? "Hỏng" : "Sẵn sàng";
}

function readLocalOverrides(): Record<string, Machine> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_MACHINES_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeLocalOverride(machine: Machine) {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalOverrides();
    current[machine.code] = machine;
    current[machine.id] = machine;
    window.localStorage.setItem(LOCAL_STORAGE_MACHINES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Lỗi lưu cấu hình máy vào LocalStorage:", err);
  }
}

function deleteLocalOverride(idOrCode: string) {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalOverrides();
    delete current[idOrCode];
    window.localStorage.setItem(LOCAL_STORAGE_MACHINES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Lỗi xóa cấu hình máy trong LocalStorage:", err);
  }
}

function resolveSafeImage(image: string | null | undefined, code: string): string {
  if (!image || image.endsWith(".svg") || image.includes("unsplash.com")) {
    return code.startsWith("KCM") ? "/may-han/kcm007.jpg" : "/may-han/un5-150zc2-c6-main.jpg";
  }
  return image;
}

function determineModel(code: string, rowModel?: string | null): string {
  if (rowModel?.trim()) return rowModel.trim();
  if (code.startsWith("KCM")) return "KCM-007 (K922-1)";
  if (code.startsWith("UN5")) return "UN5-150ZC2-C6";
  if (code.startsWith("K920")) return "K920";
  if (code.startsWith("AMS")) return "AMS60";
  if (code.startsWith("K355")) return "K355";
  if (code.startsWith("GEO")) return "GEO";
  return code;
}

function rowToMachine(row: MachineCatalogRow): Machine {
  const overrides = readLocalOverrides();
  const local = overrides[row.ma_may] || overrides[row.id];
  const seed = seedMachines.find((m) => m.code === row.ma_may);
  const status = normalizeStatus(row.trang_thai);
  const code = row.ma_may;
  const model = determineModel(code, local?.model ?? (row.model || seed?.model));
  const safeImage = resolveSafeImage(local?.image || row.hinh_anh || seed?.image, code);

  return {
    id: row.id,
    code,
    name: local?.name || row.ten_may || seed?.name || `Máy hàn ${code}`,
    model,
    type:
      local?.type ||
      row.loai_may ||
      seed?.type ||
      (code.startsWith("KCM")
        ? "Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)"
        : "Máy hàn tiếp xúc đối đầu ray lưu động"),
    nameEn: seed?.nameEn,
    nameVi: seed?.nameVi,
    brand: local?.brand || seed?.brand || "TCW",
    manufacturer:
      local?.manufacturer ||
      seed?.manufacturer ||
      (code.startsWith("KCM") ? "Chengdu Aigre Technology / TCW" : "Chengdu Aigre Technology"),
    plant: local?.plant || seed?.plant || "Trung tâm Cơ giới TCW",
    location: row.vi_tri_hien_tai?.trim() || local?.location || seed?.location || "Chưa cập nhật",
    currentProject: local?.currentProject || row.du_an_hien_tai || seed?.currentProject || "Dự án đường sắt",
    status,
    available: status === "Sẵn sàng",
    weldCount:
      local?.weldCount ??
      (row.tong_moi_han ? Number(row.tong_moi_han) : seed?.weldCount ?? 0),
    image: safeImage,
    gallery:
      local?.gallery ||
      (row.hinh_anh_chi_tiet && row.hinh_anh_chi_tiet.length > 0
        ? row.hinh_anh_chi_tiet.map((img) => resolveSafeImage(img, code))
        : undefined) ||
      seed?.gallery ||
      (code.startsWith("UN5")
        ? [
            "/may-han/un5-150zc2-c6-main.jpg",
            "/may-han/un5-150zc2-c6-detail.jpg",
            "/may-han/un5-150zc2-c6-action.jpg",
          ]
        : ["/may-han/kcm007.jpg"]),
    serialNumber:
      local?.serialNumber ||
      row.so_serial ||
      seed?.serialNumber ||
      "Chờ cập nhật theo hồ sơ bàn giao thiết bị",
    yearInstalled:
      local?.yearInstalled ||
      row.nam_san_xuat ||
      seed?.yearInstalled ||
      2021,
    weldingTechnology:
      local?.weldingTechnology ||
      row.cong_nghe_han ||
      seed?.weldingTechnology ||
      "Flash Butt Welding – FBW (Hàn tiếp xúc đối đầu)",
    supportedRails:
      local?.supportedRails ||
      row.loai_ray_ho_tro ||
      seed?.supportedRails ||
      "43 – 75 kg/m · Khổ ray 1.435 mm",
    weldingCapacity:
      local?.weldingCapacity ||
      row.nang_suat_han ||
      seed?.weldingCapacity ||
      "12 mối/giờ",
    operator: local?.operator || seed?.operator || "Chưa phân công",
    personInCharge:
      local?.personInCharge ||
      row.nguoi_phu_trach ||
      seed?.personInCharge ||
      "Kỹ sư trưởng TCW",
    team: local?.team || row.to_van_hanh || seed?.team || "Tổ hàn cơ giới",
    lastMaintenance:
      local?.lastMaintenance ||
      row.ngay_bao_tri_gan_nhat ||
      seed?.lastMaintenance ||
      "—",
    nextMaintenance:
      local?.nextMaintenance ||
      row.ngay_bao_tri_tiep_theo ||
      seed?.nextMaintenance ||
      "—",
    operatingHours:
      local?.operatingHours ??
      (row.gio_hoat_dong ? Number(row.gio_hoat_dong) : seed?.operatingHours ?? 0),
    errorRate: local?.errorRate || seed?.errorRate || "0,0%",
    note: local?.note || row.ghi_chu || seed?.note || "",
    specs: local?.specs || (row.thong_so as Machine["specs"]) || seed?.specs,
  };
}

export async function loadMachineCatalog(): Promise<{
  machines: Machine[];
  source: "supabase" | "seed";
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    const overrides = readLocalOverrides();
    const merged = seedMachines.map((m) => overrides[m.code] || m);
    return { machines: merged, source: "seed" };
  }

  const supabase = createClient();

  try {
    // Try to select extended columns if they exist
    const { data, error } = await supabase
      .from("thiet_bi")
      .select("*")
      .order("ma_may", { ascending: true });

    if (error) {
      // Fall back to basic columns
      const { data: basicData, error: basicError } = await supabase
        .from("thiet_bi")
        .select("id,ma_may,ten_may,vi_tri_hien_tai,hinh_anh,trang_thai")
        .order("ma_may", { ascending: true });

      if (basicError) {
        const overrides = readLocalOverrides();
        const merged = seedMachines.map((m) => overrides[m.code] || m);
        return { machines: merged, source: "seed", error: formatSupabaseError(basicError) };
      }

      const rows = (basicData ?? []) as MachineCatalogRow[];
      return {
        machines: rows.map(rowToMachine),
        source: "supabase",
      };
    }

    const rows = (data ?? []) as MachineCatalogRow[];

    // If Supabase returned rows
    if (rows.length > 0) {
      const mapped = rows.map(rowToMachine);
      return {
        machines: mapped,
        source: "supabase",
      };
    }

    // If table is completely empty, use seeds
    return { machines: seedMachines, source: "seed" };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const overrides = readLocalOverrides();
    const merged = seedMachines.map((m) => overrides[m.code] || m);
    return { machines: merged, source: "seed", error: errorMsg };
  }
}

export async function syncRealMachinesToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, count: 0, error: "Chưa cấu hình Supabase" };
  }

  const supabase = createClient();
  let count = 0;

  for (const machine of seedMachines) {
    const safeImage = resolveSafeImage(machine.image, machine.code);
    const payload: Record<string, unknown> = {
      ma_may: machine.code,
      ten_may: machine.name,
      vi_tri_hien_tai: machine.location,
      trang_thai: machine.status,
      hinh_anh: safeImage,
    };

    try {
      const { error } = await supabase
        .from("thiet_bi")
        .upsert(payload, { onConflict: "ma_may" });
      if (!error) count++;
    } catch {
      // ignore
    }
  }

  return { success: count > 0, count };
}

function machineBasicPayload(machine: Machine) {
  return {
    ma_may: machine.code.trim(),
    ten_may: machine.name.trim(),
    vi_tri_hien_tai: machine.location.trim(),
    trang_thai: machine.status,
    hinh_anh: resolveSafeImage(machine.image, machine.code),
  };
}

export async function createMachine(machine: Machine): Promise<Machine> {
  if (!isSupabaseConfigured()) {
    writeLocalOverride(machine);
    return machine;
  }

  const supabase = createClient();

  const extendedPayload = {
    ...machineBasicPayload(machine),
    model: machine.model,
    loai_may: machine.type,
    so_serial: machine.serialNumber,
    nam_san_xuat: machine.yearInstalled,
    cong_nghe_han: machine.weldingTechnology,
    loai_ray_ho_tro: machine.supportedRails,
    nang_suat_han: machine.weldingCapacity,
    gio_hoat_dong: machine.operatingHours,
    tong_moi_han: machine.weldCount,
    du_an_hien_tai: machine.currentProject,
    nguoi_phu_trach: machine.personInCharge,
    to_van_hanh: machine.team,
    ngay_bao_tri_gan_nhat: machine.lastMaintenance,
    ngay_bao_tri_tiep_theo: machine.nextMaintenance,
    ghi_chu: machine.note,
    thong_so: machine.specs,
    hinh_anh_chi_tiet:
      machine.gallery && machine.gallery.length > 0
        ? machine.gallery
        : (machine.image ? [machine.image] : []),
  };

  const { data, error } = await supabase
    .from("thiet_bi")
    .insert(extendedPayload)
    .select()
    .single();

  if (error) {
    throw new Error(`Lỗi lưu máy lên Supabase: ${formatSupabaseError(error)}`);
  }

  const saved = rowToMachine(data as MachineCatalogRow);
  writeLocalOverride(saved);
  return saved;
}

export async function updateMachine(machine: Machine): Promise<void> {
  if (!isSupabaseConfigured()) {
    writeLocalOverride(machine);
    return;
  }

  const supabase = createClient();

  const extendedPayload = {
    ...machineBasicPayload(machine),
    model: machine.model,
    loai_may: machine.type,
    so_serial: machine.serialNumber,
    nam_san_xuat: machine.yearInstalled,
    cong_nghe_han: machine.weldingTechnology,
    loai_ray_ho_tro: machine.supportedRails,
    nang_suat_han: machine.weldingCapacity,
    gio_hoat_dong: machine.operatingHours,
    tong_moi_han: machine.weldCount,
    du_an_hien_tai: machine.currentProject,
    nguoi_phu_trach: machine.personInCharge,
    to_van_hanh: machine.team,
    ngay_bao_tri_gan_nhat: machine.lastMaintenance,
    ngay_bao_tri_tiep_theo: machine.nextMaintenance,
    ghi_chu: machine.note,
    thong_so: machine.specs,
    hinh_anh_chi_tiet:
      machine.gallery && machine.gallery.length > 0
        ? machine.gallery
        : (machine.image ? [machine.image] : []),
  };

  const { error } = await supabase
    .from("thiet_bi")
    .update(extendedPayload)
    .eq("id", machine.id);

  if (error) {
    throw new Error(`Lỗi cập nhật máy lên Supabase: ${formatSupabaseError(error)}`);
  }

  writeLocalOverride(machine);
}

export async function deleteMachine(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { error } = await supabase.from("thiet_bi").delete().eq("id", id);
    if (error) {
      throw new Error(`Lỗi xóa máy trên Supabase: ${formatSupabaseError(error)}`);
    }
  }

  deleteLocalOverride(id);
}
