import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Công cụ TRA CỨU (chỉ đọc) cho chatbot Gemini: số mối hàn theo ngày, nhật ký thi công, tình trạng chất lượng.
 * Chỉ trả số liệu tổng hợp / nội dung nhật ký, không có thao tác ghi. Người gọi phải đã được kiểm quyền xem báo cáo.
 */
const db = () => createAdminClient();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;
const PAGE = 1000;
const MAX_PAGES = 20;

export const CHAT_DATA_DECLARATIONS = [
  {
    name: "thong_ke_moi_han",
    description: "Tra cứu số mối hàn đã thực hiện (từ Nhật ký hàn) theo ngày trong khoảng từ ngày đến ngày, có thể lọc theo tên dự án. Trả về tổng số mối, số mối theo từng ngày và theo dự án. Dùng khi hỏi «ngày X hàn bao nhiêu mối», «tuần này», «tháng này»...",
    parameters: {
      type: "OBJECT",
      properties: {
        tu_ngay: { type: "STRING", description: "Ngày bắt đầu, định dạng YYYY-MM-DD" },
        den_ngay: { type: "STRING", description: "Ngày kết thúc, định dạng YYYY-MM-DD (bằng tu_ngay nếu hỏi một ngày)" },
        du_an: { type: "STRING", description: "Một phần tên dự án để lọc (không bắt buộc)" },
      },
      required: ["tu_ngay", "den_ngay"],
    },
  },
  {
    name: "nhat_ky_han",
    description: "Đọc CHI TIẾT từng dòng trong bảng Nhật ký hàn (mỗi dòng một mối hàn): mã mối, ngày, dự án, thợ hàn, máy hàn, loại ray, công nghệ, ca, giờ, kết quả thử nghiệm, lỗi, tình trạng chất lượng. Có thể lọc theo ngày, dự án, thợ hàn, máy, mã mối. Dùng khi hỏi ai hàn mối nào, mối X do ai/máy nào làm, danh sách mối của một ngày, mối bị lỗi...",
    parameters: {
      type: "OBJECT",
      properties: {
        tu_ngay: { type: "STRING", description: "Ngày bắt đầu YYYY-MM-DD (không bắt buộc)" },
        den_ngay: { type: "STRING", description: "Ngày kết thúc YYYY-MM-DD (không bắt buộc)" },
        du_an: { type: "STRING", description: "Một phần tên dự án" },
        tho_han: { type: "STRING", description: "Một phần tên hoặc mã thợ hàn" },
        may_han: { type: "STRING", description: "Một phần tên hoặc mã máy hàn" },
        ma_moi_han: { type: "STRING", description: "Một phần mã mối hàn (mã lịch sử hoặc mã hiện trường, vd FBW-1211260115)" },
        chi_moi_loi: { type: "BOOLEAN", description: "true = chỉ các mối có lỗi" },
        gioi_han: { type: "INTEGER", description: "Số dòng tối đa trả về (mặc định 50, tối đa 200)" },
      },
    },
  },
  {
    name: "nhat_ky_thi_cong",
    description: "Đọc nội dung Nhật ký thi công đã lưu của một ngày (công việc thực hiện, nghiệm thu trong ngày, nhân lực, thiết bị...). Dùng khi hỏi hôm đó thi công / nghiệm thu những gì.",
    parameters: {
      type: "OBJECT",
      properties: {
        ngay: { type: "STRING", description: "Ngày, định dạng YYYY-MM-DD" },
        du_an: { type: "STRING", description: "Một phần tên dự án để lọc (không bắt buộc)" },
      },
      required: ["ngay"],
    },
  },
  {
    name: "tinh_trang_chat_luong",
    description: "Đếm số mối hàn theo tình trạng chất lượng hiện tại (Chờ mài, Mài xong, Chờ siêu âm, Chờ nghiệm thu, Đạt...), có thể lọc theo tên dự án.",
    parameters: {
      type: "OBJECT",
      properties: { du_an: { type: "STRING", description: "Một phần tên dự án để lọc (không bắt buộc)" } },
    },
  },
] as const;

export const CHAT_DATA_TOOL_NAMES = new Set<string>(CHAT_DATA_DECLARATIONS.map((tool) => tool.name));

const text = (value: unknown, max = 100) => (typeof value === "string" ? value.trim().slice(0, max) : "");

async function projectIds(name: string) {
  if (!name) return null;
  const { data, error } = await db().from("du_an").select("id,du_an").ilike("du_an", `%${name.replace(/[%_,()]/g, " ")}%`).limit(20);
  if (error) throw error;
  return (data ?? []) as { id: string; du_an: string }[];
}

