import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import {
  TB15_CATALOG_KEYS,
  type Tb15CatalogKey,
  type Tb15Row,
  type Tb15Wheel,
  catalogByKey,
} from "@/lib/tb15Catalogs";
import { TB15_SEED } from "@/lib/tb15CatalogSeed";

type JsonBundle = Record<Tb15CatalogKey, Tb15Row[]>;

const JSON_FILE = "tb15-catalogs.json";

function emptyBundle(): JsonBundle {
  return {
    khi_hau: [],
    loai_ray: [],
    mac_thep: [],
    ket_cau_duong: [],
    do_cung_goi: [],
    on_dinh_nen: [],
    mo_men_can: [],
    he_so_tai: [],
    so_do_tai: [],
  };
}

async function readJsonBundle(): Promise<JsonBundle> {
  const stored = await readPrivateJson<JsonBundle>(JSON_FILE);
  const seededClimate = TB15_SEED.khi_hau ?? [];
  if (!stored) {
    const seeded = { ...emptyBundle(), ...TB15_SEED };
    await writePrivateJson(JSON_FILE, seeded);
    return seeded;
  }
  const bundle = { ...emptyBundle(), ...stored };
  // File JSON cũ chưa có khóa catalog mới: seed một lần. Mảng rỗng (đã xóa hết) thì giữ nguyên.
  let seededNewCatalog = false;
  for (const key of TB15_CATALOG_KEYS) {
    if (key === "khi_hau") continue;
    if (Object.prototype.hasOwnProperty.call(stored, key)) continue;
    const seed = TB15_SEED[key];
    if (!seed?.length) continue;
    bundle[key] = seed.map((row) => ({ ...row }));
    seededNewCatalog = true;
  }
  // Chỉ nâng cấp một lần khi còn bản cũ (trống hoặc chưa có dòng nào có dữ liệu theo tháng);
  // sau đó người dùng thêm / xóa trạm thì không bị seed khôi phục lại.
  const climateOutdated = !(bundle.khi_hau ?? []).some(
    (r) => Array.isArray(r.t_max_thang) && Array.isArray(r.t_min_thang),
  );
  if (seededClimate.length > 0 && climateOutdated) {
    // Gộp: lấy bản QCVN (có theo tháng) và giữ các trạm do người dùng tự thêm.
    const seedNames = new Set(seededClimate.map((r) => String(r.ten_tram ?? "").trim().toLowerCase()));
    const custom = (bundle.khi_hau ?? []).filter(
      (r) => !seedNames.has(String(r.ten_tram ?? "").trim().toLowerCase()),
    );
    bundle.khi_hau = [...seededClimate, ...custom];
    seededNewCatalog = true;
  }
  // Bản JSON đã lưu trước khi có B.0.4-3 (l₀, i₀, ΔP) và WJ d: bổ sung đúng trường còn thiếu theo seed.
  // Chỉ điền ô undefined, hoặc d_kn_mm null của phương án WJ (seed đã có số). Không ghi đè số người dùng nhập.
  for (const key of ["loai_ray", "do_cung_goi"] as const) {
    for (const row of bundle[key] ?? []) {
      const seedRow = (TB15_SEED[key] ?? []).find((s) => s.id === row.id);
      if (!seedRow) continue;
      for (const [field, value] of Object.entries(seedRow)) {
        const missing = row[field] === undefined;
        const wjBlankD = key === "do_cung_goi" && field === "d_kn_mm" && row[field] === null && value !== null;
        if (missing || wjBlankD) {
          row[field] = value;
          seededNewCatalog = true;
        }
      }
    }
  }
  if (seededNewCatalog) await writePrivateJson(JSON_FILE, bundle);
  return bundle;
}

async function writeJsonBundle(bundle: JsonBundle) {
  await writePrivateJson(JSON_FILE, bundle);
}

function isMissingRelation(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = error.message || "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg)
  );
}

async function trySupabaseList(key: Tb15CatalogKey): Promise<Tb15Row[] | null> {
  const meta = catalogByKey(key);
  if (!meta) return [];
  try {
    const db = createAdminClient();
    if (key === "so_do_tai") {
      const { data, error } = await db.from(meta.table).select("*, wheels:tb15_so_do_tai_banh(*)").order("ma");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        wheels: Array.isArray(row.wheels)
          ? [...row.wheels].sort((a: Tb15Wheel, b: Tb15Wheel) => a.stt - b.stt)
          : [],
      }));
    }
    const { data, error } = await db.from(meta.table).select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    if (isMissingRelation(e as { message?: string; code?: string })) return null;
    throw e;
  }
}

