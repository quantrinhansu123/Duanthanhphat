"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Certificate,
  ClipboardText,
  GraduationCap,
  Train,
  Users,
  Warning,
} from "@/components/icons";
import { useReportFilters } from "@/contexts/ReportFilterContext";
import { useWeldReportData } from "@/hooks/useWeldReportData";
import {
  filterWeldReportRows,
  groupWeldRows,
  machineForRow,
} from "@/lib/weldReportData";
import { loadCertificateRegistry } from "@/lib/certificatesDb";
import type { Certificate as CertificateType } from "@/data/certificates";

const PORTRAIT_IDS = [32, 52, 36, 22, 48, 44];

export default function PersonnelReportDashboard() {
  const { rows, loading, error } = useWeldReportData();
  const { appliedFilters } = useReportFilters();
  const [teamFilter, setTeamFilter] = useState("Tất cả tổ hàn");
  const [certList, setCertList] = useState<CertificateType[]>([]);
  const [certError, setCertError] = useState("");

  useEffect(() => {
    let active = true;
    loadCertificateRegistry()
      .then((res) => {
        if (active) {
          setCertList(res.certificates);
          setCertError("");
        }
      })
      .catch((loadError: unknown) => {
        if (active) setCertError(loadError instanceof Error ? loadError.message : "Không tải được chứng chỉ");
      });
    return () => {
      active = false;
    };
  }, []);

  const expiringCertificates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return certList
      .map((c) => {
        if (!c.expiresAt || c.expiresAt === "—") {
          return { ...c, daysRemaining: null, statusLabel: "Chưa cập nhật" };
        }
        const parts = c.expiresAt.split("/");
        if (parts.length !== 3) {
          return { ...c, daysRemaining: null, statusLabel: "Chưa cập nhật" };
        }
        const expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
        const days = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        if (days < 0) {
          return { ...c, daysRemaining: days, statusLabel: "Hết hạn" };
        }
        return { ...c, daysRemaining: days, statusLabel: `Còn ${days} ngày` };
      })
      .filter((c) => c.statusLabel === "Hết hạn" || (c.daysRemaining !== null && c.daysRemaining <= 90))
      .sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));
  }, [certList]);
  const baseRows = useMemo(
    () => filterWeldReportRows(rows, appliedFilters),
    [rows, appliedFilters],
  );
  const teams = useMemo(
    () => Array.from(new Set(baseRows.map((row) => row.to_han?.trim() || "Chưa phân tổ"))).sort((a, b) => a.localeCompare(b, "vi")),
    [baseRows],
  );
  const selectedRows = useMemo(
    () => baseRows.filter((row) => teamFilter === "Tất cả tổ hàn" || (row.to_han?.trim() || "Chưa phân tổ") === teamFilter),
    [baseRows, teamFilter],
  );
  const welders = useMemo(
    () => groupWeldRows(selectedRows, (row) => row.ten_tho_han).sort((a, b) => b.total - a.total),
    [selectedRows],
  );
  const latestDateVolumeByWelder = useMemo(() => {
    const dates = selectedRows
      .map((r) => r.ngay_thuc_hien)
      .filter((d): d is string => Boolean(d))
      .sort();
    const latestDate = dates.at(-1);
    const map = new Map<string, number>();
    if (!latestDate) return map;
    for (const r of selectedRows) {
      if (r.ngay_thuc_hien === latestDate) {
        map.set(r.ten_tho_han, (map.get(r.ten_tho_han) ?? 0) + (r.so_luong_thuc_hien || 0));
      }
    }
    return map;
  }, [selectedRows]);

  const activeWelders = welders.map((welder, index) => {
    const source = welder.rows[0];
    const machine = machineForRow(source);
    return {
      name: welder.name,
      photo: `https://randomuser.me/api/portraits/men/${PORTRAIT_IDS[index % PORTRAIT_IDS.length]}.jpg`,
      meta: `${source.to_han?.trim() || "Chưa phân tổ"} · ${machine} · ${source.ma_nhan_su}`,
      status: welder.errors > 0 ? "Cần theo dõi" : "Đạt chuẩn",
      statusBg: welder.errors > 0
        ? "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]"
        : "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
      shift: ["Ca sáng", "Ca chiều", "Ca đêm"][index % 3],
      borderColor: welder.errors > 0 ? "ring-[#f59e0b]" : "ring-[#16a34a]",
    };
  });
  const welderProductivity = welders.map((welder, index) => {
    const source = welder.rows[0];
    const passRate = welder.total > 0 ? ((welder.passed / welder.total) * 100) : 0;
    const todayVolume = latestDateVolumeByWelder.get(welder.name) ?? 0;
    return {
      name: welder.name,
      teamMachine: `${source.to_han?.trim() || "Chưa phân tổ"} · ${machineForRow(source)}`,
      welds: welder.total.toLocaleString("vi-VN"),
      today: todayVolume.toLocaleString("vi-VN"),
      passRate: `${passRate.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`,
      rateColor: passRate >= 99 ? "text-[#15803d]" : "text-[#b45309]",
      shift: ["Sáng", "Chiều", "Đêm"][index % 3],
    };
  });
  const readyPersonnel = welders.filter((welder) => welder.errors === 0).length;

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-200 bg-blue-50 text-[#0047AB]"}`}>
        {error
          ? `Không tải được Supabase: ${error}`
          : loading
            ? "Đang tải dữ liệu Supabase…"
            : `Supabase · ${welders.length} thợ hàn · Dữ liệu thực tế`}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Kiểm soát theo tổ</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-900">Sản lượng và chất lượng thợ hàn theo tổ</div>
        </div>
        <select
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
          className="h-10 min-w-[180px] rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 sm:text-sm"
        >
          <option>Tất cả tổ hàn</option>
          {teams.map((team) => <option key={team}>{team}</option>)}
        </select>
      </div>
      {/* 1. Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Thợ hàn đang trực */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              THỢ HÀN ĐANG TRỰC
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {welders.length} <span className="text-xs sm:text-sm font-medium text-slate-400">/ {welders.length}</span>
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              ↑ 2 người <span className="text-slate-400 font-normal">so với ca trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <Users size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 2: Số nhân sự đang sẵn sàng */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              SỐ NHÂN SỰ ĐANG SẴN SÀNG
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              {readyPersonnel}
            </div>
            <div className="mt-2.5 text-xs text-slate-400 font-normal">
              Thợ đạt chuẩn trong kỳ đã chọn
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Users size={24} weight="fill" aria-hidden />
          </div>
        </div>
      </div>

      {/* 2. Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Card: Thợ hàn trong dữ liệu */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Thợ hàn trong dữ liệu ({welders.length})
              </div>
              <button type="button" className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
                Xem tất cả →
              </button>
            </div>

            <div className="mt-3.5 flex flex-col max-h-[440px] overflow-y-auto divide-y divide-slate-100 pr-1">
              {activeWelders.map((w, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 px-1 hover:bg-slate-50/80 rounded-lg transition-colors">
                  <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ${w.borderColor} shadow-2xs`}>
                    <Image
                      src={w.photo}
                      alt={w.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs sm:text-sm font-semibold text-slate-900">
                      {w.name}
                    </div>
                    <div className="truncate text-xs text-slate-500 mt-0.5">
                      {w.meta}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs ${w.statusBg}`}>
                      {w.status}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{w.shift}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Năng suất theo thợ hàn */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Năng suất theo thợ hàn
            </div>
            <div className="table-scroll overflow-x-auto mt-3.5">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr_1fr_0.9fr] gap-x-2 border-b border-slate-200 bg-slate-50/80 p-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <div>Họ tên</div>
                  <div>Tổ / Máy</div>
                  <div>Mối hàn</div>
                  <div>Hôm nay</div>
                  <div>Tỷ lệ đạt</div>
                  <div className="text-right">Ca làm</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {welderProductivity.map((w, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr_1fr_0.9fr] gap-x-2 items-center py-2.5 px-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="font-semibold text-slate-900">
                        {w.name}
                      </div>
                      <div>{w.teamMachine}</div>
                      <div className="font-mono tabular-nums">{w.welds}</div>
                      <div className="font-mono tabular-nums">{w.today}</div>
                      <div className={`font-semibold font-mono tabular-nums ${w.rateColor}`}>
                        {w.passRate}
                      </div>
                      <div className="text-right text-slate-600">{w.shift}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-xs sm:text-sm text-[#0047AB] font-semibold">
              <button type="button" className="hover:underline cursor-pointer">
                Xem toàn bộ nhân sự
              </button>
              <span className="text-slate-400">→</span>
            </div>
          </div>
        </div>

        {/* Right Column (320px) */}
        <div className="flex flex-col gap-4">
          {/* Card: Bảng tin nhanh */}
          <div className="rounded-xl border-2 border-[#0047AB]/25 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-100 shadow-2xs">
                <ClipboardText size={16} weight="fill" aria-hidden />
              </span>
              <span>Bảng tin nhanh</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs">
                  <Warning size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                    {welders.length} nhân sự có dữ liệu hàn trong bộ lọc
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    Đồng bộ từ Nhật ký hàn
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                  <Certificate size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                    {certError
                      ? "Không tải được dữ liệu chứng chỉ"
                      : `${expiringCertificates.length} chứng chỉ hết hạn hoặc sắp hết hạn`}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    Trong 90 ngày tới
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs">
                  <GraduationCap size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                    {certList.length} hồ sơ chứng chỉ đã được đồng bộ
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    Dữ liệu trực tiếp từ hệ thống chứng chỉ
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-[#0047AB] hover:bg-[#00388A] active:bg-[#002D6E] py-2.5 text-center text-xs sm:text-sm font-semibold text-white transition-all duration-150 cursor-pointer shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Xem tất cả tin
            </button>
          </div>

          {/* Card: Chứng chỉ sắp hết hạn */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                Hết hạn / sắp hết hạn
              </div>
              <Link
                href="/chung-chi"
                className="text-xs font-semibold text-[#0047AB] hover:underline"
              >
                Xem tất cả
              </Link>
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              {certError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {certError}
                </div>
              ) : expiringCertificates.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">
                  Hiện không có chứng chỉ nào sắp hết hạn trong 90 ngày tới.
                </div>
              ) : (
                expiringCertificates.slice(0, 6).map((cert) => (
                  <Link
                    key={cert.id}
                    href={`/chung-chi?employeeId=${cert.employeeId}&certificateId=${cert.id}`}
                    className="group flex items-start justify-between gap-2 hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-[#0047AB] group-hover:underline">
                        {cert.holder}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 truncate" title={cert.title}>
                        {cert.title}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-700 font-mono">
                        {cert.expiresAt}
                      </div>
                      <div
                        className={`mt-0.5 text-xs font-semibold font-mono ${
                          cert.statusLabel === "Hết hạn"
                            ? "text-rose-700"
                            : "text-amber-700"
                        }`}
                      >
                        {cert.statusLabel}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Card: Quote */}
          <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-4 sm:p-5 shadow-xs">
            <div className="text-3xl font-bold text-[#0047AB] leading-none opacity-40">
              “
            </div>
            <div className="mt-1 text-xs sm:text-sm italic leading-relaxed text-blue-950 font-medium">
              Mỗi mối hàn đạt chuẩn là một chuyến tàu an toàn. Kỷ luật hôm nay giữ đường ray cho mai sau.
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">Ban Giám đốc TCW</div>
              <Train size={20} weight="fill" aria-hidden className="text-[#0047AB] opacity-70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
