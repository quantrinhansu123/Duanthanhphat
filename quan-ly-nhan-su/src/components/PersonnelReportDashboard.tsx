"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Users,
  Star,
  Certificate,
  ShieldCheck,
  MagnifyingGlass,
  ClipboardText,
  Warning,
  GraduationCap,
  Train,
} from "@/components/icons";

type CertDetail = {
  title: string;
  info: [string, string][];
  holders: { name: string; photo: string; issued: string; expires: string }[];
};

const CERT_DATA: Record<string, CertDetail> = {
  iso9606: {
    title: "Chứng chỉ thợ hàn EN ISO 9606-1",
    info: [
      ["Mã chứng chỉ", "CC-ISO9606-01"],
      ["Tiêu chuẩn", "EN ISO 9606-1"],
      ["Loại ray", "UIC60, P50, P43"],
      ["Thời hạn", "3 năm"],
      ["Đơn vị cấp", "Công ty CP Thành Phát"],
      ["Yêu cầu", "Hoàn thành khóa đào tạo + thi thực hành"],
      ["Mô tả", "Chứng nhận năng lực hàn ray aluminothermic theo tiêu chuẩn quốc tế."],
    ],
    holders: [
      { name: "Lê Thị Kim Anh", photo: "women/65", issued: "15/06/2024", expires: "15/06/2027" },
      { name: "Phạm Văn Minh", photo: "men/52", issued: "01/03/2025", expires: "01/03/2028" },
      { name: "Trần Quốc Bảo", photo: "men/22", issued: "20/11/2023", expires: "20/11/2026" },
      { name: "Đỗ Thị Lan", photo: "women/48", issued: "12/01/2022", expires: "12/01/2025" },
    ],
  },
  "an-toan": {
    title: "Huấn luyện an toàn lao động",
    info: [
      ["Mã khóa", "HL-ATLD-03"],
      ["Nội dung", "An toàn lao động & PCCC công trường hàn ray"],
      ["Thời lượng", "4 giờ"],
      ["Thời hạn chứng nhận", "2 năm"],
      ["Đơn vị đào tạo", "Công ty CP Thành Phát"],
      ["Đối tượng", "Toàn bộ thợ hàn và nhân sự hiện trường"],
      ["Mô tả", "Huấn luyện định kỳ về an toàn, sơ cứu và phòng cháy trên công trường."],
    ],
    holders: [
      { name: "Nguyễn Văn Hùng", photo: "men/36", issued: "08/09/2024", expires: "08/09/2026" },
      { name: "Vũ Thị Thảo", photo: "women/44", issued: "10/01/2026", expires: "10/01/2028" },
      { name: "Đặng Ngọc Tiếp", photo: "men/32", issued: "12/03/2026", expires: "12/03/2028" },
      { name: "Phạm Văn Minh", photo: "men/52", issued: "12/03/2026", expires: "12/03/2028" },
    ],
  },
  ut2: {
    title: "Kiểm định viên UT cấp 2",
    info: [
      ["Mã chứng chỉ", "CC-NDT-UT2"],
      ["Tiêu chuẩn", "ISO 9712 Level 2"],
      ["Phương pháp", "Siêu âm (UT)"],
      ["Thời hạn", "5 năm"],
      ["Đơn vị cấp", "Trung tâm Kiểm định VL TCVN"],
      ["Yêu cầu", "Tốt nghiệp khóa NDT + 500 giờ thực hành"],
      ["Mô tả", "Chứng chỉ kiểm định viên siêu âm mối hàn ray cấp 2."],
    ],
    holders: [
      { name: "Trần Quốc Bảo", photo: "men/22", issued: "20/11/2023", expires: "20/11/2026" },
      { name: "Lê Thị Kim Anh", photo: "women/65", issued: "15/02/2025", expires: "15/02/2030" },
    ],
  },
  "tay-nghe": {
    title: "Đánh giá tay nghề quý II/2024",
    info: [
      ["Mã đánh giá", "DG-TN-Q2-2024"],
      ["Kỳ đánh giá", "Quý II / 2024"],
      ["Hạng mục", "Kỹ năng hàn, an toàn, năng suất"],
      ["Thời hạn", "1 năm"],
      ["Hội đồng", "Ban Kỹ thuật – Công ty CP Thành Phát"],
      ["Tiêu chí", "Đạt ≥ 85 điểm / 100"],
      ["Mô tả", "Đánh giá định kỳ tay nghề thợ hàn theo quý."],
    ],
    holders: [
      { name: "Lê Thị Kim Anh", photo: "women/65", issued: "01/07/2024", expires: "01/07/2025" },
      { name: "Phạm Văn Minh", photo: "men/52", issued: "01/07/2024", expires: "01/07/2025" },
      { name: "Nguyễn Văn Hùng", photo: "men/36", issued: "01/07/2024", expires: "01/07/2025" },
    ],
  },
};

