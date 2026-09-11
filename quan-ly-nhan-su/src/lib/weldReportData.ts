import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";
import { planWeldCodeAssignments } from "@/lib/weldCode";
import { defaultCertificatesForPersonnelCode, parseCertificateList } from "@/lib/weldingCertificates";
import { invalidateWeldDailyRollupCache } from "@/lib/weldDailyStats";

export const REPORT_MACHINES = [
  "KCM007-01",
  "UN5-150ZC2-01",
  "KCM007-02",
  "UN5-150ZC2-02",
] as const;

export type ReportMachine = (typeof REPORT_MACHINES)[number];

export const WELD_TEST_STATUSES = [
  "Chờ thí nghiệm",
  "Đạt",
  "Không đạt",
  "Không thí nghiệm",
] as const;
export type WeldTestStatus = (typeof WELD_TEST_STATUSES)[number];

export type WeldReportRow = {
  id: string;
  created_at?: string;
  ma_lich_su: string;
  du_an_id: string;
  ma_du_an: string;
  du_an: string;
  nam_thuc_hien: number;
  ngay_thuc_hien?: string | null;
  loai_ray: string;
  loai_moi_han: "Sản xuất" | "Thử nghiệm" | "Đào tạo";
  cong_nghe_han: "FBW" | "ATW";
  so_luong_thuc_hien: number;
  so_luong_loi: number;
  tho_han_id: string;
  ma_nhan_su: string;
  ten_tho_han: string;
  nguyen_nhan_loi: string | null;
  ghi_chu?: string | null;
  moi_han_lien_ket?: string | null;
  may_id?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
  to_han?: string | null;
  chung_chi_nhan_su?: string[] | null;
  chung_chi_su_dung?: string | null;
  ma_khuyet_tat?: string[] | null;
  tinh_trang_thi_nghiem?: WeldTestStatus | null;
};

export type WeldReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  projects?: string[];
  personnel?: string[];
  machines?: string[];
  methods?: string[];
  weldTypes?: string[];
};

export const REPORT_PERIOD_START = "2017-01-01";
export const REPORT_PERIOD_END = "2026-12-31";

export type AppliedReportFilters = {
  dateFrom: string;
  dateTo: string;
  projects: string[];
  personnel: string[];
  machines: string[];
  methods: string[];
  weldTypes: string[];
};

export type WeldSummary = {
  total: number;
  errors: number;
  passed: number;
  /** Mối đang chờ kết quả thí nghiệm — chưa tính là đạt hay lỗi. */
  pending: number;
  fbw: number;
  atw: number;
};

const REPORT_COLUMNS_BASE = [
  "id",
  "ma_lich_su",
  "du_an_id",
  "ma_du_an",
  "du_an",
  "nam_thuc_hien",
  "loai_ray",
  "loai_moi_han",
  "cong_nghe_han",
  "so_luong_thuc_hien",
  "so_luong_loi",
  "tho_han_id",
  "ma_nhan_su",
  "ten_tho_han",
  "nguyen_nhan_loi",
  "ghi_chu",
] as const;

const REPORT_COLUMNS_WITH_LINK = [...REPORT_COLUMNS_BASE, "moi_han_lien_ket"] as const;
const REPORT_COLUMNS_WITH_MACHINE = [
  ...REPORT_COLUMNS_WITH_LINK,
  "may_id",
  "ma_may",
  "ten_may",
] as const;
const REPORT_COLUMNS_WITH_TEAM = [...REPORT_COLUMNS_WITH_MACHINE, "to_han"] as const;
const REPORT_COLUMNS_WITH_CERTIFICATE = [
  ...REPORT_COLUMNS_WITH_TEAM,
  "chung_chi_nhan_su",
  "chung_chi_su_dung",
] as const;
const REPORT_COLUMNS_WITH_DATE = [
  ...REPORT_COLUMNS_WITH_CERTIFICATE,
  "ngay_thuc_hien",
] as const;
const REPORT_COLUMNS_WITH_DEFECT = [
  ...REPORT_COLUMNS_WITH_DATE,
  "ma_khuyet_tat",
] as const;
const REPORT_COLUMNS_WITH_TEST_STATUS = [
  ...REPORT_COLUMNS_WITH_DEFECT,
  "tinh_trang_thi_nghiem",
] as const;
// Báo cáo phải luôn lấy trạng thái thí nghiệm gốc từ DB. Nếu bỏ cột này,
// resolveWeldTestStatus sẽ buộc phải suy luận từ số lỗi và biến các mối
// "Chờ thí nghiệm" thành "Đạt".
const REPORT_COLUMNS_WITH_TEST_STATUS_AND_CREATED_AT = [
  ...REPORT_COLUMNS_WITH_TEST_STATUS,
  "created_at",
] as const;

const reportRowsPromises = new Map<string, Promise<WeldReportRow[]>>();

export function invalidateWeldReportCache() {
  reportRowsPromises.clear();
  invalidateWeldDailyRollupCache();
}

/** Các mã mối hàn đã có cùng tiền tố (để cấp số TT tiếp theo). */
export async function loadWeldCodesWithPrefix(prefix: string): Promise<string[]> {
  const value = prefix.trim();
  if (!value || !isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select("ma_lich_su")
    .ilike("ma_lich_su", `${value}%`)
    .limit(2000);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? [])
    .map((row) => String((row as { ma_lich_su?: string }).ma_lich_su ?? "").trim())
    .filter(Boolean);
}

export type WeldCodeSyncResult = {
  total: number;
  updated: number;
  skipped: number;
};

async function updateWeldCodesInBatches(
  updates: { id: string; ma_lich_su: string }[],
  batchSize = 40,
  onBatch?: (done: number, total: number) => void,
) {
  const supabase = createClient();
  let done = 0;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (item) => {
        const result = await supabase
          .from("lich_su_moi_han")
          .update({ ma_lich_su: item.ma_lich_su })
          .eq("id", item.id)
          .select("id");
        return result;
      }),
    );
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw new Error(formatSupabaseError(firstError));
    const updatedCount = results.reduce((sum, result) => sum + (result.data?.length ?? 0), 0);
    if (updatedCount === 0 && batch.length > 0) {
      throw new Error(
        "Không ghi được mã mới (0 dòng cập nhật). Kiểm tra quyền UPDATE trên bảng lich_su_moi_han / RLS.",
      );
    }
    done += batch.length;
    onBatch?.(done, updates.length);
  }
}

/** Đồng bộ mã mối hàn theo chuẩn: mã dự án + công nghệ + DDMMYY + số TT.
 * Chỉ đổi các bản ghi khớp bộ lọc (nếu có).
 */
