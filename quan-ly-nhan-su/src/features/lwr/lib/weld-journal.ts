import { supabase } from "@lwr/lib/supabase";
import { parseChainage } from "@lwr/lib/track-editor";
import type { JournalWeld, WeldTestStatus } from "@lwr/types/weld";

type GpsRow = {
  lich_su_moi_han_id?: string | null;
  ma_lich_su?: string | null;
  ly_trinh?: string | null;
  ly_trinh_toa_do?: string | null;
  ngay_thuc_hien?: string | null;
  du_an?: string | null;
  ten_du_an?: string | null;
  cong_nghe_han?: string | null;
  loai_moi_han?: string | null;
  tho_han_id?: string | null;
  ten_tho_han?: string | null;
  tinh_trang_thi_nghiem?: string | null;
  ket_qua_moi_han?: string | null;
  so_luong_loi?: number | null;
  may_id?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
};

type JournalRow = {
  id: string;
  ma_lich_su: string;
  ngay_thuc_hien?: string | null;
  du_an?: string | null;
  cong_nghe_han?: string | null;
  loai_moi_han?: string | null;
  tho_han_id?: string | null;
  ten_tho_han?: string | null;
  tinh_trang_thi_nghiem?: string | null;
  so_luong_loi?: number | null;
  may_id?: string | null;
  ma_may?: string | null;
  ten_may?: string | null;
  gio_bat_dau?: string | null;
  gio_ket_thuc?: string | null;
  gio_nghi_trua?: number | string | null;
};

function normalizeTime(value: string | null | undefined): string | null {
  const match = /^(\d{2}):(\d{2})/.exec((value ?? "").trim());
  return match ? `${match[1]}:${match[2]}` : null;
}

function asStatus(value: string | null | undefined, failed: boolean): WeldTestStatus | string {
  const raw = (value ?? "").trim();
  if (raw) return raw;
  return failed ? "Không đạt" : "Chờ thí nghiệm";
}

function normalizeChainage(raw: string | null | undefined): { chainage: string | null; metres: number | null } {
  const text = (raw ?? "").trim();
  if (!text) return { chainage: null, metres: null };
  const metres = parseChainage(text.replace(/^Km\s*/i, "").replace(/\s+/g, ""));
  if (metres == null) {
    // Thử bỏ phần thập phân mét: Km0+250.00 → 0+250
    const simplified = text.replace(/^Km\s*/i, "").replace(/(\+\d+)[.,]\d+$/i, "$1");
    const again = parseChainage(simplified);
    return { chainage: text, metres: again };
  }
  return { chainage: text, metres };
}

function fromGpsRow(row: GpsRow): JournalWeld | null {
  const id = String(row.lich_su_moi_han_id ?? "").trim();
  const code = String(row.ma_lich_su ?? "").trim();
  if (!id && !code) return null;
  const chain = normalizeChainage(row.ly_trinh_toa_do || row.ly_trinh);
  const statusText = row.tinh_trang_thi_nghiem || row.ket_qua_moi_han;
  const failed = Number(row.so_luong_loi) > 0 || statusText === "Không đạt" || statusText === "Lỗi";
  return {
    id: id || code,
    code: code || id.slice(0, 8),
    date: row.ngay_thuc_hien?.slice(0, 10) ?? null,
    project: row.ten_du_an?.trim() || row.du_an?.trim() || "—",
    method: row.cong_nghe_han?.trim() || "—",
    weldType: row.loai_moi_han?.trim() || "—",
    welder: row.ten_tho_han?.trim() || "—",
    welderId: row.tho_han_id?.trim() || null,
    status: asStatus(statusText, failed),
    chainage: chain.chainage,
    metres: chain.metres,
    failed,
    machineId: row.may_id?.trim() || null,
    machineCode: row.ma_may?.trim() || null,
    machineName: row.ten_may?.trim() || null,
  };
}

function fromJournalRow(row: JournalRow): JournalWeld {
  const failed = Number(row.so_luong_loi) > 0 || row.tinh_trang_thi_nghiem === "Không đạt";
  const lunch = Number(row.gio_nghi_trua);
  return {
    id: row.id,
    code: row.ma_lich_su,
    date: row.ngay_thuc_hien?.slice(0, 10) ?? null,
    project: row.du_an?.trim() || "—",
    method: row.cong_nghe_han?.trim() || "—",
    weldType: row.loai_moi_han?.trim() || "—",
    welder: row.ten_tho_han?.trim() || "—",
    welderId: row.tho_han_id?.trim() || null,
    status: asStatus(row.tinh_trang_thi_nghiem, failed),
    chainage: null,
    metres: null,
    failed,
    machineId: row.may_id?.trim() || null,
    machineCode: row.ma_may?.trim() || null,
    machineName: row.ten_may?.trim() || null,
    startTime: normalizeTime(row.gio_bat_dau),
    endTime: normalizeTime(row.gio_ket_thuc),
    lunchHours: Number.isFinite(lunch) && lunch > 0 ? lunch : null,
  };
}