const ACTIVE_WELDERS = [
  {
    name: "Lê Thị Kim Anh",
    photo: "https://randomuser.me/api/portraits/women/65.jpg",
    meta: "K920 · Hà Nội · Tổ 1",
    status: "Đang trực",
    statusBg: "bg-blue-50 text-[#0047AB] border border-blue-200",
    shift: "Ca sáng",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Phạm Văn Minh",
    photo: "https://randomuser.me/api/portraits/men/52.jpg",
    meta: "K922-2 · Nhà máy Đà Nẵng · Tổ hàn số 2",
    status: "Đạt chuẩn",
    statusBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    shift: "Ca chiều",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Nguyễn Văn Hùng",
    photo: "https://randomuser.me/api/portraits/men/36.jpg",
    meta: "AMS60 · Nhà máy Hà Nội · Tổ hàn số 3",
    status: "Đang trực",
    statusBg: "bg-blue-50 text-[#0047AB] border border-blue-200",
    shift: "Ca sáng",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Trần Quốc Bảo",
    photo: "https://randomuser.me/api/portraits/men/22.jpg",
    meta: "K920 · Nhà máy TP.HCM · Tổ kiểm tra CL",
    status: "Hoàn thành ca",
    statusBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    shift: "Ca đêm",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Đỗ Thị Lan",
    photo: "https://randomuser.me/api/portraits/women/48.jpg",
    meta: "K355 · Nhà máy Hà Nội · Tổ hàn số 4",
    status: "Đang trực",
    statusBg: "bg-blue-50 text-[#0047AB] border border-blue-200",
    shift: "Ca chiều",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Trần Thị Mai Anh",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
    meta: "K922-1 · Nhà máy Cổ Loa · Tổ hàn số 4",
    status: "Đang trực",
    statusBg: "bg-blue-50 text-[#0047AB] border border-blue-200",
    shift: "Ca sáng",
    borderColor: "ring-emerald-500",
  },
  {
    name: "Nguyễn Văn Minh",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
    meta: "GEO-01 · Hạ Long Xanh · Tổ hàn số 2",
    status: "Nghỉ ca",
    statusBg: "bg-amber-50 text-amber-700 border border-amber-200",
    shift: "Ca chiều",
    borderColor: "ring-amber-500",
  },
];

const WELDER_PRODUCTIVITY = [
  {
    name: "Trần Thị Mai Anh",
    teamMachine: "Tổ 4 · K922-1",
    welds: "1.240",
    today: "62",
    passRate: "99,8%",
    rateColor: "text-emerald-700",
    shift: "Sáng",
  },
  {
    name: "Nguyễn Văn Minh",
    teamMachine: "Tổ 2 · K922-2",
    welds: "1.180",
    today: "51",
    passRate: "99,7%",
    rateColor: "text-emerald-700",
    shift: "Chiều",
  },
  {
    name: "Phạm Văn B",
    teamMachine: "Tổ 4 · K922-1",
    welds: "980",
    today: "44",
    passRate: "99,5%",
    rateColor: "text-emerald-700",
    shift: "Sáng",
  },
  {
    name: "Trần Văn C",
    teamMachine: "Tổ 1 · K920",
    welds: "860",
    today: "13",
    passRate: "99,1%",
    rateColor: "text-amber-700",
    shift: "Đêm",
  },
];

