"use client";

import Image from "next/image";
import { useState } from "react";

const MACHINES_RECOMMENDED = [
  {
    id: "k922-1",
    name: "Máy hàn K922-1",
    badge: "Ưu tiên cao",
    badgeBg: "bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca]",
    image: "/may-han/k920.svg",
    plant: "Nhà máy Cổ Loa",
    welds: "8.520 mối",
    hoursSinceMaint: "412 h",
    progressPct: 48,
    progressColor: "bg-[#f59e0b]",
    budget: "6.500.000đ",
  },
  {
    id: "k922-2",
    name: "Máy hàn K922-2",
    badge: "Theo dõi",
    badgeBg: "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
    image: "/may-han/ams60.svg",
    plant: "Hạ Long Xanh",
    welds: "7.840 mối",
    hoursSinceMaint: "355 h",
    progressPct: 35,
    progressColor: "bg-[#f59e0b]",
    budget: "7.800.000đ",
  },
  {
    id: "k920",
    name: "Máy hàn K920",
    badge: "Định kỳ",
    badgeBg: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
    image: "/may-han/geo.svg",
    plant: "Nhà máy Cổ Loa",
    welds: "2.160 mối",
    hoursSinceMaint: "190 h",
    progressPct: 60,
    progressColor: "bg-[#16a34a]",
    budget: "5.000.000đ",
  },
];

const MACHINE_PERFORMANCE = [
  {
    code: "K922-1",
    plant: "Cổ Loa",
    welds: "8.520",
    today: "62",
    errorRate: "0,18%",
    avail: 96,
    availColor: "bg-[#16a34a]",
  },
  {
    code: "K922-2",
    plant: "Hạ Long Xanh",
    welds: "7.840",
    today: "51",
    errorRate: "0,25%",
    avail: 93,
    availColor: "bg-[#16a34a]",
  },
  {
    code: "K920",
    plant: "Cổ Loa",
    welds: "2.160",
    today: "13",
    errorRate: "0,31%",
    avail: 88,
    availColor: "bg-[#f59e0b]",
  },
];

