import {
  weldingHistory as seedHistory,
  type WeldingHistoryRecord,
} from "@/data/weldingHistory";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseError, isSupabaseConfigured } from "@/lib/supabase/env";

const LOCAL_STORAGE_KEY = "tp_welding_history_custom_v1";

export interface SupabaseWeldRow {
  id: string;
  ma_lich_su?: string | null;
  ngay_thuc_hien?: string | null;
  nam_thuc_hien?: number | null;
  loai_ray?: string | null;
  loai_moi_han?: string | null;
  cong_nghe_han?: string | null;
  so_luong_thuc_hien?: number | null;
  so_luong_loi?: number | null;
  hach_toan?: string | null;
  moi_han_lien_ket?: string | null;
  ghi_chu?: string | null;
  nhan_su?: { ho_ten?: string | null } | null;
  du_an?: { du_an?: string | null } | null;
  may?: { ma_may?: string | null } | null;
}

function readLocalHistory(): WeldingHistoryRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalHistory(list: WeldingHistoryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Lỗi lưu LocalStorage cho lịch sử hàn:", err);
  }
}

export type WeldingHistoryLoadResult = {
  records: WeldingHistoryRecord[];
  source: "supabase" | "local" | "seed";
  error?: string;
};

function parseShift(ghiChu?: string | null, idx = 0): WeldingHistoryRecord["shift"] {
  if (!ghiChu) return (idx % 3 === 0 ? "Ca 1" : idx % 3 === 1 ? "Ca 2" : "Ca 3") as WeldingHistoryRecord["shift"];
  if (ghiChu.includes("Ca 1")) return "Ca 1";
  if (ghiChu.includes("Ca 2")) return "Ca 2";
  if (ghiChu.includes("Ca 3")) return "Ca 3";
  return "Ca 1";
}

function parseRank(ghiChu?: string | null): string {
  if (!ghiChu) return "Hạng 1";
  const match = ghiChu.match(/Hạng\s*(\d+|[A-Z]+)/i);
  return match ? match[0] : "Hạng 1";
}

function parseResult(row: SupabaseWeldRow): WeldingHistoryRecord["result"] {
  const ghiChu = row.ghi_chu || "";
  if (ghiChu.includes("Kết quả: Sửa chữa")) return "Sửa chữa";
  if (ghiChu.includes("Kết quả: Không đạt")) return "Không đạt";
  if (ghiChu.includes("Kết quả: Đạt")) return "Đạt";

  if ((row.so_luong_loi ?? 0) > 0) {
    if (ghiChu.toLowerCase().includes("sửa chữa") || (row.moi_han_lien_ket && row.moi_han_lien_ket.startsWith("SC-"))) {
      return "Sửa chữa";
    }
    return "Không đạt";
  }
  return "Đạt";
}

function parseWeldJoint(row: SupabaseWeldRow, dateStr: string, idx: number): string {
  const ghiChu = row.ghi_chu || "";
  const match = ghiChu.match(/Mối hàn:\s*([^\s|]+)/i);
  if (match) return match[1];
  if (row.moi_han_lien_ket) {
    return row.moi_han_lien_ket.replace(/^SC-/, "");
  }
  return row.ma_lich_su || `MH-${dateStr.replace(/-/g, "")}-${String(idx + 1).padStart(2, "0")}`;
}

function mapSupabaseRow(row: SupabaseWeldRow, idx: number): WeldingHistoryRecord {
  const dateStr =
    row.ngay_thuc_hien ||
    `${row.nam_thuc_hien || 2026}-03-${String(15 - (idx % 14)).padStart(2, "0")}`;

  const result = parseResult(row);

  return {
    id: row.id,
    date: dateStr,
    weldingId: row.ma_lich_su || `WH${String(idx + 1).padStart(3, "0")}`,
    welderName: row.nhan_su?.ho_ten || "Thợ hàn chính",
    rank: parseRank(row.ghi_chu),
    weldJoint: parseWeldJoint(row, dateStr, idx),
    machine: row.may?.ma_may || "KCM007-01",
    railType: row.loai_ray || "UIC60",
    project: row.du_an?.du_an || "ĐSCT Bắc – Nam",
    shift: parseShift(row.ghi_chu, idx),
    accountingCode:
      row.hach_toan ||
      (idx % 4 === 0 ? "HT-SX01" : idx % 4 === 1 ? "HT-SX02" : idx % 4 === 2 ? "HT-M01" : "HT-TN01"),
    result,
  };
}

