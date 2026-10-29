import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyJournalListFilters, orderJournalByWeldTime, WELD_TEST_STATUSES,
  type WeldJournalPageQuery, type WeldJournalPageResult, type WeldReportRow } from "@/lib/weldReportData";
import { emptyWeldInspection, GEOMETRY_CRITERIA, parseWeldMeasurement, validateGeometryLimits, WELD_QUALITY_STATUSES,
  type GeometryLimits, type QualityResult, type SavedWeldInspection, type SavedWeldQualityRule } from "@/lib/weldQuality";
import { createWeldQualityRule, loadWeldQuality, saveWeldQualityInspection } from "@/lib/server/weldQualityDb";
import { QualityApiError } from "@/lib/server/weldQualityAuth";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new QualityApiError("Dữ liệu phải là một đối tượng.");
  return value as Record<string, unknown>;
}

export function qualityUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new QualityApiError("Mã bản ghi không hợp lệ.");
  return value;
}

function text(value: unknown, max = 1000): string {
  if (typeof value !== "string" || value.length > max) throw new QualityApiError("Nội dung văn bản không hợp lệ.");
  return value.trim();
}

export function qualityDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new QualityApiError("Ngày không hợp lệ.");
  return value;
}

function version(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new QualityApiError("Phiên bản kiểm tra không hợp lệ.");
  return value;
}

function result(value: unknown): QualityResult {
  if (value == null || value === "") return null;
  if (value !== "Đạt" && value !== "Không đạt") throw new QualityApiError("Kết quả kiểm tra không hợp lệ.");
  return value;
}

export function parseQualityFilters(value: unknown): WeldJournalPageQuery {
  const v = object(value);
  const page = v.page ?? 1, pageSize = v.pageSize ?? 50;
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1 || typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new QualityApiError("Phân trang không hợp lệ.");
  if (v.projects != null && (!Array.isArray(v.projects) || v.projects.length > 100)) throw new QualityApiError("Bộ lọc dự án không hợp lệ.");
  const qualityStatusFilter = text(v.qualityStatusFilter ?? "Tất cả", 300);
  const resultFilter = text(v.resultFilter ?? "Tất cả", 40);
  const linkedWeldFilter = text(v.linkedWeldFilter ?? "Tất cả", 40);
  const weldTypeFilter = text(v.weldTypeFilter ?? "Tất cả", 40);
  const weldMethodFilter = text(v.weldMethodFilter ?? "Tất cả", 20);
  if (!(qualityStatusFilter === "Tất cả" || qualityStatusFilter.split(",").every((s) => (WELD_QUALITY_STATUSES as string[]).includes(s))) || !["Tất cả", ...WELD_TEST_STATUSES].includes(resultFilter) ||
    !["Tất cả", "Có liên kết", "Chưa liên kết"].includes(linkedWeldFilter) ||
    !["Tất cả", "Sản xuất", "Đào tạo", "Thử nghiệm", "Chấp thuận", "Tần suất"].includes(weldTypeFilter) ||
    !["Tất cả", "FBW", "ATW"].includes(weldMethodFilter)) throw new QualityApiError("Giá trị bộ lọc không hợp lệ.");
  const dateFrom = qualityDate(v.dateFrom), dateTo = qualityDate(v.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) throw new QualityApiError("Từ ngày phải trước hoặc bằng đến ngày.");
  return { page, pageSize, qualityStatusFilter, resultFilter, linkedWeldFilter, weldTypeFilter, weldMethodFilter,
    query: text(v.query ?? "", 200).replace(/[(),]/g, " "), projects: (v.projects as unknown[] ?? []).map((p) => text(p, 300)), dateFrom: dateFrom ?? "", dateTo: dateTo ?? "" };
}

function journalRequest(filters: WeldJournalPageQuery) {
  return orderJournalByWeldTime(applyJournalListFilters(createAdminClient().from("nhat_ky_han_chat_luong").select("*", { count: "exact" }), filters), true, true);
}

export async function loadQualityJournalPage(filters: WeldJournalPageQuery): Promise<WeldJournalPageResult> {
  const pageSize = filters.pageSize ?? 50;
  const { data, error, count } = await journalRequest(filters).range((filters.page - 1) * pageSize, filters.page * pageSize - 1);
  if (error) throw error;
  const counts = await Promise.all(WELD_TEST_STATUSES.map(async (status) => {
    if (filters.resultFilter !== "Tất cả" && filters.resultFilter !== status) return 0;
    const res = await applyJournalListFilters(createAdminClient().from("nhat_ky_han_chat_luong").select("id", { count: "exact", head: true }).eq("tinh_trang_thi_nghiem", status), { ...filters, resultFilter: "Tất cả" });
    if (res.error) throw res.error;
    return res.count ?? 0;
  }));
  return { rows: data as WeldReportRow[], total: count ?? 0, page: filters.page, pageSize,
    pendingCount: counts[0], passCount: counts[1], failCount: counts[2], untestedCount: counts[3] };
}