async function listCatalogRaw(key: Tb15CatalogKey): Promise<{ rows: Tb15Row[]; backend: "supabase" | "json" }> {
  const fromDb = await trySupabaseList(key);
  if (fromDb) return { rows: fromDb, backend: "supabase" };
  const bundle = await readJsonBundle();
  return { rows: bundle[key] ?? [], backend: "json" };
}

/** Bổ sung 12 tháng (A.5 / A.6) từ seed QCVN theo tên trạm khi bản ghi đọc được chưa có cột tháng. */
function withSeedMonthly(rows: Tb15Row[]): Tb15Row[] {
  const seedByName = new Map(
    (TB15_SEED.khi_hau ?? []).map((r) => [String(r.ten_tram ?? "").trim().toLowerCase(), r] as const),
  );
  return rows.map((row) => {
    if (Array.isArray(row.t_max_thang) && Array.isArray(row.t_min_thang)) return row;
    const seed = seedByName.get(String(row.ten_tram ?? "").trim().toLowerCase());
    if (!seed) return row;
    return { ...row, t_max_thang: seed.t_max_thang, t_min_thang: seed.t_min_thang };
  });
}

export async function listCatalog(key: Tb15CatalogKey): Promise<{ rows: Tb15Row[]; backend: "supabase" | "json" }> {
  const result = await listCatalogRaw(key);
  if (key === "khi_hau") return { ...result, rows: withSeedMonthly(result.rows) };
  return result;
}

function cleanPayload(key: Tb15CatalogKey, raw: Record<string, unknown>, id?: string): Tb15Row {
  const meta = catalogByKey(key);
  if (!meta) throw new Error("Bảng không hợp lệ.");
  const row: Tb15Row = { id: id || crypto.randomUUID() };
  for (const field of meta.fields) {
    const value = raw[field.key];
    if (field.type === "number") {
      if (value === "" || value === null || value === undefined) {
        if (field.required) throw new Error(`Thiếu ${field.label}.`);
        row[field.key] = null;
        continue;
      }
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`${field.label} không hợp lệ.`);
      row[field.key] = n;
      continue;
    }
    const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
    if (field.required && !text) throw new Error(`Thiếu ${field.label}.`);
    if (field.type === "select" && field.options && text && !field.options.some((o) => o.value === text)) {
      throw new Error(`${field.label} không hợp lệ.`);
    }
    row[field.key] = text;
  }
  if (key === "so_do_tai") {
    const wheelsRaw = Array.isArray(raw.wheels) ? raw.wheels : [];
    const wheels: Tb15Wheel[] = wheelsRaw
      .map((w, i) => {
        const item = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
        return {
          id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
          stt: Number(item.stt ?? i + 1),
          x_m: Number(item.x_m),
          p_j_kn: Number(item.p_j_kn),
        };
      })
      .filter((w) => Number.isFinite(w.stt) && Number.isFinite(w.x_m) && Number.isFinite(w.p_j_kn))
      .slice(0, 12);
    if (!wheels.length) throw new Error("Sơ đồ tải cần ít nhất một bánh (x, P_j).");
    row.wheels = wheels;
  }
  if (key === "khi_hau") {
    // Nhập theo tháng (QCVN A.5 cao nhất / A.6 thấp nhất); nhiệt độ năm tự tính = max / min của 12 tháng.
    const parseMonths = (v: unknown, label: string): number[] => {
      if (!Array.isArray(v) || v.length !== 12) throw new Error(`Thiếu đủ 12 giá trị tháng của ${label}.`);
      return v.map((x, i) => {
        const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
        if (!Number.isFinite(n)) throw new Error(`${label} tháng ${i + 1} không hợp lệ.`);
        return n;
      });
    };
    const maxM = parseMonths(raw.t_max_thang, "nhiệt độ kk cao nhất");
    const minM = parseMonths(raw.t_min_thang, "nhiệt độ kk thấp nhất");
    maxM.forEach((v, i) => {
      if (v < minM[i]) throw new Error(`Tháng ${i + 1}: nhiệt độ cao nhất phải ≥ nhiệt độ thấp nhất.`);
    });
    row.t_max_thang = maxM;
    row.t_min_thang = minM;
    row.t_kk_max = Math.max(...maxM);
    row.t_kk_min = Math.min(...minM);
  }
  row.updated_at = new Date().toISOString();
  if (!id) row.created_at = row.updated_at;
  return row;
}