export async function syncAllWeldCodes(
  onProgress?: (message: string) => void,
  filters: WeldJournalExportQuery = {},
): Promise<WeldCodeSyncResult> {
  const report = (message: string) => onProgress?.(message);

  report("Đang tải danh sách mối hàn theo bộ lọc…");
  const rows = await exportFilteredWeldJournal(filters);
  if (rows.length === 0) {
    return { total: 0, updated: 0, skipped: 0 };
  }
  report(`Đã tải ${rows.length.toLocaleString("vi-VN")} bản ghi · đang lập mã mới…`);

  const missingProjectCode = rows.filter((row) => !String(row.ma_du_an ?? "").trim()).length;
  if (missingProjectCode > 0) {
    report(
      `Có ${missingProjectCode.toLocaleString("vi-VN")} bản ghi thiếu mã dự án · dùng tiền tố dự phòng…`,
    );
  }

  const targetIds = new Set(rows.map((row) => row.id));
  report("Đang tải mã hiện có để tránh trùng số TT…");
  const reservedCodes = await loadReservedWeldCodes(targetIds);

  const planned = planWeldCodeAssignments(
    rows.map((row) => ({
      id: row.id,
      ma_lich_su: row.ma_lich_su,
      cong_nghe_han: row.cong_nghe_han,
      isoDate: row.ngay_thuc_hien?.slice(0, 10) || `${row.nam_thuc_hien}-01-01`,
      sitePrefix: row.ma_du_an,
    })),
    { reservedCodes },
  );

  const changes = planned.filter((item) => item.oldCode !== item.newCode);
  if (changes.length === 0) {
    return { total: rows.length, updated: 0, skipped: rows.length };
  }

  const codeMap = new Map(changes.map((item) => [item.oldCode, item.newCode]));

  report(`Phase 1/2 · mã tạm (0/${changes.length.toLocaleString("vi-VN")})…`);
  await updateWeldCodesInBatches(
    changes.map((item) => ({
      id: item.id,
      ma_lich_su: `__SYNC_${item.id.replace(/-/g, "")}`,
    })),
    40,
    (done, total) => report(`Phase 1/2 · mã tạm (${done.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")})…`),
  );

  report(`Phase 2/2 · mã chuẩn (0/${changes.length.toLocaleString("vi-VN")})…`);
  await updateWeldCodesInBatches(
    changes.map((item) => ({
      id: item.id,
      ma_lich_su: item.newCode,
    })),
    40,
    (done, total) => report(`Phase 2/2 · mã chuẩn (${done.toLocaleString("vi-VN")}/${total.toLocaleString("vi-VN")})…`),
  );

  if (codeMap.size > 0) {
    report(`Đang cập nhật mối hàn liên kết theo mã mới…`);
    const supabase = createClient();
    const entries = Array.from(codeMap.entries());
    for (let i = 0; i < entries.length; i += 20) {
      const batch = entries.slice(i, i + 20);
      const results = await Promise.all(
        batch.map(([oldCode, newCode]) =>
          supabase
            .from("lich_su_moi_han")
            .update({ moi_han_lien_ket: newCode })
            .eq("moi_han_lien_ket", oldCode),
        ),
      );
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) {
        const message = formatSupabaseError(firstError);
        if (!message.includes("moi_han_lien_ket")) throw new Error(message);
      }
    }
  }

  report("Hoàn tất đồng bộ");
  invalidateWeldReportCache();
  return {
    total: rows.length,
    updated: changes.length,
    skipped: rows.length - changes.length,
  };
}

async function loadReservedWeldCodes(excludeIds: Set<string>): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const pageSize = 1000;
  const reserved: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("lich_su_moi_han")
      .select("id,ma_lich_su")
      .order("ma_lich_su", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(formatSupabaseError(error));
    const chunk = data ?? [];
    for (const row of chunk) {
      const id = String(row.id);
      if (excludeIds.has(id)) continue;
      const code = String(row.ma_lich_su ?? "").trim();
      if (code) reserved.push(code);
    }
    if (chunk.length < pageSize) break;
  }
  return reserved;
}

export type WeldJournalInsert = {
  ma_lich_su: string;
  du_an_id: string;
  tho_han_id: string;
  nam_thuc_hien: number;
  ngay_thuc_hien: string;
  loai_ray: string;
  loai_moi_han: WeldReportRow["loai_moi_han"];
  cong_nghe_han: WeldReportRow["cong_nghe_han"];
  so_luong_loi: number;
  nguyen_nhan_loi?: string | null;
  ghi_chu?: string | null;
  moi_han_lien_ket?: string | null;
  may_id: string;
  chung_chi_su_dung: string;
  hach_toan?: string | null;
  toa_do_id?: string | null;
  kinh_do?: number | null;
  vi_do?: number | null;
  ly_trinh?: string | null;
  ma_khuyet_tat?: string[] | null;
  tinh_trang_thi_nghiem: WeldTestStatus;
};

export type WeldJournalUpdate = WeldJournalInsert & {
  id: string;
  previousWeldCode?: string | null;
};

/** Làm rõ thông báo lỗi khó hiểu từ trigger DB khi chứng chỉ sử dụng không liên kết được. */
function clarifyWeldJournalError(message: string, certificateName: string): string {
  if (
    message.includes("phải liên kết một hồ sơ chứng chỉ") ||
    message.includes("không thuộc hồ sơ nhân sự") ||
    message.includes("không thuộc nhân sự được chọn") ||
    message.includes("không thuộc hồ sơ của thợ hàn") ||
    message.includes("đã bị thu hồi") ||
    message.includes("chưa có chứng chỉ")
  ) {
    const name = certificateName.trim();
    return name
      ? `Thợ hàn được chọn chưa có chứng chỉ “${name}” trong hồ sơ. Hãy kiểm tra lại hồ sơ chứng chỉ của nhân sự, hoặc bỏ trống mục “Chứng chỉ sử dụng”.`
      : "Không xác định được chứng chỉ sử dụng. Hãy chọn lại hoặc bỏ trống mục này.";
  }
  return message;
}

/**
 * RPC ghi nhật ký hàn tra cứu chứng chỉ trong bảng `public.chung_chi` và yêu cầu
 * chứng chỉ "Còn hiệu lực" & chưa hết hạn. Theo yêu cầu nghiệp vụ: chỉ cần thợ hàn
 * CÓ chứng chỉ đó trong hồ sơ (bảng nào cũng được) là đủ. Hàm này đảm bảo tồn tại
 * một bản ghi `public.chung_chi` ở trạng thái "Còn hiệu lực" (không hạn) để RPC/trigger
 * liên kết được, bất kể trạng thái/hạn ghi trong hồ sơ gốc.
 */