function enrichHours(target: JournalWeld, source: JournalWeld) {
  if (!target.startTime && source.startTime) target.startTime = source.startTime;
  if (!target.endTime && source.endTime) target.endTime = source.endTime;
  if (target.lunchHours == null && source.lunchHours != null) target.lunchHours = source.lunchHours;
  if (!target.machineId && source.machineId) target.machineId = source.machineId;
  if (!target.machineCode && source.machineCode) target.machineCode = source.machineCode;
  if (!target.machineName && source.machineName) target.machineName = source.machineName;
  if (!target.welderId && source.welderId) target.welderId = source.welderId;
  if ((!target.welder || target.welder === "—") && source.welder && source.welder !== "—") {
    target.welder = source.welder;
  }
}

/** Tải mối hàn từ cùng DB nhật ký (ưu tiên view GPS có lý trình). */
export async function loadJournalWelds(): Promise<{ welds: JournalWeld[]; source: "supabase" | "empty"; error?: string }> {
  if (!supabase) {
    return { welds: [], source: "empty", error: "Chưa cấu hình Supabase cho app LWR (.env.local)." };
  }

  const byId = new Map<string, JournalWeld>();

  // 1) View GPS — có ly_trinh gắn điểm
  {
    const pageSize = 1000;
    const selectGps =
      "lich_su_moi_han_id,ma_lich_su,ly_trinh_toa_do,ngay_thuc_hien,ten_du_an,cong_nghe_han,loai_moi_han,tho_han_id,ten_tho_han,ket_qua_moi_han,so_luong_loi,may_id,ma_may,ten_may";
    const selectGpsNoWelderId =
      "lich_su_moi_han_id,ma_lich_su,ly_trinh_toa_do,ngay_thuc_hien,ten_du_an,cong_nghe_han,loai_moi_han,ten_tho_han,ket_qua_moi_han,so_luong_loi,may_id,ma_may,ten_may";
    let selectCols = selectGps;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("bao_cao_moi_han_gps")
        .select(selectCols)
        .order("ngay_thuc_hien", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) {
        if (selectCols === selectGps && /tho_han_id/.test(error.message ?? "")) {
          selectCols = selectGpsNoWelderId;
          offset -= pageSize;
          continue;
        }
        break;
      }
      const page = (data ?? []) as GpsRow[];
      for (const row of page) {
        const weld = fromGpsRow(row);
        if (!weld) continue;
        const prev = byId.get(weld.id);
        if (!prev || (weld.metres != null && prev.metres == null)) byId.set(weld.id, weld);
      }
      if (page.length < pageSize) break;
    }
  }

  // 2) Bổ sung nhật ký + giờ làm (bôi giờ hoạt động theo ngày trên sơ đồ máy)
  {
    const pageSize = 1000;
    const selectFull =
      "id,ma_lich_su,ngay_thuc_hien,du_an,cong_nghe_han,loai_moi_han,tho_han_id,ten_tho_han,tinh_trang_thi_nghiem,so_luong_loi,may_id,ma_may,ten_may,gio_bat_dau,gio_ket_thuc,gio_nghi_trua";
    const selectBasic =
      "id,ma_lich_su,ngay_thuc_hien,du_an,cong_nghe_han,loai_moi_han,tho_han_id,ten_tho_han,tinh_trang_thi_nghiem,so_luong_loi,may_id,ma_may,ten_may,gio_bat_dau,gio_ket_thuc";
    const selectNoWelderId =
      "id,ma_lich_su,ngay_thuc_hien,du_an,cong_nghe_han,loai_moi_han,ten_tho_han,tinh_trang_thi_nghiem,so_luong_loi,may_id,ma_may,ten_may,gio_bat_dau,gio_ket_thuc";
    let selectCols = selectFull;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("bao_cao_moi_han_theo_du_an")
        .select(selectCols)
        .order("ngay_thuc_hien", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) {
        if (selectCols === selectFull && /gio_nghi_trua/.test(error.message ?? "")) {
          selectCols = selectBasic;
          offset -= pageSize;
          continue;
        }
        if (
          (selectCols === selectFull || selectCols === selectBasic)
          && /tho_han_id/.test(error.message ?? "")
        ) {
          selectCols = selectNoWelderId;
          offset -= pageSize;
          continue;
        }
        if (byId.size === 0) {
          return { welds: [], source: "empty", error: error.message };
        }
        break;
      }
      const page = (data ?? []) as unknown as JournalRow[];
      for (const row of page) {
        if (!row?.id) continue;
        const next = fromJournalRow(row);
        const prev = byId.get(row.id);
        if (prev) {
          enrichHours(prev, next);
          continue;
        }
        byId.set(row.id, next);
      }
      if (page.length < pageSize) break;
    }
  }

  return { welds: Array.from(byId.values()), source: "supabase" };
}