export async function loadWeldingHistory(): Promise<WeldingHistoryLoadResult> {
  const local = readLocalHistory();

  if (!isSupabaseConfigured()) {
    if (local && local.length > 0) {
      return { records: local, source: "local" };
    }
    return { records: seedHistory, source: "seed" };
  }

  const supabase = createClient();

  let rawRows: SupabaseWeldRow[] = [];
  let queryError: { message?: string; code?: string } | null = null;

  // 1. Thử truy vấn kèm cột hach_toan
  const resWithHt = await supabase
    .from("lich_su_moi_han")
    .select(`
      id,
      ma_lich_su,
      ngay_thuc_hien,
      nam_thuc_hien,
      loai_ray,
      loai_moi_han,
      cong_nghe_han,
      so_luong_loi,
      hach_toan,
      moi_han_lien_ket,
      ghi_chu,
      nhan_su:tho_han_id (ho_ten),
      du_an:du_an_id (du_an),
      may:may_id (ma_may)
    `)
    .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
    .limit(100);

  if (!resWithHt.error && resWithHt.data) {
    rawRows = resWithHt.data as unknown as SupabaseWeldRow[];
  } else {
    // 2. Nếu lỗi do chưa có cột hach_toan, truy vấn lại không kèm cột này
    const errMsg = resWithHt.error?.message || "";
    if (errMsg.includes("hach_toan") || resWithHt.error?.code === "PGRST100" || resWithHt.error?.code === "42703") {
      const resWithoutHt = await supabase
        .from("lich_su_moi_han")
        .select(`
          id,
          ma_lich_su,
          ngay_thuc_hien,
          nam_thuc_hien,
          loai_ray,
          loai_moi_han,
          cong_nghe_han,
          so_luong_loi,
          moi_han_lien_ket,
          ghi_chu,
          nhan_su:tho_han_id (ho_ten),
          du_an:du_an_id (du_an),
          may:may_id (ma_may)
        `)
        .order("ngay_thuc_hien", { ascending: false, nullsFirst: false })
        .limit(100);

      if (!resWithoutHt.error && resWithoutHt.data) {
        rawRows = resWithoutHt.data as unknown as SupabaseWeldRow[];
      } else if (resWithoutHt.error) {
        queryError = resWithoutHt.error;
      }
    } else {
      queryError = resWithHt.error;
    }
  }

  if (queryError) {
    if (local && local.length > 0) {
      return { records: local, source: "local", error: formatSupabaseError(queryError) };
    }
    return { records: seedHistory, source: "seed", error: formatSupabaseError(queryError) };
  }

  const rows = rawRows;

  if (rows.length === 0) {
    if (local && local.length > 0) {
      return { records: local, source: "local" };
    }
    return { records: seedHistory, source: "seed" };
  }

  // Map supabase rows
  const mapped = rows.map(mapSupabaseRow);

  // Merge with local overrides (e.g. accountingCode updated locally or new rows added before sync)
  if (local && local.length > 0) {
    const remoteIds = new Set(mapped.map((r) => r.id));
    const localOnly = local.filter((r) => !remoteIds.has(r.id));
    const localMap = new Map(local.map((r) => [r.id, r]));
    const merged = mapped.map((r) => {
      const localRecord = localMap.get(r.id);
      if (!localRecord) return r;
      return {
        ...r,
        accountingCode: localRecord.accountingCode || r.accountingCode,
      };
    });
    return { records: [...localOnly, ...merged], source: "supabase" };
  }

  return { records: mapped, source: "supabase" };
}