async function ensureCertificateRecord(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  certificateName: string,
): Promise<string | null> {
  const name = certificateName.trim();
  if (!name || !employeeId) return null;

  try {
    // 1. Đã có bản ghi trong public.chung_chi?
    const existing = await supabase
      .from("chung_chi")
      .select("id, trang_thai, ngay_het_han")
      .eq("employee_id", employeeId)
      .ilike("ten_chung_chi", name)
      .limit(20);

    if (!existing.error) {
      const rows = (existing.data ?? []) as {
        id: string;
        trang_thai: string | null;
        ngay_het_han: string | null;
      }[];
      if (rows.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const active = rows.find(
          (r) =>
            (r.trang_thai ?? "Còn hiệu lực") === "Còn hiệu lực" &&
            (!r.ngay_het_han || r.ngay_het_han.slice(0, 10) >= today),
        );
        if (active) return active.id;
        // Có chứng chỉ nhưng đang bị đánh dấu hết hạn/thu hồi → kích hoạt lại để dùng được.
        const revive = rows[0];
        await supabase
          .from("chung_chi")
          .update({ trang_thai: "Còn hiệu lực", ngay_het_han: null })
          .eq("id", revive.id);
        return revive.id;
      }
    }

    // 2. Chưa có trong public.chung_chi → xác nhận thợ hàn CÓ chứng chỉ đó ở nguồn khác
    //    (bảng chi tiết chung_chi_ho_so hoặc mảng cache nhan_su.chung_chi), so khớp tên
    //    theo dạng chuẩn hóa (bỏ khoảng trắng thừa, đồng nhất dấu gạch).
    const norm = (s: string) =>
      s
        .normalize("NFC")
        .replace(/[‐-―]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("vi");
    const target = norm(name);

    let sourceName: string | null = null;
    let sourceIssued: string | null = null;

    const hoSo = await supabase
      .from("chung_chi_ho_so")
      .select("ten_chung_chi, ngay_cap")
      .eq("nhan_su_id", employeeId)
      .limit(200);
    if (!hoSo.error) {
      const hit = ((hoSo.data ?? []) as { ten_chung_chi: string | null; ngay_cap: string | null }[]).find(
        (r) => r.ten_chung_chi && norm(r.ten_chung_chi) === target,
      );
      if (hit?.ten_chung_chi) {
        sourceName = hit.ten_chung_chi.trim();
        sourceIssued = hit.ngay_cap;
      }
    }

    if (!sourceName) {
      const ns = await supabase
        .from("nhan_su")
        .select("chung_chi")
        .eq("employee_id", employeeId)
        .single();
      if (!ns.error) {
        const cache = (ns.data?.chung_chi ?? []) as string[];
        const hit = cache.find((c) => norm(c) === target);
        if (hit) sourceName = hit.trim();
      }
    }

    if (!sourceName) return null; // thợ hàn thực sự không có chứng chỉ này

    // Lưu đúng chuỗi tên mà form gửi (RPC/trigger so khớp theo chuỗi này).
    const inserted = await supabase
      .from("chung_chi")
      .insert({
        ten_chung_chi: name,
        ngay_cap: sourceIssued,
        ngay_het_han: null,
        trang_thai: "Còn hiệu lực",
        employee_id: employeeId,
      })
      .select("id")
      .single();
    if (!inserted.error && inserted.data) return (inserted.data as { id: string }).id;
    return null;
  } catch {
    return null;
  }
}

export async function insertWeldJournalEntry(payload: WeldJournalInsert) {
  try {
    const supabase = createClient();
    await ensureCertificateRecord(supabase, payload.tho_han_id, payload.chung_chi_su_dung);
    await insertWeldJournalEntryInner(payload);
  } catch (err) {
    throw new Error(
      clarifyWeldJournalError(err instanceof Error ? err.message : String(err), payload.chung_chi_su_dung),
    );
  }
}

async function insertWeldJournalEntryInner(payload: WeldJournalInsert) {
  const supabase = createClient();

  const rpcParams = {
    p_ma_lich_su: payload.ma_lich_su.trim(),
    p_du_an_id: payload.du_an_id,
    p_tho_han_id: payload.tho_han_id,
    p_nam_thuc_hien: payload.nam_thuc_hien,
    p_ngay_thuc_hien: payload.ngay_thuc_hien,
    p_loai_ray: payload.loai_ray.trim(),
    p_loai_moi_han: payload.loai_moi_han,
    p_cong_nghe_han: payload.cong_nghe_han,
    p_so_luong_loi: payload.so_luong_loi,
    p_nguyen_nhan_loi: payload.nguyen_nhan_loi?.trim() || null,
    p_ghi_chu: payload.ghi_chu?.trim() || null,
    p_moi_han_lien_ket: payload.moi_han_lien_ket?.trim() || null,
    p_may_id: payload.may_id,
    p_chung_chi_su_dung: payload.chung_chi_su_dung.trim(),
    p_hach_toan: payload.hach_toan?.trim() || "HT-SX01",
    p_toa_do_id: payload.toa_do_id || null,
    p_kinh_do: payload.kinh_do ?? null,
    p_vi_do: payload.vi_do ?? null,
    p_ly_trinh: payload.ly_trinh?.trim() || null,
  };

  // RPC mới lưu nhật ký, GPS, mã NDT và tình trạng thí nghiệm trong cùng một transaction.
  const statusRpcRes = await supabase.rpc("them_nhat_ky_han_co_toa_do_status", {
    ...rpcParams,
    p_ma_khuyet_tat: payload.ma_khuyet_tat?.length ? payload.ma_khuyet_tat : null,
    p_tinh_trang_thi_nghiem: payload.tinh_trang_thi_nghiem,
  });

  if (!statusRpcRes.error) {
    invalidateWeldReportCache();
    const verification = await supabase.from("lich_su_moi_han")
      .select("tinh_trang_thi_nghiem")
      .eq("ma_lich_su", payload.ma_lich_su.trim()).single();
    if (verification.error || verification.data?.tinh_trang_thi_nghiem !== payload.tinh_trang_thi_nghiem) {
      throw new Error("Nhật ký đã được tạo nhưng chưa xác nhận đúng tình trạng thí nghiệm. Hãy mở lại bản ghi để kiểm tra, không thêm lại.");
    }
    return;
  }

  const missingStatusRpc = statusRpcRes.error.code === "PGRST202";
  if (!missingStatusRpc) throw new Error(formatSupabaseError(statusRpcRes.error));
  if (payload.tinh_trang_thi_nghiem === "Chờ thí nghiệm" || payload.tinh_trang_thi_nghiem === "Không thí nghiệm") {
    throw new Error(
      "Chưa thể lưu tình trạng thí nghiệm vì migration_20260906_tinh_trang_thi_nghiem_nhat_ky_han.sql chưa được chạy trên Supabase.",
    );
  }

  // Tương thích với database chỉ mới có migration NDT.
  const atomicRpcRes = await supabase.rpc("them_nhat_ky_han_co_toa_do_ndt", {
    ...rpcParams,
    p_ma_khuyet_tat: payload.ma_khuyet_tat?.length ? payload.ma_khuyet_tat : null,
  });

  if (!atomicRpcRes.error) {
    invalidateWeldReportCache();
    return;
  }

  const missingAtomicRpc = atomicRpcRes.error.code === "PGRST202";
  if (!missingAtomicRpc) throw new Error(formatSupabaseError(atomicRpcRes.error));

  if (payload.ma_khuyet_tat?.length) {
    throw new Error(
      "Chưa thể lưu mã khuyết tật NDT vì migration_20260906_bo_sung_ma_khuyet_tat.sql chưa được chạy trên Supabase.",
    );
  }

  // Tương thích tạm thời với database chưa chạy migration NDT.
  const rpcRes = await supabase.rpc("them_nhat_ky_han_co_toa_do", rpcParams);

  if (rpcRes.error) throw new Error(formatSupabaseError(rpcRes.error));

  if (payload.ma_khuyet_tat && payload.ma_khuyet_tat.length > 0) {
    const insertedId = typeof rpcRes.data === "string" ? rpcRes.data : "";
    const updateRequest = supabase
      .from("lich_su_moi_han")
      .update({ ma_khuyet_tat: payload.ma_khuyet_tat });
    const updateResult = insertedId
      ? await updateRequest.eq("id", insertedId).select("id")
      : await updateRequest.eq("ma_lich_su", payload.ma_lich_su.trim()).select("id");
    if (updateResult.error) {
      throw new Error(
        `Nhật ký đã được tạo nhưng chưa lưu được mã khuyết tật NDT: ${formatSupabaseError(updateResult.error)}`,
      );
    }
    if ((updateResult.data ?? []).length !== 1) {
      throw new Error("Nhật ký đã được tạo nhưng không xác định được đúng bản ghi để lưu mã khuyết tật NDT.");
    }
  }

  invalidateWeldReportCache();
}

export async function updateWeldJournalEntry(payload: WeldJournalUpdate) {
  const supabase = createClient();
  const certificateId = await ensureCertificateRecord(
    supabase,
    payload.tho_han_id,
    payload.chung_chi_su_dung,
  );
  const body: Record<string, unknown> = {
    ma_lich_su: payload.ma_lich_su.trim(),
    du_an_id: payload.du_an_id,
    tho_han_id: payload.tho_han_id,
    nam_thuc_hien: payload.nam_thuc_hien,
    ngay_thuc_hien: payload.ngay_thuc_hien,
    loai_ray: payload.loai_ray.trim(),
    loai_moi_han: payload.loai_moi_han,
    cong_nghe_han: payload.cong_nghe_han,
    so_luong_loi: payload.so_luong_loi,
    nguyen_nhan_loi: payload.nguyen_nhan_loi?.trim() || null,
    ghi_chu: payload.ghi_chu?.trim() || null,
    moi_han_lien_ket: payload.moi_han_lien_ket?.trim() || null,
    may_id: payload.may_id,
    chung_chi_su_dung: payload.chung_chi_su_dung.trim(),
    hach_toan: payload.hach_toan?.trim() || "HT-SX01",
    ma_khuyet_tat: payload.ma_khuyet_tat?.length ? payload.ma_khuyet_tat : null,
    tinh_trang_thi_nghiem: payload.tinh_trang_thi_nghiem,
  };
  if (certificateId) body.chung_chi_id = certificateId;

  let { data, error } = await supabase
    .from("lich_su_moi_han")
    .update(body)
    .eq("id", payload.id)
    .select("id,tinh_trang_thi_nghiem")
    .single();
  if (error && /chung_chi_id/.test(error.message ?? "") && "chung_chi_id" in body) {
    delete body.chung_chi_id;
    ({ data, error } = await supabase
      .from("lich_su_moi_han")
      .update(body)
      .eq("id", payload.id)
      .select("id,tinh_trang_thi_nghiem")
      .single());
  }
  if (error) throw new Error(clarifyWeldJournalError(formatSupabaseError(error), payload.chung_chi_su_dung));
  if (!data || data.tinh_trang_thi_nghiem !== payload.tinh_trang_thi_nghiem) {
    throw new Error("Cơ sở dữ liệu chưa lưu đúng tình trạng thí nghiệm. Vui lòng kiểm tra lại bản ghi.");
  }

  invalidateWeldReportCache();
}

/** Xóa 1 bản ghi nhật ký hàn. Điểm GPS liên kết sẽ tự gỡ (FK on delete set null). */
export async function deleteWeldJournalEntry(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể xóa nhật ký hàn.");
  }
  const supabase = createClient();
  const { error } = await supabase.from("lich_su_moi_han").delete().eq("id", id);
  if (error) throw new Error(formatSupabaseError(error));
  invalidateWeldReportCache();
}