async function saveSupabase(key: Tb15CatalogKey, row: Tb15Row, editing: boolean): Promise<boolean> {
  const meta = catalogByKey(key);
  if (!meta) return false;
  try {
    const db = createAdminClient();
    if (key === "so_do_tai") {
      const { wheels, ...header } = row;
      const payload = {
        id: header.id,
        ma: header.ma,
        ten: header.ten,
        mo_ta: header.mo_ta ?? "",
        updated_at: new Date().toISOString(),
      };
      const upsert = editing
        ? await db.from(meta.table).update(payload).eq("id", header.id).select("id").maybeSingle()
        : await db.from(meta.table).insert({ ...payload, created_at: new Date().toISOString() }).select("id").maybeSingle();
      if (upsert.error) throw upsert.error;
      if (editing) {
        const del = await db.from("tb15_so_do_tai_banh").delete().eq("so_do_id", header.id);
        if (del.error) throw del.error;
      }
      const wheelRows = (wheels ?? []).map((w) => ({
        id: w.id || crypto.randomUUID(),
        so_do_id: header.id,
        stt: w.stt,
        x_m: w.x_m,
        p_j_kn: w.p_j_kn,
      }));
      if (wheelRows.length) {
        const ins = await db.from("tb15_so_do_tai_banh").insert(wheelRows);
        if (ins.error) throw ins.error;
      }
      return true;
    }
    const { id, created_at, updated_at, wheels, ...rest } = row;
    void created_at;
    void wheels;
    const payload = { ...rest, id, updated_at: new Date().toISOString() };
    const result = editing
      ? await db.from(meta.table).update(payload).eq("id", id).select("id").maybeSingle()
      : await db.from(meta.table).insert({ ...payload, created_at: new Date().toISOString() }).select("id").maybeSingle();
    if (result.error) throw result.error;
    return true;
  } catch (e) {
    if (isMissingRelation(e as { message?: string; code?: string })) return false;
    const err = e as { message?: string; code?: string };
    if (key === "khi_hau" && (err.code === "PGRST204" || /t_(max|min)_thang/i.test(err.message || ""))) {
      throw new Error(
        "Bảng tb15_khi_hau chưa có cột theo tháng. Hãy chạy supabase/migration_20261123_tb15_dau_vao.sql trong Supabase SQL Editor rồi thử lại.",
      );
    }
    throw e;
  }
}

export async function saveCatalog(key: Tb15CatalogKey, raw: Record<string, unknown>, editing: boolean) {
  const id = editing && typeof raw.id === "string" ? raw.id : undefined;
  if (editing && !id) throw new Error("Thiếu id bản ghi.");
  const row = cleanPayload(key, raw, id);
  if (await saveSupabase(key, row, editing)) return { row, backend: "supabase" as const };

  const bundle = await readJsonBundle();
  const list = bundle[key] ?? [];
  if (editing) {
    const idx = list.findIndex((r) => r.id === row.id);
    if (idx < 0) throw new Error("Bản ghi không còn tồn tại.");
    list[idx] = { ...list[idx], ...row };
  } else {
    list.push(row);
  }
  bundle[key] = list;
  await writeJsonBundle(bundle);
  return { row, backend: "json" as const };
}

async function deleteSupabase(key: Tb15CatalogKey, id: string): Promise<boolean> {
  const meta = catalogByKey(key);
  if (!meta) return false;
  try {
    const db = createAdminClient();
    const result = await db.from(meta.table).delete().eq("id", id);
    if (result.error) throw result.error;
    return true;
  } catch (e) {
    if (isMissingRelation(e as { message?: string; code?: string })) return false;
    throw e;
  }
}

export async function deleteCatalog(key: Tb15CatalogKey, id: string) {
  if (await deleteSupabase(key, id)) return { backend: "supabase" as const };
  const bundle = await readJsonBundle();
  const before = bundle[key]?.length ?? 0;
  bundle[key] = (bundle[key] ?? []).filter((r) => r.id !== id);
  if (bundle[key].length === before) throw new Error("Bản ghi không còn tồn tại.");
  await writeJsonBundle(bundle);
  return { backend: "json" as const };
}

/** Ghi đè toàn bộ bảng bằng seed (dùng cho import QCVN/Excel). */
export async function replaceCatalogSeed(key: Tb15CatalogKey) {
  const seed = TB15_SEED[key] ?? [];
  if (!seed.length) throw new Error("Không có seed cho bảng này.");

  // JSON path (hoặc khi Supabase chưa có bảng)
  const listed = await listCatalog(key);
  if (listed.backend === "json") {
    const bundle = await readJsonBundle();
    bundle[key] = seed.map((row) => ({ ...row }));
    await writeJsonBundle(bundle);
    return { ok: true as const, count: seed.length, backend: "json" as const };
  }

  for (const row of listed.rows) {
    if (row.id) await deleteCatalog(key, String(row.id));
  }
  for (const row of seed) {
    await saveCatalog(key, { ...row }, false);
  }
  const after = await listCatalog(key);
  return { ok: true as const, count: after.rows.length, backend: after.backend };
}
