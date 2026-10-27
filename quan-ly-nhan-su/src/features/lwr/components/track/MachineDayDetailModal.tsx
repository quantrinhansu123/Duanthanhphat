"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Truck, UserRound, X } from "lucide-react";
import {
  formatMachineDayHours,
  safeMachineImageUrl,
  safeWelderImageUrl,
  type MachineOnTrack,
} from "@lwr/lib/machine-images";
import { formatChainage } from "@lwr/lib/track-editor";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type RunLogRow = {
  id: string;
  weldMethod: string;
  weldType: string;
  shifts: string[];
  weldCount: number;
  failedWeldCount: number;
  journalEntryCount: number;
  operatingHours: number;
  personName: string;
  projectName: string;
};

function formatDayLabel(date: string | null) {
  if (!date) return "Không rõ ngày";
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

async function loadDayRunLogs(day: MachineOnTrack): Promise<RunLogRow[]> {
  if (!isSupabaseConfigured() || !day.date) return [];
  const supabase = createClient();
  let query = supabase
    .from("phan_cong_may")
    .select(
      "id,ngay,may_id,ma_may,ten_may,du_an_id,ten_du_an,tho_han_id,ten_tho_han,cong_nghe_han,loai_moi_han,ca,so_moi_han,so_moi_loi,so_ban_ghi,so_gio_hoat_dong",
    )
    .eq("ngay", day.date)
    .order("ma_may", { ascending: true });

  if (day.machineId) query = query.eq("may_id", day.machineId);
  else if (day.machineCode) query = query.eq("ma_may", day.machineCode);

  const { data, error } = await query;
  if (error || !data?.length) {
    // Fallback: lọc theo mã máy nếu may_id không khớp
    if (day.machineCode && day.machineId) {
      const retry = await supabase
        .from("phan_cong_may")
        .select(
          "id,ngay,may_id,ma_may,ten_may,du_an_id,ten_du_an,tho_han_id,ten_tho_han,cong_nghe_han,loai_moi_han,ca,so_moi_han,so_moi_loi,so_ban_ghi,so_gio_hoat_dong",
        )
        .eq("ngay", day.date)
        .eq("ma_may", day.machineCode);
      if (retry.error || !retry.data?.length) return [];
      return retry.data.map(mapRow);
    }
    return [];
  }
  return data.map(mapRow);
}

function mapRow(row: {
  id: string;
  cong_nghe_han: string | null;
  loai_moi_han: string | null;
  ca: string[] | null;
  so_moi_han: number | null;
  so_moi_loi: number | null;
  so_ban_ghi: number | null;
  so_gio_hoat_dong?: number | string | null;
  ten_tho_han: string | null;
  ten_du_an: string | null;
}): RunLogRow {
  const hours = Number(row.so_gio_hoat_dong);
  return {
    id: row.id,
    weldMethod: row.cong_nghe_han?.trim() || "—",
    weldType: row.loai_moi_han?.trim() || "—",
    shifts: Array.isArray(row.ca) ? row.ca : [],
    weldCount: Number(row.so_moi_han) || 0,
    failedWeldCount: Number(row.so_moi_loi) || 0,
    journalEntryCount: Number(row.so_ban_ghi) || 0,
    operatingHours: Number.isFinite(hours) && hours > 0 ? hours : 0,
    personName: row.ten_tho_han?.trim() || "—",
    projectName: row.ten_du_an?.trim() || "—",
  };
}

function MachineHero({ url, name }: { url: string | null; name: string }) {
  const src = safeMachineImageUrl(url) ?? (url?.startsWith("/may-han/") ? url : null);
  if (!src) {
    return (
      <div className="flex h-44 w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Truck className="size-16" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="mx-auto h-44 w-full max-w-sm object-contain drop-shadow-md"
      decoding="async"
    />
  );
}

function PersonHero({ url, name }: { url: string | null; name: string }) {
  const src = safeWelderImageUrl(url);
  if (!src) {
    return (
      <div className="flex size-28 shrink-0 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-slate-500 shadow">
        <UserRound className="size-12" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="size-28 shrink-0 rounded-full border-4 border-white object-cover shadow-md"
      decoding="async"
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

export function MachineDayDetailModal({
  day,
  onClose,
}: {
  day: MachineOnTrack;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [logs, setLogs] = useState<RunLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const dayText = formatDayLabel(day.date);
  const machineLabel = day.machineCode || day.machineName || "Máy";
  const welderLabel = day.welderName && day.welderName !== "—" ? day.welderName : "Chưa gắn công nhân";
  const hoursText = formatMachineDayHours(day.operatingHours);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadDayRunLogs(day).then((rows) => {
      if (!cancelled) {
        setLogs(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [day]);

  const totalLogHours = logs.reduce((sum, row) => sum + row.operatingHours, 0);
  const totalWelds = logs.reduce((sum, row) => sum + row.weldCount, 0) || day.weldCount;
  const totalFailed = logs.reduce((sum, row) => sum + row.failedWeldCount, 0);
  const methods = Array.from(new Set(logs.map((row) => row.weldMethod).filter((v) => v && v !== "—")));
  const types = Array.from(new Set(logs.map((row) => row.weldType).filter((v) => v && v !== "—")));
  const shifts = Array.from(new Set(logs.flatMap((row) => row.shifts)));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-testid="machine-day-detail-modal"
      onCancel={onClose}
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/45"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div className="min-w-0">
          <h3 id={titleId} className="text-base font-bold text-slate-900">
            Nhật ký chạy máy · {dayText}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">{day.project}</p>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="space-y-5 px-5 py-4">
        <section className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
          <MachineHero url={day.imageUrl} name={machineLabel} />
          <div className="mt-3 flex items-center gap-4">
            <PersonHero url={day.welderImageUrl} name={welderLabel} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Công nhân</p>
              <p className="truncate text-base font-bold text-slate-900">{welderLabel}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Máy</p>
              <p className="truncate font-mono text-sm font-semibold text-slate-800">{machineLabel}</p>
              <p className="truncate text-xs text-slate-500">{day.machineName}</p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800">Thông số trong ngày</h4>
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Giờ hoạt động" value={hoursText} />
            <Stat label="Khung giờ" value={day.workTimeRange || "Chưa nhập BĐ/KT"} />
            <Stat label="Số mối hàn" value={`${totalWelds} mối`} />
            <Stat
              label="Lý trình"
              value={`Km ${formatChainage(day.startMetres)} – ${formatChainage(day.endMetres)}`}
            />
            <Stat
              label="Mối cuối"
              value={day.weldCode ? `${day.weldCode} · Km ${formatChainage(day.metres)}` : `Km ${formatChainage(day.metres)}`}
            />
            <Stat label="Dự án" value={day.project || "—"} />
          </dl>
        </section>

        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800">Nhật ký chạy máy (phan_cong_may)</h4>
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải…</p>
          ) : logs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Chưa có dòng phân công máy khớp ngày này — hiển thị theo nhật ký hàn trên sơ đồ.
            </p>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-2">
                <Stat
                  label="Tổng giờ (NK chạy máy)"
                  value={totalLogHours > 0 ? formatMachineDayHours(totalLogHours) : hoursText}
                />
                <Stat label="Mối lỗi" value={`${totalFailed}`} />
                <Stat label="Công nghệ" value={methods.join(", ") || "—"} />
                <Stat label="Loại mối" value={types.join(", ") || "—"} />
                <Stat label="Ca" value={shifts.length ? shifts.join(", ") : "—"} />
                <Stat
                  label="Số dòng phân công"
                  value={`${logs.length}`}
                />
              </dl>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {logs.map((row) => (
                  <li key={row.id} className="px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {row.weldMethod} · {row.weldType}
                    </span>
                    <span className="mt-0.5 block text-slate-600">
                      {row.weldCount} mối
                      {row.failedWeldCount > 0 ? ` · ${row.failedWeldCount} lỗi` : ""}
                      {row.operatingHours > 0 ? ` · ${formatMachineDayHours(row.operatingHours)}` : ""}
                      {row.shifts.length ? ` · Ca ${row.shifts.join(", ")}` : ""}
                    </span>
                    {row.personName !== "—" ? (
                      <span className="block text-slate-500">Thợ: {row.personName}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Đóng
        </button>
      </div>
    </dialog>
  );
}