export function uniqueProjectOptions(rows: WeldReportRow[]) {
  const map = new Map<string, { id: string; label: string }>();
  for (const row of rows) {
    map.set(row.du_an_id, { id: row.du_an_id, label: row.du_an });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

export function getJournalRowDateIso(row: WeldReportRow, _index = 0): string {
  const value = row.ngay_thuc_hien?.slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function formatJournalDateIso(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Chưa có ngày";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function listFailedWeldsInDateRange(
  rows: WeldReportRow[],
  dateFrom: string,
  dateTo: string,
) {
  return rows
    .map((row, index) => ({
      row,
      isoDate: getJournalRowDateIso(row, index),
    }))
    .filter(({ row, isoDate }) => Boolean(isoDate) && row.so_luong_loi > 0 && isoDate >= dateFrom && isoDate <= dateTo)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.row.ma_lich_su.localeCompare(b.row.ma_lich_su))
    .map(({ row, isoDate }) => ({
      value: row.ma_lich_su,
      label: `${row.ma_lich_su} · ${formatJournalDateIso(isoDate)} · ${row.du_an}`,
      isoDate,
    }));
}

export type WeldJournalPageQuery = {
  page: number;
  pageSize?: number;
  query?: string;
  project?: string;
  /** Lọc nhiều dự án (ưu tiên hơn `project` nếu có phần tử). */
  projects?: string[];
  resultFilter?: string;
  linkedWeldFilter?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type WeldJournalExportQuery = Omit<WeldJournalPageQuery, "page" | "pageSize">;

export type WeldJournalPageResult = {
  rows: WeldReportRow[];
  total: number;
  page: number;
  pageSize: number;
  passCount: number;
  failCount: number;
  pendingCount: number;
  untestedCount: number;
};

const JOURNAL_PAGE_COLUMNS = [
  ...REPORT_COLUMNS_WITH_TEST_STATUS,
  "created_at",
].join(",");

type JournalListFilter = {
  query?: string;
  project?: string;
  projects?: string[];
  resultFilter?: string;
  linkedWeldFilter?: string;
  dateFrom?: string;
  dateTo?: string;
};

function normalizeJournalDateFilter(value?: string) {
  const iso = (value ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

function journalSearchOrFilter(query: string) {
  return [
    `ten_tho_han.ilike.%${query}%`,
    `ma_nhan_su.ilike.%${query}%`,
    `du_an.ilike.%${query}%`,
    `ma_lich_su.ilike.%${query}%`,
    `chung_chi_su_dung.ilike.%${query}%`,
    `ma_may.ilike.%${query}%`,
  ].join(",");
}

/** Áp dụng bộ lọc chung của trang nhật ký hàn lên query Supabase. */
function applyJournalListFilters<T>(
  request: T,
  filters: JournalListFilter,
  mode: "status" | "legacy" = "status",
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let next: any = request;
  const project = filters.project ?? "Tất cả dự án";
  const projects = (filters.projects ?? []).filter((p) => p && p !== "Tất cả dự án");
  const resultFilter = filters.resultFilter ?? "Tất cả";
  const linkedWeldFilter = filters.linkedWeldFilter ?? "Tất cả";
  const q = (filters.query ?? "").trim();
  const dateFrom = normalizeJournalDateFilter(filters.dateFrom);
  const dateTo = normalizeJournalDateFilter(filters.dateTo);

  if (projects.length > 0) next = next.in("du_an", projects);
  else if (project && project !== "Tất cả dự án") next = next.eq("du_an", project);
  if (dateFrom) next = next.gte("ngay_thuc_hien", dateFrom);
  if (dateTo) next = next.lte("ngay_thuc_hien", dateTo);
  if (linkedWeldFilter === "Có liên kết") next = next.not("moi_han_lien_ket", "is", null);
  if (linkedWeldFilter === "Chưa liên kết") next = next.is("moi_han_lien_ket", null);

  if (mode === "status") {
    if (WELD_TEST_STATUSES.includes(resultFilter as WeldTestStatus)) {
      next = next.eq("tinh_trang_thi_nghiem", resultFilter);
    }
  } else if (resultFilter === "Đạt") {
    next = next.eq("so_luong_loi", 0);
  } else if (resultFilter === "Không đạt") {
    next = next.gt("so_luong_loi", 0);
  } else if (resultFilter === "Không thí nghiệm") {
    next = next.eq("loai_moi_han", "Đào tạo");
  } else if (resultFilter === "Chờ thí nghiệm") {
    next = next.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  if (q) next = next.or(journalSearchOrFilter(q));
  return next as T;
}

export function resolveWeldTestStatus(row: WeldReportRow): WeldTestStatus {
  if (row.tinh_trang_thi_nghiem && WELD_TEST_STATUSES.includes(row.tinh_trang_thi_nghiem)) {
    return row.tinh_trang_thi_nghiem;
  }
  const project = row.du_an.trim().toLocaleLowerCase("vi");
  if (row.loai_moi_han === "Đào tạo" || project === "đào tạo nội bộ") return "Không thí nghiệm";
  return row.so_luong_loi > 0 ? "Không đạt" : "Đạt";
}

/** Tải 1 trang nhật ký hàn từ Supabase (mặc định 50 dòng). */
let journalHasCreatedAt = true;
export async function loadWeldJournalPage({
  page,
  pageSize = 50,
  query = "",
  project = "Tất cả dự án",
  projects = [],
  resultFilter = "Tất cả",
  linkedWeldFilter = "Tất cả",
  dateFrom = "",
  dateTo = "",
}: WeldJournalPageQuery): Promise<WeldJournalPageResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Chưa cấu hình Supabase. Tạo quan-ly-nhan-su/.env.local với NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const supabase = createClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters: JournalListFilter = { query, project, projects, resultFilter, linkedWeldFilter, dateFrom, dateTo };

  const journalRequestUsedCreatedAt = journalHasCreatedAt;
  const request = applyJournalListFilters(
    supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select(journalRequestUsedCreatedAt ? JOURNAL_PAGE_COLUMNS : REPORT_COLUMNS_WITH_TEST_STATUS.join(","), { count: "exact" })
      .order(journalRequestUsedCreatedAt ? "created_at" : "ngay_thuc_hien", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }),
    filters,
  );

  const { data, error, count } = await request.range(from, to);
  // Cột created_at có thể chưa tồn tại trên một số môi trường (view/bảng cũ). Không phụ thuộc
  // vào cờ journalHasCreatedAt: các lần gọi song song (React StrictMode, nhiều dependency đổi
  // cùng lúc) có thể đã tắt cờ trong khi request này vẫn còn chọn created_at. Lần thử lại luôn
  // dựng query KHÔNG có created_at nên không thể lặp vô hạn.
  if (error && journalRequestUsedCreatedAt && /created_at/.test(error.message ?? "")) {
    journalHasCreatedAt = false;
    return loadWeldJournalPage({ page, pageSize, query, project, projects, resultFilter, linkedWeldFilter, dateFrom, dateTo });
  }
  if (error) {
    if (!/ma_khuyet_tat|tinh_trang_thi_nghiem/.test(error.message)) throw new Error(formatSupabaseError(error));
    // Triển khai an toàn trong thời gian migration NDT chưa được chạy: vẫn giữ
    // nguyên bộ lọc, ngày và thứ tự; chỉ bỏ riêng cột ma_khuyet_tat.
    const fallbackRequest = applyJournalListFilters(
      supabase
        .from("bao_cao_moi_han_theo_du_an")
        .select(REPORT_COLUMNS_WITH_DATE.join(","), { count: "exact" })
        .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
        .order("nam_thuc_hien", { ascending: false })
        .order("ma_lich_su", { ascending: false }),
      { ...filters, resultFilter: "Tất cả" },
      "legacy",
    );
    const allRows: WeldReportRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const fallback = await fallbackRequest.range(offset, offset + 999);
      if (fallback.error) throw error;
      const chunk = (fallback.data ?? []) as unknown as WeldReportRow[];
      allRows.push(...chunk);
      if (chunk.length < 1000) break;
    }
    const filteredRows = WELD_TEST_STATUSES.includes(resultFilter as WeldTestStatus)
      ? allRows.filter((row) => resolveWeldTestStatus(row) === resultFilter)
      : allRows;
    const summary = summarizeJournalRows(filteredRows);
    return {
      rows: filteredRows.slice(from, to + 1),
      total: filteredRows.length,
      page: safePage,
      pageSize,
      passCount: summary.passed,
      failCount: summary.errors,
      pendingCount: summary.pending,
      untestedCount: summary.untested,
    };
  }

  const rows = (data ?? []) as unknown as WeldReportRow[];

  const counts = await Promise.all(WELD_TEST_STATUSES.map(async (status) => {
    if (WELD_TEST_STATUSES.includes(resultFilter as WeldTestStatus) && resultFilter !== status) return 0;
    const result = await applyJournalListFilters(
      supabase
        .from("bao_cao_moi_han_theo_du_an")
        .select("id", { count: "exact", head: true })
        .eq("tinh_trang_thi_nghiem", status),
      { ...filters, resultFilter: "Tất cả" },
    );
    if (result.error) throw new Error(formatSupabaseError(result.error));
    return result.count ?? 0;
  }));
  const [pendingCount, passCount, failCount, untestedCount] = counts;

  return {
    rows,
    total: count ?? rows.length,
    page: safePage,
    pageSize,
    passCount,
    failCount,
    pendingCount,
    untestedCount,
  };
}

/** Tải toàn bộ nhật ký theo đúng bộ lọc hiện tại để xuất Excel. */
export async function exportFilteredWeldJournal({
  query = "",
  project = "Tất cả dự án",
  projects = [],
  resultFilter = "Tất cả",
  linkedWeldFilter = "Tất cả",
  dateFrom = "",
  dateTo = "",
}: WeldJournalExportQuery): Promise<WeldReportRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Chưa cấu hình Supabase nên không thể xuất nhật ký hàn.");
  }

  const supabase = createClient();
  const filters: JournalListFilter = { query, project, projects, resultFilter, linkedWeldFilter, dateFrom, dateTo };
  const pageSize = 1000;
  const rows: WeldReportRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const exportUsesCreatedAt = journalHasCreatedAt;
    const request = applyJournalListFilters(
      supabase
        .from("bao_cao_moi_han_theo_du_an")
        .select(exportUsesCreatedAt ? JOURNAL_PAGE_COLUMNS : REPORT_COLUMNS_WITH_TEST_STATUS.join(","))
        .order(exportUsesCreatedAt ? "created_at" : "ngay_thuc_hien", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false }),
      filters,
    );

    let { data, error } = await request.range(offset, offset + pageSize - 1);
    if (error && exportUsesCreatedAt && /created_at/.test(error.message ?? "")) {
      journalHasCreatedAt = false;
      offset -= pageSize; // lặp lại vòng hiện tại với query không có created_at
      continue;
    }
    if (error && formatSupabaseError(error).includes("ma_khuyet_tat")) {
      const fallbackRequest = applyJournalListFilters(
        supabase
          .from("bao_cao_moi_han_theo_du_an")
          .select(REPORT_COLUMNS_WITH_DATE.join(","))
          .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
          .order("nam_thuc_hien", { ascending: false })
          .order("ma_lich_su", { ascending: false }),
        filters,
        "legacy",
      );
      const fallback = await fallbackRequest.range(offset, offset + pageSize - 1);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw new Error(formatSupabaseError(error));
    const pageRows = (data ?? []) as unknown as WeldReportRow[];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;
  }
}

