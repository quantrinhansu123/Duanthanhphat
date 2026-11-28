"use client";

import { useMemo, useState } from "react";
import { deploymentItems } from "@/data/deploymentItems";
import AcceptanceLog from "@/components/AcceptanceLog";
import Pager, { usePaged } from "@/components/Pager";

const statusStyle = {
  "Đã bàn giao": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Chưa bàn giao": "bg-amber-50 text-amber-700 border-amber-200",
} as const;

const controlClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-xs transition-colors hover:border-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

export default function DeploymentHandoverList() {
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [query, setQuery] = useState("");
  const [hasVideo, setHasVideo] = useState("Tất cả tài liệu");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return deploymentItems.filter(
      (row) =>
        (status === "Tất cả trạng thái" || row.status === status) &&
        (hasVideo === "Tất cả tài liệu" ||
          (hasVideo === "Có video" ? Boolean(row.videoUrl) : !row.videoUrl)) &&
        (!q || `${row.category} ${row.content}`.toLocaleLowerCase("vi").includes(q)),
    );
  }, [status, query, hasVideo]);

  const paged = usePaged(filtered, 10);
  const total = deploymentItems.length;
  const handedOver = deploymentItems.filter((row) => row.status === "Đã bàn giao").length;
  const pending = total - handedOver;
  const videoCount = deploymentItems.filter((row) => row.videoUrl).length;
  const progress = total ? Math.round((handedOver / total) * 100) : 0;
  const clearFilters = () => {
    setStatus("Tất cả trạng thái");
    setQuery("");
    setHasVideo("Tất cả tài liệu");
  };

  const stats = [
    { label: "Tổng hạng mục", value: total, tone: "text-slate-900" },
    { label: "Đã bàn giao", value: handedOver, tone: "text-emerald-700" },
    { label: "Chưa bàn giao", value: pending, tone: "text-amber-700" },
    { label: "Có video mẫu", value: videoCount, tone: "text-[#0047AB]" },
  ];

  return (
    <main className="w-full px-4 pb-8 sm:px-6">
      <header className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img
            src="/logo.png"
            alt="TCW - Thành Phát"
            className="h-10 w-10 shrink-0 rounded-full object-contain shadow-xs ring-1 ring-slate-200 sm:h-12 sm:w-12"
          />
          <div className="border-l border-slate-200 pl-3 sm:pl-4">
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              Tiến độ bàn giao &amp; nghiệm thu
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Hệ thống Quản lý hàn ray · Công ty cổ phần công trình Thành Phát
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Dữ liệu mẫu tĩnh
        </span>
      </header>

      <section
        aria-label="Tổng quan tiến độ bàn giao"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm sm:p-4"
          >
            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
            <p className={`mt-1.5 font-mono text-xl font-bold tracking-tight tabular-nums sm:mt-2 sm:text-2xl ${stat.tone}`}>
              {stat.value}
            </p>
          </article>
        ))}
      </section>

      <section
        className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
        aria-label="Tỷ lệ bàn giao"
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold text-slate-800">Tiến độ bàn giao</span>
          <span className="font-mono font-semibold tabular-nums text-slate-700">
            {handedOver}/{total} hạng mục ({progress}%)
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Tỷ lệ hạng mục đã bàn giao"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${handedOver} trên ${total} hạng mục đã bàn giao`}
          className="h-2.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section
        aria-label="Bộ lọc hạng mục"
        className="mb-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs sm:p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Tìm theo hạng mục hoặc nội dung</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm hạng mục hoặc nội dung..."
              className={`${controlClass} w-full`}
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex">
            <label>
              <span className="sr-only">Lọc theo trạng thái</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${controlClass} w-full cursor-pointer lg:min-w-[190px]`}
              >
                {["Tất cả trạng thái", "Đã bàn giao", "Chưa bàn giao"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Lọc theo video</span>
              <select
                value={hasVideo}
                onChange={(e) => setHasVideo(e.target.value)}
                className={`${controlClass} w-full cursor-pointer lg:min-w-[165px]`}
              >
                {["Tất cả tài liệu", "Có video", "Chưa có video"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={clearFilters}
              className={`${controlClass} cursor-pointer font-medium hover:bg-slate-50`}
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p aria-live="polite" className="text-xs font-medium text-slate-600">
            Đang hiển thị <span className="font-mono font-semibold text-slate-900">{filtered.length}</span>/
            {total} hạng mục
          </p>
          <p className="text-xs text-slate-500">
            Dữ liệu mẫu tĩnh — chưa lưu xác nhận nghiệm thu.
          </p>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th scope="col" className="w-[230px] px-3.5 py-3">
                  Hạng mục
                </th>
                <th scope="col" className="px-3.5 py-3">
                  Nội dung
                </th>
                <th scope="col" className="w-[150px] px-3.5 py-3">
                  Video mẫu
                </th>
                <th scope="col" className="w-[160px] px-3.5 py-3">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-3.5 py-3.5 align-top">
                    <span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-[#0047AB]">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-3.5 py-3.5 leading-relaxed text-slate-700">{row.content}</td>
                  <td className="px-3.5 py-3.5">
                    {row.videoUrl ? (
                      <a
                        href={row.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0047AB] hover:underline"
                      >
                        Xem video ↗
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa có</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[row.status]}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${row.status === "Đã bàn giao" ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm font-medium text-slate-600">
                    Không tìm thấy hạng mục phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pager {...paged.pagerProps} />

      <section className="mt-10" aria-labelledby="nghiem-thu-heading">
        <h2 id="nghiem-thu-heading" className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">
          Nhật ký nghiệm thu thay đổi
        </h2>
        <AcceptanceLog />
      </section>
    </main>
  );
}
