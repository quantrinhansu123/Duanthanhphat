import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const env = loadEnv(path.join(appDirectory, ".env"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env");
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

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

async function fetchLookup(table, idColumn, codeColumn) {
  const { data, error } = await supabase.from(table).select(`${idColumn},${codeColumn}`);
  if (error) throw error;
  return new Map(data.map((row) => [row[codeColumn], row[idColumn]]));
}

const projectIds = await fetchLookup("du_an", "id", "ma_du_an");
const employeeIds = await fetchLookup("nhan_su", "employee_id", "ma_nhan_su");

const dailyRows = sourceRows.flatMap((source, sourceIndex) => {
  const [projectCode, year, railType, weldType, technology, totalWelds, totalErrors, employeeCode, sourceLine] = source;
  const projectId = projectIds.get(projectCode);
  const employeeId = employeeIds.get(employeeCode);
  if (!projectId) throw new Error(`Không tìm thấy dự án ${projectCode}`);
  if (!employeeId) throw new Error(`Không tìm thấy nhân sự ${employeeCode}`);

  const weldsPerDay = Math.floor(totalWelds / 30);
  const weldRemainder = totalWelds % 30;
  const errorsPerDay = Math.floor(totalErrors / 30);
  const errorRemainder = totalErrors % 30;

  return Array.from({ length: 30 }, (_, dayIndex) => {
    const day = dayIndex + 1;
    return {
      ma_lich_su: `R4D-${String(sourceIndex + 1).padStart(3, "0")}-${String(day).padStart(2, "0")}`,
      du_an_id: projectId,
      nam_thuc_hien: year,
      ngay_thuc_hien: `${year}-12-${String(day).padStart(2, "0")}`,
      loai_ray: railType,
      loai_moi_han: weldType,
      cong_nghe_han: technology,
      so_luong_thuc_hien: weldsPerDay + (day === 30 ? weldRemainder : 0),
      so_luong_loi: errorsPerDay + (day === 30 ? errorRemainder : 0),
      tho_han_id: employeeId,
      nguyen_nhan_loi: null,
      nguon_du_lieu: "TỔNG HỢP KHỐI LƯỢNG HÀN RAY R4.xlsx - chia đều 01-30/12",
      dong_nguon: sourceLine,
      ghi_chu: day === 30 && (weldRemainder > 0 || errorRemainder > 0)
        ? "Ngày 30 gồm phần dư sau khi chia cho 30 ngày"
        : null,
    };
  });
});

if (dailyRows.length !== 900 || sum(dailyRows, "so_luong_thuc_hien") !== 13387 || sum(dailyRows, "so_luong_loi") !== 8) {
  throw new Error("Dữ liệu tạo ra không đạt kiểm tra 900 dòng / 13.387 mối / 8 lỗi");
}

const { count: oldCount, error: oldCountError } = await supabase
  .from("lich_su_moi_han")
  .select("id", { count: "exact", head: true });
if (oldCountError) throw oldCountError;

// Dọn bản ghi do chính script này tạo ở lần chạy trước để có thể chạy lại an toàn.
const { error: cleanupError } = await supabase
  .from("lich_su_moi_han")
  .delete()
  .like("ma_lich_su", "R4D-%");
if (cleanupError) throw cleanupError;

try {
  for (let offset = 0; offset < dailyRows.length; offset += 200) {
    const { error } = await supabase.from("lich_su_moi_han").insert(dailyRows.slice(offset, offset + 200));
    if (error) throw error;
  }

  const { data: inserted, error: verifyInsertError } = await supabase
    .from("lich_su_moi_han")
    .select("ma_lich_su,ngay_thuc_hien,so_luong_thuc_hien,so_luong_loi")
    .like("ma_lich_su", "R4D-%")
    .limit(1000);
  if (verifyInsertError) throw verifyInsertError;
  if (inserted.length !== 900 || sum(inserted, "so_luong_thuc_hien") !== 13387 || sum(inserted, "so_luong_loi") !== 8) {
    throw new Error("Kiểm tra dữ liệu mới trên Supabase không khớp");
  }

  const { error: deleteOldError } = await supabase
    .from("lich_su_moi_han")
    .delete()
    .not("ma_lich_su", "like", "R4D-%");
  if (deleteOldError) throw deleteOldError;

  const { data: finalRows, error: finalError } = await supabase
    .from("lich_su_moi_han")
    .select("ma_lich_su,ngay_thuc_hien,so_luong_thuc_hien,so_luong_loi")
    .order("ma_lich_su")
    .limit(1000);
  if (finalError) throw finalError;

  const invalidDate = finalRows.find((row) => !/^\d{4}-12-(0[1-9]|[12]\d|30)$/.test(row.ngay_thuc_hien ?? ""));
  if (finalRows.length !== 900 || invalidDate || sum(finalRows, "so_luong_thuc_hien") !== 13387 || sum(finalRows, "so_luong_loi") !== 8) {
    throw new Error("Dữ liệu cuối cùng không đạt kiểm tra");
  }

  console.log(JSON.stringify({
    oldRowsReplaced: oldCount,
    newRows: finalRows.length,
    totalWelds: sum(finalRows, "so_luong_thuc_hien"),
    totalErrors: sum(finalRows, "so_luong_loi"),
    dateRange: "01-30/12 theo năm thực hiện",
  }, null, 2));
} catch (error) {
  await supabase.from("lich_su_moi_han").delete().like("ma_lich_su", "R4D-%");
  throw error;
}

// Mỗi lần import xong, đồng bộ định mức từng dự án/ngày = thực tế + 1.
await import("./sync-weld-daily-targets.mjs");