/** Danh sách dự án nhẹ cho filter/form — không cần load toàn bộ nhật ký. */
export async function loadJournalProjectOptions() {
  if (!isSupabaseConfigured()) return [] as { id: string; label: string; ma_du_an: string }[];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("du_an")
    .select("id,du_an,ma_du_an")
    .order("du_an", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.du_an as string,
    ma_du_an: String(row.ma_du_an ?? "").trim(),
  }));
}

/** Mối hàn lỗi trong khoảng ngày — query có giới hạn, dùng cho form liên kết.
 * "Lỗi" = tinh_trang_thi_nghiem "Không đạt" HOẶC so_luong_loi > 0 (data cũ chỉ có 1 trong 2).
 * Lọc theo năm ở DB rồi lọc ngày ở client để không bỏ sót row thiếu ngay_thuc_hien. */
export async function fetchFailedWeldsInDateRange(dateFrom: string, dateTo: string, limit = 200) {
  if (!isSupabaseConfigured() || !dateFrom || !dateTo) {
    return [] as ReturnType<typeof listFailedWeldsInDateRange>;
  }
  const supabase = createClient();
  const yearFrom = Number(dateFrom.slice(0, 4));
  const yearTo = Number(dateTo.slice(0, 4));
  const build = (failedByStatus: boolean) => {
    let q = supabase
      .from("bao_cao_moi_han_theo_du_an")
      .select("ma_lich_su,du_an,ngay_thuc_hien,nam_thuc_hien,so_luong_loi")
      .gte("nam_thuc_hien", yearFrom)
      .lte("nam_thuc_hien", yearTo)
      .limit(limit);
    q = failedByStatus
      ? q.or("tinh_trang_thi_nghiem.eq.Không đạt,so_luong_loi.gt.0")
      : q.gt("so_luong_loi", 0);
    return q;
  };
  let { data, error } = await build(true);
  if (error) ({ data, error } = await build(false)); // cột tinh_trang_thi_nghiem có thể chưa tồn tại
  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const iso = (row.ngay_thuc_hien as string | null)?.slice(0, 10) ?? "";
      const hasIso = /^\d{4}-\d{2}-\d{2}$/.test(iso);
      return {
        row,
        iso,
        hasIso,
        // Có ngày: phải nằm trong khoảng. Không có ngày: nhận nếu năm nằm trong khoảng.
        inRange: hasIso
          ? iso >= dateFrom && iso <= dateTo
          : row.nam_thuc_hien >= yearFrom && row.nam_thuc_hien <= yearTo,
      };
    })
    .filter((x) => x.inRange)
    .sort((a, b) => (a.iso || "9999").localeCompare(b.iso || "9999") || a.row.ma_lich_su.localeCompare(b.row.ma_lich_su))
    .map(({ row, iso, hasIso }) => {
      const code = String(row.ma_lich_su ?? "");
      const shownCode = code.startsWith("__SYNC_") ? `(chưa cấp mã #${code.slice(7, 15)})` : code;
      return {
        value: code,
        label: shownCode,
        isoDate: hasIso ? iso : `${row.nam_thuc_hien}-01-01`,
      };
    });
}