const CALIBRATION_DOCS = [
  {
    title: "Hiệu chuẩn\nmáy K922-1",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Nhật ký bảo trì\ntháng 05/2024",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    title: "Kiểm định áp lực\nđầu kẹp",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Biên bản thay\nvật tư tiêu hao",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export default function MachineReportDashboard() {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-[#1f2937] text-[14px]">
      {/* 1. Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Số máy đang vận hành */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#0047AB]">
              SỐ MÁY ĐANG VẬN HÀNH
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] font-mono leading-none tabular-nums">
              12
            </div>
            <div className="mt-2.5 text-[12px] text-[#15803d] font-medium">
              ↑ 8,3% <span className="text-[#8b95a5] font-normal">so với tuần trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Tỷ lệ khả dụng bình quân */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#0d9488]">
              TỶ LỆ KHẢ DỤNG BÌNH QUÂN
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] font-mono leading-none tabular-nums">
              92,3%
            </div>
            <div className="mt-2.5 text-[12px] text-[#15803d] font-medium">
              ↑ 1,4% <span className="text-[#8b95a5] font-normal">so với kỳ trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h4l3-8 4 14 3-6h4v-2h-3l-3 6-4-14-3 8H3v2z" />
            </svg>
          </div>
        </div>

        {/* Card 3: Máy đến hạn bảo trì */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#b45309]">
              MÁY ĐẾN HẠN BẢO TRÌ
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] font-mono leading-none tabular-nums">
              3
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md bg-[#fffbeb] border border-[#fde68a] px-2.5 py-0.5 text-[10.5px] font-bold text-[#b45309]">
                1 ưu tiên cao
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Card: Máy được đề xuất bảo trì */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
                Máy được đề xuất bảo trì
              </div>
              <button type="button" className="text-[12.5px] font-semibold text-[#0047AB] hover:underline cursor-pointer">
                Xem tất cả →
              </button>
            </div>

            <div className="mt-3.5 flex items-center gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 flex-1 min-w-0">
                {MACHINES_RECOMMENDED.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-[#e2e8f0] overflow-hidden bg-white hover:border-[#cbd5e1] hover:shadow-xs transition-all"
                  >
                    <div className="relative h-[135px] bg-[#f8fafc] flex items-center justify-center p-3 border-b border-[#f1f5f9]">
                      <div className="relative h-full w-full">
                        <Image
                          src={m.image}
                          alt={m.name}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      </div>
                      <span
                        className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10.5px] font-bold ${m.badgeBg}`}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <div className="text-[13.5px] font-bold text-[#0f172a]">
                        {m.name}
                      </div>
                      <div className="mt-1 text-[11.5px] text-[#64748b] leading-relaxed">
                        {m.plant} · {m.welds}
                        <br />
                        Giờ chạy từ lần bảo trì: <span className="font-mono">{m.hoursSinceMaint}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.progressColor}`}
                            style={{ width: `${m.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] font-semibold text-[#64748b] font-mono tabular-nums">
                          {m.progressPct}%
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-[#475569]">
                        Dự toán{" "}
                        <span className="font-bold text-[#0f172a] font-mono">
                          {m.budget}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg bg-[#0047AB] py-2 text-center text-[12px] font-semibold text-white hover:bg-[#00388a] transition-colors cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-[#0047ab]/20"
                      >
                        Lên lịch bảo trì
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:flex flex-col gap-2 shrink-0 w-7">
                <button
                  type="button"
                  onClick={() => setActiveSlide((v) => Math.max(0, v - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e2e8f0] text-[#64748b] hover:border-[#0047AB] hover:text-[#0047AB] hover:bg-[#eff6ff] transition-colors cursor-pointer"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide((v) => v + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e2e8f0] text-[#64748b] hover:border-[#0047AB] hover:text-[#0047AB] hover:bg-[#eff6ff] transition-colors cursor-pointer"
                  aria-label="Next"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Card: Hiệu suất theo máy */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs min-w-0">
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
              Hiệu suất theo máy
            </div>
            <div className="table-scroll overflow-x-auto mt-3.5">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 border-b border-[#e2e8f0] pb-2 text-[11.5px] font-semibold uppercase tracking-wider text-[#64748b]">
                  <div>Máy</div>
                  <div>Nhà máy</div>
                  <div>Mối hàn</div>
                  <div>Hôm nay</div>
                  <div>Tỷ lệ lỗi</div>
                  <div className="text-right">Khả dụng</div>
                </div>
                <div className="divide-y divide-[#f8fafc]">
                  {MACHINE_PERFORMANCE.map((m) => (
                    <div
                      key={m.code}
                      className="grid grid-cols-[1.1fr_1.1fr_0.9fr_0.8fr_0.9fr_1.1fr] gap-x-2 items-center py-2.5 text-[13px] text-[#334155] hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="font-semibold text-[#0047AB] font-mono">
                        {m.code}
                      </div>
                      <div>{m.plant}</div>
                      <div className="font-mono tabular-nums">{m.welds}</div>
                      <div className="font-mono tabular-nums">{m.today}</div>
                      <div className="font-mono tabular-nums">{m.errorRate}</div>
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-[62px] rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${m.availColor}`}
                            style={{ width: `${m.avail}%` }}
                          />
                        </div>
                        <span className="w-[30px] text-right text-[12px] font-mono font-semibold tabular-nums">
                          {m.avail}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-[12.5px] text-[#0047AB] font-medium">
              <button type="button" className="hover:underline cursor-pointer">
                Xem toàn bộ máy
              </button>
              <span className="text-[#94a3b8]">→</span>
            </div>
          </div>

          {/* Card: Biên bản hiệu chuẩn & kiểm định */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
                Biên bản hiệu chuẩn &amp; kiểm định
              </div>
              <button type="button" className="text-[12.5px] font-semibold text-[#0047AB] hover:underline cursor-pointer">
                Xem tất cả →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3.5">
              {CALIBRATION_DOCS.map((doc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#e2e8f0] p-3 text-center bg-white hover:border-[#cbd5e1] hover:shadow-2xs transition-all"
                >
                  <div className="h-[72px] rounded-lg border border-dashed border-[#cbd5e1] flex items-center justify-center bg-[#f8fafc]">
                    {doc.icon}
                  </div>
                  <div className="mt-2 text-[12px] text-[#334155] leading-snug whitespace-pre-line font-medium min-h-[34px]">
                    {doc.title}
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-[11.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:text-[#0047AB] transition-colors cursor-pointer"
                    >
                      Xem
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-[11.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:text-[#0047AB] transition-colors cursor-pointer"
                    >
                      Tải PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (320px) */}
        <div className="flex flex-col gap-4">
          {/* Card: Tình trạng thiết bị */}
          <div className="rounded-xl bg-[#0d2346] border border-[#1e3a8a] p-4 sm:p-5 text-white shadow-xs">
            <div className="flex items-center gap-2 text-[14.5px] font-bold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              <span>Tình trạng thiết bị</span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#93c5fd]">
                    Tổng giờ vận hành tháng này
                  </div>
                  <div className="mt-0.5 text-[18px] font-bold font-mono tabular-nums">
                    1.284 giờ
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#93c5fd]">Số lần dừng máy</div>
                  <div className="mt-0.5 text-[18px] font-bold font-mono tabular-nums">6 lần</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11.5px] text-[#93c5fd]">
                    Sắp đến hạn bảo trì
                  </div>
                  <div className="mt-0.5 text-[18px] font-bold font-mono tabular-nums">3 máy</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4.5 w-full rounded-lg bg-[#f5a623] py-2.5 text-center text-[13px] font-bold text-[#0f172a] hover:bg-[#d97706] transition-colors cursor-pointer shadow-xs"
            >
              Tạo lệnh bảo trì
            </button>
          </div>

          {/* Card: Lịch bảo trì sắp tới */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
              Lịch bảo trì sắp tới
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0047AB]">
                    Máy K922-1
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#64748b]">
                    Nhà máy Cổ Loa
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[#334155] font-mono">
                    15/07/2024
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#dc2626]">
                    Còn 10 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0047AB]">
                    Máy K922-2
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#64748b]">
                    Hạ Long Xanh
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[#334155] font-mono">
                    20/07/2024
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#dc2626]">
                    Còn 15 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0047AB]">
                    Hiệu chuẩn máy UT
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#64748b]">
                    Tổ kiểm tra chất lượng
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[#334155] font-mono">
                    05/08/2024
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#d97706]">
                    Còn 31 ngày
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Ngân sách bảo trì định kỳ */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
              Ngân sách bảo trì định kỳ
            </div>
            <div className="mt-3 text-[11.5px] text-[#64748b]">Hạn mức tháng</div>
            <div className="mt-0.5 text-[20px] font-bold text-[#0f172a] font-mono">
              20.000.000đ{" "}
              <span className="text-[12px] font-normal text-[#64748b]">/ tháng</span>
            </div>
            <div className="mt-3 text-[12px] text-[#475569] leading-relaxed">
              Tự động giải ngân theo lịch bảo trì
              <br />
              Ngày thanh toán: 05 hằng tháng
              <br />
              Nguồn chi: Vietcombank **** 1234
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-center text-[11.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-colors cursor-pointer"
              >
                Tạm dừng
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-center text-[11.5px] font-medium text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                className="flex-1 rounded-md bg-[#0047AB] py-1.5 text-center text-[11.5px] font-semibold text-white hover:bg-[#00388a] transition-colors cursor-pointer shadow-xs"
              >
                Điều chỉnh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
