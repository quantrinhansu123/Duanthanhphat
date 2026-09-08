import {
  machines as seedMachines,
  normalizeTechnicalDocs,
  type Machine,
} from "@/data/machines";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

const LOCAL_STORAGE_MACHINES_KEY = "tp_machines_extended_v3";

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
  thong_so_may_han?: Record<string, unknown> | null;
  phuong_tien_van_chuyen?: Record<string, unknown> | null;
  ho_so_ky_thuat?: unknown;
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
  const status = normalizeStatus(row.trang_thai || "Sẵn sàng");
  const code = (row.ma_may || "").trim() || `MAY-${row.id.slice(0, 8)}`;
  const model = determineModel(code, row.model || local?.model || seed?.model);
  const safeImage = resolveSafeImage(row.hinh_anh || local?.image || seed?.image, code);

  const weldCountRaw =
    row.tong_moi_han !== null && row.tong_moi_han !== undefined
      ? Number(row.tong_moi_han)
      : local?.weldCount ?? seed?.weldCount ?? 0;
  const operatingHoursRaw =
    row.gio_hoat_dong !== null && row.gio_hoat_dong !== undefined
      ? Number(row.gio_hoat_dong)
      : local?.operatingHours ?? seed?.operatingHours ?? 0;

  return {
    id: row.id,
    code,
    name: row.ten_may || local?.name || seed?.name || `Máy hàn ${code}`,
    model,
    type:
      row.loai_may ||
      local?.type ||
      seed?.type ||
      (code.startsWith("KCM")
        ? "Tổ hợp máy hàn ray lưu động gắn trên xe tải (Road-Rail)"
        : "Máy hàn tiếp xúc đối đầu ray lưu động"),
    nameEn: seed?.nameEn,
    nameVi: seed?.nameVi,
    brand: local?.brand || seed?.brand || "",
    manufacturer:
      local?.manufacturer ||
      seed?.manufacturer ||
      "",
    plant: local?.plant || seed?.plant || "",
    location: row.vi_tri_hien_tai?.trim() || local?.location || seed?.location || "Chưa cập nhật",
    currentProject: row.du_an_hien_tai || local?.currentProject || seed?.currentProject || "",
    status,
    available: status === "Sẵn sàng",
    weldCount: Number.isFinite(weldCountRaw) ? weldCountRaw : 0,
    image: safeImage,
    gallery:
      (row.hinh_anh_chi_tiet && row.hinh_anh_chi_tiet.length > 0
        ? row.hinh_anh_chi_tiet.map((img) => resolveSafeImage(img, code))
        : undefined) ||
      local?.gallery ||
      seed?.gallery ||
      (code.startsWith("UN5")
        ? [
            "/may-han/un5-150zc2-c6-main.jpg",
            "/may-han/un5-150zc2-c6-detail.jpg",
            "/may-han/un5-150zc2-c6-action.jpg",
          ]
        : ["/may-han/kcm007.jpg"]),
    serialNumber:
      row.so_serial ||
      local?.serialNumber ||
      seed?.serialNumber ||
      "",
    yearInstalled:
      row.nam_san_xuat ||
      local?.yearInstalled ||
      seed?.yearInstalled ||
      0,
    weldingTechnology:
      row.cong_nghe_han ||
      local?.weldingTechnology ||
      seed?.weldingTechnology ||
      "",
    supportedRails:
      row.loai_ray_ho_tro ||
      local?.supportedRails ||
      seed?.supportedRails ||
      "",
    weldingCapacity:
      row.nang_suat_han ||
      local?.weldingCapacity ||
      seed?.weldingCapacity ||
      "",
    operator: local?.operator || seed?.operator || "",
    personInCharge:
      row.nguoi_phu_trach ||
      local?.personInCharge ||
      seed?.personInCharge ||
      "",
    team: row.to_van_hanh || local?.team || seed?.team || "",
    lastMaintenance:
      row.ngay_bao_tri_gan_nhat ||
      local?.lastMaintenance ||
      seed?.lastMaintenance ||
      "—",
    nextMaintenance:
      row.ngay_bao_tri_tiep_theo ||
      local?.nextMaintenance ||
      seed?.nextMaintenance ||
      "—",
    operatingHours: Number.isFinite(operatingHoursRaw) ? operatingHoursRaw : 0,
    errorRate: local?.errorRate || seed?.errorRate || "—",
    note: row.ghi_chu || local?.note || seed?.note || "",
    specs: (row.thong_so as Machine["specs"]) || local?.specs || seed?.specs,
    weldingUnit: ((row.thong_so_may_han as unknown as Machine["weldingUnit"]) ||
      local?.weldingUnit ||
      seed?.weldingUnit) ?? {
      code,
      name: row.ten_may || `Máy hàn ${code}`,
      model,
      serial: row.so_serial || seed?.serialNumber,
      coverImage: safeImage,
      gallery: (row.hinh_anh_chi_tiet && row.hinh_anh_chi_tiet.length > 0)
        ? row.hinh_anh_chi_tiet.map((img) => resolveSafeImage(img, code))
        : seed?.gallery || [safeImage],
      specs: {},
    },
    transportUnit: ((row.phuong_tien_van_chuyen as unknown as Machine["transportUnit"]) ||
      local?.transportUnit ||
      seed?.transportUnit),
    technicalDocs: normalizeTechnicalDocs(
      row.ho_so_ky_thuat ?? local?.technicalDocs ?? seed?.technicalDocs,
    ),
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
      try {
        const mapped = rows.map(rowToMachine).filter((m) => Boolean(m.code));
        if (mapped.length > 0) {
          return {
            machines: mapped,
            source: "supabase",
          };
        }
      } catch (mapError) {
        const overrides = readLocalOverrides();
        const merged = seedMachines.map((m) => overrides[m.code] || m);
        return {
          machines: merged,
          source: "seed",
          error: mapError instanceof Error ? mapError.message : "Lỗi ánh xạ dữ liệu máy",
        };
      }
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

function missingSplitMachineColumns(error: unknown) {
  const message = formatSupabaseError(error).toLowerCase();
  return message.includes("thong_so_may_han") || message.includes("phuong_tien_van_chuyen");
}

function missingTechnicalDocsColumn(error: unknown) {
  const message = formatSupabaseError(error).toLowerCase();
  return message.includes("ho_so_ky_thuat");
}

function withoutSplitMachineColumns(payload: Record<string, unknown>) {
  const compatible = { ...payload };
  delete compatible.thong_so_may_han;
  delete compatible.phuong_tien_van_chuyen;
  return compatible;
}

function withoutTechnicalDocsColumn(payload: Record<string, unknown>) {
  const compatible = { ...payload };
  delete compatible.ho_so_ky_thuat;
  return compatible;
}

async function insertMachineRow(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
) {
  let result = await supabase.from("thiet_bi").insert(payload).select().single();
  let usedCompatibilityFallback = false;

  if (result.error && missingTechnicalDocsColumn(result.error)) {
    result = await supabase
      .from("thiet_bi")
      .insert(withoutTechnicalDocsColumn(payload))
      .select()
      .single();
  }

  if (result.error && missingSplitMachineColumns(result.error)) {
    usedCompatibilityFallback = true;
    let stripped = withoutSplitMachineColumns(payload);
    result = await supabase.from("thiet_bi").insert(stripped).select().single();
    if (result.error && missingTechnicalDocsColumn(result.error)) {
      result = await supabase
        .from("thiet_bi")
        .insert(withoutTechnicalDocsColumn(stripped))
        .select()
        .single();
    }
  }

  return { result, usedCompatibilityFallback };
}

async function updateMachineRow(
  supabase: ReturnType<typeof createClient>,
  machineId: string,
  payload: Record<string, unknown>,
) {
  let result = await supabase.from("thiet_bi").update(payload).eq("id", machineId);

  if (result.error && missingTechnicalDocsColumn(result.error)) {
    result = await supabase
      .from("thiet_bi")
      .update(withoutTechnicalDocsColumn(payload))
      .eq("id", machineId);
  }

  if (result.error && missingSplitMachineColumns(result.error)) {
    let stripped = withoutSplitMachineColumns(payload);
    result = await supabase.from("thiet_bi").update(stripped).eq("id", machineId);
    if (result.error && missingTechnicalDocsColumn(result.error)) {
      result = await supabase
        .from("thiet_bi")
        .update(withoutTechnicalDocsColumn(stripped))
        .eq("id", machineId);
    }
  }

  return result;
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
    thong_so_may_han: machine.weldingUnit ?? null,
    phuong_tien_van_chuyen: machine.transportUnit ?? null,
    ho_so_ky_thuat: normalizeTechnicalDocs(machine.technicalDocs),
  };

  const { result: insertResult, usedCompatibilityFallback } = await insertMachineRow(
    supabase,
    extendedPayload,
  );

  const { data, error } = insertResult;

  if (error) {
    throw new Error(`Lỗi lưu máy lên Supabase: ${formatSupabaseError(error)}`);
  }

  const mapped = rowToMachine(data as MachineCatalogRow);
  const saved = {
    ...mapped,
    ...(usedCompatibilityFallback
      ? {
          weldingUnit: machine.weldingUnit,
          transportUnit: machine.transportUnit,
        }
      : {}),
    technicalDocs: normalizeTechnicalDocs(machine.technicalDocs ?? mapped.technicalDocs),
  };
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
    thong_so_may_han: machine.weldingUnit ?? null,
    phuong_tien_van_chuyen: machine.transportUnit ?? null,
    ho_so_ky_thuat: normalizeTechnicalDocs(machine.technicalDocs),
  };

  const updateResult = await updateMachineRow(supabase, machine.id, extendedPayload);

  const { error } = updateResult;

  if (error) {
    throw new Error(`Lỗi cập nhật máy lên Supabase: ${formatSupabaseError(error)}`);
  }

  writeLocalOverride({
    ...machine,
    technicalDocs: normalizeTechnicalDocs(machine.technicalDocs),
  });
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