async function thongKeMoiHan(args: Record<string, unknown>) {
  const from = text(args.tu_ngay, 10), to = text(args.den_ngay, 10);
  if (!DATE.test(from) || !DATE.test(to) || to < from) return { loi: "Ngày không hợp lệ (cần YYYY-MM-DD, từ ngày ≤ đến ngày)." };
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (days > MAX_DAYS) return { loi: `Khoảng ngày quá dài (tối đa ${MAX_DAYS} ngày).` };
  const projects = await projectIds(text(args.du_an));
  if (projects && !projects.length) return { loi: "Không tìm thấy dự án khớp tên." };
  const rows: { ngay_thuc_hien: string; du_an: string | null; so_luong_loi: number | null }[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = db().from("bao_cao_moi_han_theo_du_an").select("ngay_thuc_hien,du_an,so_luong_loi").gte("ngay_thuc_hien", from).lte("ngay_thuc_hien", to).order("id").range(page * PAGE, page * PAGE + PAGE - 1);
    if (projects) query = query.in("du_an_id", projects.map((p) => p.id));
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < PAGE) break;
  }
  const byDay = new Map<string, { so_moi: number; moi_loi: number }>();
  const byProject = new Map<string, number>();
  for (const r of rows) {
    const day = byDay.get(r.ngay_thuc_hien) ?? { so_moi: 0, moi_loi: 0 };
    day.so_moi += 1;
    if ((r.so_luong_loi ?? 0) > 0) day.moi_loi += 1;
    byDay.set(r.ngay_thuc_hien, day);
    const name = r.du_an ?? "(không rõ)";
    byProject.set(name, (byProject.get(name) ?? 0) + 1);
  }
  // Ngày không có mối nào vẫn được liệt kê (0) để trả lời đúng «ngày đó không hàn».
  const theoNgay: { ngay: string; so_moi: number; moi_loi: number }[] = [];
  for (let i = 0; i < Math.min(days, 62); i++) {
    const d = new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
    theoNgay.push({ ngay: d, ...(byDay.get(d) ?? { so_moi: 0, moi_loi: 0 }) });
  }
  return {
    tu_ngay: from, den_ngay: to, tong_moi_han: rows.length,
    theo_ngay: theoNgay, ...(days > 62 ? { ghi_chu: "Chỉ liệt kê 62 ngày đầu; tổng_moi_han là của cả khoảng." } : {}),
    theo_du_an: [...byProject.entries()].map(([du_an, so_moi]) => ({ du_an, so_moi })).sort((a, b) => b.so_moi - a.so_moi),
  };
}

async function nhatKyHan(args: Record<string, unknown>) {
  const from = text(args.tu_ngay, 10), to = text(args.den_ngay, 10);
  if ((from && !DATE.test(from)) || (to && !DATE.test(to)) || (from && to && to < from)) return { loi: "Ngày không hợp lệ (cần YYYY-MM-DD, từ ngày ≤ đến ngày)." };
  const limit = Math.min(200, Math.max(1, Math.round(Number(args.gioi_han) || 50)));
  const projects = await projectIds(text(args.du_an));
  if (projects && !projects.length) return { loi: "Không tìm thấy dự án khớp tên." };
  const clean = (v: string) => v.replace(/[%_,()*]/g, " ").trim();
  let query = db().from("bao_cao_moi_han_theo_du_an")
    .select("id,ma_lich_su,ma_hien_truong,ngay_thuc_hien,du_an,loai_ray,loai_moi_han,cong_nghe_han,ten_tho_han,ma_nhan_su,ten_may,ma_may,ca_han,gio_bat_dau,gio_ket_thuc,so_luong_loi,nguyen_nhan_loi,ma_khuyet_tat,tinh_trang_thi_nghiem,ghi_chu", { count: "exact" })
    .order("ngay_thuc_hien", { ascending: false }).order("ma_lich_su").limit(limit);
  if (from) query = query.gte("ngay_thuc_hien", from);
  if (to) query = query.lte("ngay_thuc_hien", to);
  if (projects) query = query.in("du_an_id", projects.map((p) => p.id));
  const tho = clean(text(args.tho_han)), may = clean(text(args.may_han)), ma = clean(text(args.ma_moi_han));
  if (tho) query = query.or(`ten_tho_han.ilike.%${tho}%,ma_nhan_su.ilike.%${tho}%`);
  if (may) query = query.or(`ten_may.ilike.%${may}%,ma_may.ilike.%${may}%`);
  if (ma) query = query.or(`ma_lich_su.ilike.%${ma}%,ma_hien_truong.ilike.%${ma}%`);
  if (args.chi_moi_loi === true) query = query.gt("so_luong_loi", 0);
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as { id: string; [key: string]: unknown }[];
  // Tình trạng chất lượng hiện tại của từng mối (Chờ mài, Mài xong, Chờ siêu âm...).
  const quality = new Map<string, string>();
  if (rows.length) {
    const q = await db().from("chat_luong_moi_han").select("moi_han_id,tinh_trang").in("moi_han_id", rows.map((row) => row.id));
    for (const row of (q.data ?? []) as { moi_han_id: string; tinh_trang: string | null }[]) if (row.tinh_trang) quality.set(row.moi_han_id, row.tinh_trang);
  }
  return {
    tong_so_dong_khop: count ?? rows.length,
    tra_ve: rows.length,
    ...((count ?? 0) > rows.length ? { ghi_chu: "Còn nhiều dòng nữa; thu hẹp bộ lọc (ngày, dự án, thợ, máy, mã mối) hoặc tăng gioi_han." } : {}),
    moi_han: rows.map(({ id, ...row }) => ({ ...row, tinh_trang_chat_luong: quality.get(id) ?? null })),
  };
}