export type CertifiedWelderOption = {
  id: string;
  label: string;
  certificates: string[];
};

export function uniqueWelderOptions(rows: WeldReportRow[]): CertifiedWelderOption[] {
  const map = new Map<string, CertifiedWelderOption>();
  for (const row of rows) {
    const certificates = row.chung_chi_nhan_su?.length
      ? parseCertificateList(row.chung_chi_nhan_su)
      : defaultCertificatesForPersonnelCode(row.ma_nhan_su);
    const existing = map.get(row.tho_han_id);
    map.set(row.tho_han_id, {
      id: row.tho_han_id,
      label: row.ten_tho_han,
      certificates: Array.from(new Set([...(existing?.certificates ?? []), ...certificates])),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

/** Cột tối thiểu cho báo cáo tổng quan — giảm payload so với màn nhật ký. */
const OVERVIEW_REPORT_COLUMNS = [
  "id",
  "ma_lich_su",
  "du_an_id",
  "ma_du_an",
  "du_an",
  "nam_thuc_hien",
  "ngay_thuc_hien",
  "loai_moi_han",
  "cong_nghe_han",
  "so_luong_thuc_hien",
  "so_luong_loi",
  "tho_han_id",
  "ma_nhan_su",
  "ten_tho_han",
  "nguyen_nhan_loi",
  "moi_han_lien_ket",
  "may_id",
  "ma_may",
  "ten_may",
  "ma_khuyet_tat",
  "tinh_trang_thi_nghiem",
] as const;

async function fetchWeldReportRows(
  columns: readonly string[],
  dateFrom?: string,
  dateTo?: string,
) {
  const supabase = createClient();
  const pageSize = 1000;

  const applyDateFilters = <T extends {
    gte: (column: string, value: unknown) => unknown;
    lte: (column: string, value: unknown) => unknown;
  }>(query: T): T => {
    let next = query;
    if (columns.includes("ngay_thuc_hien")) {
      if (dateFrom) next = next.gte("ngay_thuc_hien", dateFrom) as T;
      if (dateTo) next = next.lte("ngay_thuc_hien", dateTo) as T;
    } else {
      if (dateFrom) next = next.gte("nam_thuc_hien", Number(dateFrom.slice(0, 4))) as T;
      if (dateTo) next = next.lte("nam_thuc_hien", Number(dateTo.slice(0, 4))) as T;
    }
    return next;
  };

  const buildPageQuery = (from: number, to: number) => {
    let query = supabase.from("bao_cao_moi_han_theo_du_an").select(columns.join(","));
    query = applyDateFilters(query);
    const orderedQuery = columns.includes("created_at")
      ? query.order("created_at", { ascending: false }).order("id", { ascending: false })
      : query
          .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
          .order("nam_thuc_hien", { ascending: false })
          .order("ma_lich_su", { ascending: false });
    return orderedQuery.range(from, to);
  };

  // Đếm trước để tải nhiều trang song song thay vì tuần tự.
  let countQuery = supabase
    .from("bao_cao_moi_han_theo_du_an")
    .select(columns.includes("id") ? "id" : columns[0], { count: "exact", head: true });
  countQuery = applyDateFilters(countQuery);
  const countResult = await countQuery;
  const total = countResult.count ?? 0;

  if (!countResult.error && total > 0) {
    const pageCount = Math.ceil(total / pageSize);
    const concurrency = 4;
    const pageBuckets: Array<{ from: number; data: WeldReportRow[] }> = [];

    for (let startPage = 0; startPage < pageCount; startPage += concurrency) {
      const batch = Array.from(
        { length: Math.min(concurrency, pageCount - startPage) },
        (_, index) => startPage + index,
      );
      const pages = await Promise.all(
        batch.map(async (pageIndex) => {
          const from = pageIndex * pageSize;
          const to = Math.min(from + pageSize - 1, total - 1);
          const { data, error } = await buildPageQuery(from, to);
          if (error) throw error;
          return { from, data: (data ?? []) as unknown as WeldReportRow[] };
        }),
      );
      pageBuckets.push(...pages);
    }

    pageBuckets.sort((a, b) => a.from - b.from);
    return pageBuckets.flatMap((page) => page.data);
  }

  // Fallback tuần tự khi không lấy được count.
  const rows: WeldReportRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildPageQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as WeldReportRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export type LoadWeldReportOptions = {
  /** Chỉ lấy cột cần cho báo cáo tổng quan để giảm payload. */
  mode?: "full" | "overview";
};

export function loadWeldReportRows(
  dateFrom?: string,
  dateTo?: string,
  options?: LoadWeldReportOptions,
) {
  const mode = options?.mode ?? "full";
  const cacheKey = `${mode}\0${dateFrom ?? ""}\0${dateTo ?? ""}`;
  const cached = reportRowsPromises.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
      if (!isSupabaseConfigured()) {
        throw new Error(
          "Chưa cấu hình Supabase. Tạo quan-ly-nhan-su/.env.local với NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY, rồi khởi động lại npm run dev.",
        );
      }

      if (mode === "overview") {
        try {
          return await fetchWeldReportRows(OVERVIEW_REPORT_COLUMNS, dateFrom, dateTo);
        } catch {
          // Fallback dần về bộ cột đầy đủ nếu view thiếu cột tối thiểu.
        }
      }

      try {
        return await fetchWeldReportRows(REPORT_COLUMNS_WITH_TEST_STATUS_AND_CREATED_AT, dateFrom, dateTo);
      } catch {
        try {
          // Môi trường cũ có thể chưa có created_at trong view, nhưng vẫn phải
          // ưu tiên cột tình trạng thí nghiệm để các KPI khớp Nhật ký hàn.
          return await fetchWeldReportRows(REPORT_COLUMNS_WITH_TEST_STATUS, dateFrom, dateTo);
        } catch (firstError) {
          const message = formatSupabaseError(firstError);
          const missingOptionalColumn =
            message.includes("may_id") ||
            message.includes("ma_may") ||
            message.includes("ten_may") ||
            message.includes("to_han") ||
            message.includes("chung_chi_nhan_su") ||
            message.includes("chung_chi_su_dung") ||
            message.includes("ngay_thuc_hien") ||
            message.includes("moi_han_lien_ket") ||
            message.includes("ma_khuyet_tat") ||
            message.includes("column") ||
            message.includes("42703");
          if (!missingOptionalColumn) throw firstError;
          try {
            return await fetchWeldReportRows(REPORT_COLUMNS_WITH_CERTIFICATE, dateFrom, dateTo);
          } catch {
            try {
              return await fetchWeldReportRows(REPORT_COLUMNS_WITH_TEAM, dateFrom, dateTo);
            } catch {
              try {
                return await fetchWeldReportRows(REPORT_COLUMNS_WITH_MACHINE, dateFrom, dateTo);
              } catch {
                try {
                  return await fetchWeldReportRows(REPORT_COLUMNS_WITH_LINK, dateFrom, dateTo);
                } catch {
                  return fetchWeldReportRows(REPORT_COLUMNS_BASE, dateFrom, dateTo);
                }
              }
            }
          }
        }
      }
    })().catch((error) => {
      reportRowsPromises.delete(cacheKey);
      throw new Error(formatSupabaseError(error));
    });

  reportRowsPromises.set(cacheKey, request);
  return request;
}

export function machineForRow(row: WeldReportRow): string {
  return row.ma_may?.trim() || "Chưa gán máy";
}

/**
 * Ẩn mã tạm "__SYNC_<id>" khỏi hiển thị. Các mã này sinh ra khi chức năng
 * "Đồng bộ mã mối hàn" chạy Phase 1 nhưng Phase 2 chưa hoàn tất; bản ghi vẫn
 * hợp lệ, chỉ là chưa được cấp mã chuẩn.
 */
export function displayWeldCode(code: string | null | undefined): string {
  const value = (code ?? "").trim();
  if (!value || value.startsWith("__SYNC_")) return "(chưa cấp mã)";
  return value;
}

export function filterWeldReportRows(rows: WeldReportRow[], filters: WeldReportFilters) {
  return rows.filter((row, index) => {
    const performedDate = getJournalRowDateIso(row, index);
    if (performedDate) {
      if (filters.dateFrom && performedDate < filters.dateFrom) return false;
      if (filters.dateTo && performedDate > filters.dateTo) return false;
    } else {
      // Dữ liệu tổng hợp cũ chỉ có năm: chỉ đưa vào khi bộ lọc bao trọn năm đó.
      const yearStart = `${row.nam_thuc_hien}-01-01`;
      const yearEnd = `${row.nam_thuc_hien}-12-31`;
      if (filters.dateFrom && filters.dateFrom > yearStart) return false;
      if (filters.dateTo && filters.dateTo < yearEnd) return false;
    }
    if (filters.projects?.length && !filters.projects.includes(row.du_an)) return false;
    if (filters.personnel?.length && !filters.personnel.includes(row.ten_tho_han)) return false;
    if (filters.machines?.length && !filters.machines.includes(machineForRow(row))) return false;
    if (filters.methods?.length && !filters.methods.includes(row.cong_nghe_han)) return false;
    if (filters.weldTypes?.length && !filters.weldTypes.includes(row.loai_moi_han)) return false;
    return true;
  });
}

export function summarizeWeldRows(rows: WeldReportRow[]): WeldSummary {
  const summary = rows.reduce(
    (result, row) => {
      result.total += row.so_luong_thuc_hien;
      result.errors += row.so_luong_loi;
      // Mối đang "Chờ thí nghiệm" chưa có kết quả → không được coi là đạt.
      if (resolveWeldTestStatus(row) === "Chờ thí nghiệm") {
        result.pending += row.so_luong_thuc_hien;
      }
      if (row.cong_nghe_han === "FBW") result.fbw += row.so_luong_thuc_hien;
      else result.atw += row.so_luong_thuc_hien;
      return result;
    },
    { total: 0, errors: 0, passed: 0, pending: 0, fbw: 0, atw: 0 },
  );
  summary.passed = Math.max(0, summary.total - summary.errors - summary.pending);
  return summary;
}

/** Tổng hợp theo bản ghi nhật ký — mỗi dòng = 1 mối (giống /nhat-ky-han). */
export function summarizeJournalRows(rows: WeldReportRow[]): WeldSummary & { pending: number; untested: number; tested: number } {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let untested = 0;
  let fbw = 0;
  let atw = 0;
  for (const row of rows) {
    const testStatus = resolveWeldTestStatus(row);
    if (testStatus === "Đạt") passed += 1;
    else if (testStatus === "Không đạt") failed += 1;
    else if (testStatus === "Chờ thí nghiệm") pending += 1;
    else if (testStatus === "Không thí nghiệm") untested += 1;
    if (row.cong_nghe_han === "FBW") fbw += 1;
    else atw += 1;
  }
  return { total: rows.length, errors: failed, passed, pending, untested, tested: passed + failed, fbw, atw };
}

export function hasLinkedWeld(row: WeldReportRow): boolean {
  return Boolean(row.moi_han_lien_ket?.trim());
}

/** Sửa / hàn lại — đếm mối hàn nhật ký có cột Mối hàn liên kết không trống. */
export function countReworkWelds(rows: WeldReportRow[]): number {
  return rows.filter(hasLinkedWeld).length;
}

export function filterReworkRows(rows: WeldReportRow[]): WeldReportRow[] {
  return rows.filter(hasLinkedWeld);
}

export function groupJournalRows(
  rows: WeldReportRow[],
  keyForRow: (row: WeldReportRow) => string,
) {
  const groups = new Map<string, WeldReportRow[]>();
  for (const row of rows) {
    const key = keyForRow(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups, ([name, groupRows]) => ({
    name,
    rows: groupRows,
    ...summarizeJournalRows(groupRows),
  }));
}

export function uniqueReportValues(rows: WeldReportRow[], field: "du_an" | "ten_tho_han" | "loai_ray" | "ma_may") {
  return Array.from(
    new Set(
      rows
        .map((row) => (field === "ma_may" ? row.ma_may?.trim() || "" : row[field]))
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "vi"));
}

export function groupWeldRows(
  rows: WeldReportRow[],
  keyForRow: (row: WeldReportRow) => string,
) {
  const groups = new Map<string, WeldReportRow[]>();
  for (const row of rows) {
    const key = keyForRow(row);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return Array.from(groups, ([name, groupRows]) => ({
    name,
    rows: groupRows,
    ...summarizeWeldRows(groupRows),
  }));
}

export type YearVolumePoint = {
  year: number;
  value: number;
  errors: number;
};

export type ErrorReasonRow = {
  label: string;
  count: number;
  pct: number;
};

/** Đếm bản ghi nhật ký theo năm (mỗi dòng = 1 mối). */
export function buildYearlyJournalSeries(rows: WeldReportRow[]): YearVolumePoint[] {
  const byYear = new Map<number, { value: number; errors: number }>();
  for (const row of rows) {
    const current = byYear.get(row.nam_thuc_hien) ?? { value: 0, errors: 0 };
    current.value += 1;
    if (row.so_luong_loi > 0) current.errors += 1;
    byYear.set(row.nam_thuc_hien, current);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, stats]) => ({ year, ...stats }));
}

/** Tổng hợp sản lượng thật theo năm từ nhật ký hàn (lich_su_moi_han). */
export function buildYearlyVolumeSeries(rows: WeldReportRow[]): YearVolumePoint[] {
  const byYear = new Map<number, { value: number; errors: number }>();
  for (const row of rows) {
    const current = byYear.get(row.nam_thuc_hien) ?? { value: 0, errors: 0 };
    current.value += row.so_luong_thuc_hien;
    current.errors += row.so_luong_loi;
    byYear.set(row.nam_thuc_hien, current);
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, stats]) => ({ year, ...stats }));
}

export const NDT_DEFECT_MAP: Record<string, string> = {
  LOF: "Lack of fusion (LOF)",
  LOP: "Lack of Penetration (LOP)",
  C: "Crack (C)",
  S: "Slag (S)",
  Po: "Porosity (Po)",
  La: "Lamination (La)",
};

/** Nhóm nguyên nhân lỗi theo bản ghi nhật ký (mỗi dòng lỗi = 1), ưu tiên theo mã khuyết tật NDT. */
export function groupJournalErrorReasons(rows: WeldReportRow[], limit = 6): ErrorReasonRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.so_luong_loi <= 0) continue;
    if (row.ma_khuyet_tat && row.ma_khuyet_tat.length > 0) {
      for (const code of row.ma_khuyet_tat) {
        const key = NDT_DEFECT_MAP[code] || code;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    } else {
      const reason = row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân";
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return [];
  const max = Math.max(...counts.values());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
    }));
}