// Helpers to resolve foreign keys for insert / update
async function resolveForeignKeyIds(record: WeldingHistoryRecord): Promise<{
  duAnId: string | null;
  thoHanId: string | null;
  mayId: string | null;
  errors: string[];
}> {
  const supabase = createClient();
  let duAnId: string | null = null;
  let thoHanId: string | null = null;
  let mayId: string | null = null;
  const errors: string[] = [];

  // 1. Resolve du_an
  if (record.project) {
    try {
      const { data: projects, error: pErr } = await supabase
        .from("du_an")
        .select("id,du_an")
        .limit(100);

      if (pErr) {
        errors.push(`Lỗi tra cứu dự án: ${pErr.message}`);
      } else if (projects && projects.length > 0) {
        const pName = record.project.trim().toLowerCase();
        const matched =
          projects.find((p) => p.du_an?.trim().toLowerCase() === pName) ||
          projects.find((p) => p.du_an?.toLowerCase().includes(pName) || pName.includes(p.du_an?.toLowerCase()));
        if (matched) {
          duAnId = matched.id;
        } else {
          errors.push(`Không tìm thấy dự án "${record.project}" trong cơ sở dữ liệu`);
        }
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục dự án");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối dự án: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Resolve tho_han
  if (record.welderName) {
    try {
      const { data: personnel, error: perErr } = await supabase
        .from("nhan_su")
        .select("employee_id,ho_ten")
        .limit(200);

      if (perErr) {
        errors.push(`Lỗi tra cứu nhân sự: ${perErr.message}`);
      } else if (personnel && personnel.length > 0) {
        const wName = record.welderName.trim().toLowerCase();
        const matched =
          personnel.find((p) => p.ho_ten?.trim().toLowerCase() === wName) ||
          personnel.find((p) => p.ho_ten?.toLowerCase().includes(wName) || wName.includes(p.ho_ten?.toLowerCase()));
        if (matched) {
          thoHanId = matched.employee_id;
        } else {
          errors.push(`Không tìm thấy thợ hàn "${record.welderName}" trong danh sách nhân sự`);
        }
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục nhân sự");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối nhân sự: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Resolve may
  if (record.machine) {
    try {
      const { data: machines, error: mErr } = await supabase
        .from("thiet_bi")
        .select("id,ma_may,ten_may")
        .limit(50);

      if (mErr) {
        errors.push(`Lỗi tra cứu thiết bị: ${mErr.message}`);
      } else if (machines && machines.length > 0) {
        const mCode = record.machine.trim().toLowerCase();
        const matched =
          machines.find((m) => m.ma_may?.trim().toLowerCase() === mCode) ||
          machines.find((m) => m.ten_may?.trim().toLowerCase().includes(mCode) || mCode.includes(m.ma_may?.toLowerCase()));
        if (matched) {
          mayId = matched.id;
        } else {
          errors.push(`Không tìm thấy máy hàn "${record.machine}" trong danh mục thiết bị`);
        }
      } else {
        errors.push("Cơ sở dữ liệu chưa có danh mục thiết bị");
      }
    } catch (e) {
      errors.push(`Lỗi kết nối thiết bị: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { duAnId, thoHanId, mayId, errors };
}

export type SaveResult = {
  records: WeldingHistoryRecord[];
  error?: string;
};

export async function saveWeldingHistoryRecord(
  record: WeldingHistoryRecord,
  currentList: WeldingHistoryRecord[],
  isNew: boolean,
): Promise<SaveResult> {
  let finalRecord = { ...record };
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { duAnId, thoHanId, mayId, errors: fkErrors } = await resolveForeignKeyIds(record);

    if (fkErrors.length > 0) {
      dbError = fkErrors.join("; ");
    }

    const isRepair = record.result === "Sửa chữa";
    const errorCount = record.result === "Đạt" ? 0 : 1;
    const noteContent = `Ca: ${record.shift} | Hạng: ${record.rank} | Thợ: ${record.welderName} | Mối hàn: ${record.weldJoint} | Kết quả: ${record.result}`;
    const linkedJoint = isRepair ? (record.weldJoint.startsWith("SC-") ? record.weldJoint : `SC-${record.weldJoint}`) : null;

    if (isNew) {
      // Build insert payload
      const basePayload: Record<string, unknown> = {
        ma_lich_su: record.weldingId,
        ngay_thuc_hien: record.date,
        nam_thuc_hien: Number(record.date.slice(0, 4)) || new Date().getFullYear(),
        loai_ray: record.railType,
        loai_moi_han: "Sản xuất",
        cong_nghe_han: "FBW",
        so_luong_thuc_hien: 1,
        so_luong_loi: errorCount,
        moi_han_lien_ket: linkedJoint,
        ghi_chu: noteContent,
        nguon_du_lieu: "lich-su-han",
      };

      if (duAnId) basePayload.du_an_id = duAnId;
      if (thoHanId) basePayload.tho_han_id = thoHanId;
      if (mayId) basePayload.may_id = mayId;

      if (!dbError) {
        // Try inserting with hach_toan
        try {
          const payloadWithHt = { ...basePayload, hach_toan: record.accountingCode };
          const { data, error } = await supabase
            .from("lich_su_moi_han")
            .insert(payloadWithHt)
            .select("id")
            .single();

          if (error) {
            dbError = formatSupabaseError(error);
          } else if (data) {
            finalRecord = { ...finalRecord, id: data.id };
          }
        } catch (err: unknown) {
          dbError = err instanceof Error ? err.message : String(err);
        }
      }
    } else {
      // Updating existing record
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id);
      if (isUuid) {
        const updatePayload: Record<string, unknown> = {
          ngay_thuc_hien: record.date,
          ma_lich_su: record.weldingId,
          moi_han_lien_ket: linkedJoint,
          loai_ray: record.railType,
          so_luong_loi: errorCount,
          ghi_chu: noteContent,
        };
        if (duAnId) updatePayload.du_an_id = duAnId;
        if (thoHanId) updatePayload.tho_han_id = thoHanId;
        if (mayId) updatePayload.may_id = mayId;

        try {
          const payloadWithHt = { ...updatePayload, hach_toan: record.accountingCode };
          const { error } = await supabase
            .from("lich_su_moi_han")
            .update(payloadWithHt)
            .eq("id", record.id);

          if (error) {
            dbError = formatSupabaseError(error);
          }
        } catch (err: unknown) {
          dbError = err instanceof Error ? err.message : String(err);
        }
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không ghi LocalStorage nếu lưu lên Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = isNew
    ? [finalRecord, ...currentList.filter((r) => r.id !== record.id && r.id !== finalRecord.id)]
    : currentList.map((r) => (r.id === record.id ? finalRecord : r));

  writeLocalHistory(nextList);
  return { records: nextList };
}

export async function quickUpdateAccountingCode(
  id: string,
  newCode: string,
  currentList: WeldingHistoryRecord[],
): Promise<{ records: WeldingHistoryRecord[]; error?: string }> {
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const { error } = await supabase
          .from("lich_su_moi_han")
          .update({ hach_toan: newCode })
          .eq("id", id);
        if (error) {
          dbError = formatSupabaseError(error);
        }
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không ghi LocalStorage nếu cập nhật Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = currentList.map((r) =>
    r.id === id ? { ...r, accountingCode: newCode } : r,
  );
  writeLocalHistory(nextList);
  return { records: nextList };
}

export async function deleteWeldingHistoryRecord(
  id: string,
  currentList: WeldingHistoryRecord[],
): Promise<{ records: WeldingHistoryRecord[]; error?: string }> {
  let dbError: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const { error } = await supabase.from("lich_su_moi_han").delete().eq("id", id);
        if (error) dbError = formatSupabaseError(error);
      } else {
        dbError = "Bản ghi chưa có UUID hợp lệ trên Supabase";
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  if (isSupabaseConfigured() && dbError) {
    // Không xóa trong LocalStorage nếu xóa Supabase thất bại
    return { records: currentList, error: dbError };
  }

  const nextList = currentList.filter((r) => r.id !== id);
  writeLocalHistory(nextList);
  return { records: nextList };
}
