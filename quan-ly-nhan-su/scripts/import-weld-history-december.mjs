import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const ROW_PREFIX = "R4W-";
const EXPECTED_WELDS = 13387;
const EXPECTED_ERRORS = 8;
const INSERT_BATCH = 100;

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const envPath = [".env.local", ".env"]
  .map((name) => path.join(appDirectory, name))
  .find((filePath) => fs.existsSync(filePath));
if (!envPath) {
  throw new Error("Thiếu .env.local hoặc .env");
}
const env = loadEnv(envPath);
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sourceRows = [
  ["DA-R4-001", 2019, "60E1", "Thử nghiệm", "ATW", 30, 0, "TH-R4-002", 14],
  ["DA-R4-001", 2019, "60E1", "Thử nghiệm", "FBW", 100, 0, "TH-R4-002", 15],
  ["DA-R4-001", 2019, "60E1", "Sản xuất", "ATW", 1000, 0, "TH-R4-002", 16],
  ["DA-R4-001", 2019, "60E1", "Sản xuất", "FBW", 1123, 0, "TH-R4-002", 17],
  ["DA-R4-001", 2020, "60E1", "Sản xuất", "ATW", 381, 0, "TH-R4-006", 18],

  ["DA-R4-002", 2020, "50N", "Thử nghiệm", "FBW", 50, 0, "TH-R4-002", 19],
  ["DA-R4-002", 2020, "50N", "Thử nghiệm", "ATW", 30, 0, "TH-R4-002", 20],
  ["DA-R4-002", 2020, "50N", "Sản xuất", "FBW", 2000, 1, "TH-R4-002", 21],
  ["DA-R4-002", 2020, "50N", "Sản xuất", "FBW", 500, 0, "TH-R4-001", 22],
  ["DA-R4-002", 2020, "50N", "Sản xuất", "ATW", 300, 6, "TH-R4-002", 23],
  ["DA-R4-002", 2021, "50N", "Sản xuất", "FBW", 2000, 0, "TH-R4-001", 24],
  ["DA-R4-002", 2021, "50N", "Sản xuất", "FBW", 1000, 0, "TH-R4-004", 25],
  ["DA-R4-002", 2021, "50N", "Sản xuất", "ATW", 600, 0, "TH-R4-003", 26],
  ["DA-R4-002", 2021, "50N", "Sản xuất", "ATW", 200, 0, "TH-R4-004", 27],
  ["DA-R4-002", 2022, "50N", "Sản xuất", "FBW", 2000, 0, "TH-R4-003", 28],
  ["DA-R4-002", 2022, "50N", "Sản xuất", "FBW", 500, 0, "TH-R4-005", 29],
  ["DA-R4-002", 2022, "50N", "Sản xuất", "ATW", 400, 0, "TH-R4-003", 30],
  ["DA-R4-002", 2023, "50N", "Sản xuất", "FBW", 400, 0, "TH-R4-006", 31],
  ["DA-R4-002", 2023, "50N", "Sản xuất", "ATW", 200, 1, "TH-R4-004", 32],
  ["DA-R4-002", 2024, "50N", "Sản xuất", "ATW", 217, 0, "TH-R4-002", 33],

  ["DA-R4-003", 2019, "50N", "Thử nghiệm", "ATW", 16, 0, "TH-R4-002", 34],
  ["DA-R4-003", 2019, "50N", "Sản xuất", "ATW", 16, 0, "TH-R4-003", 35],

  ["DA-R4-004", 2017, "P60", "Thử nghiệm", "ATW", 30, 0, "TH-R4-004", 36],
  ["DA-R4-004", 2017, "P60", "Thử nghiệm", "FBW", 50, 0, "TH-R4-005", 37],
  ["DA-R4-004", 2018, "50N", "Thử nghiệm", "ATW", 40, 0, "TH-R4-003", 38],
  ["DA-R4-004", 2018, "60N", "Thử nghiệm", "ATW", 40, 0, "TH-R4-004", 39],
  ["DA-R4-004", 2025, "P50", "Thử nghiệm", "ATW", 10, 0, "TH-R4-006", 40],
  ["DA-R4-004", 2025, "60E1", "Thử nghiệm", "FBW", 100, 0, "TH-R4-005", 41],
  ["DA-R4-004", 2025, "P50", "Thử nghiệm", "FBW", 50, 0, "TH-R4-006", 42],

  ["DA-R4-005", 2026, "CR100", "Thử nghiệm", "ATW", 4, 0, "TH-R4-002", 43],
];