export async function loadQualityJournalRows(filters: WeldJournalPageQuery, selectionOnly = false) {
  const rows: WeldReportRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const request = orderJournalByWeldTime(applyJournalListFilters(createAdminClient().from("nhat_ky_han_chat_luong")
      .select(selectionOnly ? "id,ma_lich_su,phien_ban_chat_luong" : "*"), filters), true, true);
    const { data, error } = await request.range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data as unknown as WeldReportRow[]);
    if (data.length < 1000) break;
  }
  return rows;
}

export async function loadQualityDetail(weldId: string) {
  const { data: weld, error } = await createAdminClient().from("lich_su_moi_han").select("id,du_an_id,cong_nghe_han,loai_moi_han,so_luong_thuc_hien,ma_lich_su").eq("id", weldId).single();
  if (error) throw error;
  const [quality, rules] = await Promise.all([
    loadWeldQuality(weldId),
    createAdminClient().from("tieu_chuan_nghiem_thu_moi_han").select("*").eq("du_an_id", weld.du_an_id)
      .eq("cong_nghe_han", weld.cong_nghe_han).eq("loai_moi_han", weld.loai_moi_han).order("phien_ban", { ascending: false }),
  ]);
  if (rules.error) throw rules.error;
  return { ...quality, weld, rules: rules.data as SavedWeldQualityRule[] };
}

export function parseQualityInspection(value: unknown, actor: string): SavedWeldInspection {
  const v = object(value);
  const measurements = object(v.gia_tri_do ?? {});
  if (Object.keys(measurements).some((k) => !GEOMETRY_CRITERIA.includes(k as typeof GEOMETRY_CRITERIA[number]))) throw new QualityApiError("Tiêu chí số đo không hợp lệ.");
  const phuong_phap_ndt = v.phuong_phap_ndt ?? "Siêu âm";
  if (phuong_phap_ndt !== "Siêu âm" && phuong_phap_ndt !== "Từ tính" && phuong_phap_ndt !== "Thẩm thấu") throw new QualityApiError("Phương pháp NDT không hợp lệ.");
  const parsed: SavedWeldInspection = { ...emptyWeldInspection(qualityUuid(v.moi_han_id)),
    phien_ban: version(v.phien_ban), tieu_chuan_id: v.tieu_chuan_id ? qualityUuid(v.tieu_chuan_id) : null,
    ngay_mai: qualityDate(v.ngay_mai), truc_quan: result(v.truc_quan),
    gia_tri_do: Object.fromEntries(GEOMETRY_CRITERIA.map((k) => [k, parseWeldMeasurement(measurements[k])])),
    phuong_phap_ndt, ket_qua_ndt: result(v.ket_qua_ndt), ngay_ndt: qualityDate(v.ngay_ndt),
    nguoi_ghi_nhan: actor, ghi_chu: v.ghi_chu == null ? null : text(v.ghi_chu, 4000),
    ly_do_loai_nghiem_thu: v.ly_do_loai_nghiem_thu == null ? null : text(v.ly_do_loai_nghiem_thu, 4000) || null };
  if (parsed.truc_quan && !parsed.ngay_mai) throw new QualityApiError("Hãy nhập ngày mài trước khi kết luận trực quan.");
  if (parsed.ket_qua_ndt && !parsed.ngay_ndt) throw new QualityApiError("Hãy nhập ngày thí nghiệm NDT.");
  return parsed;
}

export async function markQualityBatch(body: Record<string, unknown>, actor: string) {
  if (body.kind !== "visual" && body.kind !== "ndt") throw new QualityApiError("Thao tác kiểm tra không hợp lệ.");
  const date = qualityDate(body.date);
  if (!date || !Array.isArray(body.entries) || !body.entries.length || body.entries.length > 100) throw new QualityApiError("Chọn 1–100 mối mỗi lượt và nhập ngày kiểm tra.");
  const entries = body.entries.map((v) => { const e = object(v); return { id: qualityUuid(e.id), phien_ban: version(e.phien_ban) }; });
  if (new Set(entries.map((e) => e.id)).size !== entries.length) throw new QualityApiError("Danh sách mối bị trùng.");
  const results: { id: string; error?: string; phien_ban?: number }[] = [];
  // Giới hạn 5 mối đồng thời để một lượt 100 mối không giữ kết nối DB quá lâu.
  for (let offset = 0; offset < entries.length; offset += 5) {
    await Promise.all(entries.slice(offset, offset + 5).map(async (entry) => {
    try {
      const { inspection } = await loadWeldQuality(entry.id);
      const current = inspection ?? emptyWeldInspection(entry.id);
      if (current.phien_ban !== entry.phien_ban) throw new QualityApiError("Dữ liệu đã thay đổi; hãy tải lại.", 409);
      const patch = body.kind === "visual" ? { ngay_mai: date, truc_quan: "Đạt" } : { ngay_ndt: date, ket_qua_ndt: "Đạt", phuong_phap_ndt: body.method ?? "Siêu âm" };
      const saved = await saveWeldQualityInspection(parseQualityInspection({ ...current, ...patch }, actor));
      results.push({ id: entry.id, phien_ban: saved.phien_ban });
    } catch (error) { results.push({ id: entry.id, error: error instanceof Error ? error.message : "Không lưu được kiểm tra." }); }
    }));
  }
  return results;
}