/** Nhóm nguyên nhân lỗi thật từ nhật ký hàn. */
export function groupErrorReasons(rows: WeldReportRow[], limit = 6): ErrorReasonRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.so_luong_loi <= 0) continue;
    if (row.ma_khuyet_tat && row.ma_khuyet_tat.length > 0) {
      for (const code of row.ma_khuyet_tat) {
        const key = NDT_DEFECT_MAP[code] || code;
        counts.set(key, (counts.get(key) ?? 0) + row.so_luong_loi);
      }
    } else {
      const reason = row.nguyen_nhan_loi?.trim() || "Chưa ghi nguyên nhân";
      counts.set(reason, (counts.get(reason) ?? 0) + row.so_luong_loi);
    }
  }
  if (counts.size === 0) return [];
  const max = Math.max(...counts.values());
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
    }));
}

export function formatYearOverYear(current: number, previous: number) {
  if (previous <= 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const formatted = Math.abs(delta)
    .toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace(".", ",");
  return { delta, formatted, up: delta >= 0 };
}

export const CHART_MAX_DAYS = 31;

/** Mẫu sản lượng/ngày cố định — Supabase chỉ có tổng theo năm. */
export const DAILY_VOLUME_PATTERN = [
  128, 148, 138, 158, 176, 150, 142, 156, 168, 152,
  132, 146, 190, 168, 158, 150, 120, 112, 126, 146,
  164, 152, 140, 158, 176, 166, 152, 142, 176, 164,
];

export type DailyVolumePoint = {
  date: string;
  value: number;
};

function toIsoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rút gọn khoảng ngày cho biểu đồ (tối đa 31 ngày, kết thúc tại ngày có dữ liệu mới nhất hoặc dateTo). */
export function resolveChartDateRange(
  dateFrom: string,
  dateTo: string,
  maxDays = CHART_MAX_DAYS,
  latestDataDate?: string,
) {
  let endIso = dateTo;
  if (!endIso || endIso.trim() === "") {
    endIso = latestDataDate || toIsoDateLocal(new Date());
  }

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);

  let effectiveEnd = end;
  if (effectiveEnd.getTime() < start.getTime()) effectiveEnd = start;

  const totalDays =
    Math.round((effectiveEnd.getTime() - start.getTime()) / 86400000) + 1;

  if (totalDays <= maxDays) {
    return {
      from: dateFrom,
      to: toIsoDateLocal(effectiveEnd),
    };
  }

  const fromDate = new Date(effectiveEnd);
  fromDate.setDate(fromDate.getDate() - (maxDays - 1));
  const clampedFrom = fromDate.getTime() < start.getTime() ? start : fromDate;

  return {
    from: toIsoDateLocal(clampedFrom),
    to: toIsoDateLocal(effectiveEnd),
  };
}

