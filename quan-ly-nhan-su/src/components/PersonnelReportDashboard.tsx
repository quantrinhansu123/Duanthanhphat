"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
    statusBg: "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
    shift: "Ca sáng",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Phạm Văn Minh",
    photo: "https://randomuser.me/api/portraits/men/52.jpg",
    meta: "K922-2 · Nhà máy Đà Nẵng · Tổ hàn số 2",
    status: "Đạt chuẩn",
    statusBg: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
    shift: "Ca chiều",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Nguyễn Văn Hùng",
    photo: "https://randomuser.me/api/portraits/men/36.jpg",
    meta: "AMS60 · Nhà máy Hà Nội · Tổ hàn số 3",
    status: "Đang trực",
    statusBg: "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
    shift: "Ca sáng",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Trần Quốc Bảo",
    photo: "https://randomuser.me/api/portraits/men/22.jpg",
    meta: "K920 · Nhà máy TP.HCM · Tổ kiểm tra CL",
    status: "Hoàn thành ca",
    statusBg: "bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]",
    shift: "Ca đêm",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Đỗ Thị Lan",
    photo: "https://randomuser.me/api/portraits/women/48.jpg",
    meta: "K355 · Nhà máy Hà Nội · Tổ hàn số 4",
    status: "Đang trực",
    statusBg: "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
    shift: "Ca chiều",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Trần Thị Mai Anh",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
    meta: "K922-1 · Nhà máy Cổ Loa · Tổ hàn số 4",
    status: "Đang trực",
    statusBg: "bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]",
    shift: "Ca sáng",
    borderColor: "ring-[#16a34a]",
  },
  {
    name: "Nguyễn Văn Minh",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
    meta: "GEO-01 · Hạ Long Xanh · Tổ hàn số 2",
    status: "Nghỉ ca",
    statusBg: "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
    shift: "Ca chiều",
    borderColor: "ring-[#f59e0b]",
  },
];

