"use client";

import { useMemo, useState } from "react";
import {
  machineFaultLibrary,
  machineFaultSections,
  NDT_DEFECTS,
  type MachineFault,
  type MachineFaultSection,
  type NdtDefect,
  type ErrorCategory,
} from "@/data/error-library";
import { CaretDown, MagnifyingGlass } from "@/components/icons";

export type ErrorLibraryProps = {
  categories?: ErrorCategory[];
  mode?: "machine" | "ndt";
};

export default function ErrorLibrary({ categories, mode }: ErrorLibraryProps) {
  // Xác định chế độ hiển thị: nếu categories chứa "Mối hàn" hoặc mode === "ndt" -> hiển thị mã khuyết tật mối hàn
  const isNdtMode = mode === "ndt" || (categories?.length === 1 && categories[0] === "Mối hàn");

  // State cho Thư viện lỗi máy (Machine Faults)
  const [query, setQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState<"Tất cả" | MachineFaultSection>("Tất cả");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // State cho Danh mục NDT
  const [ndtQuery, setNdtQuery] = useState("");

  // Toggle mở rộng / thu gọn 1 triệu chứng
  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(expand: boolean, targetList: MachineFault[]) {
    if (expand) {
      setExpandedIds(new Set(targetList.map((f) => f.id)));
    } else {
      setExpandedIds(new Set());
    }
  }

  // Lọc danh sách sự cố thiết bị
  const filteredFaults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machineFaultLibrary.filter((item) => {
      const matchSection = selectedSection === "Tất cả" || item.section === selectedSection;
      if (!matchSection) return false;
      if (!q) return true;

      const matchSymptom = item.symptom.toLowerCase().includes(q);
      const matchSectionName = item.section.toLowerCase().includes(q);
      const matchCases = item.cases.some(
        (c) => c.probableCause.toLowerCase().includes(q) || c.remedy.toLowerCase().includes(q),
      );

      return matchSymptom || matchSectionName || matchCases;
    });
  }, [query, selectedSection]);

  // Lọc danh mục NDT
  const filteredNdt = useMemo(() => {
    const q = ndtQuery.trim().toLowerCase();
    if (!q) return NDT_DEFECTS;
    return NDT_DEFECTS.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.nameEn.toLowerCase().includes(q),
    );
  }, [ndtQuery]);

  // ---------------------------------------------------------------------------
  // Giao diện: Danh mục Mã khuyết tật mối hàn NDT (Ảnh 11)
  // ---------------------------------------------------------------------------
  if (isNdtMode) {
    return (
      <main className="w-full px-4 sm:px-6 pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Mã khuyết tật mối hàn NDT
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              Danh mục đúng theo tài liệu được cung cấp, dùng cho nhật ký hàn và báo cáo.
            </p>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
            Đúng 6 mã tiêu chuẩn: <strong className="text-[#0047AB] font-mono">LOF, LOP, C, S, Po, La</strong>
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={ndtQuery}
              onChange={(e) => setNdtQuery(e.target.value)}
              placeholder="Tìm mã khuyết tật (LOF, LOP, C, S, Po, La) hoặc tên tiếng Anh..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="table-scroll overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="whitespace-nowrap px-4 py-3 w-28">Mã lỗi</th>
                  <th className="min-w-[300px] px-3.5 py-3">Tên tiếng Anh (Standard)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNdt.map((item: NdtDefect) => (
                  <tr key={item.code} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-base text-[#0047AB]">
                      <span className="inline-block rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5 font-semibold text-slate-900 font-mono">
                      {item.nameEn}
                    </td>
                  </tr>
                ))}
                {filteredNdt.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-slate-500">
                      Không tìm thấy mã khuyết tật phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Giao diện: Thư viện xử lý sự cố thiết bị máy móc (Ảnh 6-10)
  // ---------------------------------------------------------------------------
  const sectionCounts = {
    "Tổng thể": machineFaultLibrary.filter((f) => f.section === "Tổng thể").length,
    "Cẩu": machineFaultLibrary.filter((f) => f.section === "Cẩu").length,
    "Bơm": machineFaultLibrary.filter((f) => f.section === "Bơm").length,
    "Máy hàn": machineFaultLibrary.filter((f) => f.section === "Máy hàn").length,
  };

  return (
    <main className="w-full px-4 sm:px-6 pb-8">
      {/* Thống kê đầu trang */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2">
          <span>
            Tổng số: <strong className="font-semibold text-slate-900 font-mono tabular-nums">{machineFaultLibrary.length}</strong> hiện tượng sự cố
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            Tổng thể (<strong className="font-mono text-[#0047AB]">{sectionCounts["Tổng thể"]}</strong>) · Cẩu (<strong className="font-mono text-[#0047AB]">{sectionCounts["Cẩu"]}</strong>) · Bơm (<strong className="font-mono text-[#0047AB]">{sectionCounts["Bơm"]}</strong>) · Máy hàn (<strong className="font-mono text-[#0047AB]">{sectionCounts["Máy hàn"]}</strong>)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleAll(true, filteredFaults)}
            className="text-xs font-semibold text-[#0047AB] hover:underline cursor-pointer"
          >
            Mở rộng tất cả
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => toggleAll(false, filteredFaults)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            Thu gọn tất cả
          </button>
        </div>
      </div>

      {/* Bộ lọc tìm kiếm & Tabs theo nhóm Tổng thể / Cẩu / Bơm / Máy hàn */}
      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
        <div className="relative min-w-[260px] flex-1">
          <MagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo triệu chứng, nguyên nhân (áp suất, bọt khí, gioăng, piston...), biện pháp xử lý..."
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs outline-hidden focus:border-[#0047AB] focus:ring-2 focus:ring-[#0047AB]/20 hover:border-slate-400 transition-all duration-150"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedSection("Tất cả")}
            className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
              selectedSection === "Tất cả"
                ? "bg-[#0047AB] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Tất cả ({machineFaultLibrary.length})
          </button>
          {machineFaultSections.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setSelectedSection(sec)}
              className={`h-10 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                selectedSection === sec
                  ? "bg-[#0047AB] text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {sec} ({sectionCounts[sec]})
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách các hiện tượng sự cố dạng Accordion mở rộng */}
      <div className="space-y-3">
        {filteredFaults.map((item) => {
          const isExpanded = expandedIds.has(item.id);
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all duration-150"
            >
              {/* Tiêu đề triệu chứng */}
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-50 font-mono text-xs font-bold text-[#0047AB] border border-blue-200">
                    {item.order}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        {item.section}
                      </span>
                      <span className="text-xs text-slate-400">· {item.cases.length} nguyên nhân & giải pháp</span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                      {item.symptom}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-xs font-medium text-slate-400">
                    {isExpanded ? "Thu gọn" : "Xem cách xử lý"}
                  </span>
                  <CaretDown
                    size={16}
                    weight="bold"
                    aria-hidden
                    className={`text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180 text-[#0047AB]" : ""}`}
                  />
                </div>
              </button>

              {/* Bảng Nguyên nhân & Biện pháp khắc phục khi mở rộng */}
              {isExpanded && (
                <div className="border-t border-slate-200/70 bg-slate-50/50 p-4 sm:p-5 animate-in fade-in-50 duration-150">
                  <div className="table-scroll overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full min-w-[620px] border-collapse text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                          <th className="w-12 px-3 py-2.5 text-center">#</th>
                          <th className="w-1/2 px-4 py-2.5">Nguyên nhân có thể (Probable Cause)</th>
                          <th className="w-1/2 px-4 py-2.5">Biện pháp khắc phục (Remedy)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.cases.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-3 text-center font-mono font-semibold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-rose-900/90 leading-relaxed bg-rose-50/20">
                              {c.probableCause}
                            </td>
                            <td className="px-4 py-3 font-medium text-emerald-900/90 leading-relaxed bg-emerald-50/20">
                              {c.remedy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredFaults.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-xs sm:text-sm text-slate-500">
            Không tìm thấy sự cố thiết bị nào phù hợp với từ khóa &quot;{query}&quot;.
          </div>
        )}
      </div>
    </main>
  );
}