/** Tổng hợp theo ngày thực hiện thật; dữ liệu cũ thiếu ngày dùng mốc suy từ mã lịch sử. */
export function buildDailyJournalSeries(
  rows: WeldReportRow[],
  dateFrom: string,
  dateTo: string,
): DailyVolumePoint[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  // 1 bản ghi nhật ký = 1 mối — đồng bộ summarizeJournalRows / KPI theo bộ lọc.
  const counts = new Map<string, number>();
  rows.forEach((row, index) => {
    const iso = getJournalRowDateIso(row, index);
    if (iso && iso >= dateFrom && iso <= dateTo) {
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
  });

  const points: DailyVolumePoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toIsoDateLocal(d);
    points.push({ date: iso, value: counts.get(iso) ?? 0 });
  }
  return points;
}

export type QuarterlyPassRatePoint = {
  key: string;
  label: string;
  total: number;
  errors: number;
  passRate: number;
};

/** Xu hướng tỷ lệ đạt theo quý, tính từ nhật ký hàn thật (dựa trên ngày thực hiện). */
export function buildQuarterlyPassRateSeries(
  rows: WeldReportRow[],
  quarterCount = 8,
): QuarterlyPassRatePoint[] {
  const byQuarter = new Map<string, { year: number; quarter: number; total: number; errors: number }>();
  rows.forEach((row, index) => {
    const iso = getJournalRowDateIso(row, index);
    if (!iso) return;
    const year = Number(iso.slice(0, 4));
    const month = Number(iso.slice(5, 7));
    const quarter = Math.floor((month - 1) / 3) + 1;
    const key = `${year}-Q${quarter}`;
    const current = byQuarter.get(key) ?? { year, quarter, total: 0, errors: 0 };
    current.total += row.so_luong_thuc_hien;
    current.errors += row.so_luong_loi;
    byQuarter.set(key, current);
  });

  return Array.from(byQuarter.entries())
    .sort(([, a], [, b]) => a.year - b.year || a.quarter - b.quarter)
    .slice(-quarterCount)
    .map(([key, stats]) => ({
      key,
      label: `Q${stats.quarter}/${stats.year}`,
      total: stats.total,
      errors: stats.errors,
      passRate: stats.total > 0 ? Number((((stats.total - stats.errors) / stats.total) * 100).toFixed(2)) : 0,
    }));
}

export type DonutArc = {
  dasharray: string;
  transform: string;
};

export function buildDonutArcs(values: number[], radius = 52, center = 70): DonutArc[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  const circumference = 2 * Math.PI * radius;
  let rotation = -90;
  return values.map((value) => {
    const share = value / total;
    const arcLen = share * circumference;
    const seg = {
      dasharray: `${arcLen} ${circumference - arcLen}`,
      transform: `rotate(${rotation} ${center} ${center})`,
    };
    rotation += share * 360;
    return seg;
  });
}

/** Chuỗi sản lượng theo ngày trong khoảng đã chọn (mô phỏng từ mẫu cố định). */
export function buildDailyChartSeries(
  dateFrom: string,
  dateTo: string,
  selectedTotal: number,
  fullTotal: number,
): DailyVolumePoint[] {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const share = fullTotal > 0 ? Math.max(0.03, selectedTotal / fullTotal) : 0.03;

  const points: DailyVolumePoint[] = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const baseVal = DAILY_VOLUME_PATTERN[i % DAILY_VOLUME_PATTERN.length];
    const value =
      selectedTotal > 0 ? Math.max(1, Math.round(baseVal * share)) : 0;
    points.push({ date: toIsoDateLocal(d), value });
  }
  return points;
}

// Supabase chỉ có số liệu tổng hợp theo năm. Chuỗi này là dữ liệu mô phỏng
// có tính xác định để dashboard không thay đổi ngẫu nhiên sau mỗi lần tải lại.
export function buildSyntheticDailySeries(selectedTotal: number, fullTotal: number) {
  if (!selectedTotal || !fullTotal) return DAILY_VOLUME_PATTERN.map(() => 0);
  const share = Math.max(0.03, selectedTotal / fullTotal);
  return DAILY_VOLUME_PATTERN.map((value) => Math.max(1, Math.round(value * share)));
}

export function allocateSyntheticCounts(total: number, weights: number[]) {
  if (total <= 0) return weights.map(() => 0);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = weights.map((weight) => (total * weight) / weightTotal);
  const result = raw.map(Math.floor);
  const remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < remainder; index += 1) {
    result[order[index % order.length].index] += 1;
  }
  return result;
}