const WELDER_PRODUCTIVITY = [
  {
    name: "Trần Thị Mai Anh",
    teamMachine: "Tổ 4 · K922-1",
    welds: "1.240",
    today: "62",
    passRate: "99,8%",
    rateColor: "text-[#15803d]",
    shift: "Sáng",
  },
  {
    name: "Nguyễn Văn Minh",
    teamMachine: "Tổ 2 · K922-2",
    welds: "1.180",
    today: "51",
    passRate: "99,7%",
    rateColor: "text-[#15803d]",
    shift: "Chiều",
  },
  {
    name: "Phạm Văn B",
    teamMachine: "Tổ 4 · K922-1",
    welds: "980",
    today: "44",
    passRate: "99,5%",
    rateColor: "text-[#15803d]",
    shift: "Sáng",
  },
  {
    name: "Trần Văn C",
    teamMachine: "Tổ 1 · K920",
    welds: "860",
    today: "13",
    passRate: "99,1%",
    rateColor: "text-[#b45309]",
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
    <div className="mx-auto w-full max-w-[1568px] px-3 sm:px-6 py-3 sm:py-4 flex flex-col gap-4 text-[#1f2937] text-[14px]">
      {/* 1. Top 3 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Thợ hàn đang trực */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#0047AB]">
              THỢ HÀN ĐANG TRỰC
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] font-mono leading-none tabular-nums">
              7 <span className="text-[13px] font-medium text-[#94a3b8]">/ 24</span>
            </div>
            <div className="mt-2.5 text-[12px] text-[#15803d] font-medium">
              ↑ 2 người <span className="text-[#8b95a5] font-normal">so với ca trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Xếp hạng an toàn tổ đội */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#b45309]">
              XẾP HẠNG AN TOÀN TỔ ĐỘI
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] leading-none">
              Vàng
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md bg-[#fffbeb] border border-[#fde68a] px-2.5 py-0.5 text-[10.5px] font-bold text-[#b45309]">
                0 sự cố trong 90 ngày
              </span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        </div>

        {/* Card 3: Điểm hiệu suất tổ đội */}
        <div className="flex items-center gap-3.5 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-[#0047AB]">
              ĐIỂM HIỆU SUẤT TỔ ĐỘI
            </div>
            <div className="mt-2 text-[26px] sm:text-[28px] font-bold tracking-tight text-[#0f172a] font-mono leading-none tabular-nums">
              2.450
            </div>
            <div className="mt-2.5 text-[12px] text-[#15803d] font-medium">
              ↑ 6,5% <span className="text-[#8b95a5] font-normal">so với kỳ trước</span>
            </div>
          </div>
          <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#0047AB] border border-[#bfdbfe]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 2. Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Sub Grid: Thợ hàn đang trực + Chứng chỉ */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-4 items-start">
            {/* Card: Thợ hàn đang trực (24) */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
                  Thợ hàn đang trực (24)
                </div>
                <button type="button" className="text-[12.5px] font-semibold text-[#0047AB] hover:underline cursor-pointer">
                  Xem tất cả →
                </button>
              </div>

              <div className="mt-3.5 flex flex-col max-h-[420px] overflow-y-auto divide-y divide-[#f8fafc]">
                {ACTIVE_WELDERS.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2.5 px-1 hover:bg-[#f8fafc] rounded-lg transition-colors">
                    <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ${w.borderColor}`}>
                      <Image
                        src={w.photo}
                        alt={w.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-[#0f172a]">
                        {w.name}
                      </div>
                      <div className="truncate text-[11px] text-[#64748b] mt-0.5">
                        {w.meta}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${w.statusBg}`}>
                        {w.status}
                      </span>
                      <span className="text-[10.5px] text-[#94a3b8]">{w.shift}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card: Chứng chỉ & huấn luyện */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
                  Chứng chỉ &amp; huấn luyện
                </div>
                <button type="button" className="text-[12.5px] font-semibold text-[#0047AB] hover:underline cursor-pointer">
                  Xem tất cả →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-3.5">
                {[
                  {
                    id: "iso9606",
                    title: "Chứng chỉ thợ hàn\nEN ISO 9606-1",
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
                        <circle cx="12" cy="8" r="7" />
                        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                      </svg>
                    ),
                  },
                  {
                    id: "an-toan",
                    title: "Huấn luyện\nan toàn lao động",
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    ),
                  },
                  {
                    id: "ut2",
                    title: "Kiểm định viên\nUT cấp 2",
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    ),
                  },
                  {
                    id: "tay-nghe",
                    title: "Đánh giá tay nghề\nquý II/2024",
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" />
                        <path d="M9 12h6M9 16h4" />
                      </svg>
                    ),
                  },
                ].map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[#e2e8f0] p-3 text-center bg-white hover:border-[#cbd5e1] hover:shadow-2xs transition-all"
                  >
                    <div className="h-[72px] rounded-lg border border-dashed border-[#cbd5e1] flex items-center justify-center bg-[#f8fafc]">
                      {c.icon}
                    </div>
                    <div className="mt-2 text-[12px] text-[#334155] leading-snug whitespace-pre-line font-medium min-h-[34px]">
                      {c.title}
                    </div>
                    <div className="mt-2.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCert(c.id);
                          setCertModalTab("info");
                        }}
                        className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-[11.5px] text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:text-[#0047AB] transition-colors cursor-pointer font-medium"
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-md border border-[#e2e8f0] py-1.5 text-[11.5px] text-[#334155] hover:bg-[#f8fafc] hover:border-[#cbd5e1] hover:text-[#0047AB] transition-colors cursor-pointer font-medium"
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
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs min-w-0">
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
              Năng suất theo thợ hàn
            </div>
            <div className="table-scroll overflow-x-auto mt-3.5">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr_1fr_0.9fr] gap-x-2 border-b border-[#e2e8f0] pb-2 text-[11.5px] font-semibold uppercase tracking-wider text-[#64748b]">
                  <div>Họ tên</div>
                  <div>Tổ / Máy</div>
                  <div>Mối hàn</div>
                  <div>Hôm nay</div>
                  <div>Tỷ lệ đạt</div>
                  <div className="text-right">Ca làm</div>
                </div>
                <div className="divide-y divide-[#f8fafc]">
                  {WELDER_PRODUCTIVITY.map((w, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr_1fr_0.9fr] gap-x-2 items-center py-2.5 text-[13px] text-[#334155] hover:bg-[#f8fafc] transition-colors"
                    >
                      <div className="font-semibold text-[#0f172a]">
                        {w.name}
                      </div>
                      <div>{w.teamMachine}</div>
                      <div className="font-mono tabular-nums">{w.welds}</div>
                      <div className="font-mono tabular-nums">{w.today}</div>
                      <div className={`font-semibold font-mono tabular-nums ${w.rateColor}`}>
                        {w.passRate}
                      </div>
                      <div className="text-right">{w.shift}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 text-[12.5px] text-[#0047AB] font-medium">
              <button type="button" className="hover:underline cursor-pointer">
                Xem toàn bộ nhân sự
              </button>
              <span className="text-[#94a3b8]">→</span>
            </div>
          </div>
        </div>

        {/* Right Column (320px) */}
        <div className="flex flex-col gap-4">
          {/* Card: Bảng tin nhanh */}
          <div className="rounded-xl bg-[#0d2346] border border-[#1e3a8a] p-4 sm:p-5 text-white shadow-xs">
            <div className="flex items-center gap-2 text-[14.5px] font-bold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
              </svg>
              <span>Bảng tin nhanh</span>
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-semibold leading-snug">
                    Ca 2 · Tổ 1 thiếu 1 thợ hàn hạng 1
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#93c5fd]">
                    2 phút trước
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="7" />
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-semibold leading-snug">
                    3 chứng chỉ sắp hết hạn trong tuần này
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#93c5fd]">
                    1 giờ trước
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#163567]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-semibold leading-snug">
                    Khóa tái huấn luyện PCCC ngày 15/03
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#93c5fd]">
                    Hôm nay
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4.5 w-full rounded-lg bg-[#f5a623] py-2.5 text-center text-[13px] font-bold text-[#0f172a] hover:bg-[#d97706] transition-colors cursor-pointer shadow-xs"
            >
              Xem tất cả tin
            </button>
          </div>

          {/* Card: Chứng chỉ sắp hết hạn */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="text-[14.5px] font-bold tracking-tight text-[#0f172a]">
              Chứng chỉ sắp hết hạn
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0047AB]">
                    Trần Thị Mai Anh
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#64748b]">
                    EN ISO 9606-1
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
                    Nguyễn Văn Minh
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#64748b]">
                    Huấn luyện an toàn
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
                    Phạm Quốc Bảo
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#64748b]">
                    Kiểm định UT cấp 2
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

          {/* Card: Quote */}
          <div className="rounded-xl bg-[#eff6ff] border border-[#bfdbfe] p-4 sm:p-5">
            <div className="text-[32px] font-bold text-[#0047AB] leading-none opacity-40">
              “
            </div>
            <div className="mt-1 text-[13px] italic leading-relaxed text-[#1e3a8a]">
              Mỗi mối hàn đạt chuẩn là một chuyến tàu an toàn. Kỷ luật hôm nay giữ đường ray cho mai sau.
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11.5px] font-medium text-[#64748b]">Ban Giám đốc TCW</div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#0047AB" className="opacity-70">
                <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V7h12v4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Certificate Modal */}
      {selectedCert && certDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCert(null);
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 border border-[#e2e8f0]">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <h3 className="text-[16px] font-bold text-[#0f172a]">
                {certDetail.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCert(null)}
                className="h-8 w-8 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] flex items-center justify-center cursor-pointer text-[18px] transition-colors"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex gap-2 border-b border-[#e2e8f0] pb-2">
              <button
                type="button"
                onClick={() => setCertModalTab("info")}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                  certModalTab === "info"
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                Thông tin
              </button>
              <button
                type="button"
                onClick={() => setCertModalTab("holders")}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                  certModalTab === "holders"
                    ? "bg-[#0047AB] text-white shadow-xs"
                    : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                }`}
              >
                Danh sách người được cấp và còn hạn
              </button>
            </div>

            <div className="mt-4 max-h-[380px] overflow-y-auto">
              {certModalTab === "info" ? (
                <div className="divide-y divide-[#f1f5f9] text-[13px]">
                  {certDetail.info.map(([label, val], i) => (
                    <div key={i} className="flex py-2.5 gap-3">
                      <span className="w-1/3 text-[#64748b] font-medium">{label}</span>
                      <span className="flex-1 text-[#0f172a] font-semibold">{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#f1f5f9]">
                  {certDetail.holders.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[#e2e8f0]">
                        <Image
                          src={`https://randomuser.me/api/portraits/${h.photo}.jpg`}
                          alt={h.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-[#0f172a]">
                          {h.name}
                        </div>
                        <div className="text-[11px] text-[#64748b]">
                          Cấp {h.issued} · Hết hạn {h.expires}
                        </div>
                      </div>
                      <span className="rounded-md bg-[#f0fdf4] border border-[#bbf7d0] px-2 py-0.5 text-[10.5px] font-bold text-[#15803d]">
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