function pad(value, size) {
  return String(value).padStart(size, "0");
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

async function fetchLookup(table, idColumn, codeColumn) {
  const { data, error } = await supabase.from(table).select(`${idColumn},${codeColumn}`);
  if (error) throw error;
  return new Map(data.map((row) => [row[codeColumn], row[idColumn]]));
}

async function fetchPrefixedRows() {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("lich_su_moi_han")
      .select("ma_lich_su,ngay_thuc_hien,so_luong_thuc_hien,so_luong_loi")
      .like("ma_lich_su", `${ROW_PREFIX}%`)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function deleteByPrefix(prefix) {
  const { error } = await supabase.from("lich_su_moi_han").delete().like("ma_lich_su", `${prefix}%`);
  if (error) throw new Error(`Xóa ${prefix}*: ${error.message}`);
}

async function deleteAllRows() {
  for (;;) {
    const { data, error } = await supabase.from("lich_su_moi_han").select("id").limit(1000);
    if (error) throw new Error(`Liệt kê để xóa tất cả: ${error.message}`);
    if (!data.length) return;
    const { error: deleteError } = await supabase
      .from("lich_su_moi_han")
      .delete()
      .in(
        "id",
        data.map((row) => row.id),
      );
    if (deleteError) throw new Error(`Xóa tất cả: ${deleteError.message}`);
  }
}

async function insertChunk(chunk, offset, attempt = 1) {
  const { error } = await supabase.from("lich_su_moi_han").insert(chunk);
  if (!error) return;
  const message = `${error.message} (${error.code ?? ""}) ${error.details ?? ""}`;
  const retryable = /fetch failed|timeout|503|502|429/i.test(message);
  if (retryable && attempt < 6) {
    const waitMs = attempt * 2500;
    console.warn(`Retry insert offset ${offset} (attempt ${attempt + 1}) after ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return insertChunk(chunk, offset, attempt + 1);
  }
  throw new Error(`Insert offset ${offset}: ${message}`);
}

const projectIds = await fetchLookup("du_an", "id", "ma_du_an");
const employeeIds = await fetchLookup("nhan_su", "employee_id", "ma_nhan_su");

/** Mỗi mối hàn = 1 dòng (so_luong_thuc_hien = 1), chia đều 01–30/12. */
const weldRows = sourceRows.flatMap((source, sourceIndex) => {
  const [projectCode, year, railType, weldType, technology, totalWelds, totalErrors, employeeCode, sourceLine] =
    source;
  const projectId = projectIds.get(projectCode);
  const employeeId = employeeIds.get(employeeCode);
  if (!projectId) throw new Error(`Không tìm thấy dự án ${projectCode}`);
  if (!employeeId) throw new Error(`Không tìm thấy nhân sự ${employeeCode}`);

  const weldsPerDay = Math.floor(totalWelds / 30);
  const weldRemainder = totalWelds % 30;
  const rows = [];
  let weldSeq = 0;

  for (let day = 1; day <= 30; day += 1) {
    const dayCount = weldsPerDay + (day === 30 ? weldRemainder : 0);
    for (let i = 0; i < dayCount; i += 1) {
      weldSeq += 1;
      const isError = weldSeq <= totalErrors;
      rows.push({
        ma_lich_su: `${ROW_PREFIX}${pad(sourceIndex + 1, 3)}-${pad(day, 2)}-${pad(i + 1, 4)}`,
        du_an_id: projectId,
        nam_thuc_hien: year,
        ngay_thuc_hien: `${year}-12-${pad(day, 2)}`,
        loai_ray: railType,
        loai_moi_han: weldType,
        cong_nghe_han: technology,
        so_luong_thuc_hien: 1,
        so_luong_loi: isError ? 1 : 0,
        tho_han_id: employeeId,
        nguyen_nhan_loi: isError ? "Lỗi từ tổng hợp R4" : null,
        nguon_du_lieu: "TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx - 1 mối/dòng, chia đều 01-30/12",
        dong_nguon: sourceLine,
        ghi_chu: null,
      });
    }
  }

  return rows;
});

if (
  weldRows.length !== EXPECTED_WELDS ||
  sum(weldRows, "so_luong_thuc_hien") !== EXPECTED_WELDS ||
  sum(weldRows, "so_luong_loi") !== EXPECTED_ERRORS
) {
  throw new Error(
    `Dữ liệu tạo ra không đạt kiểm tra ${EXPECTED_WELDS} dòng/mối / ${EXPECTED_ERRORS} lỗi (got ${weldRows.length}/${sum(weldRows, "so_luong_loi")})`,
  );
}

const { count: oldCount, error: oldCountError } = await supabase
  .from("lich_su_moi_han")
  .select("id", { count: "exact", head: true });
if (oldCountError) throw oldCountError;

// Dọn toàn bộ rồi import lại bộ 1 mối/dòng.
await deleteByPrefix("R4D-");
await deleteByPrefix(ROW_PREFIX);
await deleteAllRows();

try {
  for (let offset = 0; offset < weldRows.length; offset += INSERT_BATCH) {
    const chunk = weldRows.slice(offset, offset + INSERT_BATCH);
    await insertChunk(chunk, offset);
    if (offset === 0 || (offset / INSERT_BATCH) % 20 === 0) {
      console.log(`Inserted ${Math.min(offset + INSERT_BATCH, weldRows.length)}/${weldRows.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const inserted = await fetchPrefixedRows();
  if (
    inserted.length !== EXPECTED_WELDS ||
    sum(inserted, "so_luong_thuc_hien") !== EXPECTED_WELDS ||
    sum(inserted, "so_luong_loi") !== EXPECTED_ERRORS
  ) {
    throw new Error(
      `Kiểm tra dữ liệu mới không khớp: rows=${inserted.length}, loi=${sum(inserted, "so_luong_loi")}`,
    );
  }

  const { count: finalCount, error: finalCountError } = await supabase
    .from("lich_su_moi_han")
    .select("id", { count: "exact", head: true });
  if (finalCountError) throw finalCountError;

  const finalRows = inserted;
  const invalidDate = finalRows.find(
    (row) => !/^\d{4}-12-(0[1-9]|[12]\d|30)$/.test(row.ngay_thuc_hien ?? ""),
  );
  const multiWeld = finalRows.find((row) => Number(row.so_luong_thuc_hien) !== 1);
  if (
    finalCount !== EXPECTED_WELDS ||
    finalRows.length !== EXPECTED_WELDS ||
    invalidDate ||
    multiWeld ||
    sum(finalRows, "so_luong_loi") !== EXPECTED_ERRORS
  ) {
    throw new Error("Dữ liệu cuối cùng không đạt kiểm tra 1 mối/dòng");
  }

  console.log(
    JSON.stringify(
      {
        oldRowsReplaced: oldCount,
        newRows: finalRows.length,
        totalWelds: sum(finalRows, "so_luong_thuc_hien"),
        totalErrors: sum(finalRows, "so_luong_loi"),
        mode: "1 mối = 1 dòng",
        dateRange: "01-30/12 theo năm thực hiện",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error("Import failed — giữ nguyên dữ liệu đã insert để có thể chạy lại sau khi sửa lỗi.");
  throw error;
}

// Đồng bộ định mức từng dự án/ngày = thực tế + 5.
await import("./sync-weld-daily-targets.mjs");