async function nhatKyThiCong(args: Record<string, unknown>) {
  const date = text(args.ngay, 10);
  if (!DATE.test(date)) return { loi: "Ngày không hợp lệ (cần YYYY-MM-DD)." };
  const projects = await projectIds(text(args.du_an));
  if (projects && !projects.length) return { loi: "Không tìm thấy dự án khớp tên." };
  let query = db().from("nhat_ky_thi_cong_ngay").select("du_an_id,ngay,du_lieu").eq("ngay", date).limit(10);
  if (projects) query = query.in("du_an_id", projects.map((p) => p.id));
  const { data, error } = await query;
  if (error) throw error;
  const names = new Map((await projectIds("") ?? (await db().from("du_an").select("id,du_an").limit(200)).data ?? []).map((p: { id: string; du_an: string }) => [p.id, p.du_an]));
  if (!data?.length) return { ngay: date, ghi_chu: "Chưa có Nhật ký thi công đã lưu cho ngày này." };
  const pick = (v: unknown) => (typeof v === "string" ? v.slice(0, 1500) : v);
  return {
    ngay: date,
    nhat_ky: (data as { du_an_id: string; du_lieu: Record<string, unknown> }[]).map((row) => ({
      du_an: names.get(row.du_an_id) ?? row.du_an_id,
      thoi_tiet: pick(row.du_lieu?.thoiTiet),
      cong_viec_thuc_hien: pick(row.du_lieu?.noiDungCongViec),
      nghiem_thu_trong_ngay: pick(row.du_lieu?.nghiemThuHangNgay),
      thiet_bi: pick(row.du_lieu?.thietBi),
      nhan_luc: { ban_chi_huy: row.du_lieu?.banChiHuy, can_bo_ky_thuat: row.du_lieu?.canBoKyThuat, cong_nhan: row.du_lieu?.congNhan },
    })),
  };
}

async function tinhTrangChatLuong(args: Record<string, unknown>) {
  const projects = await projectIds(text(args.du_an));
  if (projects && !projects.length) return { loi: "Không tìm thấy dự án khớp tên." };
  const counts = new Map<string, number>();
  let total = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = db().from("chat_luong_moi_han").select("tinh_trang").order("moi_han_id").range(page * PAGE, page * PAGE + PAGE - 1);
    if (projects) query = query.in("du_an_id", projects.map((p) => p.id));
    const { data, error } = await query;
    if (error) throw error;
    for (const r of (data ?? []) as { tinh_trang: string | null }[]) { counts.set(r.tinh_trang ?? "(chưa có)", (counts.get(r.tinh_trang ?? "(chưa có)") ?? 0) + 1); total += 1; }
    if ((data ?? []).length < PAGE) break;
  }
  return { tong_moi_han: total, theo_tinh_trang: [...counts.entries()].map(([tinh_trang, so_moi]) => ({ tinh_trang, so_moi })).sort((a, b) => b.so_moi - a.so_moi) };
}

export async function runChatDataTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    if (name === "thong_ke_moi_han") return await thongKeMoiHan(args);
    if (name === "nhat_ky_han") return await nhatKyHan(args);
    if (name === "nhat_ky_thi_cong") return await nhatKyThiCong(args);
    if (name === "tinh_trang_chat_luong") return await tinhTrangChatLuong(args);
  } catch (error) {
    return { loi: error instanceof Error ? error.message : "Không tra cứu được dữ liệu." };
  }
  return { loi: "Công cụ không tồn tại." };
}