export default function PersonnelReportDashboard() {
  const [selectedCert, setSelectedCert] = useState<string | null>(null);
  const [certModalTab, setCertModalTab] = useState<"info" | "holders">("info");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedCert(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const certDetail = selectedCert ? CERT_DATA[selectedCert] : null;

  return (
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-slate-700 text-sm">
      {/* 1. Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Thợ hàn đang trực */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              THỢ HÀN ĐANG TRỰC
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              7 <span className="text-xs sm:text-sm font-medium text-slate-400">/ 24</span>
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              ↑ 2 người <span className="text-slate-400 font-normal">so với ca trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <Users size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 2: Xếp hạng an toàn tổ đội */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
              XẾP HẠNG AN TOÀN TỔ ĐỘI
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-none">
              Vàng
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700 shadow-2xs">
                0 sự cố trong 90 ngày
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Star size={24} weight="fill" aria-hidden />
          </div>
        </div>

        {/* Card 3: Điểm hiệu suất tổ đội */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-[#0047AB]">
              ĐIỂM HIỆU SUẤT TỔ ĐỘI
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono leading-none tabular-nums">
              2.450
            </div>
            <div className="mt-2.5 text-xs text-emerald-700 font-medium">
              ↑ 6,5% <span className="text-slate-400 font-normal">so với kỳ trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0047AB] border border-blue-200/80">
            <Star size={24} weight="fill" aria-hidden />
          </div>
        </div>
      </div>

      {/* 2. Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Sub Grid: Thợ hàn đang trực + Chứng chỉ */}
          <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-4 items-start">
            {/* Card: Thợ hàn đang trực (24) */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                  Thợ hàn đang trực (24)
                </div>
                <button type="button" className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
                  Xem tất cả →
                </button>
              </div>

              <div className="mt-3.5 flex flex-col max-h-[440px] overflow-y-auto divide-y divide-slate-100 pr-1">
                {ACTIVE_WELDERS.map((w, idx) => (
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

            {/* Card: Chứng chỉ & huấn luyện */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                  Chứng chỉ &amp; huấn luyện
                </div>
                <button type="button" className="text-xs sm:text-sm font-semibold text-[#0047AB] hover:underline cursor-pointer">
                  Xem tất cả →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-3.5 mt-3.5">
                {[
                  {
                    id: "iso9606",
                    title: "Chứng chỉ thợ hàn\nEN ISO 9606-1",
                    icon: (
                      <Certificate size={26} className="text-[#0047AB]" aria-hidden />
                    ),
                  },
                  {
                    id: "an-toan",
                    title: "Huấn luyện\nan toàn lao động",
                    icon: (
                      <ShieldCheck size={26} className="text-[#0047AB]" aria-hidden />
                    ),
                  },
                  {
                    id: "ut2",
                    title: "Kiểm định viên\nUT cấp 2",
                    icon: (
                      <MagnifyingGlass size={26} className="text-[#0047AB]" aria-hidden />
                    ),
                  },
                  {
                    id: "tay-nghe",
                    title: "Đánh giá tay nghề\nquý II/2024",
                    icon: (
                      <ClipboardText size={26} className="text-[#0047AB]" aria-hidden />
                    ),
                  },
                ].map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200/80 p-3 sm:p-3.5 text-center bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div className="h-[74px] sm:h-[82px] rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 shadow-2xs">
                      {c.icon}
                    </div>
                    <div className="mt-2.5 text-xs sm:text-sm text-slate-900 leading-snug whitespace-pre-line font-semibold min-h-[36px] flex items-center justify-center">
                      {c.title}
                    </div>
                    <div className="mt-3 flex gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCert(c.id);
                          setCertModalTab("info");
                        }}
                        className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-[#0047AB] active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-[#0047AB] active:bg-slate-100 transition-all duration-150 cursor-pointer shadow-2xs"
                      >
                        Tải PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                  {WELDER_PRODUCTIVITY.map((w, idx) => (
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
                    Ca 2 · Tổ 1 thiếu 1 thợ hàn hạng 1
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    2 phút trước
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                  <Certificate size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                    3 chứng chỉ sắp hết hạn trong tuần này
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    1 giờ trước
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0047AB] border border-blue-200 shadow-2xs">
                  <GraduationCap size={18} weight="fill" aria-hidden />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900">
                    Khóa tái huấn luyện PCCC ngày 15/03
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 font-medium">
                    Hôm nay
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
            <div className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
              Chứng chỉ sắp hết hạn
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Trần Thị Mai Anh
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    EN ISO 9606-1
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    15/07/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-700 font-mono">
                    Còn 10 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Nguyễn Văn Minh
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Huấn luyện an toàn
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    20/07/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-700 font-mono">
                    Còn 15 ngày
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-semibold text-[#0047AB]">
                    Phạm Quốc Bảo
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Kiểm định UT cấp 2
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-700 font-mono">
                    05/08/2024
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-amber-700 font-mono">
                    Còn 31 ngày
                  </div>
                </div>
              </div>
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

      {/* 3. Certificate Modal */}
      {selectedCert && certDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCert(null);
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-xl animate-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h3 className="text-base font-bold text-slate-900">
                {certDetail.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCert(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center cursor-pointer text-lg transition-colors"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="mt-3.5 flex gap-1.5 border-b border-slate-200 pb-2.5">
              <button
                type="button"
                onClick={() => setCertModalTab("info")}
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  certModalTab === "info"
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Thông tin
              </button>
              <button
                type="button"
                onClick={() => setCertModalTab("holders")}
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  certModalTab === "holders"
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                Danh sách người được cấp và còn hạn
              </button>
            </div>

            <div className="mt-4 max-h-[380px] overflow-y-auto">
              {certModalTab === "info" ? (
                <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {certDetail.info.map(([label, val], i) => (
                    <div key={i} className="flex py-2.5 gap-3">
                      <span className="w-1/3 text-slate-500 font-medium">{label}</span>
                      <span className="flex-1 text-slate-900 font-semibold">{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {certDetail.holders.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-200 shadow-2xs">
                        <Image
                          src={`https://randomuser.me/api/portraits/${h.photo}.jpg`}
                          alt={h.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-slate-900">
                          {h.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Cấp {h.issued} · Hết hạn {h.expires}
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 shadow-2xs">
                        Còn hạn
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