export async function importQualityBatch(body: Record<string, unknown>, actor: string) {
  if (!Array.isArray(body.entries) || !body.entries.length || body.entries.length > 100) throw new QualityApiError("Chọn 1–100 kiểm tra mỗi lượt.");
  const allowed = ["tieu_chuan_id", "ngay_mai", "truc_quan", "gia_tri_do", "phuong_phap_ndt", "ket_qua_ndt", "ngay_ndt", "ghi_chu"];
  const entries = body.entries.map((value) => {
    const e = object(value), patch = object(e.patch);
    if (Object.keys(patch).some((k) => !allowed.includes(k))) throw new QualityApiError("Cột kiểm tra không hợp lệ.");
    return { id: qualityUuid(e.moi_han_id), phien_ban: version(e.phien_ban), patch };
  });
  if (new Set(entries.map((e) => e.id)).size !== entries.length) throw new QualityApiError("Danh sách bị trùng mối hàn.");
  const results: { id: string; error?: string }[] = [];
  for (let offset = 0; offset < entries.length; offset += 5) {
    await Promise.all(entries.slice(offset, offset + 5).map(async (e) => {
    try {
      const { inspection } = await loadWeldQuality(e.id);
      const current = inspection ?? emptyWeldInspection(e.id);
      if (current.phien_ban !== e.phien_ban) throw new QualityApiError("Dữ liệu đã thay đổi; hãy xuất lại Excel.", 409);
      const next = { ...current, ...e.patch, moi_han_id: e.id, phien_ban: e.phien_ban,
        gia_tri_do: { ...current.gia_tri_do, ...(e.patch.gia_tri_do == null ? {} : object(e.patch.gia_tri_do)) } };
      await saveWeldQualityInspection(parseQualityInspection(next, actor));
      results.push({ id: e.id });
    } catch (error) { results.push({ id: e.id, error: error instanceof Error ? error.message : "Không lưu được kiểm tra." }); }
    }));
  }
  return results;
}

export async function createQualityRuleForWeld(body: Record<string, unknown>, actor: string) {
  const { weld } = await loadQualityDetail(qualityUuid(body.weldId));
  if (body.confirmed !== true) throw new QualityApiError("Cần xác nhận tiêu chí áp dụng cho dự án.");
  const limitsInput = object(body.dung_sai);
  const dung_sai = Object.fromEntries(GEOMETRY_CRITERIA.map((k) => {
    const b = object(limitsInput[k]);
    return [k, { min: parseWeldMeasurement(b.min), max: parseWeldMeasurement(b.max), minInclusive: b.minInclusive, maxInclusive: b.maxInclusive }];
  }));
  validateGeometryLimits(dung_sai);
  if (typeof body.yeu_cau_ndt !== "boolean" || typeof body.ndt_truoc_rfi !== "boolean") throw new QualityApiError("Quy tắc thí nghiệm không hợp lệ.");
  const exemption = text(body.can_cu_mien_ndt ?? "", 2000);
  if (!body.yeu_cau_ndt && !exemption) throw new QualityApiError("Cần nêu căn cứ miễn NDT.");
  const { data: previous, error } = await createAdminClient().from("tieu_chuan_nghiem_thu_moi_han").select("phien_ban,dang_ap_dung")
    .eq("du_an_id", weld.du_an_id).eq("cong_nghe_han", weld.cong_nghe_han).eq("loai_moi_han", weld.loai_moi_han).order("phien_ban", { ascending: false });
  if (error) throw error;
  if (previous.some((r) => r.dang_ap_dung)) throw new QualityApiError("Đã có tiêu chí đang áp dụng; hãy tải lại và chọn tiêu chí đó.", 409);
  return createWeldQualityRule({ du_an_id: weld.du_an_id, cong_nghe_han: weld.cong_nghe_han, loai_moi_han: weld.loai_moi_han,
    phien_ban: (previous[0]?.phien_ban ?? 0) + 1, ten: text(body.ten, 300), dung_sai: dung_sai as GeometryLimits,
    yeu_cau_ndt: body.yeu_cau_ndt, ndt_truoc_rfi: body.ndt_truoc_rfi, can_cu_mien_ndt: exemption || null, nguoi_xac_nhan: actor, dang_ap_dung: true });
}
