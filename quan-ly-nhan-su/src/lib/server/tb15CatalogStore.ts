import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateJson, writePrivateJson } from "@/lib/server/privateJsonStorage";
import {
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
  // Nâng cấp khí hậu nếu còn bản mẫu cũ (< đủ trạm QCVN)
  if (seededClimate.length > 0 && (bundle.khi_hau?.length ?? 0) < seededClimate.length) {
    bundle.khi_hau = seededClimate;
    await writePrivateJson(JSON_FILE, bundle);
  }
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

export async function listCatalog(key: Tb15CatalogKey): Promise<{ rows: Tb15Row[]; backend: "supabase" | "json" }> {
  const fromDb = await trySupabaseList(key);
  if (fromDb) return { rows: fromDb, backend: "supabase" };
  const bundle = await readJsonBundle();
  return { rows: bundle[key] ?? [], backend: "json" };
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
    const max = Number(row.t_kk_max);
    const min = Number(row.t_kk_min);
    if (max < min) throw new Error("Nhiệt độ không khí cao nhất phải ≥ nhiệt độ không khí thấp nhất.");
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
